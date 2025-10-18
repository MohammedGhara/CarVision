// fake_elm327.js — Extended ELM327 TCP simulator for CarVision
"use strict";
const net = require("net");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = parseInt(process.env.PORT || "35000", 10);
const NO_DATA_RATE = Math.max(0, Math.min(1, parseFloat(process.env.ERROR_NO_DATA_RATE || "0")));
const DROP_RATE    = Math.max(0, Math.min(1, parseFloat(process.env.ERROR_DROP_RATE || "0")));
const EXTRA_DELAY  = Math.max(0, parseInt(process.env.ERROR_DELAY_MS || "0", 10));

const CYCLE_MS = parseInt(process.env.FAULT_CYCLE_MS || "120000", 10);
const FAULT_WINDOW_MS = parseInt(process.env.FAULT_WINDOW_MS || "30000", 10);

function faultModeNow() {
  const t = Date.now() % CYCLE_MS;
  return t > (CYCLE_MS - FAULT_WINDOW_MS);
}
const toHex2 = (n) => n.toString(16).toUpperCase().padStart(2, "0");

/* ==================== PID makers ==================== */
function makeRPM() {
  const base = faultModeNow() ? 3200 : 850;
  const swing = faultModeNow() ? 900 : 200;
  const rpm = Math.max(600, Math.round(base + swing * Math.sin(Date.now() / 700)));
  const v = Math.min(8000, rpm) * 4;
  return `41 0C ${toHex2((v >> 8) & 0xFF)} ${toHex2(v & 0xFF)}`;
}
function makeSpeed() {
  const base = faultModeNow() ? 110 : 32;
  const swing = faultModeNow() ? 25 : 15;
  const spd = Math.max(0, Math.round(base + swing * Math.sin(Date.now() / 900)));
  return `41 0D ${toHex2(Math.min(255, spd))}`;
}
function makeCoolant() {
  const base = faultModeNow() ? 110 : 86;
  const swing = faultModeNow() ? 6 : 4;
  const temp = Math.round(base + swing * Math.sin(Date.now() / 1000));
  return `41 05 ${toHex2(temp + 40)}`;
}
function makeATRV() {
  const v = faultModeNow() ? 12.1 : 13.9;
  return `${v.toFixed(1)}V`;
}

/* ---- Extra PIDs ---- */
function makeLoad() {
  const pct = faultModeNow() ? 80 : 40;
  return `41 04 ${toHex2(Math.round(pct * 2.55))}`;
}
function makeThrottle() {
  const pct = faultModeNow() ? 75 : 20;
  return `41 11 ${toHex2(Math.round(pct * 2.55))}`;
}
function makeFuelLevel() {
  const pct = faultModeNow() ? 20 : 65;
  return `41 2F ${toHex2(Math.round(pct * 2.55))}`;
}
function makeIAT() {
  const temp = faultModeNow() ? 60 : 25;
  return `41 0F ${toHex2(temp + 40)}`;
}
function makeMAF() {
  const maf = faultModeNow() ? 65.0 : 22.3; // grams/sec
  const v = Math.round(maf * 100);
  return `41 10 ${toHex2((v >> 8) & 0xFF)} ${toHex2(v & 0xFF)}`;
}
function makeMAP() {
  const kpa = faultModeNow() ? 95 : 35;
  return `41 0B ${toHex2(kpa)}`;
}
function makeBaro() {
  const kpa = 101;
  return `41 33 ${toHex2(kpa)}`;
}
function makeSTFT() {
  const pct = faultModeNow() ? 25 : -2;
  return `41 06 ${toHex2(Math.round((pct * 128 / 100) + 128))}`;
}
function makeLTFT() {
  const pct = faultModeNow() ? 15 : 3;
  return `41 07 ${toHex2(Math.round((pct * 128 / 100) + 128))}`;
}

/* ---- DTCs ---- */
function makeDTC() {
  if (!faultModeNow()) return "NO DATA";
  return "43 01 31 04 20 00 00"; // Example: P0131, P0420
}
function makePendingDTC() {
  if (!faultModeNow()) return "NO DATA";
  return "47 01 10 01 11 00 00"; // Example pending codes
}
function makePermanentDTC() {
  if (!faultModeNow()) return "NO DATA";
  return "4A 01 85 01 86 00 00"; // Example permanent codes
}
function makeMonitorStatus() {
  // MIL on + 2 DTCs
  const A = 0x82; // 1000 0010b (MIL on, 2 DTC count)
  return `41 01 ${toHex2(A)} 07 65 00 00`;
}

/* ================= Command handler ================= */
function handleCommand(cmd) {
  const C = cmd.trim().toUpperCase();
  if (Math.random() < NO_DATA_RATE) return "NO DATA";

  // AT commands
  if (C === "ATZ" || C === "ATI") return "ELM327 v1.5";
  if (["ATE0","ATL0","ATH0","ATSP0"].includes(C)) return "OK";
  if (C === "ATRV") return makeATRV();

  // Core PIDs
  if (C === "010C") return makeRPM();
  if (C === "010D") return makeSpeed();
  if (C === "0105") return makeCoolant();

  // Extra PIDs
  if (C === "0104") return makeLoad();
  if (C === "0111") return makeThrottle();
  if (C === "012F") return makeFuelLevel();
  if (C === "010F") return makeIAT();
  if (C === "0110") return makeMAF();
  if (C === "010B") return makeMAP();
  if (C === "0133") return makeBaro();
  if (C === "0106") return makeSTFT();
  if (C === "0107") return makeLTFT();

  // DTCs
  if (C === "03") return makeDTC();
  if (C === "07") return makePendingDTC();
  if (C === "0A") return makePermanentDTC();
  if (C === "0101") return makeMonitorStatus();
  if (C === "04") return "44"; // clear DTCs

  if (/^01[0-9A-F]{2}$/.test(C)) return "NO DATA";
  return "OK";
}

/* ================= TCP Server ================= */
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
  console.log(`ELM327 simulator listening on tcp://${HOST}:${PORT}`);
  console.log(`Error injection: NO_DATA=${NO_DATA_RATE}, DROP=${DROP_RATE}, EXTRA_DELAY_MS=${EXTRA_DELAY}`);
});
