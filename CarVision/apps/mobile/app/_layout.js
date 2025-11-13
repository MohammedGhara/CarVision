// apps/mobile/app/_layout.js
import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { CustomAlertProvider } from "../components/CustomAlert";

export default function Layout() {
  return (
    <AuthProvider>
      <CustomAlertProvider />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}