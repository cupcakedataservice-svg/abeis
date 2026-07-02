#!/usr/bin/env node
/**
 * ABEIS Historical Feature Extraction (Backfill)
 *
 * Processes every already-completed assessment's existing recordings
 * through the SAME extraction pipeline used for live traffic
 * (services/featureExtractionService.js -> the one shared jobQueue ->
 * python-worker/main.py). No extraction logic is duplicated here — this
 * script only decides *what* to enqueue and reports progress.
 *
 * Usage:
 *   npm run backfill
 *
 * Resume: safe to re-run at any time, including after a crash. Assessments
 * whose ExtractedBehaviorFeature.status is already "completed" are skipped;
 * everything else (missing entirely, "pending", "processing" left over from
 * a crash, or "failed") is (re)processed.
 */

require("dotenv").config();
const connectDB = require("../config/db"); // adjust path to your existing db connector
const mongoose = require("mongoose");

const Assessment = require("../models/Assessment"); // adjust path
const Media = require("../models/Media"); // adjust path
const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
const { enqueueAndWait } = require("../services/featureExtractionService");

const BATCH_LOG_DIVIDER = "====================================";

function logHeader(title) {
  console.log(`\n${BATCH_LOG_DIVIDER}`);
  console.log(title);
  console.log(`${BATCH_LOG_DIVIDER}\n`);
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

  // Pull existing extraction statuses in one query rather than one-by-one,
  // so the "already processed?" check doesn't cost a round trip per row.
  const existingDocs = await ExtractedBehaviorFeature.find(
    { assessmentId: { $in: completedAssessments.map((a) => a.assessmentId) } },
    "assessmentId status"
  ).lean();
  const statusByAssessmentId = new Map(existingDocs.map((d) => [d.assessmentId, d.status]));

  // Media lookup, same batched approach, to catch "missing recordings" up
  // front without spawning a worker for a doomed job.
  const mediaDocs = await Media.find(
    { assessmentId: { $in: completedAssessments.map((a) => a.assessmentId) } },
    "assessmentId cameraRecording screenRecording"
  ).lean();
  const mediaByAssessmentId = new Map(mediaDocs.map((m) => [m.assessmentId, m]));

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  const total = completedAssessments.length;

  // enqueueAndWait() shares the same jobQueue used by live traffic, so this
  // naturally respects QUEUE_CONCURRENCY — we don't need our own throttling.
  const tasks = completedAssessments.map((assessment, i) => async () => {
    const index = i + 1;
    const { assessmentId } = assessment;
    const currentStatus = statusByAssessmentId.get(assessmentId);

    if (currentStatus === "completed") {
      console.log(`[${index}/${total}] Already processed`);
      console.log("Skipping\n");
      skipped += 1;
      return;
    }

    const media = mediaByAssessmentId.get(assessmentId);
    const hasAnyRecording = media && (media.cameraRecording?.url || media.screenRecording?.url);
    if (!hasAnyRecording) {
      console.log(`[${index}/${total}] Missing recordings`);
      console.log("Skipping\n");
      skipped += 1;
      return;
    }

    console.log(`[${index}/${total}] Processing assessment ${assessmentId}...`);
    try {
      const result = await enqueueAndWait({
        assessmentId: assessment.assessmentId,
        userId: assessment.userId,
        sessionId: assessment.sessionId,
        assessmentType: assessment.assessmentType,
      });

      if (result.skipped) {
        console.log("Skipping (already completed)\n");
        skipped += 1;
      } else {
        console.log("✔ Completed\n");
        processed += 1;
      }
    } catch (err) {
      console.log(`✘ Failed: ${err.message}\n`);
      failed += 1;
    }
  });

  // Kick every task off "at once" — enqueueAndWait's underlying jobQueue is
  // what actually limits concurrency (default 2), so this doesn't overload
  // the machine; it just lets the queue's own scheduler do the throttling
  // instead of us reimplementing it here.
  await Promise.all(tasks.map((task) => task()));

  logHeader("Finished");
  console.log(`Processed : ${processed}`);
  console.log(`Skipped   : ${skipped}`);
  console.log(`Failed    : ${failed}\n`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Backfill script crashed:", err);
  process.exit(1);
});
