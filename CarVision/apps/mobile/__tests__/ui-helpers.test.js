"use strict";

const {
  isSupportedLanguage,
  getSafeDisplayText,
  formatVehicleMetric,
  getStatusBadgeType,
  getDiagnosticSeverity,
  isValidNavigationTarget,
  getSafeImageUri,
} = require("../lib/uiValidation");

describe("UI/UX helper validation", () => {
  test("language support baseline still works", () => {
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("fr")).toBe(false);
  });

  test("safe display text returns fallback for nullish/blank values", () => {
    expect(getSafeDisplayText(null)).toBe("N/A");
    expect(getSafeDisplayText(undefined)).toBe("N/A");
    expect(getSafeDisplayText("   ")).toBe("N/A");
  });

  test("safe display text returns trimmed value when valid", () => {
    expect(getSafeDisplayText("  CarVision  ")).toBe("CarVision");
  });

  test("safe display text honors custom fallback", () => {
    expect(getSafeDisplayText("", "--")).toBe("--");
  });

  test("formatVehicleMetric formats valid numeric values", () => {
    expect(formatVehicleMetric(88, "km/h")).toBe("88 km/h");
    expect(formatVehicleMetric("2500", "rpm")).toBe("2500 rpm");
    expect(formatVehicleMetric(95, "C")).toBe("95 C");
  });

  test("formatVehicleMetric returns fallback on invalid values", () => {
    expect(formatVehicleMetric(null, "km/h")).toBe("N/A");
    expect(formatVehicleMetric("abc", "rpm", "--")).toBe("--");
  });

  test("formatVehicleMetric works without unit", () => {
    expect(formatVehicleMetric(12, "")).toBe("12");
  });

  test("status badge mapping supports active/pending/failed/unknown", () => {
    expect(getStatusBadgeType("active")).toBe("success");
    expect(getStatusBadgeType("pending")).toBe("warning");
    expect(getStatusBadgeType("failed")).toBe("danger");
    expect(getStatusBadgeType("other")).toBe("neutral");
  });

  test("status badge mapping is case-insensitive", () => {
    expect(getStatusBadgeType("ACTIVE")).toBe("success");
  });

  test("diagnostic severity mapping supports critical/warning/ok/unknown", () => {
    expect(getDiagnosticSeverity("critical")).toBe("high");
    expect(getDiagnosticSeverity("warning")).toBe("medium");
    expect(getDiagnosticSeverity("ok")).toBe("low");
    expect(getDiagnosticSeverity("unknown-level")).toBe("unknown");
  });

  test("diagnostic severity supports normal as low", () => {
    expect(getDiagnosticSeverity("normal")).toBe("low");
  });

  test("navigation target validation accepts valid coordinates", () => {
    expect(isValidNavigationTarget({ latitude: 31.77, longitude: 35.21 })).toBe(true);
    expect(isValidNavigationTarget({ latitude: "31.77", longitude: "35.21" })).toBe(true);
  });

  test("navigation target validation rejects invalid coordinates", () => {
    expect(isValidNavigationTarget({ latitude: 1000, longitude: 35.21 })).toBe(false);
    expect(isValidNavigationTarget({ latitude: 31.77 })).toBe(false);
    expect(isValidNavigationTarget(null)).toBe(false);
  });

  test("safe image URI returns valid URI and fallback for invalid/missing", () => {
    expect(getSafeImageUri("https://example.com/car.jpg")).toBe("https://example.com/car.jpg");
    expect(getSafeImageUri("/uploads/car.jpg")).toBe("/uploads/car.jpg");
    expect(getSafeImageUri("", "/assets/fallback.png")).toBe("/assets/fallback.png");
    expect(getSafeImageUri("not-a-valid-uri", "/assets/fallback.png")).toBe("/assets/fallback.png");
  });
});
