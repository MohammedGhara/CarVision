// apps/mobile/lib/httpBase.js
// Get HTTP base URL from WebSocket URL
import { getWsUrl } from "./wsConfig";

export async function getHttpBase() {
  try {
    const wsUrl = await getWsUrl();
    // Extract IP and port from ws://IP:PORT/ws
    const match = wsUrl.match(/^wss?:\/\/([^/]+)\/ws$/i);
    if (match) {
      return `http://${match[1]}`;
    }
    // Fallback
    return "http://192.168.1.50:5173";
  } catch (error) {
    console.error("❌ Error getting HTTP base:", error);
    return "http://192.168.1.50:5173"; // Fallback
  }
}
