const Media = require("../models/Media");
const { deleteFromStorage } = require("../config/imagekit");

/**
 * Whether MongoDB records should still be removed for a user/dataset when
 * one or more of their ImageKit files failed to delete.
 *
 * Per spec: default is to NOT delete Mongo records when an ImageKit
 * deletion fails, unless this is explicitly turned on.
 */
function shouldContinueOnFailure() {
  return process.env.DELETE_MONGO_ON_IMAGEKIT_FAILURE === "true";
}

/**
 * Attempts to delete every ImageKit file referenced by the given Media
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
        await deleteFromStorage(recording.fileId);
        successes.push(context);
      } catch (err) {
        // ImageKit returns 404 if the file is already gone — treat that as a
        // successful cleanup rather than a failure, since the end state
        // (no orphaned file in ImageKit) is what we actually care about.
        const status = err?.response?.status || err?.httpStatusCode;
        if (status === 404) {
          successes.push(context);
          continue;
        }

        const message = err?.message || String(err);
        console.error(
          `[IMAGEKIT_DELETE_FAILED] userId=${context.userId} assessmentId=${context.assessmentId} ` +
            `fileId=${context.fileId} recordingType=${context.recordingType} error=${message}`
        );
        failures.push({ ...context, error: message });
      }
    }
  }

  return { successes, failures };
}

/**
 * Deletes every ImageKit file for the given Mongo media filter (e.g. { userId }
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
  return ` Warning: ${failures.length} ImageKit file${failures.length === 1 ? "" : "s"} could not be deleted.`;
}

module.exports = {
  deleteImageKitFilesForMedia,
  cleanupMediaForFilter,
  buildWarningMessage,
  shouldContinueOnFailure,
};
