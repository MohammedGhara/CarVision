// apps/mobile/app/nearest-garages.js — client: nearest garages by current location (V1)
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Linking,
  StatusBar,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";

import AppBackground from "../components/layout/AppBackground";
import { api } from "../lib/api";
import { getUser } from "../lib/authStore";
import { showCustomAlert } from "../components/CustomAlert";
import { openNavigationChooser } from "../lib/navigation";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { nearestGaragesStyles as styles } from "../styles/nearestGaragesStyles";
import { NEARBY_RADIUS_KM } from "../lib/garageNearbyConstants";

const DEFAULT_LIMIT = 20;

/** Format km for display: finer precision when close. */
function formatDistanceNumber(distanceKm) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d)) return "—";
  if (d < 10) {
    const rounded = Math.round(d * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  return String(Math.round(d));
}

function GarageCard({ item, onNavigate, onEmail, onMessage, onOpenDetails, t }) {
  const distStr = formatDistanceNumber(item.distanceKm);
  const rawAddress = item.address != null ? String(item.address).trim() : "";
  const hasAddress = rawAddress.length > 0;
  const rawDesc =
    item.garageDescription != null && item.garageDescription !== ""
      ? String(item.garageDescription).trim()
      : "";
  const hasDesc = rawDesc.length > 0;
  const rawHours =
    item.workingHoursText != null && item.workingHoursText !== ""
      ? String(item.workingHoursText).trim()
      : "";
  const hasHours = rawHours.length > 0;
  const email = item.email != null ? String(item.email).trim() : "";
  const canEmail = email.length > 0;
  const canMessage = !!(item?.id && String(item.id).trim());

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={() => onOpenDetails(item)}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.distancePill}>
          <Text style={styles.distancePillText}>
            {t("nearestGarages.distanceKm", { distance: distStr })}
          </Text>
        </View>
      </View>

      {hasDesc ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {rawDesc}
        </Text>
      ) : null}

      {hasAddress ? (
        <Text style={styles.cardAddress}>{rawAddress}</Text>
      ) : (
        <View style={styles.cardAddressBlock}>
          <Text style={styles.cardAddressMuted}>{t("nearestGarages.addressUnknown")}</Text>
          <Text style={styles.cardAddressHint}>{t("nearestGarages.addressNoStreetHint")}</Text>
        </View>
      )}

      {hasHours ? (
        <View style={styles.cardHoursRow}>
          <Ionicons name="time-outline" size={14} color={C.sub} style={styles.cardHoursIcon} />
          <Text style={styles.cardHoursText} numberOfLines={1}>
            {rawHours}
          </Text>
        </View>
      ) : null}

      {!hasDesc && !hasHours ? (
        <Text style={styles.cardListingMissing}>{t("nearestGarages.listingDetailsMissing")}</Text>
      ) : null}

      {canEmail ? (
        <View style={styles.cardEmailRow}>
          <Ionicons name="mail-outline" size={16} color={C.sub} />
          <Text style={styles.cardEmailText} numberOfLines={1}>
            {email}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardActionsRow}>
        <TouchableOpacity
          style={styles.cardActionBtn}
          onPress={() => onNavigate(item)}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate-outline" size={18} color={C.primary} />
          <Text style={styles.cardActionBtnText} numberOfLines={2}>
            {t("nearestGarages.navigate")}
          </Text>
        </TouchableOpacity>
        {canEmail ? (
          <TouchableOpacity
            style={[styles.cardActionBtn, styles.cardActionBtnSecondary]}
            onPress={() => onEmail(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="mail-outline" size={18} color={C.text} />
            <Text style={[styles.cardActionBtnText, styles.cardActionBtnTextSecondary]} numberOfLines={2}>
              {t("nearestGarages.emailGarage")}
            </Text>
          </TouchableOpacity>
        ) : null}
        {canMessage ? (
          <TouchableOpacity
            style={[styles.cardActionBtn, styles.cardActionBtnSecondary]}
            onPress={() => onMessage(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.text} />
            <Text style={[styles.cardActionBtnText, styles.cardActionBtnTextSecondary]} numberOfLines={2}>
              {t("nearestGarages.messageGarage")}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function NearestGaragesScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const [phase, setPhase] = useState("init"); // init | need_permission | requesting_permission | denied | loading_location | loading_list | list | error
  const [garages, setGarages] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const lastCoordsRef = useRef(null);
  const skipFocusRefreshOnceRef = useRef(true);

  const classifyPermission = useCallback((status) => {
    if (status === "granted") return "granted";
    if (status === "denied") return "denied";
    return "undetermined";
  }, []);

  const loadGaragesList = useCallback(async (lat, lng, { silent } = {}) => {
    if (!silent) {
      setPhase("loading_list");
      setErrorMessage("");
    }
    const path = `/api/garages/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&limit=${DEFAULT_LIMIT}&radiusKm=${NEARBY_RADIUS_KM}`;
    const data = await api.get(path);
    const list = Array.isArray(data?.garages) ? data.garages : [];
    setGarages(list);
    lastCoordsRef.current = { lat, lng };
    setPhase("list");
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusRefreshOnceRef.current) {
        skipFocusRefreshOnceRef.current = false;
        return undefined;
      }
      const last = lastCoordsRef.current;
      if (last == null || !Number.isFinite(last.lat) || !Number.isFinite(last.lng)) {
        return undefined;
      }
      let cancelled = false;
      loadGaragesList(last.lat, last.lng, { silent: true }).catch((e) => {
        if (!cancelled) {
          console.error("nearest-garages focus refresh:", e);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [loadGaragesList])
  );

  const loadLocationThenGarages = useCallback(async () => {
    setPhase("loading_location");
    setErrorMessage("");
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    await loadGaragesList(lat, lng, { silent: false });
  }, [loadGaragesList]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
      const p = classifyPermission(existing.status);
      if (p === "granted") {
        try {
          await loadLocationThenGarages();
        } catch (e) {
          if (!cancelled) {
            console.error("nearest-garages init:", e);
            setErrorMessage(e?.message || String(e));
            setPhase("error");
          }
        }
        return;
      }
      if (p === "denied") {
        setPhase("denied");
        return;
      }
      setPhase("need_permission");
    })();
    return () => {
      cancelled = true;
    };
  }, [router, classifyPermission, loadLocationThenGarages]);

  const onRequestPermissionAndLoad = useCallback(async () => {
    setPhase("requesting_permission");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPhase("denied");
        return;
      }
      await loadLocationThenGarages();
    } catch (e) {
      console.error("nearest-garages permission:", e);
      setErrorMessage(e?.message || String(e));
      setPhase("error");
    }
  }, [loadLocationThenGarages]);

  const onRetry = useCallback(async () => {
    const existing = await Location.getForegroundPermissionsAsync();
    const p = classifyPermission(existing.status);
    if (p !== "granted") {
      setPhase("need_permission");
      return;
    }
    try {
      await loadLocationThenGarages();
    } catch (e) {
      setErrorMessage(e?.message || String(e));
      setPhase("error");
    }
  }, [classifyPermission, loadLocationThenGarages]);

  const onPullRefresh = useCallback(async () => {
    const last = lastCoordsRef.current;
    setRefreshing(true);
    try {
      if (last != null && Number.isFinite(last.lat) && Number.isFinite(last.lng)) {
        await loadGaragesList(last.lat, last.lng, { silent: true });
      } else {
        await loadLocationThenGarages();
      }
    } catch (e) {
      showCustomAlert(t("common.error"), e?.message || t("nearestGarages.errorTitle"));
    } finally {
      setRefreshing(false);
    }
  }, [loadGaragesList, loadLocationThenGarages, t]);

  const onOpenSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const onNavigate = useCallback(
    async (item) => {
      const lat = item?.latitude;
      const lng = item?.longitude;
      if (lat == null || lng == null) return;
      await openNavigationChooser({
        latitude: lat,
        longitude: lng,
        t,
        onError: () => showCustomAlert(t("common.error"), t("nearestGarages.navigateFailed")),
      });
    },
    [t]
  );

  const onEmail = useCallback(
    async (item) => {
      const email = item?.email != null ? String(item.email).trim() : "";
      if (!email) return;
      try {
        await Linking.openURL(`mailto:${email}`);
      } catch (e) {
        showCustomAlert(t("common.error"), t("nearestGarages.emailFailed"));
      }
    },
    [t]
  );

  const onMessage = useCallback(
    (item) => {
      const id = item?.id != null ? String(item.id).trim() : "";
      if (!id) return;
      const name = item?.name != null ? String(item.name) : "";
      router.push({
        pathname: "/chat",
        params: {
          userId: id,
          userName: name,
          initialDraft: t("nearestGarages.chatInitialDraft"),
        },
      });
    },
    [router, t]
  );

  const onOpenDetails = useCallback(
    (item) => {
      const id = item?.id != null ? String(item.id).trim() : "";
      if (!id) return;
      router.push({
        pathname: "/garage-detail",
        params: {
          id,
          name: item?.name ?? "",
          email: item?.email ?? "",
          address: item?.address ?? "",
          latitude: item?.latitude != null ? String(item.latitude) : "",
          longitude: item?.longitude != null ? String(item.longitude) : "",
          garageDescription: item?.garageDescription ?? "",
          workingHoursText: item?.workingHoursText ?? "",
        },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <GarageCard
        item={item}
        onNavigate={onNavigate}
        onEmail={onEmail}
        onMessage={onMessage}
        onOpenDetails={onOpenDetails}
        t={t}
      />
    ),
    [onNavigate, onEmail, onMessage, onOpenDetails, t]
  );

  const listHeader = useCallback(() => {
    if (phase !== "list" || garages.length === 0) return null;
    return (
      <View>
        <Text style={styles.listHeading}>{t("nearestGarages.listHeading")}</Text>
      </View>
    );
  }, [phase, garages.length, t]);

  const listEmpty = useCallback(() => {
    if (phase !== "list") return null;
    return (
      <View style={styles.emptyInList}>
        <Ionicons name="map-outline" size={44} color={C.sub} />
        <Text style={styles.stateTitle}>{t("nearestGarages.emptyTitle")}</Text>
        <Text style={styles.stateBody}>{t("nearestGarages.emptyBody")}</Text>
        <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 16, alignSelf: "stretch" }]} onPress={onRetry}>
          <Text style={styles.secondaryBtnText}>{t("nearestGarages.retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }, [phase, t, onRetry]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <AppBackground scrollable={false}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("nearestGarages.title")}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.subtitle}>{t("nearestGarages.subtitle")}</Text>

        <TouchableOpacity
          style={styles.openMapBanner}
          onPress={() => router.push("/map-for-garages")}
          activeOpacity={0.9}
        >
          <Ionicons name="map-outline" size={22} color={C.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.openMapBannerTitle}>{t("mapForGarages.openButton")}</Text>
            <Text style={styles.openMapBannerDesc}>{t("mapForGarages.openButtonDesc")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.sub} />
        </TouchableOpacity>

        {phase === "need_permission" && (
          <View>
            <Text style={[styles.stateBody, { marginBottom: 16 }]}>
              {t("nearestGarages.intro")}
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onRequestPermissionAndLoad}
              activeOpacity={0.9}
            >
              <Ionicons name="location-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>{t("nearestGarages.findButton")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === "denied" && (
          <View style={styles.centerBlock}>
            <Ionicons name="location-off-outline" size={48} color={C.sub} />
            <Text style={styles.stateTitle}>{t("nearestGarages.permissionDenied")}</Text>
            <Text style={styles.stateBody}>{t("nearestGarages.permissionDeniedBody")}</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 20, alignSelf: "stretch" }]}
              onPress={onOpenSettings}
              activeOpacity={0.9}
            >
              <Ionicons name="settings-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>{t("nearestGarages.openSettings")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={onRequestPermissionAndLoad}>
              <Text style={styles.secondaryBtnText}>{t("nearestGarages.retry")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {(phase === "init" ||
          phase === "requesting_permission" ||
          phase === "loading_location" ||
          phase === "loading_list") && (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.stateBody}>
              {phase === "init"
                ? t("common.loading")
                : phase === "loading_list"
                  ? t("nearestGarages.loadingList")
                  : phase === "requesting_permission"
                    ? t("nearestGarages.requestingPermission")
                    : t("nearestGarages.gettingLocation")}
            </Text>
          </View>
        )}

        {phase === "error" && (
          <View style={styles.centerBlock}>
            <Ionicons name="cloud-offline-outline" size={48} color={C.red} />
            <Text style={styles.stateTitle}>{t("nearestGarages.errorTitle")}</Text>
            <Text style={styles.stateBody}>{errorMessage || t("common.error")}</Text>
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 20 }]} onPress={onRetry}>
              <Text style={styles.primaryBtnText}>{t("nearestGarages.retry")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === "list" && (
          <FlatList
            data={garages}
            extraData={garages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            contentContainerStyle={garages.length === 0 ? styles.listContentGrow : styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onPullRefresh}
                tintColor={C.primary}
                colors={[C.primary]}
              />
            }
          />
        )}
      </View>
    </AppBackground>
  );
}
