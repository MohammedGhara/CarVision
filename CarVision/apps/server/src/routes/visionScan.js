/**
 * DoctorCar Vision AI — OpenAI vision proxy (API key stays server-side only).
 * POST /api/vision/scan  multipart: image (file), hint (optional), doctorContext (optional)
 */
"use strict";

const express = require("express");
const multer = require("multer");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const JSON_INSTRUCTION = `You are DoctorCar Vision AI — a professional, safety-first automotive triage assistant.
Analyze the image and any operator hint. You may receive optional live telemetry context (not from the image); use it only if relevant.

Respond with ONE JSON object only (no markdown fences). Use this exact shape and valid JSON:
{
  "detectedPartName": string,
  "possibleIssue": string,
  "confidence": number,
  "causes": string[],
  "recommendations": string[],
  "urgency": "low"|"medium"|"high"|"critical",
  "continueDriving": "yes"|"no"|"caution",
  "continueDrivingRationale": string,
  "suggestedRepairActions": string[],
  "repairCostCategory": "$"|"$$"|"$$$"|"$$$$",
  "maintenanceTips": string[],
  "category": string,
  "narrative": string
}

Rules:
- confidence is 0-100 based on how clear the evidence is in the image.
- If the image is ambiguous, lower confidence and set continueDriving to "caution" unless clearly safe.
- narrative: 2-4 sentences, technical but clear, like a senior diagnostic tech.
- Never claim OEM recall or warranty status.
- Prefer "caution" over "yes" when unsure.`;

function stripJsonFences(text) {
  let s = String(text || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return s.trim();
}

function clampUrgency(u) {
  const x = String(u || "medium").toLowerCase();
  if (x === "critical" || x === "high" || x === "medium" || x === "low") return x;
  return "medium";
}

function clampDrive(d) {
  const x = String(d || "caution").toLowerCase();
  if (x === "yes" || x === "no" || x === "caution") return x;
  return "caution";
}

function ensureStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

function normalizeParsed(parsed) {
  const repair = String(parsed.repairCostCategory || "$$").trim();
  const allowed = ["$", "$$", "$$$", "$$$$"];
  const repairCostCategory = allowed.includes(repair) ? repair : "$$";
  let confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence)) confidence = 55;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  return {
    detectedPartName: String(parsed.detectedPartName || "Unknown component").slice(0, 200),
    possibleIssue: String(parsed.possibleIssue || "See narrative and recommendations.").slice(0, 800),
    confidence,
    causes: ensureStringArray(parsed.causes).slice(0, 12),
    recommendations: ensureStringArray(parsed.recommendations).slice(0, 12),
    urgency: clampUrgency(parsed.urgency),
    continueDriving: clampDrive(parsed.continueDriving),
    continueDrivingRationale: String(
      parsed.continueDrivingRationale || "Verify with a qualified technician before long or high-speed trips.",
    ).slice(0, 600),
    suggestedRepairActions: ensureStringArray(parsed.suggestedRepairActions || parsed.recommendations).slice(0, 12),
    repairCostCategory,
    maintenanceTips: ensureStringArray(parsed.maintenanceTips).slice(0, 10),
    category: String(parsed.category || "general").slice(0, 80),
    narrative: String(parsed.narrative || "").slice(0, 1200),
  };
}

router.post("/scan", upload.single("image"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: "image file required (field name: image)" });
    }

    const KEY = process.env.OPENAI_API_KEY;
    if (!KEY) {
      return res.status(503).json({ ok: false, error: "missing OPENAI_API_KEY on server" });
    }

    const model =
      process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

    const hint = (req.body && String(req.body.hint || "").trim()) || "";
    const doctorContext = (req.body && String(req.body.doctorContext || "").trim()) || "";

    const mime = req.file.mimetype && /^image\//.test(req.file.mimetype) ? req.file.mimetype : "image/jpeg";
    const dataUrl = `data:${mime};base64,${req.file.buffer.toString("base64")}`;

    let userText = JSON_INSTRUCTION + "\n\nOperator hint: " + (hint || "(none)");
    if (doctorContext) {
      userText += "\n\nOptional live telemetry / context from DoctorCar hub:\n" + doctorContext;
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output only valid JSON objects for automotive vision triage." },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
            ],
          },
        ],
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({ ok: false, error: `OpenAI ${r.status}`, detail: detail.slice(0, 500) });
    }

    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return res.status(502).json({ ok: false, error: "empty OpenAI response" });
    }

    let parsed;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch (e) {
      return res.status(502).json({ ok: false, error: "invalid JSON from model", detail: String(e) });
    }

    const result = normalizeParsed(parsed);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

module.exports = router;
