// import React, { useEffect, useRef, useState } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import api from "../api/client";
// import { useSession } from "../context/SessionContext.jsx";
// import { useMouseTracking } from "../hooks/useMouseTracking.js";
// import { useKeyboardTracking } from "../hooks/useKeyboardTracking.js";
// import { useSessionTracking } from "../hooks/useSessionTracking.js";

// const Q1_PROMPT =
//   "Write a function `sumEvens(arr)` that returns the sum of all even numbers in an array.";
// const Q2_SOLUTION = `function sumEvens(arr) {
//   return arr
//     .filter((n) => n % 2 === 0)
//     .reduce((sum, n) => sum + n, 0);
// }`;

// export default function CodingAssessmentPage() {
//   const { user, consent } = useSession();
//   const location = useLocation();
//   const navigate = useNavigate();

//   const [assessment, setAssessment] = useState(null);
//   const [stage, setStage] = useState(1); // 1 = independent, 2 = transcription
//   const [code1, setCode1] = useState("");
//   const [code2, setCode2] = useState("");
//   const [q1Start, setQ1Start] = useState(null);
//   const [q2Start, setQ2Start] = useState(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState("");

//   const mouse = useMouseTracking();
//   const keyboard = useKeyboardTracking();
//   const sessionTracking = useSessionTracking();
//   const startedRef = useRef(false);

//   const sessionId = location.state?.sessionId || window.__abeisSessionId;
//   const consentId = location.state?.consentId || consent?.consentId;
//   const mediaHandle = window.__abeisMedia;

//   useEffect(() => {
//     if (!user || !consentId) {
//       navigate("/");
//       return;
//     }
//     if (startedRef.current) return;
//     startedRef.current = true;

//     (async () => {
//       try {
//         const { data } = await api.post("/assessments/start", {
//           userId: user.userId,
//           assessmentType: "coding",
//           consentId,
//         });
//         setAssessment(data);
//         setQ1Start(Date.now());

//         mouse.attach();
//         keyboard.attach();
//         sessionTracking.attach();
//         mediaHandle?.startRecording();
//       } catch (err) {
//         setError(err.response?.data?.message || "Could not start assessment.");
//       }
//     })();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const advanceToQ2 = () => {
//     setStage(2);
//     setQ2Start(Date.now());
//   };

//   const handleSubmit = async () => {
//     if (!assessment) return;
//     setSubmitting(true);
//     setError("");
//     try {
//       const codingResponses = [
//         {
//           questionNumber: 1,
//           prompt: Q1_PROMPT,
//           submittedCode: code1,
//           responseTimeMs: q1Start ? Date.now() - q1Start : 0,
//         },
//         {
//           questionNumber: 2,
//           prompt: "Type the provided solution exactly as shown.",
//           providedSolution: Q2_SOLUTION,
//           submittedCode: code2,
//           responseTimeMs: q2Start ? Date.now() - q2Start : 0,
//           matchesProvidedSolution: code2.trim() === Q2_SOLUTION.trim(),
//         },
//       ];

//       await api.post("/responses", {
//         assessmentId: assessment.assessmentId,
//         userId: user.userId,
//         sessionId,
//         assessmentType: "coding",
//         codingResponses,
//       });

//       const networkLatencyMs = await sessionTracking.probeNetworkLatency(
//         import.meta.env.VITE_API_BASE_URL ||
//           "https://abeis-backend.onrender.com/api",
//       );
//       const kb = keyboard.getSummary();

//       const featureVector = {
//         mouse: mouse.getSummary(),
//         keyboard: kb,
//         session: {
//           ...sessionTracking.getSummary(networkLatencyMs),
//           avgResponseTimeMs:
//             (codingResponses[0].responseTimeMs +
//               codingResponses[1].responseTimeMs) /
//             2,
//         },
//         coding: {
//           copyPasteAttempts: kb.pasteAttempts,
//           backspaces: kb.backspaceCount,
//         },
//         camera: { cameraEnabled: mediaHandle?.cameraPermission === "granted" },
//         screen: {
//           screenRecordingEnabled: mediaHandle?.screenPermission === "granted",
//         },
//       };

