const express = require("express");
const multer = require("multer");
const router = express.Router();
const { uploadRecording, getMediaForAssessment } = require("../controllers/mediaController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

router.post("/upload", upload.single("file"), uploadRecording);
router.get("/:assessmentId", getMediaForAssessment);

module.exports = router;
