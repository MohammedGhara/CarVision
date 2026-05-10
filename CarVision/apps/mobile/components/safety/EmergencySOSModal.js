// apps/mobile/components/safety/EmergencySOSModal.js
import React from "react";
import { Modal, View, TouchableOpacity, ScrollView, StyleSheet, Platform } from "react-native"
import { LocalizedText as Text } from "../ui/LocalizedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

import EmergencyQuickActions from "./EmergencyQuickActions";
import { C } from "../../styles/theme";

export default function EmergencySOSModal({ visible, onClose, t }) {
  const insets = useSafeAreaInsets();

  if (Platform.OS === "web") return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient
        colors={["#0f172a", "#020617"]}
        style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 14 }]}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeHit} onPress={onClose} accessibilityRole="button">
            <Ionicons name="close" size={26} color={C.sub} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("safetyEmergency.sosModalTitle")}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>{t("safetyEmergency.sosModalSubtitle")}</Text>

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={18} color="#FBBF24" />
            <Text style={styles.noteText}>{t("safetyEmergency.sosNoAutoCall")}</Text>
          </View>

          <EmergencyQuickActions t={t} showImOkay={false} />

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.cancelText}>{t("safetyEmergency.cancel")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  closeHit: { padding: 8 },
  title: {
    flex: 1,
    textAlign: "center",
    color: C.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  sub: {
    color: C.sub,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
    textAlign: "center",
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(251,191,36,0.08)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
    marginBottom: 20,
  },
  noteText: {
    flex: 1,
    color: "#FDE68A",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  cancelBtn: {
    marginTop: 18,
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: {
    color: C.sub,
    fontSize: 15,
    fontWeight: "700",
  },
});
