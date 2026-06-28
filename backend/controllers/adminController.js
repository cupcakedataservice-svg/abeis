const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { Parser } = require("json2csv");
const { JWT_SECRET } = require("../middleware/adminAuth");
const User = require("../models/User");
const Assessment = require("../models/Assessment");
const BehavioralFeature = require("../models/BehavioralFeature");
const AssessmentResponse = require("../models/AssessmentResponse");
const Media = require("../models/Media");
const Baseline = require("../models/Baseline");
const Consent = require("../models/Consent");
const {
  cleanupMediaForFilter,
  buildWarningMessage,
} = require("../services/mediaCleanupService");

// ─── Auth ──────────────────────────────────────────────────────────────────────

// POST /api/admin/login
const adminLogin = asyncHandler(async (req, res) => {
  const { adminId, password } = req.body;
  const expectedId = process.env.ADMIN_ID;
  const expectedPw = process.env.ADMIN_PASSWORD;

  if (!expectedId || !expectedPw) {
    res.status(500);
    throw new Error("Admin credentials are not configured on the server.");
  }

  if (adminId !== expectedId || password !== expectedPw) {
    res.status(401);
    throw new Error("Invalid Admin ID or Password.");
  }

  const token = jwt.sign({ adminId }, JWT_SECRET, { expiresIn: "8h" });

  console.log(`[ADMIN_LOGIN] adminId=${adminId} ip=${req.ip} ts=${new Date().toISOString()}`);

  res.json({ token, adminId });
});

// POST /api/admin/logout  (client just discards the token; we log it server-side)
const adminLogout = asyncHandler(async (req, res) => {
  console.log(`[ADMIN_LOGOUT] adminId=${req.admin?.adminId} ip=${req.ip} ts=${new Date().toISOString()}`);
  res.json({ message: "Logged out successfully." });
});

// GET /api/admin/profile
const adminProfile = asyncHandler(async (req, res) => {
  res.json({ adminId: req.admin.adminId });
});

// ─── Overview ──────────────────────────────────────────────────────────────────

// GET /api/admin/overview
const getOverview = asyncHandler(async (req, res) => {
  const [userCount, assessmentCount, completedCount] = await Promise.all([
    User.countDocuments(),
    Assessment.countDocuments(),
    Assessment.countDocuments({ status: "completed" }),
  ]);

  const byType = await Assessment.aggregate([
    { $group: { _id: "$assessmentType", count: { $sum: 1 } } },
  ]);

  res.json({ userCount, assessmentCount, completedCount, byType });
});

// ─── User listing ─────────────────────────────────────────────────────────────

