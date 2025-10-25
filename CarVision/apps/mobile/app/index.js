import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <LinearGradient colors={["#0B0F19", "#11182A"]} style={styles.bg}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🚗 CarVision</Text>
          <Text style={styles.subtitle}>Smart Vehicle Diagnostics</Text>
        </View>

        {/* Grid */}
        <ScrollView contentContainerStyle={styles.grid}>
          <Tile
            icon="📊"
            title="Live Data"
            subtitle="RPM • Speed • Temperature"
            onPress={() => router.push("/cardata")}
          />
          <Tile
            icon="🧰"
            title="Repairing"
            subtitle="Find Causes & Fix Steps"
            onPress={() => router.push("/repairs")}
          />
          <Tile
            icon="🛠️"
            title="Diagnostics"
            subtitle="Read & Clear Error Codes"
            onPress={() => router.push("/diagnostics")}
          />
          <Tile
            icon="🤖"
            title="AI Chat"
            subtitle="Ask CarVision Assistant"
            onPress={() => router.push("/ai")}
          />
          <Tile
            icon="⚙️"
            title="Settings"
            subtitle="Connection & Preferences"
            onPress={() => router.push("/settings")}
          />
        </ScrollView>

        {/* Footer */}
        <Text style={styles.footer}>© 2025 CarVision Project</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Tile({ icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={["rgba(124,140,255,0.15)", "rgba(124,140,255,0.05)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tileGradient}
      >
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.tileText}>
          <Text style={styles.tileTitle}>{title}</Text>
          <Text style={styles.tileSubtitle}>{subtitle}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 10,
  },
  logo: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: "#A8B2D1",
    fontSize: 14,
    marginTop: 4,
  },
  grid: {
    padding: 16,
    gap: 16,
  },
  tile: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#7C8CFF",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  tileGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    backgroundColor: "rgba(22,26,36,0.85)",
  },
  icon: {
    fontSize: 32,
    marginRight: 14,
  },
  tileText: {
    flexShrink: 1,
  },
  tileTitle: {
    color: "#E6E9F5",
    fontSize: 18,
    fontWeight: "800",
  },
  tileSubtitle: {
    color: "#A8B2D1",
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    color: "#A8B2D1",
    textAlign: "center",
    fontSize: 12,
    marginBottom: 8,
  },
});
