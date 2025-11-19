// Apps/server/server.js — CarVision web server + WS bridge to ELM327 + AI chat API
"use strict";
// Using native fetch (Node 18+) - no need for node-fetch

/* ───────────── Optional: relax listener cap (avoid warnings) ───────────── */
require("events").EventEmitter.defaultMaxListeners = 30;

/* ───────────── Deps ───────────── */
require("dotenv").config();                  // .env for OPENAI_API_KEY
const http = require("http");
const path = require("path");
const fs = require("fs");
const net = require("net");
const WebSocket = require("ws");
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");
/* ───────────── Config (env overridable) ───────────── */
const HTTP_PORT        = parseInt(process.env.HTTP_PORT || "5173", 10);
const HTTP_HOST        = process.env.HTTP_HOST || "0.0.0.0";     // serve to LAN
const ELM_HOST         = process.env.ELM_HOST  || "127.0.0.1";   // ELM327 TCP host (sim: 127.0.0.1)
const ELM_PORT         = parseInt(process.env.ELM_PORT || "35000", 10);
const READ_TIMEOUT_MS  = parseInt(process.env.READ_TIMEOUT_MS || "2000", 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "1000", 10);
const DEBUG            = process.env.DEBUG === "1";
const prisma = new PrismaClient();

/* ───────────── Express app (static + APIs) ───────────── */
const app = express();
app.use(cors());

app.use(express.json());

const PUBLIC_DIR = path.join(__dirname, "public");
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR)); // optional; serves ./public/*
}
const { router: authRouter } = require("./src/auth");
app.use("/api/auth", authRouter);

// Password reset now uses 6-digit code sent via email (no redirect route needed)

// health check
app.get("/api/ping", (req, res) => res.json({ ok: true, t: Date.now() }));

// AI chat API (OpenAI proxy)
app.post("/api/chat", async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ ok:false, error:"message required" });

  const KEY = process.env.OPENAI_API_KEY;
  const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!KEY) return res.status(503).json({ ok:false, error:"missing OPENAI_API_KEY" });

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role:"system", content:"You are CarVision AI. Help with OBD-II, DTCs and car symptoms." },
          { role:"user", content: message }
        ]
      })
    });
    if (!r.ok) {
      const detail = await r.text().catch(()=>"");
      return res.status(502).json({ ok:false, error:`OpenAI ${r.status}`, detail });
    }
    const data = await r.json();
    res.json({ ok:true, reply: data.choices?.[0]?.message?.content ?? "" });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});
// List all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ ok: true, users });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Create a user
app.post("/api/users", async (req, res) => {
  try {
    const { email, name, role = "CLIENT" } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: "email required" });
    const user = await prisma.user.create({ data: { email, name, role } });
    res.json({ ok: true, user });
  } catch (e) {
    // handle unique email error
    if (e.code === "P2002") return res.status(409).json({ ok: false, error: "email already exists" });
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Read one
app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, user });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Delete one
app.delete("/api/users/:id", async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/* ───────────── HTTP + WebSocket server ───────────── */
const httpServer = http.createServer(app);
const wss = new WebSocket.Server({ server: httpServer, path: "/ws" });

function wsBroadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const c of wss.clients)
    if (c.readyState === WebSocket.OPEN) c.send(msg);
}

