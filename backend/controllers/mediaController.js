const Media = require("../models/Media");
const { uploadToStorage } = require("../config/cloudinary");

const VALID_RECORDING_TYPES = ["camera", "screen"];
const VALID_MIME_PREFIXES = ["video/webm", "video/"];

// POST /api/media/upload
// multipart/form-data: file, assessmentId, userId, sessionId, assessmentType, recordingType ('camera'|'screen'), duration
//
// Deliberately NOT using express-async-handler here: this route needs
// full control over its own try/catch so a Cloudinary failure returns a
// meaningful JSON body instead of falling through to the generic error
// middleware as an opaque 500.
const uploadRecording = async (req, res) => {
  const { assessmentId, userId, sessionId, assessmentType, recordingType, duration } = req.body || {};

  // --- Validation (returns 400, not 500, for anything malformed) ---
  if (!req.file) {
    console.warn("[media/upload] rejected: no file on request");
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
      details: "req.file was missing — check that the frontend sent multipart/form-data with field name 'file'.",
    });
  }

  if (!req.file.buffer || req.file.buffer.length === 0) {
    console.warn(
      `[media/upload] rejected: empty buffer — recordingType=${recordingType} ` +
      `originalname=${req.file.originalname}`
    );
    return res.status(400).json({
      success: false,
      message: "Uploaded file is empty",
      details: "The recording buffer had zero length — the recording may not have finalized correctly on the client.",
    });
  }

  if (!assessmentId || !userId || !sessionId || !assessmentType || !recordingType) {
    console.warn("[media/upload] rejected: missing required fields", {
      assessmentId, userId, sessionId, assessmentType, recordingType,
    });
    return res.status(400).json({
      success: false,
      message: "assessmentId, userId, sessionId, assessmentType and recordingType are required",
    });
  }

  if (!VALID_RECORDING_TYPES.includes(recordingType)) {
    console.warn(`[media/upload] rejected: invalid recordingType=${recordingType}`);
    return res.status(400).json({
      success: false,
      message: "recordingType must be 'camera' or 'screen'",
    });
  }

  const mimeType = req.file.mimetype || "";
  const mimeOk = VALID_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
  if (!mimeOk) {
    console.warn(`[media/upload] rejected: invalid mimetype=${mimeType}`);
    return res.status(400).json({
      success: false,
      message: `Invalid file type: ${mimeType}. Expected a video/* MIME type (e.g. video/webm).`,
    });
  }

  // --- Idempotency guard: never re-upload a recording already stored ---
  let existing;
  try {
    existing = await Media.findOne({ assessmentId });
  } catch (dbErr) {
    console.error(`[media/upload] Media lookup failed — assessmentId=${assessmentId}`, dbErr);
    return res.status(500).json({
      success: false,
      message: "Database lookup failed while checking for an existing upload",
      error: dbErr.message,
    });
  }

  const existingRecording =
    recordingType === "camera" ? existing?.cameraRecording : existing?.screenRecording;

  if (existingRecording && existingRecording.fileId && existingRecording.url) {
    console.log(
      `[media/upload] skip — already uploaded — assessmentId=${assessmentId} recordingType=${recordingType} ` +
      `existingUrl=${existingRecording.url}`
    );
    return res.status(200).json({
      success: true,
      media: existing,
      recordingMeta: existingRecording,
      alreadyUploaded: true,
    });
  }

  const folder = recordingType === "camera" ? "/abeis/cameraRecordings" : "/abeis/screenRecordings";
  const fileName = `${assessmentType}_${recordingType}_${sessionId}_${Date.now()}.webm`;

  console.log("[media/upload] beginning upload", {
    assessmentId,
    recordingType,
    fileName,
    folder,
    mimeType,
    bufferLength: req.file.buffer.length,
    fileSizeBytes: req.file.size,
  });

  const uploadStartedAt = Date.now();
  let uploadResult;
  try {
    uploadResult = await uploadToStorage(req.file.buffer, fileName, folder);
  } catch (cloudinaryErr) {
    const durationMs = Date.now() - uploadStartedAt;
    console.error("[media/upload] Cloudinary upload threw an exception", {
      assessmentId,
      recordingType,
      fileName,
      folder,
      mimeType,
      bufferLength: req.file.buffer.length,
      durationMs,
      errorMessage: cloudinaryErr.message,
      errorName: cloudinaryErr.name,
      cloudinaryHttpCode: cloudinaryErr.http_code,
      stack: cloudinaryErr.stack,
    });

    return res.status(502).json({
      success: false,
      message: "Video upload to Cloudinary failed",
      details: `Failed to upload ${recordingType} recording (${req.file.buffer.length} bytes) after ${durationMs}ms.`,
      error: cloudinaryErr.message,
    });
  }

  const durationMs = Date.now() - uploadStartedAt;
  console.log("[media/upload] Cloudinary upload succeeded", {
    assessmentId,
    recordingType,
    fileName,
    durationMs,
    publicId: uploadResult.public_id,
    secureUrl: uploadResult.secure_url,
    bytes: uploadResult.bytes,
    fullResponse: uploadResult,
  });

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

  let media;
  try {
    media = await Media.findOneAndUpdate(
      { assessmentId },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (dbErr) {
    console.error(`[media/upload] Media save failed after successful Cloudinary upload — assessmentId=${assessmentId}`, dbErr);
    // The file is already on Cloudinary at this point — surface that in the
    // response so it isn't silently lost/re-uploaded on retry investigation.
    return res.status(500).json({
      success: false,
      message: "Recording uploaded to Cloudinary but saving its metadata to the database failed",
      details: `Cloudinary URL (not yet persisted): ${recordingMeta.url}`,
      error: dbErr.message,
    });
  }

  return res.status(201).json({
    success: true,
    media,
    recordingMeta,
    alreadyUploaded: false,
  });
};

// GET /api/media/:assessmentId
const getMediaForAssessment = async (req, res) => {
  try {
    const media = await Media.findOne({ assessmentId: req.params.assessmentId });
    if (!media) {
      return res.status(404).json({ success: false, message: "No media found for this assessment" });
    }
    res.json(media);
  } catch (err) {
    console.error(`[media] getMediaForAssessment failed — assessmentId=${req.params.assessmentId}`, err);
    res.status(500).json({ success: false, message: "Failed to fetch media", error: err.message });
  }
};

module.exports = { uploadRecording, getMediaForAssessment };