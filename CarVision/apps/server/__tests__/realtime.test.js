"use strict";

const { isValidTelemetryFrame } = require("../src/utils/telemetryValidation");

describe("Real-time telemetry validation", () => {
  test("valid telemetry with rpm speed coolant passes", () => {
    expect(
      isValidTelemetryFrame({
        rpm: 1200,
        speed: 45,
        coolant: 90,
      }),
    ).toBe(true);
  });

  test("valid telemetry with zero speed passes", () => {
    expect(
      isValidTelemetryFrame({
        rpm: 850,
        speed: 0,
        coolant: 87,
      }),
    ).toBe(true);
  });

  test("invalid null frame fails", () => {
    expect(isValidTelemetryFrame(null)).toBe(false);
  });

  test("invalid array frame fails", () => {
    expect(isValidTelemetryFrame([])).toBe(false);
  });

  test("invalid string frame fails", () => {
    expect(isValidTelemetryFrame("telemetry")).toBe(false);
  });

  test("negative rpm fails", () => {
    expect(isValidTelemetryFrame({ rpm: -1, speed: 30, coolant: 80 })).toBe(false);
  });

  test("negative speed fails", () => {
    expect(isValidTelemetryFrame({ rpm: 1200, speed: -10, coolant: 80 })).toBe(false);
  });

  test("negative coolant fails", () => {
    expect(isValidTelemetryFrame({ rpm: 1200, speed: 30, coolant: -1 })).toBe(false);
  });

  test("non-number rpm fails", () => {
    expect(isValidTelemetryFrame({ rpm: "1200", speed: 30, coolant: 80 })).toBe(false);
  });

  test("non-number speed fails", () => {
    expect(isValidTelemetryFrame({ rpm: 1200, speed: "30", coolant: 80 })).toBe(false);
  });

  test("non-number coolant fails", () => {
    expect(isValidTelemetryFrame({ rpm: 1200, speed: 30, coolant: "80" })).toBe(false);
  });

  test("extremely high rpm fails", () => {
    expect(isValidTelemetryFrame({ rpm: 20000, speed: 30, coolant: 80 })).toBe(false);
  });

  test("extra unknown fields do not fail when required fields are valid", () => {
    expect(
      isValidTelemetryFrame({
        rpm: 1500,
        speed: 20,
        coolant: 85,
        engineLoad: 22.5,
        randomFlag: true,
      }),
    ).toBe(true);
  });
});
