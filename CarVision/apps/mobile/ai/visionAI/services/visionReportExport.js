/**
 * Vision scan report export — JSON now; PDF via expo-print later (mirror doctorCarPdfHtml pattern).
 */

import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * @param {{ imageUri?: string|null, result: object, mechanicNotes?: string, exportedBy?: string }} input
 */
export function buildVisionScanReportJson(input) {
  return {
    reportVersion: 1,
    product: "CarVision DoctorCar Vision AI",
    generatedAt: new Date().toISOString(),
    exportedBy: input.exportedBy || "CarVision Mobile",
    imageUri: input.imageUri || null,
    /**
     * Future PDF: embed `imageBase64` here after resize; keep JSON lean for sharing.
     * imageBase64: null,
     */
    mechanicNotes: input.mechanicNotes || "",
    scan: input.result,
  };
}

/**
 * @returns {Promise<string>} file URI written
 */
export async function shareVisionReportJson(input) {
  const payload = buildVisionScanReportJson(input);
  const base = FileSystem.cacheDirectory;
  if (!base) {
    throw new Error("File system cache not available on this platform.");
  }
  const path = `${base}vision_scan_${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2), {
    encoding: "utf8",
  });
  const can = await Sharing.isAvailableAsync();
  if (can) {
    await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Vision AI report" });
  }
  return path;
}
