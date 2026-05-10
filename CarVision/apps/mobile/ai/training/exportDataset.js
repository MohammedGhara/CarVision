/**
 * Export supervised + schema for Colab / Python training.
 *
 * Workflow:
 * 1) User collects labels on device (or adds weak-labeled rows from exporter script).
 * 2) Share JSON from app → train RandomForest / small MLP → export ONNX.
 * 3) Bundle ONNX; implement predictWithRegisteredModel in modelRegistry.js.
 */

import { getSamplesSync } from "../learning/labeledDataset.js";
import { TELEMETRY_ROW_SCHEMA } from "../datasets/telemetrySchema.js";

export function buildSupervisedExportPayload() {
  const rows = getSamplesSync();
  return {
    schema: "carvision_supervised_v1",
    featureDim: 32,
    telemetrySchemaRef: TELEMETRY_ROW_SCHEMA.version,
    exportedAt: new Date().toISOString(),
    count: rows.length,
    samples: rows.map((r) => ({
      id: r.id,
      t: r.t,
      label: r.label,
      source: r.source,
      features: r.features,
    })),
  };
}
