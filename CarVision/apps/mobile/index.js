import { LogBox } from "react-native";

// Suppress expo-av deprecation warning early (before any modules load)
if (typeof LogBox !== "undefined") {
  LogBox.ignoreLogs([
    "[expo-av]: Expo AV has been deprecated and will be removed in SDK 54. Use the `expo-audio` and `expo-video` packages to replace the required functionality.",
    /\[expo-av\].*deprecated/i,
  ]);
}

// Also suppress via console.warn override for native module warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  if (
    (message.includes('[expo-av]') && message.includes('deprecated')) ||
    message.includes('garage-outline') && message.includes('is not a valid icon name')
  ) {
    return; // Suppress these warnings
  }
  originalWarn.apply(console, args);
};

import "expo-router/entry";
