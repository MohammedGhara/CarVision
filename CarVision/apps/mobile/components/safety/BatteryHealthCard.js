// apps/mobile/components/safety/BatteryHealthCard.js
import React from "react";
import { View, StyleSheet } from "react-native"
import { LocalizedText as Text } from "../ui/LocalizedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import { C } from "../../styles/theme";

export default function BatteryHealthCard({ t, classification, voltageDisplay, engineRunning }) {
  const accent =
    classification === "critical"
      ? "#F97373"
      : classification === "warning"
      ? "#FBBF24"
      : classification === "normal"
      ? "#22C55E"
      : "#94A3B8";

  const label =
    classification === "critical"
      ? t("safetyEmergency.batteryCritical")
      : classification === "warning"
      ? t("safetyEmergency.batteryWarning")
      : classification === "normal"
      ? t("safetyEmergency.batteryNormal")
      : t("safetyEmergency.batteryUnknown");

  return (
    <LinearGradient
      colors={["rgba(99,102,241,0.18)", "rgba(15,23,42,0.95)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { borderColor: `${accent}55` }]}>
          <Ionicons name="battery-charging-outline" size={22} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("safetyEmergency.batteryCardTitle")}</Text>
          <Text style={[styles.status, { color: accent }]}>{label}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {t("safetyEmergency.batteryVoltageLine", {
          v: voltageDisplay,
          mode: engineRunning ? t("safetyEmergency.engineRunning") : t("safetyEmergency.engineOff"),
        })}
      </Text>
      <Text style={styles.hint}>{t("safetyEmergency.batteryHint")}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 19,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.22)",
    marginBottom: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
  },
  title: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  status: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  meta: {
    color: C.sub,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  hint: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
});
