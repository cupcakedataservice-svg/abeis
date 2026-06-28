import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useSession } from "../context/SessionContext.jsx";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginUser } = useSession();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Please enter both your name and email.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/users/register", { name, email });
      loginUser(data.user);
      navigate("/hub");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-accent/80 font-medium mb-2">
            ABEIS
          </p>
          <h1 className="font-display text-3xl font-bold">
            Behavioral Assessment Platform
          </h1>
          <p className="text-white/50 mt-2 text-sm">
            Register with your name and email to begin. Returning participants
            should use the same email to continue building their baseline.
          </p>
        </div>

        {/* Landing actions */}
        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("register-form")
                .scrollIntoView({ behavior: "smooth" })
            }
            className="btn-primary flex-1"
          >
            Start Assessment
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/login")}
            className="btn-secondary flex-1"
          >
            Admin Login
          </button>
        </div>

        <form
          id="register-form"
          onSubmit={handleSubmit}
          className="card p-6 space-y-4"
        >
          <p className="text-sm text-white/40 uppercase tracking-wide font-medium">
            Participant Registration
          </p>
          <div>
            <label className="text-sm text-white/60 mb-1.5 block">
              Full Name
            </label>
            <input
              className="input-field"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1.5 block">
              Email Address
            </label>
            <input
              className="input-field"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Registering…" : "Continue →"}
          </button>
        </form>
      </div>
    </div>
  );
}
