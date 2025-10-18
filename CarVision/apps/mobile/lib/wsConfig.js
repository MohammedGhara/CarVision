import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "carvision.ws_url";
export const DEFAULT_WS_URL = "ws://carvision.local:5173/ws"; // works if you use Option 1, or change it

export async function getWsUrl() {
  const v = await AsyncStorage.getItem(KEY);
  return v || DEFAULT_WS_URL;
}
export async function setWsUrl(url) {
  await AsyncStorage.setItem(KEY, url.trim());
}
