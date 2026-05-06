// apps/mobile/app/map-for-garages.js — Client: Map For Garages (premium layout)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";

import AppBackground from "../components/layout/AppBackground";
import { api } from "../lib/api";
import { getUser } from "../lib/authStore";
import { showCustomAlert } from "../components/CustomAlert";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { mapForGaragesStyles as styles, MAP_HEIGHT } from "../styles/mapForGaragesStyles";
import {
  SERVICE_FILTER_CHIPS,
  garageMatchesSearchQuery,
  garageMatchesServiceChip,
  formatDistanceKm,
} from "../lib/garageMapUtils";
import { openWazeWithGoogleFallback } from "../lib/wazeGoogleNavigation";

const MAP_LIMIT = 50;

let MapView = null;
let Marker = null;
if (Platform.OS !== "web") {
  try {
    const M = require("react-native-maps");
    MapView = M.default;
    Marker = M.Marker;
  } catch {
    MapView = null;
    Marker = null;
  }
}

function MapScreenHeader({ insetTop, title, subtitle, eyebrow, onBack }) {
  return (
    <View style={[styles.headerOuter, { paddingTop: insetTop + 8 }]}>
      <LinearGradient
        colors={["rgba(99,102,241,0.14)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.headerGradientBg}
      />
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          {eyebrow ? (
            <Text style={styles.headerEyebrow} numberOfLines={1}>
              {eyebrow}
            </Text>
          ) : null}
          <Text style={styles.headerTitle} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.headerSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function DetailInfoRow({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconCircle}>
        <Ionicons name={icon} size={17} color={C.primary} />
      </View>
      <View style={styles.detailRowText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function MapForGaragesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  /** After user taps “my location”, skip auto fit-to-all-markers so the camera stays on them */
  const skipNextFitToMarkersRef = useRef(false);

  const [phase, setPhase] = useState("init");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [userCoord, setUserCoord] = useState(null);
  const [rawGarages, setRawGarages] = useState([]);
  const [search, setSearch] = useState("");
  const [chipId, setChipId] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [mapFullscreen, setMapFullscreen] = useState(false);

  const garages = useMemo(() => {
    let list = rawGarages.map((g) => ({
      ...g,
      services: Array.isArray(g.services) ? g.services : [],
    }));
    list = list.filter((g) => garageMatchesServiceChip(g, chipId));
    list = list.filter((g) => garageMatchesSearchQuery(g, search));
    return list;
  }, [rawGarages, chipId, search]);

  const selectedGarage = useMemo(
    () => garages.find((g) => g.id === selectedId) || null,
    [garages, selectedId]
  );

  useEffect(() => {
    if (!garages.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && !garages.some((g) => g.id === selectedId)) {
      setSelectedId(garages[0]?.id ?? null);
    }
  }, [garages, selectedId]);

  const region = useMemo(() => {
    const lat = userCoord?.latitude ?? 32.0853;
    const lng = userCoord?.longitude ?? 34.7818;
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    };
  }, [userCoord]);

  const loadGarages = useCallback(async (lat, lng) => {
    const path = `/api/garages/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&limit=${MAP_LIMIT}`;
    const data = await api.get(path);
    const list = Array.isArray(data?.garages) ? data.garages : [];
    setRawGarages(list);
    setSelectedId((prev) => {
      if (prev && list.some((x) => x.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const user = await getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      if (user.role === "GARAGE") {
        router.replace("/garage");
        return;
      }

      const existing = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      if (existing.status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== "granted") {
          setPermissionDenied(true);
          setPhase("no_location");
          return;
        }
      }

      try {
        setPhase("loading_location");
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (cancelled) return;
        setUserCoord({ latitude: lat, longitude: lng });
        setPhase("loading_garages");
        await loadGarages(lat, lng);
        if (cancelled) return;
        setPhase("ready");
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e?.message || String(e));
          setPhase("error");
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router, loadGarages]);

  useEffect(() => {
    if (phase !== "ready" || !MapView) return;
    if (skipNextFitToMarkersRef.current) {
      skipNextFitToMarkersRef.current = false;
      return;
    }
    if (garages.length === 0) return;
    const coords = garages
      .filter((g) => g.latitude != null && g.longitude != null)
      .map((g) => ({ latitude: g.latitude, longitude: g.longitude }));
    if (userCoord) {
      coords.push({ latitude: userCoord.latitude, longitude: userCoord.longitude });
    }
    if (coords.length === 0) return;
    const bottomPad = mapFullscreen ? 100 : 120;
    const runFit = () => {
      try {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: {
            top: mapFullscreen ? 56 : 80,
            right: 40,
            bottom: bottomPad,
            left: 40,
          },
          animated: true,
        });
      } catch {
        /* ignore */
      }
    };
    const delay = mapFullscreen ? 420 : 0;
    const id = setTimeout(runFit, delay);
    return () => clearTimeout(id);
  }, [phase, garages, userCoord, mapFullscreen]);

  const onRecenterOnMe = useCallback(async () => {
    if (!MapView || Platform.OS === "web") return;
    try {
      skipNextFitToMarkersRef.current = true;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setUserCoord({ latitude: lat, longitude: lng });
      await loadGarages(lat, lng);
      skipNextFitToMarkersRef.current = true;
      requestAnimationFrame(() => {
        try {
          mapRef.current?.animateToRegion(
            {
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.06,
              longitudeDelta: 0.06,
            },
            420
          );
        } catch {
          /* ignore */
        }
      });
    } catch (e) {
      skipNextFitToMarkersRef.current = false;
      showCustomAlert(t("common.error"), e?.message || String(e));
    }
  }, [MapView, loadGarages, t]);

  const onRetryPermission = useCallback(async () => {
    setPermissionDenied(false);
    setPhase("init");
    const req = await Location.requestForegroundPermissionsAsync();
    if (req.status !== "granted") {
      setPermissionDenied(true);
      setPhase("no_location");
      return;
    }
    try {
      setPhase("loading_location");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setUserCoord({ latitude: lat, longitude: lng });
      setPhase("loading_garages");
      await loadGarages(lat, lng);
      setPhase("ready");
    } catch (e) {
      setErrorMessage(e?.message || String(e));
      setPhase("error");
    }
  }, [loadGarages]);

  const onChat = useCallback(
    (g) => {
      if (!g?.id) return;
      router.push({
        pathname: "/chat",
        params: {
          userId: g.id,
          userName: g.name || "",
          initialDraft: t("mapForGarages.chatDraft"),
        },
      });
    },
    [router, t]
  );

  const onWaze = useCallback(
    async (g) => {
      if (g?.latitude == null || g?.longitude == null) return;
      const ok = await openWazeWithGoogleFallback(g.latitude, g.longitude);
      if (!ok) {
        showCustomAlert(t("common.error"), t("mapForGarages.navigationFailed"));
      }
    },
    [t]
  );

  const chipLabel = useCallback(
    (id) => {
      const key = `mapForGarages.chip_${id}`;
      const translated = t(key);
      if (translated && translated !== key) return translated;
      return id;
    },
    [t]
  );

  const renderMapBlock = (fullscreen = false) => {
    if (Platform.OS === "web" || !MapView || !Marker) {
      return (
        <View style={[styles.webFallback, fullscreen && { flex: 1, minHeight: 280 }]}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="phone-portrait-outline" size={28} color={C.primary} />
          </View>
          <Text style={styles.webFallbackText}>{t("mapForGarages.webUnsupported")}</Text>
        </View>
      );
    }

    return (
      <LinearGradient
        colors={["rgba(99,102,241,0.45)", "rgba(34,197,94,0.18)", "rgba(59,130,246,0.15)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mapGradientBorder, fullscreen && styles.mapGradientBorderFullscreen]}
      >
        <View style={[styles.mapInner, fullscreen && styles.mapInnerFullscreen]}>
          <View style={[styles.mapWrap, fullscreen ? styles.mapWrapFullscreen : { height: MAP_HEIGHT }]}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={region}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {garages.map((g) => {
                if (g.latitude == null || g.longitude == null) return null;
                const sel = g.id === selectedId;
                return (
                  <Marker
                    key={g.id}
                    coordinate={{ latitude: g.latitude, longitude: g.longitude }}
                    title={g.name}
                    pinColor={sel ? "#6366F1" : "#94a3b8"}
                    onPress={() => setSelectedId(g.id)}
                    tracksViewChanges={false}
                  />
                );
              })}
            </MapView>
            <View pointerEvents="box-none" style={styles.mapOverlayLayer}>
              {phase === "ready" ? (
                <View style={[styles.mapBadge, fullscreen && { bottom: 22 }]}>
                  <View style={styles.mapBadgeDot} />
                  <Text style={styles.mapBadgeText}>
                    {t("mapForGarages.mapBadgeCount", { count: garages.length })}
                  </Text>
                </View>
              ) : null}
              {phase === "ready" && userCoord ? (
                <TouchableOpacity
                  style={[styles.mapRecenterBtn, fullscreen && styles.mapRecenterBtnFullscreen]}
                  onPress={onRecenterOnMe}
                  activeOpacity={0.88}
                  delayPressIn={0}
                  accessibilityRole="button"
                  accessibilityLabel={t("mapForGarages.recenterAccessibility")}
                  collapsable={false}
                >
                  <Ionicons name="locate" size={22} color={C.primary} />
                </TouchableOpacity>
              ) : null}
              {phase === "ready" && !fullscreen ? (
                <TouchableOpacity
                  style={styles.mapExpandBtn}
                  onPress={() => setMapFullscreen(true)}
                  activeOpacity={0.88}
                  delayPressIn={0}
                  accessibilityRole="button"
                  accessibilityLabel={t("mapForGarages.expandMapAccessibility")}
                  collapsable={false}
                >
                  <Ionicons name="expand-outline" size={22} color={C.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  };

  if (phase === "init" || phase === "loading_location" || phase === "loading_garages") {
    return (
      <AppBackground scrollable={false}>
        <StatusBar barStyle="light-content" />
        <MapScreenHeader
          insetTop={insets.top}
          eyebrow={t("mapForGarages.eyebrow")}
          title={t("mapForGarages.title")}
          subtitle={null}
          onBack={() => router.back()}
        />
        <View style={styles.centerBlock}>
          <View style={styles.loadingPulseRing}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
          <Text style={styles.stateBody}>
            {phase === "loading_garages" ? t("mapForGarages.loadingGarages") : t("mapForGarages.loadingLocation")}
          </Text>
        </View>
      </AppBackground>
    );
  }

  if (phase === "no_location" && permissionDenied) {
    return (
      <AppBackground scrollable={false}>
        <StatusBar barStyle="light-content" />
        <MapScreenHeader
          insetTop={insets.top}
          eyebrow={t("mapForGarages.eyebrow")}
          title={t("mapForGarages.title")}
          subtitle={null}
          onBack={() => router.back()}
        />
        <View style={styles.centerBlock}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="location-off-outline" size={30} color={C.red} />
          </View>
          <Text style={styles.stateTitle}>{t("mapForGarages.permissionDeniedTitle")}</Text>
          <Text style={styles.stateBody}>{t("mapForGarages.permissionDeniedBody")}</Text>
          <LinearGradient
            colors={["#6366F1", "#4F46E5", "#4338CA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryBtn}
          >
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 15, paddingHorizontal: 24 }}
              onPress={onRetryPermission}
              activeOpacity={0.9}
            >
              <Ionicons name="refresh-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>{t("nearestGarages.retry")}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </AppBackground>
    );
  }

  if (phase === "error") {
    return (
      <AppBackground scrollable={false}>
        <StatusBar barStyle="light-content" />
        <MapScreenHeader
          insetTop={insets.top}
          eyebrow={t("mapForGarages.eyebrow")}
          title={t("mapForGarages.title")}
          subtitle={null}
          onBack={() => router.back()}
        />
        <View style={styles.centerBlock}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="cloud-offline-outline" size={28} color={C.red} />
          </View>
          <Text style={styles.stateTitle}>{t("nearestGarages.errorTitle")}</Text>
          <Text style={styles.stateBody}>{errorMessage || t("common.error")}</Text>
          <LinearGradient
            colors={["#6366F1", "#4F46E5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 15, paddingHorizontal: 24 }}
              onPress={async () => {
                setPhase("loading_location");
                setErrorMessage("");
                try {
                  const pos = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                  });
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;
                  setUserCoord({ latitude: lat, longitude: lng });
                  setPhase("loading_garages");
                  await loadGarages(lat, lng);
                  setPhase("ready");
                } catch (e) {
                  setErrorMessage(e?.message || String(e));
                  setPhase("error");
                }
              }}
              activeOpacity={0.92}
            >
              <Text style={styles.primaryBtnText}>{t("nearestGarages.retry")}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground scrollable={false}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <MapScreenHeader
          insetTop={insets.top}
          eyebrow={t("mapForGarages.eyebrow")}
          title={t("mapForGarages.title")}
          subtitle={t("mapForGarages.subtitle")}
          onBack={() => router.back()}
        />

        <ScrollView
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={["rgba(99,102,241,0.35)", "rgba(99,102,241,0.06)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.searchOuter}
          >
            <View style={styles.searchInner}>
              <View style={styles.searchIconWrap}>
                <Ionicons name="search-outline" size={20} color={C.primary} />
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder={t("mapForGarages.searchPlaceholder")}
                placeholderTextColor={C.sub}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </LinearGradient>

          <View style={styles.filtersSection}>
            <Text style={styles.filtersLabel}>{t("mapForGarages.filtersSection")}</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {SERVICE_FILTER_CHIPS.map((c) => {
              const active = chipId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setChipId(c.id)}
                  activeOpacity={0.88}
                >
                  <View style={[styles.chipDot, active && styles.chipDotActive]} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{chipLabel(c.id)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {!mapFullscreen ? renderMapBlock(false) : null}

          {phase === "ready" && garages.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="funnel-outline" size={26} color={C.amber} />
              </View>
              <Text style={[styles.stateTitle, { marginTop: 8 }]}>{t("mapForGarages.emptyTitle")}</Text>
              <Text style={styles.stateBody}>{t("mapForGarages.emptyBody")}</Text>
            </View>
          ) : null}

          {selectedGarage ? (
            <MotiView
              key={selectedGarage.id}
              from={{ opacity: 0, translateY: 14 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 280 }}
            >
              <View style={styles.detailCard}>
                <LinearGradient
                  colors={["#6366F1", "#22C55E", "#3B82F6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.detailCardTopAccent}
                />
                <View style={styles.detailCardBody}>
                  <View style={styles.detailHeaderRow}>
                    <Text style={styles.detailTitle} numberOfLines={2}>
                      {selectedGarage.name}
                    </Text>
                    <View style={styles.distancePill}>
                      <Text style={styles.distancePillText}>
                        {t("nearestGarages.distanceKm", { distance: formatDistanceKm(selectedGarage.distanceKm) })}
                      </Text>
                    </View>
                  </View>

                  {selectedGarage.rating != null && Number.isFinite(Number(selectedGarage.rating)) ? (
                    <View style={styles.ratingRow}>
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={15} color={C.amber} />
                        <Text style={styles.ratingText}>
                          {Number(selectedGarage.rating).toFixed(1)} · {t("mapForGarages.ratingLabel")}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.ratingMuted}>{t("mapForGarages.ratingPlaceholder")}</Text>
                  )}

                  <View style={styles.detailDivider} />

                  <DetailInfoRow
                    icon="location-outline"
                    label={t("mapForGarages.address")}
                    value={selectedGarage.address?.trim() || t("nearestGarages.addressUnknown")}
                  />
                  <DetailInfoRow
                    icon="call-outline"
                    label={t("mapForGarages.phone")}
                    value={selectedGarage.phone?.trim() || "—"}
                  />
                  <DetailInfoRow
                    icon="time-outline"
                    label={t("mapForGarages.hours")}
                    value={selectedGarage.workingHoursText?.trim() || "—"}
                  />

                  <View style={styles.detailRow}>
                    <View style={styles.detailIconCircle}>
                      <Ionicons name="construct-outline" size={17} color={C.primary} />
                    </View>
                    <View style={styles.detailRowText}>
                      <Text style={styles.detailLabel}>{t("mapForGarages.services")}</Text>
                      <View style={styles.servicesWrap}>
                        {selectedGarage.services?.length ? (
                          selectedGarage.services.map((s, i) => (
                            <View key={`${s}-${i}`} style={styles.serviceTag}>
                              <Text style={styles.serviceTagText}>{s}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.detailValue}>—</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionBtnGhost}
                      onPress={() => onChat(selectedGarage)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={19} color={C.primary} />
                      <Text style={styles.actionBtnGhostText}>{t("mapForGarages.chatButton")}</Text>
                    </TouchableOpacity>

                    <LinearGradient
                      colors={["#6366F1", "#4F46E5", "#4338CA"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.actionBtnGradientOuter}
                    >
                      <TouchableOpacity
                        style={styles.actionBtnGradientInner}
                        onPress={() => onWaze(selectedGarage)}
                        activeOpacity={0.92}
                      >
                        <Ionicons name="navigate-outline" size={19} color="#fff" />
                        <Text style={styles.actionBtnGradientText}>{t("mapForGarages.wazeButton")}</Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                </View>
              </View>
            </MotiView>
          ) : phase === "ready" && garages.length > 0 ? (
            <View style={styles.emptyCard}>
              <Text style={[styles.stateBody, { marginTop: 0 }]}>{t("mapForGarages.selectPrompt")}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={mapFullscreen && phase === "ready"}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapFullscreen(false)}
        statusBarTranslucent
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.mapFullscreenRoot}>
          <View style={[styles.mapFullscreenToolbar, { paddingTop: insets.top + 6 }]}>
            <Text style={styles.mapFullscreenTitle}>{t("mapForGarages.title")}</Text>
            <TouchableOpacity
              style={styles.mapFullscreenCloseBtn}
              onPress={() => setMapFullscreen(false)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("mapForGarages.minimizeMapAccessibility")}
            >
              <Ionicons name="contract-outline" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={[styles.mapFullscreenMapShell, { paddingBottom: insets.bottom }]}>
            {renderMapBlock(true)}
          </View>
        </View>
      </Modal>
    </AppBackground>
  );
}
