import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAdmin } from "../context/AdminContext.jsx";

export default function AdminLoginPage() {
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginAdmin } = useAdmin();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!adminId.trim() || !password.trim()) {
      setError("Please enter both Admin ID and Password.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/admin/login", { adminId, password });
      loginAdmin(data.token, data.adminId);
      navigate("/admin");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid Admin ID or Password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-accent/80 font-medium mb-2">ABEIS</p>
          <h1 className="font-display text-2xl font-bold">Administrator Login</h1>
          <p className="text-white/40 mt-2 text-sm">Restricted access — authorised personnel only.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1.5 block">Admin ID</label>
            <input
              className="input-field"
              placeholder="ADMIN001"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1.5 block">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center mt-4 text-white/30 text-xs">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="hover:text-white/60 underline"
          >
            ← Back to Landing Page
          </button>
        </p>
      </div>
    </div>
  );
}
