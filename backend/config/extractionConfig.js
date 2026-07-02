const path = require("path");

module.exports = {
  // Path to the python interpreter that has requirements.txt installed
  // (use a venv in production, e.g. /opt/abeis/venv/bin/python3)
  PYTHON_BIN: process.env.FEATURE_EXTRACTION_PYTHON_BIN || "python3",

  // Absolute path to python-worker/main.py
  WORKER_SCRIPT: process.env.FEATURE_EXTRACTION_WORKER_SCRIPT ||
    path.join(__dirname, "..", "python-worker", "main.py"),

  // Where downloaded videos are temporarily stored before/while processing
  TEMP_DIR: process.env.FEATURE_EXTRACTION_TEMP_DIR || "/tmp/abeis-extraction",

  // Kill the python subprocess if it runs longer than this (ms) — protects
  // against a corrupt video hanging a worker slot indefinitely.
  PROCESS_TIMEOUT_MS: parseInt(process.env.FEATURE_EXTRACTION_TIMEOUT_MS || "300000", 10), // 5 min

  // How many assessments to process concurrently. Each job spawns Python
  // subprocesses (separate OS processes), so this bounds CPU/memory use
  // rather than the Node event loop.
  QUEUE_CONCURRENCY: parseInt(process.env.FEATURE_EXTRACTION_CONCURRENCY || "2", 10),

  // Retry policy for transient failures (network blip on download, etc.)
  MAX_RETRIES: parseInt(process.env.FEATURE_EXTRACTION_MAX_RETRIES || "3", 10),
  RETRY_BACKOFF_MS: parseInt(process.env.FEATURE_EXTRACTION_RETRY_BACKOFF_MS || "5000", 10),

  MODEL_VERSION: "v1.0",
};
