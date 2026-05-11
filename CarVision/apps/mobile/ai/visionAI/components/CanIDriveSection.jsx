import React from "react";
import { View, StyleSheet } from "react-native";
import { LocalizedText as Text } from "../../../components/ui/LocalizedText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { driveAdviceColors } from "../utils/urgencyStyles.js";
import { VISION_DRIVE_LABELS } from "../models/scanTypes.js";

/** @param {{ advice: 'yes'|'no'|'caution', rationale: string, t: (k: string) => string }} props */
export default function CanIDriveSection({ advice, rationale, t }) {
  const c = driveAdviceColors(advice);
  const title =
    advice === "yes" ? t("visionAI.driveYes") : advice === "no" ? t("visionAI.driveNo") : t("visionAI.driveCaution");
  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.row}>
        <Ionicons name={c.icon} size={28} color={c.text} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.kicker}>{t("visionAI.canDriveTitle")}</Text>
          <Text style={[styles.headline, { color: c.text }]}>{title}</Text>
          <Text style={styles.sub}>{VISION_DRIVE_LABELS[advice]}</Text>
        </View>
      </View>
      <Text style={styles.body}>{rationale}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginTop: 12,
  },
  row: { flexDirection: "row", alignItems: "center" },
  kicker: { color: "#94A3B8", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  headline: { fontSize: 18, fontWeight: "900", marginTop: 4 },
  sub: { color: "#CBD5E1", fontSize: 12, marginTop: 4 },
  body: { color: "#E2E8F0", fontSize: 13, lineHeight: 20, marginTop: 14 },
});
