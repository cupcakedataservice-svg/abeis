const cloudinary = require("cloudinary").v2;
const { Readable } = require("stream");

// Storage abstraction: Cloudinary today, swappable for S3/Azure later.
// Any code that needs to upload/delete media should go through this module,
// not call the Cloudinary SDK directly elsewhere in the app. The exported
// function signatures (uploadToStorage / deleteFromStorage) intentionally
// match the previous ImageKit module so no caller had to change.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a file buffer to Cloudinary.
 * Webcam/screen recordings are .webm video files, so resource_type is
 * always "video" (Cloudinary's free tier supports video uploads/storage).
 *
 * @param {Buffer} fileBuffer
 * @param {string} fileName - e.g. "mcq_camera_<sessionId>_<ts>.webm"
 * @param {string} folder - e.g. /abeis/cameraRecordings
 * @returns {Promise<object>} Cloudinary upload result (public_id, secure_url, bytes, ...)
 */
function uploadToStorage(fileBuffer, fileName, folder) {
  return new Promise((resolve, reject) => {
    const publicId = fileName.replace(/\.[^/.]+$/, ""); // strip extension; Cloudinary manages format separately

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: folder.replace(/^\/+/, ""), // Cloudinary folder paths don't use a leading slash
        public_id: publicId,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    Readable.from(fileBuffer).pipe(uploadStream);
  });
}

/**
 * Permanently deletes a file from Cloudinary by its public_id.
 * Cloudinary's destroy() doesn't throw for an already-missing file — it
 * resolves with { result: "not found" } — which we treat as a successful
 * cleanup (the desired end state, no orphaned file, is already true).
 * Any other non-"ok" result is treated as a real failure and thrown so
 * callers (see services/mediaCleanupService.js) can log/report it.
 */
async function deleteFromStorage(fileId) {
  const result = await cloudinary.uploader.destroy(fileId, { resource_type: "video" });
  if (result.result !== "ok" && result.result !== "not found") {
    const err = new Error(`Cloudinary deletion failed: ${result.result}`);
    err.cloudinaryResult = result.result;
    throw err;
  }
  return result;
}

module.exports = { cloudinary, uploadToStorage, deleteFromStorage };
