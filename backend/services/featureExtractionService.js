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

// const Media = require("../models/Media"); // adjust path to your existing Media model
// const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
// const { downloadVideo, cleanupFile } = require("./videoDownloader");
// const { runExtraction } = require("./pythonBridge");
// const jobQueue = require("../queue/jobQueue");
// const { CURRENT_MODEL_VERSION } = require("../config/featureSchema");

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
//  * shared `jobQueue`); this function, `enqueueAndWait`, and
//  * `enqueueIncrementalUpgrade` below are just three different ways of
//  * invoking (and, for the latter two, waiting on) it. Verified as part of
//  * the live/backfill consistency investigation: all three converge on the
//  * same function and queue, so live and historical processing cannot drift
//  * apart into two implementations.
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
//  * Awaitable entrypoint used by scripts/backfillExtraction.js for
//  * assessments that have NO ExtractedBehaviorFeature document yet at all
//  * (full extraction, not an incremental upgrade). Same `_processAssessment`
//  * function, same shared `jobQueue` as live traffic.
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

// /**
//  * Awaitable entrypoint used by scripts/backfillExtraction.js for
//  * assessments that DO already have a `completed` ExtractedBehaviorFeature
//  * document, but one that's missing fields introduced in a later pipeline
//  * version (see config/featureSchema.js). Runs the full analyzer pass
//  * (recomputing everything is unavoidable — old and new metrics come out of
//  * the same MediaPipe per-frame loop, so there's no cheaper "only compute
//  * the new fields" mode), then merges the result with the existing document
//  * giving the EXISTING value priority wherever it's already present. This
//  * is what makes the upgrade "preserve existing features, only fill in
//  * what's missing" rather than silently changing previously-exported
//  * baseline numbers.
//  *
//  * @param {{assessmentId:string, userId:string, sessionId:string, assessmentType:string}} ctx
//  * @returns {Promise<{skipped:boolean, doc?:object}>}
//  */
// async function enqueueIncrementalUpgrade(ctx) {
//   const { assessmentId } = ctx;

//   const doc = await jobQueue.enqueue(
//     () => _processAssessment(ctx, { mergeWithExisting: true }),
//     { label: `upgrade:${assessmentId}` }
//   );

//   return { skipped: false, doc };
// }

// function _mergePreferExisting(freshObj, existingObj) {
//   const merged = { ...(freshObj || {}) };
//   if (!existingObj) return merged;
//   for (const [key, value] of Object.entries(existingObj)) {
//     if (value !== null && value !== undefined) merged[key] = value;
//   }
//   return merged;
// }

// async function _processAssessment(ctx, opts = {}) {
//   const { assessmentId, userId, sessionId, assessmentType } = ctx;
//   const { mergeWithExisting = false } = opts;

//   // Per-stage logging — added in response to the live/backfill consistency
//   // investigation, which found failures were only logged as a single
//   // summary line with no visibility into which stage broke.
//   const log = (stage, status, extra = "") =>
//     console.log(
//       `[extract:${assessmentId}] ${stage}: ${status}${extra ? " — " + extra : ""}`
//     );

//   log("Assessment", mergeWithExisting ? "starting incremental upgrade" : "starting full extraction");

//   let priorDoc = null;
//   if (mergeWithExisting) {
//     priorDoc = await ExtractedBehaviorFeature.findOne({ assessmentId }).lean();
//   }

//   await ExtractedBehaviorFeature.updateOne(
//     { assessmentId },
//     { $set: { status: "processing" }, $inc: { attempts: 1 } }
//   );

//   const media = await Media.findOne({ assessmentId });
//   if (!media) {
//     log("Media lookup", "✘ FAILED", "no Media document found");
//     throw new Error(`No Media document found for assessmentId=${assessmentId}`);
//   }

//   const camUrl = media.cameraRecording && media.cameraRecording.url;
//   const screenUrl = media.screenRecording && media.screenRecording.url;

//   if (!camUrl && !screenUrl) {
//     log("Media lookup", "✘ FAILED", "neither camera nor screen recording present");
//     throw new Error(`Media document for ${assessmentId} has neither camera nor screen recording`);
//   }

//   let camPath, screenPath;
//   try {
//     log("Downloading webcam recording", camUrl ? "starting" : "skipped (no URL)");
//     log("Downloading screen recording", screenUrl ? "starting" : "skipped (no URL)");

//     [camPath, screenPath] = await Promise.all([
//       camUrl ? downloadVideo(camUrl, `${assessmentId}-webcam`) : Promise.resolve(null),
//       screenUrl ? downloadVideo(screenUrl, `${assessmentId}-screen`) : Promise.resolve(null),
//     ]);
//     if (camUrl) log("Downloading webcam recording", "✓ success");
//     if (screenUrl) log("Downloading screen recording", "✓ success");

