import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useSession } from "../context/SessionContext.jsx";
import { useMouseTracking } from "../hooks/useMouseTracking.js";
import { useKeyboardTracking } from "../hooks/useKeyboardTracking.js";
import { useSessionTracking } from "../hooks/useSessionTracking.js";

const TASK1_TEXT =
  "The quick fox moved across the open field while the sun began to set behind the distant hills, painting the sky in shades of orange and purple.";

const TASK2_TEXT = `The total cost is Rs 1,275.50.
Calculate: 57 + 89 = 146
143 x 12 = 1716
875 / 25 = 35
Password: A9x!4Lm#2
Phone: 9876543210
OTP: 481932`;

function computeWpmAccuracy(source, typed, elapsedMs) {
  const minutes = Math.max(elapsedMs / 60000, 0.01);
  const wordCount = typed.trim().split(/\s+/).filter(Boolean).length;
  const wpm = wordCount / minutes;

  const len = Math.max(source.length, typed.length);
  let correct = 0;
  for (let i = 0; i < Math.min(source.length, typed.length); i++) {
    if (source[i] === typed[i]) correct += 1;
  }
  const accuracy = len ? (correct / len) * 100 : 100;
  return { wpm, accuracy };
}

export default function TypingAssessmentPage() {
  const { user, consent } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [stage, setStage] = useState(1);
  const [typed1, setTyped1] = useState("");
  const [typed2, setTyped2] = useState("");
  const [task1Start, setTask1Start] = useState(null);
  const [task2Start, setTask2Start] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const mouse = useMouseTracking();
  const keyboard = useKeyboardTracking();
  const sessionTracking = useSessionTracking();
  const startedRef = useRef(false);

  const sessionId = location.state?.sessionId || window.__abeisSessionId;
  const consentId = location.state?.consentId || consent?.consentId;
  const mediaHandle = window.__abeisMedia;

  useEffect(() => {
    if (!user || !consentId) {
      navigate("/");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const { data } = await api.post("/assessments/start", {
          userId: user.userId,
          assessmentType: "typing",
          consentId,
        });
        setAssessment(data);
        setTask1Start(Date.now());

        mouse.attach();
        keyboard.attach();
        sessionTracking.attach();
        mediaHandle?.startRecording();
      } catch (err) {
        setError(err.response?.data?.message || "Could not start assessment.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceToTask2 = () => {
    setStage(2);
    setTask2Start(Date.now());
  };

  const handleSubmit = async () => {
    if (!assessment) return;
    setSubmitting(true);
    setError("");
    try {
      const t1Time = task1Start ? (task2Start || Date.now()) - task1Start : 0;
      const t2Time = task2Start ? Date.now() - task2Start : 0;
      const m1 = computeWpmAccuracy(TASK1_TEXT, typed1, t1Time);
      const m2 = computeWpmAccuracy(TASK2_TEXT, typed2, t2Time);

      const typingResponses = [
        { taskNumber: 1, sourceText: TASK1_TEXT, typedText: typed1, wpm: m1.wpm, accuracy: m1.accuracy, responseTimeMs: t1Time },
        { taskNumber: 2, sourceText: TASK2_TEXT, typedText: typed2, wpm: m2.wpm, accuracy: m2.accuracy, responseTimeMs: t2Time },
      ];

      await api.post("/responses", {
        assessmentId: assessment.assessmentId,
        userId: user.userId,
        sessionId,
        assessmentType: "typing",
        typingResponses,
      });

      const networkLatencyMs = await sessionTracking.probeNetworkLatency(
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
      );

      const featureVector = {
        mouse: mouse.getSummary(),
        keyboard: keyboard.getSummary(),
        session: {
          ...sessionTracking.getSummary(networkLatencyMs),
          avgResponseTimeMs: (t1Time + t2Time) / 2,
        },
        typing: {
          wpm: (m1.wpm + m2.wpm) / 2,
          accuracy: (m1.accuracy + m2.accuracy) / 2,
          task1Wpm: m1.wpm,
          task2Wpm: m2.wpm,
          task1Accuracy: m1.accuracy,
          task2Accuracy: m2.accuracy,
        },
        camera: { cameraEnabled: mediaHandle?.cameraPermission === "granted" },
        screen: { screenRecordingEnabled: mediaHandle?.screenPermission === "granted" },
      };

      await api.post(`/assessments/${assessment.assessmentId}/complete`, { featureVector });

      if (mediaHandle) {
        await mediaHandle.stopAndUpload({
          assessmentId: assessment.assessmentId,
          userId: user.userId,
          sessionId,
          assessmentType: "typing",
        });
      }

      navigate("/complete", { state: { assessmentType: "typing" } });
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      <h1 className="font-display text-2xl font-bold mb-1">Typing Assessment</h1>
      <p className="text-white/50 text-sm mb-8">
        Task {stage} of 2 — {stage === 1 ? "type the paragraph naturally" : "type the numbers/symbols paragraph"}
      </p>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {stage === 1 ? (
        <div className="card p-5">
          <p className="text-white/70 text-sm leading-relaxed mb-4 bg-black/30 rounded-xl p-4">{TASK1_TEXT}</p>
          <textarea
            value={typed1}
            onChange={(e) => setTyped1(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            className="input-field h-32 resize-none"
            placeholder="Start typing here…"
          />
          <button onClick={advanceToTask2} disabled={!typed1.trim()} className="btn-primary mt-4">
            Next Task
          </button>
        </div>
      ) : (
        <div className="card p-5">
          <pre className="text-white/70 text-sm leading-relaxed mb-4 bg-black/30 rounded-xl p-4 whitespace-pre-wrap font-mono">
            {TASK2_TEXT}
          </pre>
          <textarea
            value={typed2}
            onChange={(e) => setTyped2(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            className="input-field font-mono h-32 resize-none"
            placeholder="Start typing here…"
          />
          <button onClick={handleSubmit} disabled={!typed2.trim() || submitting} className="btn-primary mt-4">
            {submitting ? "Submitting…" : "Submit Assessment"}
          </button>
        </div>
      )}
    </div>
  );
}
