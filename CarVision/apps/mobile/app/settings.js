import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { getWsUrl, setWsUrl, DEFAULT_WS_URL } from "../lib/wsConfig";

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
      const saved = await getWsUrl();
      setUrl(saved || DEFAULT_WS_URL);
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
      </KeyboardAvoiding>
    </SafeAreaView>
  );
}

const C = {
  bg: "#0B0F19",
  card: "rgba(22,26,36,0.85)",
  border: "rgba(255,255,255,0.06)",
  text: "#E6E9F5",
  sub: "#A8B2D1",
  primary: "#7C8CFF",
};

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  topbar: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.border, backgroundColor: "rgba(255,255,255,0.03)",
  },
  h1: { color: C.text, fontSize: 22, fontWeight: "900" },

  card: {
    backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 16,
    padding: 14, marginHorizontal: 12, marginTop: 12,
  },
  label: { color: C.sub, marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1, borderColor: C.border, color: C.text, padding: 12, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  btn: { backgroundColor: C.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  secondary: { backgroundColor: "rgba(255,255,255,0.06)" },
  btnText: { color: "#fff", fontWeight: "800" },
  hint: { color: C.sub, marginTop: 12, lineHeight: 20 },

  section: { color: C.sub, fontWeight: "700", marginTop: 16, marginLeft: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, marginTop: 8 },
  chip: {
    backgroundColor: "rgba(35,41,70,0.75)", color: "#CFD6FF",
    borderColor: "rgba(190,200,255,0.18)", borderWidth: 1,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, overflow: "hidden",
  },
});

function KeyboardAvoiding({ children, shimBehavior }) {
  if (Platform.OS !== "ios") return <>{children}</>;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={shimBehavior}>
      {children}
    </KeyboardAvoidingView>
  );
}