//     log("Running webcam analyzer", camPath ? "starting" : "skipped (no recording)");
//     log("Running screen analyzer", screenPath ? "starting" : "skipped (no recording)");

//     const [webcamResult, screenResult] = await Promise.all([
//       camPath ? runExtraction(camPath, "webcam") : Promise.resolve(null),
//       screenPath ? runExtraction(screenPath, "screen") : Promise.resolve(null),
//     ]);

//     if (camPath) log("Running webcam analyzer", "✓ success");
//     if (screenPath) log("Running screen analyzer", "✓ success");
//     log("Parsing Python output", "✓ success");

//     let webcamFeatures = webcamResult ? _stripDiagnostics(webcamResult) : undefined;
//     let screenFeatures = screenResult ? _stripDiagnostics(screenResult) : undefined;

//     if (mergeWithExisting) {
//       webcamFeatures = _mergePreferExisting(webcamFeatures, priorDoc && priorDoc.webcamFeatures);
//       screenFeatures = _mergePreferExisting(screenFeatures, priorDoc && priorDoc.screenFeatures);
//       log("Merging with existing document", "✓ success", "existing values preserved, only missing fields filled");
//     }

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
//           "metadata.modelVersion": CURRENT_MODEL_VERSION,
//           "metadata.webcamDiagnostics": webcamResult ? webcamResult._diagnostics : undefined,
//           "metadata.screenDiagnostics": screenResult ? screenResult._diagnostics : undefined,
//         },
//       },
//       { new: true, upsert: true }
//     );

//     log("Saving features to MongoDB", "✓ success");
//     return doc;
//   } catch (err) {
//     log("Pipeline", "✘ FAILED", err.message);
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
//   if (!featureObj) return featureObj;
//   const { _diagnostics, ...rest } = featureObj;
//   return rest;
// }

// module.exports = { enqueueExtraction, enqueueAndWait, enqueueIncrementalUpgrade };

const Media = require("../models/Media"); // adjust path to your existing Media model
const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
const { downloadVideo, cleanupFile } = require("./videoDownloader");
const { runExtraction } = require("./pythonBridge");
const jobQueue = require("../queue/jobQueue");
const { CURRENT_MODEL_VERSION } = require("../config/featureSchema");

/**
 * How long a document is allowed to sit at "pending"/"processing" before we
 * consider it abandoned (crashed worker, lost job, or — pre-fix — a job that
 * threw outside the try/catch and was never revisited) and therefore safe to
 * re-enqueue rather than treat as "already in flight, leave it alone."
 *
 * BUG FIX (v3): previously `enqueueExtraction` treated ANY existing
 * "pending"/"processing" document as a permanent no-op, with no time bound.
 * Combined with the try/catch scope bug below, that meant a stuck document
 * could never be healed by the live path — only `enqueueAndWait` (used
 * exclusively by scripts/backfillExtraction.js), whose guard only skips
 * "completed" docs, was ever willing to touch it again. This constant plus
 * `_isStale()` bring the live path's recovery behavior in line with backfill's.
 */
const STALE_PROCESSING_MS = 10 * 60 * 1000; // 10 minutes

/**
 * How many times (and how long to wait between attempts) to retry the
 * Media lookup before giving up. This exists because the frontend uploads
 * the camera/screen blobs and calls `/complete` in close succession with no
 * strict backend-enforced ordering guarantee — so on the very first live
 * attempt, immediately after assessment completion, the `Media` document
 * can occasionally not be written yet. Retrying a few times with a short
 * delay resolves the large majority of these transient races without
 * requiring a human to notice a "failed" status and re-trigger it manually.
 */
const MEDIA_LOOKUP_RETRIES = 4;
const MEDIA_LOOKUP_RETRY_DELAY_MS = 3000;

