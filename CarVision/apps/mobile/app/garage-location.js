// apps/mobile/app/garage-location.js — GARAGE: full-screen listing editor (moved from Profile)
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";

import AppBackground from "../components/layout/AppBackground";
import { api } from "../lib/api";
import { getUser, getToken, saveUser } from "../lib/authStore";
import {
  coordToInput,
  garageLocationEqual,
  garageLocationSnapshotFromForm,
  garageLocationSnapshotFromUser,
  MAX_GARAGE_DESCRIPTION_LEN,
  MAX_WORKING_HOURS_LEN,
  parseLatLngFromMapsUrl,
} from "../lib/garageListingShared";
import { showCustomAlert } from "../components/CustomAlert";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { garageLocationScreenStyles as styles } from "../styles/garageLocationScreenStyles";

export default function GarageLocationScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [garageDescription, setGarageDescription] = useState("");
  const [workingHoursText, setWorkingHoursText] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const hydrateFromUser = useCallback((u) => {
    setAddress(u?.address != null ? String(u.address) : "");
    setLatitude(coordToInput(u?.latitude));
    setLongitude(coordToInput(u?.longitude));
    setGarageDescription(u?.garageDescription != null ? String(u.garageDescription) : "");
    setWorkingHoursText(u?.workingHoursText != null ? String(u.workingHoursText) : "");
    setMapLink("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const cached = await getUser();
        if (!token || !cached) {
          router.replace("/login");
          return;
        }
        if (cached.role !== "GARAGE") {
          router.replace("/");
          return;
        }
        if (cancelled) return;
        setUser(cached);
        hydrateFromUser(cached);
        try {
          const me = await api.get("/api/auth/me");
          if (cancelled || !me?.user) return;
          if (me.user.role !== "GARAGE") {
            router.replace("/");
            return;
          }
          setUser(me.user);
          await saveUser(me.user);
          hydrateFromUser(me.user);
        } catch (e) {
          console.error("garage-location /me:", e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, hydrateFromUser]);

  const busy = saving || locating;

  const handleApplyMapLink = useCallback(() => {
    const parsed = parseLatLngFromMapsUrl(mapLink);
    if (!parsed) {
      showCustomAlert(t("profile.mapLinkInvalidTitle"), t("profile.mapLinkInvalidMessage"));
      return;
    }
    const latStr = parsed.lat.toFixed(6);
    const lngStr = parsed.lng.toFixed(6);
    setLatitude(latStr);
    setLongitude(lngStr);
    showCustomAlert(
      t("profile.mapLinkAppliedTitle"),
      t("profile.mapLinkAppliedMessage", { lat: latStr, lng: lngStr })
    );
  }, [mapLink, t]);

  const handleUseCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== "granted") {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }
      if (status !== "granted") {
        showCustomAlert(t("common.error"), t("profile.locationPermissionDenied"));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        showCustomAlert(t("common.error"), t("profile.locationUnavailable"));
        return;
      }
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));
    } catch (e) {
      console.error("garage-location use location:", e);
      showCustomAlert(t("common.error"), e?.message || t("profile.locationUnavailable"));
    } finally {
      setLocating(false);
    }
  }, [t]);

  const handleSave = useCallback(async () => {
    if (!user || user.role !== "GARAGE") return;

    const addrTrimmed = (address || "").trim();
    const latStr = (latitude || "").trim();
    const lngStr = (longitude || "").trim();
    const descTrimmed = (garageDescription || "").trim();
    const hoursTrimmed = (workingHoursText || "").trim();

    if (descTrimmed.length > MAX_GARAGE_DESCRIPTION_LEN) {
      showCustomAlert(t("common.error"), t("profile.garageDescriptionTooLong", { max: MAX_GARAGE_DESCRIPTION_LEN }));
      return;
    }
    if (hoursTrimmed.length > MAX_WORKING_HOURS_LEN) {
      showCustomAlert(t("common.error"), t("profile.workingHoursTooLong", { max: MAX_WORKING_HOURS_LEN }));
      return;
    }

    if (latStr !== "") {
      const latNum = parseFloat(latStr);
      if (!Number.isFinite(latNum)) {
        showCustomAlert(t("common.error"), t("profile.invalidCoordinate"));
        return;
      }
      if (latNum < -90 || latNum > 90) {
        showCustomAlert(t("common.error"), t("profile.invalidLatitude"));
        return;
      }
    }
    if (lngStr !== "") {
      const lngNum = parseFloat(lngStr);
      if (!Number.isFinite(lngNum)) {
        showCustomAlert(t("common.error"), t("profile.invalidCoordinate"));
        return;
      }
      if (lngNum < -180 || lngNum > 180) {
        showCustomAlert(t("common.error"), t("profile.invalidLongitude"));
        return;
      }
    }

    const nextSnap = garageLocationSnapshotFromForm(
      addrTrimmed,
      latStr,
      lngStr,
      garageDescription,
      workingHoursText
    );
    if (garageLocationEqual(nextSnap, garageLocationSnapshotFromUser(user))) {
      showCustomAlert(t("common.error"), t("profile.noChanges"));
      return;
    }

    const payload = {
      address: nextSnap.address,
      latitude: nextSnap.latitude,
      longitude: nextSnap.longitude,
      garageDescription: nextSnap.garageDescription,
      workingHoursText: nextSnap.workingHoursText,
    };

    setSaving(true);
    try {
      const result = await api.put("/api/auth/update-profile", payload);
      if (result?.user) {
        setUser(result.user);
        await saveUser(result.user);
        hydrateFromUser(result.user);
        showCustomAlert(t("common.success"), t("profile.updateSuccess"));
        router.back();
      } else {
        throw new Error(t("profile.updateError"));
      }
    } catch (e) {
      console.error("garage-location save:", e);
      showCustomAlert(t("common.error"), e.message || t("profile.updateError"));
    } finally {
      setSaving(false);
    }
  }, [user, address, latitude, longitude, garageDescription, workingHoursText, t, router, hydrateFromUser]);

  if (loading) {
    return (
      <AppBackground scrollable={false}>
        <View style={[styles.flex, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ color: C.sub, marginTop: 14 }}>{t("common.loading")}</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground scrollable={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={26} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>{t("garage.listingEditorTitle")}</Text>
            <Text style={styles.headerSubtitle}>{t("garage.listingEditorSubtitle")}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(28, insets.bottom + 20) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageIntro}>{t("garage.listingEditorIntro")}</Text>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("garage.listingSectionMap")}</Text>
            <Text style={styles.sectionHint}>{t("garage.listingSectionMapHint")}</Text>

            <Text style={styles.fieldLabel}>{t("profile.addressLabel")}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder={t("profile.addressLabel")}
              placeholderTextColor="rgba(148,163,184,0.75)"
              multiline
              editable={!busy}
            />

            <TouchableOpacity
              style={styles.primaryAction}
              onPress={handleUseCurrentLocation}
              disabled={busy}
              activeOpacity={0.88}
            >
              {locating ? (
                <ActivityIndicator color={C.primary} size="small" />
              ) : (
                <Ionicons name="locate-outline" size={22} color={C.primary} />
              )}
              <Text style={styles.primaryActionText}>{t("profile.useCurrentLocation")}</Text>
            </TouchableOpacity>

            <View style={styles.spacerMd} />

            <Text style={styles.fieldLabel}>{t("profile.mapShareLinkLabel")}</Text>
            <TextInput
              style={styles.input}
              value={mapLink}
              onChangeText={setMapLink}
              placeholder={t("profile.mapShareLinkPlaceholder")}
              placeholderTextColor="rgba(148,163,184,0.75)"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={handleApplyMapLink}
              disabled={busy}
              activeOpacity={0.88}
            >
              <Ionicons name="link-outline" size={22} color={C.primary} />
              <Text style={styles.secondaryActionText}>{t("profile.applyFromMapLink")}</Text>
            </TouchableOpacity>

            <View style={styles.helpBox}>
              <Text style={styles.helpBoxText}>{t("profile.coordinatesHelp")}</Text>
            </View>

            <View style={styles.row2}>
              <View style={styles.row2Item}>
                <Text style={styles.fieldLabel}>{t("profile.latitudeLabel")}</Text>
                <TextInput
                  style={styles.input}
                  value={latitude}
                  onChangeText={setLatitude}
                  placeholder={t("profile.latitudePlaceholder")}
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                />
              </View>
              <View style={styles.row2Item}>
                <Text style={styles.fieldLabel}>{t("profile.longitudeLabel")}</Text>
                <TextInput
                  style={styles.input}
                  value={longitude}
                  onChangeText={setLongitude}
                  placeholder={t("profile.longitudePlaceholder")}
                  placeholderTextColor="rgba(148,163,184,0.75)"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                />
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("garage.listingSectionPublic")}</Text>
            <Text style={styles.sectionHint}>{t("garage.listingSectionPublicHint")}</Text>

            <Text style={styles.fieldLabel}>{t("profile.garageDescriptionLabel")}</Text>
            <TextInput
              style={[styles.input, styles.textAreaTall]}
              value={garageDescription}
              onChangeText={setGarageDescription}
              placeholder={t("profile.garageDescriptionPlaceholder")}
              placeholderTextColor="rgba(148,163,184,0.75)"
              multiline
              maxLength={MAX_GARAGE_DESCRIPTION_LEN}
              editable={!busy}
            />

            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t("profile.workingHoursLabel")}</Text>
            <TextInput
              style={styles.input}
              value={workingHoursText}
              onChangeText={setWorkingHoursText}
              placeholder={t("profile.workingHoursPlaceholder")}
              placeholderTextColor="rgba(148,163,184,0.75)"
              maxLength={MAX_WORKING_HOURS_LEN}
              autoCapitalize="sentences"
              editable={!busy}
            />
          </View>

          <View style={styles.saveBar}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={busy} activeOpacity={0.9}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{t("garage.saveListing")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}
