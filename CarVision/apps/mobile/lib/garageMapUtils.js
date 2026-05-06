// Shared helpers for Map For Garages — filter/search; works with API garage objects.

/** @typedef {{ id: string, name?: string, address?: string | null, services?: string[], garageDescription?: string | null }} GarageLike */

export const SERVICE_FILTER_CHIPS = [
  { id: "all", keywordKeys: [] },
  { id: "diagnostics", keywordKeys: ["diagnostic", "diag", "scan", "obd", "דיאג"] },
  { id: "engine", keywordKeys: ["engine", "motor", "מנוע"] },
  { id: "battery", keywordKeys: ["battery", "סוללה"] },
  { id: "oil", keywordKeys: ["oil", "lube", "שמן"] },
  { id: "tires", keywordKeys: ["tire", "tyre", "wheel", "צמיג"] },
];

/**
 * @param {GarageLike} garage
 * @param {string} chipId
 */
export function garageMatchesServiceChip(garage, chipId) {
  if (!chipId || chipId === "all") return true;
  const chip = SERVICE_FILTER_CHIPS.find((c) => c.id === chipId);
  if (!chip || !chip.keywordKeys.length) return true;
  const services = Array.isArray(garage.services) ? garage.services : [];
  const blob = [
    ...services,
    garage.name || "",
    garage.garageDescription || "",
    garage.address || "",
  ]
    .join(" ")
    .toLowerCase();
  return chip.keywordKeys.some((k) => blob.includes(String(k).toLowerCase()));
}

/**
 * @param {GarageLike} garage
 * @param {string} query
 */
export function garageMatchesSearchQuery(garage, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const services = Array.isArray(garage.services) ? garage.services : [];
  const hay = [garage.name, garage.address, ...services, garage.garageDescription]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (hay.includes(q)) return true;
  const words = hay.split(/\s+/).filter(Boolean);
  return words.some((w) => w.startsWith(q) || q.startsWith(w.slice(0, Math.min(3, w.length))));
}

/**
 * @param {number} distanceKm
 */
export function formatDistanceKm(distanceKm) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d)) return "—";
  if (d < 10) {
    const rounded = Math.round(d * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  return String(Math.round(d));
}
