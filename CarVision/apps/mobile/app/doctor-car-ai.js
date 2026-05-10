// apps/mobile/app/doctor-car-ai.js — DoctorCar Agent AI — premium cockpit UI
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MotiView } from "moti";

import AppBackground from "../components/layout/AppBackground";
import { useLanguage } from "../context/LanguageContext";
import { subscribeDoctorCarTelemetry, getDoctorCarTelemetryState } from "../ai/services/telemetryHub";
import { runDoctorCarAgent } from "../ai/doctorCarAgent";
import { doctorCarStyles as styles, DC } from "../styles/doctorCarStyles";
import { DRIVE_ADVICE } from "../ai/services/recommendationService";
import { normalizeTelemetrySnapshot } from "../ai/utils/normalizeTelemetry.js";
import { extractFeatureVector } from "../ai/datasets/featureExtractor.js";
import {
  hydrateLabeledDatasetFromDisk,
  appendLabeledSample,
  clearLabeledDataset,
  countLabels,
} from "../ai/learning/labeledDataset.js";
import { buildSupervisedExportPayload } from "../ai/training/exportDataset.js";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

function fmt(v, suffix = "") {
  if (v == null || Number.isNaN(v)) return "—";
  if (typeof v === "number") return `${Math.round(v * 10) / 10}${suffix}`;
  return `${v}${suffix}`;
}

function findingLabel(id, t) {
  const key = `doctorCar.finding.${id}`;
  const s = t(key);
  return s === key ? id.replace(/_/g, " ") : s;
}

function maintLabel(id, t) {
  const key = `doctorCar.maintenance.${id}`;
  const s = t(key);
  return s === key ? id.replace(/_/g, " ") : s;
}

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={17} color={DC.cyan} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

const VITAL_ICONS = {
  coolant: "thermometer-outline",
  rpm: "speedometer-outline",
  battery: "flash-outline",
  stft: "git-branch-outline",
  ltft: "git-merge-outline",
  map: "analytics-outline",
};

function bandPillColors(band) {
  switch (band) {
    case "excellent":
      return { border: "rgba(52,211,153,0.45)", bg: "rgba(52,211,153,0.1)", text: DC.green };
    case "good":
      return { border: "rgba(56,189,248,0.45)", bg: "rgba(56,189,248,0.1)", text: DC.cyan };
    case "warning":
      return { border: "rgba(251,191,36,0.5)", bg: "rgba(251,191,36,0.12)", text: DC.amber };
    default:
      return { border: "rgba(248,113,113,0.55)", bg: "rgba(248,113,113,0.14)", text: DC.red };
  }
}

function dtcAccentColors(sev) {
  switch (String(sev || "").toLowerCase()) {
    case "critical":
      return ["rgba(239,68,68,0.95)", "rgba(248,113,113,0.48)"];
    case "high":
      return ["rgba(249,115,22,0.92)", "rgba(251,146,60,0.42)"];
    case "medium":
      return ["rgba(250,204,21,0.88)", "rgba(253,224,71,0.38)"];
    case "low":
      return ["rgba(52,211,153,0.82)", "rgba(56,189,248,0.45)"];
    default:
      return ["rgba(167,139,250,0.85)", "rgba(56,189,248,0.45)"];
  }
}

