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

import { getWsUrl, setWsUrl, forceReDetect, checkNetworkChange, DEFAULT_WS_URL } from "../lib/wsConfig";
import { settingsStyles as s } from "../styles/settingsStyles";
import { colors } from "../styles/theme";

const C = colors.settings;

// --- Auto detect CarVision backend in local network ---
async function autoDetectServer() {
  const subnet = "192.168.1."; // most routers use this subnet
  const port = 5173;
  const path = "/ws";

  for (let i = 2; i < 255; i++) {
    const candidate = `ws://${subnet}${i}:${port}${path}`;
    try {
      const ws = new WebSocket(candidate);
      const ok = await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(), 500);
        ws.onopen = () => { clearTimeout(to); ws.close(); resolve(true); };
        ws.onerror = () => { clearTimeout(to); reject(); };
      });
      if (ok) return candidate;
    } catch {
      // ignore unreachable IPs
    }
  }
  return null;
}

export default function Settings() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      // Always check network and get current URL (validated)
      // This ensures we always show the correct URL for current network
      console.log("⚙️ Settings: Checking network and loading WebSocket URL...");
      
      // Check if network changed when settings opens
      const changed = await checkNetworkChange();
      if (changed) {
        // Network changed, auto-detect new URL
        console.log("🔄 WiFi changed detected in Settings, auto-detecting...");
        try {
          const newUrl = await forceReDetect();
          setUrl(newUrl);
          console.log("✅ Settings: New URL detected:", newUrl);
          if (newUrl !== DEFAULT_WS_URL) {
            Alert.alert("WiFi Changed", `Detected network change. New server: ${newUrl}`);
          }
        } catch (e) {
          console.log("Auto-detect failed:", e);
          // Still try to get saved URL
          const saved = await getWsUrl(false, false); // Don't skip validation in settings
          setUrl(saved || "");
        }
      } else {
        // No change, use saved URL (with validation to ensure it's current)
        const saved = await getWsUrl(false, false); // Validate to ensure it's current
        // Don't show default URL - show empty or actual detected URL
        if (saved && saved !== DEFAULT_WS_URL) {
          setUrl(saved);
        } else {
          // No valid saved URL, try to detect
          console.log("⚙️ Settings: No valid saved URL, attempting detection...");
          try {
            const detected = await forceReDetect();
            if (detected && detected !== DEFAULT_WS_URL) {
              setUrl(detected);
            } else {
              setUrl(""); // Show empty instead of default
            }
          } catch {
            setUrl(""); // Show empty if detection fails
          }
        }
      }
    })();
  }, []);

  function validate(u) {
    return /^wss?:\/\/[^ ]+\/ws$/i.test(u);
  }

  async function testAndSave() {
    setTesting(true);
    try {
      let target = url;
      if (!validate(target)) {
        Alert.alert("Scanning network...", "Trying to auto-detect CarVision server");
        const found = await autoDetectServer();
        if (!found) throw new Error("No CarVision server found on your network");
        target = found;
      }

      const ws = new WebSocket(target);
      await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error("Timeout")), 2500);
        ws.onopen = () => { clearTimeout(to); ws.close(); resolve(); };
        ws.onerror = (e) => { clearTimeout(to); reject(e?.message || e); };
      });

      await setWsUrl(target.trim());
      Alert.alert("Connected!", `Connected successfully to:\n${target}`);
      setUrl(target);
    } catch (e) {
      Alert.alert("Could not connect", String(e));
    } finally {
      setTesting(false);
    }
  }

  function useDefault() {
    setUrl(DEFAULT_WS_URL);
  }
  function usePreset(u) {
    setUrl(u);
  }

  const presets = [
    DEFAULT_WS_URL,
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
          <Text style={s.h1}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.card}>
          <Text style={s.label}>WebSocket URL</Text>
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
              <Text style={s.btnText}>{testing ? "Testing…" : "Connect"}</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.hint}>
            Tip: you can just press <Text style={{ fontWeight: "800" }}>Connect</Text> and it will
            automatically find your CarVision server on the network. No IP typing needed.
          </Text>
        </View>

          <Text style={s.section}>Quick presets</Text>
        <View style={s.chips}>
          {uniquePresets.map((p, i) => (
            <TouchableOpacity key={`${p}-${i}`} onPress={() => usePreset(p)}>
              <Text style={s.chip}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Account Settings */}
        <Text style={s.section}>Account</Text>
        <View style={s.card}>
          <TouchableOpacity 
            style={s.accountRow} 
            onPress={() => router.push("/forgotpassword")}
            activeOpacity={0.7}
          >
            <View style={s.accountLeft}>
              <Ionicons name="key-outline" size={20} color={C.primary} />
              <View style={{ marginLeft: 12 }}>
                <Text style={s.accountTitle}>Reset Password</Text>
                <Text style={s.accountSub}>Change your account password</Text>
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
