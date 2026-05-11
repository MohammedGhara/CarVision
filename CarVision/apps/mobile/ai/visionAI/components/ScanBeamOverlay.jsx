import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Futuristic scan line over the image preview (mock “AI scanning”).
 * @param {{ active: boolean, height: number }} props
 */
export default function ScanBeamOverlay({ active, height }) {
  const y = useSharedValue(0);

  useEffect(() => {
    if (!active || height <= 0) {
      y.value = 0;
      return;
    }
    y.value = 0;
    y.value = withRepeat(
      withTiming(height - 24, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [active, height, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: active ? 1 : 0,
  }));

  return (
    <View style={[styles.wrap, { height }]} pointerEvents="none">
      <Animated.View style={[styles.beam, style]}>
        <LinearGradient
          colors={["transparent", "rgba(34,211,238,0.55)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    borderRadius: 16,
  },
  beam: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 28,
  },
});
