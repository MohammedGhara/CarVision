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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "../lib/api";
import { getUser, clearAuth, getToken } from "../lib/authStore";
import { showCustomAlert } from "../components/CustomAlert";
import { C } from "../styles/theme";
import { profileStyles as styles } from "../styles/profileStyles";

const STORAGE_KEY = "carvision.history.v1";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalScans: 0,
    dtcsCleared: 0,
    issuesDetected: 0,
    memberSince: null,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      
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
            console.log("✅ User data from database:", me.user);
            setUser(me.user);
            
            // Set memberSince from database
            if (me.user.createdAt) {
              setStats(prev => ({
                ...prev,
                memberSince: me.user.createdAt,
              }));
            }
          } else {
            console.log("⚠️ No user data in response");
          }
        } catch (e) {
          // Silently handle missing token or auth errors - use cached data instead
          if (e.message?.includes("token") || e.message?.includes("Missing")) {
            console.log("⚠️ No token available, using cached user data");
          } else {
            console.error("❌ Failed to fetch user from API:", e);
            // Only show alert for non-auth errors
            if (!e.message?.includes("401") && !e.message?.includes("Unauthorized")) {
              showCustomAlert("Error", "Failed to load profile data. Please try again.");
            }
          }
        }
      } else {
        console.log("⚠️ No token found, using cached user data only");
      }

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
      setLoading(false);
    }
  }

  async function handleLogout() {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await clearAuth();
            router.replace("/login");
          },
        },
      ]
    );
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
        <Text style={{ color: C.sub, marginTop: 12, fontSize: 16 }}>No user data found</Text>
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
          <Text style={{ color: "#fff", fontWeight: "700" }}>Go to Login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ color: C.sub, marginTop: 12 }}>Loading profile...</Text>
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
            <Text style={styles.headerTitle}>Profile</Text>
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
                  Member since {formatDate(user.createdAt)}
                </Text>
              </View>
            )}
          </View>

          {/* Statistics Grid */}
          <View style={styles.statsGrid}>
            <StatCard
              icon="scan-outline"
              label="Total Scans"
              value={stats.totalScans}
              color={C.blue}
            />
            <StatCard
              icon="bug-outline"
              label="Issues Found"
              value={stats.issuesDetected}
              color={C.amber}
            />
            <StatCard
              icon="checkmark-circle-outline"
              label="DTCs Cleared"
              value={stats.dtcsCleared}
              color={C.green}
            />
            <StatCard
              icon="time-outline"
              label="Active Sessions"
              value="1"
              color={C.primary}
            />
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsCard}>
              <ActionRow
                icon="create-outline"
                title="Edit Profile"
                subtitle="Update your name and information"
                onPress={() => showCustomAlert("Coming Soon", "Profile editing will be available soon!")}
              />
              <ActionRow
                icon="key-outline"
                title="Change Password"
                subtitle="Update your account password"
                onPress={() => router.push("/forgotpassword")}
              />
              <ActionRow
                icon="notifications-outline"
                title="Notifications"
                subtitle="Manage notification preferences"
                onPress={() => showCustomAlert("Coming Soon", "Notification settings coming soon!")}
              />
            </View>
          </View>

          {/* Account Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.infoCard}>
              <InfoRow icon="mail-outline" label="Email" value={user?.email || "—"} />
              <InfoRow icon="person-outline" label="Name" value={user?.name || "—"} />
              <InfoRow
                icon="shield-checkmark-outline"
                label="Account Type"
                value={user?.role || "CLIENT"}
              />
              <InfoRow
                icon="id-card-outline"
                label="User ID"
                value={user?.id ? user.id.substring(0, 8) + "..." : "—"}
              />
              {user?.createdAt && (
                <InfoRow
                  icon="calendar-outline"
                  label="Account Created"
                  value={formatFullDate(user.createdAt)}
                />
              )}
              {user?.updatedAt && (
                <InfoRow
                  icon="time-outline"
                  label="Last Updated"
                  value={formatFullDate(user.updatedAt)}
                />
              )}
            </View>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.preferencesCard}>
              <PreferenceRow
                icon="language-outline"
                title="Language"
                value="English"
                onPress={() => showCustomAlert("Coming Soon", "Language selection coming soon!")}
              />
              <PreferenceRow
                icon="color-palette-outline"
                title="Theme"
                value="Dark"
                onPress={() => showCustomAlert("Coming Soon", "Theme selection coming soon!")}
              />
              <PreferenceRow
                icon="speedometer-outline"
                title="Units"
                value="Metric"
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
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>© 2025 CarVision — Senior Project</Text>
        </ScrollView>
      </SafeAreaView>
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


