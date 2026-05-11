import React from "react";
import { View, StyleSheet } from "react-native";
import { LocalizedText as Text } from "../../../components/ui/LocalizedText";
import { urgencyColors } from "../utils/urgencyStyles.js";

/** @param {{ urgency: 'low'|'medium'|'high'|'critical', label?: string }} props */
export default function SeverityBadge({ urgency, label }) {
  const c = urgencyColors(urgency);
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{label || urgency.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
});
