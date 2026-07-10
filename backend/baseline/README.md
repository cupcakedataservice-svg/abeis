# ABEIS — Coding Baseline Generation Module

Phase 1 of the ABEIS behavioral authentication pipeline: turns each
student's Coding calibration sessions into a per-feature statistical
baseline (mean, std, median, min, max, Q1, Q3, IQR, CV) that the future
authentication engine will use to compute weighted Z-scores against live
assessment behavior.

This module is **completely independent** of the existing ABEIS
backend/frontend code — it does not modify any existing file. It only
reads the unified export dataset (`filtered_dataset.csv`, produced by
`GET /api/admin/export?format=csv`) and optionally writes into a new
MongoDB collection, `behavioral_baselines`, using the same `MONGODB_URI`
the Node.js backend already uses.

---

## 1. Folder contents

```
baseline/
├── generate_baseline.py   # CLI entry point / orchestrator
├── feature_selector.py    # automatic metadata vs. behavioral-feature detection
├── baseline_utils.py       # statistics (mean, std, median, IQR, CV, ...) — pure functions
├── baseline_storage.py     # local JSON + MongoDB storage backends
├── config.py                # all tunable settings (paths, thresholds, storage mode)
├── README.md                 # this file
└── generated/                 # local JSON output (one file per student)
```

---

## 2. Requirements

```bash
pip install pandas numpy pymongo --break-system-packages
```

Python 3.11+ is assumed (per spec). Tested on 3.12.

---

## 3. Quick start

```bash
cd baseline

# 1. Place the exported dataset here (or point --input elsewhere)
cp /path/to/filtered_dataset.csv .

# 2. Run
python generate_baseline.py --input filtered_dataset.csv

# Optional flags:
python generate_baseline.py --input filtered_dataset.csv --store-mode local     # default
python generate_baseline.py --input filtered_dataset.csv --store-mode mongodb
python generate_baseline.py --input filtered_dataset.csv --store-mode both
python generate_baseline.py --input filtered_dataset.csv --assessment-type Coding
```

Outputs:

- `generated/<userId>.json` — one baseline document per qualifying student (if `--store-mode local` or `both`)
- `behavioral_baselines` MongoDB collection — one upserted document per qualifying student (if `--store-mode mongodb` or `both`)
- `baseline_generation_report.txt` — run summary (counts, warnings, errors, timing)
- `baseline_generation.log` — full run log (also printed to console)

---

## 4. How feature selection works (no hardcoded feature names)

`feature_selector.py` classifies **every column** in the dataset at
runtime, in this order:

1. **Exact match** against `config.KNOWN_METADATA_COLUMNS` (e.g. `userId`,
   `assessmentType`, `sessionId`, `email`, ...) → metadata.
2. **Non-numeric dtype** (string, object, datetime, bool) → metadata.
3. **Token-level name match** against `config.METADATA_NAME_SUBSTRINGS`
   (`id`, `url`, `email`, `name`) → metadata. This is **token-based**, not
   raw substring search — `userId` / `session_id` match the `id` token,
   but `webcam_averageFaceConfidence` and `session_idleTimeMs` do **not**,
   because `id` there is buried inside an unrelated word rather than being
   its own identifier token. (A naive substring check would incorrectly
   treat `...Confidence...` and `...idleTime...` as ID-like and silently
   drop two real behavioral features — this was caught and fixed during
   testing; see `_split_camel_and_snake` in `feature_selector.py`.)
4. **Everything else that is numeric** → behavioral feature.

This means: if new numeric behavioral columns are added to the dataset in
the future (e.g. from a new video metric), they are picked up
**automatically** with zero code changes, as long as their name doesn't
collide with a metadata pattern.

To verify what the selector decided for your actual dataset:

```bash
python -c "
import pandas as pd
from feature_selector import classify_columns
df = pd.read_csv('filtered_dataset.csv')
r = classify_columns(df)
print('METADATA:', r.metadata_columns)
print()
print('BEHAVIORAL FEATURES:', r.behavioral_feature_columns)
"
```

**Always run this check against your real file before a production run** —
if a real behavioral column gets misclassified as metadata (or vice
versa), add/adjust an entry in `config.KNOWN_METADATA_COLUMNS` or
`config.METADATA_NAME_SUBSTRINGS` rather than editing the selector logic.

---

## 5. Validation rules

