// const Media = require("../models/Media"); // adjust path to your existing Media model
// const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
// const { downloadVideo, cleanupFile } = require("./videoDownloader");
// const { runExtraction } = require("./pythonBridge");
// const jobQueue = require("../queue/jobQueue");
// const { MODEL_VERSION } = require("../config/extractionConfig");

// /**
//  * Shared by both entrypoints below: upserts a "pending" placeholder so
//  * status is queryable immediately and a duplicate trigger doesn't
//  * double-enqueue the same assessment.
//  */
// async function _ensurePendingRecord(ctx) {
//   const { assessmentId } = ctx;
//   await ExtractedBehaviorFeature.findOneAndUpdate(
//     { assessmentId },
//     {
//       $setOnInsert: {
//         assessmentId,
//         userId: ctx.userId,
//         sessionId: ctx.sessionId,
//         assessmentType: ctx.assessmentType,
//       },
//       $set: { status: "pending", lastError: null },
//     },
//     { upsert: true, new: true }
//   );
// }

// /**
//  * Fire-and-forget entrypoint: call this after an assessment (and its media)
//  * is complete. It enqueues the work and returns immediately — it never
//  * blocks the caller (e.g. assessmentController.completeAssessment).
//  *
//  * This is ALSO what the /trigger and /retry admin endpoints call — there is
//  * only one extraction implementation (`_processAssessment`, on the one
//  * shared `jobQueue`); this function and `enqueueAndWait` below are just two
//  * different ways of waiting (or not) for it.
//  *
//  * @param {{assessmentId:string, userId:string, sessionId:string, assessmentType:string}} ctx
//  */
// async function enqueueExtraction(ctx) {
//   const { assessmentId } = ctx;

//   const existing = await ExtractedBehaviorFeature.findOne({ assessmentId });
//   if (existing && ["pending", "processing", "completed"].includes(existing.status)) {
//     return existing; // already queued/done — no-op (idempotent)
//   }

//   await _ensurePendingRecord(ctx);

//   // Fire-and-forget into the queue; errors are caught and logged inside.
//   jobQueue
//     .enqueue(() => _processAssessment(ctx), { label: `extract:${assessmentId}` })
//     .catch((err) => {
//       console.error(`[featureExtraction] permanently failed for ${assessmentId}: ${err.message}`);
//     });

//   return { assessmentId, status: "pending" };
// }

// /**
//  * Awaitable entrypoint used by scripts/backfillExtraction.js. Same
//  * `_processAssessment` function, same shared `jobQueue` (so backfill jobs
//  * respect the exact same concurrency limit and retry/backoff policy as
//  * live traffic) — the only difference is this resolves/rejects once the
//  * job actually finishes, which a batch script needs in order to print
//  * accurate progress and a final tally.
//  *
//  * @param {{assessmentId:string, userId:string, sessionId:string, assessmentType:string}} ctx
//  * @returns {Promise<{skipped:boolean, reason?:string, doc?:object}>}
//  */
// async function enqueueAndWait(ctx) {
//   const { assessmentId } = ctx;

//   const existing = await ExtractedBehaviorFeature.findOne({ assessmentId });
//   if (existing && existing.status === "completed") {
//     return { skipped: true, reason: "already-completed", doc: existing };
//   }

//   await _ensurePendingRecord(ctx);

//   const doc = await jobQueue.enqueue(() => _processAssessment(ctx), {
//     label: `extract:${assessmentId}`,
//   });

//   return { skipped: false, doc };
// }

// async function _processAssessment(ctx) {
//   const { assessmentId, userId, sessionId, assessmentType } = ctx;

//   await ExtractedBehaviorFeature.updateOne(
//     { assessmentId },
//     { $set: { status: "processing" }, $inc: { attempts: 1 } }
//   );

//   const media = await Media.findOne({ assessmentId });
//   if (!media) {
//     throw new Error(`No Media document found for assessmentId=${assessmentId}`);
//   }

//   const camUrl = media.cameraRecording && media.cameraRecording.url;
//   const screenUrl = media.screenRecording && media.screenRecording.url;

//   if (!camUrl && !screenUrl) {
//     throw new Error(`Media document for ${assessmentId} has neither camera nor screen recording`);
//   }

