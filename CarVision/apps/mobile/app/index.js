// apps/mobile/app/index.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import FloatingChatButton from "../components/FloatingChatButton";

import { api } from "../lib/api";
import { getToken, getUser, saveUser, clearAuth } from "../lib/authStore";

const C = {
  bg1: "#0B0F19",
  bg2: "#11182A",
  glass: "rgba(15,20,30,0.66)",
  border: "rgba(255,255,255,0.08)",
  text: "#E6E9F5",
  sub: "#9AA4BC",
  primary: "#7C8CFF",
  primarySoft: "rgba(124,140,255,0.18)",
  chip: "rgba(255,255,255,0.06)",
};

export default function HomeScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);

  // Validate token + load user
  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (!t) {
        setChecking(false);
        router.replace("/login");
        return;
      }
      try {
        const me = await api.get("/api/auth/me");
        if (me?.user) await saveUser(me.user);
        const u = await getUser();
        setUser(u);
      } catch {
        await clearAuth();
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  async function onLogout() {
    await clearAuth();
    router.replace("/login");
  }

  const displayName = useMemo(
    () => (user?.name || user?.fullName || user?.email || "Driver"),
    [user]
  );

  if (checking) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg1 }}>
        <ActivityIndicator size="large" />
        <Text style={{ color: C.sub, marginTop: 10 }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient colors={[C.bg1, C.bg2]} style={styles.bg}>
      <StatusBar barStyle="light-content" />
      {/* Optional faint hero background image (subtle, under all UI) */}
      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1600&auto=format&fit=crop" }}
        imageStyle={{ opacity: 0.08 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.brandLeft}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandIcon}>🚗</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>CarVision</Text>
              <Text style={styles.brandSub}>Smart Vehicle Diagnostics</Text>
            </View>
          </View>

          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.9}>
            <Ionicons name="log-out-outline" size={16} color={C.text} />
            <Text style={styles.logoutTxt}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* HERO CARD */}
        <LinearGradient
          colors={["rgba(124,140,255,0.16)", "rgba(18,22,33,0.6)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hello,</Text>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.heroLine}>Drive smarter. Diagnose faster.</Text>

            <View style={styles.chipsRow}>
              <Chip icon="speedometer-outline" text="Live Data" />
              <Chip icon="construct-outline" text="Diagnostics" />
              <Chip icon="chatbubbles-outline" text="AI Assistant" />
            </View>

            <TouchableOpacity
              style={styles.cta}
              onPress={() => router.push("/diagnostics")}
              activeOpacity={0.9}
            >
              <Ionicons name="flash-outline" size={18} color="#fff" />
              <Text style={styles.ctaText}>Run Quick Scan</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>READY</Text>
          </View>
        </LinearGradient>

        {/* SECTIONS */}
        <ScrollView contentContainerStyle={styles.scrollBody}>
          <SectionTitle title="Quick Actions" />

          <View style={styles.grid}>
            <Tile
              title="Live Data"
              subtitle="RPM • Speed • Temp"
              icon="pulse-outline"
              onPress={() => router.push("/cardata")}
            />
            <Tile
              title="Repairing"
              subtitle="Causes & Fix Steps"
              icon="hammer-outline"
              onPress={() => router.push("/repairs")}
            />
            <Tile
              title="Diagnostics"
              subtitle="Read/Clear Codes"
              icon="construct-outline"
              onPress={() => router.push("/diagnostics")}
            />
            <Tile
              title="Settings"
              subtitle="Connection & Preferences"
              icon="settings-outline"
              onPress={() => router.push("/settings")}
            />
          </View>

          <SectionTitle title="Tips" />

          <View style={styles.tipsBox}>
            <Text style={styles.tipLine}>• Keep the engine idling before reading live sensors.</Text>
            <Text style={styles.tipLine}>• If MIL is on, read codes first — then clear only after repair.</Text>
            <Text style={styles.tipLine}>• Low battery voltage can cause false sensor readings.</Text>
          </View>

          <Text style={styles.footer}>© 2025 CarVision Project</Text>
        </ScrollView>
      </SafeAreaView>

      {/* Floating chat button */}
      <FloatingChatButton onPress={() => router.push("/ai")} />
    </LinearGradient>
  );
}

/* ————— Components ————— */

function SectionTitle({ title }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function Chip({ icon, text }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={14} color={C.text} style={{ marginRight: 6 }} />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

function Tile({ title, subtitle, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.92}>
      <LinearGradient
        colors={["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.tileInner}
      >
        <View style={styles.tileIconWrap}>
          <Ionicons name={icon} size={20} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tileTitle}>{title}</Text>
          <Text style={styles.tileSub}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.sub} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

/* ————— Styles ————— */

const styles = StyleSheet.create({
  bg: { flex: 1 },

  headerRow: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brandLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandBadge: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(124,140,255,0.16)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border,
  },
  brandIcon: { fontSize: 18 },
  brandTitle: { color: C.text, fontSize: 18, fontWeight: "900", letterSpacing: 0.3 },
  brandSub: { color: C.sub, fontSize: 12, marginTop: 2 },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.primarySoft,
  },
  logoutTxt: { color: C.text, fontWeight: "800" },

  hero: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.glass,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  hello: { color: C.sub, fontSize: 13 },
  displayName: { color: C.text, fontSize: 22, fontWeight: "900", marginTop: 2 },
  heroLine: { color: C.sub, fontSize: 12, marginTop: 6 },

  chipsRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.chip,
    borderRadius: 999,
    borderWidth: 1, borderColor: C.border,
  },
  chipText: { color: C.text, fontSize: 12, fontWeight: "700" },

  cta: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.primary,
  },
  ctaText: { color: "#fff", fontWeight: "900" },

  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(91,228,155,0.32)",
    backgroundColor: "rgba(91,228,155,0.12)",
  },
  heroBadgeText: { color: "#5BE49B", fontWeight: "900", letterSpacing: 0.6, fontSize: 11 },

  scrollBody: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },

  sectionRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, marginTop: 12 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "900", marginRight: 10 },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },

  grid: { gap: 12 },
  tile: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    backgroundColor: "rgba(22,26,36,0.82)",
  },
  tileInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  tileIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(124,140,255,0.14)",
    borderWidth: 1, borderColor: C.border,
  },
  tileTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  tileSub: { color: C.sub, marginTop: 2 },

  tipsBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  tipLine: { color: C.sub, marginVertical: 2, fontSize: 13 },

  footer: { color: C.sub, textAlign: "center", fontSize: 12, marginTop: 16 },
});
