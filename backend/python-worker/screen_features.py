# """
# Extracts screenFeatures from a screen recording:
#   cursorSpeed, cursorAcceleration, cursorSmoothness,
#   scrollFrequency, scrollSpeed, idleDuration, focusChanges

# IMPORTANT LIMITATION: a screen recording contains no ground-truth cursor
# coordinates or scroll deltas — those already exist precisely from the
# browser's mouse/scroll event listeners (see useMouseTracking.js in the
# existing frontend), which should remain the primary source for those
# metrics. What CAN be reliably derived from raw video is *motion*:

#   - Dense optical flow magnitude is used as a proxy for on-screen movement
#     (cursor + scrolling content combined). It correlates with cursor speed
#     but is not a pixel-accurate reconstruction of it.
#   - Vertical-dominant flow bursts are used as a scroll-event proxy.
#   - Long stretches of near-zero motion are counted as idle time.
#   - Large, sudden full-frame histogram changes (tab/window switches,
#     fullscreen exits) are counted as focus changes.

# Treat this module's output as a supplementary cross-check against the
# client-side telemetry, not a replacement for it.
# """

# import cv2
# import numpy as np

# MAX_SAMPLED_FRAMES = 900
# IDLE_MOTION_THRESHOLD = 0.15       # mean flow magnitude below this = idle frame
# IDLE_MIN_RUN_SECONDS = 2.0         # minimum idle run length to count
# SCROLL_VERTICAL_DOMINANCE = 1.6    # vertical flow must exceed horizontal by this ratio
# SCROLL_MIN_MAGNITUDE = 0.8
# FOCUS_CHANGE_HIST_DIFF = 0.5       # correlation drop threshold (1 = identical, 0 = unrelated)


# def _sample_frame_indices(total_frames, max_frames):
#     if total_frames <= max_frames:
#         return list(range(total_frames))
#     step = total_frames / max_frames
#     return [int(i * step) for i in range(max_frames)]


# def extract_screen_features(video_path):
#     cap = cv2.VideoCapture(video_path)
#     if not cap.isOpened():
#         raise RuntimeError(f"Could not open screen video: {video_path}")

#     fps = cap.get(cv2.CAP_PROP_FPS) or 15.0
#     total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
#     sample_indices = set(_sample_frame_indices(max(total_frames, 1), MAX_SAMPLED_FRAMES))

#     prev_gray = None
#     prev_speed = None
#     speeds = []
#     accelerations = []
#     scroll_events = 0
#     idle_seconds_total = 0.0
#     idle_run_frames = 0
#     focus_changes = 0

#     # effective seconds represented by each *sampled* frame (since we skip frames)
#     frame_step = max(total_frames / min(total_frames or 1, MAX_SAMPLED_FRAMES), 1)
#     seconds_per_sample = frame_step / fps if fps > 0 else 0

#     idx = -1
#     while True:
#         ret, frame = cap.read()
#         if not ret:
#             break
#         idx += 1
#         if idx not in sample_indices:
#             continue

#         small = cv2.resize(frame, (320, 180))
#         gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

#         if prev_gray is not None:
#             flow = cv2.calcOpticalFlowFarneback(
#                 prev_gray, gray, None, 0.5, 2, 15, 3, 5, 1.2, 0
#             )
#             fx, fy = flow[..., 0], flow[..., 1]
#             magnitude = np.sqrt(fx ** 2 + fy ** 2)
#             mean_mag = float(np.mean(magnitude))
#             speeds.append(mean_mag)

#             if prev_speed is not None and seconds_per_sample > 0:
#                 accelerations.append(abs(mean_mag - prev_speed) / seconds_per_sample)
#             prev_speed = mean_mag

#             # Idle detection
#             if mean_mag < IDLE_MOTION_THRESHOLD:
#                 idle_run_frames += 1
#             else:
#                 if idle_run_frames * seconds_per_sample >= IDLE_MIN_RUN_SECONDS:
#                     idle_seconds_total += idle_run_frames * seconds_per_sample
#                 idle_run_frames = 0

