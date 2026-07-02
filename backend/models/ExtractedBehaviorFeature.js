const mongoose = require("mongoose");

const webcamFeaturesSchema = new mongoose.Schema(
  {
    blinkRate: Number,
    blinkCount: Number,
    screenAttention: Number,
    lookAwayCount: Number,
    averagePitch: Number,
    averageYaw: Number,
    averageRoll: Number,
    headMovementVariance: Number,
    faceVisiblePercentage: Number,
    eyeClosureRate: Number,
  },
  { _id: false }
);

const screenFeaturesSchema = new mongoose.Schema(
  {
    cursorSpeed: Number,
    cursorAcceleration: Number,
    cursorSmoothness: Number,
    scrollFrequency: Number,
    scrollSpeed: Number,
    idleDuration: Number,
    focusChanges: Number,
  },
  { _id: false }
);

const ExtractedBehaviorFeatureSchema = new mongoose.Schema(
  {
    assessmentId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    assessmentType: {
      type: String,
      enum: ["mcq", "coding", "typing"],
      required: true,
    },

    webcamFeatures: webcamFeaturesSchema,
    screenFeatures: screenFeaturesSchema,

    // Processing/job bookkeeping — separate from the ML output above so the
    // pipeline can report status without polluting the feature vector.
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },

    metadata: {
      processedAt: Date,
      modelVersion: { type: String, default: "v1.0" },
      webcamDiagnostics: mongoose.Schema.Types.Mixed,
      screenDiagnostics: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true, collection: "ExtractedBehaviorFeatures" }
);

module.exports = mongoose.model(
  "ExtractedBehaviorFeature",
  ExtractedBehaviorFeatureSchema
);
