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

# """
# Extracts webcamFeatures from a face-recording video.

# v1 fields (unchanged): blinkRate, blinkCount, screenAttention, lookAwayCount,
# averagePitch, averageYaw, averageRoll, headMovementVariance,
# faceVisiblePercentage, eyeClosureRate

# v2 additions (this upgrade):
#   Face detection : averageFaceConfidence, continuousFaceLossCount, maximumFaceLossDuration
#   Blink behaviour: averageBlinkDuration, maximumBlinkDuration, blinkIntervalVariance
#   Eye gaze       : screenAttentionPercentage, averageLookAwayDuration, maximumLookAwayDuration
#   Head pose      : pitchStdDeviation, yawStdDeviation, rollStdDeviation,
#                     averageHeadSpeed, maximumHeadSpeed

# All v2 metrics are derived from data already being computed in the existing
# single MediaPipe Face Mesh pass, plus one additional lightweight MediaPipe
# Face Detection call per sampled frame (needed for a real confidence score —
# Face Mesh doesn't expose one). No second video pass, no non-MediaPipe model,
# per the "maintain approximately the same extraction time" requirement.

# Refinement made during this upgrade: v1 conflated "no face detected at all"
# with "face detected but looking away" into a single look-away counter. v2
# tracks these as two separate run-trackers (`face_loss_run` vs `away_run`),
# which is what makes `continuousFaceLossCount`/`maximumFaceLossDuration`
# (face absent) meaningfully distinct from `lookAwayCount` (face present,
# head turned) — noted here since it changes what lookAwayCount counts
# compared to the original v1 implementation.
# """

# import cv2
# import numpy as np
# import mediapipe as mp

# from utils.ear import frame_ear, BlinkTracker
# from utils.head_pose import estimate_head_pose

# mp_face_mesh = mp.solutions.face_mesh
# mp_face_detection = mp.solutions.face_detection

# # Yaw/pitch thresholds (degrees) beyond which we consider the participant
# # to be looking away from the screen rather than at it.
# YAW_AWAY_DEG = 25.0
# PITCH_AWAY_DEG = 20.0

# # Minimum consecutive frames before counting a new "event" (avoids counting
# # single-frame jitter as a look-away or face-loss event).
# AWAY_CONSEC_FRAMES = 5
# FACE_LOSS_CONSEC_FRAMES = 3

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

#     sample_indices_list = _sample_frame_indices(max(total_frames, 1), MAX_SAMPLED_FRAMES)
#     sample_indices = set(sample_indices_list)

#     # Effective real-world seconds represented by each *processed* frame,
#     # since sampling may skip raw frames on long videos. See ear.py's
#     # BlinkTracker docstring for why this replaces a naive 1/fps assumption.
#     seconds_per_sample = (total_frames / max(len(sample_indices_list), 1)) / fps if fps > 0 else 0

#     blink_tracker = BlinkTracker()
#     pitches, yaws, rolls = [], [], []
#     pose_history = []  # (processed_frame_position, pitch, yaw, roll) for frames with a valid pose
#     face_confidences = []

#     frames_with_face = 0
#     frames_sampled = 0
#     attentive_frames = 0

#     look_away_events = 0
#     away_run = 0
#     away_run_lengths = []

#     face_loss_events = 0
#     face_loss_run = 0
#     face_loss_run_lengths = []

#     with mp_face_mesh.FaceMesh(
#         static_image_mode=False,
#         max_num_faces=1,
#         refine_landmarks=True,
#         min_detection_confidence=0.5,
#         min_tracking_confidence=0.5,
#     ) as face_mesh, mp_face_detection.FaceDetection(
#         model_selection=0, min_detection_confidence=0.5
#     ) as face_detector:

#         idx = -1
#         processed_position = 0
#         while True:
#             ret, frame = cap.read()
#             if not ret:
#                 break
#             idx += 1
#             if idx not in sample_indices:
#                 continue
#             frames_sampled += 1
#             processed_position += 1

