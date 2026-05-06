// apps/mobile/components/safety/CrashDetectionAlert.js
import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

import { CRASH_CONFIG } from "../../lib/emergencyConfig";
import EmergencyQuickActions from "./EmergencyQuickActions";
import { C } from "../../styles/theme";

/**
 * Full-screen possible-crash flow. No automatic calls — user must confirm any dial.
 */
export default function CrashDetectionAlert({ visible, onRequestClose, t }) {
  const insets = useSafeAreaInsets();
  const [secondsLeft, setSecondsLeft] = useState(CRASH_CONFIG.countdownSeconds);

  useEffect(() => {
    if (!visible) {
      setSecondsLeft(CRASH_CONFIG.countdownSeconds);
      return undefined;
    }
    setSecondsLeft(CRASH_CONFIG.countdownSeconds);
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [visible]);

  if (Platform.OS === "web") return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onRequestClose}>
      <LinearGradient
        colors={["#1c0608", "#0f172a", "#020617"]}
        style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.iconRing}>
            <Ionicons name="warning" size={42} color="#FCA5A5" />
          </View>

          <Text style={styles.title}>{t("safetyEmergency.crashTitle")}</Text>
          <Text style={styles.body}>{t("safetyEmergency.crashSubtitle")}</Text>

          <View style={styles.timerPill}>
            <Text style={styles.timerText}>
              {secondsLeft > 0
                ? t("safetyEmergency.crashCountdown", { seconds: secondsLeft })
                : t("safetyEmergency.crashCountdownDone")}
            </Text>
          </View>

          <Text style={styles.disclaimer}>{t("safetyEmergency.crashDisclaimer")}</Text>

          <EmergencyQuickActions t={t} showImOkay onImOkay={onRequestClose} />

          <TouchableOpacity style={styles.cancelBtn} onPress={onRequestClose} activeOpacity={0.85}>
            <Text style={styles.cancelText}>{t("safetyEmergency.dismissPanel")}</Text>
          </TouchableOpacity>

          <Text style={styles.finePrint}>{t("safetyEmergency.noAutoCallLegal")}</Text>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  iconRing: {
    alignSelf: "center",
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(185,28,28,0.25)",
    borderWidth: 2,
    borderColor: "rgba(248,113,113,0.45)",
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FEE2E2",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  body: {
    fontSize: 16,
    color: C.sub,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 14,
  },
  timerPill: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.92)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    marginBottom: 18,
  },
  timerText: {
    color: "#FDE68A",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  disclaimer: {
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 20,
    marginBottom: 22,
    textAlign: "center",
  },
  cancelBtn: {
    marginTop: 18,
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: {
    color: C.sub,
    fontSize: 14,
    fontWeight: "600",
  },
  finePrint: {
    marginTop: 20,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
    textAlign: "center",
  },
});
