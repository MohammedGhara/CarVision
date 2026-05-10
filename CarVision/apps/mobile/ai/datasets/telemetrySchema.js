/**
 * Schema for ML-ready telemetry rows (documentation + optional JSON export).
 *
 * A single row can represent one poll snapshot or an aggregated window.
 */

/** @type {const} */
export const TELEMETRY_ROW_SCHEMA = {
  version: "1.0.0",
  fields: [
    "t_unix_ms",
    "rpm",
    "speed",
    "coolant_c",
    "battery_v",
    "load_pct",
    "throttle_pct",
    "fuel_pct",
    "maf_gps",
    "map_kpa",
    "stft_pct",
    "ltft_pct",
    "mil_on",
    "dtc_count",
  ],
};

export function emptyRowTemplate() {
  return Object.fromEntries(TELEMETRY_ROW_SCHEMA.fields.map((k) => [k, null]));
}
