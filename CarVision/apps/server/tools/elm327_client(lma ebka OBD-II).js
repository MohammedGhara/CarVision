// Simple ELM327 (Wi-Fi TCP) client for Node
const net = require("net");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class ELM327 {
  constructor(host, port = 35000) {
    this.host = host;
    this.port = port;
    this.sock = null;
    this.buffer = "";
  }

  async connect() {
    if (this.sock) try { this.sock.destroy(); } catch {}
    await new Promise((resolve, reject) => {
      const s = net.createConnection({ host: this.host, port: this.port }, resolve);
      s.setEncoding("utf8");
      s.on("data", chunk => { this.buffer += chunk; });
      s.on("error", reject);
      this.sock = s;
    });
    await this.init();
  }

  // write a command and read until '>' prompt
  async cmd(str, timeout = 1500) {
    if (!this.sock) throw new Error("not connected");
    this.buffer = "";
    this.sock.write(str.trim() + "\r");
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.buffer.includes(">")) {
        const out = this.buffer.replace(/\r/g, "").replace(/>/g, "").trim();
        this.buffer = "";
        return out;
      }
      await sleep(30);
    }
    throw new Error("ELM timeout: " + str);
  }

  async init() {
    // Basic init sequence
    await this.cmd("ATZ");     // reset
    await sleep(300);
    await this.cmd("ATE0");    // echo off
    await this.cmd("ATL0");    // no linefeeds
    await this.cmd("ATS0");    // no spaces
    await this.cmd("ATH0");    // no headers
    await this.cmd("ATSP0");   // auto protocol
  }

  async atrv() { // voltage (ELM extension)
    const r = await this.cmd("ATRV");
    // Returns like "12.4V"
    const m = r.match(/([\d.]+)\s*V/i);
    return m ? parseFloat(m[1]) : null;
  }

  async pid(hex) {
    // hex like "010C"
    const r = await this.cmd(hex);
    // typical: "410C 1A F8" or "41 0C 1A F8"
    const line = r.split("\n").find(l => /41/i.test(l));
    if (!line) return null;
    const bytes = line.replace(/[^0-9A-F]/gi, " ").trim().split(/\s+/).slice(2).map(x => parseInt(x,16));
    return { pid: hex, bytes };
  }
}

function decode(pid, bytes) {
  // Return {key, value}
  if (!bytes) return null;
  const A = bytes[0], B = bytes[1];
  switch (pid) {
    case "010C": return { key: "rpm",      value: (((A << 8) + B) / 4) };                  // RPM
    case "010D": return { key: "speed",    value: A };                                     // km/h
    case "0105": return { key: "coolant",  value: A - 40 };                                // °C
    case "0104": return { key: "load",     value: (A * 100) / 255 };                       // %
    case "0111": return { key: "throttle", value: (A * 100) / 255 };                       // %
    case "012F": return { key: "fuel",     value: (A * 100) / 255 };                       // %
    case "010F": return { key: "iat",      value: A - 40 };                                // °C
    case "0110": return { key: "maf",      value: (((A << 8) + B) / 100) };                // g/s
    case "010B": return { key: "map",      value: A };                                     // kPa
    case "0133": return { key: "baro",     value: A };                                     // kPa
    case "0106": return { key: "stft",     value: ((A - 128) * 100) / 128 };               // %
    case "0107": return { key: "ltft",     value: ((A - 128) * 100) / 128 };               // %
    default: return null;
  }
}

function parseDTCBytes(bytes) {
  // bytes from 03/07/0A response. Basic decoder.
  const out = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const b1 = bytes[i], b2 = bytes[i+1];
    if (b1 === 0 && b2 === 0) break;
    const n = (b1 << 8) | b2;
    const type = ["P","C","B","U"][(b1 & 0xC0) >> 6];
    const code = ((b1 & 0x3F) << 8) | b2;
    out.push(type + code.toString(16).toUpperCase().padStart(4,"0"));
  }
  return out;
}

module.exports = { ELM327, decode, parseDTCBytes };
