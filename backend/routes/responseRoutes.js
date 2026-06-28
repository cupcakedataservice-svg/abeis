const express = require("express");
const router = express.Router();
const { saveResponses, getResponses } = require("../controllers/responseController");

router.post("/", saveResponses);
router.get("/:assessmentId", getResponses);

module.exports = router;
