/**
 * Narrative templates — swap body with OpenAI / cloud voice later.
 * TODO: Prompt injection guardrails + streaming responses.
 */

/**
 * Returns i18n keys under doctorCar.analysisLine.* for up to 3 sentences (prioritized).
 * @param {{
 *   ruleFindings: object[],
 *   anomalies: object[],
 *   predictive: object[],
 *   codes: string[],
 *   mlBlendedRisk?: number|null,
 * }} ctx
 */
export function pickAnalysisLineKeys(ctx) {
  const { ruleFindings, anomalies, predictive, codes, mlBlendedRisk } = ctx;
  /** @type {string[]} */
  const keys = [];

  if (typeof mlBlendedRisk === "number" && mlBlendedRisk >= 0.52) {
    keys.push("mlLearnedRisk");
  }

  const hasCool =
    ruleFindings.some((f) => f.id === "COOLANT_CRITICAL" || f.id === "COOLANT_HIGH") ||
    anomalies.some((a) => a.id === "ANOM_COOLANT_SURGE");
  if (hasCool) keys.push("coolingSystem");

  const battStress =
    predictive.some((p) => p.id === "PRED_BATTERY_DRIFT" || p.id === "PRED_CHARGE_WEAK") ||
    anomalies.some((a) => a.id === "ANOM_VOLTAGE_UNSTABLE") ||
    ruleFindings.some((f) => f.id === "BATTERY_WARN_LOW" || f.id === "BATTERY_CRITICAL_LOW");
  if (battStress) keys.push("batteryInstability");

  const trimIssue =
    ruleFindings.some((f) =>
      ["TRIM_HIGH", "TRIM_EXTREME", "CORR_TRIM_LEAN_LOAD"].includes(f.id)
    ) || anomalies.some((a) => a.id === "ANOM_TRIM_SWING");
  if (trimIssue) keys.push("fuelTrimImbalance");

  if (
    predictive.some((p) => p.id === "PRED_COOLANT_RISING") &&
    !keys.includes("coolingSystem")
  ) {
    keys.push("thermalTrend");
  }

  if (codes?.length > 0 && !keys.length) keys.push("codesPresent");

  if (keys.length === 0) keys.push("nominal");

  return keys.slice(0, 3);
}

export function buildSummarySentence({ band }) {
  if (band === "excellent") return "Vehicle signals look stable — continue monitoring while driving.";
  if (band === "good") return "Minor anomalies detected — review warnings and plan maintenance if needed.";
  if (band === "warning") return "Several caution signals — verify coolant, charging, and fuel trims soon.";
  return "Critical risk signals — reduce load and seek professional diagnosis.";
}

export function buildFleetIntro() {
  return "DoctorCar uses explainable rules plus optional learning from labeled snapshots — always verify critical faults with a technician.";
}
