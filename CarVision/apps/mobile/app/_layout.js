// apps/mobile/app/_layout.js
import { useEffect } from "react";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { AuthProvider } from "../context/AuthContext";
import {
  initObdWebSocketService,
  shutdownObdWebSocketService,
} from "../lib/obdWebSocketService";
import { SafetySettingsProvider } from "../context/SafetySettingsContext";
import { CustomAlertProvider } from "../components/CustomAlert";
import SafetyEmergencyHost from "../components/SafetyEmergencyHost";
import { LanguageProvider } from "../context/LanguageContext";

// Suppress warnings
// Must be called before any other code runs
if (typeof LogBox !== "undefined") {
  LogBox.ignoreLogs([
    "[expo-av]: Expo AV has been deprecated and will be removed in SDK 54. Use the `expo-audio` and `expo-video` packages to replace the required functionality.",
    /\[expo-av\].*deprecated/i,
    // Suppress invalid icon name warnings (likely from third-party components or auto-generated navigation)
    /"garage-outline" is not a valid icon name for family "ionicons"/i,
    /is not a valid icon name for family "ionicons"/i,
  ]);
}

export default function Layout() {
  useEffect(() => {
    initObdWebSocketService();
    return () => shutdownObdWebSocketService();
  }, []);

  return (
    <LanguageProvider>
      <SafetySettingsProvider>
        <AuthProvider>
          <CustomAlertProvider />
          <SafetyEmergencyHost>
            <Stack screenOptions={{ headerShown: false }} />
          </SafetyEmergencyHost>
        </AuthProvider>
      </SafetySettingsProvider>
    </LanguageProvider>
  );
}