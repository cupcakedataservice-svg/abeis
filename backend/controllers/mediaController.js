const asyncHandler = require("express-async-handler");
const Media = require("../models/Media");
const { uploadToStorage } = require("../config/imagekit");

// POST /api/media/upload
// multipart/form-data: file, assessmentId, userId, sessionId, assessmentType, recordingType ('camera'|'screen'), duration
const uploadRecording = asyncHandler(async (req, res) => {
  const { assessmentId, userId, sessionId, assessmentType, recordingType, duration } = req.body;

  if (!req.file) {
    res.status(400);
    throw new Error("No file uploaded");
  }
  if (!assessmentId || !userId || !sessionId || !assessmentType || !recordingType) {
    res.status(400);
    throw new Error("assessmentId, userId, sessionId, assessmentType and recordingType are required");
  }
  if (!["camera", "screen"].includes(recordingType)) {
    res.status(400);
    throw new Error("recordingType must be 'camera' or 'screen'");
  }

  const folder = recordingType === "camera" ? "/abeis/cameraRecordings" : "/abeis/screenRecordings";
  const fileName = `${assessmentType}_${recordingType}_${sessionId}_${Date.now()}.webm`;

  const uploadResult = await uploadToStorage(req.file.buffer, fileName, folder);

  const recordingMeta = {
    fileId: uploadResult.fileId,
    url: uploadResult.url,
    name: uploadResult.name,
    size: uploadResult.size,
    uploadedAt: new Date(),
    duration: duration ? Number(duration) : undefined,
  };

  const update = { userId, sessionId, assessmentType };
  if (recordingType === "camera") update.cameraRecording = recordingMeta;
  if (recordingType === "screen") update.screenRecording = recordingMeta;

  const media = await Media.findOneAndUpdate(
    { assessmentId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ media, recordingMeta });
});

// GET /api/media/:assessmentId
const getMediaForAssessment = asyncHandler(async (req, res) => {
  const media = await Media.findOne({ assessmentId: req.params.assessmentId });
  if (!media) {
    res.status(404);
    throw new Error("No media found for this assessment");
  }
  res.json(media);
});

module.exports = { uploadRecording, getMediaForAssessment };
