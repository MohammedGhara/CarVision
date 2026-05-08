"use strict";

const SUPPORTED_LANGUAGES = new Set(["en", "he", "ar"]);

function isSupportedLanguage(lang) {
  return SUPPORTED_LANGUAGES.has(String(lang || "").toLowerCase());
}

function getSafeDisplayText(value, fallback = "N/A") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatVehicleMetric(value, unit, fallback = "N/A") {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const cleanUnit = String(unit || "").trim();
  if (!cleanUnit) return String(n);
  return `${n} ${cleanUnit}`;
}

function getStatusBadgeType(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "active") return "success";
  if (s === "pending") return "warning";
  if (s === "failed") return "danger";
  return "neutral";
}

function getDiagnosticSeverity(level) {
  const l = String(level || "").trim().toLowerCase();
  if (l === "critical") return "high";
  if (l === "warning") return "medium";
  if (l === "ok" || l === "normal") return "low";
  return "unknown";
}

function isValidNavigationTarget(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) return false;
  const lat = Number(target.latitude);
  const lng = Number(target.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function getSafeImageUri(uri, fallbackUri = null) {
  const v = String(uri ?? "").trim();
  if (!v) return fallbackUri;
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/uploads/")) return v;
  return fallbackUri;
}

module.exports = {
  isSupportedLanguage,
  getSafeDisplayText,
  formatVehicleMetric,
  getStatusBadgeType,
  getDiagnosticSeverity,
  isValidNavigationTarget,
  getSafeImageUri,
};
