// apps/mobile/app/profile.js
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "../lib/api";
import { getUser, clearAuth, getToken, saveUser } from "../lib/authStore";
import { showCustomAlert } from "../components/CustomAlert";
import { useLanguage } from "../context/LanguageContext";
import LanguagePickerModal from "../components/LanguagePickerModal";
import { C } from "../styles/theme";
import { profileStyles as styles } from "../styles/profileStyles";

const STORAGE_KEY = "carvision.history.v1";

export default function ProfileScreen() {
  const router = useRouter();
  const { t, language, languages, changeLanguage } = useLanguage();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [stats, setStats] = useState({
    totalScans: 0,
    dtcsCleared: 0,
    issuesDetected: 0,
    memberSince: null,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      
      // Load user from cache first (instant display)
      const cachedUser = await getUser();
      if (cachedUser) {
        setUser(cachedUser);
        // Set memberSince from cached user if available
        if (cachedUser.createdAt) {
          setStats(prev => ({
            ...prev,
            memberSince: cachedUser.createdAt,
          }));
        }
        setLoading(false);
      }

      // Fetch fresh user data from database (only if we have a token)
      const token = await getToken();
      if (token) {
        try {
          const me = await api.get("/api/auth/me");
          if (me?.user) {
            setUser(me.user);
            
            // Set memberSince from database
            if (me.user.createdAt) {
              setStats(prev => ({
                ...prev,
                memberSince: me.user.createdAt,
              }));
            }
          }
        } catch (e) {
          // Silently handle missing token or auth errors - use cached data instead
          if (!e.message?.includes("token") && !e.message?.includes("Missing") && !e.message?.includes("401") && !e.message?.includes("Unauthorized")) {
            console.error("❌ Failed to fetch user from API:", e);
            showCustomAlert("Error", "Failed to load profile data. Please try again.");
          }
        }
      }
      // If no token, silently use cached data (no warning needed)

      // Calculate statistics from local history (AsyncStorage)
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const history = JSON.parse(saved);
          const totalIssues = history.length;
          const uniqueDTCs = new Set();
          let dtcsClearedCount = 0;
          
          history.forEach((item) => {
            if (item.snapshot?.dtcs) {
              item.snapshot.dtcs.forEach((dtc) => uniqueDTCs.add(dtc));
            }
            // Count cleared DTCs (if we track this in history)
            if (item.title?.toLowerCase().includes("clear") || item.detail?.toLowerCase().includes("clear")) {
              dtcsClearedCount++;
            }
          });

          setStats(prev => ({
            ...prev,
            totalScans: totalIssues,
            dtcsCleared: dtcsClearedCount,
            issuesDetected: totalIssues,
          }));
        } else {
          console.log("No history found in AsyncStorage");
        }
      } catch (e) {
        console.log("Failed to load stats from history:", e);
      }
    } catch (e) {
      console.error("Profile load error:", e);
      showCustomAlert("Error", "Failed to load profile. Please try again.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function handleLogout() {
    Alert.alert(
      t("profile.logout"),
      t("profile.logoutConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.logout"),
          style: "destructive",
          onPress: async () => {
            await clearAuth();
            router.replace("/login");
          },
        },
      ]
    );
  }

  async function handleLanguageSelect(langCode) {
    const success = await changeLanguage(langCode);
    if (success) {
      setShowLanguageModal(false);
      showCustomAlert(t("common.success"), t("language.languageChanged"));
    }
  }

  async function handleSaveProfile() {
    const trimmedName = (editName || "").trim();
    const trimmedEmail = (editEmail || "").trim();
    if (!trimmedName) {
      showCustomAlert(t("common.error"), t("profile.nameRequired"));
      return;
    }
    if (!trimmedEmail) {
      showCustomAlert(t("common.error"), t("profile.emailRequired"));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showCustomAlert(t("common.error"), t("profile.invalidEmail"));
      return;
    }
    const payload = {};
    if (!user || trimmedName !== user.name) payload.name = trimmedName;
    if (!user || trimmedEmail.toLowerCase() !== (user.email || "").toLowerCase()) {
      payload.email = trimmedEmail.toLowerCase();
    }
    if (Object.keys(payload).length === 0) {
      showCustomAlert(t("common.error"), t("profile.noChanges"));
      return;
    }
    setSavingProfile(true);
    try {
      const result = await api.put("/api/auth/update-profile", payload);
      if (result?.user) {
        setUser(result.user);
        await saveUser(result.user);
        await loadProfile(false);
        showCustomAlert(t("common.success"), t("profile.updateSuccess"));
        setShowEditModal(false);
      } else {
        throw new Error(t("profile.updateError"));
      }
    } catch (e) {
      console.error("Profile update failed:", e);
      showCustomAlert(t("common.error"), e.message || t("profile.updateError"));
    } finally {
      setSavingProfile(false);
    }
  }

  function getLanguageName() {
    return languages[language]?.nativeName || languages[language]?.name || "English";
  }

  function getLanguageName() {
    return languages[language]?.nativeName || languages[language]?.name || "English";
  }

  function getInitials(name, email) {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "U";
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "—";
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return "—";
    }
  }

  function formatFullDate(dateString) {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "—";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return "—";
    }
  }

  const displayName = useMemo(
    () => user?.name || user?.email?.split("@")[0] || "User",
    [user]
  );

  const roleBadgeColor = user?.role === "GARAGE" ? C.amber : C.primary;

  // If no user data after loading, redirect to login
  if (!loading && !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg1, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name="person-outline" size={48} color={C.sub} />
        <Text style={{ color: C.sub, marginTop: 12, fontSize: 16 }}>{t("profile.noUserData")}</Text>
        <TouchableOpacity
          style={{
            marginTop: 20,
            paddingHorizontal: 20,
            paddingVertical: 12,
            backgroundColor: C.primary,
            borderRadius: 12,
          }}
          onPress={() => router.replace("/login")}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>{t("profile.goToLogin")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ color: C.sub, marginTop: 12 }}>{t("profile.loadingProfile")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient colors={[C.bg1, C.bg2]} style={styles.bg}>
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1502877828070-33b167ad6860?q=80&w=1600&auto=format&fit=crop",
        }}
        imageStyle={{ opacity: 0.12 }}
        style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>{t("profile.title")}</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={loadProfile}
              style={styles.refreshBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={20} color={C.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              style={styles.settingsBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={20} color={C.text} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={[C.primary, "#8B5CF6"]}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>
                  {getInitials(user?.name, user?.email)}
                </Text>
              </LinearGradient>
              <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor }]}>
                <Text style={styles.roleText}>{user?.role || "CLIENT"}</Text>
              </View>
            </View>

            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{user?.email || ""}</Text>

            {user?.createdAt && (
              <View style={styles.memberSince}>
                <Ionicons name="calendar-outline" size={14} color={C.sub} />
                <Text style={styles.memberSinceText}>
                  {t("profile.memberSince")} {formatDate(user.createdAt)}
                </Text>
              </View>
            )}
          </View>

          {/* Statistics Grid */}
          <View style={styles.statsGrid}>
            <StatCard
              icon="scan-outline"
              label={t("profile.totalScans")}
              value={stats.totalScans}
              color={C.blue}
            />
            <StatCard
              icon="bug-outline"
              label={t("profile.issuesDetected")}
              value={stats.issuesDetected}
              color={C.amber}
            />
            <StatCard
              icon="checkmark-circle-outline"
              label={t("profile.dtcsCleared")}
              value={stats.dtcsCleared}
              color={C.green}
            />
            <StatCard
              icon="time-outline"
              label={t("profile.memberSince")}
              value={stats.memberSince ? formatDate(stats.memberSince) : "—"}
              color={C.primary}
            />
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("profile.quickActions")}</Text>
            <View style={styles.actionsCard}>
              <ActionRow
                icon="create-outline"
                title={t("profile.editProfile")}
                subtitle={t("profile.editProfileSubtitle")}
                onPress={() => {
                  setEditName(user?.name || "");
                  setEditEmail(user?.email || "");
                  setShowEditModal(true);
                }}
              />
              <ActionRow
                icon="key-outline"
                title={t("profile.resetPassword")}
                subtitle={t("profile.resetPasswordSubtitle")}
                onPress={() => router.push("/forgotpassword")}
              />
              <ActionRow
                icon="notifications-outline"
                title={t("profile.notifications")}
                subtitle={t("profile.notificationsSubtitle")}
                onPress={() => showCustomAlert("Coming Soon", "Notification settings coming soon!")}
              />
            </View>
          </View>

          {/* Account Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("profile.accountInformation")}</Text>
            <View style={styles.infoCard}>
              <InfoRow icon="mail-outline" label={t("profile.email")} value={user?.email || "—"} />
              <InfoRow icon="person-outline" label={t("profile.name")} value={user?.name || "—"} />
              <InfoRow
                icon="shield-checkmark-outline"
                label={t("profile.accountType")}
                value={user?.role || "CLIENT"}
              />
              <InfoRow
                icon="id-card-outline"
                label={t("profile.userId")}
                value={user?.id ? user.id.substring(0, 8) + "..." : "—"}
              />
              {user?.createdAt && (
                <InfoRow
                  icon="calendar-outline"
                  label={t("profile.accountCreated")}
                  value={formatFullDate(user.createdAt)}
                />
              )}
              {user?.updatedAt && (
                <InfoRow
                  icon="time-outline"
                  label={t("profile.lastUpdated")}
                  value={formatFullDate(user.updatedAt)}
                />
              )}
            </View>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("profile.preferences")}</Text>
            <View style={styles.preferencesCard}>
              <PreferenceRow
                icon="language-outline"
                title={t("profile.language")}
                value={getLanguageName()}
                onPress={() => setShowLanguageModal(true)}
              />
              <PreferenceRow
                icon="color-palette-outline"
                title={t("profile.theme")}
                value={t("profile.dark")}
                onPress={() => showCustomAlert("Coming Soon", "Theme selection coming soon!")}
              />
              <PreferenceRow
                icon="speedometer-outline"
                title={t("profile.units")}
                value={t("profile.metric")}
                onPress={() => showCustomAlert("Coming Soon", "Unit preferences coming soon!")}
              />
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={C.red} />
            <Text style={styles.logoutText}>{t("profile.logout")}</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>{t("home.footer")}</Text>
        </ScrollView>
      </SafeAreaView>

      <LanguagePickerModal
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        onSelect={async (code) => {
          await handleLanguageSelect(code);
        }}
      />

      <EditProfileModal
        visible={showEditModal}
        value={editName}
        emailValue={editEmail}
        onChangeName={setEditName}
        onChangeEmail={setEditEmail}
        onCancel={() => setShowEditModal(false)}
        onSave={handleSaveProfile}
        saving={savingProfile}
        t={t}
      />
    </LinearGradient>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, color }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Action Row Component
function ActionRow({ icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.actionLeft}>
        <View style={styles.actionIconWrap}>
          <Ionicons name={icon} size={20} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.sub} />
    </TouchableOpacity>
  );
}

// Info Row Component
function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={18} color={C.sub} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// Preference Row Component
function PreferenceRow({ icon, title, value, onPress }) {
  return (
    <TouchableOpacity style={styles.preferenceRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.preferenceLeft}>
        <Ionicons name={icon} size={18} color={C.primary} />
        <Text style={styles.preferenceTitle}>{title}</Text>
      </View>
      <View style={styles.preferenceRight}>
        <Text style={styles.preferenceValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={16} color={C.sub} />
      </View>
    </TouchableOpacity>
  );
}

function EditProfileModal({ visible, value, emailValue, onChangeName, onChangeEmail, onCancel, onSave, saving, t }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t("profile.editProfileTitle")}</Text>
          <Text style={styles.modalSubtitle}>{t("profile.editProfileDescription")}</Text>
          <TextInput
            style={styles.modalInput}
            value={value}
            onChangeText={onChangeName}
            placeholder={t("profile.namePlaceholder")}
            placeholderTextColor="rgba(148,163,184,0.8)"
          />
          <TextInput
            style={[styles.modalInput, { marginTop: 12 }]}
            value={emailValue}
            onChangeText={onChangeEmail}
            placeholder={t("profile.emailPlaceholder")}
            placeholderTextColor="rgba(148,163,184,0.8)"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonGhost]}
              onPress={onCancel}
              disabled={saving}
            >
              <Text style={styles.modalButtonGhostText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>{t("profile.saveChanges")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


