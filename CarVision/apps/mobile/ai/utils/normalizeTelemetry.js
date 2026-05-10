/**
 * Normalize OBD telemetry fields to numbers or null for consistent rule evaluation.
 */

function num(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function int(v) {
  const n = num(v);
  return n == null ? null : Math.round(n);
}

/** @param {object} raw */
export function normalizeTelemetrySnapshot(raw) {
  if (!raw || typeof raw !== "object") {
    return getEmptySnapshot();
  }

  const dtcs = Array.isArray(raw.dtcs) ? raw.dtcs.map((c) => String(c).toUpperCase().trim()) : [];
  const pending = Array.isArray(raw.pending) ? raw.pending.map((c) => String(c).toUpperCase().trim()) : [];
  const permanent = Array.isArray(raw.permanent) ? raw.permanent.map((c) => String(c).toUpperCase().trim()) : [];

  const monitors = raw.monitors && typeof raw.monitors === "object" ? raw.monitors : {};
  const milOn = !!monitors.milOn;
  const dtcCount = int(monitors.dtcCount) ?? dtcs.length;

  return {
    battery: num(raw.battery),
    moduleVoltage: num(raw.moduleVoltage),
    rpm: int(raw.rpm),
    speed: num(raw.speed),
    coolant: num(raw.coolant),
    load: num(raw.load),
    throttle: num(raw.throttle),
    fuel: num(raw.fuel),
    iat: num(raw.iat),
    maf: num(raw.maf),
    map: num(raw.map),
    baro: num(raw.baro),
    stft: num(raw.stft),
    ltft: num(raw.ltft),
    dtcs,
    pending,
    permanent,
    monitors: {
      milOn,
      dtcCount,
      bytes: Array.isArray(monitors.bytes) ? monitors.bytes : [],
    },
    status: raw.status && typeof raw.status === "object" ? raw.status : { level: "UNKNOWN", reason: "" },
    adapter: raw.adapter ?? null,
  };
}

export function getEmptySnapshot() {
  return {
    battery: null,
    moduleVoltage: null,
    rpm: null,
    speed: null,
    coolant: null,
    load: null,
    throttle: null,
    fuel: null,
    iat: null,
    maf: null,
    map: null,
    baro: null,
    stft: null,
    ltft: null,
    dtcs: [],
    pending: [],
    permanent: [],
    monitors: { milOn: false, dtcCount: 0, bytes: [] },
    status: { level: "UNKNOWN", reason: "" },
    adapter: null,
  };
}
