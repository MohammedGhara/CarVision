// apps/mobile/app/safety-emergency.js
import React, { useEffect, useState, useCallback } from "react";
import { View, TouchableOpacity, ScrollView, Switch, StyleSheet, Platform } from "react-native"
import { LocalizedText as Text } from "../components/ui/LocalizedText";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

import AppBackground from "../components/layout/AppBackground";
import EmergencySOSModal from "../components/safety/EmergencySOSModal";
import BatteryHealthCard from "../components/safety/BatteryHealthCard";
import TireAlertCard from "../components/safety/TireAlertCard";
import { useLanguage } from "../context/LanguageContext";
import { useSafetySettings } from "../context/SafetySettingsContext";
import { subscribeTelemetrySlice } from "../lib/liveTelemetryBridge";
import { DEFAULT_EMERGENCY_PRESETS_IL } from "../lib/emergencyConfig";
import { classifyBatteryAlert, getBatteryVoltageVolts } from "../utils/vehicleAlertRules";
import { confirmDialEmergency } from "../utils/emergencyDial";
import { C } from "../styles/theme";

export default function SafetyEmergencyScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { crashDetectionEnabled, setCrashDetectionEnabled, hydrated } = useSafetySettings();

  const [slice, setSlice] = useState(() => ({
    battery: null,
    moduleVoltage: null,
    rpm: null,
    speed: null,
  }));
  const [sosOpen, setSosOpen] = useState(false);

  useEffect(() => {
    return subscribeTelemetrySlice(setSlice);
  }, []);

  const v = getBatteryVoltageVolts(slice);
  const classification = classifyBatteryAlert(slice);
  const engineRunning =
    slice.rpm != null && Number.isFinite(Number(slice.rpm)) && Number(slice.rpm) >= 450;
  const voltageDisplay = v == null ? "—" : `${v.toFixed(2)} V`;

  const onSos = useCallback(() => setSosOpen(true), []);

  return (
    <AppBackground scrollable={false}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t("safetyEmergency.eyebrow")}</Text>
          <Text style={styles.title}>{t("safetyEmergency.screenTitle")}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["rgba(185,28,28,0.35)", "rgba(15,23,42,0.95)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Ionicons name="medkit-outline" size={32} color="#FCA5A5" style={{ marginBottom: 8 }} />
          <Text style={styles.heroTitle}>{t("safetyEmergency.heroTitle")}</Text>
          <Text style={styles.heroSub}>{t("safetyEmergency.heroSub")}</Text>
          <TouchableOpacity style={styles.sosBig} onPress={onSos} activeOpacity={0.9}>
            <Ionicons name="alert-circle" size={24} color="#fff" />
            <Text style={styles.sosBigText}>{t("safetyEmergency.sosButton")}</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.cardTitle}>{t("safetyEmergency.crashMonitorTitle")}</Text>
              <Text style={styles.cardSub}>{t("safetyEmergency.crashMonitorSub")}</Text>
            </View>
            {hydrated ? (
              <Switch
                value={crashDetectionEnabled}
                onValueChange={setCrashDetectionEnabled}
                trackColor={{ false: "#334155", true: "rgba(99,102,241,0.55)" }}
                thumbColor={crashDetectionEnabled ? "#E0E7FF" : "#94A3B8"}
              />
            ) : null}
          </View>
        </View>

        <Text style={styles.section}>{t("safetyEmergency.sectionVehicle")}</Text>
        <BatteryHealthCard
          t={t}
          classification={classification}
          voltageDisplay={voltageDisplay}
          engineRunning={engineRunning}
        />
        <TireAlertCard t={t} />

        <Text style={styles.section}>{t("safetyEmergency.sectionQuickDial")}</Text>
        <View style={styles.dialRow}>
          {DEFAULT_EMERGENCY_PRESETS_IL.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.dialChip}
              onPress={() => confirmDialEmergency(p.number, t)}
              activeOpacity={0.88}
            >
              <Text style={styles.dialNum}>{p.number}</Text>
              <Text style={styles.dialLabel}>{t(p.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>{t("safetyEmergency.sectionTrusted")}</Text>
        <View style={styles.placeholderCard}>
          <Ionicons name="people-outline" size={20} color={C.sub} />
          <Text style={styles.placeholderText}>{t("safetyEmergency.trustedPlaceholder")}</Text>
        </View>

        <Text style={styles.legal}>{t("safetyEmergency.screenLegal")}</Text>
      </ScrollView>

      <EmergencySOSModal visible={sosOpen} onClose={() => setSosOpen(false)} t={t} />
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 8,
    gap: 12,
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  eyebrow: {
    color: C.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    color: C.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  body: { paddingHorizontal: 18, paddingTop: 8 },
  hero: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.25)",
    alignItems: "center",
  },
  heroTitle: {
    color: "#FEE2E2",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },
  heroSub: {
    color: C.sub,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
  },
  sosBig: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#B91C1C",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(254,202,202,0.4)",
  },
  sosBigText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "rgba(15,23,42,0.76)",
    borderRadius: 22,
    padding: 17,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.24)",
    marginBottom: 20,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  cardSub: { color: C.sub, fontSize: 13, lineHeight: 18, marginTop: 4 },
  section: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 6,
    textTransform: "uppercase",
  },
  dialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  dialChip: {
    flexGrow: 1,
    minWidth: "28%",
    backgroundColor: "rgba(15,23,42,0.72)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.28)",
    alignItems: "center",
  },
  dialNum: {
    color: C.text,
    fontSize: 18,
    fontWeight: "900",
  },
  dialLabel: {
    color: C.sub,
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
    textAlign: "center",
  },
  placeholderCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(15,23,42,0.66)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(148,163,184,0.35)",
    marginBottom: 20,
  },
  placeholderText: {
    flex: 1,
    color: C.sub,
    fontSize: 13,
    lineHeight: 19,
  },
  legal: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
    marginTop: 8,
  },
});
