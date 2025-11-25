// apps/mobile/app/garage.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { api } from "../lib/api";
import { getUser, clearAuth, getToken } from "../lib/authStore";
import { showCustomAlert } from "../components/CustomAlert";
import { useLanguage } from "../context/LanguageContext";
import LanguagePickerModal from "../components/LanguagePickerModal";
import { C } from "../styles/theme";
import { garageStyles as styles } from "../styles/garageStyles";

export default function GarageScreen() {
  const router = useRouter();
  const { t, language, languages, changeLanguage } = useLanguage();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      setLoading(true);
      
      // Load user from cache first (instant display)
      const cachedUser = await getUser();
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
        
        // If user is not a garage, redirect to home
        if (cachedUser.role !== "GARAGE") {
          router.replace("/");
          return;
        }
      }

      // Fetch fresh user data from database
      const token = await getToken();
      if (token) {
        try {
          const me = await api.get("/api/auth/me");
          if (me?.user) {
            setUser(me.user);
            
            // If user is not a garage, redirect to home
            if (me.user.role !== "GARAGE") {
              router.replace("/");
              return;
            }
          }
        } catch (e) {
          console.error("Failed to fetch user:", e);
        }
      }
    } catch (e) {
      console.error("Garage load error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    await clearAuth();
    router.replace("/login");
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ color: C.sub, marginTop: 12 }}>{t("common.loading")}</Text>
      </SafeAreaView>
    );
  }

  if (!user || user.role !== "GARAGE") {
    return null; // Will redirect
  }

  return (
    <LinearGradient colors={[C.bg1, C.bg2]} style={styles.bg}>
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=1600&auto=format&fit=crop",
        }}
        imageStyle={{ opacity: 0.12 }}
        style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.appIdentity}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons name="garage" size={20} color={C.amber} />
            </View>
            <View>
              <Text style={styles.appTitle}>{t("garage.title")}</Text>
              <Text style={styles.appSubtitle}>{t("garage.subtitle")}</Text>
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

        {/* Main Content */}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome Section */}
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>
              {t("garage.welcome")}, {user?.name || user?.email?.split("@")[0] || "Garage Owner"}
            </Text>
            <Text style={styles.welcomeText}>{t("garage.welcomeMessage")}</Text>
          </View>

          {/* Quick Stats */}
          <View style={styles.statsGrid}>
            <StatCard
              icon="car-multiple"
              label={t("garage.totalVehicles")}
              value="—"
              color={C.blue}
            />
            <StatCard
              icon="wrench"
              label={t("garage.activeRepairs")}
              value="—"
              color={C.amber}
            />
            <StatCard
              icon="check-circle"
              label={t("garage.completed")}
              value="—"
              color={C.green}
            />
            <StatCard
              icon="account-group"
              label={t("garage.clients")}
              value="—"
              color={C.primary}
            />
          </View>

          {/* Main Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("garage.mainActions")}</Text>
            <View style={styles.actionsList}>
              <ActionCard
                icon="car-wrench"
                title={t("garage.manageVehicles")}
                subtitle={t("garage.manageVehiclesDesc")}
                onPress={() => router.push("/vehicles")}
                accent={C.primary}
              />
              <ActionCard
                icon="clipboard-list"
                title={t("garage.viewOrders")}
                subtitle={t("garage.viewOrdersDesc")}
                onPress={() => showCustomAlert(t("common.comingSoon"), t("garage.comingSoonMessage"))}
                accent={C.blue}
              />
              <ActionCard
                icon="account-multiple"
                title={t("garage.manageClients")}
                subtitle={t("garage.manageClientsDesc")}
                onPress={() => router.push("/chat-list")}
                accent={C.green}
              />
              <ActionCard
                icon="chart-line"
                title={t("garage.analytics")}
                subtitle={t("garage.analyticsDesc")}
                onPress={() => showCustomAlert(t("common.comingSoon"), t("garage.comingSoonMessage"))}
                accent={C.amber}
              />
            </View>
          </View>

          {/* Tools Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("garage.tools")}</Text>
            <View style={styles.toolsList}>
              <ToolRow
                icon="diagnostics"
                title={t("garage.diagnostics")}
                description={t("garage.diagnosticsDesc")}
                onPress={() => router.push("/diagnostics")}
              />
              <ToolRow
                icon="chart-timeline-variant"
                title={t("garage.liveData")}
                description={t("garage.liveDataDesc")}
                onPress={() => router.push("/cardata")}
              />
              <ToolRow
                icon="robot"
                title={t("garage.aiAssistant")}
                description={t("garage.aiAssistantDesc")}
                onPress={() => router.push("/ai")}
              />
            </View>
          </View>

          <Text style={styles.footer}>{t("home.footer")}</Text>
        </ScrollView>
      </SafeAreaView>

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

function StatCard({ icon, label, value, color }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({ icon, title, subtitle, onPress, accent }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.actionIconWrap, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
        <MaterialCommunityIcons name={icon} size={24} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.sub} />
    </TouchableOpacity>
  );
}

function ToolRow({ icon, title, description, onPress }) {
  return (
    <TouchableOpacity style={styles.toolRow} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.toolIconWrap}>
        <MaterialCommunityIcons name={icon} size={20} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toolTitle}>{title}</Text>
        <Text style={styles.toolDesc}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.sub} />
    </TouchableOpacity>
  );
}

