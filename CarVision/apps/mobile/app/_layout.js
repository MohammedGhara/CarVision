import { Stack } from "expo-router";
import { getWsUrl, setWsUrl, DEFAULT_WS_URL } from "../lib/wsConfig";

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
