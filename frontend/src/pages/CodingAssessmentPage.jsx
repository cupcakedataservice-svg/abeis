import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useSession } from "../context/SessionContext.jsx";
import { useMouseTracking } from "../hooks/useMouseTracking.js";
import { useKeyboardTracking } from "../hooks/useKeyboardTracking.js";
import { useSessionTracking } from "../hooks/useSessionTracking.js";

const Q1_PROMPT =
  "Write a function `sumEvens(arr)` that returns the sum of all even numbers in an array.";
const Q2_SOLUTION = `function sumEvens(arr) {
  return arr
    .filter((n) => n % 2 === 0)
    .reduce((sum, n) => sum + n, 0);
}`;

export default function CodingAssessmentPage() {
  const { user, consent } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [stage, setStage] = useState(1); // 1 = independent, 2 = transcription
  const [code1, setCode1] = useState("");
  const [code2, setCode2] = useState("");
  const [q1Start, setQ1Start] = useState(null);
  const [q2Start, setQ2Start] = useState(null);
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
          assessmentType: "coding",
          consentId,
        });
        setAssessment(data);
        setQ1Start(Date.now());

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

  const advanceToQ2 = () => {
    setStage(2);
    setQ2Start(Date.now());
  };

  const handleSubmit = async () => {
    if (!assessment) return;
    setSubmitting(true);
    setError("");
    try {
      const codingResponses = [
        {
          questionNumber: 1,
          prompt: Q1_PROMPT,
          submittedCode: code1,
          responseTimeMs: q1Start ? Date.now() - q1Start : 0,
        },
        {
          questionNumber: 2,
          prompt: "Type the provided solution exactly as shown.",
          providedSolution: Q2_SOLUTION,
          submittedCode: code2,
          responseTimeMs: q2Start ? Date.now() - q2Start : 0,
          matchesProvidedSolution: code2.trim() === Q2_SOLUTION.trim(),
        },
      ];

      await api.post("/responses", {
        assessmentId: assessment.assessmentId,
        userId: user.userId,
        sessionId,
        assessmentType: "coding",
        codingResponses,
      });

      const networkLatencyMs = await sessionTracking.probeNetworkLatency(
        import.meta.env.VITE_API_BASE_URL ||
          "https://abeis-backend.onrender.com",
      );
      const kb = keyboard.getSummary();

      const featureVector = {
        mouse: mouse.getSummary(),
        keyboard: kb,
        session: {
          ...sessionTracking.getSummary(networkLatencyMs),
          avgResponseTimeMs:
            (codingResponses[0].responseTimeMs +
              codingResponses[1].responseTimeMs) /
            2,
        },
        coding: {
          copyPasteAttempts: kb.pasteAttempts,
          backspaces: kb.backspaceCount,
        },
        camera: { cameraEnabled: mediaHandle?.cameraPermission === "granted" },
        screen: {
          screenRecordingEnabled: mediaHandle?.screenPermission === "granted",
        },
      };

      await api.post(`/assessments/${assessment.assessmentId}/complete`, {
        featureVector,
      });

      if (mediaHandle) {
        await mediaHandle.stopAndUpload({
          assessmentId: assessment.assessmentId,
          userId: user.userId,
          sessionId,
          assessmentType: "coding",
        });
      }

      navigate("/complete", { state: { assessmentType: "coding" } });
    } catch (err) {
      setError(
        err.response?.data?.message || "Submission failed. Please try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      <h1 className="font-display text-2xl font-bold mb-1">
        Coding Assessment
      </h1>
      <p className="text-white/50 text-sm mb-8">
        Question {stage} of 2 —{" "}
        {stage === 1
          ? "solve independently"
          : "transcribe the given solution exactly"}
      </p>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {stage === 1 ? (
        <div className="card p-5">
          <p className="font-medium mb-4">{Q1_PROMPT}</p>
          <textarea
            value={code1}
            onChange={(e) => setCode1(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            className="input-field font-mono text-sm h-56 resize-none"
            placeholder="// Write your solution here"
            spellCheck={false}
          />
          <button
            onClick={advanceToQ2}
            disabled={!code1.trim()}
            className="btn-primary mt-4"
          >
            Next Question
          </button>
        </div>
      ) : (
        <div className="card p-5">
          <p className="text-sm text-white/60 mb-2">Type this exactly:</p>
          <pre className="bg-black/40 rounded-xl p-4 text-sm font-mono mb-4 whitespace-pre-wrap">
            {Q2_SOLUTION}
          </pre>
          <textarea
            value={code2}
            onChange={(e) => setCode2(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            className="input-field font-mono text-sm h-56 resize-none"
            placeholder="Type the solution above here"
            spellCheck={false}
          />
          <button
            onClick={handleSubmit}
            disabled={!code2.trim() || submitting}
            className="btn-primary mt-4"
          >
            {submitting ? "Submitting…" : "Submit Assessment"}
          </button>
        </div>
      )}
    </div>
  );
}
