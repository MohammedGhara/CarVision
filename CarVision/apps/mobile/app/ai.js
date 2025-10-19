// apps/mobile/app/AIChat.js
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getWsUrl } from "../lib/wsConfig";
import { postJson } from "../lib/api";

// If you're using Expo you can uncomment the next line
// and wrap the SafeAreaView with <LinearGradient ...> for a subtle background.
// import { LinearGradient } from "expo-linear-gradient";

const C = {
  bg: "#0a0e17",
  bgCard: "rgba(18,22,32,0.9)",
  border: "rgba(255,255,255,0.06)",
  text: "#F3F6FF",
  sub: "#9AA4BC",
  primary: "#7C8CFF",
  primaryDim: "rgba(124,140,255,0.18)",
  danger: "#FF6B6B",
  success: "#5BE49B",
};

export default function AIChat() {
  const router = useRouter();
  const [items, setItems] = useState([
    {
      id: "sys",
      role: "assistant",
      content:
        "Hi! I’m CarVision AI. Ask me about car issues, OBD-II codes, or your live telemetry.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true); // wire to your WS status if you have it
  const listRef = useRef(null);

  const placeholder =
    "Describe a symptom (e.g. “rough idle”), paste a DTC (P0420), or ask for next diagnostic step…";

  const canSend = useMemo(
    () => input.trim().length > 0 && !busy,
    [input, busy]
  );

  async function getApiBase() {
    const wsUrl = await getWsUrl();
    const m = wsUrl.match(/^wss?:\/\/([^/]+)\/ws$/i);
    if (!m) throw new Error("Bad WS URL in settings");
    return `http://${m[1]}`; // switch to https:// if you serve TLS
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const userMsg = {
      id: String(Date.now()),
      role: "user",
      content: text,
      ts: Date.now(),
    };
    setItems((arr) => [userMsg, ...arr]); // inverted list → prepend
    setInput("");
    setBusy(true);

    try {
      const base = await getApiBase();
      const data = await postJson(`${base}/api/chat`, { message: text });
      const reply =
        data?.reply?.trim?.() ||
        "I couldn’t generate a reply. Check the server logs.";
      const aiMsg = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: reply,
        ts: Date.now(),
      };
      setItems((arr) => [aiMsg, ...arr]);
    } catch (e) {
      const err = {
        id: String(Date.now() + 2),
        role: "assistant",
        content:
          "⚠️ " +
          (e?.message?.toString?.() || "Failed to reach CarVision AI server"),
        ts: Date.now(),
        error: true,
      };
      setItems((arr) => [err, ...arr]);
    } finally {
      setBusy(false);
      setTimeout(
        () => listRef.current?.scrollToOffset({ animated: true, offset: 0 }),
        60
      );
    }
  }

  function Item({ item }) {
    const isAI = item.role !== "user";
    return (
      <View
        style={[
          styles.row,
          isAI ? { justifyContent: "flex-start" } : { justifyContent: "flex-end" },
        ]}
      >
        {isAI && (
          <View style={[styles.avatar, { backgroundColor: C.primaryDim }]}>
            <Ionicons name="sparkles" size={16} color={C.primary} />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isAI ? styles.bubbleAI : styles.bubbleMe,
            item.error && { borderColor: "rgba(255,107,107,0.35)" },
          ]}
        >
          <Text style={styles.text}>{item.content}</Text>
          <Text style={styles.time}>
            {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        {!isAI && (
          <View style={[styles.avatar, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
            <Ionicons name="person" size={16} color={C.sub} />
          </View>
        )}
      </View>
    );
  }

  return (
    // If you enabled LinearGradient, wrap with it and remove bg color below
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.title}>CarVision AI</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: online ? C.success : C.danger },
              ]}
            />
            <Text style={styles.statusText}>
              {online ? "Connected" : "Offline"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {}}
          disabled
          style={{ width: 40, height: 40 }}
        />
      </View>

      {/* Messages (inverted list for “bottom-up” chat) */}
      <FlatList
        ref={listRef}
        inverted
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <Item item={item} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8, paddingTop: 12 }}
      />

      {/* Composer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.composerWrap}>
          <View style={styles.inputOuter}>
            <TextInput
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor="#8088A4"
              multiline
              value={input}
              onChangeText={setInput}
              maxLength={2000}
            />
            {busy && (
              <View style={styles.typing}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={styles.typingText}>Thinking…</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={send}
            disabled={!canSend}
            style={[styles.send, !canSend && { opacity: 0.5 }]}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: "rgba(10,12,18,0.85)",
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1 },
  title: { color: C.text, fontSize: 18, fontWeight: "800" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: C.sub, fontSize: 12 },

  row: { flexDirection: "row", gap: 8, alignItems: "flex-end", marginVertical: 6 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  bubble: {
    maxWidth: "76%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleAI: {
    backgroundColor: "rgba(124,140,255,0.08)",
  },
  bubbleMe: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  text: { color: C.text, fontSize: 15, lineHeight: 20 },
  time: { color: C.sub, fontSize: 11, marginTop: 6 },

  composerWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: "rgba(10,12,18,0.9)",
  },
  inputOuter: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    color: C.text,
    fontSize: 15,
  },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  typingText: { color: C.sub, fontSize: 12 },
  send: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
