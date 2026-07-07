// const { spawn } = require("child_process");
// const { PYTHON_BIN, WORKER_SCRIPT, PROCESS_TIMEOUT_MS } = require("../config/extractionConfig");

// /**
//  * Runs python-worker/main.py against a local video file and resolves with
//  * the parsed feature object. Runs as a separate OS process, so a slow or
//  * CPU-heavy video never blocks Node's event loop.
//  *
//  * @param {string} videoPath - local path to the downloaded video
//  * @param {"webcam"|"screen"} type
//  * @returns {Promise<object>} extracted feature object
//  */
// function runExtraction(videoPath, type) {
//   return new Promise((resolve, reject) => {
//     const child = spawn(PYTHON_BIN, [WORKER_SCRIPT, "--video", videoPath, "--type", type], {
//       stdio: ["ignore", "pipe", "pipe"],
//     });

//     let stdout = "";
//     let stderr = "";
//     let settled = false;

//     const timer = setTimeout(() => {
//       if (!settled) {
//         settled = true;
//         child.kill("SIGKILL");
//         reject(new Error(`Extraction worker timed out after ${PROCESS_TIMEOUT_MS}ms (type=${type})`));
//       }
//     }, PROCESS_TIMEOUT_MS);

//     child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
//     child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

//     child.on("error", (err) => {
//       if (settled) return;
//       settled = true;
//       clearTimeout(timer);
//       reject(new Error(`Failed to spawn python worker: ${err.message}`));
//     });

//     child.on("close", (code) => {
//       if (settled) return;
//       settled = true;
//       clearTimeout(timer);

//       let parsed;
//       try {
//         // main.py prints exactly one JSON line to stdout as its contract
//         const lastLine = stdout.trim().split("\n").filter(Boolean).pop();
//         parsed = JSON.parse(lastLine);
//       } catch (parseErr) {
//         return reject(
//           new Error(`Worker output was not valid JSON (exit ${code}). stderr: ${stderr.slice(0, 1000)}`)
//         );
//       }

//       if (!parsed.ok) {
//         return reject(new Error(`Worker reported failure: ${parsed.error || "unknown error"}`));
//       }

//       resolve(parsed.features);
//     });
//   });
// }

// module.exports = { runExtraction };

const { spawn } = require("child_process");
const { PYTHON_BIN, WORKER_SCRIPT, PROCESS_TIMEOUT_MS } = require("../config/extractionConfig");

/**
 * Runs python-worker/main.py against a local video file and resolves with
 * the parsed feature object. Runs as a separate OS process, so a slow or
 * CPU-heavy video never blocks Node's event loop.
 *
 * @param {string} videoPath - local path to the downloaded video
 * @param {"webcam"|"screen"} type
 * @returns {Promise<object>} extracted feature object
 */
function runExtraction(videoPath, type) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [WORKER_SCRIPT, "--video", videoPath, "--type", type], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGKILL");
        reject(new Error(`Extraction worker timed out after ${PROCESS_TIMEOUT_MS}ms (type=${type})`));
      }
    }, PROCESS_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Failed to spawn python worker: ${err.message}`));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      let parsed;
      try {
        // main.py prints exactly one JSON line to stdout as its contract
        const lastLine = stdout.trim().split("\n").filter(Boolean).pop();
        parsed = JSON.parse(lastLine);
      } catch (parseErr) {
        return reject(
          new Error(`Worker output was not valid JSON (exit ${code}). stderr: ${stderr.slice(0, 1000)}`)
        );
      }

      if (!parsed.ok) {
        return reject(new Error(`Worker reported failure: ${parsed.error || "unknown error"}`));
      }

      resolve(parsed.features);
    });
  });
}

module.exports = { runExtraction };
