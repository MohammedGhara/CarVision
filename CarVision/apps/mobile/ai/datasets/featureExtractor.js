/**
 * Feature extraction for classical + future ML models.
 * Build a fixed-length numeric vector from a normalized snapshot + simple history stats.
 */

import { mean, stddev } from "../utils/anomalyDetection.js";

/**
 * @param {object} snap — normalized snapshot
 * @param {{ snapshot: object }[]} historyTail — last N rows from hub history
 * @returns {number[]}
 */
export function extractFeatureVector(snap, historyTail = []) {
  const tail = Array.isArray(historyTail) ? historyTail.slice(-40) : [];
  const volts = tail.map((r) => r.snapshot?.battery).filter((v) => typeof v === "number");
  const temps = tail.map((r) => r.snapshot?.coolant).filter((v) => typeof v === "number");

  const batMean = mean(volts);
  const batSd = stddev(volts);
  const coolMean = mean(temps);

  const row = [
    snap.rpm ?? -1,
    snap.speed ?? -1,
    snap.coolant ?? -1,
    snap.battery ?? -1,
    snap.load ?? -1,
    snap.throttle ?? -1,
    snap.fuel ?? -1,
    snap.maf ?? -1,
    snap.map ?? -1,
    snap.stft ?? 0,
    snap.ltft ?? 0,
    snap.monitors?.milOn ? 1 : 0,
    (snap.dtcs?.length || 0) + (snap.pending?.length || 0),
    batMean ?? -1,
    batSd ?? -1,
    coolMean ?? -1,
  ];

  // Pad / truncate to 32 dims for modelRegistry placeholders
  const target = 32;
  const v = row.slice();
  while (v.length < target) v.push(0);
  return v.slice(0, target);
}
