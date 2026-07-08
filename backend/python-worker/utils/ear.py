# """
# Eye Aspect Ratio (EAR) utilities for blink detection using MediaPipe Face Mesh
# landmarks (468/478-point model, refine_landmarks=True gives iris points too).

# EAR formula (Soukupova & Cech, 2016):
#     EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)

# A sharp drop in EAR below a threshold indicates a closed eye (blink).
# """

# import numpy as np

# # MediaPipe Face Mesh landmark indices for the 6-point eye contour
# # (subset of the 468 landmarks, chosen to match the classic EAR paper layout)
# LEFT_EYE = [362, 385, 387, 263, 373, 380]
# RIGHT_EYE = [33, 160, 158, 133, 153, 144]

# # Iris center landmarks (only present when refine_landmarks=True)
# LEFT_IRIS = [474, 475, 476, 477]
# RIGHT_IRIS = [469, 470, 471, 472]

# EAR_BLINK_THRESHOLD = 0.21   # below this the eye is considered closed
# EAR_CONSEC_FRAMES = 2        # minimum consecutive closed frames to count as a blink


# def _dist(a, b):
#     return float(np.linalg.norm(np.array(a) - np.array(b)))


# def eye_aspect_ratio(landmarks, indices):
#     p1, p2, p3, p4, p5, p6 = [landmarks[i] for i in indices]
#     vertical = _dist(p2, p6) + _dist(p3, p5)
#     horizontal = _dist(p1, p4)
#     if horizontal == 0:
#         return 0.0
#     return vertical / (2.0 * horizontal)


# def frame_ear(landmarks):
#     """Average EAR across both eyes for a single frame's landmark set."""
#     left = eye_aspect_ratio(landmarks, LEFT_EYE)
#     right = eye_aspect_ratio(landmarks, RIGHT_EYE)
#     return (left + right) / 2.0


# def iris_center(landmarks, indices):
#     pts = np.array([landmarks[i] for i in indices])
#     return pts.mean(axis=0)


# class BlinkTracker:
#     """Stateful blink counter fed one EAR value per frame."""

#     def __init__(self, threshold=EAR_BLINK_THRESHOLD, consec_frames=EAR_CONSEC_FRAMES):
#         self.threshold = threshold
#         self.consec_frames = consec_frames
#         self._closed_run = 0
#         self.blink_count = 0
#         self.closed_frame_count = 0
#         self.total_frames = 0
#         self._blink_durations = []  # in frames

#     def update(self, ear_value):
#         self.total_frames += 1
#         if ear_value < self.threshold:
#             self._closed_run += 1
#             self.closed_frame_count += 1
#         else:
#             if self._closed_run >= self.consec_frames:
#                 self.blink_count += 1
#                 self._blink_durations.append(self._closed_run)
#             self._closed_run = 0

#     def finalize(self, fps):
#         # flush a trailing blink if the video ends mid-blink
#         if self._closed_run >= self.consec_frames:
#             self.blink_count += 1
#             self._blink_durations.append(self._closed_run)
#             self._closed_run = 0

#         duration_seconds = self.total_frames / fps if fps > 0 else 0
#         blink_rate_per_min = (self.blink_count / duration_seconds * 60) if duration_seconds > 0 else 0
#         avg_blink_duration_ms = (
#             (sum(self._blink_durations) / len(self._blink_durations)) / fps * 1000
#             if self._blink_durations and fps > 0 else 0
#         )
#         eye_closure_rate = (
#             self.closed_frame_count / self.total_frames if self.total_frames > 0 else 0
#         )
#         return {
#             "blinkCount": self.blink_count,
#             "blinkRate": round(blink_rate_per_min, 2),
#             "avgBlinkDurationMs": round(avg_blink_duration_ms, 2),
#             "eyeClosureRate": round(eye_closure_rate, 4),
#         }

# """
# Eye Aspect Ratio (EAR) utilities for blink detection using MediaPipe Face Mesh
# landmarks (468/478-point model, refine_landmarks=True gives iris points too).

# EAR formula (Soukupova & Cech, 2016):
#     EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)

# A sharp drop in EAR below a threshold indicates a closed eye (blink).
# """

# import numpy as np

# # MediaPipe Face Mesh landmark indices for the 6-point eye contour
# # (subset of the 468 landmarks, chosen to match the classic EAR paper layout)
# LEFT_EYE = [362, 385, 387, 263, 373, 380]
# RIGHT_EYE = [33, 160, 158, 133, 153, 144]

# # Iris center landmarks (only present when refine_landmarks=True)
# LEFT_IRIS = [474, 475, 476, 477]
# RIGHT_IRIS = [469, 470, 471, 472]

