"use strict";

function isValidNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidTelemetryFrame(frame) {
  if (!frame || typeof frame !== "object" || Array.isArray(frame)) return false;
  if (!isValidNumber(frame.rpm) || !isValidNumber(frame.speed) || !isValidNumber(frame.coolant)) {
    return false;
  }
  if (frame.rpm < 0 || frame.speed < 0 || frame.coolant < 0) return false;
  if (frame.rpm > 12000) return false;
  return true;
}

module.exports = { isValidTelemetryFrame };
