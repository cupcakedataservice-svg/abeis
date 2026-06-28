import { useRef, useState, useCallback } from "react";
import api from "../api/client";

/**
 * Handles requesting webcam + screen permissions, recording both for the
 * duration of an assessment, and uploading the resulting blobs to the
 * backend (which forwards them to ImageKit) on stop.
 */
export function useMediaRecording() {
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraRecorderRef = useRef(null);
  const screenRecorderRef = useRef(null);
  const cameraChunks = useRef([]);
  const screenChunks = useRef([]);
  const startTimeRef = useRef(null);

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
      const durationSeconds = startTimeRef.current
        ? Math.round((Date.now() - startTimeRef.current) / 1000)
        : 0;

      const uploads = [];

      const finalizeRecorder = (recorder) =>
        new Promise((resolve) => {
          if (!recorder || recorder.state === "inactive") return resolve();
          recorder.onstop = resolve;
          recorder.stop();
        });

      await Promise.all([
        finalizeRecorder(cameraRecorderRef.current),
        finalizeRecorder(screenRecorderRef.current),
      ]);

      if (cameraChunks.current.length) {
        const blob = new Blob(cameraChunks.current, { type: "video/webm" });
        uploads.push(uploadBlob(blob, "camera", { assessmentId, userId, sessionId, assessmentType, durationSeconds }));
      }
      if (screenChunks.current.length) {
        const blob = new Blob(screenChunks.current, { type: "video/webm" });
        uploads.push(uploadBlob(blob, "screen", { assessmentId, userId, sessionId, assessmentType, durationSeconds }));
      }

      // Release hardware
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());

      return Promise.all(uploads);
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
  });
}
