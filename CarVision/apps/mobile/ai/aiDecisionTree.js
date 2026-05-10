/**
 * Decision tree prioritization for DoctorCar Agent.
 */

import { runSmartDiagnosticsEngine } from "./engine/smartDiagnosticsEngine.js";

const ORDER = { critical: 0, warning: 1, info: 2 };

export function evaluateDecisionTree(normalizedSnapshot) {
  const raw = runSmartDiagnosticsEngine(normalizedSnapshot);
  return [...raw].sort((a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9));
}
