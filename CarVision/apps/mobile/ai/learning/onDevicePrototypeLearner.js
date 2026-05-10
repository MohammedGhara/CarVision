/**
 * Minimal on-device "learning" — centroid classifier over user-labeled feature vectors.
 *
 * Not deep learning: fast, explainable, thesis-demo friendly (shows weights-free learning).
 * When you collect enough labeled taps (healthy vs fault), new snapshots get a fault
 * probability by distance to each class centroid.
 *
 * REPLACE LATER with ONNX/TFLite model trained on the exported dataset + garage labels.
 */

import { getSamplesSync } from "./labeledDataset.js";

const DIM = 32;

function meanVec(samples, label) {
  const rows = samples.filter((s) => s.label === label);
  if (rows.length === 0) return null;
  const acc = new Array(DIM).fill(0);
  let n = 0;
  for (const r of rows) {
    const v = r.features;
    if (!Array.isArray(v) || v.length < DIM) continue;
    n += 1;
    for (let i = 0; i < DIM; i++) acc[i] += v[i] ?? 0;
  }
  if (n < 1) return null;
  return acc.map((x) => x / n);
}

function euclidean(a, b) {
  let s = 0;
  for (let i = 0; i < DIM; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    s += d * d;
  }
  return Math.sqrt(s);
}

const MIN_PER_CLASS = 4;

/**
 * @param {number[]} features
 * @returns {number | null} fault probability [0,1] or null if not trained
 */
export function predictPrototypeFaultRisk(features) {
  if (!Array.isArray(features) || features.length < DIM) return null;
  const samples = getSamplesSync();
  const c0 = meanVec(samples, 0);
  const c1 = meanVec(samples, 1);
  const n0 = samples.filter((s) => s.label === 0).length;
  const n1 = samples.filter((s) => s.label === 1).length;
  if (!c0 || !c1 || n0 < MIN_PER_CLASS || n1 < MIN_PER_CLASS) return null;

  const fv = features.slice(0, DIM);
  const d0 = euclidean(fv, c0);
  const d1 = euclidean(fv, c1);
  // Near fault centroid (small d1) => risk up
  const denom = d0 + d1 + 1e-9;
  let risk = d0 / denom;
  // Sharpen slightly for UX
  risk = Math.max(0, Math.min(1, (risk - 0.5) * 1.15 + 0.5));
  return risk;
}
