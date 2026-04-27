import { Alert, Linking } from "react-native";

function buildGoogleWebUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

function buildWazeUrl(lat, lng) {
  return `waze://?ll=${lat},${lng}&navigate=yes`;
}

export async function openNavigationChooser({
  latitude,
  longitude,
  t,
  onError,
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  const wazeUrl = buildWazeUrl(lat, lng);
  const googleWebUrl = buildGoogleWebUrl(lat, lng);

  const hasWaze = await Linking.canOpenURL(wazeUrl).catch(() => false);

  const openSafely = async (url) => {
    try {
      await Linking.openURL(url);
      return true;
    } catch (e) {
      if (typeof onError === "function") onError(e);
      return false;
    }
  };

  if (hasWaze) {
    Alert.alert(
      t("nearestGarages.navChooserTitle"),
      t("nearestGarages.navChooserBody"),
      [
        {
          text: t("nearestGarages.navWaze"),
          onPress: () => {
            openSafely(wazeUrl);
          },
        },
        {
          text: t("nearestGarages.navGoogleMaps"),
          onPress: () => {
            openSafely(googleWebUrl);
          },
        },
        { text: t("nearestGarages.navCancel"), style: "cancel" },
      ]
    );
    return true;
  }

  if (!hasWaze) {
    // Reliable fallback (and primary Google Maps option in Expo Go): web URL.
    return openSafely(googleWebUrl);
  }

  return openSafely(googleWebUrl);
}
