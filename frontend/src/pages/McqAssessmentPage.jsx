import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useSession } from "../context/SessionContext.jsx";
import { useMouseTracking } from "../hooks/useMouseTracking.js";
import { useKeyboardTracking } from "../hooks/useKeyboardTracking.js";
import { useSessionTracking } from "../hooks/useSessionTracking.js";

const QUESTIONS = [
  {
    id: "q1",
    text: "Which data structure uses FIFO (First In, First Out) ordering?",
    options: ["Stack", "Queue", "Binary Tree", "Hash Map"],
    correct: "Queue",
  },
  {
    id: "q2",
    text: "What is the time complexity of binary search on a sorted array?",
    options: ["O(n)", "O(n log n)", "O(log n)", "O(1)"],
    correct: "O(log n)",
  },
  {
    id: "q3",
    text: "Which HTTP method is typically used to update an existing resource?",
    options: ["GET", "POST", "PUT", "DELETE"],
    correct: "PUT",
  },
  {
    id: "q4",
    text: "In React, what hook is used to manage local component state?",
    options: ["useEffect", "useState", "useRef", "useMemo"],
    correct: "useState",
  },
  {
    id: "q5",
    text: "Which of these is NOT a NoSQL database?",
    options: ["MongoDB", "Cassandra", "PostgreSQL", "Redis"],
    correct: "PostgreSQL",
  },
];

export default function McqAssessmentPage() {
  const { user, consent } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionStartTimes, setQuestionStartTimes] = useState({});
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
          assessmentType: "mcq",
          consentId,
          meta: { questionIds: QUESTIONS.map((q) => q.id) },
        });
        setAssessment(data);
        setQuestionStartTimes({ [QUESTIONS[0].id]: Date.now() });

        const detachMouse = mouse.attach();
        const detachKeyboard = keyboard.attach();
        const detachSession = sessionTracking.attach();
        mediaHandle?.startRecording();

        return () => {
          detachMouse();
          detachKeyboard();
          detachSession();
        };
      } catch (err) {
        setError(err.response?.data?.message || "Could not start assessment.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (questionId, option, index) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    if (!questionStartTimes[QUESTIONS[index + 1]?.id] && QUESTIONS[index + 1]) {
      setQuestionStartTimes((prev) => ({ ...prev, [QUESTIONS[index + 1].id]: Date.now() }));
    }
  };

  const handleSubmit = async () => {
    if (!assessment) return;
    setSubmitting(true);
    setError("");

    try {
      const mcqResponses = QUESTIONS.map((q) => {
        const startTime = questionStartTimes[q.id] || Date.now();
        const selected = answers[q.id];
        return {
          questionId: q.id,
          questionText: q.text,
          selectedOption: selected || null,
          correctOption: q.correct,
          isCorrect: selected === q.correct,
          responseTimeMs: Date.now() - startTime,
        };
      });

      await api.post("/responses", {
        assessmentId: assessment.assessmentId,
        userId: user.userId,
        sessionId,
        assessmentType: "mcq",
        mcqResponses,
      });

      const networkLatencyMs = await sessionTracking.probeNetworkLatency(
        import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
      );

      const featureVector = {
        mouse: mouse.getSummary(),
        keyboard: keyboard.getSummary(),
        session: {
          ...sessionTracking.getSummary(networkLatencyMs),
          avgResponseTimeMs:
            mcqResponses.reduce((sum, r) => sum + r.responseTimeMs, 0) / mcqResponses.length,
        },
        camera: { cameraEnabled: mediaHandle?.cameraPermission === "granted" },
        screen: { screenRecordingEnabled: mediaHandle?.screenPermission === "granted" },
      };

      await api.post(`/assessments/${assessment.assessmentId}/complete`, {
        featureVector,
        rawEvents: { mouseEvents: mouse.getRawEvents().positionsSample },
      });

      if (mediaHandle) {
        await mediaHandle.stopAndUpload({
          assessmentId: assessment.assessmentId,
          userId: user.userId,
          sessionId,
          assessmentType: "mcq",
        });
      }

      navigate("/complete", { state: { assessmentType: "mcq" } });
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  const allAnswered = QUESTIONS.every((q) => answers[q.id]);

  return (
    <div className="min-h-screen px-4 py-12 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-bold mb-1">MCQ Assessment</h1>
      <p className="text-white/50 text-sm mb-8">
        Answer all questions. Your interactions are being recorded as part of this assessment.
      </p>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="space-y-6">
        {QUESTIONS.map((q, idx) => (
          <div key={q.id} className="card p-5">
            <p className="font-medium mb-4">
              {idx + 1}. {q.text}
            </p>
            <div className="space-y-2">
              {q.options.map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    answers[q.id] === opt
                      ? "border-accent bg-accent/10"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === opt}
                    onChange={() => handleSelect(q.id, opt, idx)}
                    className="accent-accent"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting || !assessment}
        className="btn-primary w-full mt-8"
      >
        {submitting ? "Submitting…" : "Submit Assessment"}
      </button>
    </div>
  );
}
