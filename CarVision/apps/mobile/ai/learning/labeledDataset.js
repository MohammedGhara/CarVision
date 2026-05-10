/**
 * Supervised learning buffer — stores (feature vector, label) pairs on device.
 *
 * Labels:
 * - 0 = "healthy / nominal for this vehicle session"
 * - 1 = "fault pattern / symptom / issue present"
 *
 * Use these rows to train sklearn/XGBoost/PyTorch offline, then ship ONNX.
 * The app also feeds the same rows into onDevicePrototypeLearner for a demo
 * "learns from your taps" prototype without a server.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@CarVision/doctorCar/labeled_samples_v1";
const MAX_SAMPLES = 2000;

/** @type {{ id: string, t: number, label: 0|1, features: number[], source: string }[]} */
let memoryRows = [];
let hydratePromise = null;

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getSamplesSync() {
  return memoryRows.slice();
}

/**
 * Load persisted samples into RAM (call once from DoctorCar screen on mount).
 */
export async function hydrateLabeledDatasetFromDisk() {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        memoryRows = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) memoryRows = parsed.filter(Boolean);
    } catch {
      memoryRows = [];
    }
  })();
  return hydratePromise;
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryRows.slice(-MAX_SAMPLES)));
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ label: 0|1, features: number[], source?: string }} row
 */
export async function appendLabeledSample(row) {
  if (!Array.isArray(row.features) || row.features.length === 0) return false;
  const label = row.label === 1 ? 1 : 0;
  memoryRows.push({
    id: uid(),
    t: Date.now(),
    label,
    features: row.features.slice(0, 64),
    source: row.source || "user",
  });
  if (memoryRows.length > MAX_SAMPLES) memoryRows.splice(0, memoryRows.length - MAX_SAMPLES);
  await persist();
  return true;
}

export async function clearLabeledDataset() {
  memoryRows = [];
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function countLabels() {
  let n0 = 0;
  let n1 = 0;
  for (const r of memoryRows) {
    if (r.label === 1) n1 += 1;
    else n0 += 1;
  }
  return { n0, n1, total: memoryRows.length };
}
