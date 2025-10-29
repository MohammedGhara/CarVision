// apps/mobile/lib/httpBase.js
import { getWsUrl } from "./wsConfig";

export async function getHttpBase() {
  const u = await getWsUrl(); // e.g., ws://192.168.1.147:5173/ws
  const m = u.match(/^wss?:\/\/([^/]+)\/ws$/i);
  if (!m) throw new Error("Bad WS URL in settings");
  return `http://${m[1]}`;
}
