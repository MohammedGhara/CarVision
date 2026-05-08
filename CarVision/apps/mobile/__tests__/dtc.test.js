"use strict";

describe("DTC description helper", () => {
  let describeDtc;

  beforeAll(async () => {
    const mod = await import("../lib/dtcDescriptions.js");
    describeDtc = mod.describeDtc;
  });

  test("known DTC code returns description", () => {
    expect(describeDtc("P0100")).toBe("Mass or Volume Air Flow (MAF) Circuit Malfunction");
  });

  test("unknown DTC code returns safe fallback", () => {
    expect(describeDtc("P0999")).toBe("Generic powertrain DTC");
    expect(describeDtc("X1234")).toBe("Unknown DTC");
  });

  test("empty code returns fallback", () => {
    expect(describeDtc("")).toBe("");
  });

  test("lowercase code is handled safely", () => {
    expect(describeDtc("p0100")).toBe("Mass or Volume Air Flow (MAF) Circuit Malfunction");
  });

  test("invalid input is handled safely", () => {
    expect(describeDtc(null)).toBe("");
    expect(describeDtc(undefined)).toBe("");
  });
});
