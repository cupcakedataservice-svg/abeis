import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AdminProvider } from "./context/AdminContext.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";

import RegisterPage from "./pages/RegisterPage.jsx";
import ConsentPage from "./pages/ConsentPage.jsx";
import HubPage from "./pages/HubPage.jsx";
import McqAssessmentPage from "./pages/McqAssessmentPage.jsx";
import CodingAssessmentPage from "./pages/CodingAssessmentPage.jsx";
import TypingAssessmentPage from "./pages/TypingAssessmentPage.jsx";
import CompletePage from "./pages/CompletePage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import AdminUserDetailPage from "./pages/AdminUserDetailPage.jsx";

export default function App() {
  return (
    <AdminProvider>
      <Routes>
        {/* Public participant routes */}
        <Route path="/" element={<RegisterPage />} />
        <Route path="/consent/:assessmentType" element={<ConsentPage />} />
        <Route path="/hub" element={<HubPage />} />
        <Route path="/assessment/mcq" element={<McqAssessmentPage />} />
        <Route path="/assessment/coding" element={<CodingAssessmentPage />} />
        <Route path="/assessment/typing" element={<TypingAssessmentPage />} />
        <Route path="/complete" element={<CompletePage />} />

        {/* Admin auth */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Protected admin routes */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/users/:userId"
          element={
            <RequireAdmin>
              <AdminUserDetailPage />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminProvider>
  );
}
