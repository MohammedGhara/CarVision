// apps/mobile/app/_layout.js
import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { CustomAlertProvider } from "../components/CustomAlert";
import { LanguageProvider } from "../context/LanguageContext";

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