#             # Scroll proxy: strong, vertically-dominant, mostly-uniform flow
#             mean_fx, mean_fy = float(np.mean(np.abs(fx))), float(np.mean(np.abs(fy)))
#             if (mean_mag > SCROLL_MIN_MAGNITUDE and mean_fy > mean_fx * SCROLL_VERTICAL_DOMINANCE):
#                 scroll_events += 1

#             # Focus-change proxy: correlation between consecutive frame histograms
#             hist1 = cv2.calcHist([prev_gray], [0], None, [64], [0, 256])
#             hist2 = cv2.calcHist([gray], [0], None, [64], [0, 256])
#             cv2.normalize(hist1, hist1)
#             cv2.normalize(hist2, hist2)
#             correlation = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
#             if correlation < FOCUS_CHANGE_HIST_DIFF:
#                 focus_changes += 1

#         prev_gray = gray

#     # flush trailing idle run
#     if idle_run_frames * seconds_per_sample >= IDLE_MIN_RUN_SECONDS:
#         idle_seconds_total += idle_run_frames * seconds_per_sample

#     cap.release()

#     cursor_speed = round(float(np.mean(speeds)), 4) if speeds else 0.0
#     cursor_acceleration = round(float(np.mean(accelerations)), 4) if accelerations else 0.0
#     # smoothness: inverse of speed variability (0..1, higher = smoother/steadier motion)
#     cursor_smoothness = (
#         round(1.0 / (1.0 + float(np.std(speeds))), 4) if len(speeds) > 1 else 1.0
#     )
#     duration_seconds = (total_frames / fps) if fps > 0 else 0
#     scroll_frequency = round(scroll_events / (duration_seconds / 60), 2) if duration_seconds > 0 else 0.0
#     scroll_speed = round(float(np.mean([s for s in speeds if s > SCROLL_MIN_MAGNITUDE])), 4) \
#         if any(s > SCROLL_MIN_MAGNITUDE for s in speeds) else 0.0

#     return {
#         "cursorSpeed": cursor_speed,
#         "cursorAcceleration": cursor_acceleration,
#         "cursorSmoothness": cursor_smoothness,
#         "scrollFrequency": scroll_frequency,
#         "scrollSpeed": scroll_speed,
#         "idleDuration": round(idle_seconds_total, 2),
#         "focusChanges": focus_changes,
#         "_diagnostics": {
#             "framesSampled": len(speeds) + 1,
#             "totalFrames": total_frames,
#             "fps": fps,
#             "note": "Motion-derived proxy metrics; cross-check against client-side mouse/session telemetry.",
#         },
#     }

"""
Extracts screenFeatures from a screen recording.

v1 fields (unchanged): cursorSpeed, cursorAcceleration, cursorSmoothness,
scrollFrequency, scrollSpeed, idleDuration, focusChanges

v2 additions (this upgrade):
  Mouse behaviour : mouseStopCount, averageMouseStopDuration, mousePathCurvature, cursorJitter
  Scroll behaviour: scrollBurstCount, averageScrollBurstDuration
  Idle behaviour  : idleEventCount, maximumIdleDuration
  Activity density: mouseEventsPerSecond, scrollEventsPerSecond, activityDensity

IMPORTANT LIMITATION (unchanged from v1, worth repeating here): a screen
recording has no ground-truth cursor coordinates or discrete browser
mouse/scroll events in it — everything below is derived from optical-flow
motion in the video and is a PROXY, not a reconstruction of the precise
client-side telemetry already captured by useMouseTracking.js. Treat this
module's output as a cross-check, not the source of truth.

All v2 metrics are computed from the same single dense-optical-flow pass
already run for v1 — no second pass over the video, per the "maintain
approximately the same extraction time" requirement.
"""

import cv2
import numpy as np

