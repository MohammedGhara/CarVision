// apps/mobile/lib/authStore.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "auth_token";
const USER_KEY  = "auth_user";

export async function saveToken(token) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
}
export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function saveUser(user) {
  if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}
export async function getUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveSession({ token, user }) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function clearAuth() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}
