/**
 * Calls CarVision server OpenAI vision proxy — never embed API keys in the app.
 */
import { api } from "../../../lib/api";

/**
 * @param {{ imageUri: string, hint?: string|null, doctorContext?: string|null }} input
 * @returns {Promise<object>} server `result` object (normalized scan fields)
 */
export async function analyzeVisionRemote(input) {
  const { imageUri, hint, doctorContext } = input;
  if (!imageUri || String(imageUri).startsWith("demo://")) {
    throw new Error("invalid image for remote vision");
  }

  const form = new FormData();
  const name = imageUri.split("/").pop()?.split("?")[0] || "vision.jpg";
  const lower = name.toLowerCase();
  const type = lower.endsWith(".png") ? "image/png" : "image/jpeg";

  form.append("image", /** @type {any} */ ({ uri: imageUri, name, type }));
  if (hint) form.append("hint", hint);
  if (doctorContext) form.append("doctorContext", doctorContext);

  const data = await api.postFile("/api/vision/scan", form);
  if (!data || data.ok === false) {
    throw new Error((data && data.error) || "Vision scan failed");
  }
  if (!data.result) throw new Error("no result from server");
  return data.result;
}
