import React from "react";
import { View, StyleSheet } from "react-native";
import { LocalizedText as Text } from "../../../components/ui/LocalizedText";
import SeverityBadge from "./SeverityBadge.jsx";

/**
 * @param {{ result: import('../models/scanTypes.js').VisionScanResult, t: (k: string) => string }} props
 */
export default function VisionResultPanel({ result, t }) {
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <SeverityBadge urgency={result.urgency} />
        <Text style={styles.conf}>{t("visionAI.confidence")}: {Math.round(result.confidence)}%</Text>
      </View>
      <Text style={styles.source}>
        {result.matchSource === "openai" ? t("visionAI.sourceOpenai") : t("visionAI.sourceLocal")}
      </Text>
      <Text style={styles.h2}>{result.detectedPartName}</Text>
      <Text style={styles.p}>{result.possibleIssue}</Text>

      <Text style={styles.h3}>{t("visionAI.causes")}</Text>
      {result.causes.map((c, i) => (
        <Text key={i} style={styles.bullet}>
          • {c}
        </Text>
      ))}

      <Text style={styles.h3}>{t("visionAI.recommendations")}</Text>
      {result.recommendations.map((c, i) => (
        <Text key={i} style={styles.bullet}>
          • {c}
        </Text>
      ))}

      <Text style={styles.h3}>{t("visionAI.repairCostBand")}</Text>
      <Text style={styles.p}>{result.repairCostCategory}</Text>

      <Text style={styles.h3}>{t("visionAI.maintenanceTips")}</Text>
      {result.maintenanceTips.map((c, i) => (
        <Text key={i} style={styles.bullet}>
          • {c}
        </Text>
      ))}

      {result.doctorCarContextLine ? (
        <>
          <Text style={styles.h3}>{t("visionAI.doctorCarLink")}</Text>
          <Text style={styles.hint}>{result.doctorCarContextLine}</Text>
        </>
      ) : null}

      <Text style={styles.h3}>{t("visionAI.aiNarrative")}</Text>
      <Text style={styles.narr}>{result.narrative}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  conf: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  source: { color: "#67E8F9", fontSize: 11, fontWeight: "700", marginBottom: 8, marginTop: 2 },
  h2: { color: "#F8FAFC", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  p: { color: "#CBD5E1", fontSize: 14, lineHeight: 21, marginBottom: 12 },
  h3: { color: "#22D3EE", fontSize: 12, fontWeight: "900", letterSpacing: 1.1, marginTop: 12, marginBottom: 6 },
  bullet: { color: "#E2E8F0", fontSize: 13, lineHeight: 20, marginBottom: 4 },
  hint: { color: "#A5B4FC", fontSize: 12, lineHeight: 18 },
  narr: { color: "#E2E8F0", fontSize: 13, lineHeight: 21, fontStyle: "italic" },
});
