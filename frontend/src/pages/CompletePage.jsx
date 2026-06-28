import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function CompletePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const assessmentType = location.state?.assessmentType || "assessment";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="font-display text-2xl font-bold mb-2">Assessment submitted</h1>
        <p className="text-white/50 text-sm mb-8">
          Thanks for completing the {assessmentType.toUpperCase()} assessment. Your behavioral
          baseline has been updated.
        </p>
        <button onClick={() => navigate("/hub")} className="btn-primary">
          Back to assessments
        </button>
      </div>
    </div>
  );
}
