// apps/mobile/ai/visionAI/screens/VisionAIScreen.jsx — DoctorCar Vision AI (image triage + garage workflow)
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
} from "react-native";
import { LocalizedText as Text } from "../../../components/ui/LocalizedText";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MotiView } from "moti";

import AppBackground from "../../../components/layout/AppBackground";
import { useLanguage } from "../../../context/LanguageContext.js";
import { useAuth } from "../../../context/AuthContext.js";
import { doctorCarStyles as dcStyles, DC } from "../../../styles/doctorCarStyles.js";

import { useVisionScan } from "../hooks/useVisionScan.js";
import ScanBeamOverlay from "../components/ScanBeamOverlay.jsx";
import CanIDriveSection from "../components/CanIDriveSection.jsx";
import VisionResultPanel from "../components/VisionResultPanel.jsx";
import CameraCaptureModal from "../components/CameraCaptureModal.jsx";
import { DEMO_VISION_SAMPLES } from "../demo/demoVisionSamples.js";
import { listGarageVisionScans, saveGarageVisionScan, updateGarageVisionScan } from "../services/visionGarageStore.js";
import { shareVisionReportJson } from "../services/visionReportExport.js";

const VS = StyleSheet.create({
  previewWrap: {
    marginTop: 12,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: DC.border,
    backgroundColor: "rgba(2,6,23,0.65)",
    minHeight: 200,
  },
  previewImg: { width: "100%", height: 220, resizeMode: "cover" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.35)",
    backgroundColor: "rgba(34,211,238,0.08)",
  },
  actionLabel: { color: DC.cyan, fontWeight: "800", fontSize: 14 },
  hintInput: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DC.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: DC.text,
    backgroundColor: "rgba(15,23,42,0.75)",
    minHeight: 44,
  },
  analyzeBtn: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    overflow: "hidden",
  },
  garageBar: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
    backgroundColor: "rgba(167,139,250,0.08)",
  },
  notesInput: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DC.border,
    padding: 12,
    color: DC.text,
    minHeight: 72,
    textAlignVertical: "top",
    backgroundColor: "rgba(2,6,23,0.5)",
  },
  historyItem: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DC.border,
    marginBottom: 10,
    backgroundColor: "rgba(15,23,42,0.65)",
  },
});

