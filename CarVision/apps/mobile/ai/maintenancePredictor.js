/**
 * Maintenance outlook — combines predictive engine hints into human-facing maintenance windows.
 *
 * Rule-based today; future: survival analysis / RUL models trained on datasets exported via
 * services/telemetryCollector + training/trainPlaceholder pipeline.
 */

import { runPredictiveEngine } from "./predictiveEngine.js";

const PRED_TO_MAINT = {
  PRED_BATTERY_DRIFT: { id: "MAINT_BATTERY_SOON", priority: "within_days", predRef: "PRED_BATTERY_DRIFT" },
  PRED_COOLANT_RISING: { id: "MAINT_COOLING_SOON", priority: "urgent_if_persistent", predRef: "PRED_COOLANT_RISING" },
  PRED_BATTERY_NOISY: { id: "MAINT_ELECTRICAL_CHECK", priority: "within_week", predRef: "PRED_BATTERY_NOISY" },
  PRED_CHARGE_WEAK: { id: "MAINT_CHARGING_SYSTEM", priority: "within_days", predRef: "PRED_CHARGE_WEAK" },
};

/**
 * @param {{ t:number, snapshot:object }[]} history
 * @param {{ anomalies?: object[], findings?: object[], predictive?: object[] }} ctx
 */
export function runMaintenancePredictor(history, ctx = {}) {
  const predictive = Array.isArray(ctx.predictive) ? ctx.predictive : runPredictiveEngine(history);
  /** @type {{ id: string, priority: string, predRef?: string, source: string }[]} */
  const items = [];

  for (const p of predictive) {
    const m = PRED_TO_MAINT[p.id];
    if (m) {
      items.push({ ...m, source: "predictive" });
    }
  }

  if ((ctx.anomalies || []).some((a) => a.id === "ANOM_COOLANT_SURGE")) {
    items.push({
      id: "MAINT_COOLING_INSPECT",
      priority: "schedule_soon",
      source: "anomaly",
    });
  }

  const findings = ctx.findings || [];
  if (findings.some((f) => f.id === "TRIM_HIGH" || f.id === "TRIM_EXTREME" || f.id === "CORR_TRIM_LEAN_LOAD")) {
    items.push({
      id: "MAINT_INTAKE_FUEL_TRIM",
      priority: "when_convenient",
      source: "finding",
    });
  }

  return {
    outlookItems: dedupeMaint(items),
    predictiveRaw: predictive,
  };
}

function dedupeMaint(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}
