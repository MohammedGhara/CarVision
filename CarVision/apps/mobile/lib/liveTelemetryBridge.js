// apps/mobile/lib/liveTelemetryBridge.js
// Lightweight pub/sub so Safety screens can read battery/RPM without a second WebSocket.
// Live Data (cardata) pushes slices when telemetry arrives.

let slice = {
  battery: null,
  moduleVoltage: null,
  rpm: null,
  speed: null,
};

const listeners = new Set();

/**
 * Call from WebSocket `telemetry` handlers with the same `msg.data` object you merge into state.
 * @param {object} data
 */
export function pushTelemetrySlice(data) {
  if (!data || typeof data !== "object") return;
  slice = {
    battery: data.battery != null ? data.battery : slice.battery,
    moduleVoltage: data.moduleVoltage != null ? data.moduleVoltage : slice.moduleVoltage,
    rpm: data.rpm != null ? data.rpm : slice.rpm,
    speed: data.speed != null ? data.speed : slice.speed,
  };
  listeners.forEach((fn) => {
    try {
      fn(slice);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

export function getTelemetrySlice() {
  return { ...slice };
}

export function subscribeTelemetrySlice(callback) {
  listeners.add(callback);
  callback(slice);
  return () => listeners.delete(callback);
}

export function resetTelemetrySlice() {
  slice = { battery: null, moduleVoltage: null, rpm: null, speed: null };
}
