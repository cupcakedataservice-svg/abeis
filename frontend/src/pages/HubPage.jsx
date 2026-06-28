import React from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext.jsx";

const ASSESSMENTS = [
  { type: "mcq", title: "MCQ Assessment", desc: "Answer multiple-choice questions while we observe natural interaction patterns." },
  { type: "coding", title: "Coding Assessment", desc: "Solve one problem independently, then transcribe a given solution exactly." },
  { type: "typing", title: "Typing Assessment", desc: "Type a plain paragraph, then a paragraph rich in numbers and symbols." },
];

export default function HubPage() {
  const { user, logout } = useSession();
  const navigate = useNavigate();

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="text-white/50 text-sm">Welcome,</p>
          <h1 className="font-display text-2xl font-bold">{user.name}</h1>
        </div>
        <button onClick={logout} className="btn-secondary text-sm">
          Switch account
        </button>
      </div>

      <h2 className="text-white/70 text-sm uppercase tracking-wide mb-4">Choose an assessment</h2>
      <div className="space-y-4">
        {ASSESSMENTS.map((a) => (
          <button
            key={a.type}
            onClick={() => navigate(`/consent/${a.type}`)}
            className="card w-full text-left p-5 hover:border-accent/60 transition-colors group"
          >
            <h3 className="font-display font-semibold text-lg group-hover:text-accent transition-colors">
              {a.title}
            </h3>
            <p className="text-white/50 text-sm mt-1">{a.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