#             rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#             results = face_mesh.process(rgb)

#             if not results.multi_face_landmarks:
#                 # No face at all: counts toward face-loss only. Not toward
#                 # look-away, which requires an actual pose reading.
#                 face_loss_run += 1
#                 if face_loss_run == FACE_LOSS_CONSEC_FRAMES:
#                     face_loss_events += 1
#                 continue

#             if face_loss_run > 0:
#                 face_loss_run_lengths.append(face_loss_run)
#             face_loss_run = 0

#             frames_with_face += 1
#             landmarks_norm = results.multi_face_landmarks[0].landmark
#             landmarks_px = [(lm.x * frame_w, lm.y * frame_h) for lm in landmarks_norm]

#             # Face confidence (Face Mesh has no confidence score of its own —
#             # this is the one extra lightweight MediaPipe call per frame).
#             detection_result = face_detector.process(rgb)
#             if detection_result.detections:
#                 face_confidences.append(max(d.score[0] for d in detection_result.detections))
#             else:
#                 face_confidences.append(0.0)

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
#                 pose_history.append((processed_position, pitch, yaw, roll))
#                 is_away = abs(yaw) > YAW_AWAY_DEG or abs(pitch) > PITCH_AWAY_DEG

#             if is_away:
#                 away_run += 1
#                 if away_run == AWAY_CONSEC_FRAMES:
#                     look_away_events += 1
#             else:
#                 if away_run > 0:
#                     away_run_lengths.append(away_run)
#                 away_run = 0
#                 attentive_frames += 1

#     # flush trailing runs
#     if away_run > 0:
#         away_run_lengths.append(away_run)
#     if face_loss_run > 0:
#         face_loss_run_lengths.append(face_loss_run)

#     cap.release()

#     blink_stats = blink_tracker.finalize(seconds_per_sample=seconds_per_sample)

#     face_visible_pct = (frames_with_face / frames_sampled * 100) if frames_sampled else 0.0
#     screen_attention_pct = (attentive_frames / frames_sampled * 100) if frames_sampled else 0.0

#     def _var(vals):
#         return float(np.var(vals)) if len(vals) > 1 else 0.0

#     def _std(vals):
#         return float(np.std(vals)) if len(vals) > 1 else 0.0

#     head_movement_variance = round(_var(pitches) + _var(yaws) + _var(rolls), 3)

#     # --- v2: look-away duration stats (frames -> seconds) ---
#     away_durations_s = [n * seconds_per_sample for n in away_run_lengths]
#     average_look_away_duration = float(np.mean(away_durations_s)) if away_durations_s else 0.0
#     maximum_look_away_duration = float(np.max(away_durations_s)) if away_durations_s else 0.0

#     # --- v2: face-loss duration stats ---
#     face_loss_durations_s = [n * seconds_per_sample for n in face_loss_run_lengths]
#     maximum_face_loss_duration = float(np.max(face_loss_durations_s)) if face_loss_durations_s else 0.0

#     # --- v2: head speed (deg/sec) between consecutive frames that both had a valid pose ---
#     head_speeds = []
#     for (pos_a, pa, ya, ra), (pos_b, pb, yb, rb) in zip(pose_history, pose_history[1:]):
#         dt = (pos_b - pos_a) * seconds_per_sample
#         if dt <= 0:
#             continue
#         angular_delta = float(np.sqrt((pb - pa) ** 2 + (yb - ya) ** 2 + (rb - ra) ** 2))
#         head_speeds.append(angular_delta / dt)
#     average_head_speed = float(np.mean(head_speeds)) if head_speeds else 0.0
#     maximum_head_speed = float(np.max(head_speeds)) if head_speeds else 0.0

#     average_face_confidence = float(np.mean(face_confidences)) if face_confidences else 0.0

#     return {
#         # --- v1 ---
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

