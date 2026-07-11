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
  // Video buffers can legitimately take longer than the SDK's default
  // 60s timeout to fully upload. Raised so a real (working) upload has
  // room to finish rather than being cut off mid-transfer.
  timeout: 5 * 60 * 1000,
});

/**
 * Upload a file buffer to Cloudinary using the officially documented
 * Buffer/Stream upload method for the Node SDK: uploader.upload_stream().
 *
 * IMPORTANT: `upload_large_stream` is NOT a valid method on this SDK and
 * was previously called here by mistake — cloudinary.uploader.upload_large_stream
 * is `undefined` on the official `cloudinary` npm package, so calling it
 * throws a synchronous TypeError ("... is not a function") the moment this
 * function runs, before any Promise/callback logic even executes. That
 * exception was uncaught at the call site, which is exactly what produced
 * the HTTP 500 with no useful detail in the logs. `upload_stream` is the
 * correct, documented method for Buffer/Stream-based uploads (video or
 * otherwise) and is what's used below.
 *
 * @param {Buffer} fileBuffer
 * @param {string} fileName - e.g. "mcq_camera_<sessionId>_<ts>.webm"
 * @param {string} folder - e.g. /abeis/cameraRecordings
 * @returns {Promise<object>} Cloudinary upload result (public_id, secure_url, bytes, ...)
 */
function uploadToStorage(fileBuffer, fileName, folder) {
  return new Promise((resolve, reject) => {
    if (!fileBuffer || fileBuffer.length === 0) {
      return reject(new Error("Cannot upload an empty file buffer"));
    }

    const publicId = fileName.replace(/\.[^/.]+$/, ""); // strip extension; Cloudinary manages format separately
    const cleanFolder = folder.replace(/^\/+/, ""); // Cloudinary folder paths don't use a leading slash

    console.log(
      `[cloudinary] upload starting — publicId=${publicId} folder=${cleanFolder} ` +
      `bufferBytes=${fileBuffer.length}`
    );

    const startedAt = Date.now();

    let uploadStream;
    try {
      uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: cleanFolder,
          public_id: publicId,
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          const durationMs = Date.now() - startedAt;
          if (error) {
            console.error(
              `[cloudinary] upload FAILED — publicId=${publicId} durationMs=${durationMs}`,
              error
            );
            return reject(error);
          }
          console.log(
            `[cloudinary] upload SUCCESS — publicId=${publicId} durationMs=${durationMs} ` +
            `bytes=${result.bytes} url=${result.secure_url}`
          );
          resolve(result);
        }
      );
    } catch (syncErr) {
      // Defensive: if the SDK method itself were ever missing/renamed again,
      // fail loudly here instead of throwing an unhandled exception that
      // surfaces as a bare 500 with no context.
      console.error(
        `[cloudinary] upload_stream call threw synchronously — publicId=${publicId}`,
        syncErr
      );
      return reject(syncErr);
    }

    Readable.from(fileBuffer).pipe(uploadStream);
  });
}

/**
 * Permanently deletes a file from Cloudinary by its public_id.
 * Unchanged — deletion was never part of the reported issue.
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