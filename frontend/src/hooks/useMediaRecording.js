// import { useRef, useState, useCallback } from "react";
// import api from "../api/client";

// /**
//  * Handles requesting webcam + screen permissions, recording both for the
//  * duration of an assessment, and uploading the resulting blobs to the
//  * backend (which forwards them to Cloudinary) on stop.
//  */
// export function useMediaRecording() {
//   const cameraStreamRef = useRef(null);
//   const screenStreamRef = useRef(null);
//   const cameraRecorderRef = useRef(null);
//   const screenRecorderRef = useRef(null);
//   const cameraChunks = useRef([]);
//   const screenChunks = useRef([]);
//   const startTimeRef = useRef(null);

//   const [cameraPermission, setCameraPermission] = useState("prompt");
//   const [screenPermission, setScreenPermission] = useState("prompt");
//   const [previewStream, setPreviewStream] = useState(null);

//   /** Request both permissions up front (used on the consent page). */
//   const requestPermissions = useCallback(async () => {
//     let camGranted = "denied";
//     let screenGranted = "denied";

//     try {
//       const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
//       camGranted = "granted";
//       cameraStreamRef.current = camStream;
//       setPreviewStream(camStream);
//     } catch {
//       camGranted = "denied";
//     }

//     try {
//       const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
//       screenGranted = "granted";
//       screenStreamRef.current = screenStream;
//     } catch {
//       screenGranted = "denied";
//     }

//     setCameraPermission(camGranted);
//     setScreenPermission(screenGranted);
//     return { camGranted, screenGranted };
//   }, []);

//   const startRecording = useCallback(() => {
//     startTimeRef.current = Date.now();

//     if (cameraStreamRef.current) {
//       cameraChunks.current = [];
//       const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType: "video/webm" });
//       recorder.ondataavailable = (e) => e.data.size > 0 && cameraChunks.current.push(e.data);
//       recorder.start();
//       cameraRecorderRef.current = recorder;
//     }

//     if (screenStreamRef.current) {
//       screenChunks.current = [];
//       const recorder = new MediaRecorder(screenStreamRef.current, { mimeType: "video/webm" });
//       recorder.ondataavailable = (e) => e.data.size > 0 && screenChunks.current.push(e.data);
//       recorder.start();
//       screenRecorderRef.current = recorder;
//     }
//   }, []);

//   const stopAndUpload = useCallback(
//     async ({ assessmentId, userId, sessionId, assessmentType }) => {
//       const durationSeconds = startTimeRef.current
//         ? Math.round((Date.now() - startTimeRef.current) / 1000)
//         : 0;

//       const uploads = [];

//       const finalizeRecorder = (recorder) =>
//         new Promise((resolve) => {
//           if (!recorder || recorder.state === "inactive") return resolve();
//           recorder.onstop = resolve;
//           recorder.stop();
//         });

//       await Promise.all([
//         finalizeRecorder(cameraRecorderRef.current),
//         finalizeRecorder(screenRecorderRef.current),
//       ]);

//       if (cameraChunks.current.length) {
//         const blob = new Blob(cameraChunks.current, { type: "video/webm" });
//         uploads.push(uploadBlob(blob, "camera", { assessmentId, userId, sessionId, assessmentType, durationSeconds }));
//       }
//       if (screenChunks.current.length) {
//         const blob = new Blob(screenChunks.current, { type: "video/webm" });
//         uploads.push(uploadBlob(blob, "screen", { assessmentId, userId, sessionId, assessmentType, durationSeconds }));
//       }

//       // Release hardware
//       cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
//       screenStreamRef.current?.getTracks().forEach((t) => t.stop());

//       return Promise.all(uploads);
//     },
//     []
//   );

//   return {
//     requestPermissions,
//     startRecording,
//     stopAndUpload,
//     cameraPermission,
//     screenPermission,
//     previewStream,
//   };
// }

// async function uploadBlob(blob, recordingType, { assessmentId, userId, sessionId, assessmentType, durationSeconds }) {
//   const formData = new FormData();
//   formData.append("file", blob, `${recordingType}.webm`);
//   formData.append("assessmentId", assessmentId);
//   formData.append("userId", userId);
//   formData.append("sessionId", sessionId);
//   formData.append("assessmentType", assessmentType);
//   formData.append("recordingType", recordingType);
//   formData.append("duration", String(durationSeconds));

//   return api.post("/media/upload", formData, {
//     headers: { "Content-Type": "multipart/form-data" },
//   });
// }

import { useRef, useState, useCallback } from "react";
import api from "../api/client";

/**
 * Handles requesting webcam + screen permissions, recording both for the
 * duration of an assessment, and uploading the resulting blobs to the
 * backend (which forwards them to Cloudinary) on stop.
 *
 * Upload strategy (fixes Problem 2 — duplicate screen uploads):
 * uploads are sequential (screen, then camera) and each recording's
 * successful result is cached in-memory per assessment. If one upload
 * fails, calling stopAndUpload again only retries the missing recording —
 * a recording that already succeeded is never re-sent.
 */
