/**
 * Optional one-liner from DoctorCar live telemetry hub (does not start WebSocket).
 * Keeps Vision AI aligned with the same “brain” as DoctorCar when data exists.
 */
import { getDoctorCarTelemetryState } from "../../services/telemetryHub.js";
import { normalizeTelemetrySnapshot } from "../../utils/normalizeTelemetry.js";

export function getDoctorCarVisionContextLine() {
  try {
    const feed = getDoctorCarTelemetryState();
    const snap = normalizeTelemetrySnapshot(feed?.snapshot || feed || {});
    const parts = [];
    if (snap.coolantTempC != null && !Number.isNaN(snap.coolantTempC)) {
      parts.push(`Coolant ~${Math.round(snap.coolantTempC)}°C in last hub snapshot`);
    }
    if (snap.batteryV != null && !Number.isNaN(snap.batteryV)) {
      parts.push(`Battery ~${snap.batteryV.toFixed(1)} V`);
    }
    const codes = [...new Set([...(snap.dtcs || []), ...(snap.pending || [])])].slice(0, 3);
    if (codes.length) parts.push(`Codes: ${codes.join(", ")}`);
    if (!parts.length) return null;
    return `DoctorCar live context: ${parts.join(" · ")} — correlate visually if relevant.`;
  } catch {
    return null;
  }
}
