// apps/mobile/lib/i18n.js
// Simple i18n system for CarVision

import AsyncStorage from "@react-native-async-storage/async-storage";

const LANGUAGE_KEY = "carvision_language";

export const LANGUAGES = {
  en: { code: "en", name: "English", nativeName: "English", rtl: false },
  ar: { code: "ar", name: "Arabic", nativeName: "العربية", rtl: true },
  he: { code: "he", name: "Hebrew", nativeName: "עברית", rtl: true },
};

export const DEFAULT_LANGUAGE = "en";

// Load saved language preference
export async function getSavedLanguage() {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    return saved && LANGUAGES[saved] ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

// Save language preference
export async function saveLanguage(langCode) {
  try {
    if (LANGUAGES[langCode]) {
      await AsyncStorage.setItem(LANGUAGE_KEY, langCode);
      return true;
    }
  } catch (error) {
    console.error("Failed to save language:", error);
  }
  return false;
}

// Check if language is RTL
export function isRTL(langCode) {
  return LANGUAGES[langCode]?.rtl || false;
}

