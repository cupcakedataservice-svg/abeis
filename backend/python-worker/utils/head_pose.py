"""
Head pose (pitch / yaw / roll) estimation from MediaPipe Face Mesh landmarks
using OpenCV's solvePnP against a generic 3D face model. This avoids needing
a dedicated head-pose model — six well-known landmarks are enough.
"""

import numpy as np
import cv2

# Generic 3D model points (arbitrary units, roughly millimeters), in the
# same order as the 2D landmark indices below.
MODEL_POINTS_3D = np.array([
    (0.0, 0.0, 0.0),          # Nose tip
    (0.0, -63.6, -12.5),      # Chin
    (-43.3, 32.7, -26.0),     # Left eye left corner
    (43.3, 32.7, -26.0),      # Right eye right corner
    (-28.9, -28.9, -24.1),    # Left mouth corner
    (28.9, -28.9, -24.1),     # Right mouth corner
], dtype=np.float64)

# Corresponding MediaPipe Face Mesh landmark indices
LANDMARK_IDX = {
    "nose_tip": 1,
    "chin": 152,
    "left_eye_left_corner": 33,
    "right_eye_right_corner": 263,
    "left_mouth_corner": 61,
    "right_mouth_corner": 291,
}


def estimate_head_pose(landmarks_px, frame_w, frame_h):
    """
    landmarks_px: dict-like/list of (x_px, y_px) MediaPipe landmarks for one frame.
    Returns (pitch, yaw, roll) in degrees, or None if estimation fails.
    """
    try:
        image_points = np.array([
            landmarks_px[LANDMARK_IDX["nose_tip"]],
            landmarks_px[LANDMARK_IDX["chin"]],
            landmarks_px[LANDMARK_IDX["left_eye_left_corner"]],
            landmarks_px[LANDMARK_IDX["right_eye_right_corner"]],
            landmarks_px[LANDMARK_IDX["left_mouth_corner"]],
            landmarks_px[LANDMARK_IDX["right_mouth_corner"]],
        ], dtype=np.float64)
    except (IndexError, KeyError):
        return None

    focal_length = frame_w
    center = (frame_w / 2, frame_h / 2)
    camera_matrix = np.array([
        [focal_length, 0, center[0]],
        [0, focal_length, center[1]],
        [0, 0, 1],
    ], dtype=np.float64)
    dist_coeffs = np.zeros((4, 1))

    success, rotation_vec, _ = cv2.solvePnP(
        MODEL_POINTS_3D, image_points, camera_matrix, dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if not success:
        return None

    rotation_mat, _ = cv2.Rodrigues(rotation_vec)
    proj_matrix = np.hstack((rotation_mat, np.zeros((3, 1))))
    euler_angles = cv2.decomposeProjectionMatrix(proj_matrix)[6]
    pitch, yaw, roll = [float(a[0]) for a in euler_angles]
    return pitch, yaw, roll
