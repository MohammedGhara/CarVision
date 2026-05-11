/**
 * DoctorCar Vision AI — orchestration: OpenAI vision (server) when possible, else local mock.
 * API key never leaves the backend (see apps/server/src/routes/visionScan.js).
 */

import { mockClassifyVisual, scoreToConfidence01 } from "./mockVisionClassifier.js";
import { getDoctorCarVisionContextLine } from "./doctorCarVisionBridge.js";
import { buildVisionNarrative } from "../prompts/visionNarrative.js";
import { buildMockVisionFeatureVector } from "../utils/featureVector.js";
import { predictWithRegisteredVisionModels } from "../models/modelRegistry.js";
import { analyzeVisionRemote } from "./openaiVisionClient.js";

function newScanId() {
  return `vs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function genericInconclusive() {
  return {
    detectedPartName: "Unclassified component / scene",
    possibleIssue: "No strong match to the local vision pattern library for this image cue set.",
    causes: [
      "Image may be unclear, too dark, or framed too wide",
      "Symptom not represented in the offline knowledge pack yet",
    ],
    recommendations: [
      "Re-scan with closer framing and steady lighting",
      "Add a short text hint (e.g. “coolant under radiator”) to improve mock matching",
      "Use CarVision Diagnostics + Live Data for codes and parameters",
    ],
    urgency: /** @type {'low'} */ ("low"),
    continueDriving: /** @type {'caution'} */ ("caution"),
    continueDrivingRationale:
      "Without a confident visual classification, assume caution until a technician confirms the vehicle is sound.",
    suggestedRepairActions: ["Book inspection if any warning lamp, fluid loss, noise, or temperature anomaly is present"],
    repairCostCategory: "$$",
    maintenanceTips: ["Keep a dated photo log for your shop — speeds diagnosis"],
    category: "unknown",
    matchSource: "generic",
  };
}

/** @param {'yes'|'no'|'caution'} d */
function buildDriveRationale(d, category) {
  if (d === "no") return "Safety-first: the offline risk model flags this pattern as incompatible with normal driving until repaired.";
  if (d === "caution")
    return `Caution: ${category} issues can escalate quickly — monitor gauges, smells, and pedal/steering feel; head to service if anything worsens.`;
  return "No immediate stop-driving flag from this offline assessment — still perform a walk-around before long trips.";
}

function clampUrgencyClient(u) {
  const x = String(u || "medium").toLowerCase();
  return x === "critical" || x === "high" || x === "medium" || x === "low" ? x : "medium";
}

function clampDriveClient(d) {
  const x = String(d || "caution").toLowerCase();
  return x === "yes" || x === "no" || x === "caution" ? x : "caution";
}

/**
 * @param {object} remote — fields from server OpenAI normalizer
 * @param {string|null} dcLine
 * @param {string|null} userHint
 */
function finalizeOpenAiResult(remote, dcLine, userHint) {
  const confidence = Math.max(0, Math.min(100, Math.round(Number(remote.confidence) || 0)));
  const featureVector = buildMockVisionFeatureVector({
    matchedKnowledgeId: "openai",
    confidence01: confidence / 100,
    matchedKeywords: ["openai_vision"],
  });

  /** @type {import('../models/scanTypes.js').VisionScanResult} */
  const result = {
    id: newScanId(),
    timestamp: Date.now(),
    detectedPartName: remote.detectedPartName,
    possibleIssue: remote.possibleIssue,
    causes: Array.isArray(remote.causes) ? [...remote.causes] : [],
    recommendations: Array.isArray(remote.recommendations) ? [...remote.recommendations] : [],
    urgency: clampUrgencyClient(remote.urgency),
    continueDriving: clampDriveClient(remote.continueDriving),
    continueDrivingRationale: remote.continueDrivingRationale,
    suggestedRepairActions: Array.isArray(remote.suggestedRepairActions) ? [...remote.suggestedRepairActions] : [],
    repairCostCategory: remote.repairCostCategory || "$$",
    maintenanceTips: Array.isArray(remote.maintenanceTips) ? [...remote.maintenanceTips] : [],
    category: remote.category || "general",
    matchSource: "openai",
    confidence,
    featureVector,
    narrative: remote.narrative || "",
    doctorCarContextLine: dcLine,
  };
  if (!result.narrative) {
    result.narrative = buildVisionNarrative(result, { userHint });
  }
  return result;
}

/**
 * @param {{ imageUri: string, fileName?: string|null, userHint?: string|null, demoKnowledgeId?: string|null, useLocalMockOnly?: boolean }} input
 * @param {string|null} dcLine
 */
async function runLocalMockVisionAgent(input, dcLine) {
  const uri = input.imageUri || "";
  const fileName = input.fileName || null;
  const userHint = input.userHint || null;

  let classified = mockClassifyVisual({ uri, fileName, userHint });

  if (input.demoKnowledgeId) {
    const { CAR_PART_KNOWLEDGE } = await import("../data/carPartKnowledge.js");
    const forced = CAR_PART_KNOWLEDGE.find((e) => e.id === input.demoKnowledgeId);
    if (forced) {
      classified = { entry: forced, score: 8, hits: ["demo"] };
    }
  }

  if (!classified.entry) {
    const g = genericInconclusive();
    const confidence = 28;
    const featureVector = buildMockVisionFeatureVector({
      matchedKnowledgeId: "none",
      confidence01: confidence / 100,
      matchedKeywords: [],
    });
    /** @type {import('../models/scanTypes.js').VisionScanResult} */
    const result = {
      id: newScanId(),
      timestamp: Date.now(),
      ...g,
      confidence,
      featureVector,
      narrative: "",
      doctorCarContextLine: dcLine,
    };
    result.narrative = buildVisionNarrative(result, { userHint });
    return result;
  }

  const entry = classified.entry;
  const conf01 = scoreToConfidence01(classified.score);
  let confidence = Math.round(conf01 * 100);
  confidence = Math.max(24, Math.min(97, confidence + (classified.hits.length % 3) - 1));

  const urgency =
    entry.severity === "critical"
      ? "critical"
      : entry.severity === "high"
        ? "high"
        : entry.severity === "medium"
          ? "medium"
          : "low";

  const featureVector = buildMockVisionFeatureVector({
    matchedKnowledgeId: entry.id,
    confidence01: confidence / 100,
    matchedKeywords: classified.hits,
  });

  /** @type {import('../models/scanTypes.js').VisionScanResult} */
  const result = {
    id: newScanId(),
    timestamp: Date.now(),
    detectedPartName: entry.title,
    possibleIssue: entry.description,
    causes: [...entry.causes],
    recommendations: [...entry.solutions],
    urgency,
    continueDriving: entry.driveAdvice,
    continueDrivingRationale: buildDriveRationale(entry.driveAdvice, entry.category),
    suggestedRepairActions: [...entry.solutions],
    repairCostCategory: entry.repairCostCategory,
    maintenanceTips: [...entry.maintenanceAdvice],
    category: entry.category,
    matchSource: classified.hits.includes("demo") ? "demo_seed" : "knowledge_base",
    confidence,
    featureVector,
    narrative: "",
    doctorCarContextLine: dcLine,
  };
  result.narrative = buildVisionNarrative(result, { userHint });
  return result;
}

/**
 * @param {{ imageUri: string, fileName?: string|null, userHint?: string|null, demoKnowledgeId?: string|null, useLocalMockOnly?: boolean }} input
 * @returns {Promise<import('../models/scanTypes.js').VisionScanResult>}
 */
export async function runVisionAgent(input) {
  await predictWithRegisteredVisionModels({ uri: input.imageUri, hint: input.userHint || undefined });

  const dcLine = getDoctorCarVisionContextLine();

  /** Examiner / offline demos — skip cloud */
  if (input.demoKnowledgeId) {
    return runLocalMockVisionAgent(input, dcLine);
  }

  if (input.useLocalMockOnly) {
    return runLocalMockVisionAgent(input, dcLine);
  }

  const uri = input.imageUri || "";
  const canRemote = uri && !String(uri).startsWith("demo://");

  if (canRemote) {
    try {
      const remote = await analyzeVisionRemote({
        imageUri: uri,
        hint: input.userHint || "",
        doctorContext: dcLine || "",
      });
      return finalizeOpenAiResult(remote, dcLine, input.userHint || null);
    } catch {
      // fall through to local triage so the screen never dead-ends offline
    }
  }

  return runLocalMockVisionAgent(input, dcLine);
}