- Only rows where `assessmentType == "Coding"` (case-insensitive) are
  considered.
- A student needs **at least 5** Coding calibration sessions
  (`config.MIN_SESSIONS_PER_TYPE["Coding"]`) to get a baseline. Fewer than
  5 → warning logged, student skipped, **run continues** with the next
  student.
- Any per-user error (storage failure, unexpected exception) is caught,
  logged, and counted — it never aborts the whole run. Only a missing/
  unreadable input file, a missing `assessmentType`/`userId` column, or
  zero detected behavioral features is treated as fatal (non-zero exit
  code), since nothing could proceed in those cases.

---

## 6. Output JSON shape

```json
{
  "userId": "student001",
  "assessmentType": "Coding",
  "sampleCount": 5,
  "generatedAt": "2026-07-10T18:03:35.384498+00:00",
  "features": {
    "mouse_avgSpeed": {
      "mean": 148.835777,
      "std": 10.412891,
      "median": 154.177272,
      "min": 137.410501,
      "max": 159.934283,
      "q1": 137.994923,
      "q3": 154.661905,
      "iqr": 16.666982,
      "cv": 0.069962,
      "missing": 0,
      "available": 5,
      "sampleCount": 5
    }
  }
}
```

Every behavioral feature gets every statistic. Values are rounded to
`config.STATISTIC_DECIMAL_PLACES` (default 6).

### Division-safety guarantees

- `cv` (coefficient of variation, `std / mean`) uses `baseline_utils.safe_divide`,
  which returns `null` instead of raising or emitting `inf`/`NaN` whenever
  the mean is zero or near-zero.
- A feature with **zero available (non-null) values** across all of a
  student's sessions gets every statistic set to `null`, with `missing`/
  `available`/`sampleCount` still populated so the gap is visible rather
  than silently absent.
- A feature with **exactly one** available value gets `std: 0.0` (not
  `null`) — a single observation has no variance, but reporting `0.0`
  keeps the future `Z = (live - mean) / std` computation well-defined
  instead of crashing on a `None` divisor. (`cv` in that case is also
  `0.0`, since `0 / mean` is well-defined whenever `mean != 0`.)
- No code path in `baseline_utils.py` can raise `ZeroDivisionError` —
  verified with unit tests covering all-`NaN`, single-value, constant, and
  zero-mean features (see §8 below).

---

## 7. Storage

Set in `config.py` (`STORE_MODE`) or via `--store-mode`:

| Mode              | Behavior                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `local` (default) | Writes `generated/<userId>.json`                                                                                                                                               |
| `mongodb`         | Upserts into the `behavioral_baselines` collection, keyed on `(userId, assessmentType)` — re-running the generator **updates** a student's baseline rather than duplicating it |
| `both`            | Does both                                                                                                                                                                      |

### MongoDB connection

Reuses the existing ABEIS backend's connection string — set the
`MONGODB_URI` environment variable to the **same value** already in
`backend/.env`:

```bash
export MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/abeis"
python generate_baseline.py --input filtered_dataset.csv --store-mode mongodb
```

No second database is created — this module writes into the same MongoDB
database/cluster the Node.js backend already uses, just a new collection
(`behavioral_baselines`) that the existing backend code never touches.

If MongoDB is unreachable, the **first** connection attempt fails with a
clear logged error and every subsequent user in that run fails fast
(cached error, no repeated network timeouts) rather than hanging or
retrying a doomed connection for every student — the run still completes
and produces a report showing every user as skipped with the connection
error recorded.

---

## 8. Testing performed

Since no real ABEIS export was available in this environment, correctness
was verified against a synthetic dataset shaped like the real
`filtered_dataset.csv` (same kind of metadata columns — `userId`,
`assessmentId`, `sessionId`, `assessmentType`, `email`, timestamps,
browser/device info — plus ~11 numeric behavioral columns spanning mouse,
keyboard, session, coding-specific, and webcam-AI feature families) and a
mix of `Coding`/`MCQ` rows:

- ✅ Metadata vs. behavioral-feature classification: **all 14 metadata
  columns correctly excluded, all 11 real behavioral columns correctly
  included** — including catching and fixing a real bug where naive
  substring matching on `"id"` was incorrectly excluding
  `webcam_averageFaceConfidence` (contains "conf**id**ence") and
  `session_idleTimeMs` (contains "**id**leTimeMs"). Fixed by switching to
  token-level (camelCase/snake_case-aware) matching.
