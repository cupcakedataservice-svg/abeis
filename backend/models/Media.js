const mongoose = require("mongoose");

const recordingSchema = new mongoose.Schema(
  {
    // fileId is mandatory — it's the only handle Cloudinary gives us to permanently
    // delete this file later (see services/mediaCleanupService.js).
    fileId: { type: String, required: true },
    url: { type: String, required: true },
    name: String,
    size: Number, // bytes
    uploadedAt: { type: Date, default: Date.now },
    duration: Number, // seconds (kept in addition to the spec'd fields, used by the dashboard)
  },
  { _id: false }
);

const mediaSchema = new mongoose.Schema(
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

    cameraRecording: recordingSchema,
    screenRecording: recordingSchema,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Media", mediaSchema);
