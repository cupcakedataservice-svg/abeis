"""
config.py
=========
Central configuration for the ABEIS Baseline Generation Module.

All tunable values live here so that `generate_baseline.py`,
`feature_selector.py`, `baseline_utils.py`, and `baseline_storage.py`
never need to be edited directly to change behavior.

Design goal (per spec): supporting a new assessment type (MCQ, Typing, ...)
in the future should require ONLY adding/adjusting values in this file
(e.g. MIN_SESSIONS_PER_TYPE), not rewriting pipeline code.
"""

from __future__ import annotations

from pathlib import Path

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #

# Root of the `baseline/` module (this file's directory).
BASELINE_MODULE_ROOT: Path = Path(__file__).resolve().parent

# Default location of the input dataset. Can be overridden by passing
# --input on the CLI to generate_baseline.py.
DEFAULT_DATASET_PATH: Path = BASELINE_MODULE_ROOT / "filtered_dataset.csv"

# Local JSON output directory (Option 1 storage).
GENERATED_OUTPUT_DIR: Path = BASELINE_MODULE_ROOT / "generated"

# Baseline generation report (plain text summary of a run).
REPORT_FILE_PATH: Path = BASELINE_MODULE_ROOT / "baseline_generation_report.txt"

# Log file (rotating text log, in addition to console output).
LOG_FILE_PATH: Path = BASELINE_MODULE_ROOT / "baseline_generation.log"


# --------------------------------------------------------------------------- #
# Assessment type configuration
# --------------------------------------------------------------------------- #

# Current scope: ONLY Coding is processed. Kept as a dict (not a single
# constant) so that adding MCQ / Typing later is a one-line config change,
# e.g. {"Coding": 5, "MCQ": 5, "Typing": 5}.
MIN_SESSIONS_PER_TYPE: dict[str, int] = {
    "Coding": 2,
}

# The assessment type(s) this run will actually process. Restricting this
# list is what keeps MCQ / Typing rows ignored without deleting any code
# that could support them later.
ACTIVE_ASSESSMENT_TYPES: list[str] = ["Coding"]

# Column in the dataset that identifies the assessment type. Comparison is
# case-insensitive (see baseline_utils.normalize_assessment_type) so that
# "coding", "Coding", "CODING" etc. are all treated the same.
ASSESSMENT_TYPE_COLUMN: str = "assessmentType"

# Column that identifies the student / participant.
USER_ID_COLUMN: str = "userId"


# --------------------------------------------------------------------------- #
# Feature selection
# --------------------------------------------------------------------------- #

# Columns that are ALWAYS treated as metadata (never as behavioral features),
# regardless of dtype. Matching is case-insensitive and ignores separators
# (spaces, underscores, hyphens) — see feature_selector._normalize_col_name.
#
# This list is a safety net on top of the automatic dtype-based detection
# described in the module docstring of feature_selector.py; it does NOT need
# to be exhaustive, since non-numeric columns are already excluded
# automatically. It exists to also exclude numeric-looking metadata such as
# timestamps stored as epoch integers, or a numeric "sessionIndex" column.
KNOWN_METADATA_COLUMNS: set[str] = {
    "userid",
    "user_id",
    "studentid",
    "student_id",
    "assessmentid",
    "assessment_id",
    "sessionid",
    "session_id",
    "assessmenttype",
    "assessment_type",
    "consentid",
    "consent_id",
    "email",
    "name",
    "username",
    "status",
    "startedat",
    "started_at",
    "endedat",
    "ended_at",
    "createdat",
    "created_at",
    "updatedat",
    "updated_at",
    "timestamp",
    "date",
    "durationseconds",
    "duration_seconds",
    "browser",
    "device",
    "os",
    "screenresolution",
    "screen_resolution",
    "ipaddress",
    "ip_address",
    "language",
    "recordingurl",
    "recording_url",
    "cameraurl",
    "camera_url",
    "screenurl",
    "screen_url",
    "questionid",
    "question_id",
    "consentaccepted",
    "consent_accepted",
}

# Substrings that, if found in a (normalized) column name, mark it as
# metadata even if not an exact match above. Kept deliberately small and
# conservative to avoid accidentally swallowing real behavioral features.
METADATA_NAME_SUBSTRINGS: tuple[str, ...] = (
    "id",  # userid, sessionid, assessmentid, consentid, questionid, etc.
    "url",
    "email",
    "name",
)

# Column-name substrings that should NEVER be excluded even if they match a
# metadata substring above (protects real behavioral features whose names
# happen to contain a substring like "id", e.g. "avgInterKeyLatencyMs" does
# NOT contain "id" as a token, but this list guards against edge cases).
FEATURE_NAME_WHITELIST_SUBSTRINGS: tuple[str, ...] = (
    "speed",
    "latency",
    "duration",
    "frequency",
    "rate",
    "count",
    "variance",
    "deviation",
    "score",
    "percentage",
    "distance",
    "movement",
    "acceleration",
    "smoothness",
)

# Minimum number of non-null numeric values a column must have (across the
# ENTIRE dataset) to be considered a usable behavioral feature at all. Guards
# against completely-empty or constant-junk columns slipping into baselines.
MIN_NON_NULL_RATIO_FOR_FEATURE: float = 0.0  # 0.0 = disabled; keep permissive


# --------------------------------------------------------------------------- #
# Statistics
# --------------------------------------------------------------------------- #

# Number of decimal places statistics are rounded to in the output JSON.
STATISTIC_DECIMAL_PLACES: int = 6

# When std (or IQR-based denominator) is ~0, CV is reported as this sentinel
# rather than raising a ZeroDivisionError or emitting inf/NaN into JSON.
SAFE_DIVISION_FALLBACK: float | None = None


# --------------------------------------------------------------------------- #
# Storage
# --------------------------------------------------------------------------- #

# "local"   -> write one JSON file per user under GENERATED_OUTPUT_DIR
# "mongodb" -> write one document per user into MongoDB
# "both"    -> do both (not required by spec, but trivial to support)
STORE_MODE: str = "both"

# MongoDB connection settings. In the real ABEIS deployment this should
# reuse the existing backend's MONGODB_URI (see backend/config/db.js) rather
# than a second, separate connection string. We read it from the environment
# so this module never needs a hardcoded credential.
import os  # noqa: E402  (kept local to this section intentionally)

from pathlib import Path
from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent   # backend/
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)

MONGODB_URI = os.getenv("MONGODB_URI")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI not found in backend/.env")
MONGODB_COLLECTION_NAME: str = "behavioral_baselines"

# Mongo operation timeout (ms) — fail fast rather than hang the whole run if
# MongoDB is unreachable when STORE_MODE == "mongodb".
MONGODB_SERVER_SELECTION_TIMEOUT_MS: int = 5000


# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #

LOG_LEVEL: str = "INFO"
LOG_FORMAT: str = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
