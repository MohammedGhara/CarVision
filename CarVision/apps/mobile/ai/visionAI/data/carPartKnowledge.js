/**
 * DoctorCar Vision AI — local automotive visual knowledge base.
 * Used by the mock classifier; future vision models can map labels → these entries.
 *
 * @typedef {('low'|'medium'|'high'|'critical')} SeverityBand
 * @typedef {('yes'|'no'|'caution')} DriveAdvice
 * @typedef {('$'|'$$'|'$$$'|'$$$$')} RepairCostCategory
 *
 * @typedef {object} CarPartKnowledgeEntry
 * @property {string} id
 * @property {string[]} keywords — matched against filename / user hint (mock “vision”).
 * @property {string} title
 * @property {string} description
 * @property {string[]} causes
 * @property {SeverityBand} severity
 * @property {string[]} solutions
 * @property {string[]} maintenanceAdvice
 * @property {RepairCostCategory} repairCostCategory
 * @property {DriveAdvice} driveAdvice
 * @property {string} category — e.g. electrical, cooling, brakes
 */

/** @type {CarPartKnowledgeEntry[]} */
export const CAR_PART_KNOWLEDGE = [
  {
    id: "battery_corrosion",
    keywords: ["battery", "corrosion", "terminal", "white", "green", "rust", "acid", "positive", "negative"],
    title: "Battery terminal corrosion",
    description:
      "White or greenish buildup on battery posts or clamps increases resistance, causes hard starts, and can damage cables.",
    causes: ["Electrolyte vapor / acid creep", "Age and humidity", "Loose terminal clamp", "Minor overcharging"],
    severity: "medium",
    solutions: [
      "Disconnect negative then positive; clean posts and clamps with baking-soda solution and a terminal brush.",
      "Rinse dry areas only; avoid flooding the battery. Re-torque clamps to spec; apply dielectric grease.",
    ],
    maintenanceAdvice: ["Inspect terminals quarterly", "Check charging voltage after service"],
    repairCostCategory: "$",
    driveAdvice: "caution",
    category: "electrical",
  },
  {
    id: "rusty_terminals",
    keywords: ["rust", "terminal", "cable", "clamp", "oxidized"],
    title: "Rusty or oxidized terminals",
    description: "Surface rust on clamps or cable ends can mimic corrosion and raise contact resistance.",
    causes: ["Moisture exposure", "Road salt", "Paint/coatings worn off"],
    severity: "low",
    solutions: ["Clean and protect with anti-corrosion spray", "Replace cable end if strands are corroded through"],
    maintenanceAdvice: ["Replace damaged cables — resistance causes heat at the terminal"],
    repairCostCategory: "$",
    driveAdvice: "yes",
    category: "electrical",
  },
  {
    id: "coolant_leak",
    keywords: ["coolant", "antifreeze", "green", "orange", "pink", "puddle", "reservoir", "overflow"],
    title: "Coolant leak (external)",
    description: "Colored fluid under the front of the vehicle or at the expansion tank often indicates a cooling system leak.",
    causes: ["Hose clamp fatigue", "Radiator seam crack", "Water pump seal", "Head gasket (if oil contamination — not visible from one photo)"],
    severity: "high",
    solutions: [
      "Do not open a hot radiator cap. After cool-down, pressure-test the system and trace the highest wet point.",
      "Top up only with correct spec coolant if you must reach help — monitor temperature closely.",
    ],
    maintenanceAdvice: ["Fix leaks before long trips", "Replace aged hoses on schedule"],
    repairCostCategory: "$$",
    driveAdvice: "caution",
    category: "cooling",
  },
  {
    id: "radiator_leak",
    keywords: ["radiator", "leak", "crack", "fin", "core", "wet", "drip"],
    title: "Leaking radiator",
    description: "Wet areas on the core, tank seams, or hose connections suggest radiator failure risk.",
    causes: ["Stone impact", "Electrolysis / internal corrosion", "Plastic tank seam fatigue"],
    severity: "high",
    solutions: ["Pressure test", "Replace radiator if tank or core is compromised", "Verify fan operation and thermostat"],
    maintenanceAdvice: ["Flush per manufacturer — improper mix accelerates internal corrosion"],
    repairCostCategory: "$$",
    driveAdvice: "caution",
    category: "cooling",
  },
  {
    id: "broken_hose",
    keywords: ["hose", "burst", "split", "clamp", "coolant", "rubber"],
    title: "Damaged coolant hose",
    description: "Bulging, cracking, or wet hose sections are common leak sources under pressure.",
    causes: ["Heat cycling", "Oil contamination on rubber", "Incorrect clamp torque"],
    severity: "high",
    solutions: ["Replace hose and clamps", "Bleed air from cooling system after refill"],
    maintenanceAdvice: ["Inspect hoses whenever coolant is serviced"],
    repairCostCategory: "$",
    driveAdvice: "caution",
    category: "cooling",
  },
  {
    id: "oil_leak",
    keywords: ["oil", "brown", "black", "stain", "pan", "valve", "seep", "drip"],
    title: "Engine oil leak",
    description: "Dark oily residue on the block, pan, or driveway suggests an active or recent seep.",
    causes: ["Gasket shrinkage", "Drain plug seal", "PCV-related pressure", "Rear main seal (often misdiagnosed from below)"],
    severity: "medium",
    solutions: ["Identify highest oil trail with UV dye if needed", "Repair source seal; monitor oil level daily"],
    maintenanceAdvice: ["Running low on oil causes catastrophic wear — check dipstick before each drive until fixed"],
    repairCostCategory: "$$",
    driveAdvice: "caution",
    category: "engine",
  },
  {
    id: "worn_tire",
    keywords: ["tire", "tread", "wear", "bald", "low", "shoulder", "cupping"],
    title: "Worn tire tread",
    description: "Shallow tread or uneven wear reduces grip in wet conditions and increases blowout risk when cord shows.",
    causes: ["Under-inflation", "Misalignment", "Worn shocks", "Lack of rotation"],
    severity: "high",
    solutions: ["Replace tires at legal/safe tread depth", "Align and balance after suspension checks"],
    maintenanceAdvice: ["Check pressures monthly", "Rotate per schedule"],
    repairCostCategory: "$$$",
    driveAdvice: "no",
    category: "tires",
  },
  {
    id: "cracked_tire",
    keywords: ["crack", "sidewall", "cut", "bubble", "bulge", "tire"],
    title: "Sidewall damage / crack / bulge",
    description: "Sidewall cracks, cuts, or bulges indicate structural damage — sudden failure risk.",
    causes: ["Curb impact", "Age ozone cracking", "Under-inflation overload"],
    severity: "critical",
    solutions: ["Replace tire immediately — do not patch sidewall structural damage", "Inspect rim for deformation"],
    maintenanceAdvice: ["Avoid mixing very old tires on high-speed axles"],
    repairCostCategory: "$$$",
    driveAdvice: "no",
    category: "tires",
  },
  {
    id: "brake_wear",
    keywords: ["brake", "pad", "rotor", "caliper", "thin", "dust", "wheel"],
    title: "Brake pad / rotor wear indicators",
    description: "Thin friction material, deep grooves in rotor, or excessive lip suggests service is due.",
    causes: ["Normal wear", "Sticking caliper slide", "Aggressive driving", "Low-quality pads"],
    severity: "high",
    solutions: ["Measure pad thickness vs spec", "Service or replace pads/rotors; lubricate caliper slides"],
    maintenanceAdvice: ["Brake fluid moisture test on major services"],
    repairCostCategory: "$$",
    driveAdvice: "caution",
    category: "brakes",
  },
  {
    id: "engine_smoke",
    keywords: ["smoke", "steam", "white", "blue", "gray", "exhaust", "tailpipe"],
    title: "Engine smoke / vapor from exhaust or bay",
    description: "Blue-gray often oil; white steam may be coolant; black smoke often rich fuel — context matters.",
    causes: ["Turbo seal", "Head gasket", "PCV", "Injector / fuel trim issues", "External oil on hot manifold"],
    severity: "critical",
    solutions: ["Stop if temperature rises or oil pressure drops", "Tow if smoke is heavy or oil/coolant loss is rapid"],
    maintenanceAdvice: ["Do not ignore rising temperature with white smoke"],
    repairCostCategory: "$$$$",
    driveAdvice: "no",
    category: "engine",
  },
  {
    id: "damaged_belt",
    keywords: ["belt", "serpentine", "crack", "fray", "glaze", "pulley", "squeal"],
    title: "Serpentine / accessory belt wear",
    description: "Cracking, chunking, or glazing can lead to sudden loss of charging, PS, or water pump drive.",
    causes: ["Age", "Misalignment", "Bad tensioner or idler pulley"],
    severity: "high",
    solutions: ["Replace belt and inspect tensioner/idler", "Verify pulley alignment"],
    maintenanceAdvice: ["Replace on schedule or when cracks appear across ribs"],
    repairCostCategory: "$",
    driveAdvice: "caution",
    category: "engine",
  },
  {
    id: "dirty_air_filter",
    keywords: ["filter", "airbox", "dirty", "clog", "intake"],
    title: "Dirty engine air filter",
    description: "Restricted intake can reduce power and economy; usually not an immediate safety item alone.",
    causes: ["Dusty environment", "Neglected maintenance"],
    severity: "low",
    solutions: ["Replace air filter", "Inspect intake duct for debris after off-road use"],
    maintenanceAdvice: ["Check at every oil change in dusty climates"],
    repairCostCategory: "$",
    driveAdvice: "yes",
    category: "engine",
  },
  {
    id: "warning_lights",
    keywords: ["dashboard", "light", "mil", "check", "engine", "abs", "tpms", "oil", "battery", "symbol"],
    title: "Dashboard warning lamp(s)",
    description: "Illuminated telltales indicate the vehicle self-test found a fault — severity depends on which lamp.",
    causes: ["Stored DTC", "Low fluid", "Sensor fault", "Charging system issue"],
    severity: "medium",
    solutions: ["Scan OBD-II for codes", "If red oil pressure or temperature warning — stop safely immediately"],
    maintenanceAdvice: ["Use CarVision Live Data + Diagnostics with a qualified reader"],
    repairCostCategory: "$$",
    driveAdvice: "caution",
    category: "electrical",
  },
  {
    id: "spark_plug_damage",
    keywords: ["spark", "plug", "electrode", "insulator", "fouled"],
    title: "Spark plug condition (if visible)",
    description: "Oil fouling, cracked insulator, or eroded electrodes point to ignition or underlying engine issues.",
    causes: ["Worn rings/valve seals (oil)", "Overheat", "Wrong heat range", "Lean misfire damage"],
    severity: "medium",
    solutions: ["Replace plugs with OEM spec", "Diagnose root cause before repeated fouling"],
    maintenanceAdvice: ["Torque to spec — cylinder head thread damage is costly"],
    repairCostCategory: "$$",
    driveAdvice: "caution",
    category: "engine",
  },
];

/** @param {string} id */
export function getKnowledgeById(id) {
  return CAR_PART_KNOWLEDGE.find((e) => e.id === id) || null;
}
