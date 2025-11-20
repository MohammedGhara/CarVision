// apps/mobile/lib/httpBase.js
import { getWsUrl } from "./wsConfig";

export async function getHttpBase() {
  // Skip validation for HTTP base URL - just get saved URL instantly
  const u = await getWsUrl(false, true); // Skip validation for fast HTTP requests
  const m = u.match(/^wss?:\/\/([^/]+)\/ws$/i);
  if (!m) throw new Error("Bad WS URL in settings");
  return `http://${m[1]}`;
}
