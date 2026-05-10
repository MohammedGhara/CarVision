// apps/mobile/lib/dtcDescriptions.js — short titles for lists / PDF (delegates to knowledge base)
import { lookupDtcKnowledge } from "../ai/dtcKnowledge.js";

const MAP = {
  P0100: "Mass or Volume Air Flow (MAF) Circuit Malfunction",
  P0101: "MAF Circuit Range/Performance",
  P0102: "MAF Circuit Low Input",
  P0103: "MAF Circuit High Input",
  P0113: "Intake Air Temp (IAT) Sensor 1 Circuit High",
  P0118: "Engine Coolant Temp (ECT) Circuit High",
  P0128: "Coolant Thermostat (Below Regulating Temperature)",
  P0131: "O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)",
  P0133: "O2 Sensor Circuit Slow Response (B1S1)",
  P0171: "System Too Lean (Bank 1)",
  P0172: "System Too Rich (Bank 1)",
  P0300: "Random/Multiple Cylinder Misfire Detected",
  P0301: "Cylinder 1 Misfire Detected",
  P0302: "Cylinder 2 Misfire Detected",
  P0420: "Catalyst System Efficiency Below Threshold (Bank 1)",
  P0440: "EVAP System Malfunction",
  P0442: "EVAP Small Leak Detected",
  P0455: "EVAP Large Leak Detected",
  P0500: "Vehicle Speed Sensor (VSS) Malfunction",
  P0560: "System Voltage Malfunction",
};

export function describeDtc(code) {
  if (!code) return "";
  const up = String(code).toUpperCase().trim();
  const row = lookupDtcKnowledge(up);
  if (row?.title) return row.title;
  if (row?.explanation) {
    const first = row.explanation.split(/[—\-]/)[0]?.trim();
    if (first && first.length < 120) return first;
    return row.explanation.length > 100 ? `${row.explanation.slice(0, 97)}…` : row.explanation;
  }
  if (MAP[up]) return MAP[up];

  if (/^P0\d{3}$/.test(up)) {
    return "Generic powertrain DTC";
  }
  return "Unknown DTC";
}
