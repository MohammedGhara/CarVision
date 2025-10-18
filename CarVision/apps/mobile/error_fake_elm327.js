// error_fake_elm327.js — ELM327 TCP simulator that always returns DTC errors
"use strict";
const net = require("net");

/* ===================== Config (via env) ===================== */
const HOST = process.env.HOST || "127.0.0.1";
const PORT = parseInt(process.env.PORT || "35000", 10);

// Error injection for transport (optional)
const NO_DATA_RATE = clamp01(parseFloat(process.env.ERROR_NO_DATA_RATE || "0")); // chance to reply "NO DATA"
const DROP_RATE    = clamp01(parseFloat(process.env.ERROR_DROP_RATE || "0"));    // chance to drop socket
const EXTRA_DELAY  = Math.max(0, parseInt(process.env.ERROR_DELAY_MS || "0", 10)); // random extra delay (ms)

// Behavior switches
const ALWAYS_ERRORS      = parseBool(process.env.ALWAYS_ERRORS || "1"); // always return DTCs
const STICKY_AFTER_CLEAR = parseBool(process.env.STICKY_AFTER_CLEAR || "0"); // if 1, 04 won't clear
const REP0PULATE_MS      = Math.max(0, parseInt(process.env.REPOPULATE_MS || "10000", 10)); // when not sticky

// Mild dynamics (sinusoidal), optional elevated "faulty" signals
const FAULTY_SIGNALS = parseBool(process.env.FAULTY_SIGNALS || "1"); // make RPM/coolant/speed look stressed

/* ===================== Utils ===================== */
function clamp01(x) { return isNaN(x) ? 0 : Math.max(0, Math.min(1, x)); }
function parseBool(v) { return v === true || v === "1" || v === "true"; }
const toHex2 = (n) => n.toString(16).toUpperCase().padStart(2, "0");

/* ===================== DTC pools & helpers ===================== */
// Example DTC pools (mix of powertrain codes)
const POOL_CURRENT = [
  "P0131", "P0420", "P0170", "P0300", "P0113", "P0101", "P0106", "P0121", "P0442", "P0507"
];
const POOL_PENDING = [
  "P0301", "P0302", "P0171", "P0172", "P0117", "P0118", "P0128", "P0133"
];
const POOL_PERMANENT = [
  "P0420", "P0430"
];

// Encode one DTC string (e.g., "P0131") to 2 bytes (A,B)
function encodeDTC(dtcs) {
  // DTC format: [family(2 bits)][d1(2 bits)][d2(4 bits)] + [d3(4 bits)][d4(4 bits)]
  // Family map: P=0, C=1, B=2, U=3 (2 bits)
  const out = [];
  for (const code of dtcs) {
    if (!/^[PCBU][0-9][0-9A-F]{3}$/i.test(code)) continue;
    const famChar = code[0].toUpperCase();
    const d1 = parseInt(code[1], 10);
    const d2 = parseInt(code[2], 16);
    const d3 = parseInt(code[3], 16);
    const d4 = parseInt(code[4], 16);
    const famBits = { P:0, C:1, B:2, U:3 }[famChar];

    const A = ((famBits & 0x3) << 6) | ((d1 & 0x3) << 4) | (d2 & 0xF);
    const B = ((d3 & 0xF) << 4) | (d4 & 0xF);
    out.push(toHex2(A), toHex2(B));
  }
  // terminator
  out.push("00", "00");
  return out;
}

// Create a 43/47/4A line with DTCs
function dtcFrame(prefix, list) {
  const body = encodeDTC(list);
  return [prefix, ...body].join(" ");
}

// Random pickers
function pickN(arr, n) {
  const a = [...arr];
  const out = [];
  for (let i = 0; i < n && a.length; i++) {
    const j = Math.floor(Math.random() * a.length);
    out.push(a[j]);
    a.splice(j, 1);
  }
  return out;
}

/* ===================== Live/Mutable DTC state ===================== */
let currentDTCs   = pickN(POOL_CURRENT, 2);
let pendingDTCs   = pickN(POOL_PENDING, 1);
let permanentDTCs = pickN(POOL_PERMANENT, 1);

