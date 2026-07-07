# """
# Extracts webcamFeatures from a face-recording video:
#   blinkRate, blinkCount, screenAttention, lookAwayCount,
#   averagePitch, averageYaw, averageRoll, headMovementVariance,
#   faceVisiblePercentage, eyeClosureRate

# Uses MediaPipe Face Mesh (refine_landmarks=True -> also gives iris landmarks,
# so a single pass covers face mesh, iris tracking, and blink/EAR — no separate
# "MediaPipe Iris" solution needed, since Face Mesh's refine mode supersedes it).
# """

# import cv2
# import numpy as np
# import mediapipe as mp

# from utils.ear import frame_ear, iris_center, LEFT_EYE, RIGHT_EYE, LEFT_IRIS, RIGHT_IRIS, BlinkTracker
# from utils.head_pose import estimate_head_pose

# mp_face_mesh = mp.solutions.face_mesh

# # Yaw/pitch thresholds (degrees) beyond which we consider the participant
# # to be looking away from the screen rather than at it.
# YAW_AWAY_DEG = 25.0
# PITCH_AWAY_DEG = 20.0

# # Minimum consecutive "away" frames before counting a new look-away event,
# # to avoid counting single-frame jitter as an event.
# AWAY_CONSEC_FRAMES = 5

# # Sample at most this many frames per video to bound processing time on long
# # sessions; frames are taken evenly across the video rather than every frame.
# MAX_SAMPLED_FRAMES = 900  # e.g. ~5 min at 3fps sampling


# def _sample_frame_indices(total_frames, max_frames):
#     if total_frames <= max_frames:
#         return list(range(total_frames))
#     step = total_frames / max_frames
#     return [int(i * step) for i in range(max_frames)]


# def extract_webcam_features(video_path):
#     cap = cv2.VideoCapture(video_path)
#     if not cap.isOpened():
#         raise RuntimeError(f"Could not open webcam video: {video_path}")

#     fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
#     total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
#     frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1
#     frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1

#     sample_indices = set(_sample_frame_indices(max(total_frames, 1), MAX_SAMPLED_FRAMES))

#     blink_tracker = BlinkTracker()
#     pitches, yaws, rolls = [], [], []
#     frames_with_face = 0
#     frames_sampled = 0
#     look_away_events = 0
#     away_run = 0
#     attentive_frames = 0

#     with mp_face_mesh.FaceMesh(
#         static_image_mode=False,
#         max_num_faces=1,
#         refine_landmarks=True,
#         min_detection_confidence=0.5,
#         min_tracking_confidence=0.5,
#     ) as face_mesh:

#         idx = -1
#         while True:
#             ret, frame = cap.read()
#             if not ret:
#                 break
#             idx += 1
#             if idx not in sample_indices:
#                 continue
#             frames_sampled += 1

#             rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#             results = face_mesh.process(rgb)

#             if not results.multi_face_landmarks:
#                 # no face -> counts toward look-away/away run but not "in frame"
#                 away_run += 1
#                 if away_run == AWAY_CONSEC_FRAMES:
#                     look_away_events += 1
#                 continue

#             frames_with_face += 1
#             landmarks_norm = results.multi_face_landmarks[0].landmark
#             landmarks_px = [(lm.x * frame_w, lm.y * frame_h) for lm in landmarks_norm]

#             # Blink / EAR
#             ear = frame_ear(landmarks_px)
#             blink_tracker.update(ear)

#             # Head pose
#             pose = estimate_head_pose(landmarks_px, frame_w, frame_h)
#             is_away = False
#             if pose:
#                 pitch, yaw, roll = pose
#                 pitches.append(pitch)
#                 yaws.append(yaw)
#                 rolls.append(roll)
#                 is_away = abs(yaw) > YAW_AWAY_DEG or abs(pitch) > PITCH_AWAY_DEG

