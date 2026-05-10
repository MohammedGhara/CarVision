// apps/mobile/components/safety/TireAlertCard.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import { C } from "../../styles/theme";

/** Placeholder until TPMS / tire PIDs are wired through telemetry. */
export default function TireAlertCard({ t }) {
  return (
    <LinearGradient
      colors={["rgba(59,130,246,0.12)", "rgba(15,23,42,0.95)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="speedometer-outline" size={22} color="#93C5FD" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("safetyEmergency.tireCardTitle")}</Text>
          <Text style={styles.body}>{t("safetyEmergency.tirePlaceholder")}</Text>
        </View>
      </View>
      <Text style={styles.fine}>{t("safetyEmergency.tireFutureHint")}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 19,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.22)",
    marginBottom: 16,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.35)",
  },
  title: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  body: {
    color: C.sub,
    fontSize: 14,
    lineHeight: 21,
  },
  fine: {
    marginTop: 12,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },
});