function repopulateIfNeeded() {
  if (ALWAYS_ERRORS && !STICKY_AFTER_CLEAR) {
    setTimeout(() => {
      if (currentDTCs.length === 0) currentDTCs = pickN(POOL_CURRENT, 2);
    }, REP0PULATE_MS);
  }
}

/* ===================== PID makers ===================== */
function makeRPM() {
  const base = FAULTY_SIGNALS ? 2000 : 850;
  const swing = FAULTY_SIGNALS ? 2500 : 300;
  const rpm = Math.max(600, Math.round(base + swing * Math.sin(Date.now() / 700)));
  const v = Math.min(8000, rpm) * 4;
  const A = (v >> 8) & 0xFF, B = v & 0xFF;
  return `41 0C ${toHex2(A)} ${toHex2(B)}`;
}
function makeSpeed() {
  const base = FAULTY_SIGNALS ? 75 : 30;
  const swing = FAULTY_SIGNALS ? 45 : 15;
  const spd = Math.max(0, Math.round(base + swing * Math.sin(Date.now() / 900)));
  return `41 0D ${toHex2(Math.min(255, spd))}`;
}
function makeCoolant() {
  const base = FAULTY_SIGNALS ? 108 : 86;
  const swing = FAULTY_SIGNALS ? 8 : 4;
  const temp = Math.round(base + swing * Math.sin(Date.now() / 1000));
  return `41 05 ${toHex2(Math.min(255, temp + 40))}`;
}
function makeATRV() {
  const v = FAULTY_SIGNALS ? 12.1 + 0.2 * Math.sin(Date.now()/5000) : 13.9 + 0.1 * Math.sin(Date.now()/5000);
  return `${v.toFixed(1)}V`;
}
function makeLoad() {
  // 0–100% => A = percent * 2.55
  const pct = FAULTY_SIGNALS ? 75 + 20*Math.sin(Date.now()/1200) : 25 + 10*Math.sin(Date.now()/1200);
  return `41 04 ${toHex2(Math.max(0, Math.min(255, Math.round(pct*2.55))))}`;
}
function makeThrottle() {
  const pct = FAULTY_SIGNALS ? 55 + 30*Math.sin(Date.now()/1300) : 12 + 8*Math.sin(Date.now()/1300);
  return `41 11 ${toHex2(Math.max(0, Math.min(255, Math.round(pct*2.55))))}`;
}
function makeFuelLevel() {
  const pct = 40 + 5*Math.sin(Date.now()/4000);
  return `41 2F ${toHex2(Math.max(0, Math.min(255, Math.round(pct*2.55))))}`;
}
function makeIAT() {
  const t = (FAULTY_SIGNALS ? 55 : 30) + 3*Math.sin(Date.now()/3000); // °C
  return `41 0F ${toHex2(Math.round(t + 40))}`;
}
function makeMAF() {
  // grams/sec = ((A*256)+B)/100; so craft around 3–40 g/s
  const g = (FAULTY_SIGNALS ? 25 : 6) + (FAULTY_SIGNALS ? 15 : 3)*Math.sin(Date.now()/1100);
  const v = Math.max(0, Math.min(65535, Math.round(g*100)));
  const A = (v >> 8) & 0xFF, B = v & 0xFF;
  return `41 10 ${toHex2(A)} ${toHex2(B)}`;
}
function makeMAP() {
  // kPa directly in A; idle ~35, accel ~95
  const kpa = (FAULTY_SIGNALS ? 85 : 40) + (FAULTY_SIGNALS ? 15 : 5)*Math.sin(Date.now()/1400);
  return `41 0B ${toHex2(Math.max(0, Math.min(255, Math.round(kpa))))}`;
}
function makeBARO() {
  const kpa = 100 + 1*Math.sin(Date.now()/10000);
  return `41 33 ${toHex2(Math.max(0, Math.min(255, Math.round(kpa))))}`;
}
function makeSTFT() {
  // STFT % = ((A-128)/128)*100
  const pct = (FAULTY_SIGNALS ? +18 : +5) * Math.sin(Date.now()/900); // ±
  const A = Math.max(0, Math.min(255, Math.round(128 + (pct*128/100))));
  return `41 06 ${toHex2(A)}`;
}
function makeLTFT() {
  const pct = (FAULTY_SIGNALS ? +12 : +4) * Math.sin(Date.now()/6000);
  const A = Math.max(0, Math.min(255, Math.round(128 + (pct*128/100))));
  return `41 07 ${toHex2(A)}`;
}