// GET /api/admin/users
const getUsersWithSummary = asyncHandler(async (req, res) => {
  const { search, assessmentType, calibration, finalAssessment, dateFrom, dateTo } = req.query;

  const userFilter = {};
  if (search) {
    userFilter.$or = [
      { email: { $regex: search, $options: "i" } },
      { userId: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(userFilter).sort({ createdAt: -1 }).lean();

  const results = await Promise.all(
    users.map(async (user) => {
      const assessmentFilter = { userId: user.userId };
      if (assessmentType) assessmentFilter.assessmentType = assessmentType;
      if (dateFrom || dateTo) {
        assessmentFilter.startedAt = {};
        if (dateFrom) assessmentFilter.startedAt.$gte = new Date(dateFrom);
        if (dateTo) assessmentFilter.startedAt.$lte = new Date(dateTo);
      }

      const assessments = await Assessment.find(assessmentFilter).sort({ startedAt: -1 }).lean();
      const baseline = await Baseline.findOne({ userId: user.userId }).lean();

      const hasCalibration = assessments.some((a) => a.assessmentType === "calibration" && a.status === "completed");
      const hasFinal = assessments.some((a) => a.assessmentType === "final" && a.status === "completed");

      // Filter rows by calibration/finalAssessment flags if provided
      if (calibration === "yes" && !hasCalibration) return null;
      if (calibration === "no" && hasCalibration) return null;
      if (finalAssessment === "yes" && !hasFinal) return null;
      if (finalAssessment === "no" && hasFinal) return null;

      const lastAssessment = assessments[0];

      return {
        user,
        assessmentCount: assessments.length,
        assessments,
        baseline: baseline || null,
        hasCalibration,
        hasFinal,
        lastAssessmentDate: lastAssessment ? lastAssessment.startedAt : null,
      };
    })
  );

  res.json(results.filter(Boolean));
});

// GET /api/admin/users/:userId/details
const getUserDetails = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findOne({ userId });
  if (!user) { res.status(404); throw new Error("User not found"); }

  const [assessments, features, responses, media, baseline, consents] = await Promise.all([
    Assessment.find({ userId }).sort({ startedAt: -1 }),
    BehavioralFeature.find({ userId }),
    AssessmentResponse.find({ userId }),
    Media.find({ userId }),
    Baseline.findOne({ userId }),
    Consent.find({ userId }).sort({ consentTimestamp: -1 }),
  ]);

  res.json({ user, assessments, features, responses, media, baseline, consents });
});

// ─── Export ────────────────────────────────────────────────────────────────────

// GET /api/admin/export
const exportDataset = asyncHandler(async (req, res) => {
  const { format = "json", assessmentType } = req.query;
  const assessmentFilter = {};
  if (assessmentType) assessmentFilter.assessmentType = assessmentType;

  const assessments = await Assessment.find(assessmentFilter).sort({ startedAt: -1 }).lean();

  const rows = await Promise.all(
    assessments.map(async (a) => {
      const [user, feature, media] = await Promise.all([
        User.findOne({ userId: a.userId }).lean(),
        BehavioralFeature.findOne({ assessmentId: a.assessmentId }).lean(),
        Media.findOne({ assessmentId: a.assessmentId }).lean(),
      ]);
      return {
        userId: a.userId,
        name: user ? user.name : "",
        email: user ? user.email : "",
        assessmentId: a.assessmentId,
        sessionId: a.sessionId,
        assessmentType: a.assessmentType,
        status: a.status,
        startedAt: a.startedAt,
        endedAt: a.endedAt,
        durationSeconds: a.duration,
        cameraRecordingUrl: media?.cameraRecording?.url || "",
        screenRecordingUrl: media?.screenRecording?.url || "",
        featureVectorJSON: feature ? JSON.stringify(feature.featureVector) : "",
      };
    })
  );

  if (format === "csv") {
    const parser = new Parser();
    const csv = parser.parse(rows);
    res.header("Content-Type", "text/csv");
    res.attachment(`abeis_dataset_${Date.now()}.csv`);
    return res.send(csv);
  }

  res.header("Content-Type", "application/json");
  res.attachment(`abeis_dataset_${Date.now()}.json`);
  res.send(JSON.stringify(rows, null, 2));
});

// ─── Deletion helpers ─────────────────────────────────────────────────────────

/**
 * Deletes a single user's ImageKit media (if allowed) and, only if that
 * succeeds (or is explicitly configured to proceed anyway), all of their
 * MongoDB records.
 */
async function deleteUserById(userId) {
  const { canDeleteMongo, successes, failures } = await cleanupMediaForFilter({ userId });

  if (!canDeleteMongo) {
    return { skipped: true, successes, failures, counts: null };
  }

  const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
    Media.deleteMany({ userId }),
    BehavioralFeature.deleteMany({ userId }),
    AssessmentResponse.deleteMany({ userId }),
    Consent.deleteMany({ userId }),
    Baseline.deleteMany({ userId }),
    Assessment.deleteMany({ userId }),
    User.deleteOne({ userId }),
  ]);

  return {
    skipped: false,
    successes,
    failures,
    counts: {
      media: r1.deletedCount,
      behavioralFeatures: r2.deletedCount,
      responses: r3.deletedCount,
      consents: r4.deletedCount,
      baselines: r5.deletedCount,
      assessments: r6.deletedCount,
      user: r7.deletedCount,
    },
  };
}

