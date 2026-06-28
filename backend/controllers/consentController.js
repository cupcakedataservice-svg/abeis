const asyncHandler = require("express-async-handler");
const Consent = require("../models/Consent");

const REQUIRED_STATEMENTS = [
  "dataCollection",
  "webcamRecording",
  "screenRecording",
  "behavioralFeatures",
  "secureStorageLinkedToUserId",
  "imagekitAndMongoStorage",
  "baselineUsage",
  "rightToStop",
];

// POST /api/consent
const recordConsent = asyncHandler(async (req, res) => {
  const {
    userId,
    sessionId,
    acknowledgedStatements,
    browserInfo,
    cameraPermissionStatus,
    screenRecordingPermissionStatus,
  } = req.body;

  if (!userId || !sessionId) {
    res.status(400);
    throw new Error("userId and sessionId are required");
  }

  // Enforce that every required statement was explicitly acknowledged true.
  const allAcknowledged =
    acknowledgedStatements &&
    REQUIRED_STATEMENTS.every((key) => acknowledgedStatements[key] === true);

  if (!allAcknowledged) {
    res.status(400);
    throw new Error("All consent statements must be acknowledged before proceeding");
  }

  // Camera + screen recording permission are mandatory; assessment cannot start otherwise.
  if (cameraPermissionStatus !== "granted" || screenRecordingPermissionStatus !== "granted") {
    res.status(403);
    throw new Error(
      "Camera and screen recording permissions are mandatory. The assessment cannot start until both are granted."
    );
  }

  const consent = await Consent.create({
    userId,
    sessionId,
    consentAccepted: true,
    consentTimestamp: new Date(),
    acknowledgedStatements,
    browserInfo,
    cameraPermissionStatus,
    screenRecordingPermissionStatus,
    privacyPolicyVersion: process.env.PRIVACY_POLICY_VERSION || "1.0.0",
    ipAddress: req.ip,
  });

  res.status(201).json(consent);
});

// GET /api/consent/:consentId
const getConsent = asyncHandler(async (req, res) => {
  const consent = await Consent.findOne({ consentId: req.params.consentId });
  if (!consent) {
    res.status(404);
    throw new Error("Consent record not found");
  }
  res.json(consent);
});

module.exports = { recordConsent, getConsent };
