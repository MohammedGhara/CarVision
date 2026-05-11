/**
 * Professional Vision narrative — DoctorCar tone (safety-forward, automotive).
 */

/**
 * @param {import('../models/scanTypes.js').VisionScanResult} result
 * @param {{ userHint?: string|null }} [opts]
 */
export function buildVisionNarrative(result, opts = {}) {
  const hint = opts.userHint ? ` Operator note: “${String(opts.userHint).trim()}”.` : "";
  const drive =
    result.continueDriving === "yes"
      ? "From this visual assessment alone, there is no immediate red flag suggesting you must stop; still verify fluid levels and unusual smells/noises."
      : result.continueDriving === "no"
        ? "Given the pattern implied by the image cues, continuing operation could be unsafe. Treat this as a stop-and-service situation unless a qualified technician clears the vehicle."
        : "Short, cautious travel to a repair facility may be reasonable if fluids, temperatures, and brakes feel normal — avoid highway speeds and heavy loading until verified.";

  return (
    `DoctorCar Vision AI assessment: ${result.detectedPartName} — ${result.possibleIssue}. ` +
    `Estimated urgency: ${result.urgency}. Confidence ${Math.round(result.confidence)}% (mock vision pipeline — verify in person). ` +
    drive +
    hint
  );
}
