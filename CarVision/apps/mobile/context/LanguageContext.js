// apps/mobile/context/LanguageContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import { I18nManager } from "react-native";
import { getSavedLanguage, saveLanguage, isRTL, LANGUAGES } from "../lib/i18n";
import enTranslations from "../lib/translations/en";
import arTranslations from "../lib/translations/ar";
import heTranslations from "../lib/translations/he";

const translations = {
  en: enTranslations,
  ar: arTranslations,
  he: heTranslations,
};

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(true);

  // Load saved language on mount
  useEffect(() => {
    (async () => {
      const savedLang = await getSavedLanguage();
      setLanguage(savedLang);
      updateRTL(savedLang);
      setLoading(false);
    })();
  }, []);

  // Update RTL layout
  const updateRTL = (langCode) => {
    const rtl = isRTL(langCode);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
      I18nManager.allowRTL(rtl);
      // Note: App restart may be required for RTL to take full effect
    }
  };

  // Change language
  const changeLanguage = async (langCode) => {
    if (LANGUAGES[langCode]) {
      await saveLanguage(langCode);
      setLanguage(langCode);
      updateRTL(langCode);
      return true;
    }
    return false;
  };

  // Translation function
  const resolveValue = (lang, keys) => {
    let value = translations[lang];
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    return value;
  };

  const t = (key, params = {}) => {
    const keys = key.split(".");
    let value = resolveValue(language, keys);

    if (value === undefined && language !== "en") {
      value = resolveValue("en", keys);
    }

    if (typeof value === "string") {
      return Object.keys(params).reduce((acc, paramKey) => {
        const paramValue = params[paramKey] ?? "";
        return acc.replaceAll(`{{${paramKey}}}`, String(paramValue));
      }, value);
    }

    return value ?? key;
  };

  const value = {
    language,
    locale: language,
    languages: LANGUAGES,
    changeLanguage,
    t,
    isRTL: isRTL(language),
    loading,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

