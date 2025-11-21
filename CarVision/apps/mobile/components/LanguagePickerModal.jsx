
import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";

export default function LanguagePickerModal({ visible, onClose, onSelect }) {
  const { t, languages, language } = useLanguage();
  const languageList = Object.values(languages);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("language.selectLanguage")}</Text>
          {languageList.map((lang) => {
            const selected = lang.code === language;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => {
                  onSelect?.(lang.code);
                }}
              >
                <View>
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {lang.nativeName}
                  </Text>
                  <Text style={styles.optionSub}>{lang.name}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color={C.primary} />}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F8FAFC",
    textAlign: "center",
    marginBottom: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionSelected: {
    backgroundColor: "rgba(124,140,255,0.12)",
  },
  optionText: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
  },
  optionTextSelected: {
    color: C.primary,
  },
  optionSub: {
    color: "#94A3B8",
    fontSize: 13,
  },
  closeBtn: {
    marginTop: 10,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  closeText: {
    color: "#F8FAFC",
    fontWeight: "700",
  },
});

