"""
Eye Aspect Ratio (EAR) utilities for blink detection using MediaPipe Face Mesh
landmarks (468/478-point model, refine_landmarks=True gives iris points too).

EAR formula (Soukupova & Cech, 2016):
    EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)

A sharp drop in EAR below a threshold indicates a closed eye (blink).
"""

import numpy as np

# MediaPipe Face Mesh landmark indices for the 6-point eye contour
# (subset of the 468 landmarks, chosen to match the classic EAR paper layout)
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

# Iris center landmarks (only present when refine_landmarks=True)
LEFT_IRIS = [474, 475, 476, 477]
RIGHT_IRIS = [469, 470, 471, 472]

EAR_BLINK_THRESHOLD = 0.21   # below this the eye is considered closed
EAR_CONSEC_FRAMES = 2        # minimum consecutive closed frames to count as a blink


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
    """Stateful blink counter fed one EAR value per frame."""

    def __init__(self, threshold=EAR_BLINK_THRESHOLD, consec_frames=EAR_CONSEC_FRAMES):
        self.threshold = threshold
        self.consec_frames = consec_frames
        self._closed_run = 0
        self.blink_count = 0
        self.closed_frame_count = 0
        self.total_frames = 0
        self._blink_durations = []  # in frames

    def update(self, ear_value):
        self.total_frames += 1
        if ear_value < self.threshold:
            self._closed_run += 1
            self.closed_frame_count += 1
        else:
            if self._closed_run >= self.consec_frames:
                self.blink_count += 1
                self._blink_durations.append(self._closed_run)
            self._closed_run = 0

    def finalize(self, fps):
        # flush a trailing blink if the video ends mid-blink
        if self._closed_run >= self.consec_frames:
            self.blink_count += 1
            self._blink_durations.append(self._closed_run)
            self._closed_run = 0

        duration_seconds = self.total_frames / fps if fps > 0 else 0
        blink_rate_per_min = (self.blink_count / duration_seconds * 60) if duration_seconds > 0 else 0
        avg_blink_duration_ms = (
            (sum(self._blink_durations) / len(self._blink_durations)) / fps * 1000
            if self._blink_durations and fps > 0 else 0
        )
        eye_closure_rate = (
            self.closed_frame_count / self.total_frames if self.total_frames > 0 else 0
        )
        return {
            "blinkCount": self.blink_count,
            "blinkRate": round(blink_rate_per_min, 2),
            "avgBlinkDurationMs": round(avg_blink_duration_ms, 2),
            "eyeClosureRate": round(eye_closure_rate, 4),
        }
