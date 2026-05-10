/**
 * Recommendation engine — maps fused signals to operational guidance keys for i18n.
 * Explainable: priority follows severity order + drive-risk heuristics.
 * TODO: personalize by vehicle profile / OpenAI narrative layer.
 */

export const RISK_LEVEL = {
  LOW: "low",
  MODERATE: "moderate",
  HIGH: "high",
  SEVERE: "severe",
};

export const DRIVE_ADVICE = {
  CONTINUE: "continue",
  CAUTION: "caution",
  STOP: "stop",
};

/**
 * @param {string} severity
 */
export function urgencyFromSeverity(severity) {
  if (severity === "critical") return "stop_or_service_now";
  if (severity === "warning") return "service_soon";
  return "monitor";
}

/**
 * @param {{
 *   health: { band: string, score: number },
 *   ruleFindings: object[],
 *   anomalies: object[],
 *   predictive: object[],
 * }} ctx
 */
export function buildRecommendationPlan(ctx) {
  const { health, ruleFindings, anomalies, predictive } = ctx;

  const critRule = ruleFindings.some((f) => f.severity === "critical");
  const critAnom = anomalies.some((f) => f.severity === "critical");
  const warnHot =
    ruleFindings.some((f) => f.id === "COOLANT_CRITICAL" || f.id === "COOLANT_HIGH") ||
    anomalies.some((a) => a.id === "ANOM_COOLANT_SURGE");

  let riskLevel = RISK_LEVEL.LOW;
  if (health.band === "critical" || critRule || critAnom) riskLevel = RISK_LEVEL.SEVERE;
  else if (health.band === "warning" || ruleFindings.some((f) => f.severity === "warning")) riskLevel = RISK_LEVEL.HIGH;
  else if (health.band === "good" && (predictive.some((p) => p.severity === "warning") || anomalies.length > 0)) {
    riskLevel = RISK_LEVEL.MODERATE;
  }

  let driveAdvice = DRIVE_ADVICE.CONTINUE;
  if (riskLevel === RISK_LEVEL.SEVERE || critRule || critAnom) driveAdvice = DRIVE_ADVICE.STOP;
  else if (riskLevel === RISK_LEVEL.HIGH || warnHot) driveAdvice = DRIVE_ADVICE.CAUTION;

  const primaryActionKey = pickPrimaryActionKey({
    critRule,
    critAnom,
    warnHot,
    ruleFindings,
    anomalies,
    predictive,
    riskLevel,
  });

  const secondaryActionKeys = pickSecondaryKeys(ruleFindings, anomalies, predictive, primaryActionKey);

  return {
    riskLevel,
    driveAdvice,
    primaryActionKey,
    secondaryActionKeys,
  };
}

function pickPrimaryActionKey({ critRule, critAnom, warnHot, ruleFindings, anomalies, predictive, riskLevel }) {
  if (critRule || critAnom || riskLevel === RISK_LEVEL.SEVERE) return "action.stop_and_service";
  if (warnHot) return "action.cooling_check";
  if (ruleFindings.some((f) => f.id === "BATTERY_CRITICAL_LOW" || f.id === "BATTERY_WARN_LOW")) {
    return "action.battery_inspect";
  }
  if (predictive.some((p) => p.id === "PRED_CHARGE_WEAK" || p.id === "PRED_BATTERY_DRIFT")) {
    return "action.charging_test";
  }
  if (ruleFindings.some((f) => f.id === "TRIM_HIGH" || f.id === "TRIM_EXTREME" || f.id === "CORR_TRIM_LEAN_LOAD")) {
    return "action.intake_trim_followup";
  }
  if (anomalies.some((a) => a.id === "ANOM_VOLTAGE_UNSTABLE")) return "action.electrical_check";
  if (ruleFindings.some((f) => f.id === "MIL_OR_CODES_PRESENT" || f.id === "DTC_COUNT_HIGH")) {
    return "action.scan_garage_visit";
  }
  return "action.continue_monitor";
}

function pickSecondaryKeys(ruleFindings, anomalies, predictive, primary) {
  const keys = new Set();
  if (ruleFindings.some((f) => f.id === "FUEL_LOW" || f.id === "FUEL_CRITICAL")) keys.add("action.refuel");
  if (predictive.some((p) => p.id === "PRED_COOLANT_RISING")) keys.add("action.cooling_watch");
  if (anomalies.some((a) => a.id === "ANOM_THROTTLE_LOAD_MISMATCH")) keys.add("action.verify_pedal_traction");
  if (ruleFindings.some((f) => f.id === "RPM_EXTREME")) keys.add("action.reduce_load");
  keys.delete(primary);
  return [...keys].slice(0, 4);
}
