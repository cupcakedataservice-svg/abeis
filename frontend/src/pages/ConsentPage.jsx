import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import api from "../api/client";
import { useSession } from "../context/SessionContext.jsx";
import { useMediaRecording } from "../hooks/useMediaRecording.js";

const STATEMENTS = [
  { key: "dataCollection", text: "I consent to the collection of my behavioral data during this assessment." },
  { key: "webcamRecording", text: "I understand that my webcam video will be recorded throughout the assessment." },
  { key: "screenRecording", text: "I understand that my screen activity will be recorded throughout the assessment." },
  {
    key: "behavioralFeatures",
    text:
      "I understand that my mouse movements, keyboard interactions, typing behavior, response times, and other behavioral features will be collected for research and analysis purposes.",
  },
  {
    key: "secureStorageLinkedToUserId",
    text: "I understand that my data will be securely stored and linked only to my unique User ID.",
  },
  {
    key: "imagekitAndMongoStorage",
    text:
      "I understand that my webcam and screen recordings will be stored securely in ImageKit Cloud Storage, while structured behavioral data will be stored in MongoDB.",
  },
  {
    key: "baselineUsage",
    text:
      "I understand that my behavioral data will be used to create personalized baseline profiles and may be compared against future assessment sessions.",
  },
  {
    key: "rightToStop",
    text: "I understand that I may stop the assessment at any time by closing the browser window before submission.",
  },
];

export default function ConsentPage() {
  const { assessmentType } = useParams();
  const { user, setConsent } = useSession();
  const navigate = useNavigate();
  const media = useMediaRecording();

  const [agreed, setAgreed] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    navigate("/");
    return null;
  }

  const handleCheckPermissions = async () => {
    setRequesting(true);
    setPermissionError("");
    const { camGranted, screenGranted } = await media.requestPermissions();
    setPermissionsChecked(true);
    setRequesting(false);
    if (camGranted !== "granted" || screenGranted !== "granted") {
      setPermissionError(
        "Both camera and screen recording permissions are mandatory for this assessment. Please grant both permissions to continue."
      );
    }
  };

  const canStart =
    agreed && permissionsChecked && media.cameraPermission === "granted" && media.screenPermission === "granted";

  const handleStart = async () => {
    if (!canStart) return;
    setSubmitting(true);
    try {
      const sessionId = uuidv4();
      const acknowledgedStatements = STATEMENTS.reduce((acc, s) => ({ ...acc, [s.key]: true }), {});

      const { data: consentRecord } = await api.post("/consent", {
        userId: user.userId,
        sessionId,
        acknowledgedStatements,
        browserInfo: {
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        },
        cameraPermissionStatus: media.cameraPermission,
        screenRecordingPermissionStatus: media.screenPermission,
      });

      setConsent(consentRecord);
      // Stash media handles + sessionId for the assessment page to pick up.
      window.__abeisMedia = media;
      window.__abeisSessionId = sessionId;

      navigate(`/assessment/${assessmentType}`, { state: { consentId: consentRecord.consentId, sessionId } });
    } catch (err) {
      setPermissionError(err.response?.data?.message || "Could not record consent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-12 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-bold mb-1">Before you begin</h1>
      <p className="text-white/50 text-sm mb-8">
        Please read and agree to the following before starting the {assessmentType.toUpperCase()} assessment.
      </p>

      <div className="card p-6 space-y-3 mb-6">
        {STATEMENTS.map((s) => (
          <div key={s.key} className="flex gap-3 text-sm text-white/80">
            <span className="text-accent mt-0.5">•</span>
            <p>{s.text}</p>
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-4 h-4 accent-accent"
        />
        <span className="text-sm">I have read and agree to all statements above.</span>
      </label>

      <div className="card p-5 mb-6">
        <p className="text-sm text-white/70 mb-3">
          This assessment requires camera and screen recording access. Both are mandatory — the
          assessment cannot begin if either is denied.
        </p>
        <button onClick={handleCheckPermissions} className="btn-secondary text-sm" disabled={requesting}>
          {requesting ? "Requesting permissions…" : "Grant camera & screen access"}
        </button>

        {permissionsChecked && (
          <div className="mt-3 text-sm space-y-1">
            <p className={media.cameraPermission === "granted" ? "text-green-400" : "text-red-400"}>
              Camera: {media.cameraPermission}
            </p>
            <p className={media.screenPermission === "granted" ? "text-green-400" : "text-red-400"}>
              Screen recording: {media.screenPermission}
            </p>
          </div>
        )}

        {permissionError && <p className="text-sm text-red-400 mt-3">{permissionError}</p>}
      </div>

      <button onClick={handleStart} disabled={!canStart || submitting} className="btn-primary w-full">
        {submitting ? "Starting…" : "Start Assessment"}
      </button>
    </div>
  );
}
