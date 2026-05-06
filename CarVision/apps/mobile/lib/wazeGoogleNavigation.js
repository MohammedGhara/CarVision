import { Linking } from "react-native";

/**
 * Opens Waze (https deep link per Waze docs); falls back to Google Maps directions on failure.
 * @returns {Promise<boolean>} true if a URL opened
 */
export async function openWazeWithGoogleFallback(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  try {
    await Linking.openURL(wazeUrl);
    return true;
  } catch {
    try {
      await Linking.openURL(googleUrl);
      return true;
    } catch {
      return false;
    }
  }
}
