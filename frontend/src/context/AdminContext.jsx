import React, { createContext, useContext, useState, useCallback } from "react";

const AdminContext = createContext(null);

const TOKEN_KEY = "abeis_admin_token";
const ID_KEY = "abeis_admin_id";

export function AdminProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || null);
  const [adminId, setAdminId] = useState(() => sessionStorage.getItem(ID_KEY) || null);

  const loginAdmin = useCallback((newToken, newAdminId) => {
    sessionStorage.setItem(TOKEN_KEY, newToken);
    sessionStorage.setItem(ID_KEY, newAdminId);
    setToken(newToken);
    setAdminId(newAdminId);
  }, []);

  const logoutAdmin = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ID_KEY);
    setToken(null);
    setAdminId(null);
  }, []);

  const isAdminAuthenticated = Boolean(token);

  return (
    <AdminContext.Provider value={{ token, adminId, isAdminAuthenticated, loginAdmin, logoutAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}
