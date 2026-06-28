const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const assessmentSchema = new mongoose.Schema(
  {
    assessmentId: { type: String, default: uuidv4, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },

    assessmentType: {
      type: String,
      enum: ["mcq", "coding", "typing"],
      required: true,
      index: true,
    },

    consentId: { type: String, required: true },

    status: {
      type: String,
      enum: ["in_progress", "completed", "abandoned"],
      default: "in_progress",
    },

    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    duration: { type: Number }, // seconds

    // Generic per-type config snapshot (e.g. which questions were served)
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assessment", assessmentSchema);
