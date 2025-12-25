import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

/**
 * AppBackground - Beautiful smooth gradient background component for CarVision
 * 
 * Features:
 * - Smooth, attractive gradient design (no images needed)
 * - Modern dark theme with rich colors
 * - Support for scrollable and non-scrollable content
 * - Responsive design with consistent padding
 * - SafeAreaView integration
 * 
 * @param {React.ReactNode} children - Content to display inside the background
 * @param {boolean} scrollable - Whether to use ScrollView instead of View (default: false)
 * @param {Object} contentContainerStyle - Additional styles for content container
 * @param {string[]} safeAreaEdges - Safe area edges to apply (default: ["top", "bottom"])
 */
export default function AppBackground({
  children,
  scrollable = false,
  contentContainerStyle,
  safeAreaEdges = ["top", "bottom"],
}) {
  const ContentWrapper = scrollable ? ScrollView : View;

  return (
    <LinearGradient
      colors={[
        "#0A0E1A", // Deep midnight blue
        "#14182E", // Dark navy blue
        "#1A1F3A", // Rich dark purple-blue
        "#14182E", // Back to navy
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.3, 0.7, 1]}
      style={styles.gradient}
    >
      {/* Subtle overlay gradient for depth */}
      <LinearGradient
        colors={[
          "rgba(124, 140, 255, 0.03)", // Soft blue tint
          "rgba(0, 0, 0, 0)", // Transparent
          "rgba(139, 92, 246, 0.02)", // Soft purple tint
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Subtle radial gradient for ambient glow */}
      <View style={styles.ambientGlow} />

      {/* Safe area wrapper */}
      <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
        <ContentWrapper
          style={[
            scrollable ? styles.scrollContent : styles.content,
            contentContainerStyle,
          ]}
          contentContainerStyle={
            scrollable
              ? [styles.scrollContentContainer, contentContainerStyle]
              : undefined
          }
          showsVerticalScrollIndicator={scrollable ? false : undefined}
        >
          {children}
        </ContentWrapper>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  ambientGlow: {
    position: "absolute",
    top: -200,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 400,
    backgroundColor: "rgba(124, 140, 255, 0.08)",
    opacity: 0.6,
  },
  safeArea: {
    flex: 1,
    width: "100%",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexGrow: 1,
  },
});


