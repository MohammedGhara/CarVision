/**
 * 0–100 vehicle health score from findings + optional predictive hints.
 */

const PEN = {
  COOLANT_CRITICAL: 28,
  COOLANT_HIGH: 14,
  BATTERY_CRITICAL_LOW: 26,
  BATTERY_WARN_LOW: 12,
  BATTERY_HIGH: 10,
  RPM_EXTREME: 22,
  RPM_ELEVATED: 10,
  TRIM_EXTREME: 18,
  TRIM_HIGH: 10,
  LOAD_HIGH_IDLE: 10,
  FUEL_CRITICAL: 14,
  FUEL_LOW: 6,
  MIL_OR_CODES_PRESENT: 8,
  DTC_COUNT_HIGH: 16,
  CORR_TRIM_LEAN_LOAD: 12,
  CORR_MAP_IDLE_HIGH: 10,
};

const PEN_PRED = {
  PRED_BATTERY_DRIFT: 8,
  PRED_COOLANT_RISING: 12,
  PRED_BATTERY_NOISY: 6,
  PRED_CHARGE_WEAK: 10,
};

/** Temporal anomalies — see anomalyDetector.js */
const PEN_ANOM = {
  ANOM_RPM_SPIKE: 14,
  ANOM_VOLTAGE_UNSTABLE: 8,
  ANOM_THROTTLE_LOAD_MISMATCH: 10,
  ANOM_TRIM_SWING: 7,
  ANOM_COOLANT_SURGE: 11,
  ANOM_MAP_FLUTTER_IDLE: 4,
};

export function computeHealthScore(findings, predictiveHints = []) {
  let score = 100;
  const applied = [];

  for (const f of findings) {
    const p = PEN[f.id] ?? PEN_ANOM[f.id];
    if (p != null) {
      score -= p;
      applied.push({ id: f.id, penalty: p });
    }
  }
  for (const p of predictiveHints) {
    const pen = PEN_PRED[p.id];
    if (pen != null) {
      score -= pen;
      applied.push({ id: p.id, penalty: pen });
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let band = "critical";
  if (score >= 95) band = "excellent";
  else if (score >= 80) band = "good";
  else if (score >= 60) band = "warning";

  return { score, band, applied };
}
