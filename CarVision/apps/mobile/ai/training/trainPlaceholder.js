/**
 * OFFLINE TRAINING PIPELINE (PLACEHOLDER)
 *
 * Intended supervised workflow for a future semester / cloud worker:
 *
 * 1) Collect labeled trips:
 *    - X: feature vectors from datasets/featureExtractor.js (per window or per trip aggregate).
 *    - y: labels from mechanics (fault present), or weak labels from DTC appearance within Δt.
 *
 * 2) Split train/val by vehicle or date to avoid leakage.
 *
 * 3) Train lightweight models:
 *    - Gradient boosting / small MLP for health score residual vs rule baseline.
 *    - Autoencoder on normal-only data for anomaly scores (reconstruction error).
 *
 * 4) Export ONNX with fixed input shapes matching REGISTERED_MODELS in models/modelRegistry.js.
 *
 * 5) Ship model asset + version gate in app (remote config).
 *
 * This file intentionally contains no training dependencies to keep the Expo app lean.
 */

export const TRAINING_PIPELINE_VERSION = "0.1.0-placeholder";

export function describeTrainingStub() {
  return TRAINING_PIPELINE_VERSION;
}
