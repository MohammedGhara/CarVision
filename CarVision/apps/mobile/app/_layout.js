// apps/mobile/app/_layout.js
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { AuthProvider } from "../context/AuthContext";
import { CustomAlertProvider } from "../components/CustomAlert";
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
  return (
    <LanguageProvider>
      <AuthProvider>
        <CustomAlertProvider />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </LanguageProvider>
  );
}