//       await api.post(`/assessments/${assessment.assessmentId}/complete`, {
//         featureVector,
//       });

//       if (mediaHandle) {
//         await mediaHandle.stopAndUpload({
//           assessmentId: assessment.assessmentId,
//           userId: user.userId,
//           sessionId,
//           assessmentType: "coding",
//         });
//       }

//       navigate("/complete", { state: { assessmentType: "coding" } });
//     } catch (err) {
//       setError(
//         err.response?.data?.message || "Submission failed. Please try again.",
//       );
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
//       <h1 className="font-display text-2xl font-bold mb-1">
//         Coding Assessment
//       </h1>
//       <p className="text-white/50 text-sm mb-8">
//         Question {stage} of 2 —{" "}
//         {stage === 1
//           ? "solve independently"
//           : "transcribe the given solution exactly"}
//       </p>

//       {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

//       {stage === 1 ? (
//         <div className="card p-5">
//           <p className="font-medium mb-4">{Q1_PROMPT}</p>
//           <textarea
//             value={code1}
//             onChange={(e) => setCode1(e.target.value)}
//             onPaste={(e) => e.preventDefault()}
//             className="input-field font-mono text-sm h-56 resize-none"
//             placeholder="// Write your solution here"
//             spellCheck={false}
//           />
//           <button
//             onClick={advanceToQ2}
//             disabled={!code1.trim()}
//             className="btn-primary mt-4"
//           >
//             Next Question
//           </button>
//         </div>
//       ) : (
//         <div className="card p-5">
//           <p className="text-sm text-white/60 mb-2">Type this exactly:</p>
//           <pre className="bg-black/40 rounded-xl p-4 text-sm font-mono mb-4 whitespace-pre-wrap">
//             {Q2_SOLUTION}
//           </pre>
//           <textarea
//             value={code2}
//             onChange={(e) => setCode2(e.target.value)}
//             onPaste={(e) => e.preventDefault()}
//             className="input-field font-mono text-sm h-56 resize-none"
//             placeholder="Type the solution above here"
//             spellCheck={false}
//           />
//           <button
//             onClick={handleSubmit}
//             disabled={!code2.trim() || submitting}
//             className="btn-primary mt-4"
//           >
//             {submitting ? "Submitting…" : "Submit Assessment"}
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useSession } from "../context/SessionContext.jsx";
import { useMouseTracking } from "../hooks/useMouseTracking.js";
import { useKeyboardTracking } from "../hooks/useKeyboardTracking.js";
import { useSessionTracking } from "../hooks/useSessionTracking.js";

// ---------------------------------------------------------------------------
// Coding assessment question bank.
//
// NOTE (see README "Known Limitations" carried over from the base project):
// this is still hardcoded sample content, same as before. Wiring these to a
// CMS / `questions` MongoDB collection remains a separate future task and is
// intentionally out of scope for this change.
//
// These three problems replace the previous two-question set (one
// independent problem + one language-specific transcription task). All
// three are written without naming any specific programming language, so
// the participant may answer in whichever language they prefer using the
// language selector below.
// ---------------------------------------------------------------------------
const QUESTIONS = [
  {
    id: 1,
    title: "Sum of Odd Numbers",
    prompt:
      "Write a function that returns the sum of all odd numbers present in a given array or list of integers.",
    example: "Input: [1,2,3,4,5]\nOutput: 9",
  },
  {
    id: 2,
    title: "Find the Smallest Element",
    prompt:
      "Write a function that returns the smallest element in a given array or list.",
    example: "Input: [8,3,6,1,9]\nOutput: 1",
  },
  {
    id: 3,
    title: "Count Uppercase Characters",
    prompt:
      "Write a function that returns the total number of uppercase alphabetic characters in a given string.",
    example: 'Input: "HeLLo"\nOutput: 3',
  },
];