#         # --- v2: face detection ---
#         "averageFaceConfidence": round(average_face_confidence, 4),
#         "continuousFaceLossCount": face_loss_events,
#         "maximumFaceLossDuration": round(maximum_face_loss_duration, 2),

#         # --- v2: blink behaviour ---
#         "averageBlinkDuration": blink_stats["avgBlinkDurationMs"],
#         "maximumBlinkDuration": blink_stats["maxBlinkDurationMs"],
#         "blinkIntervalVariance": blink_stats["blinkIntervalVariance"],

#         # --- v2: eye gaze ---
#         # Intentional duplicate of `screenAttention` under the more
#         # ML-conventional name requested for the v2 schema; both are kept
#         # since the spec listed `screenAttention` as a v1 field to retain
#         # and `screenAttentionPercentage` as a new v2 field to add.
#         "screenAttentionPercentage": round(screen_attention_pct, 2),
#         "averageLookAwayDuration": round(average_look_away_duration, 2),
#         "maximumLookAwayDuration": round(maximum_look_away_duration, 2),

#         # --- v2: head pose ---
#         "pitchStdDeviation": round(_std(pitches), 2),
#         "yawStdDeviation": round(_std(yaws), 2),
#         "rollStdDeviation": round(_std(rolls), 2),
#         "averageHeadSpeed": round(average_head_speed, 2),
#         "maximumHeadSpeed": round(maximum_head_speed, 2),

#         "_diagnostics": {
#             "framesSampled": frames_sampled,
#             "totalFrames": total_frames,
#             "fps": fps,
#             "secondsPerSample": seconds_per_sample,
#         },
#     }

"""
Extracts webcamFeatures from a face-recording video.

v1 fields (unchanged): blinkRate, blinkCount, screenAttention, lookAwayCount,
averagePitch, averageYaw, averageRoll, headMovementVariance,
faceVisiblePercentage, eyeClosureRate

v2 additions: averageFaceConfidence, continuousFaceLossCount,
maximumFaceLossDuration, averageBlinkDuration, maximumBlinkDuration,
blinkIntervalVariance, screenAttentionPercentage, averageLookAwayDuration,
maximumLookAwayDuration, pitchStdDeviation, yawStdDeviation,
rollStdDeviation, averageHeadSpeed, maximumHeadSpeed

v3 additions (this upgrade):
  Multi-face detection : numberOfFaces
  Face framing          : faceBoundingBox, averageFaceSize, averageFacePosition
  Face absence (total)  : faceDisappearanceDuration
  Gaze direction        : lookingLeftDuration, lookingRightDuration,
                          lookingUpDuration, lookingDownDuration,
                          lookingLeftPercentage, lookingRightPercentage,
                          lookingUpPercentage, lookingDownPercentage

All v3 metrics are derived from data already being computed in the existing
single MediaPipe pass — the per-frame Face Detection call (already run for
`averageFaceConfidence` in v2) and the per-frame head-pose estimate (already
run for `averagePitch`/`averageYaw`/`averageRoll`). No second video pass, no
additional model family. The one structural change is that Face Detection
now runs on EVERY sampled frame rather than only frames where Face Mesh
found the primary face — needed so `numberOfFaces` can report a second
person even in a frame where Face Mesh's single tracked face is briefly
lost — but this is still one call per already-processed frame, not an
additional pass over the video.

Gaze-direction bucketing reuses the same yaw/pitch pose estimate already
computed for head-pose metrics; it has NOT yet been validated against
labeled real-footage ground truth (see README "Known Limitations" — treat
as directional signal, not a precisely calibrated instrument, until a
validation pass is done against real recordings).
"""

import cv2
import numpy as np
import mediapipe as mp

from utils.ear import frame_ear, BlinkTracker
from utils.head_pose import estimate_head_pose

mp_face_mesh = mp.solutions.face_mesh
mp_face_detection = mp.solutions.face_detection