//   let camPath, screenPath;
//   try {
//     [camPath, screenPath] = await Promise.all([
//       camUrl ? downloadVideo(camUrl, `${assessmentId}-webcam`) : Promise.resolve(null),
//       screenUrl ? downloadVideo(screenUrl, `${assessmentId}-screen`) : Promise.resolve(null),
//     ]);

//     const [webcamResult, screenResult] = await Promise.all([
//       camPath ? runExtraction(camPath, "webcam") : Promise.resolve(null),
//       screenPath ? runExtraction(screenPath, "screen") : Promise.resolve(null),
//     ]);

//     const webcamFeatures = webcamResult ? _stripDiagnostics(webcamResult) : undefined;
//     const screenFeatures = screenResult ? _stripDiagnostics(screenResult) : undefined;

//     const doc = await ExtractedBehaviorFeature.findOneAndUpdate(
//       { assessmentId },
//       {
//         $set: {
//           userId,
//           sessionId,
//           assessmentType,
//           webcamFeatures,
//           screenFeatures,
//           status: "completed",
//           lastError: null,
//           "metadata.processedAt": new Date(),
//           "metadata.modelVersion": MODEL_VERSION,
//           "metadata.webcamDiagnostics": webcamResult ? webcamResult._diagnostics : undefined,
//           "metadata.screenDiagnostics": screenResult ? screenResult._diagnostics : undefined,
//         },
//       },
//       { new: true, upsert: true }
//     );

//     return doc;
//   } catch (err) {
//     await ExtractedBehaviorFeature.updateOne(
//       { assessmentId },
//       { $set: { status: "failed", lastError: err.message } }
//     );
//     throw err; // let jobQueue's retry logic decide whether to retry
//   } finally {
//     cleanupFile(camPath);
//     cleanupFile(screenPath);
//   }
// }

// function _stripDiagnostics(featureObj) {
//   const { _diagnostics, ...rest } = featureObj;
//   return rest;
// }

// module.exports = { enqueueExtraction, enqueueAndWait };

const Media = require("../models/Media"); // adjust path to your existing Media model
const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
const { downloadVideo, cleanupFile } = require("./videoDownloader");
const { runExtraction } = require("./pythonBridge");
const jobQueue = require("../queue/jobQueue");
const { CURRENT_MODEL_VERSION } = require("../config/featureSchema");

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
 * shared `jobQueue`); this function, `enqueueAndWait`, and
 * `enqueueIncrementalUpgrade` below are just three different ways of
 * invoking (and, for the latter two, waiting on) it. Verified as part of
 * the live/backfill consistency investigation: all three converge on the
 * same function and queue, so live and historical processing cannot drift
 * apart into two implementations.
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
 * Awaitable entrypoint used by scripts/backfillExtraction.js for
 * assessments that have NO ExtractedBehaviorFeature document yet at all
 * (full extraction, not an incremental upgrade). Same `_processAssessment`
 * function, same shared `jobQueue` as live traffic.
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

/**
 * Awaitable entrypoint used by scripts/backfillExtraction.js for
 * assessments that DO already have a `completed` ExtractedBehaviorFeature
 * document, but one that's missing fields introduced in a later pipeline
 * version (see config/featureSchema.js). Runs the full analyzer pass
 * (recomputing everything is unavoidable — old and new metrics come out of
 * the same MediaPipe per-frame loop, so there's no cheaper "only compute
 * the new fields" mode), then merges the result with the existing document
 * giving the EXISTING value priority wherever it's already present. This
 * is what makes the upgrade "preserve existing features, only fill in
 * what's missing" rather than silently changing previously-exported
 * baseline numbers.
 *
 * @param {{assessmentId:string, userId:string, sessionId:string, assessmentType:string}} ctx
 * @returns {Promise<{skipped:boolean, doc?:object}>}
 */
async function enqueueIncrementalUpgrade(ctx) {
  const { assessmentId } = ctx;

  const doc = await jobQueue.enqueue(
    () => _processAssessment(ctx, { mergeWithExisting: true }),
    { label: `upgrade:${assessmentId}` }
  );

  return { skipped: false, doc };
}

