#!/usr/bin/env node
// /**
//  * ABEIS Historical Feature Extraction (Backfill)
//  *
//  * Processes every already-completed assessment's existing recordings
//  * through the SAME extraction pipeline used for live traffic
//  * (services/featureExtractionService.js -> the one shared jobQueue ->
//  * python-worker/main.py). No extraction logic is duplicated here — this
//  * script only decides *what* to enqueue and reports progress.
//  *
//  * Usage:
//  *   npm run backfill
//  *
//  * Resume: safe to re-run at any time, including after a crash. Assessments
//  * whose ExtractedBehaviorFeature.status is already "completed" are skipped;
//  * everything else (missing entirely, "pending", "processing" left over from
//  * a crash, or "failed") is (re)processed.
//  */

// require("dotenv").config();
// const connectDB = require("../config/db"); // adjust path to your existing db connector
// const mongoose = require("mongoose");

// const Assessment = require("../models/Assessment"); // adjust path
// const Media = require("../models/Media"); // adjust path
// const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
// const { enqueueAndWait } = require("../services/featureExtractionService");

// const BATCH_LOG_DIVIDER = "====================================";

// function logHeader(title) {
//   console.log(`\n${BATCH_LOG_DIVIDER}`);
//   console.log(title);
//   console.log(`${BATCH_LOG_DIVIDER}\n`);
// }

// async function run() {
//   logHeader("ABEIS Historical Extraction");

//   await connectDB();

//   const completedAssessments = await Assessment.find({ status: "completed" })
//     .select("assessmentId userId sessionId assessmentType")
//     .lean();

//   console.log(`Completed assessments found: ${completedAssessments.length}\n`);

//   if (completedAssessments.length === 0) {
//     console.log("Nothing to do.");
//     await mongoose.disconnect();
//     return;
//   }

//   // Pull existing extraction statuses in one query rather than one-by-one,
//   // so the "already processed?" check doesn't cost a round trip per row.
//   const existingDocs = await ExtractedBehaviorFeature.find(
//     { assessmentId: { $in: completedAssessments.map((a) => a.assessmentId) } },
//     "assessmentId status"
//   ).lean();
//   const statusByAssessmentId = new Map(existingDocs.map((d) => [d.assessmentId, d.status]));

//   // Media lookup, same batched approach, to catch "missing recordings" up
//   // front without spawning a worker for a doomed job.
//   const mediaDocs = await Media.find(
//     { assessmentId: { $in: completedAssessments.map((a) => a.assessmentId) } },
//     "assessmentId cameraRecording screenRecording"
//   ).lean();
//   const mediaByAssessmentId = new Map(mediaDocs.map((m) => [m.assessmentId, m]));

//   let processed = 0;
//   let skipped = 0;
//   let failed = 0;

//   const total = completedAssessments.length;

//   // enqueueAndWait() shares the same jobQueue used by live traffic, so this
//   // naturally respects QUEUE_CONCURRENCY — we don't need our own throttling.
//   const tasks = completedAssessments.map((assessment, i) => async () => {
//     const index = i + 1;
//     const { assessmentId } = assessment;
//     const currentStatus = statusByAssessmentId.get(assessmentId);

//     if (currentStatus === "completed") {
//       console.log(`[${index}/${total}] Already processed`);
//       console.log("Skipping\n");
//       skipped += 1;
//       return;
//     }

//     const media = mediaByAssessmentId.get(assessmentId);
//     const hasAnyRecording = media && (media.cameraRecording?.url || media.screenRecording?.url);
//     if (!hasAnyRecording) {
//       console.log(`[${index}/${total}] Missing recordings`);
//       console.log("Skipping\n");
//       skipped += 1;
//       return;
//     }

//     console.log(`[${index}/${total}] Processing assessment ${assessmentId}...`);
//     try {
//       const result = await enqueueAndWait({
//         assessmentId: assessment.assessmentId,
//         userId: assessment.userId,
//         sessionId: assessment.sessionId,
//         assessmentType: assessment.assessmentType,
//       });

//       if (result.skipped) {
//         console.log("Skipping (already completed)\n");
//         skipped += 1;
//       } else {
//         console.log("✔ Completed\n");
//         processed += 1;
//       }
//     } catch (err) {
//       console.log(`✘ Failed: ${err.message}\n`);
//       failed += 1;
//     }
//   });

//   // Kick every task off "at once" — enqueueAndWait's underlying jobQueue is
//   // what actually limits concurrency (default 2), so this doesn't overload
//   // the machine; it just lets the queue's own scheduler do the throttling
//   // instead of us reimplementing it here.
//   await Promise.all(tasks.map((task) => task()));

//   logHeader("Finished");
//   console.log(`Processed : ${processed}`);
//   console.log(`Skipped   : ${skipped}`);
//   console.log(`Failed    : ${failed}\n`);

//   await mongoose.disconnect();
//   process.exit(failed > 0 ? 1 : 0);
// }

// run().catch((err) => {
//   console.error("Backfill script crashed:", err);
//   process.exit(1);
// });

