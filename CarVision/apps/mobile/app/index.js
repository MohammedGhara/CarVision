// apps/mobile/app/index.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
import LanguagePickerModal from "../components/LanguagePickerModal";

import { api } from "../lib/api";
import { getToken, getUser, saveUser, clearAuth } from "../lib/authStore";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { homeStyles as styles } from "../styles/homeStyles";

export default function HomeScreen() {
  const router = useRouter();
  const { t, language, languages, changeLanguage } = useLanguage();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  // Validate token + load user (with timeout to prevent hanging)
  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (!t) {
        setChecking(false);
        router.replace("/login");
        return;
      }
      
      // Try to get user from cache first (instant)
      const cachedUser = await getUser();
      if (cachedUser) {
        setUser(cachedUser);
        setChecking(false);
        
        // Redirect garage users to garage page
        if (cachedUser.role === "GARAGE") {
          router.replace("/garage");
          return;
        }
        
        // Validate token in background (non-blocking)
        api.get("/api/auth/me").then((me) => {
          if (me?.user) {
            saveUser(me.user);
            setUser(me.user);
            // Check role again after fetching fresh data
            if (me.user.role === "GARAGE") {
              router.replace("/garage");
            }
          }
        }).catch(() => {
          // If validation fails, clear auth on next attempt
          clearAuth().catch(() => {});
        });
        return;
      }
      
      // No cached user - try API with timeout
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 3000)
        );
        
        const me = await Promise.race([
          api.get("/api/auth/me"),
          timeoutPromise
        ]);
        
        if (me?.user) {
          await saveUser(me.user);
          setUser(me.user);
          
          // Redirect garage users to garage page
          if (me.user.role === "GARAGE") {
            router.replace("/garage");
            return;
          }
        }
      } catch (e) {
        // Timeout or error - clear auth and go to login
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
        style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* —— TOP BAR —— */}
        <View style={styles.header}>
          <View style={styles.appIdentity}>
            <View style={styles.logoCircle}>
              <Ionicons name="car-sport-outline" size={20} color={C.primary} />
            </View>
            <View>
              <Text style={styles.appTitle}>{t("home.title")}</Text>
              <Text style={styles.appSubtitle}>{t("home.subtitle")}</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowLanguagePicker(true)}
              style={styles.langChip}
              activeOpacity={0.85}
            >
              <Ionicons name="language-outline" size={18} color={C.text} />
              <Text style={styles.langChipText}>
                {languages[language]?.nativeName || language.toUpperCase()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/profile")}
              style={styles.profileBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="person-circle-outline" size={20} color={C.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onLogout}
              style={[styles.profileBtn, { backgroundColor: "rgba(249,115,115,0.12)", borderColor: "rgba(249,115,115,0.35)" }]}
              activeOpacity={0.85}
            >
              <Ionicons name="log-out-outline" size={20} color={C.red} />
            </TouchableOpacity>
          </View>
        </View>

        {/* —— MAIN CONTENT —— */}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Greeting + small pills */}
          <View style={styles.greetingBlock}>
            <View>
              <Text style={styles.greetingLabel}>{t("home.greeting")}</Text>
              <Text style={styles.greetingName}>{displayName}</Text>
            </View>

            <View style={styles.greetingPills}>
              <InfoPill icon="radio-outline" label={t("home.obdStatus")} value={t("home.ready")} color={C.green} />
              <InfoPill icon="document-text-outline" label={t("home.history")} value={t("home.available")} color={C.primary} />
            </View>
          </View>

          {/* Vehicle Overview Panel */}
          <View style={styles.sectionPanel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("home.vehicleOverview")}</Text>
              <View style={styles.sectionHeaderRight}>
                <View style={styles.statusDot} />
                <Text style={styles.sectionStatusText}>{t("home.awaitingConnection")}</Text>
              </View>
            </View>

            <View style={styles.overviewRow}>
              <View style={{ flex: 1 }}>
                <OverviewMetric
                  label={t("home.engineHealth")}
                  value="—"
                  hint={t("home.runScanToAnalyze")}
                />
                <View style={{ height: 10 }} />
                <OverviewMetric
                  label={t("home.activeDTCCodes")}
                  value="—"
                  hint={t("home.shownAfterFirstScan")}
                />
              </View>

              <View style={styles.overviewCard}>
                <Text style={styles.overviewCardTitle}>{t("home.quickScan")}</Text>
                <Text style={styles.overviewCardText}>
                  {t("home.quickScanDescription")}
                </Text>
                <TouchableOpacity
                  style={styles.overviewButton}
                  onPress={() => router.push("/diagnostics")}
                  activeOpacity={0.9}
                >
                  <Ionicons name="flash-outline" size={18} color="#fff" />
                  <Text style={styles.overviewButtonText}>{t("home.startScan")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Divider line */}
          <View style={styles.divider} />

          {/* PRIMARY ACTIONS */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>{t("home.primaryActions")}</Text>
              <Text style={styles.blockSubtitle}>
                {t("home.primaryActionsSubtitle")}
              </Text>
            </View>

            <View style={styles.primaryGrid}>
              <PrimaryCard
                title={t("home.diagnostics")}
                subtitle={t("home.diagnosticsSubtitle")}
                icon="construct-outline"
                accent={C.red}
                onPress={() => router.push("/diagnostics")}
              />
              <PrimaryCard
                title={t("home.liveData")}
                subtitle={t("home.liveDataSubtitle")}
                icon="pulse-outline"
                accent={C.green}
                onPress={() => router.push("/cardata")}
              />
              <PrimaryCard
                title={t("home.repairGuidance")}
                subtitle={t("home.repairGuidanceSubtitle")}
                icon="hammer-outline"
                accent={C.amber}
                onPress={() => router.push("/repairs")}
              />
            </View>
          </View>

          {/* SECONDARY TOOLS */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>{t("home.toolsReports")}</Text>
            </View>

            <View style={styles.secondaryList}>
              <SecondaryRow
                icon="person-outline"
                title={t("common.profile")}
                description={t("home.profileDescription")}
                onPress={() => router.push("/profile")}
              />
              <SecondaryRow
                icon="chatbubbles-outline"
                title={t("home.aiAssistant")}
                description={t("home.aiAssistantDescription")}
                onPress={() => router.push("/ai")}
              />
              <SecondaryRow
                icon="chatbubble-ellipses-outline"
                title={t("home.chatWithGarage")}
                description={t("home.chatWithGarageDescription")}
                onPress={() => router.push("/chat-list")}
              />
              <SecondaryRow
                icon="car-outline"
                title={t("home.myVehicles")}
                description={t("home.myVehiclesDescription")}
                onPress={() => router.push("/vehicles")}
              />
              <SecondaryRow
                icon="settings-outline"
                title={t("common.settings")}
                description={t("home.settingsDescription")}
                onPress={() => router.push("/settings")}
              />
            </View>
          </View>

          {/* HELP & TIPS */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>{t("home.bestPractices")}</Text>
            </View>

            <View style={styles.tipsPanel}>
              <TipLine text={t("home.tip1")} />
              <TipLine text={t("home.tip2")} />
              <TipLine text={t("home.tip3")} />
              <TipLine text={t("home.tip4")} />
            </View>
          </View>

          <Text style={styles.footer}>{t("home.footer")}</Text>
        </ScrollView>
      </SafeAreaView>

      {/* Global floating AI button */}
      <FloatingChatButton onPress={() => router.push("/ai")} />

      <LanguagePickerModal
        visible={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        onSelect={async (code) => {
          await changeLanguage(code);
          setShowLanguagePicker(false);
        }}
      />
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