function _isStale(doc) {
  if (!doc) return true;
  const ts = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
  return Date.now() - ts > STALE_PROCESSING_MS;
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * v3 FIX: the idempotency guard below now also considers a "pending" /
 * "processing" document STALE (see STALE_PROCESSING_MS) and safe to
 * re-enqueue, rather than treating any non-"completed", non-"failed"
 * status as permanently off-limits. This is what makes the live path able
 * to self-heal a document that got stuck — previously only
 * `enqueueAndWait` (backfill) could ever touch such a document again.
 *
 * @param {{assessmentId:string, userId:string, sessionId:string, assessmentType:string}} ctx
 */
async function enqueueExtraction(ctx) {
  const { assessmentId } = ctx;

  const existing = await ExtractedBehaviorFeature.findOne({ assessmentId });
  if (existing) {
    if (existing.status === "completed") {
      return existing; // already done — no-op
    }
    if (["pending", "processing"].includes(existing.status) && !_isStale(existing)) {
      return existing; // genuinely in flight — don't double-enqueue
    }
    // Otherwise: status is "failed", or "pending"/"processing" but stale
    // (abandoned/crashed job) — fall through and re-enqueue.
    if (["pending", "processing"].includes(existing.status)) {
      console.warn(
        `[featureExtraction] ${assessmentId} was stuck at "${existing.status}" ` +
        `since ${existing.updatedAt} — re-enqueueing via live path.`
      );
    }
  }

  await _ensurePendingRecord(ctx);

  // Fire-and-forget into the queue; errors are caught and logged inside
  // _processAssessment itself (which always resolves the document's status
  // to "completed" or "failed" — see the v3 try/catch scope fix below).
  // This top-level .catch() is a last-resort safety net for anything that
  // somehow still escapes (e.g. a bug in the queue library itself), not the
  // primary error-handling path.
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

/**
 * Looks up the Media document, retrying a few times with a short delay if
 * it's not found yet. This is the primary defense against the transient
 * upload-race that used to leave documents stuck at "processing" (see the
 * module-level comment on MEDIA_LOOKUP_RETRIES). It does NOT swallow a
 * genuine "no media exists" case forever — after `retries` attempts it
 * simply returns null, and the caller (inside the try/catch below) turns
 * that into a proper `status: "failed"` with a descriptive `lastError`.
 */
async function _findMediaWithRetry(assessmentId, log) {
  for (let attempt = 1; attempt <= MEDIA_LOOKUP_RETRIES; attempt++) {
    const media = await Media.findOne({ assessmentId });
    if (media) {
      if (attempt > 1) {
        log("Media lookup", "✓ success", `on retry ${attempt}/${MEDIA_LOOKUP_RETRIES}`);
      }
      return media;
    }
    if (attempt < MEDIA_LOOKUP_RETRIES) {
      log(
        "Media lookup",
        "not found yet",
        `attempt ${attempt}/${MEDIA_LOOKUP_RETRIES}, retrying in ${MEDIA_LOOKUP_RETRY_DELAY_MS}ms`
      );
      await _sleep(MEDIA_LOOKUP_RETRY_DELAY_MS);
    }
  }
  return null;
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

  // ────────────────────────────────────────────────────────────────────
  // v3 BUG FIX: everything from here down — including the Media lookup
  // and URL validation — is now INSIDE the try block. Previously these
  // two checks lived *before* `try`, so a missing/incomplete Media
  // document threw an error that was never caught here, never wrote
  // status:"failed", and simply propagated to enqueueExtraction's
  // dangling top-level `.catch()` (a console.error with no DB write).
  // That is what left documents stuck at "processing" forever. Now every
  // failure path — Media not found, no recording URLs, download failure,
  // analyzer failure, save failure — funnels through the same catch
  // block and always resolves the document's status one way or the other.
  // ────────────────────────────────────────────────────────────────────
  let camPath, screenPath;
  try {
    const media = await _findMediaWithRetry(assessmentId, log);
    if (!media) {
      log("Media lookup", "✘ FAILED", `no Media document found after ${MEDIA_LOOKUP_RETRIES} attempts`);
      throw new Error(
        `No Media document found for assessmentId=${assessmentId} after ${MEDIA_LOOKUP_RETRIES} attempts`
      );
    }

    const camUrl = media.cameraRecording && media.cameraRecording.url;
    const screenUrl = media.screenRecording && media.screenRecording.url;

    if (!camUrl && !screenUrl) {
      log("Media lookup", "✘ FAILED", "neither camera nor screen recording present");
      throw new Error(`Media document for ${assessmentId} has neither camera nor screen recording`);
    }
    log("Media lookup", "✓ success");

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
    log("Status → completed", "✓");
    return doc;
  } catch (err) {
    log("Pipeline", "✘ FAILED", err.message);
    await ExtractedBehaviorFeature.updateOne(
      { assessmentId },
      { $set: { status: "failed", lastError: err.message } }
    );
    log("Status → failed", "✓ (recorded, not left stuck at processing)");
    throw err; // let jobQueue's retry logic decide whether to retry
  } finally {
    cleanupFile(camPath);
    cleanupFile(screenPath);
  }
}
async function enqueueForceReprocess(ctx) {
  const { assessmentId } = ctx;

  await _ensurePendingRecord(ctx);

  const doc = await jobQueue.enqueue(
    () => _processAssessment(ctx, {
      mergeWithExisting: false
    }),
    {
      label: `force:${assessmentId}`
    }
  );

  return doc;
}

function _stripDiagnostics(featureObj) {
  if (!featureObj) return featureObj;
  const { _diagnostics, ...rest } = featureObj;
  return rest;
}

module.exports = { enqueueExtraction, enqueueAndWait, enqueueIncrementalUpgrade, enqueueForceReprocess };