/* ===================== Command handler ===================== */
function handleCommand(cmd) {
  const C = cmd.trim().toUpperCase();

  if (Math.random() < NO_DATA_RATE) return "NO DATA";

  // AT commands
  if (C === "ATZ" || C === "ATI") return "ELM327 v1.5";
  if (C === "ATE0" || C === "ATL0" || C === "ATH0" || C === "ATSP0") return "OK";
  if (C === "ATRV") return makeATRV();

  // OBD-II PIDs (Mode 01)
  if (C === "010C") return makeRPM();        // RPM
  if (C === "010D") return makeSpeed();      // Speed
  if (C === "0105") return makeCoolant();    // Coolant
  if (C === "0104") return makeLoad();       // Calculated Engine Load
  if (C === "0111") return makeThrottle();   // Throttle Position
  if (C === "012F") return makeFuelLevel();  // Fuel Level
  if (C === "010F") return makeIAT();        // Intake Air Temp
  if (C === "0110") return makeMAF();        // Mass Air Flow
  if (C === "010B") return makeMAP();        // MAP
  if (C === "0133") return makeBARO();       // Barometric Pressure
  if (C === "0106") return makeSTFT();       // STFT B1
  if (C === "0107") return makeLTFT();       // LTFT B1

  // DTCs
  if (C === "03") { // current DTCs
    if (!ALWAYS_ERRORS && currentDTCs.length === 0) return "NO DATA";
    if (currentDTCs.length === 0) currentDTCs = pickN(POOL_CURRENT, 2);
    return dtcFrame("43", currentDTCs);
  }
  if (C === "07") { // pending
    if (!ALWAYS_ERRORS && pendingDTCs.length === 0) return "NO DATA";
    if (pendingDTCs.length === 0) pendingDTCs = pickN(POOL_PENDING, 1);
    return dtcFrame("47", pendingDTCs);
  }
  if (C === "0A") { // permanent
    if (!ALWAYS_ERRORS && permanentDTCs.length === 0) return "NO DATA";
    if (permanentDTCs.length === 0) permanentDTCs = pickN(POOL_PERMANENT, 1);
    return dtcFrame("4A", permanentDTCs);
  }
  if (C === "04") { // clear DTCs
    if (!STICKY_AFTER_CLEAR) {
      currentDTCs = [];
      // repopulate after delay if ALWAYS_ERRORS
      repopulateIfNeeded();
    }
    return "44"; // standard "clear" echo
  }

  // Unknown but valid PID
  if (/^01[0-9A-F]{2}$/.test(C)) return "NO DATA";

  return "OK";
}

/* ===================== TCP server ===================== */
const server = net.createServer((socket) => {
  socket.setEncoding("utf8");
  socket.write("ELM327 v1.5\r\n>\r");
  let buffer = "";

  socket.on("data", (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf("\r")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);

      if (!line.trim()) { delayedWrite(socket, ">\r"); continue; }

      if (Math.random() < DROP_RATE) { socket.destroy(); return; }

      const resp = handleCommand(line);
      delayedWrite(socket, resp + "\r\n>\r");
    }
  });

  socket.on("error", () => {});
});

function delayedWrite(socket, text) {
  const delay = EXTRA_DELAY ? Math.floor(Math.random() * (EXTRA_DELAY + 1)) : 0;
  setTimeout(() => { if (!socket.destroyed) socket.write(text); }, delay);
}

server.listen(PORT, HOST, () => {
  console.log(`ELM327 error simulator listening on tcp://${HOST}:${PORT}`);
  console.log(`Transport injection: NO_DATA=${NO_DATA_RATE}, DROP=${DROP_RATE}, EXTRA_DELAY_MS=${EXTRA_DELAY}`);
  console.log(`Behavior: ALWAYS_ERRORS=${ALWAYS_ERRORS}, STICKY_AFTER_CLEAR=${STICKY_AFTER_CLEAR}, REPOPULATE_MS=${REP0PULATE_MS}`);
});
