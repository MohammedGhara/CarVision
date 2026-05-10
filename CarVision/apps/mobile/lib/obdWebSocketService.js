/**
 * Single shared OBD-II WebSocket for the whole app.
 * - Keeps Live Data and DoctorCar AI in sync with the same merged telemetry.
 * - Starts from root layout so DoctorCar updates 24/7 while the app is open (adapter streaming).
 */

import { AppState } from "react-native";
import { getWsUrl, checkNetworkChange } from "./wsConfig";
import { pushTelemetrySlice } from "./liveTelemetryBridge";
import { ingestDoctorCarTelemetry } from "../ai/services/telemetryHub";

const INITIAL_TELEMETRY = {
  battery: null,
  rpm: null,
  speed: null,
  coolant: null,
  load: null,
  throttle: null,
  fuel: null,
  iat: null,
  maf: null,
  map: null,
  baro: null,
  stft: null,
  ltft: null,
  dtcs: [],
  pending: [],
  permanent: [],
  monitors: { milOn: false, dtcCount: 0 },
  status: { level: "NORMAL", reason: "" },
};

let merged = { ...INITIAL_TELEMETRY };
let linkState = { status: "down", message: "Connecting..." };
let queuedState = false;

/** @type {WebSocket|null} */
let ws = null;
let reconnectTimer = null;
let failureCount = 0;
let connectAttemptUrl = null;

const snapshotListeners = new Set();
const telemetryOnlyListeners = new Set();

const MAX_FAILURES_BEFORE_REDETECT = 3;

function notifyTelemetryOnly() {
  const t = { ...merged };
  telemetryOnlyListeners.forEach((cb) => {
    try {
      cb(t);
    } catch {
      /* ignore */
    }
  });
}

function notify() {
  const snap = { telemetry: { ...merged }, link: { ...linkState }, queued: queuedState };
  snapshotListeners.forEach((cb) => {
    try {
      cb(snap);
    } catch {
      /* ignore */
    }
  });
}

function setLink(next) {
  linkState = next;
  notify();
}

function setQueued(next) {
  queuedState = next;
  notify();
}

/**
 * Subscribe to merged telemetry + link + queue state (for Live Data UI).
 * @param {(s: { telemetry: object, link: object, queued: boolean }) => void} cb
 */
export function subscribeObdSnapshot(cb) {
  snapshotListeners.add(cb);
  cb({ telemetry: { ...merged }, link: { ...linkState }, queued: queuedState });
  return () => snapshotListeners.delete(cb);
}

/** Fires only when a telemetry frame arrives (for CSV / session logging). */
export function subscribeTelemetryFrames(cb) {
  telemetryOnlyListeners.add(cb);
  cb({ ...merged });
  return () => telemetryOnlyListeners.delete(cb);
}

export function sendObdMessage(payload) {
  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }
}

/** Close socket so onclose scheduling reconnects (same as pull-to-refresh on Live Data). */
export function reconnectObdWebSocket() {
  try {
    if (ws) ws.close();
  } catch {
    /* ignore */
  }
}

let urlRefreshInterval = null;
let appStateSub = null;
let started = false;

function scheduleConnect(url) {
  connectAttemptUrl = url;
  failureCount = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const connect = () => {
    if (!connectAttemptUrl) return;

    try {
      ws && ws.close();
    } catch {
      /* ignore */
    }

    ws = new WebSocket(connectAttemptUrl);

    ws.onopen = () => {
      setLink({ status: "up", message: "Connected" });
      failureCount = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        if (msg.type === "link") {
          setLink({ status: msg.status, message: msg.message });
        }

        if (msg.type === "telemetry") {
          pushTelemetrySlice(msg.data);
          merged = { ...merged, ...msg.data };
          queueMicrotask(() => ingestDoctorCarTelemetry(merged));
          notifyTelemetryOnly();
          notify();
        }

        if (msg.type === "queued") setQueued(true);
        if (msg.type === "ack") setQueued(false);
      } catch {
        /* ignore bad frames */
      }
    };

    ws.onerror = () => {
      failureCount++;
      setLink({ status: "down", message: "Connection error" });
      try {
        ws && ws.close();
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      failureCount++;
      if (failureCount < MAX_FAILURES_BEFORE_REDETECT) {
        setLink({ status: "down", message: "Disconnected - retrying..." });
      } else {
        setLink({ status: "down", message: "Network changed - re-detecting..." });
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 2000);
    };
  };

  connect();
}

/**
 * Start global stream once (idempotent).
 */
export async function initObdWebSocketService() {
  if (started) return;
  started = true;

  const boot = async () => {
    const url = await getWsUrl();
    console.log("📡 Global OBD WebSocket URL:", url);
    scheduleConnect(url);
  };

  await boot();

  const checkNetwork = async () => {
    try {
      const changed = await checkNetworkChange();
      if (changed) {
        const newUrl = await getWsUrl();
        connectAttemptUrl = newUrl;
        failureCount = MAX_FAILURES_BEFORE_REDETECT;
        reconnectObdWebSocket();
      }
    } catch {
      /* ignore */
    }
  };

  urlRefreshInterval = setInterval(checkNetwork, 30000);

  appStateSub = AppState.addEventListener("change", (next) => {
    if (next === "active") {
      setTimeout(checkNetwork, 1000);
    }
  });
}

export function shutdownObdWebSocketService() {
  started = false;
  if (urlRefreshInterval) {
    clearInterval(urlRefreshInterval);
    urlRefreshInterval = null;
  }
  appStateSub?.remove?.();
  appStateSub = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    ws && ws.close();
  } catch {
    /* ignore */
  }
  ws = null;
}
