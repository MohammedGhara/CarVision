/**
 * Local DTC knowledge base — expandable without network.
 * Bulk standard meanings + richer overrides where DoctorCar adds guidance.
 * Rich OBD records (symptoms, AI summary, drive guidance) merged via lib/dtcDatabase.js.
 */
import { mergeRichIntoKnowledge, inferDtcCategory } from "../lib/dtcDatabase.js";

/**
 * @typedef {{
 *   code: string,
 *   severity: string,
 *   urgency: string,
 *   explanation: string,
 *   causes: string[],
 *   recommendations: string[],
 *   title?: string,
 *   category?: string,
 *   symptoms?: string[],
 *   possibleCauses?: string[],
 *   canDrive?: string,
 *   recommendedAction?: string,
 *   estimatedRepairCost?: string,
 *   warningLevel?: number,
 *   aiSummary?: string,
 * }} DtcEntry
 */

const DEFAULT_CAUSES = [
  "Component, wiring, or connector fault — confirm with live data and service information for your vehicle",
];
const DEFAULT_RECOMMENDATIONS = [
  "Read freeze frame and live data with a full scan tool",
  "Cross-check meaning and tests for your exact year, make, model, and VIN",
];

/** Optional [severity, urgency] for codes that should stand out in UI */
const SEVERITY_BY_CODE = /** @type {Record<string, [string, string]>} */ ({
  P0217: ["critical", "immediate"],
  P0300: ["critical", "immediate"],
  P0301: ["critical", "immediate"],
  P0302: ["critical", "immediate"],
  P0303: ["critical", "immediate"],
  P0304: ["critical", "immediate"],
  P0316: ["high", "soon"],
  P0087: ["high", "soon"],
  P0088: ["high", "soon"],
  P0234: ["high", "soon"],
  P0299: ["high", "soon"],
  P0171: ["high", "soon"],
  P0174: ["high", "soon"],
  P0520: ["high", "soon"],
  P0562: ["medium", "soon"],
  P0563: ["medium", "soon"],
  P0700: ["high", "soon"],
  P0868: ["high", "soon"],
  U0100: ["high", "soon"],
  U0101: ["high", "soon"],
  U0121: ["high", "soon"],
  B0001: ["critical", "immediate"],
  B0020: ["critical", "immediate"],
  B1676: ["high", "soon"],
  P0601: ["high", "soon"],
  P0606: ["high", "soon"],
  P0685: ["high", "soon"],
  C0110: ["high", "soon"],
  C0299: ["high", "soon"],
  P1000: ["low", "monitor"],
  P0442: ["low", "schedule"],
});

/**
 * @param {string} code
 * @param {string} meaning
 * @param {string} severity
 * @param {string} urgency
 * @returns {DtcEntry}
 */
function bulkEntry(code, meaning, severity, urgency) {
  return {
    code,
    severity,
    urgency,
    explanation: meaning,
    causes: [...DEFAULT_CAUSES],
    recommendations: [...DEFAULT_RECOMMENDATIONS],
  };
}

