// const asyncHandler = require("express-async-handler");
// const Assessment = require("../models/Assessment"); // adjust path to existing model
// const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
// const { enqueueExtraction } = require("../services/featureExtractionService");

// /**
//  * POST /api/extraction/:assessmentId/trigger
//  * Admin-triggered (re)processing of any assessment — e.g. to force a
//  * reprocess with ?force=true. Normal flow doesn't need this:
//  * completeAssessment triggers extraction automatically, and the backfill
//  * script (scripts/backfillExtraction.js) handles historical assessments.
//  */
// const triggerExtraction = asyncHandler(async (req, res) => {
//   const { assessmentId } = req.params;

//   const assessment = await Assessment.findOne({ assessmentId });
//   if (!assessment) {
//     res.status(404);
//     throw new Error(`No assessment found for id ${assessmentId}`);
//   }

//   // Allow force-reprocessing a failed/completed job via ?force=true
//   if (req.query.force === "true") {
//     await ExtractedBehaviorFeature.deleteOne({ assessmentId });
//   }

//   const result = await enqueueExtraction({
//     assessmentId: assessment.assessmentId,
//     userId: assessment.userId,
//     sessionId: assessment.sessionId,
//     assessmentType: assessment.assessmentType,
//   });

//   res.status(202).json({ message: "Extraction enqueued", ...result });
// });

// /**
//  * POST /api/extraction/:assessmentId/retry
//  * Explicitly retries a job that ended in "failed" status (or is stuck in
//  * "pending" from a crashed process). Distinct from /trigger: this is the
//  * "something went wrong, try again" action surfaced in the admin UI,
//  * whereas /trigger?force=true is "reprocess this even though it already
//  * succeeded". Both ultimately call the same enqueueExtraction().
//  */
// const retryExtraction = asyncHandler(async (req, res) => {
//   const { assessmentId } = req.params;

//   const doc = await ExtractedBehaviorFeature.findOne({ assessmentId });
//   if (!doc) {
//     res.status(404);
//     throw new Error("No extraction record found for this assessment — use /trigger instead");
//   }
//   if (doc.status === "processing") {
//     res.status(409);
//     throw new Error("Extraction is already in progress for this assessment");
//   }

//   const assessment = await Assessment.findOne({ assessmentId });
//   if (!assessment) {
//     res.status(404);
//     throw new Error(`No assessment found for id ${assessmentId}`);
//   }

//   await ExtractedBehaviorFeature.updateOne(
//     { assessmentId },
//     { $set: { status: "pending", lastError: null } }
//   );

//   const result = await enqueueExtraction({
//     assessmentId: assessment.assessmentId,
//     userId: assessment.userId,
//     sessionId: assessment.sessionId,
//     assessmentType: assessment.assessmentType,
//   });

//   res.status(202).json({ message: "Retry enqueued", ...result });
// });

// /**
//  * GET /api/extraction/admin/overview
//  * Dashboard summary: how much of the completed-assessment backlog has been
//  * extracted, broken down by status and assessment type. Useful both for
//  * monitoring live traffic and for watching a backfill run progress.
//  */
// const getOverview = asyncHandler(async (req, res) => {
//   const [statusCounts, typeCounts, extractedTotal, completedAssessments] = await Promise.all([
//     ExtractedBehaviorFeature.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
//     ExtractedBehaviorFeature.aggregate([{ $group: { _id: "$assessmentType", count: { $sum: 1 } } }]),
//     ExtractedBehaviorFeature.countDocuments(),
//     Assessment.countDocuments({ status: "completed" }),
//   ]);

//   const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
//   const byAssessmentType = Object.fromEntries(typeCounts.map((s) => [s._id, s.count]));

//   res.json({
//     totalCompletedAssessments: completedAssessments,
//     totalExtractionRecords: extractedTotal,
//     notYetQueued: Math.max(completedAssessments - extractedTotal, 0),
//     byStatus: {
//       pending: byStatus.pending || 0,
//       processing: byStatus.processing || 0,
//       completed: byStatus.completed || 0,
//       failed: byStatus.failed || 0,
//     },
//     byAssessmentType,
//   });
// });

// /**
//  * GET /api/feature-extraction/:assessmentId/status
//  */
// const getStatus = asyncHandler(async (req, res) => {
//   const doc = await ExtractedBehaviorFeature.findOne(
//     { assessmentId: req.params.assessmentId },
//     "assessmentId status attempts lastError metadata.processedAt"
//   );
//   if (!doc) {
//     res.status(404);
//     throw new Error("No extraction job found for this assessment");
//   }
//   res.json(doc);
// });

// /**
//  * GET /api/feature-extraction/:assessmentId
//  * Full extracted feature vector.
//  */
// const getFeatures = asyncHandler(async (req, res) => {
//   const doc = await ExtractedBehaviorFeature.findOne({ assessmentId: req.params.assessmentId });
//   if (!doc || doc.status !== "completed") {
//     res.status(404);
//     throw new Error("Extracted features not available for this assessment");
//   }
//   res.json(doc);
// });

// /**
//  * GET /api/feature-extraction/user/:userId
//  * All completed extractions for a participant (for longitudinal comparison).
//  */
// const getFeaturesForUser = asyncHandler(async (req, res) => {
//   const docs = await ExtractedBehaviorFeature.find({
//     userId: req.params.userId,
//     status: "completed",
//   }).sort({ createdAt: -1 });
//   res.json(docs);
// });

