// apps/mobile/components/SafetyEmergencyHost.js
import React, { useCallback, useState } from "react";
import { Platform } from "react-native";

import { useCrashDetection } from "../hooks/useCrashDetection";
import { useSafetySettings } from "../context/SafetySettingsContext";
import { useLanguage } from "../context/LanguageContext";
import CrashDetectionAlert from "./safety/CrashDetectionAlert";

/**
 * Global crash-detection UI (accelerometer). Render once near the app root.
 * Does not affect WebSocket or OBD logic.
 */
export default function SafetyEmergencyHost({ children }) {
  const { t } = useLanguage();
  const { crashDetectionEnabled, hydrated } = useSafetySettings();
  const [crashVisible, setCrashVisible] = useState(false);

  const onPossibleCrash = useCallback(() => {
    setCrashVisible(true);
  }, []);

  useCrashDetection({
    enabled: Platform.OS !== "web" && hydrated && crashDetectionEnabled,
    onPossibleCrash,
  });

  const dismissCrash = useCallback(() => setCrashVisible(false), []);

  return (
    <>
      {children}
      <CrashDetectionAlert visible={crashVisible} onRequestClose={dismissCrash} t={t} />
    </>
  );
}
