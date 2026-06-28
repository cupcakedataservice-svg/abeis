const mongoose = require("mongoose");

/**
 * featureVector holds the full behavioral feature set captured during a session.
 * It's deliberately a flexible Mixed object so we can capture "as many behavioral
 * features as possible" (per spec) without needing a schema migration for every
 * new metric we start tracking. Known/expected sub-shapes are documented below.
 *
 * featureVector shape (typical):
 * {
 *   mouse: { totalMovement, avgSpeed, maxSpeed, acceleration, clickFrequency,
 *            doubleClicks, rightClicks, dragEvents, scrollEvents, scrollDistance,
 *            cursorSmoothness },
 *   keyboard: { avgKeyPressDuration, avgInterKeyLatency, typingRhythmVariance,
 *               keyFrequency, errorRate, backspaceCount, deleteCount, shiftUsageCount,
 *               ctrlComboCount, copyAttempts, pasteAttempts },
 *   session: { idleTimeMs, idlePeriodsCount, focusChanges, tabSwitches,
 *              fullscreenExits, avgNetworkLatencyMs, browser, device,
 *              screenResolution, sessionDurationMs },
 *   camera: { cameraEnabled, lookingAwayCount, faceDetectionStatus },
 *   screen: { screenRecordingEnabled, recordingDurationMs },
 *   typing: { wpm, accuracy, errorCorrections }, // typing assessment only
 *   coding: { copyPasteAttempts, backspaces, corrections } // coding assessment only
 * }
 */
const behavioralFeatureSchema = new mongoose.Schema(
  {
    assessmentId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    assessmentType: {
      type: String,
      enum: ["mcq", "coding", "typing"],
      required: true,
      index: true,
    },
    featureVector: { type: mongoose.Schema.Types.Mixed, required: true },

    // Raw event log retained optionally for deep analysis / re-aggregation.
    // Can be large; consider TTL or archival to cold storage in production.
    rawEvents: {
      mouseEvents: { type: Array, default: undefined },
      keyboardEvents: { type: Array, default: undefined },
      sessionEvents: { type: Array, default: undefined },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BehavioralFeature", behavioralFeatureSchema);