export function useMediaRecording() {
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraRecorderRef = useRef(null);
  const screenRecorderRef = useRef(null);
  const cameraChunks = useRef([]);
  const screenChunks = useRef([]);
  const startTimeRef = useRef(null);

  // Tracks which recordings have already been successfully uploaded for the
  // *current* assessment attempt, so a retry never re-uploads a success.
  const uploadResultsRef = useRef({ camera: null, screen: null });
  const uploadedAssessmentIdRef = useRef(null);

  const [cameraPermission, setCameraPermission] = useState("prompt");
  const [screenPermission, setScreenPermission] = useState("prompt");
  const [previewStream, setPreviewStream] = useState(null);

  /** Request both permissions up front (used on the consent page). */
  const requestPermissions = useCallback(async () => {
    let camGranted = "denied";
    let screenGranted = "denied";

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      camGranted = "granted";
      cameraStreamRef.current = camStream;
      setPreviewStream(camStream);
    } catch {
      camGranted = "denied";
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenGranted = "granted";
      screenStreamRef.current = screenStream;
    } catch {
      screenGranted = "denied";
    }

    setCameraPermission(camGranted);
    setScreenPermission(screenGranted);
    return { camGranted, screenGranted };
  }, []);

  const startRecording = useCallback(() => {
    startTimeRef.current = Date.now();

    // Fresh assessment attempt — clear any stale upload cache from a
    // previous assessment (defensive; the hook instance can be reused
    // across multiple assessment pages in the same session).
    uploadResultsRef.current = { camera: null, screen: null };
    uploadedAssessmentIdRef.current = null;

    if (cameraStreamRef.current) {
      cameraChunks.current = [];
      const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType: "video/webm" });
      recorder.ondataavailable = (e) => e.data.size > 0 && cameraChunks.current.push(e.data);
      recorder.start();
      cameraRecorderRef.current = recorder;
    }

    if (screenStreamRef.current) {
      screenChunks.current = [];
      const recorder = new MediaRecorder(screenStreamRef.current, { mimeType: "video/webm" });
      recorder.ondataavailable = (e) => e.data.size > 0 && screenChunks.current.push(e.data);
      recorder.start();
      screenRecorderRef.current = recorder;
    }
  }, []);

  const stopAndUpload = useCallback(
    async ({ assessmentId, userId, sessionId, assessmentType }) => {
      // Defensive reset if somehow called for a different assessmentId
      // than the one we've been caching uploads for.
      if (uploadedAssessmentIdRef.current && uploadedAssessmentIdRef.current !== assessmentId) {
        uploadResultsRef.current = { camera: null, screen: null };
      }
      uploadedAssessmentIdRef.current = assessmentId;

      const durationSeconds = startTimeRef.current
        ? Math.round((Date.now() - startTimeRef.current) / 1000)
        : 0;

      const finalizeRecorder = (recorder) =>
        new Promise((resolve) => {
          if (!recorder || recorder.state === "inactive") return resolve();
          recorder.onstop = resolve;
          recorder.stop();
        });

      // Ensure both MediaRecorder instances have fully stopped and flushed
      // their final ondataavailable event before touching the blobs.
      // Safe to call again on retry — an already-inactive recorder resolves
      // immediately.
      await Promise.all([
        finalizeRecorder(cameraRecorderRef.current),
        finalizeRecorder(screenRecorderRef.current),
      ]);

      // Release hardware once recorders are finalized. Safe to call again —
      // stopping an already-stopped track is a no-op.
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());

      const failed = [];
      const ctx = { assessmentId, userId, sessionId, assessmentType, durationSeconds };

      // --- Screen first (per required upload order), only if not already uploaded ---
      if (!uploadResultsRef.current.screen) {
        try {
          if (!screenChunks.current.length) {
            throw new Error("No screen recording data captured");
          }
          const blob = new Blob(screenChunks.current, { type: "video/webm" });
          if (blob.size === 0) throw new Error("Screen recording blob is empty");
          const { data } = await uploadBlob(blob, "screen", ctx);
          uploadResultsRef.current.screen = data;
        } catch (err) {
          failed.push({ recordingType: "screen", error: err });
        }
      }

      // --- Webcam next, only if not already uploaded ---
      if (!uploadResultsRef.current.camera) {
        try {
          if (!cameraChunks.current.length) {
            throw new Error("No webcam recording data captured");
          }
          const blob = new Blob(cameraChunks.current, { type: "video/webm" });
          if (blob.size === 0) throw new Error("Webcam recording blob is empty");
          const { data } = await uploadBlob(blob, "camera", ctx);
          uploadResultsRef.current.camera = data;
        } catch (err) {
          failed.push({ recordingType: "camera", error: err });
        }
      }

      if (failed.length) {
        const err = new Error(
          `Upload failed for: ${failed.map((f) => f.recordingType).join(", ")}. ` +
          `Successfully uploaded recordings were preserved and will not be re-uploaded on retry.`
        );
        err.failedRecordings = failed.map((f) => f.recordingType);
        err.partialResults = { ...uploadResultsRef.current };
        throw err;
      }

      return { ...uploadResultsRef.current };
    },
    []
  );

  return {
    requestPermissions,
    startRecording,
    stopAndUpload,
    cameraPermission,
    screenPermission,
    previewStream,
  };
}

async function uploadBlob(blob, recordingType, { assessmentId, userId, sessionId, assessmentType, durationSeconds }) {
  const formData = new FormData();
  formData.append("file", blob, `${recordingType}.webm`);
  formData.append("assessmentId", assessmentId);
  formData.append("userId", userId);
  formData.append("sessionId", sessionId);
  formData.append("assessmentType", assessmentType);
  formData.append("recordingType", recordingType);
  formData.append("duration", String(durationSeconds));

  return api.post("/media/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    // Video uploads legitimately take longer than typical API calls; give
    // them real headroom instead of relying on axios's default (no timeout,
    // but downstream proxies/hosts often impose their own ~60s cutoff).
    timeout: 5 * 60 * 1000,
  });
}