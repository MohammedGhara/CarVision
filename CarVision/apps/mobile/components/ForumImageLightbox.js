// apps/mobile/components/ForumImageLightbox.js
import React from "react";
import { Modal, View, Image, Pressable, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useLanguage } from "../context/LanguageContext";

/**
 * Full-screen image viewer: tap backdrop or image area to close; explicit close button.
 */
export default function ForumImageLightbox({ visible, uri, onClose }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { t } = useLanguage();

  if (!uri) return null;

  const maxW = width - 24;
  const maxH = height - insets.top - insets.bottom - 56;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable
          style={[styles.pressable, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16 }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("forum.expandImage")}
        >
          <Image source={{ uri }} style={{ width: maxW, height: maxH }} resizeMode="contain" accessibilityIgnoresInvertColors />
        </Pressable>
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t("forum.closeImageViewer")}
        >
          <Ionicons name="close-circle" size={36} color="rgba(255,255,255,0.92)" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
  },
  pressable: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    right: 12,
    zIndex: 10,
    padding: 4,
  },
});
