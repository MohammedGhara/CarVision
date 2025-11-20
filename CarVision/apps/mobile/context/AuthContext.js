// apps/mobile/context/AuthContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { saveSession, clearAuth, getUser } from "../lib/authStore";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);

  // Restore on app start/reload (INSTANT startup - use cached user first)
  useEffect(() => {
    (async () => {
      // INSTANT: Load user from cache first (no API call needed)
      const cachedUser = await getUser();
      if (cachedUser) {
        setUser(cachedUser);
        setRestoring(false); // Show app immediately with cached user
      } else {
        setRestoring(false); // No cached user, show app anyway
      }
      
      // Validate token in BACKGROUND (non-blocking)
      setTimeout(async () => {
        try {
          const me = await api.get("/api/auth/me");   // uses token from storage
          if (me?.user) {
            await saveSession({ user: me.user }); // Update cache
            setUser(me.user);
          }
        } catch {
          // token missing/invalid → clear cached user
          if (cachedUser) {
            await clearAuth();
            setUser(null);
          }
        }
      }, 0); // Run in next tick - don't block startup
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
