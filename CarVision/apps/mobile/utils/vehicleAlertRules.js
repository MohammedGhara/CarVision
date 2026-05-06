// apps/mobile/utils/vehicleAlertRules.js
import { BATTERY_THRESHOLDS } from "../lib/emergencyConfig";

/**
 * Resolve ECU/battery voltage from telemetry (same fields as Live Data).
 * @param {{ battery?: number|null, moduleVoltage?: number|null, rpm?: number|null }} telemetrySlice
 * @returns {number|null}
 */
export function getBatteryVoltageVolts(telemetrySlice) {
  if (!telemetrySlice) return null;
  const b = telemetrySlice.battery;
  const m = telemetrySlice.moduleVoltage;
  const candidates = [b, m].filter((x) => x != null && Number.isFinite(Number(x)));
  if (!candidates.length) return null;
  return Number(candidates[0]);
}

/**
 * @returns {"normal"|"warning"|"critical"|"unknown"}
 */
export function classifyBatteryAlert(telemetrySlice) {
  const v = getBatteryVoltageVolts(telemetrySlice);
  if (v == null) return "unknown";
  const rpm = telemetrySlice.rpm;
  const running =
    rpm != null && Number.isFinite(Number(rpm)) && Number(rpm) >= BATTERY_THRESHOLDS.engineRunningRpm;

  if (running) {
    if (v < BATTERY_THRESHOLDS.criticalEngineRunning) return "critical";
    if (v < BATTERY_THRESHOLDS.warnEngineRunning) return "warning";
    return "normal";
  }
  if (v < BATTERY_THRESHOLDS.criticalEngineOff) return "critical";
  if (v < BATTERY_THRESHOLDS.warnEngineOff) return "warning";
  return "normal";
}