// DELETE /api/admin/users/:userId
const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findOne({ userId });
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const result = await deleteUserById(userId);

  console.log(
    `[ADMIN_DELETE] adminId=${req.admin.adminId} userId=${userId} skipped=${result.skipped} ` +
      `failures=${result.failures.length} ip=${req.ip} ts=${new Date().toISOString()}`
  );

  if (result.skipped) {
    res.status(207); // partial: nothing was deleted because cloud cleanup failed
    return res.json({
      message:
        "Participant data was NOT deleted because one or more cloud media files could not be removed from ImageKit. " +
        "Resolve the ImageKit issue and try again, or enable DELETE_MONGO_ON_IMAGEKIT_FAILURE to force deletion anyway.",
      deleted: [],
      failures: result.failures,
    });
  }

  const message = `Participant data deleted successfully.${buildWarningMessage(result.failures)}`;

  res.json({
    message,
    deleted: [userId],
    counts: result.counts,
    failures: result.failures,
  });
});

// POST /api/admin/users/delete-selected
const deleteSelectedUsers = asyncHandler(async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400);
    throw new Error("userIds must be a non-empty array.");
  }

  const deleted = [];
  const skipped = [];
  const allFailures = [];
  const allCounts = {};

  for (const userId of userIds) {
    const exists = await User.findOne({ userId });
    if (!exists) continue;

    const result = await deleteUserById(userId);
    allFailures.push(...result.failures);

    if (result.skipped) {
      skipped.push(userId);
    } else {
      deleted.push(userId);
      allCounts[userId] = result.counts;
    }
  }

  console.log(
    `[ADMIN_DELETE_SELECTED] adminId=${req.admin.adminId} deleted=${deleted.join(",")} ` +
      `skipped=${skipped.join(",")} failures=${allFailures.length} ip=${req.ip} ts=${new Date().toISOString()}`
  );

  let message = `${deleted.length} participant(s) and all associated behavioral data have been permanently deleted.`;
  if (skipped.length) {
    message += ` ${skipped.length} participant(s) were NOT deleted because their cloud media files could not be removed from ImageKit.`;
  }
  message += buildWarningMessage(allFailures);

  res.json({ message, deleted, skipped, counts: allCounts, failures: allFailures });
});

// POST /api/admin/clear-all
const clearAllData = asyncHandler(async (req, res) => {
  const { confirmation } = req.body;
  if (confirmation !== "DELETE ALL DATA") {
    res.status(400);
    throw new Error('Confirmation text must be exactly "DELETE ALL DATA".');
  }

  const { canDeleteMongo, failures } = await cleanupMediaForFilter({});

  if (!canDeleteMongo) {
    console.log(
      `[ADMIN_CLEAR_ALL] adminId=${req.admin.adminId} aborted=true failures=${failures.length} ` +
        `ip=${req.ip} ts=${new Date().toISOString()}`
    );
    res.status(207);
    return res.json({
      message:
        "Dataset was NOT cleared because one or more cloud media files could not be removed from ImageKit. " +
        "Resolve the ImageKit issue and try again, or enable DELETE_MONGO_ON_IMAGEKIT_FAILURE to force deletion anyway.",
      failures,
    });
  }

  const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
    Media.deleteMany({}),
    BehavioralFeature.deleteMany({}),
    AssessmentResponse.deleteMany({}),
    Consent.deleteMany({}),
    Baseline.deleteMany({}),
    Assessment.deleteMany({}),
    User.deleteMany({}),
  ]);

  console.log(
    `[ADMIN_CLEAR_ALL] adminId=${req.admin.adminId} ip=${req.ip} ts=${new Date().toISOString()} ` +
      `users=${r7.deletedCount} assessments=${r6.deletedCount} failures=${failures.length}`
  );

  const message = `All participant data has been permanently deleted from MongoDB and ImageKit.${buildWarningMessage(
    failures
  )}`;

  res.json({
    message,
    counts: {
      users: r7.deletedCount,
      assessments: r6.deletedCount,
      baselines: r5.deletedCount,
      consents: r4.deletedCount,
      responses: r3.deletedCount,
      behavioralFeatures: r2.deletedCount,
      media: r1.deletedCount,
    },
    failures,
  });
});

module.exports = {
  adminLogin,
  adminLogout,
  adminProfile,
  getOverview,
  getUsersWithSummary,
  getUserDetails,
  exportDataset,
  deleteUser,
  deleteSelectedUsers,
  clearAllData,
};