# Yaw/pitch thresholds (degrees) beyond which we consider the participant
# to be looking away from the screen rather than at it (binary attentive/
# away signal — unrelated to the four-directional gaze buckets below).
YAW_AWAY_DEG = 25.0
PITCH_AWAY_DEG = 20.0

# v3: separate, smaller thresholds used only for classifying WHICH of the
# four directions a frame's gaze falls into. Deliberately distinct from
# YAW_AWAY_DEG/PITCH_AWAY_DEG above: "looking away" is a coarse attention
# flag, while these four buckets are meant to catch a milder, more typical
# glance in a given direction. A frame can therefore be "looking right"
# without yet being flagged "away" for attention purposes.
GAZE_YAW_RIGHT_DEG = 12.0
GAZE_YAW_LEFT_DEG = -12.0
GAZE_PITCH_DOWN_DEG = 10.0
GAZE_PITCH_UP_DEG = -10.0

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
    face_loss_total_frames = 0  # v3: cumulative count, independent of run length

    # v3: face framing accumulators (only over frames with a detected face)
    bbox_xs, bbox_ys, bbox_ws, bbox_hs = [], [], [], []
    max_faces_seen = 0

    # v3: gaze-direction frame counts (subset of frames with a valid pose)
    looking_left_frames = 0
    looking_right_frames = 0
    looking_up_frames = 0
    looking_down_frames = 0

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

            # v3: Face Detection now runs on EVERY sampled frame (previously
            # only inside the "Face Mesh found a face" branch), so
            # `numberOfFaces` reflects the true simultaneous face count —
            # including a possible second person — even in a frame where
            # Face Mesh's single tracked face is momentarily lost. Still one
            # call per already-processed frame, not a second video pass.
            detection_result = face_detector.process(rgb)
            num_faces_this_frame = len(detection_result.detections) if detection_result.detections else 0
            max_faces_seen = max(max_faces_seen, num_faces_this_frame)

            results = face_mesh.process(rgb)

            if not results.multi_face_landmarks:
                # No (primary) face at all: counts toward face-loss only.
                face_loss_run += 1
                face_loss_total_frames += 1  # v3: cumulative, unlike the run-based counter below
                if face_loss_run == FACE_LOSS_CONSEC_FRAMES:
                    face_loss_events += 1
                continue

            if face_loss_run > 0:
                face_loss_run_lengths.append(face_loss_run)
            face_loss_run = 0

            frames_with_face += 1
            landmarks_norm = results.multi_face_landmarks[0].landmark
            landmarks_px = [(lm.x * frame_w, lm.y * frame_h) for lm in landmarks_norm]

            # Face confidence + v3 bounding box: reuse the detection_result
            # already computed above for this frame (no second detector call).
            if detection_result.detections:
                best = max(detection_result.detections, key=lambda d: d.score[0])
                face_confidences.append(best.score[0])

                bbox = best.location_data.relative_bounding_box
                bbox_xs.append(bbox.xmin)
                bbox_ys.append(bbox.ymin)
                bbox_ws.append(bbox.width)
                bbox_hs.append(bbox.height)
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

                # v3: four-directional gaze bucketing, reusing this same
                # pose estimate (no additional model or landmark pass).
                # Each axis is classified independently; a frame can (in
                # principle) count toward both a horizontal and a vertical
                # bucket, e.g. looking down-and-right.
                if yaw > GAZE_YAW_RIGHT_DEG:
                    looking_right_frames += 1
                elif yaw < GAZE_YAW_LEFT_DEG:
                    looking_left_frames += 1
                if pitch > GAZE_PITCH_DOWN_DEG:
                    looking_down_frames += 1
                elif pitch < GAZE_PITCH_UP_DEG:
                    looking_up_frames += 1

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

    # --- v2: face-loss duration stats (longest single run) ---
    face_loss_durations_s = [n * seconds_per_sample for n in face_loss_run_lengths]
    maximum_face_loss_duration = float(np.max(face_loss_durations_s)) if face_loss_durations_s else 0.0

    # --- v3: face-loss duration, CUMULATIVE total across the whole
    # recording (distinct from the "longest single run" figure above) ---
    face_disappearance_duration = round(face_loss_total_frames * seconds_per_sample, 2)

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

    # --- v3: face framing (average bounding box / size / position) ---
    face_bounding_box = None
    average_face_size = 0.0
    average_face_position = None
    if bbox_xs:
        mean_x = float(np.mean(bbox_xs))
        mean_y = float(np.mean(bbox_ys))
        mean_w = float(np.mean(bbox_ws))
        mean_h = float(np.mean(bbox_hs))
        face_bounding_box = {
            "x": round(mean_x, 4),
            "y": round(mean_y, 4),
            "width": round(mean_w, 4),
            "height": round(mean_h, 4),
        }
        # width x height per-frame, then averaged (not mean_w * mean_h),
        # so this reflects the true average area rather than the area of
        # the average box.
        per_frame_area = np.array(bbox_ws) * np.array(bbox_hs)
        average_face_size = round(float(np.mean(per_frame_area)), 4)
        average_face_position = {
            "x": round(mean_x + mean_w / 2, 4),
            "y": round(mean_y + mean_h / 2, 4),
        }

    # --- v3: gaze-direction durations + percentages ---
    looking_left_duration = round(looking_left_frames * seconds_per_sample, 2)
    looking_right_duration = round(looking_right_frames * seconds_per_sample, 2)
    looking_up_duration = round(looking_up_frames * seconds_per_sample, 2)
    looking_down_duration = round(looking_down_frames * seconds_per_sample, 2)

    looking_left_pct = round((looking_left_frames / frames_sampled * 100) if frames_sampled else 0.0, 2)
    looking_right_pct = round((looking_right_frames / frames_sampled * 100) if frames_sampled else 0.0, 2)
    looking_up_pct = round((looking_up_frames / frames_sampled * 100) if frames_sampled else 0.0, 2)
    looking_down_pct = round((looking_down_frames / frames_sampled * 100) if frames_sampled else 0.0, 2)

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
        # ML-conventional name kept for the v2 schema; both are populated.
        "screenAttentionPercentage": round(screen_attention_pct, 2),
        "averageLookAwayDuration": round(average_look_away_duration, 2),
        "maximumLookAwayDuration": round(maximum_look_away_duration, 2),

        # --- v2: head pose ---
        "pitchStdDeviation": round(_std(pitches), 2),
        "yawStdDeviation": round(_std(yaws), 2),
        "rollStdDeviation": round(_std(rolls), 2),
        "averageHeadSpeed": round(average_head_speed, 2),
        "maximumHeadSpeed": round(maximum_head_speed, 2),

        # --- v3: multi-face detection ---
        "numberOfFaces": max_faces_seen if frames_sampled else None,

        # --- v3: face framing ---
        "faceBoundingBox": face_bounding_box,
        "averageFaceSize": average_face_size,
        "averageFacePosition": average_face_position,

        # --- v3: face absence (cumulative) ---
        "faceDisappearanceDuration": face_disappearance_duration,

        # --- v3: gaze direction ---
        "lookingLeftDuration": looking_left_duration,
        "lookingRightDuration": looking_right_duration,
        "lookingUpDuration": looking_up_duration,
        "lookingDownDuration": looking_down_duration,
        "lookingLeftPercentage": looking_left_pct,
        "lookingRightPercentage": looking_right_pct,
        "lookingUpPercentage": looking_up_pct,
        "lookingDownPercentage": looking_down_pct,

        "_diagnostics": {
            "framesSampled": frames_sampled,
            "totalFrames": total_frames,
            "fps": fps,
            "secondsPerSample": seconds_per_sample,
        },
    }