const RAW_LINES = [
  "P0001|Fuel Volume Regulator Control Circuit/Open",
  "P0002|Fuel Volume Regulator Control Circuit Range/Performance",
  "P0003|Fuel Volume Regulator Control Circuit Low",
  "P0004|Fuel Volume Regulator Control Circuit High",
  "P0005|Fuel Shutoff Valve Control Circuit/Open",
  "P0010|Camshaft Position Actuator Circuit",
  "P0011|Camshaft Timing Over-Advanced",
  "P0012|Camshaft Timing Over-Retarded",
  "P0013|Camshaft Position Actuator Circuit/Open",
  "P0014|Exhaust Camshaft Timing Over-Advanced",
  "P0015|Exhaust Camshaft Timing Over-Retarded",
  "P0016|Crankshaft/Camshaft Position Correlation",
  "P0017|Crankshaft/Camshaft Position Correlation Bank 1 Sensor B",
  "P0018|Crankshaft/Camshaft Position Correlation Bank 2 Sensor A",
  "P0019|Crankshaft/Camshaft Position Correlation Bank 2 Sensor B",
  "P0020|Camshaft Position Actuator Circuit Bank 2",
  "P0021|Camshaft Timing Over-Advanced Bank 2",
  "P0022|Camshaft Timing Over-Retarded Bank 2",
  "P0030|HO2S Heater Control Circuit Bank 1 Sensor 1",
  "P0031|HO2S Heater Control Circuit Low",
  "P0032|HO2S Heater Control Circuit High",
  "P0036|HO2S Heater Control Circuit Bank 1 Sensor 2",
  "P0037|HO2S Heater Control Circuit Low Bank 1 Sensor 2",
  "P0038|HO2S Heater Control Circuit High Bank 1 Sensor 2",
  "P0040|O2 Sensor Signals Swapped",
  "P0045|Turbocharger Boost Control Solenoid Circuit/Open",
  "P0050|HO2S Heater Control Circuit Bank 2 Sensor 1",
  "P0051|HO2S Heater Control Circuit Low Bank 2 Sensor 1",
  "P0052|HO2S Heater Control Circuit High Bank 2 Sensor 1",
  "P0068|MAP/MAF Throttle Position Correlation",
  "P0070|Ambient Air Temperature Sensor Circuit",
  "P0071|Ambient Air Temperature Sensor Range/Performance",
  "P0072|Ambient Air Temperature Sensor Low",
  "P0073|Ambient Air Temperature Sensor High",
  "P0087|Fuel Rail/System Pressure Too Low",
  "P0088|Fuel Rail/System Pressure Too High",
  "P0090|Fuel Pressure Regulator Control Circuit",
  "P0091|Fuel Pressure Regulator Control Circuit Low",
  "P0092|Fuel Pressure Regulator Control Circuit High",
  "P0100|Mass Air Flow Circuit Malfunction",
  "P0101|Mass Air Flow Range/Performance",
  "P0102|Mass Air Flow Circuit Low Input",
  "P0103|Mass Air Flow Circuit High Input",
  "P0105|MAP/BARO Pressure Circuit",
  "P0106|MAP/BARO Pressure Range/Performance",
  "P0107|MAP/BARO Pressure Circuit Low",
  "P0108|MAP/BARO Pressure Circuit High",
  "P0110|Intake Air Temperature Sensor Circuit",
  "P0113|Intake Air Temperature Sensor High Input",
  "P0115|Engine Coolant Temperature Circuit",
  "P0116|Engine Coolant Temperature Range/Performance",
  "P0117|Engine Coolant Temperature Low",
  "P0118|Engine Coolant Temperature High",
  "P0120|Throttle Position Sensor Circuit",
  "P0121|Throttle Position Sensor Range/Performance",
  "P0122|Throttle Position Sensor Low Input",
  "P0123|Throttle Position Sensor High Input",
  "P0130|O2 Sensor Circuit Malfunction",
  "P0131|O2 Sensor Circuit Low Voltage",
  "P0132|O2 Sensor Circuit High Voltage",
  "P0133|O2 Sensor Slow Response",
  "P0135|O2 Sensor Heater Circuit",
  "P0140|O2 Sensor No Activity",
  "P0141|O2 Sensor Heater Circuit Malfunction",
  "P0150|O2 Sensor Circuit Malfunction Bank 2",
  "P0155|O2 Sensor Heater Circuit Bank 2",
  "P0160|O2 Sensor No Activity Bank 2",
  "P0171|System Too Lean Bank 1",
  "P0172|System Too Rich Bank 1",
  "P0174|System Too Lean Bank 2",
  "P0175|System Too Rich Bank 2",
  "P0180|Fuel Temperature Sensor Circuit",
  "P0181|Fuel Temperature Sensor Range/Performance",
  "P0182|Fuel Temperature Sensor Low Input",
  "P0183|Fuel Temperature Sensor High Input",
  "P0185|Fuel Temperature Sensor B Circuit Malfunction",
  "P0186|Fuel Temperature Sensor B Range/Performance",
  "P0190|Fuel Rail Pressure Sensor Circuit",
  "P0191|Fuel Rail Pressure Sensor Range/Performance",
  "P0192|Fuel Rail Pressure Sensor Low Input",
  "P0193|Fuel Rail Pressure Sensor High Input",
  "P0200|Injector Circuit Malfunction",
  "P0201|Injector Circuit Cylinder 1",
  "P0202|Injector Circuit Cylinder 2",
  "P0203|Injector Circuit Cylinder 3",
  "P0204|Injector Circuit Cylinder 4",
  "P0217|Engine Overheat Condition",
  "P0220|Throttle/Pedal Position Sensor Circuit B",
  "P0230|Fuel Pump Primary Circuit",
  "P0234|Turbocharger Overboost Condition",
  "P0243|Turbocharger Wastegate Solenoid",
  "P0261|Cylinder 1 Injector Circuit Low",
  "P0262|Cylinder 1 Injector Circuit High",
  "P0263|Cylinder 1 Contribution/Balance",
  "P0270|Cylinder 4 Contribution/Balance",
  "P0299|Turbocharger Underboost",
  "P0300|Random/Multiple Cylinder Misfire",
  "P0301|Cylinder 1 Misfire",
  "P0302|Cylinder 2 Misfire",
  "P0303|Cylinder 3 Misfire",
  "P0304|Cylinder 4 Misfire",
  "P0316|Engine Misfire Detected on Startup",
  "P0325|Knock Sensor 1 Circuit",
  "P0335|Crankshaft Position Sensor A Circuit",
  "P0340|Camshaft Position Sensor Circuit",
  "P0351|Ignition Coil A Primary/Secondary Circuit",
  "P0352|Ignition Coil B Primary/Secondary Circuit",
  "P0400|Exhaust Gas Recirculation Flow Malfunction",
  "P0401|EGR Flow Insufficient",
  "P0402|EGR Flow Excessive",
  "P0410|Secondary Air Injection System",
  "P0420|Catalyst System Efficiency Below Threshold",
  "P0430|Catalyst System Efficiency Below Threshold Bank 2",
  "P0440|Evaporative Emission Control System",
  "P0441|EVAP Incorrect Purge Flow",
  "P0442|EVAP Small Leak Detected",
  "P0446|EVAP Vent Control Circuit",
  "P0452|EVAP Pressure Sensor Low Input",
  "P0453|EVAP Pressure Sensor High Input",
  "P0455|EVAP Large Leak Detected",
  "P0460|Fuel Level Sensor Circuit",
  "P0463|Fuel Level Sensor High Input",
  "P0480|Cooling Fan 1 Control Circuit",
  "P0500|Vehicle Speed Sensor Malfunction",
  "P0505|Idle Control System Malfunction",
  "P0513|Incorrect Immobilizer Key",
  "P0520|Engine Oil Pressure Sensor Circuit",
  "P0560|System Voltage",
  "P0562|System Voltage Low",
  "P0563|System Voltage High",
  "P0571|Brake Switch A Circuit",
  "P0600|Serial Communication Link Malfunction",
  "P0601|Internal Control Module Memory Checksum Error",
  "P0606|PCM Processor Fault",
  "P0615|Starter Relay Circuit",
  "P0620|Generator Control Circuit",
  "P0630|VIN Not Programmed",
  "P0641|Sensor Reference Voltage A Circuit/Open",
  "P0650|Malfunction Indicator Lamp Control Circuit",
  "P0660|Intake Manifold Tuning Valve Control Circuit",
  "P0670|Glow Plug Control Module",
  "P0685|ECM/PCM Power Relay Control Circuit",
  "P0700|Transmission Control System Malfunction",
  "P0705|Transmission Range Sensor Circuit",
  "P0715|Input/Turbine Speed Sensor Circuit",
  "P0720|Output Speed Sensor Circuit",
  "P0730|Incorrect Gear Ratio",
  "P0740|Torque Converter Clutch Circuit",
  "P0750|Shift Solenoid A Malfunction",
  "P0755|Shift Solenoid B Malfunction",
  "P0760|Shift Solenoid C Malfunction",
  "P0770|Shift Solenoid E Malfunction",
  "P0780|Shift Malfunction",
  "P0800|Transfer Case Control System",
  "P0850|Park/Neutral Switch Input Circuit",
  "P0868|Transmission Fluid Pressure Low",
  "P0871|Transmission Fluid Pressure Sensor Range/Performance",
  "P0900|Clutch Actuator Circuit/Open",
  "P1000|OBD Systems Readiness Test Not Complete",
  "B0001|Driver Frontal Stage 1 Deployment Control",
  "B0020|Passenger Frontal Deployment Loop",
  "B0092|Seat Belt Sensor",
  "B0100|Electronic Front Sensor",
  "B1318|Battery Voltage Low",
  "B1342|ECU Internal Fault",
  "B1402|Driver Power Window Circuit",
  "B1676|Battery Pack Voltage Out Of Range",
  "C0035|Left Front Wheel Speed Sensor",
  "C0040|Right Front Wheel Speed Sensor",
  "C0050|Rear Wheel Speed Sensor",
  "C0110|Pump Motor Circuit",
  "C0131|ABS Pressure Circuit",
  "C0242|Engine Torque Request Signal",
  "C0299|Brake Booster Performance",
  "U0001|High Speed CAN Communication Bus",
  "U0100|Lost Communication With ECM/PCM",
  "U0101|Lost Communication With TCM",
  "U0121|Lost Communication With ABS",
  "U0140|Lost Communication With Body Control Module",
  "U0155|Lost Communication With Instrument Panel",
  "U1000|CAN Communication Line Fault"
];

