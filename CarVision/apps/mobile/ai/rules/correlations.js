/**
 * Cross-sensor correlation checks (rule-based).
 */

import { TH } from "./thresholds.js";

/**
 * @param {import("../utils/normalizeTelemetry.js").normalizeTelemetrySnapshot extends Function ? any : any} snap normalized snapshot
 * @returns {{ id: string, severity: string, detail: string }[]}
 */
export function runCorrelationChecks(snap) {
  const out = [];
  const st = snap.stft;
  const lt = snap.ltft;
  const rpm = snap.rpm ?? 0;
  const load = snap.load ?? 0;
  const mapVal = snap.map;

  // Lean condition + elevated trims at cruise-ish RPM
  if (
    rpm > 1800 &&
    st != null &&
    lt != null &&
    st > 12 &&
    lt > 10 &&
    load != null &&
    load > 35
  ) {
    out.push({
      id: "CORR_TRIM_LEAN_LOAD",
      severity: "warning",
      detail: "short_term_long_term_trim_correlation",
    });
  }

  // High MAP at idle suggests vacuum leak / stuck throttle perception
  if (rpm > 650 && rpm < 1100 && mapVal != null && mapVal > TH.map.idleHighKpa) {
    out.push({
      id: "CORR_MAP_IDLE_HIGH",
      severity: "warning",
      detail: "high_map_at_idle",
    });
  }

  return out;
}
