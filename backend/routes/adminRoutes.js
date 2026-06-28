const express = require("express");
const router = express.Router();
const { adminAuth } = require("../middleware/adminAuth");
const {
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
} = require("../controllers/adminController");

// ─── Public (no auth) ─────────────────────────────────────────────────────────
router.post("/login", adminLogin);

// ─── Protected (require valid JWT) ────────────────────────────────────────────
router.use(adminAuth);

router.post("/logout", adminLogout);
router.get("/profile", adminProfile);

router.get("/overview", getOverview);
router.get("/users", getUsersWithSummary);
router.get("/users/:userId/details", getUserDetails);
router.get("/export", exportDataset);

router.delete("/users/:userId", deleteUser);
router.post("/users/delete-selected", deleteSelectedUsers);
router.post("/clear-all", clearAllData);

module.exports = router;
