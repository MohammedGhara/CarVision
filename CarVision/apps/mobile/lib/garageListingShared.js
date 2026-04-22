// Shared helpers for garage listing (location + public text) — used by garage-location screen.

export const MAX_GARAGE_DESCRIPTION_LEN = 400;
export const MAX_WORKING_HOURS_LEN = 120;

export function coordToInput(val) {
  if (val == null || val === "") return "";
  const n = Number(val);
  return Number.isFinite(n) ? String(n) : "";
}

function isValidLatLngPair(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Best-effort parse for Google Maps / Apple / Waze style URLs and "lat,lng" text. */
export function parseLatLngFromMapsUrl(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  try {
    s = decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    // keep s as-is
  }
  const compact = s.replace(/\s+/g, "");

  const tryPair = (a, b) => {
    const lat = Number(a);
    const lng = Number(b);
    if (isValidLatLngPair(lat, lng)) return { lat, lng };
    const lat2 = Number(b);
    const lng2 = Number(a);
    if (isValidLatLngPair(lat2, lng2)) return { lat: lat2, lng: lng2 };
    return null;
  };

  const m34 = compact.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/i);
  if (m34) {
    const out = tryPair(m34[1], m34[2]);
    if (out) return out;
  }

  const mat = compact.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,[\d.]+z|[/?]|$)/i);
  if (mat) {
    const out = tryPair(mat[1], mat[2]);
    if (out) return out;
  }

  const mq = compact.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
  if (mq) {
    const out = tryPair(mq[1], mq[2]);
    if (out) return out;
  }

  const mqplus = compact.match(/[?&]q=(-?\d+\.?\d*)\+(-?\d+\.?\d*)/i);
  if (mqplus) {
    const out = tryPair(mqplus[1], mqplus[2]);
    if (out) return out;
  }

  const mc = compact.match(/[?&]center=(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
  if (mc) {
    const out = tryPair(mc[1], mc[2]);
    if (out) return out;
  }

  const mll = compact.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
  if (mll) {
    const out = tryPair(mll[1], mll[2]);
    if (out) return out;
  }

  const geo = compact.match(/^geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
  if (geo) {
    const out = tryPair(geo[1], geo[2]);
    if (out) return out;
  }

  const plain = s.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (plain) {
    const out = tryPair(plain[1], plain[2]);
    if (out) return out;
  }

  return null;
}

export function garageLocationSnapshotFromUser(u) {
  const addr = u?.address != null && String(u.address).trim() !== "" ? String(u.address).trim() : null;
  const lat =
    u?.latitude != null && Number.isFinite(Number(u.latitude)) ? Number(u.latitude) : null;
  const lng =
    u?.longitude != null && Number.isFinite(Number(u.longitude)) ? Number(u.longitude) : null;
  const desc =
    u?.garageDescription != null && String(u.garageDescription).trim() !== ""
      ? String(u.garageDescription).trim()
      : null;
  const hours =
    u?.workingHoursText != null && String(u.workingHoursText).trim() !== ""
      ? String(u.workingHoursText).trim()
      : null;
  return { address: addr, latitude: lat, longitude: lng, garageDescription: desc, workingHoursText: hours };
}

export function garageLocationSnapshotFromForm(addrTrimmed, latStr, lngStr, descRaw, hoursRaw) {
  const address = addrTrimmed === "" ? null : addrTrimmed;
  const latitude = latStr === "" ? null : parseFloat(latStr);
  const longitude = lngStr === "" ? null : parseFloat(lngStr);
  const d = (descRaw || "").trim();
  const h = (hoursRaw || "").trim();
  return {
    address,
    latitude,
    longitude,
    garageDescription: d === "" ? null : d,
    workingHoursText: h === "" ? null : h,
  };
}

export function garageLocationEqual(a, b) {
  if (a.address !== b.address) return false;
  if ((a.garageDescription || null) !== (b.garageDescription || null)) return false;
  if ((a.workingHoursText || null) !== (b.workingHoursText || null)) return false;
  const latEq =
    a.latitude == null && b.latitude == null
      ? true
      : a.latitude != null &&
        b.latitude != null &&
        Number.isFinite(a.latitude) &&
        Number.isFinite(b.latitude) &&
        Math.abs(a.latitude - b.latitude) < 1e-8;
  const lngEq =
    a.longitude == null && b.longitude == null
      ? true
      : a.longitude != null &&
        b.longitude != null &&
        Number.isFinite(a.longitude) &&
        Number.isFinite(b.longitude) &&
        Math.abs(a.longitude - b.longitude) < 1e-8;
  return latEq && lngEq;
}