export default function VisionAIScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isGarage = user?.role === "GARAGE";

  const scan = useVisionScan();
  const [previewH, setPreviewH] = useState(220);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [mechanicNotes, setMechanicNotes] = useState("");
  const [customerTag, setCustomerTag] = useState("");
  const [urgencyOverride, setUrgencyOverride] = useState(/** @type {'low'|'medium'|'high'|'critical'|null} */ (null));

  const loadHistory = useCallback(async () => {
    const rows = await listGarageVisionScans();
    setHistory(rows);
  }, []);

  useEffect(() => {
    if (isGarage && historyOpen) loadHistory();
  }, [isGarage, historyOpen, loadHistory]);

  const onExportJson = async () => {
    if (!scan.result) return;
    try {
      await shareVisionReportJson({
        imageUri: scan.imageUri,
        result: scan.result,
        mechanicNotes,
        exportedBy: user?.email || user?.name || "CarVision",
      });
    } catch (e) {
      Alert.alert(t("visionAI.exportFailTitle"), String(e?.message || e));
    }
  };

  const onSaveGarage = async () => {
    if (!scan.result) return;
    await saveGarageVisionScan({
      imageUri: scan.imageUri,
      result: { ...scan.result, urgencyOverride },
      mechanicNotes,
      urgencyOverride,
      customerTag,
    });
    setMechanicNotes("");
    setCustomerTag("");
    setUrgencyOverride(null);
    Alert.alert(t("visionAI.savedTitle"), t("visionAI.savedBody"));
    loadHistory();
  };

  return (
    <AppBackground>
      <LinearGradient
        colors={["rgba(56,189,248,0.12)", "transparent"]}
        style={[dcStyles.topbarGlow, { height: 140 }]}
        pointerEvents="none"
      />
      <View style={[dcStyles.topbar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={dcStyles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={DC.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={dcStyles.brandBadge}>
            <Text style={dcStyles.brandBadgeText}>{t("visionAI.badge")}</Text>
          </View>
          <Text style={dcStyles.titleXL}>{t("visionAI.title")}</Text>
          <Text style={dcStyles.subtitleSm}>{t("visionAI.subtitle")}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "timing", duration: 420 }}>
          <Text style={{ color: DC.sub, fontSize: 12, lineHeight: 18 }}>{t("visionAI.disclaimer")}</Text>

          <View style={VS.previewWrap} onLayout={(e) => setPreviewH(e.nativeEvent.layout.height)}>
            {scan.imageUri ? (
              <Image source={{ uri: scan.imageUri }} style={VS.previewImg} />
            ) : (
              <View style={[VS.previewImg, { alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name="scan-outline" size={48} color={DC.sub} />
                <Text style={{ color: DC.sub, marginTop: 8 }}>{t("visionAI.noImage")}</Text>
              </View>
            )}
            <ScanBeamOverlay active={scan.phase === "analyzing"} height={previewH} />
          </View>

          <View style={VS.actionsRow}>
            <TouchableOpacity style={VS.actionBtn} onPress={() => setCameraOpen(true)}>
              <Ionicons name="camera" size={20} color={DC.cyan} />
              <Text style={VS.actionLabel}>{t("visionAI.takePhoto")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={VS.actionBtn} onPress={scan.pickLibrary}>
              <Ionicons name="images-outline" size={20} color={DC.cyan} />
              <Text style={VS.actionLabel}>{t("visionAI.upload")}</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={VS.hintInput}
            placeholder={t("visionAI.hintPlaceholder")}
            placeholderTextColor="#64748B"
            value={scan.userHint}
            onChangeText={scan.setUserHint}
          />

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => scan.analyze()}
            disabled={scan.phase === "analyzing"}
            style={VS.analyzeBtn}
          >
            <LinearGradient colors={["#22D3EE", "#6366F1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            {scan.phase === "analyzing" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ActivityIndicator color="#020617" />
                <Text style={{ color: "#020617", fontWeight: "900", fontSize: 16 }}>{t("visionAI.analyzing")}</Text>
              </View>
            ) : (
              <Text style={{ color: "#020617", fontWeight: "900", fontSize: 16 }}>{t("visionAI.runScan")}</Text>
            )}
          </TouchableOpacity>

          {scan.error ? (
            <Text style={{ color: DC.red, marginTop: 10, fontSize: 13 }}>{scan.error}</Text>
          ) : null}

          {isGarage ? (
            <View style={VS.garageBar}>
              <Text style={{ color: DC.violet, fontWeight: "900", letterSpacing: 1 }}>{t("visionAI.garageMode")}</Text>
              <Text style={{ color: DC.sub, fontSize: 12, marginTop: 4 }}>{t("visionAI.garageModeSub")}</Text>
              <TextInput
                style={[VS.notesInput, { marginTop: 10 }]}
                placeholder={t("visionAI.customerTagPh")}
                placeholderTextColor="#64748B"
                value={customerTag}
                onChangeText={setCustomerTag}
              />
              <TextInput
                style={VS.notesInput}
                placeholder={t("visionAI.mechanicNotesPh")}
                placeholderTextColor="#64748B"
                value={mechanicNotes}
                onChangeText={setMechanicNotes}
                multiline
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {["low", "medium", "high", "critical"].map((u) => (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setUrgencyOverride(urgencyOverride === u ? null : /** @type {typeof urgencyOverride} */ (u))}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: urgencyOverride === u ? DC.cyan : DC.border,
                      backgroundColor: urgencyOverride === u ? "rgba(34,211,238,0.15)" : "transparent",
                    }}
                  >
                    <Text style={{ color: DC.text, fontSize: 11, fontWeight: "800" }}>{u.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={[VS.actionBtn, { flex: 1 }]}
                  onPress={onSaveGarage}
                  disabled={!scan.result}
                >
                  <Ionicons name="save-outline" size={18} color={DC.violet} />
                  <Text style={[VS.actionLabel, { color: DC.violet }]}>{t("visionAI.saveScan")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[VS.actionBtn, { flex: 1 }]} onPress={() => setHistoryOpen(true)}>
                  <Ionicons name="time-outline" size={18} color={DC.violet} />
                  <Text style={[VS.actionLabel, { color: DC.violet }]}>{t("visionAI.history")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <Text style={[dcStyles.sectionTitle, { marginTop: 22 }]}>{t("visionAI.demoLab")}</Text>
          <Text style={{ color: DC.sub, fontSize: 12, marginBottom: 8 }}>{t("visionAI.demoLabSub")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {DEMO_VISION_SAMPLES.map((d) => (
              <TouchableOpacity
                key={d.knowledgeId}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(148,163,184,0.25)",
                  backgroundColor: "rgba(15,23,42,0.75)",
                }}
                onPress={() => {
                  scan.analyze({ demoKnowledgeId: d.knowledgeId, userHintOverride: d.hint });
                }}
              >
                <Text style={{ color: DC.text, fontWeight: "800", fontSize: 12 }}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {scan.result ? (
            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: "spring", damping: 18 }}>
              <VisionResultPanel result={scan.result} t={t} />
              <CanIDriveSection advice={scan.result.continueDriving} rationale={scan.result.continueDrivingRationale} t={t} />
              <TouchableOpacity style={[VS.actionBtn, { marginTop: 16 }]} onPress={onExportJson}>
                <Ionicons name="share-outline" size={18} color={DC.cyan} />
                <Text style={VS.actionLabel}>{t("visionAI.exportJson")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[VS.actionBtn, { marginTop: 10, borderColor: DC.border }]} onPress={scan.reset}>
                <Ionicons name="refresh-outline" size={18} color={DC.sub} />
                <Text style={[VS.actionLabel, { color: DC.sub }]}>{t("visionAI.newScan")}</Text>
              </TouchableOpacity>
            </MotiView>
          ) : null}
        </MotiView>
      </ScrollView>

      <CameraCaptureModal visible={cameraOpen} onClose={() => setCameraOpen(false)} onCaptured={scan.setCapturedUri} />

      <Modal visible={historyOpen} animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <View style={{ flex: 1, backgroundColor: DC.bg, paddingTop: insets.top + 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 }}>
            <TouchableOpacity onPress={() => setHistoryOpen(false)} style={dcStyles.backBtn}>
              <Ionicons name="close" size={22} color={DC.text} />
            </TouchableOpacity>
            <Text style={[dcStyles.titleXL, { flex: 1, fontSize: 20, marginLeft: 12 }]}>{t("visionAI.historyTitle")}</Text>
          </View>
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
            ListEmptyComponent={<Text style={{ color: DC.sub, textAlign: "center", marginTop: 40 }}>{t("visionAI.historyEmpty")}</Text>}
            renderItem={({ item }) => (
              <View style={VS.historyItem}>
                <Text style={{ color: DC.cyan, fontSize: 11, fontWeight: "800" }}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
                <Text style={{ color: DC.text, fontWeight: "800", marginTop: 6 }}>
                  {item.result?.detectedPartName || "—"}
                </Text>
                <Text style={{ color: DC.sub, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                  {item.mechanicNotes || t("visionAI.noNotes")}
                </Text>
                <TextInput
                  style={[VS.notesInput, { marginTop: 8, minHeight: 56 }]}
                  placeholder={t("visionAI.editNotesPh")}
                  placeholderTextColor="#64748B"
                  defaultValue={item.mechanicNotes}
                  onEndEditing={(e) => updateGarageVisionScan(item.id, { mechanicNotes: e.nativeEvent.text })}
                />
              </View>
            )}
          />
        </View>
      </Modal>
    </AppBackground>
  );
}
