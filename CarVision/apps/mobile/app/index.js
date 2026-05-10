// apps/mobile/app/index.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import AppBackground from "../components/layout/AppBackground";
import FloatingChatButton from "../components/FloatingChatButton";
import LanguagePickerModal from "../components/LanguagePickerModal";

import { api } from "../lib/api";
import { getToken, getUser, saveUser, clearAuth } from "../lib/authStore";
import { getHttpBase } from "../lib/httpBase";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { HOME_SECTION_ICON, homeStyles as styles } from "../styles/homeStyles";

const HISTORY_STORAGE_KEY = "carvision.history.v1";

const HOME_SCREEN_SHELL = { flex: 1, paddingHorizontal: 0, paddingVertical: 0 };

function formatPrice(cents, t) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "—";
  return t("marketplace.priceDisplay", { amount: (n / 100).toFixed(2) });
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, language, languages, changeLanguage } = useLanguage();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [vehicleStats, setVehicleStats] = useState({
    engineHealth: null,
    activeDTCs: 0,
  });
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [productsBaseUrl, setProductsBaseUrl] = useState("");

  // Load vehicle stats from history
  useEffect(() => {
    loadVehicleStats();
  }, []);

  useEffect(() => {
    if (!user || user.role !== "CLIENT") return;
    let cancelled = false;
    (async () => {
      try {
        const base = await getHttpBase();
        const data = await api.get("/api/marketplace");
        const all = Array.isArray(data?.listings) ? data.listings : [];
        const featured = all.filter((p) => !!p?.isFeatured).slice(0, 6);
        if (!cancelled) {
          setProductsBaseUrl(base);
          setFeaturedProducts(featured);
        }
      } catch (e) {
        if (!cancelled) {
          setFeaturedProducts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function loadVehicleStats() {
    try {
      const saved = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const history = JSON.parse(saved);
        if (history && history.length > 0) {
          // Get the most recent entry
          const latest = history[0];
          if (latest?.snapshot) {
            const snapshot = latest.snapshot;
            
            // Calculate active DTCs
            const dtcs = snapshot.dtcs || [];
            const pending = snapshot.pending || [];
            const totalDTCs = dtcs.length + pending.length;
            
            // Calculate engine health (percentage based on DTCs)
            // Less DTCs = better health
            let health = "—";
            if (snapshot.monitors) {
              const milOn = snapshot.monitors.milOn;
              if (!milOn && totalDTCs === 0) {
                health = "Good";
              } else if (!milOn && totalDTCs <= 2) {
                health = "Fair";
              } else if (milOn || totalDTCs > 2) {
                health = "Poor";
              }
            }
            
            setVehicleStats({
              engineHealth: health,
              activeDTCs: totalDTCs,
            });
          }
        }
      }
    } catch (e) {
      console.log("Failed to load vehicle stats:", e);
    }
  }

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

  function pricingView(item) {
    const price = Number(item?.priceCents);
    const compareAt = Number(item?.compareAtPriceCents);
    const onSale = Number.isFinite(compareAt) && compareAt > price;
    return { onSale, compareAt };
  }

  function previewImageUri(imageUrl) {
    if (!imageUrl || !productsBaseUrl) return null;
    const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    return `${productsBaseUrl}${path}`;
  }

  if (checking) {
    return (
      <AppBackground scrollable={false} contentContainerStyle={HOME_SCREEN_SHELL}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ color: C.sub, marginTop: 10 }}>Loading…</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground scrollable={false} contentContainerStyle={HOME_SCREEN_SHELL}>
      <StatusBar barStyle="light-content" />

      {/* —— TOP BAR —— */}
      <View style={styles.header}>
        <View style={styles.appIdentity}>
          <View style={styles.logoCircle}>
            <Ionicons name="car-sport-outline" size={22} color={C.primary} />
          </View>
          <View style={styles.appTitleWrap}>
            <Text style={styles.appTitle}>{t("home.title")}</Text>
            <Text style={styles.appSubtitle}>{t("home.subtitle")}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            style={styles.profileBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="person-circle-outline" size={21} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onLogout}
            style={[styles.profileBtn, styles.logoutBtn]}
            activeOpacity={0.85}
          >
            <Ionicons name="log-out-outline" size={21} color={C.red} />
          </TouchableOpacity>
        </View>
      </View>

      {/* —— MAIN CONTENT —— */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
          <LinearGradient
            colors={["rgba(99,102,241,0.26)", "rgba(15,23,42,0.98)", "rgba(14,165,233,0.12)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroPanel}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroTopRow}>
              <View style={styles.heroGreeting}>
                <Text style={styles.greetingLabel}>{t("home.greeting")}</Text>
                <Text style={styles.greetingName} numberOfLines={1}>{displayName}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowLanguagePicker(true)}
                style={styles.langChip}
                activeOpacity={0.85}
              >
                <Ionicons name="language-outline" size={17} color={C.text} />
                <Text style={styles.langChipText} numberOfLines={1}>
                  {languages[language]?.nativeName || language.toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroStatusRow}>
              <InfoPill icon="radio-outline" label={t("home.obdStatus")} value={t("home.ready")} color={C.green} />
              <InfoPill icon="document-text-outline" label={t("home.history")} value={t("home.available")} color={C.primary} />
            </View>

            <View style={styles.heroSectionHeader}>
              <Text style={styles.sectionTitle}>{t("home.vehicleOverview")}</Text>
              <View style={styles.connectionChip}>
                <View style={styles.statusDot} />
                <Text style={styles.sectionStatusText}>{t("home.awaitingConnection")}</Text>
              </View>
            </View>

            <View style={styles.overviewMetricsGrid}>
              <View style={styles.metricSlot}>
                <OverviewMetric
                  label={t("home.engineHealth")}
                  value={vehicleStats.engineHealth || "—"}
                  hint={vehicleStats.engineHealth ? "" : t("home.runScanToAnalyze")}
                />
              </View>
              <View style={styles.metricSlot}>
                <OverviewMetric
                  label={t("home.activeDTCCodes")}
                  value={vehicleStats.activeDTCs > 0 ? vehicleStats.activeDTCs.toString() : "—"}
                  hint={vehicleStats.activeDTCs > 0 ? "" : t("home.shownAfterFirstScan")}
                />
              </View>
            </View>

            <View style={styles.overviewCard}>
              <View style={styles.overviewCardCopy}>
                <Text style={styles.overviewCardTitle}>{t("home.quickScan")}</Text>
                <Text style={styles.overviewCardText}>
                  {t("home.quickScanDescription")}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.overviewButton}
                onPress={() => router.push("/diagnostics")}
                activeOpacity={0.9}
              >
                <Ionicons name="flash-outline" size={18} color="#fff" />
                <Text style={styles.overviewButtonText}>{t("home.startScan")}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

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

          {/* TOOLS — grouped by topic */}
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <Text style={styles.blockTitle}>{t("home.toolsReports")}</Text>
              <Text style={styles.blockSubtitle}>{t("home.toolsReportsSubtitle")}</Text>
            </View>

            <ToolSection label={t("home.toolsSectionSafety")}>
              <SecondaryRow
                icon="shield-checkmark-outline"
                iconColor={HOME_SECTION_ICON.safety}
                title={t("home.safetyTitle")}
                description={t("home.safetyDescription")}
                onPress={() => router.push("/safety-emergency")}
                isLast
              />
            </ToolSection>

            <ToolSection label={t("home.toolsSectionCommunity")}>
              <SecondaryRow
                icon="chatbubbles-outline"
                iconColor={HOME_SECTION_ICON.community}
                title={t("home.aiAssistant")}
                description={t("home.aiAssistantDescription")}
                onPress={() => router.push("/ai")}
              />
              <SecondaryRow
                icon="people-outline"
                iconColor={HOME_SECTION_ICON.community}
                title={t("home.communityForum")}
                description={t("home.communityForumDescription")}
                onPress={() => router.push("/community-forum")}
                isLast
              />
            </ToolSection>

            <ToolSection label={t("home.toolsSectionGarages")}>
              <SecondaryRow
                icon="location-outline"
                iconColor={HOME_SECTION_ICON.garages}
                title={t("nearestGarages.title")}
                description={t("nearestGarages.homeDescription")}
                onPress={() => router.push("/nearest-garages")}
              />
              <SecondaryRow
                icon="map-outline"
                iconColor={HOME_SECTION_ICON.garages}
                title={t("mapForGarages.openButton")}
                description={t("mapForGarages.openButtonDesc")}
                onPress={() => router.push("/map-for-garages")}
              />
              <SecondaryRow
                icon="storefront-outline"
                iconColor={HOME_SECTION_ICON.garages}
                title={t("marketplace.title")}
                description={t("marketplace.homeDescription")}
                onPress={() => router.push("/marketplace")}
              />
              <SecondaryRow
                icon="chatbubble-ellipses-outline"
                iconColor={HOME_SECTION_ICON.garages}
                title={t("home.chatWithGarage")}
                description={t("home.chatWithGarageDescription")}
                onPress={() => router.push("/chat-list")}
                isLast
              />
            </ToolSection>

            <ToolSection label={t("home.toolsSectionAccount")}>
              <SecondaryRow
                icon="person-outline"
                iconColor={HOME_SECTION_ICON.account}
                title={t("common.profile")}
                description={t("home.profileDescription")}
                onPress={() => router.push("/profile")}
              />
              <SecondaryRow
                icon="car-outline"
                iconColor={HOME_SECTION_ICON.account}
                title={t("home.myVehicles")}
                description={t("home.myVehiclesDescription")}
                onPress={() => router.push("/vehicles")}
              />
              <SecondaryRow
                icon="settings-outline"
                iconColor={HOME_SECTION_ICON.account}
                title={t("common.settings")}
                description={t("home.settingsDescription")}
                onPress={() => router.push("/settings")}
                isLast
              />
            </ToolSection>
          </View>

          {featuredProducts.length > 0 ? (
            <View style={styles.block}>
              <View style={styles.blockHeaderRow}>
                <View>
                  <Text style={styles.blockTitle}>{t("home.productsPreviewTitle")}</Text>
                  <Text style={styles.blockSubtitle}>{t("home.productsPreviewSubtitle")}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/marketplace")} activeOpacity={0.85}>
                  <Text style={styles.viewAllLink}>{t("home.productsViewAll")}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.productsPreviewRow}
              >
                {featuredProducts.map((item) => {
                  const price = pricingView(item);
                  const uri = previewImageUri(item.imageUrl);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.productPreviewCard}
                      activeOpacity={0.92}
                      onPress={() =>
                        router.push({
                          pathname: "/marketplace-detail",
                          params: { id: item.id },
                        })
                      }
                    >
                      {uri ? <Image source={{ uri }} style={styles.productPreviewImage} resizeMode="cover" /> : null}
                      <View style={styles.productPreviewBadges}>
                        {item.isFeatured ? (
                          <View style={styles.productFeaturedBadge}>
                            <Text style={styles.productFeaturedBadgeText}>{t("marketplace.featuredBadge")}</Text>
                          </View>
                        ) : null}
                        {price.onSale ? (
                          <View style={styles.productSaleBadge}>
                            <Text style={styles.productSaleBadgeText}>{t("marketplace.saleBadge")}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.productPreviewTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <View style={styles.productPreviewPriceRow}>
                        <Text style={styles.productPreviewPrice}>{formatPrice(item.priceCents, t)}</Text>
                        {price.onSale ? (
                          <Text style={styles.productPreviewComparePrice}>
                            {formatPrice(price.compareAt, t)}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

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

      {/* Global floating AI button */}
      <FloatingChatButton onPress={() => router.push("/ai")} showTooltip={false} />

      <LanguagePickerModal
        visible={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        onSelect={async (code) => {
          await changeLanguage(code);
          setShowLanguagePicker(false);
        }}
      />
    </AppBackground>
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

function primaryAccentBorder(accent) {
  if (accent === C.green) return "rgba(34,197,94,0.32)";
  if (accent === C.amber) return "rgba(250,204,21,0.34)";
  return "rgba(249,115,115,0.34)";
}

function PrimaryCard({ title, subtitle, icon, accent, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.primaryCard, { borderColor: primaryAccentBorder(accent) }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.primaryIconWrap, { borderColor: primaryAccentBorder(accent) }]}>
        <Ionicons name={icon} size={21} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.primaryTitle}>{title}</Text>
        <Text style={styles.primarySubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.sub} />
    </TouchableOpacity>
  );
}

function ToolSection({ label, children }) {
  return (
    <View style={styles.toolSection}>
      <Text style={styles.toolSectionLabel}>{label}</Text>
      <View style={styles.toolSectionCard}>{children}</View>
    </View>
  );
}

function SecondaryRow({ icon, iconColor, title, description, onPress, isLast }) {
  const tint = iconColor ?? C.primary;
  return (
    <TouchableOpacity
      style={[styles.secondaryRow, isLast && styles.secondaryRowLast]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.secondaryIconWrap}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.secondaryTitle}>{title}</Text>
        <Text style={styles.secondaryDesc}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.sub} />
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

