/**
 * Lightweight anomaly helpers over rolling telemetry history (no ML).
 * TODO: Replace with statistical / ML anomaly detector fed by cloud batch jobs.
 */

/** @param {number[]} vals */
export function mean(vals) {
  const a = vals.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!a.length) return null;
  return a.reduce((s, v) => s + v, 0) / a.length;
}

/** @param {number[]} vals */
export function stddev(vals) {
  const m = mean(vals);
  if (m == null) return null;
  const a = vals.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (a.length < 2) return 0;
  const sq = a.reduce((s, v) => s + (v - m) ** 2, 0);
  return Math.sqrt(sq / (a.length - 1));
}

/**
 * Linear slope (units per sample) from last N numeric samples.
 * @param {{ snapshot: object }[]} historyRows
 * @param {string} field
 */
export function slopePerSample(historyRows, field, takeLast = 40) {
  const rows = historyRows.slice(-takeLast);
  const ys = rows.map((r) => r.snapshot?.[field]).filter((v) => typeof v === "number" && Number.isFinite(v));
  if (ys.length < 8) return null;
  const n = ys.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = ys[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

export function batteryVolatilityScore(historyRows) {
  const volts = historyRows
    .slice(-45)
    .map((r) => r.snapshot?.battery)
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  const sd = stddev(volts);
  if (sd == null) return 0;
  return Math.min(100, sd * 80);
}

/**
 * Largest step change between consecutive samples for a numeric field (RPM spikes, etc.).
 * @param {{ snapshot: object }[]} historyRows
 */
export function maxStepDelta(historyRows, field, takeLast = 35) {
  const rows = historyRows.slice(-takeLast);
  let maxD = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].snapshot?.[field];
    const b = rows[i].snapshot?.[field];
    if (typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b)) {
      maxD = Math.max(maxD, Math.abs(b - a));
    }
  }
  return maxD;
}

/** Absolute delta between last two numeric samples for `field`. */
export function lastPairDelta(historyRows, field) {
  const rows = historyRows.slice(-2);
  if (rows.length < 2) return null;
  const a = rows[0].snapshot?.[field];
  const b = rows[1].snapshot?.[field];
  if (typeof a !== "number" || typeof b !== "number") return null;
  return Math.abs(b - a);
}