function buildBulkMap() {
  /** @type {Record<string, DtcEntry>} */
  const map = {};
  for (const line of RAW_LINES) {
    const i = line.indexOf("|");
    if (i === -1) continue;
    const code = line.slice(0, i).trim();
    const meaning = line.slice(i + 1).trim();
    const tier = SEVERITY_BY_CODE[code] || ["medium", "schedule"];
    map[code] = bulkEntry(code, meaning, tier[0], tier[1]);
  }
  return map;
}


/** Rich entries override bulk meanings for DoctorCar guidance */
const DTC_DETAIL_OVERRIDES = /** @type {Record<string, DtcEntry>} */ ({
  P0171: {
    code: "P0171",
    severity: "high",
    urgency: "soon",
    explanation: "System Too Lean (Bank 1) — the ECU is adding fuel but air/fuel is still lean.",
    causes: ["Vacuum or intake leak", "Failing MAF / MAP", "Weak fuel delivery", "Contaminated O2 sensor"],
    recommendations: ["Smoke test intake", "Inspect MAF and air filter", "Check fuel pressure", "Review fuel trims live"],
  },
  P0172: {
    code: "P0172",
    severity: "medium",
    urgency: "schedule",
    explanation: "System Too Rich (Bank 1) — excessive fuel or insufficient air.",
    causes: ["Leaking injector", "Faulty MAF", "High fuel pressure", "Restricted intake"],
    recommendations: ["Inspect MAF / filter", "Check fuel pressure", "Look for oil contamination on MAF"],
  },
  P0301: {
    code: "P0301",
    severity: "critical",
    urgency: "immediate",
    explanation: "Cylinder 1 Misfire — combustion failed on cylinder 1.",
    causes: ["Spark plug / coil", "Injector / compression", "Vacuum leak affecting one cylinder"],
    recommendations: ["Swap coil/plug to isolate", "Check cylinder compression", "Avoid heavy acceleration until repaired"],
  },
  P0420: {
    code: "P0420",
    severity: "medium",
    urgency: "schedule",
    explanation: "Catalyst System Efficiency Below Threshold (Bank 1) — converter may be degraded.",
    causes: ["Aging catalytic converter", "Upstream engine misfire history", "Exhaust leak near sensors"],
    recommendations: ["Resolve misfires first", "Verify sensor operation", "Professional exhaust diagnosis if persistent"],
  },
  P0128: {
    code: "P0128",
    severity: "low",
    urgency: "monitor",
    explanation: "Coolant thermostat — engine not reaching expected temperature in time.",
    causes: ["Stuck-open thermostat", "Low coolant", "Faulty ECT sensor"],
    recommendations: ["Check coolant level", "Inspect thermostat", "Verify ECT readings vs. scan tool"],
  },
  P0562: {
    code: "P0562",
    severity: "medium",
    urgency: "soon",
    explanation: "System Voltage Low — charging or battery distribution issue.",
    causes: ["Weak battery", "Alternator output low", "Corroded grounds"],
    recommendations: ["Test battery and alternator", "Clean terminals", "Check belt tension"],
  },
  P0131: {
    code: "P0131",
    severity: "high",
    urgency: "soon",
    explanation:
      "O2 Sensor Circuit Low Voltage (Bank 1, Sensor 1) — the upstream oxygen sensor signal is below expected range.",
    causes: [
      "Faulty or contaminated O2 sensor",
      "Wiring short to ground or open sensor heater circuit",
      "Exhaust leak before the sensor",
      "Rare: ECM input fault",
    ],
    recommendations: [
      "Inspect sensor wiring and connector",
      "Compare O2 sensor voltage to factory spec at idle and cruise",
      "Fix exhaust leaks upstream of the sensor",
      "Replace sensor if confirmed failed after wiring checks",
    ],
  },
  P0110: {
    code: "P0110",
    severity: "medium",
    urgency: "schedule",
    explanation:
      "Intake Air Temperature (IAT) Sensor — circuit malfunction; the ECU cannot trust air temperature for fueling calculations.",
    causes: ["Failed IAT sensor", "Wiring damage or corrosion", "Poor connection at MAF/IAT combination sensor"],
    recommendations: ["Inspect IAT/MAF connector and wiring", "Compare IAT reading to ambient when cold-soaked", "Replace sensor if out of range"],
  },
  P0111: {
    code: "P0111",
    severity: "medium",
    urgency: "schedule",
    explanation:
      "IAT Circuit Range/Performance — the air temperature reading is implausible or changes incorrectly vs. engine load and ECT.",
    causes: ["Intermittent IAT sensor", "Wiring resistance", "Heat-soaked MAF/IAT in engine bay"],
    recommendations: ["Graph IAT vs. ECT on a scan tool", "Check for damaged harness near air box", "Verify correct sensor for your engine"],
  },
  P0185: {
    code: "P0185",
    severity: "medium",
    urgency: "schedule",
    explanation:
      "Fuel Temperature Sensor B — circuit / range problem; the ECU is not getting a valid fuel temperature signal (location varies by vehicle).",
    causes: ["Failed fuel temp sensor", "Wiring to fuel sensor circuit", "Water in connector (common on in-tank sensors)"],
    recommendations: ["Locate sensor for your model (tank / rail / module)", "Test resistance vs. service data", "Inspect connector for corrosion"],
  },
});

