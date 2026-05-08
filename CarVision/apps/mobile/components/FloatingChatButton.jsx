import React, { useRef, useEffect, useState } from "react";
import { TouchableOpacity, View, Text, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLanguage } from "../context/LanguageContext";

export default function FloatingChatButton({ onPress, label }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const message = t("chatbot.tooltip");
  const buttonLabel = label || t("chatbot.label");
  const [showBubble, setShowBubble] = useState(true);

  useEffect(() => {
    const hide = setTimeout(() => setShowBubble(false), 6500);
    return () => clearTimeout(hide);
  }, []);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.058] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.05] });

  const bottomOffset = Math.max(insets.bottom, 12) + 10;

  return (
    <View style={[styles.container, { bottom: bottomOffset }]} pointerEvents="box-none">
      {showBubble ? (
        <View style={styles.msgWrap} pointerEvents="none">
          <View style={styles.messageBubble}>
            <Text style={styles.messageText}>{message}</Text>
            <View style={styles.tail} />
          </View>
        </View>
      ) : null}

      <Animated.View style={[styles.pulse, { transform: [{ scale }], opacity }]} />

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={styles.circleWrap}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Open ChatBot"
      >
        <View style={styles.ring} />
        <LinearGradient
          colors={["#8B98FF", "#6366F1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.circle}
        >
          <Ionicons name="chatbubbles-outline" size={26} color="#FFFFFF" />
          <Text style={styles.label}>{buttonLabel}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const BTN_SIZE = 70;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 18,
    alignItems: "flex-end",
    zIndex: 999,
  },

  msgWrap: {
    marginRight: 6,
    marginBottom: 8,
    alignItems: "flex-end",
  },
  messageBubble: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    maxWidth: 258,
  },
  messageText: {
    color: "#0B0F19",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  tail: {
    position: "absolute",
    right: 14,
    bottom: -6,
    width: 10,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    transform: [{ rotate: "45deg" }],
  },

  pulse: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: BTN_SIZE + 18,
    height: BTN_SIZE + 18,
    borderRadius: (BTN_SIZE + 18) / 2,
    backgroundColor: "rgba(99, 102, 241, 0.32)",
  },

  circleWrap: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  ring: {
    position: "absolute",
    width: BTN_SIZE + 6,
    height: BTN_SIZE + 6,
    borderRadius: (BTN_SIZE + 6) / 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  circle: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 9,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  label: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
