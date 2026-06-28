const asyncHandler = require("express-async-handler");
const AssessmentResponse = require("../models/AssessmentResponse");

// POST /api/responses
// Upserts the response document for a given assessment (one document per assessment).
// Body: { assessmentId, userId, sessionId, assessmentType, mcqResponses?, codingResponses?, typingResponses? }
const saveResponses = asyncHandler(async (req, res) => {
  const { assessmentId, userId, sessionId, assessmentType, mcqResponses, codingResponses, typingResponses } =
    req.body;

  if (!assessmentId || !userId || !sessionId || !assessmentType) {
    res.status(400);
    throw new Error("assessmentId, userId, sessionId and assessmentType are required");
  }

  const update = { userId, sessionId, assessmentType };
  if (mcqResponses) update.mcqResponses = mcqResponses;
  if (codingResponses) update.codingResponses = codingResponses;
  if (typingResponses) update.typingResponses = typingResponses;

  const response = await AssessmentResponse.findOneAndUpdate(
    { assessmentId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json(response);
});

// GET /api/responses/:assessmentId
const getResponses = asyncHandler(async (req, res) => {
  const response = await AssessmentResponse.findOne({ assessmentId: req.params.assessmentId });
  if (!response) {
    res.status(404);
    throw new Error("No responses found for this assessment");
  }
  res.json(response);
});

module.exports = { saveResponses, getResponses };