function formatSeverityLabel(sev) {
  const s = String(sev || "unknown");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function DoctorCarAIScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [feed, setFeed] = useState(() => getDoctorCarTelemetryState());

  useEffect(() => subscribeDoctorCarTelemetry(setFeed), []);

  const [learnRev, setLearnRev] = useState(0);
  const [learnStats, setLearnStats] = useState({ n0: 0, n1: 0, total: 0 });

  useEffect(() => {
    hydrateLabeledDatasetFromDisk().then(() => {
      setLearnStats(countLabels());
      setLearnRev((x) => x + 1);
    });
  }, []);

  const refreshLearnStats = useCallback(() => {
    setLearnStats(countLabels());
  }, []);

  const analysis = useMemo(
    () =>
      runDoctorCarAgent({
        snapshot: feed.snapshot,
        history: feed.history,
      }),
    [feed, learnRev]
  );

  const bandKey = `doctorCar.band.${analysis.health.band}`;
  const bandLabel = t(bandKey);
  const summaryText = t(`doctorCar.summary.${analysis.summaryBand}`);
  const pillTheme = bandPillColors(analysis.health.band);

  const bandColors =
    analysis.health.band === "excellent"
      ? ["rgba(52,211,153,0.55)", "rgba(34,211,238,0.25)", "rgba(99,102,241,0.2)"]
      : analysis.health.band === "good"
        ? ["rgba(56,189,248,0.5)", "rgba(99,102,241,0.35)", "rgba(167,139,250,0.15)"]
        : analysis.health.band === "warning"
          ? ["rgba(251,191,36,0.55)", "rgba(251,146,60,0.25)", "rgba(248,113,113,0.08)"]
          : ["rgba(248,113,113,0.55)", "rgba(239,68,68,0.35)", "rgba(127,29,29,0.2)"];

  const snap = analysis.snapshot;
  const hasTelemetry = feed.snapshot != null && feed.updatedAt != null;
  const lastUpdated =
    feed.updatedAt != null
      ? new Date(feed.updatedAt).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: Platform.OS === "ios" ? undefined : "2-digit",
        })
      : null;

  const rec = analysis.recommendations;
  const riskKey = `doctorCar.risk.${rec?.riskLevel ?? "low"}`;
  const driveKey =
    rec?.driveAdvice === DRIVE_ADVICE.STOP
      ? "doctorCar.drive.stop"
      : rec?.driveAdvice === DRIVE_ADVICE.CAUTION
        ? "doctorCar.drive.caution"
        : "doctorCar.drive.continue";

  const captureCurrentFeatures = useCallback(() => {
    const st = getDoctorCarTelemetryState();
    if (!st.snapshot) return null;
    const sn = normalizeTelemetrySnapshot(st.snapshot);
    const tail = (st.history || []).map((h) => ({ snapshot: h.snapshot }));
    return extractFeatureVector(sn, tail);
  }, []);

  const onLabelHealthy = useCallback(async () => {
    const f = captureCurrentFeatures();
    if (!f) {
      Alert.alert("", t("doctorCar.noLiveData"));
      return;
    }
    await appendLabeledSample({ label: 0, features: f, source: "user_tap" });
    refreshLearnStats();
    setLearnRev((x) => x + 1);
  }, [captureCurrentFeatures, refreshLearnStats, t]);

  const onLabelFault = useCallback(async () => {
    const f = captureCurrentFeatures();
    if (!f) {
      Alert.alert("", t("doctorCar.noLiveData"));
      return;
    }
    await appendLabeledSample({ label: 1, features: f, source: "user_tap" });
    refreshLearnStats();
    setLearnRev((x) => x + 1);
  }, [captureCurrentFeatures, refreshLearnStats, t]);

  const onExportLearning = useCallback(async () => {
    try {
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) throw new Error("no_fs");
      const uri = `${dir}doctorcar_training_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(buildSupervisedExportPayload(), null, 2));
      const avail = await Sharing.isAvailableAsync();
      if (avail) await Sharing.shareAsync(uri);
      else Alert.alert("Export", uri);
    } catch {
      Alert.alert("Export", "Could not write or share file.");
    }
  }, []);

  const onClearLearning = useCallback(() => {
    Alert.alert(t("doctorCar.learningClear"), "", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.ok"),
        style: "destructive",
        onPress: async () => {
          await clearLabeledDataset();
          refreshLearnStats();
          setLearnRev((x) => x + 1);
        },
      },
    ]);
  }, [refreshLearnStats, t]);

  const mlPct =
    analysis.mlAugmentation?.blendedFaultRisk != null
      ? Math.round(analysis.mlAugmentation.blendedFaultRisk * 100)
      : null;

  return (
    <AppBackground scrollable={false}>
      <LinearGradient
        colors={["rgba(56,189,248,0.12)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.topbarGlow, { paddingTop: insets.top }]}
        pointerEvents="none"
      />

      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color="#E5E7EB" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.brandBadge}>
            <Ionicons name="pulse" size={14} color={DC.cyan} />
            <Text style={styles.brandBadgeText}>{t("doctorCar.eyebrow")}</Text>
          </View>
          <Text style={styles.titleXL}>{t("doctorCar.title")}</Text>
          <Text style={styles.subtitleSm}>{t("doctorCar.subtitle")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <MotiView from={{ opacity: 0.88, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "timing", duration: 520 }}>
          <View style={styles.heroWrap}>
            <LinearGradient colors={bandColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradientBg}>
              <View style={styles.heroInnerDark}>
                <View style={styles.heroRow}>
                  <LinearGradient colors={bandColors} style={styles.scoreRingOuter}>
                    <View style={styles.scoreRingInner}>
                      <Text style={styles.scoreHuge}>{analysis.health.score}</Text>
                      <Text style={styles.scoreOutOf}>/ 100</Text>
                      <Text style={styles.scoreLabel}>{t("doctorCar.healthScore")}</Text>
                    </View>
                  </LinearGradient>
                  <View style={styles.heroMetaCol}>
                    <View style={[styles.bandPill, { borderColor: pillTheme.border, backgroundColor: pillTheme.bg }]}>
                      <Text style={[styles.bandText, { color: pillTheme.text }]}>
                        {bandLabel !== bandKey ? bandLabel : analysis.health.band}
                      </Text>
                    </View>
                    <View style={styles.liveRow}>
                      {hasTelemetry ? (
                        <MotiView
                          from={{ opacity: 0.45 }}
                          animate={{ opacity: 1 }}
                          transition={{ loop: true, type: "timing", duration: 1100 }}
                          style={[styles.liveDot]}
                        />
                      ) : (
                        <View style={[styles.liveDot, styles.liveDotIdle]} />
                      )}
                      <Text style={styles.liveCaption} numberOfLines={2}>
                        {hasTelemetry ? t("doctorCar.systemLive") : t("doctorCar.systemIdle")}
                      </Text>
                    </View>
                    {lastUpdated ? <Text style={styles.updatedStamp}>{lastUpdated}</Text> : null}
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        </MotiView>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>{summaryText}</Text>
          <Text style={styles.disclaimer}>{t("doctorCar.disclaimerShort")}</Text>
        </View>

        <View style={styles.clusterRow}>
          <View style={styles.clusterTile}>
            <Text style={styles.clusterTileLabel}>{t("doctorCar.riskCaption")}</Text>
            <Text style={styles.clusterTileValue} numberOfLines={3}>
              {t(riskKey)}
            </Text>
          </View>
          <View style={styles.clusterTile}>
            <Text style={styles.clusterTileLabel}>{t("doctorCar.guidanceCaption")}</Text>
            <Text style={styles.clusterTileValue} numberOfLines={4}>
              {t(driveKey)}
            </Text>
          </View>
        </View>

        {!hasTelemetry ? (
          <View style={styles.emptyHint}>
            <Ionicons name="radio-outline" size={36} color={DC.sub} style={{ alignSelf: "center", marginBottom: 10 }} />
            <Text style={styles.emptyText}>{t("doctorCar.noLiveData")}</Text>
            <TouchableOpacity style={styles.linkBtn} onPress={() => router.push("/cardata")}>
              <Text style={styles.linkBtnText}>{t("doctorCar.openLiveData")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <SectionHeader icon="sparkles-outline" title={t("doctorCar.sectionLiveAnalysis")} />
        <View style={styles.analysisCard}>
          {analysis.analysisLineKeys.map((k) => (
            <Text key={k} style={styles.analysisLine}>
              {t(`doctorCar.analysisLine.${k}`)}
            </Text>
          ))}
        </View>

        <SectionHeader icon="shield-checkmark-outline" title={t("doctorCar.sectionRecommendations")} />
        <View style={styles.insightCard}>
          <Text style={styles.recPrimaryTag}>{t("doctorCar.primaryAction")}</Text>
          <Text style={styles.recPrimary}>{t(`doctorCar.${rec?.primaryActionKey ?? "action.continue_monitor"}`)}</Text>
          {(rec?.secondaryActionKeys?.length ?? 0) > 0 ? (
            <>
              <Text style={[styles.recPrimaryTag, { marginTop: 16 }]}>{t("doctorCar.alsoConsider")}</Text>
              {rec.secondaryActionKeys.map((key) => (
                <Text key={key} style={styles.recSecondary}>
                  • {t(`doctorCar.${key}`)}
                </Text>
              ))}
            </>
          ) : null}
        </View>

        {mlPct != null ? (
          <>
            <SectionHeader icon="analytics-outline" title={t("doctorCar.mlEstimateTitle")} />
            <View style={[styles.insightCard, { borderLeftColor: "rgba(167,139,250,0.55)" }]}>
              <Text style={styles.insightLabel}>
                {t("doctorCar.mlEstimateBody", {
                  pct: String(mlPct),
                })}
              </Text>
            </View>
          </>
        ) : null}

        <SectionHeader icon="construct-outline" title={t("doctorCar.sectionMaintenance")} />
        <View style={styles.chipRow}>
          {analysis.maintenance.outlookItems.length === 0 ? (
            <Text style={{ color: DC.sub, marginLeft: 4 }}>{t("doctorCar.predictiveIdle")}</Text>
          ) : (
            analysis.maintenance.outlookItems.map((m) => (
              <View key={m.id} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={4}>
                  {maintLabel(m.id, t)}
                </Text>
              </View>
            ))
          )}
        </View>

        <SectionHeader icon="speedometer-outline" title={t("doctorCar.sectionVitals")} />
        <View style={styles.vitalsGrid}>
          {[
            ["coolant", t("doctorCar.vitals.coolant"), fmt(snap.coolant, " °C")],
            ["rpm", t("doctorCar.vitals.rpm"), snap.rpm != null && Number.isFinite(snap.rpm) ? String(Math.round(snap.rpm)) : "—"],
            ["battery", t("doctorCar.vitals.battery"), fmt(snap.battery, " V")],
            ["stft", t("doctorCar.vitals.stft"), fmt(snap.stft, " %")],
            ["ltft", t("doctorCar.vitals.ltft"), fmt(snap.ltft, " %")],
            ["map", t("doctorCar.vitals.map"), fmt(snap.map, " kPa")],
          ].map(([key, label, val]) => (
            <View key={key} style={styles.vitalTile}>
              <View style={styles.vitalTileHead}>
                <Ionicons name={VITAL_ICONS[key]} size={18} color={DC.cyanDim} />
                <Text style={styles.vitalLabel}>{label}</Text>
              </View>
              <Text style={styles.vitalValue}>{val}</Text>
            </View>
          ))}
        </View>

        <SectionHeader icon="alert-circle-outline" title={t("doctorCar.sectionWarnings")} />
        <View style={styles.chipRow}>
          {analysis.ruleFindings.length === 0 ? (
            <Text style={{ color: DC.sub, marginLeft: 4 }}>{t("doctorCar.noneDetected")}</Text>
          ) : (
            analysis.ruleFindings.map((f) => (
              <View key={f.id} style={[styles.chip, f.severity === "critical" && styles.chipCrit]}>
                <Text style={[styles.chipText, f.severity === "critical" && styles.chipTextCrit]} numberOfLines={4}>
                  {findingLabel(f.id, t)}
                </Text>
              </View>
            ))
          )}
        </View>

        <SectionHeader icon="radar-outline" title={t("doctorCar.sectionAnomalies")} />
        <View style={styles.chipRow}>
          {analysis.anomalies.length === 0 ? (
            <Text style={{ color: DC.sub, marginLeft: 4 }}>{t("doctorCar.noneDetected")}</Text>
          ) : (
            analysis.anomalies.map((f) => (
              <View key={f.id} style={[styles.chip, f.severity === "critical" && styles.chipCrit]}>
                <Text style={[styles.chipText, f.severity === "critical" && styles.chipTextCrit]} numberOfLines={4}>
                  {findingLabel(f.id, t)}
                </Text>
              </View>
            ))
          )}
        </View>

        <SectionHeader icon="trending-up-outline" title={t("doctorCar.sectionPredictive")} />
        <View style={styles.chipRow}>
          {analysis.predictive.length === 0 ? (
            <Text style={{ color: DC.sub, marginLeft: 4 }}>{t("doctorCar.predictiveIdle")}</Text>
          ) : (
            analysis.predictive.map((p) => (
              <View key={p.id} style={[styles.chip, p.severity === "warning" && styles.chipCrit]}>
                <Text style={[styles.chipText, p.severity === "warning" && styles.chipTextCrit]} numberOfLines={4}>
                  {findingLabel(p.id, t)}
                </Text>
              </View>
            ))
          )}
        </View>

        <SectionHeader icon="document-text-outline" title={t("doctorCar.sectionDtc")} />
        {analysis.dtcInsights.length === 0 ? (
          <Text style={[styles.emptyText, { marginHorizontal: 18, marginBottom: 14 }]}>{t("doctorCar.noDtcs")}</Text>
        ) : (
          analysis.dtcInsights.map((d) => (
            <View key={d.code} style={styles.dtcCard}>
              <LinearGradient
                colors={dtcAccentColors(d.severity)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dtcCardAccent}
              />
              <View style={styles.dtcCardBody}>
                <Text style={styles.dtcCode}>{d.code}</Text>
                <Text style={styles.dtcSev}>
                  {formatSeverityLabel(d.severity)}
                  {d.urgency ? ` · ${t(`doctorCar.dtcUrgency.${d.urgency}`)}` : ""}
                  {d.category ? ` · ${d.category}` : ""}
                </Text>
                {d.aiSummary ? (
                  <View style={styles.dtcAiBanner}>
                    <Text style={styles.dtcAiLabel}>{t("doctorCar.dtcAiSummary")}</Text>
                    <Text style={styles.dtcAiText}>{d.aiSummary}</Text>
                  </View>
                ) : null}
                <Text style={styles.dtcBody}>{d.explanation}</Text>
                {d.canDrive ? (
                  <Text style={styles.dtcCanDriveLine}>
                    <Text style={styles.dtcInlineStrong}>{t("doctorCar.dtcCanDrive")}: </Text>
                    {d.canDrive}
                  </Text>
                ) : null}
                {d.symptoms?.length ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.dtcSubLabel}>{t("doctorCar.dtcSymptoms")}</Text>
                    {d.symptoms.slice(0, 5).map((s, i) => (
                      <Text key={i} style={styles.dtcBullet}>
                        • {s}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {(d.possibleCauses?.length || d.causes?.length) ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.dtcSubLabel}>{t("doctorCar.dtcCauses")}</Text>
                    {(d.possibleCauses || d.causes || []).slice(0, 6).map((s, i) => (
                      <Text key={i} style={styles.dtcBullet}>
                        • {s}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {d.recommendedAction ? (
                  <Text style={styles.dtcRecAction}>
                    <Text style={styles.dtcInlineStrong}>{t("doctorCar.dtcRepairPlan")}: </Text>
                    {d.recommendedAction}
                    {d.estimatedRepairCost ? ` (${d.estimatedRepairCost})` : ""}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}

        {__DEV__ ? (
          <View style={[styles.insightCard, { marginTop: 8, borderLeftColor: "rgba(251,191,36,0.45)" }]}>
            <Text style={styles.recPrimaryTag}>{t("doctorCar.learningDevTitle")}</Text>
            <Text style={[styles.recSecondary, { marginBottom: 10 }]}>
              {t("doctorCar.learningCounts", {
                total: String(learnStats.total),
                n0: String(learnStats.n0),
                n1: String(learnStats.n1),
              })}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <TouchableOpacity style={styles.linkBtn} onPress={onLabelHealthy}>
                <Text style={styles.linkBtnText}>{t("doctorCar.learningTapHealthy")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={onLabelFault}>
                <Text style={styles.linkBtnText}>{t("doctorCar.learningTapFault")}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.linkBtn, { marginTop: 10, alignSelf: "flex-start" }]} onPress={onExportLearning}>
              <Text style={styles.linkBtnText}>{t("doctorCar.learningExport")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkBtn, { marginTop: 8, alignSelf: "flex-start" }]} onPress={onClearLearning}>
              <Text style={styles.linkBtnText}>{t("doctorCar.learningClear")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.footNote}>{analysis.fleetDisclaimer}</Text>
      </ScrollView>
    </AppBackground>
  );
}
