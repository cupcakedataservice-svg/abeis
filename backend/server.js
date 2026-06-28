require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const userRoutes = require("./routes/userRoutes");
const consentRoutes = require("./routes/consentRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const responseRoutes = require("./routes/responseRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const baselineRoutes = require("./routes/baselineRoutes");
const adminRoutes = require("./routes/adminRoutes");

connectDB();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Basic rate limiting to protect against abuse (tune per deployment needs).
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use("/api", limiter);

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date() }));

app.use("/api/users", userRoutes);
app.use("/api/consent", consentRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/responses", responseRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/baselines", baselineRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`ABEIS backend running on port ${PORT}`));
