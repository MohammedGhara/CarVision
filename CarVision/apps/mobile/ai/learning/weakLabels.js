/**
 * Weak labels — derive training targets without user taps (noise OK for bulk export).
 *
 * Examples:
 * - label 1 if any critical finding or MIL + trims extreme
 * - label 0 if band would be excellent and no codes
 *
 * Used when exporting NDJSON for offline training; prefer user labels when both exist.
 */

/**
 * @param {{ ruleFindings: object[], anomalies: object[], health: { band: string } }} ctx
 * @returns {0|1|null} null = uncertain, skip weak labeling
 */
export function deriveWeakLabel(ctx) {
  const crit =
    (ctx.ruleFindings || []).some((f) => f.severity === "critical") ||
    (ctx.anomalies || []).some((a) => a.severity === "critical");
  if (crit) return 1;

  const band = ctx.health?.band;
  if (band === "excellent") {
    const anyWarn =
      (ctx.ruleFindings || []).some((f) => f.severity === "warning") ||
      (ctx.anomalies || []).length > 0;
    if (!anyWarn) return 0;
  }

  return null;
}
