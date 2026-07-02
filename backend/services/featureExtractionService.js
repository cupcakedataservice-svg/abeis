const Media = require("../models/Media"); // adjust path to your existing Media model
const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
const { downloadVideo, cleanupFile } = require("./videoDownloader");
const { runExtraction } = require("./pythonBridge");
const jobQueue = require("../queue/jobQueue");
const { MODEL_VERSION } = require("../config/extractionConfig");

/**
 * Shared by both entrypoints below: upserts a "pending" placeholder so
 * status is queryable immediately and a duplicate trigger doesn't
 * double-enqueue the same assessment.
 */
async function _ensurePendingRecord(ctx) {
  const { assessmentId } = ctx;
  await ExtractedBehaviorFeature.findOneAndUpdate(
    { assessmentId },
    {
      $setOnInsert: {
        assessmentId,
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        assessmentType: ctx.assessmentType,
      },
      $set: { status: "pending", lastError: null },
    },
    { upsert: true, new: true }
  );
}

/**
 * Fire-and-forget entrypoint: call this after an assessment (and its media)
 * is complete. It enqueues the work and returns immediately — it never
 * blocks the caller (e.g. assessmentController.completeAssessment).
 *
 * This is ALSO what the /trigger and /retry admin endpoints call — there is
 * only one extraction implementation (`_processAssessment`, on the one
 * shared `jobQueue`); this function and `enqueueAndWait` below are just two
 * different ways of waiting (or not) for it.
 *
 * @param {{assessmentId:string, userId:string, sessionId:string, assessmentType:string}} ctx
 */
async function enqueueExtraction(ctx) {
  const { assessmentId } = ctx;

  const existing = await ExtractedBehaviorFeature.findOne({ assessmentId });
  if (existing && ["pending", "processing", "completed"].includes(existing.status)) {
    return existing; // already queued/done — no-op (idempotent)
  }

  await _ensurePendingRecord(ctx);

  // Fire-and-forget into the queue; errors are caught and logged inside.
  jobQueue
    .enqueue(() => _processAssessment(ctx), { label: `extract:${assessmentId}` })
    .catch((err) => {
      console.error(`[featureExtraction] permanently failed for ${assessmentId}: ${err.message}`);
    });

  return { assessmentId, status: "pending" };
}

/**
 * Awaitable entrypoint used by scripts/backfillExtraction.js. Same
 * `_processAssessment` function, same shared `jobQueue` (so backfill jobs
 * respect the exact same concurrency limit and retry/backoff policy as
 * live traffic) — the only difference is this resolves/rejects once the
 * job actually finishes, which a batch script needs in order to print
 * accurate progress and a final tally.
 *
 * @param {{assessmentId:string, userId:string, sessionId:string, assessmentType:string}} ctx
 * @returns {Promise<{skipped:boolean, reason?:string, doc?:object}>}
 */
async function enqueueAndWait(ctx) {
  const { assessmentId } = ctx;

  const existing = await ExtractedBehaviorFeature.findOne({ assessmentId });
  if (existing && existing.status === "completed") {
    return { skipped: true, reason: "already-completed", doc: existing };
  }

  await _ensurePendingRecord(ctx);

  const doc = await jobQueue.enqueue(() => _processAssessment(ctx), {
    label: `extract:${assessmentId}`,
  });

  return { skipped: false, doc };
}

async function _processAssessment(ctx) {
  const { assessmentId, userId, sessionId, assessmentType } = ctx;

  await ExtractedBehaviorFeature.updateOne(
    { assessmentId },
    { $set: { status: "processing" }, $inc: { attempts: 1 } }
  );

  const media = await Media.findOne({ assessmentId });
  if (!media) {
    throw new Error(`No Media document found for assessmentId=${assessmentId}`);
  }

  const camUrl = media.cameraRecording && media.cameraRecording.url;
  const screenUrl = media.screenRecording && media.screenRecording.url;

  if (!camUrl && !screenUrl) {
    throw new Error(`Media document for ${assessmentId} has neither camera nor screen recording`);
  }

  let camPath, screenPath;
  try {
    [camPath, screenPath] = await Promise.all([
      camUrl ? downloadVideo(camUrl, `${assessmentId}-webcam`) : Promise.resolve(null),
      screenUrl ? downloadVideo(screenUrl, `${assessmentId}-screen`) : Promise.resolve(null),
    ]);

    const [webcamResult, screenResult] = await Promise.all([
      camPath ? runExtraction(camPath, "webcam") : Promise.resolve(null),
      screenPath ? runExtraction(screenPath, "screen") : Promise.resolve(null),
    ]);

    const webcamFeatures = webcamResult ? _stripDiagnostics(webcamResult) : undefined;
    const screenFeatures = screenResult ? _stripDiagnostics(screenResult) : undefined;

    const doc = await ExtractedBehaviorFeature.findOneAndUpdate(
      { assessmentId },
      {
        $set: {
          userId,
          sessionId,
          assessmentType,
          webcamFeatures,
          screenFeatures,
          status: "completed",
          lastError: null,
          "metadata.processedAt": new Date(),
          "metadata.modelVersion": MODEL_VERSION,
          "metadata.webcamDiagnostics": webcamResult ? webcamResult._diagnostics : undefined,
          "metadata.screenDiagnostics": screenResult ? screenResult._diagnostics : undefined,
        },
      },
      { new: true, upsert: true }
    );

    return doc;
  } catch (err) {
    await ExtractedBehaviorFeature.updateOne(
      { assessmentId },
      { $set: { status: "failed", lastError: err.message } }
    );
    throw err; // let jobQueue's retry logic decide whether to retry
  } finally {
    cleanupFile(camPath);
    cleanupFile(screenPath);
  }
}

function _stripDiagnostics(featureObj) {
  const { _diagnostics, ...rest } = featureObj;
  return rest;
}

module.exports = { enqueueExtraction, enqueueAndWait };
