const express = require("express");
const router = express.Router();
const { registerUser, getUserById, listUsers } = require("../controllers/userController");

router.post("/register", registerUser);
router.get("/", listUsers);
router.get("/:userId", getUserById);

module.exports = router;
