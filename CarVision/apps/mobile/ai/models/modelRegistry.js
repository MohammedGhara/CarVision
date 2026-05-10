/**
 * ML model registry — interface contracts for future ONNX / TensorFlow Lite runtimes.
 *
 * HOW TO PLUG IN REAL MODELS LATER:
 * 1. Train offline on datasets exported from datasets/featureExtractor rows + labels (fault vs OK).
 * 2. Convert to ONNX / TFLite; bundle small models in app assets or download per fleet.
 * 3. Implement ModelRuntimeAdapter below using onnxruntime-react-native or tf lite delegate.
 * 4. In doctorCarAgent (or anomalyDetector), call registry.predict("anomaly_v1", features) when ModelRuntimeAdapter.isReady().
 */

/** @typedef {{ name: string, version: string, inputDim: number, outputs: string[] }} ModelDescriptor */

/** @type {Record<string, ModelDescriptor>} */
export const REGISTERED_MODELS = {
  anomaly_autoencoder_placeholder: {
    name: "anomaly_autoencoder_placeholder",
    version: "0.0.0",
    inputDim: 32,
    outputs: ["reconstruction_error"],
  },
  fault_risk_classifier_v1: {
    name: "fault_risk_classifier_v1",
    version: "0.0.0",
    inputDim: 32,
    outputs: ["faultRisk"],
  },
};

/**
 * Future: load asset URIs, initialize inference sessions.
 * @returns {Promise<boolean>}
 */
export async function warmStartModels() {
  // TODO: await ort.InferenceSession.create(...)
  return false;
}

/**
 * @param {string} modelKey
 * @param {Float32Array | number[]} features — see datasets/featureExtractor.js
 */
export async function predictWithRegisteredModel(modelKey, features) {
  void modelKey;
  void features;
  // Placeholder — never blocks UI; callers must fall back to rule engine when null.
  return null;
}
