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
  bg1: "#020617", // slate-950
  bg2: "#020617",
  panel: "rgba(15,23,42,0.96)",
  panelSoft: "rgba(15,23,42,0.85)",
  border: "rgba(148,163,184,0.35)",
  divider: "rgba(30,64,175,0.5)",
  text: "#E5E7EB",
  sub: "#9CA3AF",
  primary: "#6366F1",
  primarySoft: "rgba(99,102,241,0.18)",
  green: "#22C55E",
  amber: "#FACC15",
  red: "#F97373",
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
      } catch (e) {
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
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: C.bg1,
        }}
      >
        <ActivityIndicator size="large" />
        <Text style={{ color: C.sub, marginTop: 10 }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient colors={[C.bg1, C.bg2]} style={styles.bg}>
      <StatusBar barStyle="light-content" />

      {/* Soft abstract background */}
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1502877828070-33b167ad6860?q=80&w=1600&auto=format&fit=crop",
        }}
        imageStyle={{ opacity: 0.12 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* —— TOP BAR —— */}
        <View style={styles.header}>
          <View style={styles.appIdentity}>
            <View style={styles.logoCircle}>
              <Ionicons name="car-sport-outline" size={20} color={C.primary} />
            </View>
            <View>
              <Text style={styles.appTitle}>CarVision</Text>
              <Text style={styles.appSubtitle}>Vehicle Health Dashboard</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onLogout}
            style={styles.logoutBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={16} color={C.text} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* —— MAIN CONTENT —— */}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Greeting + small pills */}
          <View style={styles.greetingBlock}>
            <View>
              <Text style={styles.greetingLabel}>Welcome back,</Text>
              <Text style={styles.greetingName}>{displayName}</Text>
            </View>

            <View style={styles.greetingPills}>
              <InfoPill icon="radio-outline" label="OBD Status" value="Ready" color={C.green} />
              <InfoPill icon="document-text-outline" label="History" value="Available" color={C.primary} />
            </View>
          </View>

          {/* Vehicle Overview Panel */}
          <View style={styles.sectionPanel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vehicle Overview</Text>
              <View style={styles.sectionHeaderRight}>
                <View style={styles.statusDot} />
                <Text style={styles.sectionStatusText}>Awaiting connection</Text>
              </View>
            </View>

            <View style={styles.overviewRow}>
              <View style={{ flex: 1 }}>
                <OverviewMetric
                  label="Engine Health"
                  value="—"
                  hint="Run a scan to analyze"
                />
                <View style={{ height: 10 }} />
                <OverviewMetric
                  label="Active DTC Codes"
                  value="—"
                  hint="Shown after first scan"
                />
              </View>

              <View style={styles.overviewCard}>
                <Text style={styles.overviewCardTitle}>Quick Scan</Text>
                <Text style={styles.overviewCardText}>
                  Start a diagnostic scan to read error codes and system status.
                </Text>
                <TouchableOpacity
                  style={styles.overviewButton}
                  onPress={() => router.push("/diagnostics")}
                  activeOpacity={0.9}
                >
                  <Ionicons name="flash-outline" size={18} color="#fff" />
                  <Text style={styles.overviewButtonText}>Run Scan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Divider line */}
          <View style={styles.divider} />

          {/* PRIMARY ACTIONS */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>Primary Actions</Text>
              <Text style={styles.blockSubtitle}>
                Start with one of the main tools below.
              </Text>
            </View>

            <View style={styles.primaryGrid}>
              <PrimaryCard
                title="Diagnostics"
                subtitle="Read & clear DTC codes"
                icon="construct-outline"
                accent={C.red}
                onPress={() => router.push("/diagnostics")}
              />
              <PrimaryCard
                title="Live Data"
                subtitle="RPM, speed, temperature"
                icon="pulse-outline"
                accent={C.green}
                onPress={() => router.push("/cardata")}
              />
              <PrimaryCard
                title="Repair Guidance"
                subtitle="Causes and fix steps"
                icon="hammer-outline"
                accent={C.amber}
                onPress={() => router.push("/repairs")}
              />
            </View>
          </View>

          {/* SECONDARY TOOLS */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>Tools & Reports</Text>
            </View>

            <View style={styles.secondaryList}>
          
              <SecondaryRow
                icon="chatbubbles-outline"
                title="AI Assistant"
                description="Ask questions about codes, symptoms and possible causes."
                onPress={() => router.push("/ai")}
              />
              <SecondaryRow
                icon="settings-outline"
                title="Settings"
                description="OBD connection, preferences, account details."
                onPress={() => router.push("/settings")}
              />
            </View>
          </View>

          {/* HELP & TIPS */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>Best Practices</Text>
            </View>

            <View style={styles.tipsPanel}>
              <TipLine text="Keep the engine running at idle when capturing live data." />
              <TipLine text="Always read codes before disconnecting the OBD adapter." />
              <TipLine text="Clear codes only after repairs, then re-scan to confirm." />
              <TipLine text="Low battery voltage can cause random or false error codes." />
            </View>
          </View>

          <Text style={styles.footer}>© 2025 CarVision — Senior Project</Text>
        </ScrollView>
      </SafeAreaView>

      {/* Global floating AI button */}
      <FloatingChatButton onPress={() => router.push("/ai")} />
    </LinearGradient>
  );
}

/* ——— Small Presentational Components ——— */

function InfoPill({ icon, label, value, color }) {
  return (
    <View style={styles.infoPill}>
      <Ionicons name={icon} size={14} color={color} style={{ marginRight: 6 }} />
      <View>
        <Text style={[styles.infoPillLabel, { color }]}>{label}</Text>
        <Text style={styles.infoPillValue}>{value}</Text>
      </View>
    </View>
  );
}

function OverviewMetric({ label, value, hint }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

function PrimaryCard({ title, subtitle, icon, accent, onPress }) {
  return (
    <TouchableOpacity style={styles.primaryCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.primaryIconWrap, { borderColor: accent, backgroundColor: "rgba(15,23,42,0.95)" }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.primaryTitle}>{title}</Text>
        <Text style={styles.primarySubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.sub} />
    </TouchableOpacity>
  );
}

function SecondaryRow({ icon, title, description, onPress }) {
  return (
    <TouchableOpacity style={styles.secondaryRow} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.secondaryIconWrap}>
        <Ionicons name={icon} size={18} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.secondaryTitle}>{title}</Text>
        <Text style={styles.secondaryDesc}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.sub} />
    </TouchableOpacity>
  );
}

