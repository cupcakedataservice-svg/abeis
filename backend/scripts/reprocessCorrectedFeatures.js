require("dotenv").config();
const connectDB = require("../config/db"); // adjust path to your existing db connector
const mongoose = require("mongoose");

const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
const { enqueueForceReprocess } = require("../services/featureExtractionService");
const { CURRENT_MODEL_VERSION } = require("../config/featureSchema");

/**
 * WHY THIS SCRIPT EXISTS (and why `npm run backfill` alone is not enough):
 *
 * `npm run backfill` (scripts/backfillExtraction.js) treats any existing
 * non-null field value as trustworthy and only fills in fields that are
 * genuinely MISSING. That is exactly the right behavior when new fields
 * are added to the schema — but it is the WRONG behavior when an existing
 * field's *formula* has been corrected, because the old (wrong) value is
 * not missing, it's just wrong, so the merge-prefer-existing logic would
 * silently keep it forever.
 *
 * This audit pass corrected three already-populated fields without adding
 * or removing any field names:
 *   - webcamFeatures.blinkRate / blinkCount / averageBlinkDuration /
 *     maximumBlinkDuration / blinkIntervalVariance / eyeClosureRate
 *     (blink timing is now computed in real time, not fixed frame counts)
 *   - webcamFeatures.faceBoundingBox / averageFaceSize /
 *     averageFacePosition / averageFaceConfidence
 *     (now derived from the Face Detection box matched to the actively
 *     tracked primary face, instead of "highest-confidence detection
 *     this frame" — matters most for recordings with more than one
 *     person in frame)
 *   - screenFeatures.scrollSpeed
 *     (now measured only from frames actually classified as scrolling)
 *
 * Every completed document processed before this fix has some or all of
 * these fields populated with the OLD, less accurate values — and because
 * they're populated (non-null), `npm run backfill` will never touch them.
 * This script forces a full, unmerged recompute for exactly those
 * documents, identified by `metadata.modelVersion` predating the current
 * corrected version.
 *
 * Safe to interrupt and re-run: only documents whose modelVersion is
 * still behind CURRENT_MODEL_VERSION are picked up, so anything already
 * reprocessed by a prior (possibly interrupted) run is skipped on retry —
 * same resumability guarantee as the regular backfill script.
 */
async function run() {
  console.log("====================================");
  console.log("ABEIS Corrected-Feature Reprocessing");
  console.log("====================================\n");
  console.log(`Target model version: ${CURRENT_MODEL_VERSION}\n`);

  await connectDB();

  const staleDocs = await ExtractedBehaviorFeature.find({
    status: "completed",
    "metadata.modelVersion": { $ne: CURRENT_MODEL_VERSION },
  })
    .select("assessmentId userId sessionId assessmentType metadata")
    .lean();

  console.log(`Found ${staleDocs.length} completed document(s) computed with a pre-fix formula.\n`);

  if (staleDocs.length === 0) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  let done = 0;
  let failed = 0;
  const total = staleDocs.length;

  for (const [i, doc] of staleDocs.entries()) {
    const index = i + 1;
    const ctx = {
      assessmentId: doc.assessmentId,
      userId: doc.userId,
      sessionId: doc.sessionId,
      assessmentType: doc.assessmentType,
    };
    const priorVersion = (doc.metadata && doc.metadata.modelVersion) || "unknown";

    try {
      console.log(`[${index}/${total}] Reprocessing ${doc.assessmentId} (was ${priorVersion})...`);
      await enqueueForceReprocess(ctx);
      console.log("✔ Done\n");
      done += 1;
    } catch (err) {
      console.log(`✘ Failed: ${err.message}\n`);
      failed += 1;
    }
  }

  console.log("====================================");
  console.log("Finished");
  console.log("====================================");
  console.log(`Reprocessed : ${done}`);
  console.log(`Failed      : ${failed}\n`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Reprocess script crashed:", err);
  process.exit(1);
});
