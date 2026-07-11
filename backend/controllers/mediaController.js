// const asyncHandler = require("express-async-handler");
// const Media = require("../models/Media");
// const { uploadToStorage } = require("../config/cloudinary");

// // POST /api/media/upload
// // multipart/form-data: file, assessmentId, userId, sessionId, assessmentType, recordingType ('camera'|'screen'), duration
// const uploadRecording = asyncHandler(async (req, res) => {
//   const { assessmentId, userId, sessionId, assessmentType, recordingType, duration } = req.body;

//   if (!req.file) {
//     res.status(400);
//     throw new Error("No file uploaded");
//   }
//   if (!assessmentId || !userId || !sessionId || !assessmentType || !recordingType) {
//     res.status(400);
//     throw new Error("assessmentId, userId, sessionId, assessmentType and recordingType are required");
//   }
//   if (!["camera", "screen"].includes(recordingType)) {
//     res.status(400);
//     throw new Error("recordingType must be 'camera' or 'screen'");
//   }

//   const folder = recordingType === "camera" ? "/abeis/cameraRecordings" : "/abeis/screenRecordings";
//   const fileName = `${assessmentType}_${recordingType}_${sessionId}_${Date.now()}.webm`;

//   const uploadResult = await uploadToStorage(req.file.buffer, fileName, folder);

//   const recordingMeta = {
//     fileId: uploadResult.public_id,
//     url: uploadResult.secure_url,
//     name: uploadResult.public_id.split("/").pop(),
//     size: uploadResult.bytes,
//     uploadedAt: new Date(),
//     duration: duration ? Number(duration) : uploadResult.duration,
//   };

//   const update = { userId, sessionId, assessmentType };
//   if (recordingType === "camera") update.cameraRecording = recordingMeta;
//   if (recordingType === "screen") update.screenRecording = recordingMeta;

//   const media = await Media.findOneAndUpdate(
//     { assessmentId },
//     { $set: update },
//     { upsert: true, new: true, setDefaultsOnInsert: true }
//   );

//   res.status(201).json({ media, recordingMeta });
// });

// // GET /api/media/:assessmentId
// const getMediaForAssessment = asyncHandler(async (req, res) => {
//   const media = await Media.findOne({ assessmentId: req.params.assessmentId });
//   if (!media) {
//     res.status(404);
//     throw new Error("No media found for this assessment");
//   }
//   res.json(media);
// });

// module.exports = { uploadRecording, getMediaForAssessment };

const asyncHandler = require("express-async-handler");
const Media = require("../models/Media");
const { uploadToStorage } = require("../config/cloudinary");

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
  if (!req.file.buffer || req.file.buffer.length === 0) {
    res.status(400);
    throw new Error("Uploaded file is empty — recording may not have finalized correctly");
  }

  // --- Idempotency guard (fixes Problem 2, server-side) ---
  // If this exact recording (camera or screen) has already been successfully
  // uploaded for this assessment, never re-upload it to Cloudinary — just
  // return the existing record. This makes the endpoint safe to call
  // repeatedly for the same assessmentId/recordingType (retries, double
  // clicks, or a client that lost its own upload-tracking state all land
  // here safely without creating duplicate Cloudinary files).
  const existing = await Media.findOne({ assessmentId });
  const existingRecording =
    recordingType === "camera" ? existing?.cameraRecording : existing?.screenRecording;

  if (existingRecording && existingRecording.fileId && existingRecording.url) {
    return res.status(200).json({
      media: existing,
      recordingMeta: existingRecording,
      alreadyUploaded: true, // additive field; safe for existing callers to ignore
    });
  }

  const folder = recordingType === "camera" ? "/abeis/cameraRecordings" : "/abeis/screenRecordings";
  const fileName = `${assessmentType}_${recordingType}_${sessionId}_${Date.now()}.webm`;

  const uploadResult = await uploadToStorage(req.file.buffer, fileName, folder);

  const recordingMeta = {
    fileId: uploadResult.public_id,
    url: uploadResult.secure_url,
    name: uploadResult.public_id.split("/").pop(),
    size: uploadResult.bytes,
    uploadedAt: new Date(),
    duration: duration ? Number(duration) : uploadResult.duration,
  };

  const update = { userId, sessionId, assessmentType };
  if (recordingType === "camera") update.cameraRecording = recordingMeta;
  if (recordingType === "screen") update.screenRecording = recordingMeta;

  const media = await Media.findOneAndUpdate(
    { assessmentId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ media, recordingMeta, alreadyUploaded: false });
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