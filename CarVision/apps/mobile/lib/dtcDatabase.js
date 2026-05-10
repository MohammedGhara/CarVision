/**
 * Production OBD-II rich records — symptoms, AI summaries, drive guidance, repair hints.
 * Merged into ai/dtcKnowledge lookup for DoctorCar + Diagnostics UI.
 */

/**
 * @typedef {object} RichDtcRecord
 * @property {string} code
 * @property {string} title
 * @property {string} category
 * @property {"critical"|"high"|"medium"|"low"} severityNormalized — stored lowercase after normalize
 * @property {string} description
 * @property {string[]} symptoms
 * @property {string[]} possibleCauses
 * @property {string} canDrive
 * @property {string} recommendedAction
 * @property {string} estimatedRepairCost
 * @property {number} warningLevel
 * @property {string} aiSummary
 */

/** @type {Record<string, Omit<RichDtcRecord, 'severityNormalized'> & { severity: string }>} */
const SOURCE = {
  P0131: {
    code: "P0131",
    title: "O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)",
    category: "Powertrain",
    severity: "Medium",
    description:
      "The oxygen sensor voltage is lower than expected, indicating a possible lean condition or sensor issue.",
    symptoms: ["Check Engine Light", "Poor fuel economy", "Rough idle", "Weak acceleration"],
    possibleCauses: ["Faulty oxygen sensor", "Vacuum leak", "Low fuel pressure", "Exhaust leak", "Dirty MAF sensor"],
    canDrive: "Yes, but repair soon",
    recommendedAction: "Inspect O2 sensor, vacuum leaks, and fuel system",
    estimatedRepairCost: "$80-$400",
    warningLevel: 5,
    aiSummary: "Low oxygen sensor voltage detected. Engine may be running lean or sensor may be failing.",
  },
  P0420: {
    code: "P0420",
    title: "Catalyst System Efficiency Below Threshold (Bank 1)",
    category: "Powertrain",
    severity: "High",
    description:
      "The catalytic converter is not operating efficiently enough to reduce exhaust emissions.",
    symptoms: ["Check Engine Light", "Reduced power", "Bad fuel economy", "Rotten egg smell"],
    possibleCauses: ["Faulty catalytic converter", "Bad O2 sensors", "Engine misfire", "Exhaust leaks"],
    canDrive: "Short distance only",
    recommendedAction: "Inspect catalytic converter and oxygen sensors immediately",
    estimatedRepairCost: "$300-$2000",
    warningLevel: 8,
    aiSummary:
      "Catalytic converter efficiency is below normal. Continued driving may damage emissions components.",
  },
  P0110: {
    code: "P0110",
    title: "Intake Air Temperature Sensor Circuit Malfunction",
    category: "Powertrain",
    severity: "Low",
    description: "The ECU detected a fault in the intake air temperature sensor circuit.",
    symptoms: ["Hard starting", "Poor fuel economy", "Engine hesitation"],
    possibleCauses: ["Bad IAT sensor", "Loose connector", "Damaged wiring"],
    canDrive: "Yes",
    recommendedAction: "Inspect intake air temperature sensor and wiring",
    estimatedRepairCost: "$50-$250",
    warningLevel: 3,
    aiSummary: "Intake air temperature sensor malfunction detected.",
  },
  P0111: {
    code: "P0111",
    title: "Intake Air Temperature Sensor Range/Performance Problem",
    category: "Powertrain",
    severity: "Medium",
    description: "The intake air temperature readings are outside expected operating values.",
    symptoms: ["Poor acceleration", "Rough engine performance", "Increased fuel usage"],
    possibleCauses: ["Dirty sensor", "Faulty IAT sensor", "Air intake issues"],
    canDrive: "Yes",
    recommendedAction: "Inspect intake system and replace faulty sensor if needed",
    estimatedRepairCost: "$60-$300",
    warningLevel: 4,
    aiSummary: "Air temperature sensor performance issue detected.",
  },
  P0185: {
    code: "P0185",
    title: "Fuel Temperature Sensor B Circuit Malfunction",
    category: "Powertrain",
    severity: "Medium",
    description: "The fuel temperature sensor B circuit is malfunctioning.",
    symptoms: ["Poor performance", "Hard starting", "Rough idle"],
    possibleCauses: ["Faulty fuel temperature sensor", "Wiring problems", "Connector damage"],
    canDrive: "Yes temporarily",
    recommendedAction: "Inspect fuel temperature sensor and electrical connections",
    estimatedRepairCost: "$100-$350",
    warningLevel: 5,
    aiSummary: "Fuel temperature sensor circuit issue detected.",
  },
  P0186: {
    code: "P0186",
    title: "Fuel Temperature Sensor B Range/Performance",
    category: "Powertrain",
    severity: "Medium",
    description: "Fuel temperature sensor readings are outside expected values.",
    symptoms: ["Check Engine Light", "Reduced fuel efficiency", "Starting issues"],
    possibleCauses: ["Defective sensor", "Fuel system overheating", "Electrical problems"],
    canDrive: "Yes, but inspect soon",
    recommendedAction: "Run fuel system diagnostics and inspect the sensor",
    estimatedRepairCost: "$120-$400",
    warningLevel: 5,
    aiSummary: "Fuel temperature readings are outside normal operating range.",
  },
};

