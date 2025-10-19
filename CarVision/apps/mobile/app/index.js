import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.brand}>CarVision</Text>
        <Text style={styles.sub}>OBD-II Telemetry • Diagnostics</Text>
      </View>

      {/* Buttons grid */}
      <View style={styles.grid}>
        <Tile
          emoji="📈"
          title="Live Data"
          subtitle="RPM • Speed • Temps"
          onPress={() => router.push("/cardata")}
        />
        <Tile
          emoji="🛠️"
          title="Diagnostics"
          subtitle="Read & Clear DTCs"
          onPress={() => router.push("/diagnostics")}
        />
        <Tile
          emoji="⚙️"
          title="Settings"
          subtitle="Connection & Units"
          onPress={() => router.push("/settings")}
        />
        <Tile
        emoji="🤖"
        title="AI Chat"
        subtitle="Ask CarVision"
        onPress={() => router.push("/ai")}
      />

      </View>

      {/* Footer */}
      <Text style={styles.footer}>Final Project • Expo Go (iOS)</Text>
    </SafeAreaView>
  );
}

function Tile({ emoji, title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={{ gap: 2 }}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

const C = {
  bg: "#0B0F19",
  card: "rgba(22,26,36,0.9)",
  border: "rgba(255,255,255,0.06)",
  text: "#E6E9F5",
  sub: "#A8B2D1",
  primary: "#7C8CFF",
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 16, gap: 16 },
  hero: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(124,140,255,0.10)",
  },
  brand: { color: C.text, fontSize: 32, fontWeight: "900", letterSpacing: 0.5 },
  sub: { color: C.sub, marginTop: 6, fontSize: 14 },

  grid: { gap: 12 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  emoji: { fontSize: 26 },
  tileTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  tileSub: { color: C.sub, fontSize: 12 },

  footer: { textAlign: "center", color: C.sub, marginTop: "auto", fontSize: 12 },
});
