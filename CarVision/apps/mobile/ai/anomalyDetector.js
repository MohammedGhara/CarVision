/**
 * DoctorCar anomaly detector — temporal / residual checks over rolling history.
 *
 * This layer sits beside the snapshot rule engine: it answers “did behavior just change oddly?”
 * Future ML: swap implementations behind this module with an ONNX anomaly scorer fed by
 * datasets/featureExtractor.extractTripFeatures().
 */

import {
  batteryVolatilityScore,
  maxStepDelta,
  lastPairDelta,
  slopePerSample,
} from "./utils/anomalyDetection.js";

/**
 * @typedef {{ id: string, severity: string, category: string, meta?: object }} AnomalyFinding
 */

/**
 * @param {{ t:number, snapshot:object }[]} history
 * @param {object} snap — normalized snapshot (same moment as last history row when available)
 */
export function runAnomalyDetector(history, snap) {
  if (!Array.isArray(history) || history.length < 6) return [];

  /** @type {AnomalyFinding[]} */
  const out = [];

  const rpmJump = maxStepDelta(history, "rpm", 40);
  // Rapid RPM swing between consecutive polls — harsh throttle or sensor glitch
  if (rpmJump >= 1400) {
    out.push({
      id: "ANOM_RPM_SPIKE",
      severity: rpmJump >= 2400 ? "critical" : "warning",
      category: "anomaly",
      meta: { rpmJump },
    });
  }

  const voltNoise = batteryVolatilityScore(history);
  // Distinct from PRED_BATTERY_NOISY timing — flagged earlier / stronger instability
  if (voltNoise >= 52) {
    out.push({
      id: "ANOM_VOLTAGE_UNSTABLE",
      severity: voltNoise >= 72 ? "warning" : "info",
      category: "anomaly",
      meta: { volatility: voltNoise },
    });
  }

  const throttle = snap.throttle;
  const speed = snap.speed;
  const rpm = snap.rpm ?? 0;
  // Pedal demand without vehicle motion — traction / sensor / stuck context hint
  if (
    throttle != null &&
    speed != null &&
    throttle > 42 &&
    speed < 12 &&
    rpm > 900 &&
    rpm < 3800
  ) {
    out.push({
      id: "ANOM_THROTTLE_LOAD_MISMATCH",
      severity: "warning",
      category: "anomaly",
      meta: { throttle, speed, rpm },
    });
  }

  const trimSwing = lastPairDelta(history, "stft");
  if (trimSwing != null && trimSwing > 14) {
    out.push({
      id: "ANOM_TRIM_SWING",
      severity: trimSwing > 22 ? "warning" : "info",
      category: "anomaly",
      meta: { stftDelta: trimSwing },
    });
  }

  const coolSlope = slopePerSample(history, "coolant", 28);
  if (coolSlope != null && coolSlope > 0.42 && (snap.coolant ?? 0) > 96) {
    out.push({
      id: "ANOM_COOLANT_SURGE",
      severity: "warning",
      category: "anomaly",
      meta: { slope: coolSlope, coolant: snap.coolant },
    });
  }

  const mapSwing = maxStepDelta(history, "map", 25);
  if (mapSwing >= 18 && rpm > 700 && rpm < 1400) {
    out.push({
      id: "ANOM_MAP_FLUTTER_IDLE",
      severity: "info",
      category: "anomaly",
      meta: { mapSwing },
    });
  }

  return out;
}
