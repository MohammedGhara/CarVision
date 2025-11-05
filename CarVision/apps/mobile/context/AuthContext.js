// apps/mobile/context/AuthContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { saveSession, clearAuth } from "../lib/authStore";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);

  // Restore on app start/reload
  useEffect(() => {
    (async () => {
      try {
        const me = await api.get("/api/auth/me");   // uses token from storage
        if (me?.user) setUser(me.user);
      } catch {
        // token missing/invalid → stay logged out silently
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  // Call this from your Login screen
  const login = async (email, password) => {
    const res = await api.post("/api/auth/login", { email, password });
    await saveSession({ token: res.token, user: res.user });
    setUser(res.user);
  };

  // Optional signup
  const signup = async (payload) => {
    const res = await api.post("/api/auth/signup", payload);
    await saveSession({ token: res.token, user: res.user });
    setUser(res.user);
  };

  const logout = async () => {
    await clearAuth();     // only here we clear storage
    setUser(null);
  };

  const value = useMemo(() => ({ user, restoring, login, signup, logout }), [user, restoring]);
  if (restoring) return null; // splash can be shown instead

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
