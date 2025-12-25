import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppBackground from "../components/layout/AppBackground";
import { api } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { aiStyles as styles } from "../styles/aiStyles";

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

// If your server route is different, change this:
const CHAT_PATH = "/api/chat"; // e.g. "/api/ai/chat" or "/ai/chat"

export default function AIChat() {
  const router = useRouter();
  const { t } = useLanguage();
  const [items, setItems] = useState([
    {
      id: "sys",
      role: "assistant",
      content: t("ai.subtitle"),
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true); // hook to WS/health if you have it
  const listRef = useRef(null);

  const placeholder = t("ai.placeholder");

  const canSend = useMemo(
    () => input.trim().length > 0 && !busy,
    [input, busy]
  );

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
      // ⬇️ use api.post — it already attaches base URL + Authorization header and parses JSON
      const data = await api.post(CHAT_PATH, { message: text });

      const reply =
        data?.reply?.trim?.() ||
        data?.answer?.trim?.() ||
        t("ai.noReply");
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
          (e?.message?.toString?.() || t("ai.serverError")),
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <AppBackground scrollable={false} safeAreaEdges={["top"]}>
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
            <Text style={styles.title}>{t("ai.title")}</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: online ? C.success : C.danger },
                ]}
              />
              <Text style={styles.statusText}>
                {online ? t("diagnostics.online") : t("diagnostics.offline")}
              </Text>
            </View>
          </View>

          <View style={{ width: 40, height: 40 }} />
        </View>

        {/* Messages (inverted list for "bottom-up" chat) */}
        <FlatList
          ref={listRef}
          inverted
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => <Item item={item} />}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8, paddingTop: 12 }}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
        />

        {/* Composer */}
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
                <Text style={styles.typingText}>{t("ai.typing")}</Text>
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
      </AppBackground>
    </KeyboardAvoidingView>
  );
}

