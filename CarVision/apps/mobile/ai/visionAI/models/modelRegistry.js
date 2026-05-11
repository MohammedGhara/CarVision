/**
 * Vision model registry — placeholder for future:
 * - OpenAI / Gemini vision APIs
 * - Roboflow hosted inference
 * - YOLO / ONNX Runtime React Native
 * - TensorFlow Lite interpreter
 *
 * Register a backend here and implement predict() returning normalized labels + scores.
 */

/** @typedef {{ id: string, label: string, score: number }} VisionLabel */

const registry = [];

/**
 * @param {{ id: string, label: string, predict: (input: { uri: string, hint?: string }) => Promise<VisionLabel[]> }} backend
 */
export function registerVisionBackend(backend) {
  registry.push(backend);
}

export function listVisionBackends() {
  return registry.map((b) => b.id);
}

/**
 * Future: await ONNX session.run() or TFLite interpreter.invoke().
 * For now returns empty — mock pipeline handles classification locally.
 *
 * @param {{ uri: string, hint?: string }} _input
 * @returns {Promise<VisionLabel[]>}
 */
export async function predictWithRegisteredVisionModels(_input) {
  if (registry.length === 0) return [];
  const out = [];
  for (const b of registry) {
    try {
      const labels = await b.predict(_input);
      out.push(...labels);
    } catch {
      // swallow — production would log to crash reporter
    }
  }
  return out;
}
