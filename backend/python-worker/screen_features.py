"""
Extracts screenFeatures from a screen recording:
  cursorSpeed, cursorAcceleration, cursorSmoothness,
  scrollFrequency, scrollSpeed, idleDuration, focusChanges

IMPORTANT LIMITATION: a screen recording contains no ground-truth cursor
coordinates or scroll deltas — those already exist precisely from the
browser's mouse/scroll event listeners (see useMouseTracking.js in the
existing frontend), which should remain the primary source for those
metrics. What CAN be reliably derived from raw video is *motion*:

  - Dense optical flow magnitude is used as a proxy for on-screen movement
    (cursor + scrolling content combined). It correlates with cursor speed
    but is not a pixel-accurate reconstruction of it.
  - Vertical-dominant flow bursts are used as a scroll-event proxy.
  - Long stretches of near-zero motion are counted as idle time.
  - Large, sudden full-frame histogram changes (tab/window switches,
    fullscreen exits) are counted as focus changes.

Treat this module's output as a supplementary cross-check against the
client-side telemetry, not a replacement for it.
"""

import cv2
import numpy as np

MAX_SAMPLED_FRAMES = 900
IDLE_MOTION_THRESHOLD = 0.15       # mean flow magnitude below this = idle frame
IDLE_MIN_RUN_SECONDS = 2.0         # minimum idle run length to count
SCROLL_VERTICAL_DOMINANCE = 1.6    # vertical flow must exceed horizontal by this ratio
SCROLL_MIN_MAGNITUDE = 0.8
FOCUS_CHANGE_HIST_DIFF = 0.5       # correlation drop threshold (1 = identical, 0 = unrelated)


def _sample_frame_indices(total_frames, max_frames):
    if total_frames <= max_frames:
        return list(range(total_frames))
    step = total_frames / max_frames
    return [int(i * step) for i in range(max_frames)]


def extract_screen_features(video_path):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open screen video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 15.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    sample_indices = set(_sample_frame_indices(max(total_frames, 1), MAX_SAMPLED_FRAMES))

    prev_gray = None
    prev_speed = None
    speeds = []
    accelerations = []
    scroll_events = 0
    idle_seconds_total = 0.0
    idle_run_frames = 0
    focus_changes = 0

    # effective seconds represented by each *sampled* frame (since we skip frames)
    frame_step = max(total_frames / min(total_frames or 1, MAX_SAMPLED_FRAMES), 1)
    seconds_per_sample = frame_step / fps if fps > 0 else 0

    idx = -1
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        idx += 1
        if idx not in sample_indices:
            continue

        small = cv2.resize(frame, (320, 180))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

        if prev_gray is not None:
            flow = cv2.calcOpticalFlowFarneback(
                prev_gray, gray, None, 0.5, 2, 15, 3, 5, 1.2, 0
            )
            fx, fy = flow[..., 0], flow[..., 1]
            magnitude = np.sqrt(fx ** 2 + fy ** 2)
            mean_mag = float(np.mean(magnitude))
            speeds.append(mean_mag)

            if prev_speed is not None and seconds_per_sample > 0:
                accelerations.append(abs(mean_mag - prev_speed) / seconds_per_sample)
            prev_speed = mean_mag

            # Idle detection
            if mean_mag < IDLE_MOTION_THRESHOLD:
                idle_run_frames += 1
            else:
                if idle_run_frames * seconds_per_sample >= IDLE_MIN_RUN_SECONDS:
                    idle_seconds_total += idle_run_frames * seconds_per_sample
                idle_run_frames = 0

            # Scroll proxy: strong, vertically-dominant, mostly-uniform flow
            mean_fx, mean_fy = float(np.mean(np.abs(fx))), float(np.mean(np.abs(fy)))
            if (mean_mag > SCROLL_MIN_MAGNITUDE and mean_fy > mean_fx * SCROLL_VERTICAL_DOMINANCE):
                scroll_events += 1

            # Focus-change proxy: correlation between consecutive frame histograms
            hist1 = cv2.calcHist([prev_gray], [0], None, [64], [0, 256])
            hist2 = cv2.calcHist([gray], [0], None, [64], [0, 256])
            cv2.normalize(hist1, hist1)
            cv2.normalize(hist2, hist2)
            correlation = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
            if correlation < FOCUS_CHANGE_HIST_DIFF:
                focus_changes += 1

        prev_gray = gray

    # flush trailing idle run
    if idle_run_frames * seconds_per_sample >= IDLE_MIN_RUN_SECONDS:
        idle_seconds_total += idle_run_frames * seconds_per_sample

    cap.release()

    cursor_speed = round(float(np.mean(speeds)), 4) if speeds else 0.0
    cursor_acceleration = round(float(np.mean(accelerations)), 4) if accelerations else 0.0
    # smoothness: inverse of speed variability (0..1, higher = smoother/steadier motion)
    cursor_smoothness = (
        round(1.0 / (1.0 + float(np.std(speeds))), 4) if len(speeds) > 1 else 1.0
    )
    duration_seconds = (total_frames / fps) if fps > 0 else 0
    scroll_frequency = round(scroll_events / (duration_seconds / 60), 2) if duration_seconds > 0 else 0.0
    scroll_speed = round(float(np.mean([s for s in speeds if s > SCROLL_MIN_MAGNITUDE])), 4) \
        if any(s > SCROLL_MIN_MAGNITUDE for s in speeds) else 0.0

    return {
        "cursorSpeed": cursor_speed,
        "cursorAcceleration": cursor_acceleration,
        "cursorSmoothness": cursor_smoothness,
        "scrollFrequency": scroll_frequency,
        "scrollSpeed": scroll_speed,
        "idleDuration": round(idle_seconds_total, 2),
        "focusChanges": focus_changes,
        "_diagnostics": {
            "framesSampled": len(speeds) + 1,
            "totalFrames": total_frames,
            "fps": fps,
            "note": "Motion-derived proxy metrics; cross-check against client-side mouse/session telemetry.",
        },
    }