const LANGUAGE_OPTIONS = ["C++", "Java", "Python", "JavaScript", "C", "Other"];

export default function CodingAssessmentPage() {
  const { user, consent } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [stage, setStage] = useState(1); // 1-based index into QUESTIONS
  const [language, setLanguage] = useState(LANGUAGE_OPTIONS[0]);
  const [answers, setAnswers] = useState(() => QUESTIONS.map(() => ""));
  const [questionStartTimes, setQuestionStartTimes] = useState(() => [
    Date.now(),
    null,
    null,
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const mouse = useMouseTracking();
  const keyboard = useKeyboardTracking();
  const sessionTracking = useSessionTracking();
  const startedRef = useRef(false);

  const sessionId = location.state?.sessionId || window.__abeisSessionId;
  const consentId = location.state?.consentId || consent?.consentId;
  const mediaHandle = window.__abeisMedia;

  const currentQuestion = QUESTIONS[stage - 1];
  const currentAnswer = answers[stage - 1];

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

  const setCurrentAnswer = (value) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[stage - 1] = value;
      return next;
    });
  };

  const advance = () => {
    const nextStage = stage + 1;
    setQuestionStartTimes((prev) => {
      const next = [...prev];
      next[nextStage - 1] = Date.now();
      return next;
    });
    setStage(nextStage);
  };

  const handleSubmit = async () => {
    if (!assessment) return;
    setSubmitting(true);
    setError("");
    try {
      const now = Date.now();
      const codingResponses = QUESTIONS.map((q, idx) => {
        const startedAt = questionStartTimes[idx];
        const endedAt =
          idx === stage - 1 ? now : questionStartTimes[idx + 1] || now;
        return {
          questionNumber: q.id,
          prompt: q.prompt,
          submittedCode: answers[idx],
          language,
          responseTimeMs: startedAt ? endedAt - startedAt : 0,
        };
      });

      await api.post("/responses", {
        assessmentId: assessment.assessmentId,
        userId: user.userId,
        sessionId,
        assessmentType: "coding",
        codingResponses,
      });

      const networkLatencyMs = await sessionTracking.probeNetworkLatency(
        import.meta.env.VITE_API_BASE_URL ||
          "https://abeis-backend.onrender.com/api",
      );
      const kb = keyboard.getSummary();

      const avgResponseTimeMs =
        codingResponses.reduce((sum, r) => sum + r.responseTimeMs, 0) /
        codingResponses.length;

      const featureVector = {
        mouse: mouse.getSummary(),
        keyboard: kb,
        session: {
          ...sessionTracking.getSummary(networkLatencyMs),
          avgResponseTimeMs,
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

  const isLastStage = stage === QUESTIONS.length;

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      <h1 className="font-display text-2xl font-bold mb-1">
        Coding Assessment
      </h1>
      <p className="text-white/50 text-sm mb-6">
        Question {stage} of {QUESTIONS.length} — {currentQuestion.title}
      </p>

      <div className="mb-6">
        <label className="text-sm text-white/60 mb-1 block">
          Programming language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="input-field text-sm"
        >
          {LANGUAGE_OPTIONS.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="card p-5">
        <p className="font-medium mb-2">{currentQuestion.prompt}</p>
        <pre className="text-xs text-white/50 mb-4 whitespace-pre-wrap">
          {currentQuestion.example}
        </pre>
        <textarea
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          onPaste={(e) => e.preventDefault()}
          className="input-field font-mono text-sm h-56 resize-none"
          placeholder="// Write your solution here"
          spellCheck={false}
        />
        <button
          onClick={isLastStage ? handleSubmit : advance}
          disabled={!currentAnswer.trim() || submitting}
          className="btn-primary mt-4"
        >
          {submitting
            ? "Submitting…"
            : isLastStage
              ? "Submit Assessment"
              : "Next Question"}
        </button>
      </div>
    </div>
  );
}