const commandQueue = []; // { cmd: "04", ackId: string }

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "clearDTCs") {
        const ackId = `ack_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        commandQueue.push({ cmd: "04", ackId });
        ws.send(JSON.stringify({ type: "queued", ackId }));
      }
    } catch {}
  });
});

/* ───────────── Helpers for ELM TCP polling ───────────── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function hexByteToInt(h) { return parseInt(h, 16); }
function parseTokens(line) { return line.trim().split(/\s+/).filter(Boolean); }

function withTimeout(promise, ms, name) {
  let to;
  const t = new Promise((_, rej) => { to = setTimeout(() => rej(new Error(`${name||"op"} timeout after ${ms}ms`)), ms); });
  return Promise.race([promise, t]).finally(() => clearTimeout(to));
}

// read one response until '>' prompt (per-call listeners; no global wipes)
function readUntilPrompt(sock) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (d) => {
      buf += d;
      if (buf.includes(">\r") || buf.includes(">\n") || buf.endsWith(">")) cleanup(resolve, buf);
    };
    const onErr = (e) => cleanup(reject, e);
    const onClose = () => cleanup(reject, new Error("socket closed"));
    function cleanup(fn, arg) {
      sock.off("data", onData);
      sock.off("error", onErr);
      sock.off("close", onClose);
      fn(arg);
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

/* ───────────── Token helpers & decoders ───────────── */
function tokens(rawLines, startsWith) {
  if (!Array.isArray(rawLines)) return null;
  const line = rawLines.find(l => l.startsWith(startsWith));
  return line ? parseTokens(line) : null;
}
const A = (t) => hexByteToInt((t && t[2]) || "00");
const B = (t) => hexByteToInt((t && t[3]) || "00");

function decodeRPM(t)     { return Math.round(((A(t) * 256) + B(t)) / 4); }
function decodeSpeed(t)   { return A(t); }
function decodeCoolant(t) { return A(t) - 40; }

// Extra decoders
function decodeTemp(t)           { return A(t) - 40; }                         // °C
function decodeSeconds(t)        { return (A(t) * 256) + B(t); }               // s
function decodeDistanceKm(t)     { return (A(t) * 256) + B(t); }               // km
function decodeFuelRateLph(t)    { return ((A(t) * 256) + B(t)) / 20; }        // L/h (PID 5E)
function decodeCtrlModuleVolt(t) { return ((A(t) * 256) + B(t)) / 1000; }      // V (PID 42)
function decodeO2Volt(t)         { return A(t) / 200; }                        // V (PID 14..1B)

// fuel system status (PID 03) - very basic map (A only)
function decodeFuelSystem(Abyte) {
  const map = {
    0: "Not available", 1: "Open loop (cold)", 2: "Closed loop",
    4: "Open loop (load)", 8: "Open loop (fault)"
  };
  return map[Abyte] || `Status ${Abyte}`;
}

function parseDTCFrom(rawLines, header) {
  const joined = (rawLines || []).join(" ");
  if (/NO DATA/i.test(joined)) return [];
  const line = (rawLines || []).find(l => l.startsWith(header + " "));
  if (!line) return [];
  const tt = parseTokens(line).slice(1);
  const out = [];
  for (let i = 0; i + 1 < tt.length; i += 2) {
    const a = hexByteToInt(tt[i]);
    const b = hexByteToInt(tt[i+1]);
    if (a === 0 && b === 0) break;
    const chIdx = (a & 0xC0) >> 6;
    const fam = ["P","C","B","U"][chIdx];
    const d1 = ((a & 0x30) >> 4).toString();
    const d2 = (a & 0x0F).toString(16).toUpperCase();
    const d3 = ((b & 0xF0) >> 4).toString(16).toUpperCase();
    const d4 = (b & 0x0F).toString(16).toUpperCase();
    out.push(`${fam}${d1}${d2}${d3}${d4}`);
  }
  return out;
}

/* ───────────── Status classifier ───────────── */
const state = { lastConnectedAt: null, highRpmSince: null };
function classify({ rpm, speed, coolant, dtcs, connected }) {
  const now = Date.now();
  if (connected) state.lastConnectedAt = now;
  if (!connected && state.lastConnectedAt && now - state.lastConnectedAt > 10000) {
    return { level: "CRITICAL", reason: "Link down > 10s" };
  }
  if (rpm > 4000) { if (!state.highRpmSince) state.highRpmSince = now; }
  else { state.highRpmSince = null; }
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
  if (dtcs.length > 0) return { level: "WARNING", reason: `${dtcs.length} DTC present` };
  return { level: "NORMAL", reason: "All readings within range, no DTCs" };
}

/* ───────────── ELM main loop (24/7) ───────────── */
(async function startElmLoop() {
  let attempt = 0;

  while (true) {
    const sock = new net.Socket();
    let connected = false;

    await new Promise((resolve) => {
      sock.connect(ELM_PORT, ELM_HOST, () => { connected = true; attempt = 0; resolve(); });
      sock.on("error", () => resolve());
    });

    if (!connected) {
      const backoff = 1000 * Math.min(5, ++attempt);
      wsBroadcast({ type: "link", status: "down", message: `retrying in ${backoff}ms` });
      await sleep(backoff);
      continue;
    }

    wsBroadcast({ type: "link", status: "up", message: `Connected to tcp://${ELM_HOST}:${ELM_PORT}` });

    let startedAt = Date.now(); // for runtime fallback

    try {
      // AT init (ignore per-command errors)
      try { await sendCmd(sock, "ATZ"); }  catch {}
      try { await sendCmd(sock, "ATE0"); } catch {}
      try { await sendCmd(sock, "ATL0"); } catch {}
      try { await sendCmd(sock, "ATH0"); } catch {}
      try { await sendCmd(sock, "ATSP0"); } catch {}

      // ── Stream loop (SEQUENTIAL polling to avoid listener conflicts) ──
      while (true) {
        // process UI commands first
        while (commandQueue.length) {
          const { cmd, ackId } = commandQueue.shift();
          let ok = true, resp = [];
          try { resp = await sendCmd(sock, cmd); } catch { ok = false; }
          wsBroadcast({ type: "ack", ackId, ok, resp });
        }

        // core
        const atrv         = await sendCmd(sock, "ATRV").catch(() => ["NO DATA"]);
        const rpmResp      = await sendCmd(sock, "010C").catch(() => ["NO DATA"]);
        const spdResp      = await sendCmd(sock, "010D").catch(() => ["NO DATA"]);
        const tmpResp      = await sendCmd(sock, "0105").catch(() => ["NO DATA"]);

        // extras
        const loadResp     = await sendCmd(sock, "0104").catch(() => ["NO DATA"]);
        const thrResp      = await sendCmd(sock, "0111").catch(() => ["NO DATA"]);
        const fuelLvlResp  = await sendCmd(sock, "012F").catch(() => ["NO DATA"]);
        const iatResp      = await sendCmd(sock, "010F").catch(() => ["NO DATA"]);
        const mafResp      = await sendCmd(sock, "0110").catch(() => ["NO DATA"]);
        const mapResp      = await sendCmd(sock, "010B").catch(() => ["NO DATA"]);
        const baroResp     = await sendCmd(sock, "0133").catch(() => ["NO DATA"]);
        const stftResp     = await sendCmd(sock, "0106").catch(() => ["NO DATA"]);
        const ltftResp     = await sendCmd(sock, "0107").catch(() => ["NO DATA"]);
        const fuelSysResp  = await sendCmd(sock, "0103").catch(() => ["NO DATA"]); // Fuel system status
        const runtimeResp  = await sendCmd(sock, "011F").catch(() => ["NO DATA"]); // Run time since start
        const distMILResp  = await sendCmd(sock, "0131").catch(() => ["NO DATA"]); // Distance since MIL on
        const ambResp      = await sendCmd(sock, "0146").catch(() => ["NO DATA"]); // Ambient air temp
        const oilTResp     = await sendCmd(sock, "015C").catch(() => ["NO DATA"]); // Engine oil temp
        const fuelRateResp = await sendCmd(sock, "015E").catch(() => ["NO DATA"]); // Engine fuel rate (L/h)
        const cmVoltResp   = await sendCmd(sock, "0142").catch(() => ["NO DATA"]); // Control module voltage
        const o2NarrowResp = await sendCmd(sock, "0114").catch(() => ["NO DATA"]); // O2 B1S1 narrowband
        const o2WideResp   = await sendCmd(sock, "0124").catch(() => ["NO DATA"]); // Wideband (eq ratio)

        // DTCs + readiness
        const dtcCurrentResp   = await sendCmd(sock, "03").catch(() => ["NO DATA"]);
        const dtcPendingResp   = await sendCmd(sock, "07").catch(() => ["NO DATA"]);
        const dtcPermanentResp = await sendCmd(sock, "0A").catch(() => ["NO DATA"]);
        const monResp          = await sendCmd(sock, "0101").catch(() => ["NO DATA"]);

        // parse core
        const rpmTok = tokens(rpmResp, "41 0C");
        const spdTok = tokens(spdResp, "41 0D");
        const tmpTok = tokens(tmpResp, "41 05");

        // --- parse extra PIDs ---
        const fuelTok  = tokens(fuelSysResp, "41 03");
        const runTok   = tokens(runtimeResp, "41 1F");
        const distTok  = tokens(distMILResp, "41 31");
        const ambTok   = tokens(ambResp, "41 46");
        const oilTok   = tokens(oilTResp, "41 5C");
        const frTok    = tokens(fuelRateResp, "41 5E");
        const vTok     = tokens(cmVoltResp, "41 42");
        const o2TokN   = tokens(o2NarrowResp, "41 14");
        const o2TokW   = tokens(o2WideResp, "41 24");

        const fuelSystem      = fuelTok ? decodeFuelSystem(A(fuelTok)) : null;
        // Runtime with fallback to software timer
        const runtimeSec      = runTok ? decodeSeconds(runTok) : Math.floor((Date.now() - startedAt) / 1000);
        const distSinceMIL_km = distTok ? decodeDistanceKm(distTok) : null;
        const ambient         = ambTok ? decodeTemp(ambTok) : null;
        const oilTemp         = oilTok ? decodeTemp(oilTok) : null;

        const rpm     = rpmTok ? decodeRPM(rpmTok) : null;
        const speed   = spdTok ? decodeSpeed(spdTok) : null;
        const coolant = tmpTok ? decodeCoolant(tmpTok) : null;
        const battery = atrv.find(l => /^[0-9.]+V$/i.test(l)) || null;

        // parse extras
        const load     = (() => { const t = tokens(loadResp, "41 04"); return t ? (A(t) / 2.55) : null; })();
        const throttle = (() => { const t = tokens(thrResp, "41 11"); return t ? (A(t) / 2.55) : null; })();
        const fuel     = (() => { const t = tokens(fuelLvlResp, "41 2F"); return t ? (A(t) / 2.55) : null; })();
        const iat      = (() => { const t = tokens(iatResp, "41 0F"); return t ? (A(t) - 40) : null; })();
        const maf      = (() => { const t = tokens(mafResp, "41 10"); return t ? (((A(t) * 256) + B(t)) / 100) : null; })();
        const map      = (() => { const t = tokens(mapResp, "41 0B"); return t ? A(t) : null; })();
        const baro     = (() => { const t = tokens(baroResp, "41 33"); return t ? A(t) : null; })();
        const stft     = (() => { const t = tokens(stftResp, "41 06"); return t ? ((A(t) - 128) * 100 / 128) : null; })();
        const ltft     = (() => { const t = tokens(ltftResp, "41 07"); return t ? ((A(t) - 128) * 100 / 128) : null; })();

        // ECU/module voltage with fallback to ATRV parsing
        let moduleVoltage = vTok ? decodeCtrlModuleVolt(vTok) : null;
        if (moduleVoltage == null && battery) {
          const parsed = parseFloat(battery);
          if (!Number.isNaN(parsed)) moduleVoltage = parsed;
        }
        let adapterId = null;
        try {
          const idLines = await sendCmd(sock, "ATI");
          adapterId = (idLines.find(l => l && l !== ">" && !/OK/i.test(l)) || idLines[0] || "ELM327").trim();
        } catch {}

        // Fuel rate L/h with MAF fallback if 015E unsupported
        let fuelRateLph = frTok ? decodeFuelRateLph(frTok) : null;
        if (fuelRateLph == null && maf != null) {
          const AFR = 14.7;                  // gasoline stoich
          const fuelDensityKgPerL = 0.745;   // approx
          const fuel_g_per_s = maf / AFR;
          const fuel_kg_per_s = fuel_g_per_s / 1000;
          const L_per_s = fuel_kg_per_s / fuelDensityKgPerL;
          fuelRateLph = +(L_per_s * 3600).toFixed(2);
        }

        // O2 narrowband (voltage) or wideband (lambda) fallback
        let o2b1s1V = o2TokN ? decodeO2Volt(o2TokN) : null;
        let o2b1s1Lambda = null;
        if (o2b1s1V == null && o2TokW) {
          // Wideband A/F equivalence ratio = ((A*256)+B)/32768
          o2b1s1Lambda = +(((A(o2TokW) * 256) + B(o2TokW)) / 32768).toFixed(3);
        }

        // DTC groups
        const dtcs       = parseDTCFrom(dtcCurrentResp,   "43");
        const dtcPending = parseDTCFrom(dtcPendingResp,   "47");
        const dtcPerm    = parseDTCFrom(dtcPermanentResp, "4A");

        // MIL + readiness (basic parse + ignition + raw bytes)
        let monitors = { milOn: false, dtcCount: 0 };
        const monTok = tokens(monResp, "41 01");
        if (monTok) {
          const abyte = A(monTok);
          monitors.milOn    = (abyte & 0x80) !== 0;
          monitors.dtcCount =  abyte & 0x7F;
          const b = B(monTok);
          monitors.ignition = (b & 0x08) ? "Compression" : "Spark";
          monitors.bytes    = monTok.slice(2).map(hexByteToInt); // raw C..E
        }

        // classify
        const status = classify({ rpm: rpm ?? 0, speed: speed ?? 0, coolant: coolant ?? 0, dtcs, connected: true });

        // broadcast
        wsBroadcast({
          type: "telemetry",
          ts: Date.now(),
          data: {
            battery, rpm, speed, coolant,
            load, throttle, fuel, iat, maf, map, baro, stft, ltft,
            fuelSystem, runtimeSec, distSinceMIL_km, ambient, oilTemp, fuelRateLph, moduleVoltage,
            o2b1s1V, o2b1s1Lambda,    adapter: adapterId,

            dtcs, pending: dtcPending, permanent: dtcPerm,
            monitors, status
          }
        });

        await sleep(POLL_INTERVAL_MS);
      }
    } catch (e) {
      if (DEBUG) console.log("Loop error:", e.message || e);
    } finally {
      sock.destroy();
      wsBroadcast({ type: "link", status: "down", message: "reconnecting…" });
      await sleep(1000);
    }
  }
})();
app.post("/auth/register", (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok:false, error:"email & password required" });
  }
  // just echo — real app should save to DB
  res.json({
    ok: true,
    user: { id: 1, name: name || "User", email, role: role || "client" },
    token: "dev-token"
  });
});

/* ───────────── Start servers ───────────── */
httpServer.listen(HTTP_PORT, HTTP_HOST, () => {
  console.log(`CarVision web server on http://${HTTP_HOST}:${HTTP_PORT}`);
  console.log(`Bridging to ELM327 at tcp://${ELM_HOST}:${ELM_PORT}`);
});
