// carvision_client.js — sequential polling (fixes N/A for Speed/Coolant)
"use strict";
const net = require("net");
const DEBUG = process.env.DEBUG === "1";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = parseInt(process.env.PORT || "35000", 10);
const RETRY_MS_BASE = parseInt(process.env.RETRY_MS || "3000", 10);
const READ_TIMEOUT_MS = parseInt(process.env.READ_TIMEOUT_MS || "2000", 10); // a bit higher
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "1000", 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function hexByteToInt(h) { return parseInt(h, 16); }
function parseTokens(line) { return line.trim().split(/\s+/).filter(Boolean); }

function withTimeout(promise, ms, name) {
  let to;
  const timeout = new Promise((_, rej) => {
    to = setTimeout(() => rej(new Error(`${name || "operation"} timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(to));
}

function readUntilPrompt(sock) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (d) => {
      buf += d;
      if (buf.includes(">\r") || buf.includes(">\n") || buf.endsWith(">")) {
        cleanup(); resolve(buf);
      }
    };
    const onErr = (e) => { cleanup(); reject(e); };
    const onClose = () => { cleanup(); reject(new Error("socket closed")); };
    function cleanup() {
      sock.off("data", onData);
      sock.off("error", onErr);
      sock.off("close", onClose);
    }
    sock.on("data", onData);
    sock.once("error", onErr);
    sock.once("close", onClose);
  });
}

async function sendCmd(sock, cmd) {
  if (DEBUG) console.log("=>", cmd);
  sock.write(cmd + "\r");
  const resp = await withTimeout(readUntilPrompt(sock), READ_TIMEOUT_MS, `read ${cmd}`);
  const clean = resp.split(/\r?\n/).map(s => s.trim()).filter(s => s && s !== ">");
  if (DEBUG) console.log("<=", clean);
  return clean;
}

// Decoders
function decodeRPM(tokens) {
  const A = hexByteToInt(tokens[2] || "00");
  const B = hexByteToInt(tokens[3] || "00");
  return Math.round(((A * 256) + B) / 4);
}
function decodeSpeed(tokens) {
  const A = hexByteToInt(tokens[2] || "00");
  return A;
}
function decodeCoolant(tokens) {
  const A = hexByteToInt(tokens[2] || "00");
  return A - 40;
}
function parseDTC(rawLines) {
  const joined = rawLines.join(" ");
  if (/NO DATA/i.test(joined)) return [];
  const line = rawLines.find(l => l.startsWith("43 "));
  if (!line) return [];
  const t = parseTokens(line).slice(1);
  const out = [];
  for (let i = 0; i + 1 < t.length; i += 2) {
    const a = hexByteToInt(t[i]), b = hexByteToInt(t[i + 1]);
    if (a === 0 && b === 0) break;
    const chIdx = (a & 0xC0) >> 6;
    const family = ["P","C","B","U"][chIdx];
    const d1 = ((a & 0x30) >> 4).toString();
    const d2 = (a & 0x0F).toString(16).toUpperCase();
    const d3 = ((b & 0xF0) >> 4).toString(16).toUpperCase();
    const d4 = (b & 0x0F).toString(16).toUpperCase();
    out.push(`${family}${d1}${d2}${d3}${d4}`);
  }
  return out;
}

// 3-level classifier
const state = { lastConnectedAt: null, highRpmSince: null };
function classify({ rpm, speed, coolant, dtcs, connected }) {
  const now = Date.now();
  if (connected) state.lastConnectedAt = now;
  if (!connected && state.lastConnectedAt && now - state.lastConnectedAt > 10000) {
    return { level: "CRITICAL", reason: "Link down > 10s" };
  }
  if (rpm > 4000) {
    if (!state.highRpmSince) state.highRpmSince = now;
  } else {
    state.highRpmSince = null;
  }
  const highRpmLong = state.highRpmSince && (now - state.highRpmSince > 5000);
  const dtcCount = dtcs.length;

  if (coolant >= 110 || dtcCount > 1 || highRpmLong) {
    const reason = coolant >= 110 ? "Coolant ≥ 110°C"
      : (dtcCount > 1 ? `More than one DTC (${dtcCount})` : "RPM > 4000 for > 5s");
    return { level: "CRITICAL", reason };
  }
  if ((coolant >= 100 && coolant < 110) || rpm > 4000 || dtcCount === 1) {
    const reason = (coolant >= 100 && coolant < 110) ? "Coolant 100–110°C"
      : (rpm > 4000 ? "RPM > 4000" : "One DTC present");
    return { level: "WARNING", reason };
  }
  return { level: "NORMAL", reason: "All readings within range, no DTCs" };
}

async function main() {
  let attempt = 0;

  while (true) {
    const sock = new net.Socket();
    let connected = false;

    await new Promise((resolve) => {
      sock.connect(PORT, HOST, () => {
        connected = true;
        attempt = 0;
        console.log(`Connected to ELM327 at tcp://${HOST}:${PORT}`);
        resolve();
      });
      sock.on("error", () => resolve());
    });

    if (!connected) {
      const backoff = RETRY_MS_BASE * Math.min(5, ++attempt);
      console.log("Connection failed… retrying in", backoff, "ms");
      await sleep(backoff);
      continue;
    }

    try {
      // AT init
      try { await sendCmd(sock, "ATZ"); } catch {}
      try { await sendCmd(sock, "ATE0"); } catch {}
      try { await sendCmd(sock, "ATL0"); } catch {}
      try { await sendCmd(sock, "ATH0"); } catch {}
      try { await sendCmd(sock, "ATSP0"); } catch {}
      try {
        const rv = await sendCmd(sock, "ATRV");
        console.log("Battery (ATRV):", rv.join(" | "));
      } catch (e) {
        console.log("ATRV read failed:", e.message);
      }

      // SEQUENTIAL polling (the important fix)
      while (true) {
        const rpmResp = await sendCmd(sock, "010C").catch(e => ["ERR " + e.message]);
        const spdResp = await sendCmd(sock, "010D").catch(e => ["ERR " + e.message]);
        const tmpResp = await sendCmd(sock, "0105").catch(e => ["ERR " + e.message]);
        const dtcResp = await sendCmd(sock, "03").catch(e => ["ERR " + e.message]);

        const rpmTokens = parseTokens(rpmResp.find(l => l.startsWith("41 0C")) || "");
        const spdTokens = parseTokens(spdResp.find(l => l.startsWith("41 0D")) || "");
        const tmpTokens = parseTokens(tmpResp.find(l => l.startsWith("41 05")) || "");

        const rpm = rpmTokens.length ? decodeRPM(rpmTokens) : NaN;
        const speed = spdTokens.length ? decodeSpeed(spdTokens) : NaN;
        const coolant = tmpTokens.length ? decodeCoolant(tmpTokens) : NaN;
        const dtcs = dtcResp[0]?.startsWith("ERR") ? [] : parseDTC(dtcResp);

        const status = classify({ rpm, speed, coolant, dtcs, connected: true });

        console.log(
          `[${new Date().toLocaleTimeString()}] ` +
          `RPM=${Number.isNaN(rpm) ? "N/A" : rpm} | ` +
          `Speed=${Number.isNaN(speed) ? "N/A" : speed} km/h | ` +
          `Coolant=${Number.isNaN(coolant) ? "N/A" : coolant}°C | ` +
          `DTCs=${dtcs.length ? dtcs.join(",") : "None"} ` +
          `=> ${status.level} (${status.reason})`
        );

        await sleep(POLL_INTERVAL_MS);
      }
    } catch (e) {
      console.log("Link error:", e.message || e);
    } finally {
      sock.destroy();
      const backoff = RETRY_MS_BASE * Math.min(5, ++attempt);
      console.log("Reconnecting in", backoff, "ms…");
      await sleep(backoff);
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
