/**
 * Rule-based diagnostic findings from a normalized snapshot + correlations.
 */

import { TH } from "../rules/thresholds.js";
import { runCorrelationChecks } from "../rules/correlations.js";

function push(arr, item) {
  arr.push(item);
}

/**
 * @param {ReturnType<import("../utils/normalizeTelemetry.js").normalizeTelemetrySnapshot>} snap
 */
export function runSmartDiagnosticsEngine(snap) {
  /** @type {object[]} */
  const findings = [];

  const coolant = snap.coolant;
  if (coolant != null) {
    if (coolant >= TH.coolant.critC) {
      push(findings, { id: "COOLANT_CRITICAL", severity: "critical", category: "thermal", value: coolant });
    } else if (coolant >= TH.coolant.warnC) {
      push(findings, { id: "COOLANT_HIGH", severity: "warning", category: "thermal", value: coolant });
    }
  }

  const batt = snap.battery;
  if (batt != null) {
    if (batt < TH.battery.critLowV) {
      push(findings, { id: "BATTERY_CRITICAL_LOW", severity: "critical", category: "electrical", value: batt });
    } else if (batt < TH.battery.warnLowV) {
      push(findings, { id: "BATTERY_WARN_LOW", severity: "warning", category: "electrical", value: batt });
    }
    if (batt > TH.battery.warnHighV) {
      push(findings, { id: "BATTERY_HIGH", severity: "warning", category: "electrical", value: batt });
    }
  }

  const rpm = snap.rpm ?? 0;
  if (rpm > TH.rpm.idleHigh && rpm < TH.rpm.redlineSoft) {
    push(findings, { id: "RPM_ELEVATED", severity: "warning", category: "engine", value: rpm });
  }
  if (rpm >= TH.rpm.redlineSoft) {
    push(findings, { id: "RPM_EXTREME", severity: "critical", category: "engine", value: rpm });
  }

  const st = snap.stft;
  const lt = snap.ltft;
  const trimMax = Math.max(
    st != null ? Math.abs(st) : 0,
    lt != null ? Math.abs(lt) : 0
  );
  if (trimMax >= TH.trims.critAbs) {
    push(findings, { id: "TRIM_EXTREME", severity: "critical", category: "fuel", value: trimMax });
  } else if (trimMax >= TH.trims.warnAbs) {
    push(findings, { id: "TRIM_HIGH", severity: "warning", category: "fuel", value: trimMax });
  }

  const load = snap.load;
  if (rpm > 600 && rpm < 1200 && load != null && load > TH.engineLoad.warnIdle) {
    push(findings, { id: "LOAD_HIGH_IDLE", severity: "warning", category: "engine", value: load });
  }

  const fuel = snap.fuel;
  if (fuel != null) {
    if (fuel <= TH.fuelPct.crit) {
      push(findings, { id: "FUEL_CRITICAL", severity: "critical", category: "fuel", value: fuel });
    } else if (fuel <= TH.fuelPct.low) {
      push(findings, { id: "FUEL_LOW", severity: "warning", category: "fuel", value: fuel });
    }
  }

  const totalCodes =
    (snap.dtcs?.length || 0) + (snap.pending?.length || 0) + (snap.permanent?.length || 0);
  if (snap.monitors?.milOn || totalCodes > 0) {
    push(findings, { id: "MIL_OR_CODES_PRESENT", severity: totalCodes >= 3 ? "warning" : "info", category: "obd", value: totalCodes });
  }
  if (totalCodes >= 5) {
    push(findings, { id: "DTC_COUNT_HIGH", severity: "critical", category: "obd", value: totalCodes });
  }

  for (const c of runCorrelationChecks(snap)) {
    push(findings, {
      id: c.id,
      severity: c.severity,
      category: "correlation",
      detail: c.detail,
    });
  }

  return findings;
}