function TipLine({ text }) {
  return (
    <View style={styles.tipLineRow}>
      <View style={styles.tipBullet} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

/* ——— Styles ——— */

const styles = StyleSheet.create({
  bg: { flex: 1 },

  header: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(15,23,42,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  appTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  appSubtitle: {
    color: C.sub,
    fontSize: 12,
    marginTop: 2,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(15,23,42,0.96)",
  },
  logoutText: { color: C.text, fontWeight: "800", fontSize: 12 },

  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },

  greetingBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  greetingLabel: {
    color: C.sub,
    fontSize: 13,
  },
  greetingName: {
    color: C.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  greetingPills: {
    alignItems: "flex-end",
    gap: 6,
  },

  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15,23,42,0.94)",
    borderWidth: 1,
    borderColor: C.border,
  },
  infoPillLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  infoPillValue: {
    fontSize: 11,
    color: C.text,
  },

  sectionPanel: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.panel,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.green,
  },
  sectionStatusText: {
    color: C.sub,
    fontSize: 11,
    fontWeight: "600",
  },

  overviewRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },

  metric: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    backgroundColor: C.panelSoft,
    marginBottom: 6,
  },
  metricLabel: {
    color: C.sub,
    fontSize: 11,
  },
  metricValue: {
    color: C.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  metricHint: {
    color: C.sub,
    fontSize: 11,
    marginTop: 2,
  },

  overviewCard: {
    width: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(15,23,42,0.98)",
    padding: 10,
    justifyContent: "space-between",
  },
  overviewCardTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "800",
  },
  overviewCardText: {
    color: C.sub,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 8,
  },
  overviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.primary,
  },
  overviewButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },

  divider: {
    height: 1,
    backgroundColor: C.divider,
    opacity: 0.5,
    marginVertical: 14,
  },

  block: { marginBottom: 16 },
  blockHeader: { marginBottom: 8 },
  blockTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "900",
  },
  blockSubtitle: {
    color: C.sub,
    fontSize: 12,
    marginTop: 2,
  },

  primaryGrid: {
    gap: 10,
  },
  primaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.panel,
    padding: 12,
  },
  primaryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  primaryTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "900",
  },
  primarySubtitle: {
    color: C.sub,
    fontSize: 12,
    marginTop: 2,
  },

  secondaryList: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.panel,
    overflow: "hidden",
  },
  secondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.9)",
  },
  secondaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.98)",
    borderWidth: 1,
    borderColor: C.border,
  },
  secondaryTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryDesc: {
    color: C.sub,
    fontSize: 11,
    marginTop: 2,
  },

  tipsPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.panel,
    padding: 12,
    gap: 6,
  },
  tipLineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: C.primary,
    marginTop: 5,
  },
  tipText: {
    color: C.sub,
    fontSize: 12,
    flex: 1,
  },

  footer: {
    color: C.sub,
    fontSize: 11,
    textAlign: "center",
    marginTop: 10,
  },
});
