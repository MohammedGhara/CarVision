// apps/mobile/app/chat.js
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { api } from "../lib/api";
import { getUser } from "../lib/authStore";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { chatStyles as styles } from "../styles/chatStyles";
import { showCustomAlert } from "../components/CustomAlert";

export default function ChatScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const otherUserId = params.userId;
  const otherUserName = params.userName;

  const [user, setUser] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (!otherUserId) {
      router.back();
      return;
    }
    loadUser();
    loadMessages();
    
    // Poll for new messages every 3 seconds
    pollIntervalRef.current = setInterval(() => {
      loadMessages(false);
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [otherUserId]);

  async function loadUser() {
    const currentUser = await getUser();
    setUser(currentUser);
  }

  async function loadMessages(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      const data = await api.get(`/api/messages/${otherUserId}`);
      if (data?.messages) {
        setMessages(data.messages);
        if (data.otherUser) {
          setOtherUser(data.otherUser);
        }
        // Scroll to bottom
        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    try {
      const data = await api.post("/api/messages", {
        receiverId: otherUserId,
        content: text,
      });

      if (data?.message) {
        // Reload messages to get the new one
        await loadMessages(false);
      }
    } catch (e) {
      console.error("Failed to send message:", e);
      setInput(text); // Restore input on error
      showCustomAlert(t("common.error"), e.message || t("chat.sendError"));
    } finally {
      setSending(false);
    }
  }


  if (loading && !otherUser) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ color: C.sub, marginTop: 12 }}>{t("common.loading")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient colors={[C.bg1, C.bg2]} style={styles.bg}>
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1600&auto=format&fit=crop",
        }}
        imageStyle={{ opacity: 0.12 }}
        style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <View style={[styles.avatar, { backgroundColor: otherUser?.role === "GARAGE" ? "rgba(250,204,21,0.15)" : "rgba(124,140,255,0.15)" }]}>
              <MaterialCommunityIcons
                name={otherUser?.role === "GARAGE" ? "garage" : "account"}
                size={20}
                color={otherUser?.role === "GARAGE" ? C.amber : C.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{otherUserName || otherUser?.name || "User"}</Text>
              <Text style={styles.headerSubtitle}>
                {otherUser?.role === "GARAGE" ? t("chat.garage") : t("chat.client")}
              </Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const isMe = item.senderId === user?.id;
            return <MessageBubble message={item} isMe={isMe} t={t} />;
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="chat-outline" size={48} color={C.sub} />
              <Text style={styles.emptyText}>{t("chat.noMessages")}</Text>
            </View>
          }
        />

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t("chat.typeMessage")}
              placeholderTextColor={C.sub}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function MessageBubble({ message, isMe, t }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasContent = message.content && message.content.trim().length > 0;

  return (
    <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
      <View
        style={[
          styles.bubble,
          isMe ? styles.bubbleMe : styles.bubbleOther,
        ]}
      >
        {/* Message Content */}
        {hasContent && (
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
            {message.content}
          </Text>
        )}
        
        {/* Show placeholder if no content */}
        {!hasContent && (
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe, { fontStyle: "italic", opacity: 0.6 }]}>
            {t("chat.emptyMessage")}
          </Text>
        )}

        {/* Time */}
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
          {time}
        </Text>
      </View>
    </View>
  );
}
