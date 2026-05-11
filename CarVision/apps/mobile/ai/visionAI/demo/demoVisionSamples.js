/**
 * Demo seeds for graduation demo without camera (filename + hint triggers mock classifier).
 * @type {{ label: string, hint: string, fileName: string, knowledgeId: string }[]}
 */
export const DEMO_VISION_SAMPLES = [
  { label: "Coolant leak", hint: "green coolant puddle under radiator hose", fileName: "coolant_leak_front.jpg", knowledgeId: "coolant_leak" },
  { label: "Battery corrosion", hint: "white powder on battery positive terminal", fileName: "battery_terminal.jpg", knowledgeId: "battery_corrosion" },
  { label: "Worn tire", hint: "tire tread very low wear bars visible", fileName: "tire_tread.jpg", knowledgeId: "worn_tire" },
  { label: "Cracked tire", hint: "sidewall crack on tire", fileName: "sidewall_crack.jpg", knowledgeId: "cracked_tire" },
  { label: "Brake wear", hint: "brake pad thin through wheel", fileName: "brake_pad.jpg", knowledgeId: "brake_wear" },
  { label: "Engine smoke", hint: "blue smoke from exhaust", fileName: "exhaust_smoke.jpg", knowledgeId: "engine_smoke" },
  { label: "Damaged belt", hint: "serpentine belt cracks", fileName: "belt_cracks.jpg", knowledgeId: "damaged_belt" },
  { label: "Oil leak", hint: "oil drip on engine pan", fileName: "oil_under_car.jpg", knowledgeId: "oil_leak" },
  { label: "Warning lights", hint: "check engine light on dashboard", fileName: "dash_mil.jpg", knowledgeId: "warning_lights" },
];
