const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "abeis-admin-secret-change-in-prod";

/**
 * Middleware: verify the admin JWT from the Authorization header.
 * Returns 401 for missing or invalid tokens.
 */
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401);
    return next(new Error("Unauthorized: no token provided"));
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded; // { adminId, iat, exp }
    next();
  } catch {
    res.status(401);
    next(new Error("Unauthorized: invalid or expired token"));
  }
}

module.exports = { adminAuth, JWT_SECRET };
