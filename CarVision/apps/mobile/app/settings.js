import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { getWsUrl, setWsUrl } from "../lib/wsConfig";
import { useLanguage } from "../context/LanguageContext";
import { settingsStyles as s } from "../styles/settingsStyles";
import { colors } from "../styles/theme";

const C = colors.settings;

export default function Settings() {
  const router = useRouter();
  const { t } = useLanguage();
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      // Load current URL (will auto-detect if needed)
      const currentUrl = await getWsUrl();
      setUrl(currentUrl);
    })();
  }, []);

  function validate(u) {
    return /^wss?:\/\/[^ ]+\/ws$/i.test(u);
  }

  async function testAndSave() {
    setTesting(true);
    try {
      let target = url.trim();
      
      // Validate URL format
      if (!target || !validate(target)) {
        throw new Error("Invalid WebSocket URL format. Example: ws://192.168.1.50:5173/ws");
      }

      // Test WebSocket connection
      const ws = new WebSocket(target);
      await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error("Connection timeout")), 2500);
        ws.onopen = () => { clearTimeout(to); ws.close(); resolve(); };
        ws.onerror = (e) => { clearTimeout(to); reject(new Error("Connection failed")); };
      });

      // Save the URL manually (overrides auto-detection for this subnet)
      await setWsUrl(target);
      Alert.alert(t("settings.connected"), `${t("settings.connected")}:\n${target}`);
      setUrl(target);
    } catch (e) {
      Alert.alert(t("settings.couldNotConnect"), String(e));
    } finally {
      setTesting(false);
    }
  }

  function usePreset(u) {
    setUrl(u);
  }

  const presets = [
    "ws://192.168.1.50:5173/ws",
    "ws://192.168.1.100:5173/ws",
  ];
  const uniquePresets = Array.from(new Set(presets.filter(Boolean)));

  return (
    <SafeAreaView style={s.wrap}>
      <KeyboardAvoiding shimBehavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.topbar}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#E6E9F5" />
          </TouchableOpacity>
          <Text style={s.h1}>{t("settings.title")}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.card}>
          <Text style={s.label}>{t("settings.websocketUrl")}</Text>
          <TextInput
            style={s.input}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ws://192.168.1.23:5173/ws"
            placeholderTextColor="#7a8197"
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={s.btn} onPress={testAndSave} disabled={testing}>
              <Text style={s.btnText}>{testing ? t("settings.testing") : t("settings.connect")}</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.hint}>
            The app automatically detects the server when you connect to WiFi. You can manually set the URL here if needed.
          </Text>
        </View>

          <Text style={s.section}>{t("settings.quickPresets")}</Text>
        <View style={s.chips}>
          {uniquePresets.map((p, i) => (
            <TouchableOpacity key={`${p}-${i}`} onPress={() => usePreset(p)}>
              <Text style={s.chip}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Account Settings */}
        <Text style={s.section}>{t("settings.account")}</Text>
        <View style={s.card}>
          <TouchableOpacity 
            style={s.accountRow} 
            onPress={() => router.push("/forgotpassword")}
            activeOpacity={0.7}
          >
            <View style={s.accountLeft}>
              <Ionicons name="key-outline" size={20} color={C.primary} />
              <View style={{ marginLeft: 12 }}>
                <Text style={s.accountTitle}>{t("settings.resetPassword")}</Text>
                <Text style={s.accountSub}>{t("settings.resetPasswordSubtitle")}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.sub} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoiding>
    </SafeAreaView>
  );
}


function KeyboardAvoiding({ children, shimBehavior }) {
  if (Platform.OS !== "ios") return <>{children}</>;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={shimBehavior}>
      {children}
    </KeyboardAvoidingView>
  );
}
