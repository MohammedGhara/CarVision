/**
 * Optional in-memory ring buffer of feature vectors for ML dataset export / debugging.
 * Disabled by default — enable only when building training corpora (dev / pilot).
 */

import { extractFeatureVector } from "../datasets/featureExtractor.js";

const ENABLED = false;
const MAX_ROWS = 600;
/** @type {number[][]} */
const ring = [];

/**
 * Called from telemetryHub after each ingest (cheap no-op when ENABLED=false).
 * @param {object} normalizedSnapshot
 * @param {{ snapshot: object }[]} historyTail
 */
export function maybeRecordMlSample(normalizedSnapshot, historyTail) {
  if (!ENABLED || !normalizedSnapshot) return;
  try {
    const vec = extractFeatureVector(normalizedSnapshot, historyTail);
    ring.push(vec);
    while (ring.length > MAX_ROWS) ring.shift();
  } catch {
    /* ignore */
  }
}

/** @returns {number[][]} snapshot of buffered rows */
export function exportBufferedFeatureMatrix() {
  return ring.slice();
}

export function clearMlBuffer() {
  ring.length = 0;
}
