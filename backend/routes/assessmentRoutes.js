const express = require("express");
const router = express.Router();
const {
  startAssessment,
  completeAssessment,
  getAssessmentsForUser,
  getAssessmentById,
} = require("../controllers/assessmentController");

router.post("/start", startAssessment);
router.post("/:assessmentId/complete", completeAssessment);
router.get("/user/:userId", getAssessmentsForUser);
router.get("/:assessmentId", getAssessmentById);

module.exports = router;