/**
 * @param {string} sev
 * @returns {"critical"|"high"|"medium"|"low"}
 */
export function normalizeSeverityToken(sev) {
  const x = String(sev || "").trim().toLowerCase();
  if (x === "critical") return "critical";
  if (x === "high") return "high";
  if (x === "medium") return "medium";
  if (x === "low") return "low";
  return "medium";
}

/**
 * @param {{ warningLevel?: number }} rich
 * @returns {"immediate"|"soon"|"schedule"|"monitor"}
 */
export function urgencyFromRichRecord(rich) {
  const wl = Number(rich.warningLevel ?? 0);
  if (wl >= 8) return "immediate";
  if (wl >= 5) return "soon";
  if (wl >= 4) return "schedule";
  return "monitor";
}

/**
 * @param {string} code
 * @returns {string}
 */
export function inferDtcCategory(code) {
  const c = String(code || "").toUpperCase().trim();
  if (c.startsWith("P")) return "Powertrain";
  if (c.startsWith("B")) return "Body";
  if (c.startsWith("C")) return "Chassis";
  if (c.startsWith("U")) return "Network";
  return "Other";
}

function buildRecommendations(baseRecs, rich) {
  const out = [];
  const seen = new Set();
  for (const r of baseRecs || []) {
    if (r && !seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  if (rich.recommendedAction && !seen.has(rich.recommendedAction)) {
    seen.add(rich.recommendedAction);
    out.push(rich.recommendedAction);
  }
  if (rich.estimatedRepairCost) {
    const line = `Typical cost range: ${rich.estimatedRepairCost}`;
    if (!seen.has(line)) out.push(line);
  }
  return out;
}

/**
 * Overlay canonical rich OBD data onto a knowledge-base row (or create from rich only).
 * @param {string} codeUpper
 * @param {import("../ai/dtcKnowledge.js").DtcEntry | null} base
 */
export function mergeRichIntoKnowledge(codeUpper, base) {
  const richRaw = SOURCE[codeUpper];
  if (!richRaw && !base) return null;
  if (!richRaw) return base;

  const sev = normalizeSeverityToken(richRaw.severity);
  const urgency = urgencyFromRichRecord(richRaw);

  /** @type {import("../ai/dtcKnowledge.js").DtcEntry} */
  const merged = {
    ...(base || {
      code: codeUpper,
      severity: sev,
      urgency,
      explanation: richRaw.description,
      causes: [],
      recommendations: [],
    }),
    code: codeUpper,
    title: richRaw.title,
    category: richRaw.category,
    severity: sev,
    urgency,
    explanation: richRaw.description || base?.explanation || richRaw.title,
    symptoms: richRaw.symptoms,
    possibleCauses: richRaw.possibleCauses,
    causes: richRaw.possibleCauses?.length ? [...richRaw.possibleCauses] : base?.causes || [],
    canDrive: richRaw.canDrive,
    recommendedAction: richRaw.recommendedAction,
    estimatedRepairCost: richRaw.estimatedRepairCost,
    warningLevel: richRaw.warningLevel,
    aiSummary: richRaw.aiSummary,
    recommendations: buildRecommendations(base?.recommendations, richRaw),
  };

  return merged;
}

/** @returns {string[]} */
export function getRichDtcCodes() {
  return Object.keys(SOURCE);
}

/**
 * @param {string} q
 * @returns {string[]}
 */
export function searchRichCodes(q) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return getRichDtcCodes();
  return getRichDtcCodes().filter((code) => {
    const r = SOURCE[code];
    if (!r) return false;
    const hay = [
      code,
      r.title,
      r.description,
      r.aiSummary,
      ...(r.symptoms || []),
      ...(r.possibleCauses || []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}

/**
 * Full-text match for any lookup row (rich + knowledge explanation).
 * @param {string} code
 * @param {string} query
 * @param {import("../ai/dtcKnowledge.js").DtcEntry | null} row
 */
export function dtcMatchesQuery(code, query, row) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    code,
    row?.title,
    row?.explanation,
    row?.aiSummary,
    row?.category,
    ...(row?.symptoms || []),
    ...(row?.possibleCauses || []),
    ...(row?.causes || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

/**
 * @param {string} category — "all" or category name
 * @param {string} code
 * @param {import("../ai/dtcKnowledge.js").DtcEntry | null} row
 */
export function dtcMatchesCategory(category, code, row) {
  if (!category || category === "all") return true;
  const cat = row?.category || inferDtcCategory(code);
  return cat === category;
}

export const RICH_DTC_RECORDS = SOURCE;
