// apps/mobile/lib/wsConfig.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

const KEY = "carvision.ws_url";
const PORT = 5173;
const PATH = "/ws";

// fallback if nothing works
export const DEFAULT_WS_URL = `ws://192.168.1.50:${PORT}${PATH}`;

// 1) quick test for a single WS URL
async function tryWs(url, timeoutMs = 600) {
  return new Promise((resolve) => {
    let done = false;
    const ws = new WebSocket(url);

    const to = setTimeout(() => {
      if (done) return;
      done = true;
      ws.close?.();
      resolve(false);
    }, timeoutMs);

    ws.onopen = () => {
      if (done) return;
      done = true;
      clearTimeout(to);
      ws.close();
      resolve(true);
    };

    ws.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(to);
      resolve(false);
    };
  });
}

// 2) build candidates from ONE subnet + a list of hosts
function buildFromSubnet(subnet, hosts) {
  return hosts.map((h) => `ws://${subnet}${h}:${PORT}${PATH}`);
}

// 3) build ALL candidate IPs we want to try
async function buildAllCandidates() {
  const hosts = [2, 3, 4, 5, 10, 20, 23, 30, 40, 50, 60, 80, 100]; // you can add 14, 15, 25…

  // phone IP
  let phoneSubnet = null;
  try {
    const ip = await Network.getIpAddressAsync(); // e.g. 172.20.10.5 or 10.0.0.5
    if (ip) {
      const p = ip.split(".");
      if (p.length === 4) {
        const [a, b, c] = p;
        phoneSubnet = `${a}.${b}.${c}.`;
      }
    }
  } catch {
    // ignore
  }

  const all = new Set();

  // (a) phone subnet — highest priority
  if (phoneSubnet) {
    buildFromSubnet(phoneSubnet, hosts).forEach((u) => all.add(u));
  }

  // (b) common home subnets
  buildFromSubnet("192.168.0.", hosts).forEach((u) => all.add(u));
  buildFromSubnet("192.168.1.", hosts).forEach((u) => all.add(u));

  // (c) common hotspot / enterprise ranges
  buildFromSubnet("172.20.10.", hosts).forEach((u) => all.add(u));   // iPhone hotspot
  buildFromSubnet("10.0.0.", hosts).forEach((u) => all.add(u));
  buildFromSubnet("10.10.0.", hosts).forEach((u) => all.add(u));

  return Array.from(all);
}

// 4) MAIN: get WS URL
export async function getWsUrl() {
  // 1) saved — fastest
  const saved = await AsyncStorage.getItem(KEY);
  if (saved) return saved;

  // 2) build all candidates
  const candidates = await buildAllCandidates();

  // 3) test in PARALLEL (faster than one-by-one)
  // we stop at the first that answers
  const promises = candidates.map((url) =>
    tryWs(url).then((ok) => ({ url, ok }))
  );

  // run them all and wait for first success
  const results = await Promise.all(promises);
  const winner = results.find((r) => r.ok);

  if (winner) {
    await AsyncStorage.setItem(KEY, winner.url);
    return winner.url;
  }

  // 4) nothing found → fallback
  return DEFAULT_WS_URL;
}

export async function setWsUrl(url) {
  await AsyncStorage.setItem(KEY, url.trim());
}

export async function resetWsUrl() {
  await AsyncStorage.removeItem(KEY);
}
