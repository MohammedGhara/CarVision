import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppBackground from "../components/layout/AppBackground";
import { getHttpBase } from "../lib/httpBase";
import { saveToken, saveUser, getToken } from "../lib/authStore";
import { showCustomAlert } from "../components/CustomAlert";
import LanguagePickerModal from "../components/LanguagePickerModal";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { authStyles as styles } from "../styles/authStyles";

export default function Login() {
  const r = useRouter();
  const { t, language, languages, changeLanguage } = useLanguage();
  const [identifier, setIdentifier] = useState(""); // Changed from email to identifier
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) r.replace("/");
    })();
  }, []);

  function validate() {
    if (!identifier || !password) {
      showCustomAlert(t("common.error"), t("login.missingFields"));
      return false;
    }
    // No email validation - accept both username and email
    return true;
  }
  async function onLogin() {
    // Validate first - these alerts should work immediately
    if (!identifier || !password) {
      showCustomAlert(t("common.error"), t("login.missingFields"));
      return;
    }
    
    setBusy(true);
    
    console.log("🔵 Starting login...", { identifier: identifier.substring(0, 5) + "***" });
    
    try {
      const base = await getHttpBase();
      
      // Determine if it's an email or username
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
      
      const resp = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEmail 
            ? { email: identifier, password } 
            : { username: identifier, password }
        ),
      });
      
      // Try to parse JSON response
      let data;
      let responseText = "";
      try {
        responseText = await resp.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        setBusy(false);
        showCustomAlert(
          t("alerts.serverErrorTitle"), 
          `${t("alerts.invalidResponse")}\n\n${t("alerts.statusLabel")}: ${resp.status}`
        );
        return;
      }
      
      if (!resp.ok || !data.ok) {
        // Show specific error message from server
        const errorMsg = data.error || "Login failed. Please try again.";
        setBusy(false);
        
        // Show specific alerts based on error type
        if (errorMsg.toLowerCase().includes("password")) {
          showCustomAlert("❌ " + t("common.error"), t("login.incorrectPassword"));
        } else if (errorMsg.toLowerCase().includes("email") || errorMsg.toLowerCase().includes("username")) {
          showCustomAlert("❌ " + t("common.error"), t("login.accountNotFound"));
        } else if (errorMsg.toLowerCase().includes("required")) {
          showCustomAlert("⚠️ " + t("login.missingInfo"), errorMsg);
        } else {
          showCustomAlert("❌ " + t("login.loginFailed"), errorMsg);
        }
        return;
      }
      
      // Check if we have token and user
      if (!data.token || !data.user) {
        console.error("❌ Missing token or user in response:", data);
        setBusy(false);
        showCustomAlert(t("alerts.loginErrorTitle"), t("alerts.loginIncomplete"));
        return;
      }
      
      console.log("✅ Login successful!");
      
      // Save credentials
      try {
        await saveToken(data.token);
        await saveUser(data.user);
        console.log("✅ Credentials saved");
      } catch (saveError) {
        console.error("❌ Save error:", saveError);
        setBusy(false);
        showCustomAlert(t("alerts.storageErrorTitle"), t("alerts.loginStorageFailed"));
        return;
      }
      
      // Success - Show alert FIRST, then redirect after user presses OK
      setBusy(false);
      
      setTimeout(() => {
        console.log("🟢 Showing success alert...");
        const displayName = data.user.name || data.user.email.split("@")[0];
        const redirectPath = data.user.role === "GARAGE" ? "/garage" : "/";
        showCustomAlert(
          `✅ ${t("alerts.loginSuccessTitle")}`, 
          `${t("alerts.welcomeBackPrefix")} ${displayName}${t("alerts.welcomeBackSuffix")}`,
          [
            { 
              text: t("common.ok"), 
              onPress: () => {
                console.log("User pressed OK, redirecting...");
                setTimeout(() => {
                  r.replace(redirectPath);
                }, 300);
              }
            }
          ]
        );
      }, 500);
      
    } catch (e) {
      // Network or other errors
      console.error("❌ Login exception:", e);
      setBusy(false);
      
      let errorMsg = t("alerts.networkError");
      if (e.message) {
        if (e.message.includes("fetch") || e.message.includes("network") || e.message.includes("Failed to fetch")) {
          errorMsg = t("alerts.cannotConnect");
        } else if (e.message.includes("timeout")) {
          errorMsg = t("alerts.timeoutError");
        } else {
          errorMsg = e.message;
        }
      }
      
      showCustomAlert("❌ " + t("alerts.connectionErrorTitle"), errorMsg);
    }
  }

  return (
    <AppBackground scrollable={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
          {/* ─── top bar with settings ─── */}
          <View style={styles.topbar}>
            <TouchableOpacity
              style={styles.langBtn}
              onPress={() => setShowLanguagePicker(true)}
            >
              <Ionicons name="language-outline" size={16} color={C.text} />
              <Text style={styles.langBtnText}>
                {languages[language]?.nativeName || language.toUpperCase()}
              </Text>
            </TouchableOpacity>
            <Text style={styles.logo}>CarVision</Text>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => r.push("/settings")}
            >
              <Ionicons name="settings-outline" size={20} color={C.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.tagline}>Drive smarter. Diagnose faster.</Text>

          <View style={styles.cardWrap}>
            <View style={styles.card}>
              <Text style={styles.h1}>{t("login.title")}</Text>
              <Text style={styles.h2}>{t("login.subtitle")}</Text>

              {/* Username or Email */}
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={20} color={C.sub} style={styles.iconLeft} />
                <TextInput
                  style={styles.input}
                  placeholder={t("login.emailUsername")}
                  placeholderTextColor={C.sub}
                  autoCapitalize="none"
                  keyboardType="default"
                  value={identifier}
                  onChangeText={setIdentifier}
                />
              </View>

              {/* Password */}
              <View style={styles.smallInputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={C.sub} style={styles.iconLeft} />
                <TextInput
                  style={styles.smallInput}
                  placeholder={t("login.password")}
                  placeholderTextColor={C.sub}
                  secureTextEntry={!showPwd}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={styles.iconRight}>
                  <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color={C.sub} />
                </TouchableOpacity>
              </View>

              {/* Row */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Switch value={remember} onValueChange={setRemember} />
                  <Text style={styles.rememberText}>{t("login.rememberMe")}</Text>
                </View>
                <TouchableOpacity onPress={() => r.push("/forgotpassword")}>
                  <Text style={styles.link}>{t("login.forgotPassword")}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, busy && { opacity: 0.7 }]}
                onPress={onLogin}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t("login.loginButton")}</Text>}
              </TouchableOpacity>

              <View style={{ alignItems: "center", marginTop: 14 }}>
                <Text style={{ color: C.sub }}>
                  {t("login.noAccount")}{" "}
                  <Text onPress={() => r.push("/signup")} style={styles.link}>
                    {t("login.signUp")}
                  </Text>
                </Text>
              </View>
            </View>
          </View>

        <Text style={styles.footer}>© 2025 CarVision</Text>
      </KeyboardAvoidingView>

      <LanguagePickerModal
        visible={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        onSelect={async (code) => {
          await changeLanguage(code);
          setShowLanguagePicker(false);
        }}
      />
    </AppBackground>
  );
}
