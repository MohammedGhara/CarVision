// apps/mobile/context/SafetySettingsContext.js
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "carvision.safety.crashDetectionEnabled";

const SafetySettingsContext = createContext(null);

export function SafetySettingsProvider({ children }) {
  const [crashDetectionEnabled, setCrashDetectionEnabledState] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled) {
          if (v === "false") setCrashDetectionEnabledState(false);
          else if (v === "true") setCrashDetectionEnabledState(true);
        }
      } catch {
        /* keep default */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCrashDetectionEnabled = useCallback(async (next) => {
    setCrashDetectionEnabledState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      crashDetectionEnabled,
      setCrashDetectionEnabled,
      hydrated,
    }),
    [crashDetectionEnabled, setCrashDetectionEnabled, hydrated]
  );

  return <SafetySettingsContext.Provider value={value}>{children}</SafetySettingsContext.Provider>;
}

export function useSafetySettings() {
  const ctx = useContext(SafetySettingsContext);
  if (!ctx) {
    throw new Error("useSafetySettings must be used within SafetySettingsProvider");
  }
  return ctx;
}