# EAR_BLINK_THRESHOLD = 0.21   # below this the eye is considered closed
# EAR_CONSEC_FRAMES = 2        # minimum consecutive closed frames to count as a blink


# def _dist(a, b):
#     return float(np.linalg.norm(np.array(a) - np.array(b)))


# def eye_aspect_ratio(landmarks, indices):
#     p1, p2, p3, p4, p5, p6 = [landmarks[i] for i in indices]
#     vertical = _dist(p2, p6) + _dist(p3, p5)
#     horizontal = _dist(p1, p4)
#     if horizontal == 0:
#         return 0.0
#     return vertical / (2.0 * horizontal)


# def frame_ear(landmarks):
#     """Average EAR across both eyes for a single frame's landmark set."""
#     left = eye_aspect_ratio(landmarks, LEFT_EYE)
#     right = eye_aspect_ratio(landmarks, RIGHT_EYE)
#     return (left + right) / 2.0


# def iris_center(landmarks, indices):
#     pts = np.array([landmarks[i] for i in indices])
#     return pts.mean(axis=0)


# class BlinkTracker:
#     """
#     Stateful blink counter fed one EAR value per *sampled* (processed) frame.

#     v2 change: durations/intervals are now computed in units of "sampled
#     frames" and converted to real time via an explicit `seconds_per_sample`
#     passed to `finalize()`, rather than assuming every processed frame is
#     exactly 1/fps apart. That assumption was wrong whenever frame sampling
#     skips frames on long videos (see webcam_features.py's MAX_SAMPLED_FRAMES),
#     which silently underestimated blink durations on longer recordings —
#     fixed here as part of the v2 upgrade.
#     """

#     def __init__(self, threshold=EAR_BLINK_THRESHOLD, consec_frames=EAR_CONSEC_FRAMES):
#         self.threshold = threshold
#         self.consec_frames = consec_frames
#         self._closed_run = 0
#         self.blink_count = 0
#         self.closed_frame_count = 0
#         self.total_frames = 0
#         self._blink_durations = []       # in sampled-frame units
#         self._blink_end_positions = []    # sampled-frame index at which each blink ended (for interval variance)

#     def update(self, ear_value):
#         self.total_frames += 1
#         if ear_value < self.threshold:
#             self._closed_run += 1
#             self.closed_frame_count += 1
#         else:
#             if self._closed_run >= self.consec_frames:
#                 self.blink_count += 1
#                 self._blink_durations.append(self._closed_run)
#                 self._blink_end_positions.append(self.total_frames)
#             self._closed_run = 0

#     def finalize(self, seconds_per_sample):
#         # flush a trailing blink if the video ends mid-blink
#         if self._closed_run >= self.consec_frames:
#             self.blink_count += 1
#             self._blink_durations.append(self._closed_run)
#             self._blink_end_positions.append(self.total_frames)
#             self._closed_run = 0

#         duration_seconds = self.total_frames * seconds_per_sample
#         blink_rate_per_min = (self.blink_count / duration_seconds * 60) if duration_seconds > 0 else 0

#         durations_ms = [d * seconds_per_sample * 1000 for d in self._blink_durations]
#         avg_blink_duration_ms = float(np.mean(durations_ms)) if durations_ms else 0.0
#         max_blink_duration_ms = float(np.max(durations_ms)) if durations_ms else 0.0

#         # Variance of the time gaps between consecutive blink END events, in
#         # seconds^2 — a measure of how regular/irregular blinking rhythm is.
#         if len(self._blink_end_positions) > 1:
#             gaps = np.diff(self._blink_end_positions) * seconds_per_sample
#             blink_interval_variance = float(np.var(gaps))
#         else:
#             blink_interval_variance = 0.0

#         eye_closure_rate = (
#             self.closed_frame_count / self.total_frames if self.total_frames > 0 else 0
#         )

#         return {
#             "blinkCount": self.blink_count,
#             "blinkRate": round(blink_rate_per_min, 2),
#             "avgBlinkDurationMs": round(avg_blink_duration_ms, 2),
#             "maxBlinkDurationMs": round(max_blink_duration_ms, 2),
#             "blinkIntervalVariance": round(blink_interval_variance, 4),
#             "eyeClosureRate": round(eye_closure_rate, 4),
#         }

