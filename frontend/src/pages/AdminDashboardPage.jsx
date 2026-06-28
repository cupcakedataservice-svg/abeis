import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAdmin } from "../context/AdminContext.jsx";

export default function AdminDashboardPage() {
  const { adminId, logoutAdmin } = useAdmin();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [assessmentType, setAssessmentType] = useState("");
  const [calibration, setCalibration] = useState("");
  const [finalAssessment, setFinalAssessment] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  // Deletion dialogs
  const [deleteTarget, setDeleteTarget] = useState(null); // single userId
  const [showDeleteSelected, setShowDeleteSelected] = useState(false);
  const [showClearAll, setShowClearAll] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [bannerType, setBannerType] = useState("success"); // "success" | "warning"

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, us] = await Promise.all([
        api.get("/admin/overview"),
        api.get("/admin/users", {
          params: {
            search: search || undefined,
            assessmentType: assessmentType || undefined,
            calibration: calibration || undefined,
            finalAssessment: finalAssessment || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          },
        }),
      ]);
      setOverview(ov.data);
      setUsers(us.data);
      setSelected(new Set());
    } catch {
      // Interceptor handles 401 → redirect is done via route guard
    } finally {
      setLoading(false);
    }
  }, [search, assessmentType, calibration, finalAssessment, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, []); // load on mount

  const handleFilter = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleLogout = async () => {
    try {
      await api.post("/admin/logout");
    } catch {
      /* ignore */
    }
    logoutAdmin();
    navigate("/admin/login");
  };

  const handleExport = (format) => {
    const token = sessionStorage.getItem("abeis_admin_token");
    const params = new URLSearchParams({ format });
    if (assessmentType) params.set("assessmentType", assessmentType);
    // Open with token in header is not possible via window.open — use fetch blob instead
    const base =
      import.meta.env.VITE_API_BASE_URL || "https://abeis-backend.onrender.com";
    fetch(`${base}/admin/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `abeis_dataset_${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  // ── Selection helpers ────────────────────────────────────────────────────────
  const toggleOne = (userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((r) => r.user.userId)));
    }
  };

  // ── Delete single ────────────────────────────────────────────────────────────
  const confirmDeleteOne = async () => {
    setDeleting(true);
    try {
      const { data, status } = await api.delete(`/admin/users/${deleteTarget}`);
      setBannerType(
        status === 207 || data.failures?.length ? "warning" : "success",
      );
      setSuccessMsg(data.message);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      setBannerType("warning");
      setSuccessMsg(
        err.response?.data?.message || "Deletion failed. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  // ── Delete selected ──────────────────────────────────────────────────────────
  const confirmDeleteSelected = async () => {
    setDeleting(true);
    try {
      const { data } = await api.post("/admin/users/delete-selected", {
        userIds: Array.from(selected),
      });
      setBannerType(
        data.skipped?.length || data.failures?.length ? "warning" : "success",
      );
      setSuccessMsg(data.message);
      setShowDeleteSelected(false);
      loadData();
    } catch (err) {
      setBannerType("warning");
      setSuccessMsg(
        err.response?.data?.message || "Deletion failed. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  // ── Clear all ────────────────────────────────────────────────────────────────
  const confirmClearAll = async () => {
    if (clearConfirmText !== "DELETE ALL DATA") return;
    setDeleting(true);
    try {
      const { data, status } = await api.post("/admin/clear-all", {
        confirmation: "DELETE ALL DATA",
      });
      setBannerType(
        status === 207 || data.failures?.length ? "warning" : "success",
      );
      setSuccessMsg(data.message);
      setShowClearAll(false);
      setClearConfirmText("");
      loadData();
    } catch (err) {
      setBannerType("warning");
      setSuccessMsg(
        err.response?.data?.message ||
          "Failed to clear dataset. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-white/40 text-xs mt-0.5">Signed in as {adminId}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="btn-secondary text-sm"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="btn-secondary text-sm"
          >
            Export JSON
          </button>
          <button
            onClick={() => {
              setClearConfirmText("");
              setShowClearAll(true);
            }}
            className="text-sm px-3 py-1.5 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/40"
          >
            Clear Dataset
          </button>
          <button onClick={handleLogout} className="btn-secondary text-sm">
            Logout
          </button>
        </div>
      </div>

      {/* Success / warning banner */}
      {successMsg && (
        <div
          className={
            bannerType === "warning"
              ? "mb-6 rounded-lg bg-amber-900/30 border border-amber-700/40 text-amber-300 px-4 py-3 text-sm flex justify-between items-center"
              : "mb-6 rounded-lg bg-green-900/30 border border-green-700/40 text-green-400 px-4 py-3 text-sm flex justify-between items-center"
          }
        >
          {successMsg}
          <button
            onClick={() => setSuccessMsg("")}
            className={
              bannerType === "warning"
                ? "ml-4 text-amber-500 hover:text-amber-200"
                : "ml-4 text-green-600 hover:text-green-300"
            }
          >
            ✕
          </button>
        </div>
      )}

      {/* Overview cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Registered Users" value={overview.userCount} />
          <StatCard
            label="Total Assessments"
            value={overview.assessmentCount}
          />
          <StatCard label="Completed" value={overview.completedCount} />
          <StatCard
            label="By Type"
            value={
              overview.byType.map((b) => `${b._id}: ${b.count}`).join(" / ") ||
              "—"
            }
            small
          />
        </div>
      )}

      {/* Filters */}
      <form onSubmit={handleFilter} className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            className="input-field max-w-xs"
            placeholder="Search name, email, or User ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input-field max-w-[180px]"
            value={assessmentType}
            onChange={(e) => setAssessmentType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="mcq">MCQ</option>
            <option value="coding">Coding</option>
            <option value="typing">Typing</option>
          </select>
          <select
            className="input-field max-w-[180px]"
            value={calibration}
            onChange={(e) => setCalibration(e.target.value)}
          >
            <option value="">Calibration (any)</option>
            <option value="yes">Calibration: Yes</option>
            <option value="no">Calibration: No</option>
          </select>
          <select
            className="input-field max-w-[190px]"
            value={finalAssessment}
            onChange={(e) => setFinalAssessment(e.target.value)}
          >
            <option value="">Final Assessment (any)</option>
            <option value="yes">Final: Yes</option>
            <option value="no">Final: No</option>
          </select>
          <input
            type="date"
            className="input-field max-w-[160px]"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Date from"
          />
          <input
            type="date"
            className="input-field max-w-[160px]"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Date to"
          />
          <button className="btn-primary" type="submit">
            Filter
          </button>
        </div>
      </form>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-accent/10 border border-accent/20 rounded-lg px-4 py-2">
          <span className="text-sm text-accent">
            {selected.size} user{selected.size > 1 ? "s" : ""} selected
          </span>
          <button
            onClick={() => setShowDeleteSelected(true)}
            className="text-sm px-3 py-1 rounded bg-red-900/40 text-red-400 hover:bg-red-900/60 border border-red-800/40"
          >
            Delete Selected
          </button>
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <p className="text-white/50">Loading…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/50 text-left border-b border-white/10">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selected.size === users.length}
                    onChange={toggleAll}
                    className="accent-accent"
                  />
                </th>
                <th className="p-3">User ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Registered</th>
                <th className="p-3">Assessments</th>
                <th className="p-3">Calibration</th>
                <th className="p-3">Final</th>
                <th className="p-3">Last Assessment</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr
                  key={row.user.userId}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.user.userId)}
                      onChange={() => toggleOne(row.user.userId)}
                      className="accent-accent"
                    />
                  </td>
                  <td className="p-3 font-mono text-xs text-white/40">
                    {row.user.userId}
                  </td>
                  <td className="p-3">{row.user.name}</td>
                  <td className="p-3 text-white/60">{row.user.email}</td>
                  <td className="p-3 text-white/40 text-xs">
                    {new Date(row.user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">{row.assessmentCount}</td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${row.hasCalibration ? "bg-green-900/40 text-green-400" : "bg-white/5 text-white/30"}`}
                    >
                      {row.hasCalibration ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${row.hasFinal ? "bg-green-900/40 text-green-400" : "bg-white/5 text-white/30"}`}
                    >
                      {row.hasFinal ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="p-3 text-white/40 text-xs">
                    {row.lastAssessmentDate
                      ? new Date(row.lastAssessmentDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          navigate(`/admin/users/${row.user.userId}`)
                        }
                        className="text-accent hover:underline text-xs"
                      >
                        View
                      </button>
                      <button
                        onClick={() => setDeleteTarget(row.user.userId)}
                        className="text-red-400 hover:underline text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="p-6 text-center text-white/40">No users found.</p>
          )}
        </div>
      )}

      {/* ── Delete single dialog ─── */}
      {deleteTarget && (
        <Modal
          title="Delete Participant Data"
          onClose={() => setDeleteTarget(null)}
        >
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
              onClick={() => setDeleteTarget(null)}
              className="btn-secondary"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteOne}
              className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium"
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete selected dialog ─── */}
      {showDeleteSelected && (
        <Modal
          title="Delete Selected Participants"
          onClose={() => setShowDeleteSelected(false)}
        >
          <p className="text-white/60 text-sm mb-4">
            You are about to permanently delete{" "}
            <span className="text-white font-semibold">
              {selected.size} participant(s)
            </span>{" "}
            and all their associated data.
          </p>
          <p className="text-red-400 text-sm mb-6">
            This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDeleteSelected(false)}
              className="btn-secondary"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteSelected}
              className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium"
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete Selected"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Clear all dialog ─── */}
      {showClearAll && (
        <Modal
          title="Clear Entire Dataset"
          onClose={() => setShowClearAll(false)}
        >
          <p className="text-white/60 text-sm mb-4">
            This will permanently remove{" "}
            <strong className="text-white">
              every participant, assessment, recording, and behavioral record
            </strong>{" "}
            from the system.
          </p>
          <p className="text-sm text-white/60 mb-2">
            Type <code className="text-red-400">DELETE ALL DATA</code> to
            confirm:
          </p>
          <input
            className="input-field mb-6"
            value={clearConfirmText}
            onChange={(e) => setClearConfirmText(e.target.value)}
            placeholder="DELETE ALL DATA"
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowClearAll(false)}
              className="btn-secondary"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={confirmClearAll}
              disabled={clearConfirmText !== "DELETE ALL DATA" || deleting}
              className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? "Deleting…" : "Clear All Data"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ label, value, small }) {
  return (
    <div className="card p-4">
      <p className="text-white/40 text-xs uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={small ? "text-sm" : "text-2xl font-display font-bold"}>
        {value}
      </p>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="card w-full max-w-md p-6 relative">
        <h2 className="font-display text-lg font-bold mb-4">{title}</h2>
        {children}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/60 text-lg leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
