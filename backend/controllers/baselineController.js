const asyncHandler = require("express-async-handler");
const Baseline = require("../models/Baseline");

// GET /api/baselines/:userId
const getBaselineForUser = asyncHandler(async (req, res) => {
  const baseline = await Baseline.findOne({ userId: req.params.userId });
  if (!baseline) {
    res.status(404);
    throw new Error("No baseline found for this user yet");
  }
  res.json(baseline);
});

module.exports = { getBaselineForUser };