"""
Eye Aspect Ratio (EAR) utilities for blink detection using MediaPipe Face Mesh
landmarks (468/478-point model, refine_landmarks=True gives iris points too).

EAR formula (Soukupova & Cech, 2016):
    EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)

A sharp drop in EAR below a threshold indicates a closed eye (blink).

--------------------------------------------------------------------------
AUDIT FIX (this pass) — blink validity is now decided in REAL TIME
(milliseconds), not in sampled-frame counts.
--------------------------------------------------------------------------
The previous version used a fixed `EAR_CONSEC_FRAMES = 2` — i.e. "2
*sampled* frames of closed eyes = one blink" — regardless of how far apart
those sampled frames actually were in real time. That's only correct at a
single fixed effective fps. This pipeline uses variable-stride frame
sampling (`MAX_SAMPLED_FRAMES` in webcam_features.py), so the real-world
gap between two consecutive *sampled* frames shrinks or grows with video
length:

  - Short video (little/no downsampling): 2 sampled frames ~= 2 raw frames
    ~= 60-80ms at 25-30fps -> can UNDER-count blinks (a real ~100ms blink
    barely reaches 2 samples, so borderline blinks get missed) and
    OVER-count noise (2 frames of eyelash/landmark jitter passes as a
    "blink").
  - Long video (heavy downsampling, e.g. ~1.5 effective fps on a 10-minute
    recording): 2 sampled frames ~= 1.3 SECONDS. No real blink (100-300ms)
    can ever reach that threshold, so blinkCount silently collapses toward
    zero, while `averageBlinkDuration`/`maximumBlinkDuration` for whatever
    rare runs DO get counted are reported far outside the real 100-300ms
    physiological range — this is the root cause behind the kind of
    833ms/1200ms average-duration values flagged in the audit spec.

Fix: `BlinkTracker` now takes `seconds_per_sample` at construction and
converts three constants — MIN_BLINK_MS, MAX_BLINK_MS, BLINK_MERGE_GAP_MS —
into frame-count thresholds ONCE, so "is this run of closed frames a real
blink" is always answered in real time, independent of the sampling
stride:

  1. Too short (< MIN_BLINK_MS)  -> discarded as EAR/landmark noise, not a
     blink at all (fixes false-positive over-counting from single-sample
     jitter on lightly-downsampled video).
  2. Too long  (> MAX_BLINK_MS)  -> discarded as a PROLONGED closure
     (drowsiness, participant covering their eyes, looking sharply down —
     not a physical blink) and, critically, NOT allowed to inflate
     averageBlinkDuration / maximumBlinkDuration the way it previously
     could (this is the "distinguish from prolonged eye closure"
     requirement from the audit spec).
  3. In between -> counted as exactly one blink, UNLESS the eye reopened
     for less than BLINK_MERGE_GAP_MS before closing again, in which case
     the reopening is treated as EAR/landmark jitter and merged into the
     SAME blink rather than being counted as two separate blinks
     ("duplicate blink counting" / "merged blinks" from the audit spec).

Known limitation this does NOT fix: if the effective sampling rate for a
given recording drops so low that even `MIN_BLINK_MS` rounds down to
`min_closed_frames = 1` sampled frame representing >300ms of real time,
individual physical blinks are structurally undetectable no matter how the
threshold is tuned — that's a sampling-density problem in
webcam_features.py's MAX_SAMPLED_FRAMES strategy, not something a smarter
threshold in this file can recover. See the accompanying README for a
recommended follow-up (a duration-aware sampling budget) that was
deliberately NOT implemented in this pass to avoid changing per-assessment
processing time, per the "maintain approximately current processing speed"
requirement.
"""

import numpy as np

# MediaPipe Face Mesh landmark indices for the 6-point eye contour
# (subset of the 468 landmarks, chosen to match the classic EAR paper layout)
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

# Iris center landmarks (only present when refine_landmarks=True)
LEFT_IRIS = [474, 475, 476, 477]
RIGHT_IRIS = [469, 470, 471, 472]

EAR_BLINK_THRESHOLD = 0.21  # below this the eye is considered closed

# --- Blink timing constants, in REAL TIME (ms), not frame counts ---
# Typical human blink duration is ~100-300ms; rarely below ~80ms (would be
# a partial/incomplete closure) or above ~400-500ms (drowsiness / covering
# eyes / a deliberate long closure rather than a reflexive blink).
MIN_BLINK_MS = 80
MAX_BLINK_MS = 500
BLINK_MERGE_GAP_MS = 60  # a reopening shorter than this is treated as noise inside one blink


def _dist(a, b):
    return float(np.linalg.norm(np.array(a) - np.array(b)))


def eye_aspect_ratio(landmarks, indices):
    p1, p2, p3, p4, p5, p6 = [landmarks[i] for i in indices]
    vertical = _dist(p2, p6) + _dist(p3, p5)
    horizontal = _dist(p1, p4)
    if horizontal == 0:
        return 0.0
    return vertical / (2.0 * horizontal)


def frame_ear(landmarks):
    """Average EAR across both eyes for a single frame's landmark set."""
    left = eye_aspect_ratio(landmarks, LEFT_EYE)
    right = eye_aspect_ratio(landmarks, RIGHT_EYE)
    return (left + right) / 2.0


