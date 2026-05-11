/**
 * Shared Vision scan types — keep in sync with visionAgent output.
 * PDF export, Supabase sync, and UI should consume this shape.
 */

/** @typedef {'low'|'medium'|'high'|'critical'} VisionUrgency */
/** @typedef {'yes'|'no'|'caution'} VisionDriveAdvice */

/**
 * @typedef {object} VisionScanResult
 * @property {string} id — unique scan id (client-generated)
 * @property {number} timestamp
 * @property {string} detectedPartName
 * @property {string} possibleIssue
 * @property {number} confidence — 0..100
 * @property {string[]} causes
 * @property {string[]} recommendations
 * @property {VisionUrgency} urgency
 * @property {VisionDriveAdvice} continueDriving
 * @property {string} continueDrivingRationale
 * @property {string[]} suggestedRepairActions
 * @property {string} repairCostCategory — '$' | '$$' | etc.
 * @property {string[]} maintenanceTips
 * @property {string} narrative — DoctorCar-style prose
 * @property {string} category
 * @property {string} matchSource — 'knowledge_base' | 'generic' | 'demo_seed' | 'openai'
 * @property {number[]} featureVector — mock embedding dim for future ONNX/TFLite
 * @property {string|null} doctorCarContextLine — optional bridge from live telemetry
 */

export const VISION_DRIVE_LABELS = {
  yes: "Safe to drive (monitor)",
  no: "Do not drive — arrange service/tow",
  caution: "Drive with caution — short distance / to shop only",
};

export const URGENCY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