// #!/usr/bin / env node
/**
 * ABEIS Historical Feature Extraction (Backfill) — v2
 *
 * Processes every completed assessment's existing recordings through the
 * SAME extraction pipeline used for live traffic
 * (services/featureExtractionService.js -> the one shared jobQueue ->
 * python-worker/main.py). No extraction logic is duplicated here — this
 * script only decides *what* to enqueue (full extraction, incremental
 * upgrade, or skip) and reports progress.
 *
 * v2 change: previously this script only had two outcomes per assessment
 * (extract, or skip if already `status: "completed"`). Now that the
 * webcam/screen analyzers emit additional fields (see
 * config/featureSchema.js), a document can be `completed` from the v1
 * pipeline yet still be missing v2 fields — that case now gets an
 * INCREMENTAL UPGRADE: the analyzers run again, but existing field values
 * win over freshly computed ones during the merge (see
 * featureExtractionService.enqueueIncrementalUpgrade), so already-exported
 * baseline numbers never silently change — only genuinely missing fields
 * get filled in.
 *
 * Usage:
 *   npm run backfill
 *
 * Resume: safe to re-run at any time, including after a crash. Assessments
 * whose ExtractedBehaviorFeature already has every canonical field are
 * skipped; everything else (missing entirely, missing new fields, or left
 * "pending"/"processing"/"failed" from a crash) is (re)processed.
 */

require("dotenv").config();
const connectDB = require("../config/db"); // adjust path to your existing db connector
const mongoose = require("mongoose");

const Assessment = require("../models/Assessment"); // adjust path
const Media = require("../models/Media"); // adjust path
const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
const { enqueueAndWait, enqueueIncrementalUpgrade } = require("../services/featureExtractionService");
const { WEBCAM_FIELDS, SCREEN_FIELDS, isMissingFields } = require("../config/featureSchema");

const BATCH_LOG_DIVIDER = "====================================";

function logHeader(title) {
  console.log(`\n${BATCH_LOG_DIVIDER}`);
  console.log(title);
  console.log(`${BATCH_LOG_DIVIDER}\n`);
}

/**
 * Decides what (if anything) needs to happen for one assessment.
 * @returns {"skip-no-recordings" | "skip-up-to-date" | "full" | "upgrade"}
 */
function _decideAction(existingDoc, hasAnyRecording) {
  if (!hasAnyRecording) return "skip-no-recordings";

  if (!existingDoc) return "full";

  if (existingDoc.status !== "completed") {
    // Left over from a crash mid-processing, or a previously failed job —
    // not reliably complete either way, so (re)run full extraction.
    return "full";
  }

  const needsUpgrade =
    isMissingFields(existingDoc.webcamFeatures, WEBCAM_FIELDS) ||
    isMissingFields(existingDoc.screenFeatures, SCREEN_FIELDS);

  return needsUpgrade ? "upgrade" : "skip-up-to-date";
}

async function run() {
  logHeader("ABEIS Historical Extraction");

  await connectDB();

  const completedAssessments = await Assessment.find({ status: "completed" })
    .select("assessmentId userId sessionId assessmentType")
    .lean();

  console.log(`Completed assessments found: ${completedAssessments.length}\n`);

  if (completedAssessments.length === 0) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  // Batched lookups rather than one query per assessment.
  const existingDocs = await ExtractedBehaviorFeature.find({
    assessmentId: { $in: completedAssessments.map((a) => a.assessmentId) },
  }).lean();
  const extractionByAssessmentId = new Map(existingDocs.map((d) => [d.assessmentId, d]));

  const mediaDocs = await Media.find(
    { assessmentId: { $in: completedAssessments.map((a) => a.assessmentId) } },
    "assessmentId cameraRecording screenRecording"
  ).lean();
  const mediaByAssessmentId = new Map(mediaDocs.map((m) => [m.assessmentId, m]));

  let processed = 0;   // full extractions completed
  let upgraded = 0;     // incremental upgrades completed
  let skipped = 0;
  let failed = 0;

  const total = completedAssessments.length;

  const tasks = completedAssessments.map((assessment, i) => async () => {
    const index = i + 1;
    const { assessmentId } = assessment;

    const existingDoc = extractionByAssessmentId.get(assessmentId) || null;
    const media = mediaByAssessmentId.get(assessmentId);
    const hasAnyRecording = !!(media && (media.cameraRecording?.url || media.screenRecording?.url));

    const action = _decideAction(existingDoc, hasAnyRecording);

    if (action === "skip-no-recordings") {
      console.log(`[${index}/${total}] Missing recordings`);
      console.log("Skipping\n");
      skipped += 1;
      return;
    }

    if (action === "skip-up-to-date") {
      console.log(`[${index}/${total}] Already processed`);
      console.log("Skipping\n");
      skipped += 1;
      return;
    }

    const ctx = {
      assessmentId: assessment.assessmentId,
      userId: assessment.userId,
      sessionId: assessment.sessionId,
      assessmentType: assessment.assessmentType,
    };

    try {
      if (action === "full") {
        console.log(`[${index}/${total}] Processing assessment ${assessmentId}...`);
        const result = await enqueueAndWait(ctx);
        if (result.skipped) {
          console.log("Skipping (already completed)\n");
          skipped += 1;
        } else {
          console.log("✔ Completed\n");
          processed += 1;
        }
      } else {
        // action === "upgrade"
        console.log(`[${index}/${total}] Upgrading assessment ${assessmentId} (missing v2 fields)...`);
        await enqueueIncrementalUpgrade(ctx);
        console.log("✔ Upgraded\n");
        upgraded += 1;
      }
    } catch (err) {
      console.log(`✘ Failed: ${err.message}\n`);
      failed += 1;
    }
  });

  // enqueueAndWait/enqueueIncrementalUpgrade share jobQueue's own
  // concurrency limit (see config/extractionConfig.js), so dispatching all
  // tasks "at once" here doesn't overload the machine — the queue is what
  // actually throttles execution.
  await Promise.all(tasks.map((task) => task()));

  logHeader("Finished");
  console.log(`Processed (full)      : ${processed}`);
  console.log(`Upgraded (incremental) : ${upgraded}`);
  console.log(`Skipped                : ${skipped}`);
  console.log(`Failed                 : ${failed}\n`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Backfill script crashed:", err);
  process.exit(1);
});
