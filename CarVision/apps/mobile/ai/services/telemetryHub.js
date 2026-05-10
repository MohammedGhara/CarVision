/**
 * DoctorCar telemetry hub — isolated from lib/liveTelemetryBridge (Safety uses that).
 * Ingest full merged telemetry from Live Data; keeps a short history for predictive logic.
 *
 * TODO: Optional cloud sync / ML feature store.
 */

import { maybeRecordMlSample } from "./telemetryCollector.js";
import { normalizeTelemetrySnapshot } from "../utils/normalizeTelemetry.js";

const MAX_HISTORY = 150;
let lastSnapshot = null;
/** @type {{ t: number, snapshot: object }[]} */
const history = [];
const listeners = new Set();

function cloneSnap(s) {
  if (!s || typeof s !== "object") return null;
  try {
    return JSON.parse(JSON.stringify(s));
  } catch {
    return { ...s };
  }
}

/**
 * Call from Live Data WebSocket merge with the full telemetry object (post-merge).
 * @param {object} mergedTelemetry — same shape as cardata state slice
 */
export function ingestDoctorCarTelemetry(mergedTelemetry) {
  const snapshot = cloneSnap(mergedTelemetry);
  if (!snapshot) return;
  lastSnapshot = snapshot;
  const row = { t: Date.now(), snapshot };
  history.push(row);
  while (history.length > MAX_HISTORY) history.shift();

  try {
    const norm = normalizeTelemetrySnapshot(snapshot);
    maybeRecordMlSample(norm, history.map((h) => ({ snapshot: h.snapshot })));
  } catch {
    /* ignore optional ML buffer */
  }

  const payload = {
    snapshot,
    history: history.map((h) => ({ t: h.t, snapshot: h.snapshot })),
    updatedAt: row.t,
  };
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* ignore */
    }
  });
}

/** @returns {{ snapshot: object|null, history: Array, updatedAt: number|null }} */
export function getDoctorCarTelemetryState() {
  return {
    snapshot: lastSnapshot ? cloneSnap(lastSnapshot) : null,
    history: history.map((h) => ({ t: h.t, snapshot: cloneSnap(h.snapshot) })),
    updatedAt: history.length ? history[history.length - 1].t : null,
  };
}

export function subscribeDoctorCarTelemetry(callback) {
  if (typeof callback !== "function") return () => {};
  listeners.add(callback);
  try {
    callback({
      snapshot: lastSnapshot ? cloneSnap(lastSnapshot) : null,
      history: history.map((h) => ({ t: h.t, snapshot: cloneSnap(h.snapshot) })),
      updatedAt: history.length ? history[history.length - 1].t : null,
    });
  } catch {
    /* ignore */
  }
  return () => listeners.delete(callback);
}

/** Test / reset — not used in production paths */
export function resetDoctorCarTelemetryHubForTests() {
  lastSnapshot = null;
  history.length = 0;
}