// module.exports = {
//   triggerExtraction,
//   retryExtraction,
//   getStatus,
//   getOverview,
//   getFeatures,
//   getFeaturesForUser,
// };

const asyncHandler = require("express-async-handler");
const Assessment = require("../models/Assessment"); // adjust path to existing model
const ExtractedBehaviorFeature = require("../models/ExtractedBehaviorFeature");
const { enqueueExtraction } = require("../services/featureExtractionService");

/**
 * POST /api/extraction/:assessmentId/trigger
 * Admin-triggered (re)processing of any assessment — e.g. to force a
 * reprocess with ?force=true. Normal flow doesn't need this:
 * completeAssessment triggers extraction automatically, and the backfill
 * script (scripts/backfillExtraction.js) handles historical assessments.
 */
const triggerExtraction = asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;

  const assessment = await Assessment.findOne({ assessmentId });
  if (!assessment) {
    res.status(404);
    throw new Error(`No assessment found for id ${assessmentId}`);
  }

  // Allow force-reprocessing a failed/completed job via ?force=true
  if (req.query.force === "true") {
    await ExtractedBehaviorFeature.deleteOne({ assessmentId });
  }

  const result = await enqueueExtraction({
    assessmentId: assessment.assessmentId,
    userId: assessment.userId,
    sessionId: assessment.sessionId,
    assessmentType: assessment.assessmentType,
  });

  res.status(202).json({ message: "Extraction enqueued", ...result });
});

/**
 * POST /api/extraction/:assessmentId/retry
 * Explicitly retries a job that ended in "failed" status (or is stuck in
 * "pending" from a crashed process). Distinct from /trigger: this is the
 * "something went wrong, try again" action surfaced in the admin UI,
 * whereas /trigger?force=true is "reprocess this even though it already
 * succeeded". Both ultimately call the same enqueueExtraction().
 */
const retryExtraction = asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;

  const doc = await ExtractedBehaviorFeature.findOne({ assessmentId });
  if (!doc) {
    res.status(404);
    throw new Error("No extraction record found for this assessment — use /trigger instead");
  }
  if (doc.status === "processing") {
    res.status(409);
    throw new Error("Extraction is already in progress for this assessment");
  }

  const assessment = await Assessment.findOne({ assessmentId });
  if (!assessment) {
    res.status(404);
    throw new Error(`No assessment found for id ${assessmentId}`);
  }

  await ExtractedBehaviorFeature.updateOne(
    { assessmentId },
    { $set: { status: "pending", lastError: null } }
  );

  const result = await enqueueExtraction({
    assessmentId: assessment.assessmentId,
    userId: assessment.userId,
    sessionId: assessment.sessionId,
    assessmentType: assessment.assessmentType,
  });

  res.status(202).json({ message: "Retry enqueued", ...result });
});

/**
 * GET /api/extraction/admin/overview
 * Dashboard summary: how much of the completed-assessment backlog has been
 * extracted, broken down by status and assessment type. Useful both for
 * monitoring live traffic and for watching a backfill run progress.
 */
const getOverview = asyncHandler(async (req, res) => {
  const [statusCounts, typeCounts, extractedTotal, completedAssessments] = await Promise.all([
    ExtractedBehaviorFeature.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ExtractedBehaviorFeature.aggregate([{ $group: { _id: "$assessmentType", count: { $sum: 1 } } }]),
    ExtractedBehaviorFeature.countDocuments(),
    Assessment.countDocuments({ status: "completed" }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
  const byAssessmentType = Object.fromEntries(typeCounts.map((s) => [s._id, s.count]));

  res.json({
    totalCompletedAssessments: completedAssessments,
    totalExtractionRecords: extractedTotal,
    notYetQueued: Math.max(completedAssessments - extractedTotal, 0),
    byStatus: {
      pending: byStatus.pending || 0,
      processing: byStatus.processing || 0,
      completed: byStatus.completed || 0,
      failed: byStatus.failed || 0,
    },
    byAssessmentType,
  });
});

/**
 * GET /api/feature-extraction/:assessmentId/status
 */
const getStatus = asyncHandler(async (req, res) => {
  const doc = await ExtractedBehaviorFeature.findOne(
    { assessmentId: req.params.assessmentId },
    "assessmentId status attempts lastError metadata.processedAt"
  );
  if (!doc) {
    res.status(404);
    throw new Error("No extraction job found for this assessment");
  }
  res.json(doc);
});

/**
 * GET /api/feature-extraction/:assessmentId
 * Full extracted feature vector.
 */
const getFeatures = asyncHandler(async (req, res) => {
  const doc = await ExtractedBehaviorFeature.findOne({ assessmentId: req.params.assessmentId });
  if (!doc || doc.status !== "completed") {
    res.status(404);
    throw new Error("Extracted features not available for this assessment");
  }
  res.json(doc);
});

/**
 * GET /api/feature-extraction/user/:userId
 * All completed extractions for a participant (for longitudinal comparison).
 */
const getFeaturesForUser = asyncHandler(async (req, res) => {
  const docs = await ExtractedBehaviorFeature.find({
    userId: req.params.userId,
    status: "completed",
  }).sort({ createdAt: -1 });
  res.json(docs);
});

module.exports = {
  triggerExtraction,
  retryExtraction,
  getStatus,
  getOverview,
  getFeatures,
  getFeaturesForUser,
};
