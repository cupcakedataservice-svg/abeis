import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/client";

export default function AdminUserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/admin/users/${userId}/details`).then((res) => setData(res.data));
  }, [userId]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${userId}`);
      navigate("/admin");
    } finally {
      setDeleting(false);
    }
  };

  if (!data) return <p className="p-10 text-white/50">Loading…</p>;

  const { user, assessments, features, responses, media, baseline, consents } =
    data;

  return (
    <div className="min-h-screen px-4 py-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/admin" className="text-accent text-sm hover:underline">
          ← Back to dashboard
        </Link>
        <button
          onClick={() => setShowDelete(true)}
          className="text-sm px-3 py-1.5 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/40"
        >
          Delete User
        </button>
      </div>

      <div className="mt-4 mb-8">
        <h1 className="font-display text-2xl font-bold">{user.name}</h1>
        <p className="text-white/50 text-sm">{user.email}</p>
        <p className="text-white/30 text-xs font-mono">{user.userId}</p>
      </div>

      <Section title="Baselines">
        {baseline ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["mcqBaseline", "codingBaseline", "typingBaseline"].map((key) => (
              <div key={key} className="card p-4 text-sm">
                <p className="font-medium mb-2 capitalize">
                  {key.replace("Baseline", "")}
                </p>
                <p className="text-white/50">
                  Samples: {baseline[key]?.sampleCount || 0}
                </p>
                <p className="text-white/50">
                  Avg response time: {fmt(baseline[key]?.avgResponseTimeMs)} ms
                </p>
                <p className="text-white/50">
                  Avg typing speed: {fmt(baseline[key]?.avgTypingSpeedWpm)} wpm
                </p>
                <p className="text-white/50">
                  Avg mouse speed: {fmt(baseline[key]?.avgMouseSpeed)}
                </p>
                <p className="text-white/50">
                  Avg key latency: {fmt(baseline[key]?.avgKeyLatencyMs)} ms
                </p>
                <p className="text-white/50">
                  Avg idle time: {fmt(baseline[key]?.avgIdleDurationMs)} ms
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/40 text-sm">No baseline yet.</p>
        )}
      </Section>

      <Section title="Assessment history">
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/50 text-left border-b border-white/10">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Started</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Camera</th>
                <th className="p-3">Screen</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => {
                const m = media.find(
                  (med) => med.assessmentId === a.assessmentId,
                );
                return (
                  <tr key={a.assessmentId} className="border-b border-white/5">
                    <td className="p-3 uppercase">{a.assessmentType}</td>
                    <td className="p-3">{a.status}</td>
                    <td className="p-3 text-white/50">
                      {new Date(a.startedAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-white/50">
                      {a.duration ? `${a.duration}s` : "—"}
                    </td>
                    <td className="p-3">
                      {m?.cameraRecording?.url ? (
                        <a
                          href={m.cameraRecording.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      {m?.screenRecording?.url ? (
                        <a
                          href={m.screenRecording.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Consent history">
        <div className="space-y-2">
          {consents.map((c) => (
            <div
              key={c.consentId}
              className="card p-3 text-sm flex justify-between"
            >
              <span>{new Date(c.consentTimestamp).toLocaleString()}</span>
              <span className="text-white/50">
                Camera: {c.cameraPermissionStatus} / Screen:{" "}
                {c.screenRecordingPermissionStatus} / Policy v
                {c.privacyPolicyVersion}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Behavioral feature summaries">
        <div className="space-y-3">
          {features.map((f) => (
            <details key={f.assessmentId} className="card p-4">
              <summary className="cursor-pointer text-sm font-medium uppercase">
                {f.assessmentType}
              </summary>
              <pre className="text-xs text-white/60 mt-3 overflow-x-auto">
                {JSON.stringify(f.featureVector, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      </Section>

      <Section title="Responses">
        <div className="space-y-3">
          {responses.map((r) => (
            <details key={r.assessmentId} className="card p-4">
              <summary className="cursor-pointer text-sm font-medium uppercase">
                {r.assessmentType}
              </summary>
              <pre className="text-xs text-white/60 mt-3 overflow-x-auto">
                {JSON.stringify(
                  r.mcqResponses || r.codingResponses || r.typingResponses,
                  null,
                  2,
                )}
              </pre>
            </details>
          ))}
        </div>
      </Section>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="card w-full max-w-md p-6 relative">
            <h2 className="font-display text-lg font-bold mb-4">
              Delete Participant Data
            </h2>
            <p className="text-white/60 text-sm mb-4">
              You are about to permanently delete:
            </p>
            <ul className="text-sm space-y-1 mb-6 text-white/80">
              {[
                "User Profile",
                "Consent Records",
                "Assessment Sessions",
                "Behavioral Features",
                "MCQ Responses",
                "Coding Responses",
                "Typing Responses",
                "Baseline Data",
                "Camera Recordings",
                "Screen Recordings",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-red-400 text-sm mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDelete(false)}
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium"
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v) {
  return typeof v === "number" ? v.toFixed(1) : "—";
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-white/70 text-sm uppercase tracking-wide mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}
