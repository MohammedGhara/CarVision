/**
 * Predictive maintenance hints from recent telemetry history (rule-based trends).
 * TODO: Train predictive models on trip-level aggregates in cloud.
 */

import { slopePerSample, batteryVolatilityScore } from "./utils/anomalyDetection.js";
import { TH } from "./rules/thresholds.js";

/**
 * @param {{ t: number, snapshot: object }[]} history
 */
export function runPredictiveEngine(history) {
  if (!Array.isArray(history) || history.length < 15) {
    return [];
  }

  /** @type {object[]} */
  const preds = [];

  const battSlope = slopePerSample(history, "battery", 50);
  if (battSlope != null && battSlope < -0.025) {
    preds.push({
      id: "PRED_BATTERY_DRIFT",
      severity: "warning",
      category: "predictive",
      meta: { slope: battSlope },
    });
  }

  const coolSlope = slopePerSample(history, "coolant", 35);
  if (coolSlope != null && coolSlope > 0.35) {
    preds.push({
      id: "PRED_COOLANT_RISING",
      severity: "warning",
      category: "predictive",
      meta: { slope: coolSlope },
    });
  }

  const voltNoise = batteryVolatilityScore(history);
  if (voltNoise > 38 && voltNoise < 95) {
    preds.push({
      id: "PRED_BATTERY_NOISY",
      severity: "info",
      category: "predictive",
      meta: { volatility: voltNoise },
    });
  }

  const last = history[history.length - 1]?.snapshot;
  const b = last?.battery;
  if (b != null && b < TH.battery.nominalMinV && battSlope != null && battSlope < -0.012) {
    preds.push({
      id: "PRED_CHARGE_WEAK",
      severity: "warning",
      category: "predictive",
    });
  }

  return preds;
}
