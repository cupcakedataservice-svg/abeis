const asyncHandler = require("express-async-handler");
const User = require("../models/User");

// POST /api/users/register
// Registers a new participant, or returns the existing participant if the
// email is already registered (so returning users can resume / build on
// their baseline rather than getting a duplicate-key error).
const registerUser = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    res.status(400);
    throw new Error("Name and email are required");
  }

  const normalizedEmail = email.trim().toLowerCase();

  let user = await User.findOne({ email: normalizedEmail });
  if (user) {
    return res.status(200).json({ user, isReturningUser: true });
  }

  user = await User.create({ name: name.trim(), email: normalizedEmail });
  res.status(201).json({ user, isReturningUser: false });
});

// GET /api/users/:userId
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findOne({ userId: req.params.userId });
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  res.json(user);
});

// GET /api/users  (admin)
const listUsers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = {};
  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: "i" } },
      { userId: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json(users);
});

module.exports = { registerUser, getUserById, listUsers };
