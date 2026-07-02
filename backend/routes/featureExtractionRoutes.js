const express = require("express");
const router = express.Router();

const {
  triggerExtraction,
  retryExtraction,
  getStatus,
  getOverview,
  getFeatures,
  getFeaturesForUser,
} = require("../controllers/featureExtractionController");

// Reuse the existing admin JWT middleware — extracted behavioral features
// are sensitive (derived from face video) and should be admin/researcher-only,
// same as the rest of the Admin Dashboard data.
const { adminAuth } = require("../middleware/adminAuth"); // adjust path

router.use(adminAuth);

// NOTE ON ORDERING: Express matches routes top-to-bottom, and "/:assessmentId"
// would otherwise swallow "/admin/overview" and "/user/:userId" (treating
// "admin"/"user" as an assessmentId). Specific paths must stay above it.
router.get("/admin/overview", getOverview);
router.get("/user/:userId", getFeaturesForUser);

router.get("/:assessmentId/status", getStatus);
router.post("/:assessmentId/trigger", triggerExtraction);
router.post("/:assessmentId/retry", retryExtraction);
router.get("/:assessmentId", getFeatures);

module.exports = router;
