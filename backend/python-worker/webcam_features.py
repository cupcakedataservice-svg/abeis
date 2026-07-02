"""
Extracts webcamFeatures from a face-recording video:
  blinkRate, blinkCount, screenAttention, lookAwayCount,
  averagePitch, averageYaw, averageRoll, headMovementVariance,
  faceVisiblePercentage, eyeClosureRate

Uses MediaPipe Face Mesh (refine_landmarks=True -> also gives iris landmarks,
so a single pass covers face mesh, iris tracking, and blink/EAR — no separate
"MediaPipe Iris" solution needed, since Face Mesh's refine mode supersedes it).
"""

import cv2
import numpy as np
import mediapipe as mp

from utils.ear import frame_ear, iris_center, LEFT_EYE, RIGHT_EYE, LEFT_IRIS, RIGHT_IRIS, BlinkTracker
from utils.head_pose import estimate_head_pose

mp_face_mesh = mp.solutions.face_mesh

# Yaw/pitch thresholds (degrees) beyond which we consider the participant
# to be looking away from the screen rather than at it.
YAW_AWAY_DEG = 25.0
PITCH_AWAY_DEG = 20.0

# Minimum consecutive "away" frames before counting a new look-away event,
# to avoid counting single-frame jitter as an event.
AWAY_CONSEC_FRAMES = 5

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

    sample_indices = set(_sample_frame_indices(max(total_frames, 1), MAX_SAMPLED_FRAMES))

    blink_tracker = BlinkTracker()
    pitches, yaws, rolls = [], [], []
    frames_with_face = 0
    frames_sampled = 0
    look_away_events = 0
    away_run = 0
    attentive_frames = 0

    with mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:

        idx = -1
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            idx += 1
            if idx not in sample_indices:
                continue
            frames_sampled += 1

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)

            if not results.multi_face_landmarks:
                # no face -> counts toward look-away/away run but not "in frame"
                away_run += 1
                if away_run == AWAY_CONSEC_FRAMES:
                    look_away_events += 1
                continue

            frames_with_face += 1
            landmarks_norm = results.multi_face_landmarks[0].landmark
            landmarks_px = [(lm.x * frame_w, lm.y * frame_h) for lm in landmarks_norm]

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
                is_away = abs(yaw) > YAW_AWAY_DEG or abs(pitch) > PITCH_AWAY_DEG

            if is_away:
                away_run += 1
                if away_run == AWAY_CONSEC_FRAMES:
                    look_away_events += 1
            else:
                away_run = 0
                attentive_frames += 1

    cap.release()

    blink_stats = blink_tracker.finalize(fps=fps if fps > 0 else len(sample_indices) / max(total_frames / fps, 1))

    face_visible_pct = (frames_with_face / frames_sampled * 100) if frames_sampled else 0.0
    screen_attention_pct = (attentive_frames / frames_sampled * 100) if frames_sampled else 0.0

    def _var(vals):
        return float(np.var(vals)) if len(vals) > 1 else 0.0

    head_movement_variance = round(_var(pitches) + _var(yaws) + _var(rolls), 3)

    return {
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
        "_diagnostics": {
            "framesSampled": frames_sampled,
            "totalFrames": total_frames,
            "fps": fps,
        },
    }
