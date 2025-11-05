import React, { useRef, useEffect } from "react";
import { TouchableOpacity, View, Text, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function FloatingChatButton({ onPress, label = "ChatBot" }) {
  // soft pulse behind the button (professional feel)
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.05] });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* message bubble (always visible) */}
      <View style={styles.msgWrap} pointerEvents="none">
        <View style={styles.messageBubble}>
          <Text style={styles.messageText}>Do you want help?</Text>
          {/* bubble tail */}
          <View style={styles.tail} />
        </View>
      </View>

      {/* subtle animated pulse behind the circle */}
      <Animated.View style={[styles.pulse, { transform: [{ scale }], opacity }]} />

      {/* main circular button */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={styles.circleWrap}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Open ChatBot"
      >
        {/* ring */}
        <View style={styles.ring} />
        {/* gradient fill */}
        <LinearGradient
          colors={["#8694FF", "#6F7CFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.circle}
        >
          <Ionicons name="chatbubbles-outline" size={26} color="#FFFFFF" />
          <Text style={styles.label}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const BTN_SIZE = 72;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 18,
    bottom: 26,
    alignItems: "flex-end",
    zIndex: 999,
  },

  // message bubble
  msgWrap: {
    marginRight: 6,
    marginBottom: 8,
    alignItems: "flex-end",
  },
  messageBubble: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  messageText: {
    color: "#0B0F19",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  tail: {
    position: "absolute",
    right: 14,
    bottom: -6,
    width: 10,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    transform: [{ rotate: "45deg" }],
  },

  // animated pulse backdrop
  pulse: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: BTN_SIZE + 18,
    height: BTN_SIZE + 18,
    borderRadius: (BTN_SIZE + 18) / 2,
    backgroundColor: "#7C8CFF",
  },

  // button shell
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
    paddingTop: 10,
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