MAX_SAMPLED_FRAMES = 900
IDLE_MOTION_THRESHOLD = 0.15       # mean flow magnitude below this = "low motion" frame
IDLE_MIN_RUN_SECONDS = 2.0         # a low-motion run this long or longer counts as "idle"
MOUSE_STOP_MIN_SECONDS = 0.3       # a low-motion run this long or longer counts as a brief "stop"
SCROLL_VERTICAL_DOMINANCE = 1.6    # vertical flow must exceed horizontal by this ratio
SCROLL_MIN_MAGNITUDE = 0.8
SCROLL_BURST_MIN_FRAMES = 2        # consecutive scroll-classified frames to count as one "burst"
FOCUS_CHANGE_HIST_DIFF = 0.5       # correlation drop threshold (1 = identical, 0 = unrelated)
DIRECTION_MIN_MAGNITUDE = 0.3      # ignore near-zero flow when computing path direction/curvature


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

    frame_step = max(total_frames / min(total_frames or 1, MAX_SAMPLED_FRAMES), 1)
    seconds_per_sample = frame_step / fps if fps > 0 else 0

    prev_gray = None
    prev_speed = None
    speeds = []
    accelerations = []
    scroll_events = 0
    focus_changes = 0

    # v1 idle tracking retained; v2 additionally keeps every completed
    # low-motion run length so both "brief stop" and "idle" stats (two
    # different thresholds over the same underlying runs) can be derived
    # from one pass instead of tracking them separately.
    low_motion_run_frames = 0
    low_motion_run_lengths = []  # completed run lengths, in frames

    scroll_run_frames = 0
    scroll_run_lengths = []

    direction_angles = []  # radians, one per frame with meaningful motion

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

            # --- low-motion run tracking (feeds both idle AND mouse-stop stats) ---
            if mean_mag < IDLE_MOTION_THRESHOLD:
                low_motion_run_frames += 1
            else:
                if low_motion_run_frames > 0:
                    low_motion_run_lengths.append(low_motion_run_frames)
                low_motion_run_frames = 0

            # Scroll proxy: strong, vertically-dominant, mostly-uniform flow
            mean_fx, mean_fy = float(np.mean(np.abs(fx))), float(np.mean(np.abs(fy)))
            is_scroll_frame = mean_mag > SCROLL_MIN_MAGNITUDE and mean_fy > mean_fx * SCROLL_VERTICAL_DOMINANCE
            if is_scroll_frame:
                scroll_events += 1
                scroll_run_frames += 1
            else:
                if scroll_run_frames > 0:
                    scroll_run_lengths.append(scroll_run_frames)
                scroll_run_frames = 0

            # v2: path direction, for curvature — signed mean flow direction
            if mean_mag > DIRECTION_MIN_MAGNITUDE:
                mean_dx, mean_dy = float(np.mean(fx)), float(np.mean(fy))
                direction_angles.append(np.arctan2(mean_dy, mean_dx))

            # Focus-change proxy: correlation between consecutive frame histograms
            hist1 = cv2.calcHist([prev_gray], [0], None, [64], [0, 256])
            hist2 = cv2.calcHist([gray], [0], None, [64], [0, 256])
            cv2.normalize(hist1, hist1)
            cv2.normalize(hist2, hist2)
            correlation = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
            if correlation < FOCUS_CHANGE_HIST_DIFF:
                focus_changes += 1

        prev_gray = gray

    # flush trailing runs
    if low_motion_run_frames > 0:
        low_motion_run_lengths.append(low_motion_run_frames)
    if scroll_run_frames > 0:
        scroll_run_lengths.append(scroll_run_frames)

    cap.release()

    # --- v1 metrics ---
    cursor_speed = round(float(np.mean(speeds)), 4) if speeds else 0.0
    cursor_acceleration = round(float(np.mean(accelerations)), 4) if accelerations else 0.0
    cursor_smoothness = (
        round(1.0 / (1.0 + float(np.std(speeds))), 4) if len(speeds) > 1 else 1.0
    )
    duration_seconds = (total_frames / fps) if fps > 0 else 0
    scroll_frequency = round(scroll_events / (duration_seconds / 60), 2) if duration_seconds > 0 else 0.0
    scroll_speed = round(float(np.mean([s for s in speeds if s > SCROLL_MIN_MAGNITUDE])), 4) \
        if any(s > SCROLL_MIN_MAGNITUDE for s in speeds) else 0.0

    idle_run_durations_s = [n * seconds_per_sample for n in low_motion_run_lengths if n * seconds_per_sample >= IDLE_MIN_RUN_SECONDS]
    idle_duration_total = round(sum(idle_run_durations_s), 2)

    # --- v2: idle behaviour (event count + max, on top of v1's total duration) ---
    idle_event_count = len(idle_run_durations_s)
    maximum_idle_duration = round(max(idle_run_durations_s), 2) if idle_run_durations_s else 0.0

    # --- v2: mouse-stop behaviour (shorter threshold over the same runs) ---
    stop_run_durations_s = [n * seconds_per_sample for n in low_motion_run_lengths if n * seconds_per_sample >= MOUSE_STOP_MIN_SECONDS]
    mouse_stop_count = len(stop_run_durations_s)
    average_mouse_stop_duration = round(float(np.mean(stop_run_durations_s)), 3) if stop_run_durations_s else 0.0

    # --- v2: path curvature (mean absolute turning angle between consecutive motion frames, degrees) ---
    if len(direction_angles) > 1:
        diffs = np.diff(direction_angles)
        # wrap to [-pi, pi] so e.g. a jump from +179° to -179° reads as a 2° turn, not 358°
        wrapped = (diffs + np.pi) % (2 * np.pi) - np.pi
        mouse_path_curvature = round(float(np.mean(np.abs(np.degrees(wrapped)))), 2)
    else:
        mouse_path_curvature = 0.0

    # --- v2: cursor jitter (variability of frame-to-frame acceleration — high-frequency back-and-forth motion) ---
    cursor_jitter = round(float(np.std(accelerations)), 4) if len(accelerations) > 1 else 0.0

    # --- v2: scroll bursts (consecutive scroll-classified-frame runs) ---
    burst_lengths = [n for n in scroll_run_lengths if n >= SCROLL_BURST_MIN_FRAMES]
    scroll_burst_count = len(burst_lengths)
    average_scroll_burst_duration = (
        round(float(np.mean(burst_lengths)) * seconds_per_sample, 3) if burst_lengths else 0.0
    )

    # --- v2: activity density ---
    frames_with_flow = len(speeds)
    moving_frames = sum(1 for s in speeds if s >= IDLE_MOTION_THRESHOLD)
    mouse_events_per_second = round(moving_frames / duration_seconds, 4) if duration_seconds > 0 else 0.0
    scroll_events_per_second = round(scroll_events / duration_seconds, 4) if duration_seconds > 0 else 0.0
    activity_density = round(moving_frames / frames_with_flow, 4) if frames_with_flow > 0 else 0.0

    return {
        # --- v1 ---
        "cursorSpeed": cursor_speed,
        "cursorAcceleration": cursor_acceleration,
        "cursorSmoothness": cursor_smoothness,
        "scrollFrequency": scroll_frequency,
        "scrollSpeed": scroll_speed,
        "idleDuration": idle_duration_total,
        "focusChanges": focus_changes,

        # --- v2: mouse behaviour ---
        "mouseStopCount": mouse_stop_count,
        "averageMouseStopDuration": average_mouse_stop_duration,
        "mousePathCurvature": mouse_path_curvature,
        "cursorJitter": cursor_jitter,

        # --- v2: scroll behaviour ---
        "scrollBurstCount": scroll_burst_count,
        "averageScrollBurstDuration": average_scroll_burst_duration,

        # --- v2: idle behaviour ---
        "idleEventCount": idle_event_count,
        "maximumIdleDuration": maximum_idle_duration,

        # --- v2: activity density ---
        "mouseEventsPerSecond": mouse_events_per_second,
        "scrollEventsPerSecond": scroll_events_per_second,
        "activityDensity": activity_density,

        "_diagnostics": {
            "framesSampled": len(speeds) + 1,
            "totalFrames": total_frames,
            "fps": fps,
            "note": "Motion-derived proxy metrics; cross-check against client-side mouse/session telemetry.",
        },
    }