function _mergePreferExisting(freshObj, existingObj) {
  const merged = { ...(freshObj || {}) };
  if (!existingObj) return merged;
  for (const [key, value] of Object.entries(existingObj)) {
    if (value !== null && value !== undefined) merged[key] = value;
  }
  return merged;
}

async function _processAssessment(ctx, opts = {}) {
  const { assessmentId, userId, sessionId, assessmentType } = ctx;
  const { mergeWithExisting = false } = opts;

  // Per-stage logging — added in response to the live/backfill consistency
  // investigation, which found failures were only logged as a single
  // summary line with no visibility into which stage broke.
  const log = (stage, status, extra = "") =>
    console.log(
      `[extract:${assessmentId}] ${stage}: ${status}${extra ? " — " + extra : ""}`
    );

  log("Assessment", mergeWithExisting ? "starting incremental upgrade" : "starting full extraction");

  let priorDoc = null;
  if (mergeWithExisting) {
    priorDoc = await ExtractedBehaviorFeature.findOne({ assessmentId }).lean();
  }

  await ExtractedBehaviorFeature.updateOne(
    { assessmentId },
    { $set: { status: "processing" }, $inc: { attempts: 1 } }
  );

  const media = await Media.findOne({ assessmentId });
  if (!media) {
    log("Media lookup", "✘ FAILED", "no Media document found");
    throw new Error(`No Media document found for assessmentId=${assessmentId}`);
  }

  const camUrl = media.cameraRecording && media.cameraRecording.url;
  const screenUrl = media.screenRecording && media.screenRecording.url;

  if (!camUrl && !screenUrl) {
    log("Media lookup", "✘ FAILED", "neither camera nor screen recording present");
    throw new Error(`Media document for ${assessmentId} has neither camera nor screen recording`);
  }

  let camPath, screenPath;
  try {
    log("Downloading webcam recording", camUrl ? "starting" : "skipped (no URL)");
    log("Downloading screen recording", screenUrl ? "starting" : "skipped (no URL)");

    [camPath, screenPath] = await Promise.all([
      camUrl ? downloadVideo(camUrl, `${assessmentId}-webcam`) : Promise.resolve(null),
      screenUrl ? downloadVideo(screenUrl, `${assessmentId}-screen`) : Promise.resolve(null),
    ]);
    if (camUrl) log("Downloading webcam recording", "✓ success");
    if (screenUrl) log("Downloading screen recording", "✓ success");

    log("Running webcam analyzer", camPath ? "starting" : "skipped (no recording)");
    log("Running screen analyzer", screenPath ? "starting" : "skipped (no recording)");

    const [webcamResult, screenResult] = await Promise.all([
      camPath ? runExtraction(camPath, "webcam") : Promise.resolve(null),
      screenPath ? runExtraction(screenPath, "screen") : Promise.resolve(null),
    ]);

    if (camPath) log("Running webcam analyzer", "✓ success");
    if (screenPath) log("Running screen analyzer", "✓ success");
    log("Parsing Python output", "✓ success");

    let webcamFeatures = webcamResult ? _stripDiagnostics(webcamResult) : undefined;
    let screenFeatures = screenResult ? _stripDiagnostics(screenResult) : undefined;

    if (mergeWithExisting) {
      webcamFeatures = _mergePreferExisting(webcamFeatures, priorDoc && priorDoc.webcamFeatures);
      screenFeatures = _mergePreferExisting(screenFeatures, priorDoc && priorDoc.screenFeatures);
      log("Merging with existing document", "✓ success", "existing values preserved, only missing fields filled");
    }

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
          "metadata.modelVersion": CURRENT_MODEL_VERSION,
          "metadata.webcamDiagnostics": webcamResult ? webcamResult._diagnostics : undefined,
          "metadata.screenDiagnostics": screenResult ? screenResult._diagnostics : undefined,
        },
      },
      { new: true, upsert: true }
    );

    log("Saving features to MongoDB", "✓ success");
    return doc;
  } catch (err) {
    log("Pipeline", "✘ FAILED", err.message);
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
  if (!featureObj) return featureObj;
  const { _diagnostics, ...rest } = featureObj;
  return rest;
}

module.exports = { enqueueExtraction, enqueueAndWait, enqueueIncrementalUpgrade };
