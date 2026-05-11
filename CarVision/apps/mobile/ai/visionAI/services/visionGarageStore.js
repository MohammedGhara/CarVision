/**
 * Garage / customer scan persistence — AsyncStorage today, Supabase-ready API.
 *
 * Future Supabase: replace load/save with table `vision_scans` + RLS by garage_id.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "carvision_vision_ai_scans_v1";

/**
 * @typedef {object} VisionGarageScanRecord
 * @property {string} id
 * @property {number} createdAt
 * @property {string|null} imageUri
 * @property {object} result — VisionScanResult JSON
 * @property {string} mechanicNotes
 * @property {'low'|'medium'|'high'|'critical'|null} urgencyOverride
 * @property {string} [customerTag]
 */

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeAll(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

/** @returns {Promise<VisionGarageScanRecord[]>} */
export async function listGarageVisionScans() {
  const list = await readAll();
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * @param {{ imageUri?: string|null, result: object, mechanicNotes?: string, urgencyOverride?: VisionGarageScanRecord['urgencyOverride'], customerTag?: string }} payload
 */
export async function saveGarageVisionScan(payload) {
  const list = await readAll();
  const rec = /** @type {VisionGarageScanRecord} */ ({
    id: `gvs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    imageUri: payload.imageUri || null,
    result: payload.result,
    mechanicNotes: payload.mechanicNotes || "",
    urgencyOverride: payload.urgencyOverride ?? null,
    customerTag: payload.customerTag || "",
  });
  list.unshift(rec);
  await writeAll(list.slice(0, 200));
  return rec;
}

/** @param {string} id @param {Partial<Pick<VisionGarageScanRecord, 'mechanicNotes'|'urgencyOverride'|'customerTag'>>} patch */
export async function updateGarageVisionScan(id, patch) {
  const list = await readAll();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  await writeAll(list);
  return list[i];
}

export async function clearGarageVisionScansForDebug() {
  await AsyncStorage.removeItem(KEY);
}
