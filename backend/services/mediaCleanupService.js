const Media = require("../models/Media");
const { deleteFromStorage } = require("../config/cloudinary");

/**
 * Whether MongoDB records should still be removed for a user/dataset when
 * one or more of their Cloudinary files failed to delete.
 *
 * Per spec: default is to NOT delete Mongo records when a Cloudinary
 * deletion fails, unless this is explicitly turned on.
 */
function shouldContinueOnFailure() {
  return (
    process.env.DELETE_MONGO_ON_STORAGE_DELETE_FAILURE === "true" ||
    process.env.DELETE_MONGO_ON_IMAGEKIT_FAILURE === "true" // legacy name, kept for backward compatibility
  );
}

/**
 * Attempts to delete every Cloudinary file referenced by the given Media
 * documents. Never throws — every failure is caught, logged with full
 * context, and returned so the caller can decide what to do next.
 *
 * @param {Array} mediaRecords - lean Media documents
 * @returns {Promise<{successes: object[], failures: object[]}>}
 */
async function deleteImageKitFilesForMedia(mediaRecords) {
  const successes = [];
  const failures = [];

  for (const record of mediaRecords) {
    for (const recordingType of ["cameraRecording", "screenRecording"]) {
      const recording = record[recordingType];
      if (!recording || !recording.fileId) continue;

      const context = {
        userId: record.userId,
        assessmentId: record.assessmentId,
        fileId: recording.fileId,
        recordingType,
      };

      try {
        // deleteFromStorage already treats Cloudinary's "not found" result as
        // a success (file is already gone, which is the desired end state),
        // so anything that reaches this catch block is a genuine failure.
        await deleteFromStorage(recording.fileId);
        successes.push(context);
      } catch (err) {
        const message = err?.message || String(err);
        console.error(
          `[CLOUDINARY_DELETE_FAILED] userId=${context.userId} assessmentId=${context.assessmentId} ` +
          `fileId=${context.fileId} recordingType=${context.recordingType} error=${message}`
        );
        failures.push({ ...context, error: message });
      }
    }
  }

  return { successes, failures };
}

/**
 * Deletes every Cloudinary file for the given Mongo media filter (e.g. { userId }
 * or {} for the entire dataset), respecting DELETE_MONGO_ON_IMAGEKIT_FAILURE.
 *
 * @param {object} mediaFilter - Mongo filter passed to Media.find()
 * @returns {Promise<{
 *   canDeleteMongo: boolean,
 *   successes: object[],
 *   failures: object[],
 *   mediaRecords: object[]
 * }>}
 */
async function cleanupMediaForFilter(mediaFilter) {
  const mediaRecords = await Media.find(mediaFilter).lean();
  const { successes, failures } = await deleteImageKitFilesForMedia(mediaRecords);

  const canDeleteMongo = failures.length === 0 || shouldContinueOnFailure();

  return { canDeleteMongo, successes, failures, mediaRecords };
}

/**
 * Builds the human-readable warning suffix used across delete endpoints.
 */
function buildWarningMessage(failures) {
  if (!failures.length) return "";
  return ` Warning: ${failures.length} Cloudinary file${failures.length === 1 ? "" : "s"} could not be deleted.`;
}

module.exports = {
  deleteImageKitFilesForMedia,
  cleanupMediaForFilter,
  buildWarningMessage,
  shouldContinueOnFailure,
};
