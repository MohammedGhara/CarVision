/**
 * DoctorCar Agent — orchestrates:
 * - rule engine (decision tree)
 * - temporal anomaly detector
 * - predictive + maintenance outlook
 * - health scoring
 * - DTC knowledge
 * - recommendation plan
 *
 * Future: optional models/modelRegistry.predictWithRegisteredModel() to blend ML scores.
 */

import { normalizeTelemetrySnapshot } from "./utils/normalizeTelemetry.js";
import { evaluateDecisionTree } from "./aiDecisionTree.js";
import { computeHealthScore } from "./healthScore.js";
import { runPredictiveEngine } from "./predictiveEngine.js";
import { runAnomalyDetector } from "./anomalyDetector.js";
import { runMaintenancePredictor } from "./maintenancePredictor.js";
import { explainAllDtcs } from "./dtcKnowledge.js";
import { buildFleetIntro, pickAnalysisLineKeys } from "./prompts/narrativePrompts.js";
import { extractFeatureVector } from "./datasets/featureExtractor.js";
import { runMlAugmentationSync } from "./services/mlInferenceBridge.js";
import { buildRecommendationPlan } from "./services/recommendationService.js";

const ORDER = { critical: 0, warning: 1, info: 2 };

function uniqCodes(snap) {
  const s = new Set([...(snap.dtcs || []), ...(snap.pending || []), ...(snap.permanent || [])]);
  return [...s];
}

function sortFindings(arr) {
  return [...arr].sort((a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9));
}

/**
 * @param {{ snapshot: object|null, history?: { t:number, snapshot:object }[] }} input
 */
export function runDoctorCarAgent(input) {
  const snap = normalizeTelemetrySnapshot(input?.snapshot || {});
  const history = Array.isArray(input?.history) ? input.history : [];

  const ruleFindings = evaluateDecisionTree(snap);
  const anomalies = runAnomalyDetector(history, snap);
  const predictive = runPredictiveEngine(history);

  const mergedForScore = sortFindings([...ruleFindings, ...anomalies]);

  const health = computeHealthScore(mergedForScore, predictive);

  const maintenance = runMaintenancePredictor(history, {
    anomalies,
    findings: ruleFindings,
    predictive,
  });

  const codes = uniqCodes(snap);
  const dtcInsights = explainAllDtcs(codes);

  const tail = history.map((h) => ({ snapshot: h.snapshot }));
  const features = extractFeatureVector(snap, tail);
  const mlAugmentation = runMlAugmentationSync(features);

  const recommendations = buildRecommendationPlan({
    health,
    ruleFindings,
    anomalies,
    predictive,
  });

  const analysisLineKeys = pickAnalysisLineKeys({
    ruleFindings,
    anomalies,
    predictive,
    codes,
    mlBlendedRisk: mlAugmentation.blendedFaultRisk,
  });

  const criticalRule = ruleFindings.filter((f) => f.severity === "critical");
  const warnRule = ruleFindings.filter((f) => f.severity === "warning");
  const topFindingId =
    criticalRule[0]?.id || warnRule[0]?.id || anomalies[0]?.id || ruleFindings[0]?.id || null;

  const summaryBand = health.band;

  const risks = [
    ...criticalRule.map((f) => f.id),
    ...anomalies.filter((a) => a.severity !== "info").map((a) => a.id),
    ...predictive.filter((p) => p.severity !== "info").map((p) => p.id),
  ];

  return {
    snapshot: snap,
    ruleFindings,
    anomalies,
    findings: mergedForScore,
    predictive,
    maintenance,
    health,
    dtcInsights,
    codes,
    summaryBand,
    fleetDisclaimer: buildFleetIntro(),
    statusLabel: health.band,
    topFindingId,
    risks,
    recommendations,
    analysisLineKeys,
    mlAugmentation,
    milOn: !!snap.monitors?.milOn,
    updatedHint: history.length ? new Date(history[history.length - 1].t).toISOString() : null,
  };
}