- ✅ `MCQ` rows correctly ignored; only `Coding` rows grouped and processed.
- ✅ A user with only 3 Coding sessions (< 5 minimum) correctly triggers a
  warning, is skipped, and **does not stop the run** — remaining users
  still processed.
- ✅ Division-safety: all-`NaN` feature, single-value feature, constant
  (zero-variance) feature, and zero-mean feature all produce correct,
  non-crashing statistics (see §6 above for expected values).
- ✅ Local JSON storage: files written, valid JSON, all fields present.
- ✅ MongoDB storage: verified against `mongomock` (an in-memory
  MongoDB-compatible server) exercising the **real** connection / index
  creation / upsert code path — confirmed that re-saving a student's
  baseline **updates** the existing document (via the unique index on
  `(userId, assessmentType)`) rather than creating a duplicate.
- ✅ MongoDB unreachable: confirmed the run degrades gracefully (per-user
  errors logged and counted, run completes, report generated) rather than
  crashing or hanging, and confirmed the fail-fast fix (first connection
  failure is cached, so 8 users fail in ~5s total instead of ~40s of
  repeated timeouts).
- ✅ Full report (`baseline_generation_report.txt`) generated with correct
  counts matching the actual run.

**Validated against the real dataset:** this module has now been run
against the actual `filtered_dataset.csv` (88 rows × 109 columns, 12
students, mixed `Coding`/`Typing`/`MCQ` rows). Results:

- Feature classification: **4 real metadata columns** correctly excluded
  (`userId`, `assessmentType`, `session_screenResolution`,
  `session_userAgent`) and **all 105 real behavioral columns** correctly
  detected — including flattened nested fields like
  `webcam_faceBoundingBox_x/y/width/height` and pre-computed composite
  scores like `behaviorScore`, `engagementScore`, `webcamAttentionScore`.
- Filtering: 41 of 88 rows correctly matched `assessmentType == "Coding"`
  (`Typing`/`MCQ` rows correctly ignored).
- Validation: of 12 students, exactly the 4 with ≥5 Coding sessions were
  processed; the other 8 (with 1–4 sessions each) were correctly skipped
  with individual warnings, and the run completed with **zero errors**.
- Every one of the 105 features in every generated baseline document has
  a complete, sane statistics block (verified `mouse_avgSpeed`,
  `webcam_faceBoundingBox_x`, and others by hand).
- Total counts in `baseline_generation_report.txt` reconcile exactly
  (12 total = 4 processed + 8 skipped).

Recommend a real (non-mocked) MongoDB connection test against your actual
`MONGODB_URI` before production use, since the local-storage path above
was what was exercised against the real file — the MongoDB path was
separately verified end-to-end (connect / index / upsert semantics)
against `mongomock`, an in-memory MongoDB-compatible server, but not
against your live database.

---

## 9. Extending to MCQ / Typing later

Per the spec, this should require **config changes only**:

1. Add the new type's minimum session count to
   `config.MIN_SESSIONS_PER_TYPE`, e.g.:
   ```python
   MIN_SESSIONS_PER_TYPE = {"Coding": 5, "MCQ": 5, "Typing": 5}
   ```
2. Run with `--assessment-type MCQ` (or `Typing`).

No changes needed to `feature_selector.py` (feature detection is already
generic), `baseline_utils.py` (statistics are already feature-name
agnostic), or `baseline_storage.py` (already keyed on
`(userId, assessmentType)`). `generate_baseline.py`'s filtering,
validation, and grouping logic all already parameterize on
`assessment_type` rather than hardcoding `"Coding"` anywhere except the
CLI default.

---

## 10. Integration with the existing ABEIS backend

No existing frontend/backend file needs to change. To trigger this module
from the existing Node.js backend when needed (e.g. after an admin
exports data), it can be shelled out to, e.g. from a new admin-triggered
script or a scheduled job:

```js
const { execFile } = require("child_process");
execFile(
  "python3",
  [
    "generate_baseline.py",
    "--input",
    exportedCsvPath,
    "--store-mode",
    "mongodb",
  ],
  { cwd: path.join(__dirname, "../../baseline") },
  (err, stdout, stderr) => {
    /* ... */
  },
);
```

This is a suggestion for future wiring, not part of this module's
deliverables — no existing backend file was modified to add this.
