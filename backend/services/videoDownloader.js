// const fs = require("fs");
// const path = require("path");
// const crypto = require("crypto");
// const axios = require("axios");
// const { TEMP_DIR } = require("../config/extractionConfig");

// if (!fs.existsSync(TEMP_DIR)) {
//   fs.mkdirSync(TEMP_DIR, { recursive: true });
// }

// /**
//  * Streams a video from a remote URL (ImageKit, Cloudinary, S3 — anything
//  * that serves the raw file over HTTP) to a local temp file. Works
//  * regardless of which media provider issued the URL, since only a GET is
//  * required.
//  *
//  * @param {string} url - direct URL to the recording
//  * @param {string} label - used to build a readable, collision-safe filename
//  * @returns {Promise<string>} local file path
//  */
// async function downloadVideo(url, label) {
//   const ext = path.extname(new URL(url).pathname) || ".webm";
//   const fileName = `${label}-${crypto.randomUUID()}${ext}`;
//   const destPath = path.join(TEMP_DIR, fileName);

//   const response = await axios({
//     method: "GET",
//     url,
//     responseType: "stream",
//     timeout: 60000,
//   });

//   await new Promise((resolve, reject) => {
//     const writer = fs.createWriteStream(destPath);
//     response.data.pipe(writer);
//     writer.on("finish", resolve);
//     writer.on("error", reject);
//     response.data.on("error", reject);
//   });

//   return destPath;
// }

// function cleanupFile(filePath) {
//   if (!filePath) return;
//   fs.unlink(filePath, (err) => {
//     if (err && err.code !== "ENOENT") {
//       console.error(`[featureExtraction] failed to clean up temp file ${filePath}:`, err.message);
//     }
//   });
// }

// module.exports = { downloadVideo, cleanupFile };

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const { TEMP_DIR } = require("../config/extractionConfig");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Streams a video from a remote URL (ImageKit, Cloudinary, S3 — anything
 * that serves the raw file over HTTP) to a local temp file. Works
 * regardless of which media provider issued the URL, since only a GET is
 * required.
 *
 * @param {string} url - direct URL to the recording
 * @param {string} label - used to build a readable, collision-safe filename
 * @returns {Promise<string>} local file path
 */
async function downloadVideo(url, label) {
  const ext = path.extname(new URL(url).pathname) || ".webm";
  const fileName = `${label}-${crypto.randomUUID()}${ext}`;
  const destPath = path.join(TEMP_DIR, fileName);

  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
    timeout: 60000,
  });

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
    response.data.on("error", reject);
  });

  return destPath;
}

function cleanupFile(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error(`[featureExtraction] failed to clean up temp file ${filePath}:`, err.message);
    }
  });
}

module.exports = { downloadVideo, cleanupFile };
