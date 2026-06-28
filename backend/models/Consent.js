const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const consentSchema = new mongoose.Schema(
  {
    consentId: { type: String, default: uuidv4, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },

    consentAccepted: { type: Boolean, required: true, default: false },
    consentTimestamp: { type: Date, required: true, default: Date.now },

    // Each individual statement acknowledged, for auditability
    acknowledgedStatements: {
      dataCollection: { type: Boolean, required: true },
      webcamRecording: { type: Boolean, required: true },
      screenRecording: { type: Boolean, required: true },
      behavioralFeatures: { type: Boolean, required: true },
      secureStorageLinkedToUserId: { type: Boolean, required: true },
      imagekitAndMongoStorage: { type: Boolean, required: true },
      baselineUsage: { type: Boolean, required: true },
      rightToStop: { type: Boolean, required: true },
    },

    browserInfo: {
      userAgent: String,
      browserName: String,
      browserVersion: String,
      os: String,
      deviceType: String, // desktop / mobile / tablet
      screenResolution: String,
    },

    cameraPermissionStatus: {
      type: String,
      enum: ["granted", "denied", "prompt", "unavailable"],
      required: true,
    },
    screenRecordingPermissionStatus: {
      type: String,
      enum: ["granted", "denied", "prompt", "unavailable"],
      required: true,
    },

    privacyPolicyVersion: { type: String, required: true },

    ipAddress: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Consent", consentSchema);
