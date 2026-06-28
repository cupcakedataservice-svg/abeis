const express = require("express");
const router = express.Router();
const { getBaselineForUser } = require("../controllers/baselineController");

router.get("/:userId", getBaselineForUser);

module.exports = router;