/** @type {Record<string, DtcEntry>} */
export const DTC_KNOWLEDGE = {
  ...buildBulkMap(),
  ...DTC_DETAIL_OVERRIDES,
};

export function lookupDtcKnowledge(code) {
  if (!code) return null;
  const up = String(code).toUpperCase().trim();
  const base = DTC_KNOWLEDGE[up] ?? null;
  const row = mergeRichIntoKnowledge(up, base);
  if (!row) return null;
  if (!row.category) return { ...row, category: inferDtcCategory(up) };
  return row;
}

export function explainAllDtcs(codes) {
  const list = Array.isArray(codes) ? codes : [];
  const seen = new Set();
  const out = [];
  for (const c of list) {
    const up = String(c).toUpperCase().trim();
    if (!up || seen.has(up)) continue;
    seen.add(up);
    const row = lookupDtcKnowledge(up);
    if (row) out.push(row);
    else {
      out.push({
        code: up,
        severity: "unknown",
        urgency: "schedule",
        category: inferDtcCategory(up),
        explanation:
          "This code is not in CarVision's offline database yet. The ECU is still reporting a valid OBD-II fault — look up the code for your exact year/make/model (or VIN) in a professional service manual or ask a workshop; meaning can vary slightly by manufacturer.",
        causes: ["Model-specific: see factory or aftermarket DTC library"],
        recommendations: ["Read freeze frame / live data with a full scan tool", "Cross-check code + symptoms with repair information for your VIN"],
      });
    }
  }
  return out;
}