#             if is_away:
#                 away_run += 1
#                 if away_run == AWAY_CONSEC_FRAMES:
#                     look_away_events += 1
#             else:
#                 away_run = 0
#                 attentive_frames += 1

#     cap.release()

#     blink_stats = blink_tracker.finalize(fps=fps if fps > 0 else len(sample_indices) / max(total_frames / fps, 1))

#     face_visible_pct = (frames_with_face / frames_sampled * 100) if frames_sampled else 0.0
#     screen_attention_pct = (attentive_frames / frames_sampled * 100) if frames_sampled else 0.0

#     def _var(vals):
#         return float(np.var(vals)) if len(vals) > 1 else 0.0

#     head_movement_variance = round(_var(pitches) + _var(yaws) + _var(rolls), 3)

#     return {
#         "blinkRate": blink_stats["blinkRate"],
#         "blinkCount": blink_stats["blinkCount"],
#         "screenAttention": round(screen_attention_pct, 2),
#         "lookAwayCount": look_away_events,
#         "averagePitch": round(float(np.mean(pitches)), 2) if pitches else 0.0,
#         "averageYaw": round(float(np.mean(yaws)), 2) if yaws else 0.0,
#         "averageRoll": round(float(np.mean(rolls)), 2) if rolls else 0.0,
#         "headMovementVariance": head_movement_variance,
#         "faceVisiblePercentage": round(face_visible_pct, 2),
#         "eyeClosureRate": blink_stats["eyeClosureRate"],
#         "_diagnostics": {
#             "framesSampled": frames_sampled,
#             "totalFrames": total_frames,
#             "fps": fps,
#         },
#     }

"""
Extracts webcamFeatures from a face-recording video.

v1 fields (unchanged): blinkRate, blinkCount, screenAttention, lookAwayCount,
averagePitch, averageYaw, averageRoll, headMovementVariance,
faceVisiblePercentage, eyeClosureRate

v2 additions (this upgrade):
  Face detection : averageFaceConfidence, continuousFaceLossCount, maximumFaceLossDuration
  Blink behaviour: averageBlinkDuration, maximumBlinkDuration, blinkIntervalVariance
  Eye gaze       : screenAttentionPercentage, averageLookAwayDuration, maximumLookAwayDuration
  Head pose      : pitchStdDeviation, yawStdDeviation, rollStdDeviation,
                    averageHeadSpeed, maximumHeadSpeed

All v2 metrics are derived from data already being computed in the existing
single MediaPipe Face Mesh pass, plus one additional lightweight MediaPipe
Face Detection call per sampled frame (needed for a real confidence score —
Face Mesh doesn't expose one). No second video pass, no non-MediaPipe model,
per the "maintain approximately the same extraction time" requirement.

Refinement made during this upgrade: v1 conflated "no face detected at all"
with "face detected but looking away" into a single look-away counter. v2
tracks these as two separate run-trackers (`face_loss_run` vs `away_run`),
which is what makes `continuousFaceLossCount`/`maximumFaceLossDuration`
(face absent) meaningfully distinct from `lookAwayCount` (face present,
head turned) — noted here since it changes what lookAwayCount counts
compared to the original v1 implementation.
"""

import cv2
import numpy as np
import mediapipe as mp

from utils.ear import frame_ear, BlinkTracker
from utils.head_pose import estimate_head_pose

mp_face_mesh = mp.solutions.face_mesh
mp_face_detection = mp.solutions.face_detection

# Yaw/pitch thresholds (degrees) beyond which we consider the participant
# to be looking away from the screen rather than at it.
YAW_AWAY_DEG = 25.0
PITCH_AWAY_DEG = 20.0

# Minimum consecutive frames before counting a new "event" (avoids counting
# single-frame jitter as a look-away or face-loss event).
AWAY_CONSEC_FRAMES = 5
FACE_LOSS_CONSEC_FRAMES = 3

