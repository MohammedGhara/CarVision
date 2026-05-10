// apps/mobile/components/safety/EmergencyQuickActions.js
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native"
import { LocalizedText as Text } from "../ui/LocalizedText";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { DEFAULT_PRIMARY_EMERGENCY_NUMBER } from "../../lib/emergencyConfig";
import { confirmDialEmergency } from "../../utils/emergencyDial";
import { shareEmergencyLocation } from "../../utils/locationUtils";
import { C } from "../../styles/theme";

/**
 * Shared emergency CTAs — never auto-dials; confirmDialEmergency shows confirmation first.
 */
export default function EmergencyQuickActions({
  t,
  showImOkay,
  onImOkay,
  primaryEmergencyNumber = DEFAULT_PRIMARY_EMERGENCY_NUMBER,
}) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      {showImOkay ? (
        <TouchableOpacity style={styles.btnOk} onPress={onImOkay} activeOpacity={0.9}>
          <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
          <Text style={styles.btnOkText}>{t("safetyEmergency.imOkay")}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.btnDanger}
        onPress={() => confirmDialEmergency(primaryEmergencyNumber, t)}
        activeOpacity={0.9}
      >
        <Ionicons name="call-outline" size={22} color="#fff" />
        <Text style={styles.btnDangerText}>{t("safetyEmergency.callEmergency")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnGhost}
        onPress={() => shareEmergencyLocation({ t })}
        activeOpacity={0.88}
      >
        <Ionicons name="share-social-outline" size={20} color={C.primary} />
        <Text style={styles.btnGhostText}>{t("safetyEmergency.shareLocation")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnGhost}
        onPress={() => router.push("/map-for-garages")}
        activeOpacity={0.88}
      >
        <Ionicons name="map-outline" size={20} color={C.green} />
        <Text style={styles.btnGhostText}>{t("safetyEmergency.openGarageMap")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  btnOk: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.22)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.45)",
  },
  btnOkText: {
    color: "#ECFDF5",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  btnDanger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#B91C1C",
    borderWidth: 1,
    borderColor: "rgba(254,202,202,0.35)",
  },
  btnDangerText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  btnGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.28)",
  },
  btnGhostText: {
    color: C.text,
    fontSize: 15,
    fontWeight: "700",
  },
});
