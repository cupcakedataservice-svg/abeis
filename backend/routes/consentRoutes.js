const express = require("express");
const router = express.Router();
const { recordConsent, getConsent } = require("../controllers/consentController");

router.post("/", recordConsent);
router.get("/:consentId", getConsent);

module.exports = router;
