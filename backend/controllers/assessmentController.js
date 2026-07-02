const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");
const Assessment = require("../models/Assessment");
const BehavioralFeature = require("../models/BehavioralFeature");
const AssessmentResponse = require("../models/AssessmentResponse");
const {
  enqueueExtraction
} = require("../services/featureExtractionService");
const Consent = require("../models/Consent");
const { updateBaselineAfterAssessment, compareAgainstBaseline } = require("../services/baselineService");

// POST /api/assessments/start
const startAssessment = asyncHandler(async (req, res) => {
  const { userId, assessmentType, consentId, meta } = req.body;

  if (!userId || !assessmentType || !consentId) {
    res.status(400);
    throw new Error("userId, assessmentType and consentId are required");
  }

  const consent = await Consent.findOne({ consentId, userId });
  if (!consent || !consent.consentAccepted) {
    res.status(403);
    throw new Error("Valid consent is required before starting an assessment");
  }

  const sessionId = uuidv4();

  const assessment = await Assessment.create({
    userId,
    sessionId,
    assessmentType,
    consentId,
    meta: meta || {},
    startedAt: new Date(),
    status: "in_progress",
  });

  res.status(201).json(assessment);
});

// POST /api/assessments/:assessmentId/complete
// Body: { featureVector, rawEvents? }
// Marks assessment complete, stores BehavioralFeature, updates baseline,
// and returns deviation-from-baseline info (useful if this is a "final" check assessment).
const completeAssessment = asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;
  const { featureVector, rawEvents } = req.body;

  const assessment = await Assessment.findOne({ assessmentId });
  if (!assessment) {
    res.status(404);
    throw new Error("Assessment not found");
  }

  assessment.status = "completed";
  assessment.endedAt = new Date();
  assessment.duration = Math.round((assessment.endedAt - assessment.startedAt) / 1000);
  await assessment.save();

  let behavioralFeature = null;
  let deviation = null;

  if (featureVector) {
    behavioralFeature = await BehavioralFeature.create({
      assessmentId: assessment.assessmentId,
      userId: assessment.userId,
      sessionId: assessment.sessionId,
      assessmentType: assessment.assessmentType,
      featureVector,
      rawEvents: rawEvents || undefined,
    });

    deviation = await compareAgainstBaseline({
      userId: assessment.userId,
      assessmentType: assessment.assessmentType,
      featureVector,
    });

    await updateBaselineAfterAssessment({
      userId: assessment.userId,
      assessmentType: assessment.assessmentType,
      featureVector,
    });
  }

  // Start extraction in the background
  enqueueExtraction({
    assessmentId: assessment.assessmentId,
    userId: assessment.userId,
    sessionId: assessment.sessionId,
    assessmentType: assessment.assessmentType,
  }).catch((err) => {
    console.error(
      `[Feature Extraction] Failed to enqueue ${assessment.assessmentId}:`,
      err.message
    );
  });
  res.json({ assessment, behavioralFeature, deviation });
});

// GET /api/assessments/user/:userId
const getAssessmentsForUser = asyncHandler(async (req, res) => {
  const assessments = await Assessment.find({ userId: req.params.userId }).sort({ startedAt: -1 });
  res.json(assessments);
});

// GET /api/assessments/:assessmentId
const getAssessmentById = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOne({ assessmentId: req.params.assessmentId });
  if (!assessment) {
    res.status(404);
    throw new Error("Assessment not found");
  }
  const [feature, response] = await Promise.all([
    BehavioralFeature.findOne({ assessmentId: assessment.assessmentId }),
    AssessmentResponse.findOne({ assessmentId: assessment.assessmentId }),
  ]);
  res.json({ assessment, feature, response });
});

module.exports = {
  startAssessment,
  completeAssessment,
  getAssessmentsForUser,
  getAssessmentById,
};
