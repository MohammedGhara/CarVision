/**
 * Single entry for ML augmentation — prototype learner now; ONNX later.
 *
 * Async models can be wired without blocking runDoctorCarAgent by prefetching
 * in the UI; this module stays sync-friendly for the agent tick.
 */

import { predictPrototypeFaultRisk } from "../learning/onDevicePrototypeLearner.js";
import { predictWithRegisteredModel } from "../models/modelRegistry.js";

/**
 * @param {number[]} features
 * @returns {Promise<{ prototypeFaultRisk: number|null, modelFaultRisk: number|null, blendedFaultRisk: number|null }>}
 */
export async function runMlAugmentationAsync(features) {
  const proto = predictPrototypeFaultRisk(features);
  let modelFaultRisk = null;
  try {
    const out = await predictWithRegisteredModel("fault_risk_classifier_v1", features);
    if (out && typeof out.faultRisk === "number") modelFaultRisk = out.faultRisk;
  } catch {
    modelFaultRisk = null;
  }
  const blended = modelFaultRisk != null ? modelFaultRisk : proto;
  return {
    prototypeFaultRisk: proto,
    modelFaultRisk,
    blendedFaultRisk: blended != null ? Math.max(0, Math.min(1, blended)) : null,
  };
}

/**
 * Synchronous path for rule agent (prototype only).
 * @param {number[]} features
 */
export function runMlAugmentationSync(features) {
  const prototypeFaultRisk = predictPrototypeFaultRisk(features);
  return {
    prototypeFaultRisk,
    modelFaultRisk: null,
    blendedFaultRisk: prototypeFaultRisk,
  };
}
