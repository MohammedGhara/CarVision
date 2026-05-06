// apps/mobile/utils/locationUtils.js
import { Share, Platform, Alert } from "react-native";
import * as Location from "expo-location";

export function mapsUrlFromCoords(lat, lng) {
  return `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

/**
 * @returns {Promise<{ latitude: number, longitude: number }|null>}
 */
export async function getCurrentCoordsOrNull() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== "granted") return null;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  } catch {
    return null;
  }
}

/**
 * Share a maps link as emergency context. Falls back to alert if Share fails.
 * @param {{ t: (k: string, p?: object) => string }} i18n
 */
export async function shareEmergencyLocation(i18n) {
  const coords = await getCurrentCoordsOrNull();
  if (!coords) {
    Alert.alert(
      i18n.t("safetyEmergency.locationDeniedTitle"),
      i18n.t("safetyEmergency.locationDeniedBody")
    );
    return false;
  }
  const url = mapsUrlFromCoords(coords.latitude, coords.longitude);
  const message = i18n.t("safetyEmergency.shareMessage", {
    lat: coords.latitude.toFixed(5),
    lng: coords.longitude.toFixed(5),
    url,
  });
  try {
    await Share.share({
      message: Platform.OS === "ios" ? message : `${message}\n${url}`,
      url: Platform.OS === "ios" ? url : undefined,
    });
    return true;
  } catch {
    Alert.alert(i18n.t("common.error"), i18n.t("safetyEmergency.shareFailed"));
    return false;
  }
}
