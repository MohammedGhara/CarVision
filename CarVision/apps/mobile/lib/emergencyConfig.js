// apps/mobile/lib/emergencyConfig.js
// Single source for crash detection, battery thresholds, and default emergency dial targets.

/** @type {const} */
export const CRASH_CONFIG = {
  /** Sample interval ms (Android 12+ may clamp to ≥200ms without high-rate sensor permission). */
  updateIntervalMs: 100,
  /**
   * expo-sensors Accelerometer reports axes in **g**. Total magnitude ≈ 1g at rest.
   * Strong impacts often exceed ~3–5g briefly — tune carefully to balance sensitivity vs false positives.
   */
  magnitudeThresholdG: 3.5,
  /** Require this many consecutive samples above threshold (reduces noise). */
  consecutiveSamples: 2,
  /** Minimum time between crash alerts (ms). */
  cooldownMs: 15000,
  /** Seconds shown on the emergency UI before emphasizing manual actions (no auto-call). */
  countdownSeconds: 10,
};

/** Battery voltage thresholds (volts) — engine-off vs charging band while running. */
export const BATTERY_THRESHOLDS = {
  /** RPM above this ⇒ treat as engine running / alternator charging. */
  engineRunningRpm: 450,
  /** Key-off / idle stop: warn below this. */
  warnEngineOff: 12.2,
  criticalEngineOff: 11.8,
  /** While charging: healthy often ~13.5–14.7V; warn if suspiciously low. */
  warnEngineRunning: 13.0,
  criticalEngineRunning: 12.5,
};

/**
 * Israel emergency services (configurable via UI later).
 * Primary default: MDA / ambulance 101 — user can change in settings when implemented.
 */
export const DEFAULT_EMERGENCY_PRESETS_IL = [
  { id: "police", labelKey: "safetyEmergency.numberPolice", number: "100" },
  { id: "mda", labelKey: "safetyEmergency.numberMda", number: "101" },
  { id: "fire", labelKey: "safetyEmergency.numberFire", number: "102" },
];

export const DEFAULT_PRIMARY_EMERGENCY_NUMBER = "101";
