const mongoose = require("mongoose");

const baselineMetricsSchema = new mongoose.Schema(
  {
    sampleCount: { type: Number, default: 0 }, // how many assessments contributed
    avgResponseTimeMs: Number,
    avgTypingSpeedWpm: Number,
    avgMouseSpeed: Number,
    avgClickFrequency: Number,
    avgKeyLatencyMs: Number,
    avgScrollDistance: Number,
    avgIdleDurationMs: Number,
    avgBackspaceCount: Number,
    avgFocusChanges: Number,
    lastUpdatedAt: { type: Date, default: Date.now },
    // Full last-known feature vector snapshot, useful for richer deviation analysis
    lastFeatureVector: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const baselineSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },

    mcqBaseline: { type: baselineMetricsSchema, default: () => ({}) },
    codingBaseline: { type: baselineMetricsSchema, default: () => ({}) },
    typingBaseline: { type: baselineMetricsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Baseline", baselineSchema);
