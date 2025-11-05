// apps/mobile/app/_layout.js  (or App.js if you don’t use expo-router)
import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";

export default function Layout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
