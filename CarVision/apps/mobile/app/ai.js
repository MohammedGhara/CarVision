import React, { useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getWsUrl } from "../lib/wsConfig";
import { postJson } from "../lib/api";
const C = { bg:"#0B0F19", card:"rgba(22,26,36,0.85)", border:"rgba(255,255,255,0.06)", text:"#E6E9F5", sub:"#A8B2D1", primary:"#7C8CFF" };

export default function AIChat() {
  const router = useRouter();
  const [items, setItems] = useState([
    { id: "sys", role: "assistant", content: "Hi! I’m CarVision AI. Ask me about car issues, OBD codes, or your Live Data." }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  async function getApiBase() {
    // if ws://192.168.1.23:5173/ws → http://192.168.1.23:5173
    const wsUrl = await getWsUrl();
    const m = wsUrl.match(/^wss?:\/\/([^/]+)\/ws$/i);
    if (!m) throw new Error("Bad WS URL in settings");
    return `http://${m[1]}`; // if you serve HTTPS, change to https://
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const userMsg = { id: String(Date.now()), role: "user", content: text };
    setItems((arr) => [...arr, userMsg]);
    setInput(""); setBusy(true);

    try {
      const base = await getApiBase();
      console.log("AI POST →", `${base}/api/chat`);  // <--- add this

      const data = await postJson(`${base}/api/chat`, { message: text });
      const aiMsg = { id: String(Date.now()+1), role: "assistant", content: data.reply };
      setItems((arr) => [...arr, aiMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      const err = { id: String(Date.now()+2), role: "assistant", content: "⚠️ " + (e.message || "Failed to reach AI") };
      setItems((arr) => [...arr, err]);
    } finally {
      setBusy(false);
    }
  }

  function Bubble({ role, content }) {
    const isAI = role !== "user";
    return (
      <View style={[s.bubble, isAI ? s.ai : s.me]}>
        <Text style={s.bubbleText}>{content}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="chevron-back" size={24} color="#E6E9F5"/></TouchableOpacity>
        <Text style={s.title}>CarVision AI</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={listRef}
        data={items}
        renderItem={({ item }) => <Bubble role={item.role} content={item.content} />}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding:12, gap:8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Ask about a DTC (e.g., P0420) or symptoms..."
            placeholderTextColor="#7a8197"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity onPress={send} disabled={busy} style={[s.sendBtn, busy && {opacity:0.6}]}>
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  topbar:{ paddingHorizontal:12, paddingVertical:8, flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  backBtn:{ width:40, height:40, borderRadius:12, borderWidth:1, borderColor:C.border, alignItems:"center", justifyContent:"center" },
  title:{ color:C.text, fontSize:18, fontWeight:"800" },

  bubble:{ maxWidth:"85%", padding:12, borderRadius:14, borderWidth:1, borderColor:C.border },
  ai:{ alignSelf:"flex-start", backgroundColor:"rgba(124,140,255,0.08)" },
  me:{ alignSelf:"flex-end", backgroundColor:"rgba(255,255,255,0.05)" },
  bubbleText:{ color:C.text },

  inputRow:{ flexDirection:"row", alignItems:"flex-end", gap:8, padding:12, borderTopWidth:1, borderTopColor:C.border, backgroundColor:"rgba(10,13,22,0.95)" },
  input:{ flex:1, minHeight:44, maxHeight:120, borderWidth:1, borderColor:C.border, borderRadius:12, paddingHorizontal:12, paddingVertical:8, color:C.text, backgroundColor:"rgba(255,255,255,0.04)" },
  sendBtn:{ backgroundColor:C.primary, borderRadius:12, paddingHorizontal:14, paddingVertical:12 }
});
