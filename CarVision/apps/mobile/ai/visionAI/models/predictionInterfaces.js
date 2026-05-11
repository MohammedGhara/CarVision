/**
 * Prediction interfaces for future ML backends (documentation + light registry).
 *
 * @typedef {{ label: string, score: number, bbox?: [number, number, number, number] }} VisionDetection
 * @typedef {(input: { tensorOrUri: unknown, hint?: string }) => Promise<VisionDetection[]>} VisionPredictFn
 * @typedef {{ id: string, version: string, predict: VisionPredictFn }} VisionModelHandle
 */

export const VISION_ML_INTERFACE_VERSION = 1;

/** @type {VisionModelHandle[]} */
export const registeredVisionModels = [];

/**
 * @param {VisionModelHandle} model
 */
export function registerVisionModelHandle(model) {
  registeredVisionModels.push(model);
}