def iris_center(landmarks, indices):
    pts = np.array([landmarks[i] for i in indices])
    return pts.mean(axis=0)


class BlinkTracker:
    """
    Stateful blink counter fed one EAR value per *sampled* (processed) frame.

    Construction now requires `seconds_per_sample` (computed once in
    webcam_features.py before the MediaPipe loop starts) so every duration
    decision below is made in real time rather than raw frame counts. See
    the module docstring above for the full rationale.
    """

    def __init__(self, seconds_per_sample, threshold=EAR_BLINK_THRESHOLD):
        self.threshold = threshold
        # Guard against a zero/garbage seconds_per_sample (e.g. an
        # unreadable video with fps=0) so division below can't blow up;
        # falls back to a conservative 25fps assumption in that edge case.
        self.seconds_per_sample = seconds_per_sample if seconds_per_sample and seconds_per_sample > 0 else (1.0 / 25.0)

        self.min_closed_frames = max(1, round((MIN_BLINK_MS / 1000.0) / self.seconds_per_sample))
        self.max_closed_frames = max(
            self.min_closed_frames, round((MAX_BLINK_MS / 1000.0) / self.seconds_per_sample)
        )
        self.merge_gap_frames = max(0, round((BLINK_MERGE_GAP_MS / 1000.0) / self.seconds_per_sample))

        self._open_run = 0
        self._pending_closed_run = 0  # accumulates across a merged short reopening

        self.blink_count = 0
        self.prolonged_closure_count = 0  # diagnostic only; not part of the v1 schema
        self.closed_frame_count = 0
        self.total_frames = 0
        self._blink_durations = []      # in sampled-frame units
        self._blink_end_positions = []  # sampled-frame index at which each blink ended

    def _finalize_pending_blink(self):
        run = self._pending_closed_run
        self._pending_closed_run = 0
        if run <= 0:
            return
        if run < self.min_closed_frames:
            return  # too short: EAR/landmark noise, not a real blink
        if run > self.max_closed_frames:
            self.prolonged_closure_count += 1
            return  # too long: prolonged closure, not a blink — excluded from duration stats
        self.blink_count += 1
        self._blink_durations.append(run)
        self._blink_end_positions.append(self.total_frames)

    def update(self, ear_value):
        self.total_frames += 1
        is_closed = ear_value < self.threshold

        if is_closed:
            self.closed_frame_count += 1
            if self._pending_closed_run > 0 and self._open_run > 0:
                if self._open_run <= self.merge_gap_frames:
                    # Brief reopening within the merge window: treat as
                    # jitter, fold it back into the same closed run.
                    self._pending_closed_run += self._open_run + 1
                else:
                    self._finalize_pending_blink()
                    self._pending_closed_run = 1
            else:
                self._pending_closed_run += 1
            self._open_run = 0
        else:
            if self._pending_closed_run > 0:
                self._open_run += 1
                if self._open_run > self.merge_gap_frames:
                    self._finalize_pending_blink()
                    self._open_run = 0
            # else: ordinary open-eye frame, nothing pending to track

    def finalize(self):
        """Flush any run still pending when the video ends, then compute
        all summary stats. No longer takes seconds_per_sample as an
        argument — it's fixed at construction time now."""
        self._finalize_pending_blink()

        duration_seconds = self.total_frames * self.seconds_per_sample
        blink_rate_per_min = (self.blink_count / duration_seconds * 60) if duration_seconds > 0 else 0

        durations_ms = [d * self.seconds_per_sample * 1000 for d in self._blink_durations]
        avg_blink_duration_ms = float(np.mean(durations_ms)) if durations_ms else 0.0
        max_blink_duration_ms = float(np.max(durations_ms)) if durations_ms else 0.0

        if len(self._blink_end_positions) > 1:
            gaps = np.diff(self._blink_end_positions) * self.seconds_per_sample
            blink_interval_variance = float(np.var(gaps))
        else:
            blink_interval_variance = 0.0

        eye_closure_rate = (
            self.closed_frame_count / self.total_frames if self.total_frames > 0 else 0
        )

        return {
            "blinkCount": self.blink_count,
            "blinkRate": round(blink_rate_per_min, 2),
            "avgBlinkDurationMs": round(avg_blink_duration_ms, 2),
            "maxBlinkDurationMs": round(max_blink_duration_ms, 2),
            "blinkIntervalVariance": round(blink_interval_variance, 4),
            "eyeClosureRate": round(eye_closure_rate, 4),
            "_diagnostics": {
                "minClosedFramesForBlink": self.min_closed_frames,
                "maxClosedFramesForBlink": self.max_closed_frames,
                "mergeGapFrames": self.merge_gap_frames,
                "prolongedClosureCount": self.prolonged_closure_count,
            },
        }