# Sample at most this many frames per video to bound processing time on long
# sessions; frames are taken evenly across the video rather than every frame.
MAX_SAMPLED_FRAMES = 900  # e.g. ~5 min at 3fps sampling


def _sample_frame_indices(total_frames, max_frames):
    if total_frames <= max_frames:
        return list(range(total_frames))
    step = total_frames / max_frames
    return [int(i * step) for i in range(max_frames)]


def extract_webcam_features(video_path):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open webcam video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1

    sample_indices_list = _sample_frame_indices(max(total_frames, 1), MAX_SAMPLED_FRAMES)
    sample_indices = set(sample_indices_list)

    # Effective real-world seconds represented by each *processed* frame,
    # since sampling may skip raw frames on long videos. See ear.py's
    # BlinkTracker docstring for why this replaces a naive 1/fps assumption.
    seconds_per_sample = (total_frames / max(len(sample_indices_list), 1)) / fps if fps > 0 else 0

    blink_tracker = BlinkTracker()
    pitches, yaws, rolls = [], [], []
    pose_history = []  # (processed_frame_position, pitch, yaw, roll) for frames with a valid pose
    face_confidences = []

    frames_with_face = 0
    frames_sampled = 0
    attentive_frames = 0

    look_away_events = 0
    away_run = 0
    away_run_lengths = []

    face_loss_events = 0
    face_loss_run = 0
    face_loss_run_lengths = []

    with mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh, mp_face_detection.FaceDetection(
        model_selection=0, min_detection_confidence=0.5
    ) as face_detector:

        idx = -1
        processed_position = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            idx += 1
            if idx not in sample_indices:
                continue
            frames_sampled += 1
            processed_position += 1

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)

            if not results.multi_face_landmarks:
                # No face at all: counts toward face-loss only. Not toward
                # look-away, which requires an actual pose reading.
                face_loss_run += 1
                if face_loss_run == FACE_LOSS_CONSEC_FRAMES:
                    face_loss_events += 1
                continue

            if face_loss_run > 0:
                face_loss_run_lengths.append(face_loss_run)
            face_loss_run = 0

            frames_with_face += 1
            landmarks_norm = results.multi_face_landmarks[0].landmark
            landmarks_px = [(lm.x * frame_w, lm.y * frame_h) for lm in landmarks_norm]

            # Face confidence (Face Mesh has no confidence score of its own —
            # this is the one extra lightweight MediaPipe call per frame).
            detection_result = face_detector.process(rgb)
            if detection_result.detections:
                face_confidences.append(max(d.score[0] for d in detection_result.detections))
            else:
                face_confidences.append(0.0)

            # Blink / EAR
            ear = frame_ear(landmarks_px)
            blink_tracker.update(ear)

            # Head pose
            pose = estimate_head_pose(landmarks_px, frame_w, frame_h)
            is_away = False
            if pose:
                pitch, yaw, roll = pose
                pitches.append(pitch)
                yaws.append(yaw)
                rolls.append(roll)
                pose_history.append((processed_position, pitch, yaw, roll))
                is_away = abs(yaw) > YAW_AWAY_DEG or abs(pitch) > PITCH_AWAY_DEG

            if is_away:
                away_run += 1
                if away_run == AWAY_CONSEC_FRAMES:
                    look_away_events += 1
            else:
                if away_run > 0:
                    away_run_lengths.append(away_run)
                away_run = 0
                attentive_frames += 1

    # flush trailing runs
    if away_run > 0:
        away_run_lengths.append(away_run)
    if face_loss_run > 0:
        face_loss_run_lengths.append(face_loss_run)

    cap.release()

    blink_stats = blink_tracker.finalize(seconds_per_sample=seconds_per_sample)

    face_visible_pct = (frames_with_face / frames_sampled * 100) if frames_sampled else 0.0
    screen_attention_pct = (attentive_frames / frames_sampled * 100) if frames_sampled else 0.0

    def _var(vals):
        return float(np.var(vals)) if len(vals) > 1 else 0.0

    def _std(vals):
        return float(np.std(vals)) if len(vals) > 1 else 0.0

    head_movement_variance = round(_var(pitches) + _var(yaws) + _var(rolls), 3)

    # --- v2: look-away duration stats (frames -> seconds) ---
    away_durations_s = [n * seconds_per_sample for n in away_run_lengths]
    average_look_away_duration = float(np.mean(away_durations_s)) if away_durations_s else 0.0
    maximum_look_away_duration = float(np.max(away_durations_s)) if away_durations_s else 0.0

    # --- v2: face-loss duration stats ---
    face_loss_durations_s = [n * seconds_per_sample for n in face_loss_run_lengths]
    maximum_face_loss_duration = float(np.max(face_loss_durations_s)) if face_loss_durations_s else 0.0

    # --- v2: head speed (deg/sec) between consecutive frames that both had a valid pose ---
    head_speeds = []
    for (pos_a, pa, ya, ra), (pos_b, pb, yb, rb) in zip(pose_history, pose_history[1:]):
        dt = (pos_b - pos_a) * seconds_per_sample
        if dt <= 0:
            continue
        angular_delta = float(np.sqrt((pb - pa) ** 2 + (yb - ya) ** 2 + (rb - ra) ** 2))
        head_speeds.append(angular_delta / dt)
    average_head_speed = float(np.mean(head_speeds)) if head_speeds else 0.0
    maximum_head_speed = float(np.max(head_speeds)) if head_speeds else 0.0

    average_face_confidence = float(np.mean(face_confidences)) if face_confidences else 0.0

    return {
        # --- v1 ---
        "blinkRate": blink_stats["blinkRate"],
        "blinkCount": blink_stats["blinkCount"],
        "screenAttention": round(screen_attention_pct, 2),
        "lookAwayCount": look_away_events,
        "averagePitch": round(float(np.mean(pitches)), 2) if pitches else 0.0,
        "averageYaw": round(float(np.mean(yaws)), 2) if yaws else 0.0,
        "averageRoll": round(float(np.mean(rolls)), 2) if rolls else 0.0,
        "headMovementVariance": head_movement_variance,
        "faceVisiblePercentage": round(face_visible_pct, 2),
        "eyeClosureRate": blink_stats["eyeClosureRate"],

        # --- v2: face detection ---
        "averageFaceConfidence": round(average_face_confidence, 4),
        "continuousFaceLossCount": face_loss_events,
        "maximumFaceLossDuration": round(maximum_face_loss_duration, 2),

        # --- v2: blink behaviour ---
        "averageBlinkDuration": blink_stats["avgBlinkDurationMs"],
        "maximumBlinkDuration": blink_stats["maxBlinkDurationMs"],
        "blinkIntervalVariance": blink_stats["blinkIntervalVariance"],

        # --- v2: eye gaze ---
        # Intentional duplicate of `screenAttention` under the more
        # ML-conventional name requested for the v2 schema; both are kept
        # since the spec listed `screenAttention` as a v1 field to retain
        # and `screenAttentionPercentage` as a new v2 field to add.
        "screenAttentionPercentage": round(screen_attention_pct, 2),
        "averageLookAwayDuration": round(average_look_away_duration, 2),
        "maximumLookAwayDuration": round(maximum_look_away_duration, 2),

        # --- v2: head pose ---
        "pitchStdDeviation": round(_std(pitches), 2),
        "yawStdDeviation": round(_std(yaws), 2),
        "rollStdDeviation": round(_std(rolls), 2),
        "averageHeadSpeed": round(average_head_speed, 2),
        "maximumHeadSpeed": round(maximum_head_speed, 2),

        "_diagnostics": {
            "framesSampled": frames_sampled,
            "totalFrames": total_frames,
            "fps": fps,
            "secondsPerSample": seconds_per_sample,
        },
    }
