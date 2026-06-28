import React, { createContext, useContext, useState } from "react";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("abeis_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [consent, setConsent] = useState(null);

  const loginUser = (userObj) => {
    setUser(userObj);
    localStorage.setItem("abeis_user", JSON.stringify(userObj));
  };

  const logout = () => {
    setUser(null);
    setConsent(null);
    localStorage.removeItem("abeis_user");
  };

  return (
    <SessionContext.Provider value={{ user, loginUser, consent, setConsent, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
