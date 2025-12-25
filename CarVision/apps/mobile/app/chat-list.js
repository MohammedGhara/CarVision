// apps/mobile/app/chat-list.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AppBackground from "../components/layout/AppBackground";

import { api } from "../lib/api";
import { getUser } from "../lib/authStore";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { chatListStyles as styles } from "../styles/chatListStyles";

export default function ChatListScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]); // All users of opposite role
  const [loading, setLoading] = useState(true);
  const [showAllUsers, setShowAllUsers] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      
      // Get current user
      const currentUser = await getUser();
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);

      // Load conversations
      try {
        const convData = await api.get("/api/messages/conversations");
        if (convData?.conversations) {
          setConversations(convData.conversations);
        }
      } catch (e) {
        console.error("Failed to load conversations:", e);
      }

      // Load all users of opposite role
      const oppositeRole = currentUser.role === "GARAGE" ? "CLIENT" : "GARAGE";
      try {
        const usersData = await api.get(`/api/messages/users/${oppositeRole}`);
        if (usersData?.users) {
          setUsers(usersData.users);
        }
      } catch (e) {
        console.error("Failed to load users:", e);
      }
    } catch (e) {
      console.error("Failed to load chat data:", e);
    } finally {
      setLoading(false);
    }
  }

  function navigateToChat(otherUser) {
    router.push({
      pathname: "/chat",
      params: { userId: otherUser.id, userName: otherUser.name },
    });
  }

  if (loading) {
    return (
      <AppBackground scrollable={false}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ color: C.sub, marginTop: 12 }}>{t("common.loading")}</Text>
        </View>
      </AppBackground>
    );
  }

  const displayList = showAllUsers ? users : conversations;

  return (
    <AppBackground scrollable={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>{t("chat.title")}</Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowAllUsers(!showAllUsers)}
            style={styles.toggleBtn}
            activeOpacity={0.8}
          >
            <Ionicons
              name={showAllUsers ? "chatbubbles-outline" : "people-outline"}
              size={22}
              color={C.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, !showAllUsers && styles.tabActive]}
            onPress={() => setShowAllUsers(false)}
          >
            <Text style={[styles.tabText, !showAllUsers && styles.tabTextActive]}>
              {t("chat.conversations")}
            </Text>
            {!showAllUsers && conversations.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{conversations.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, showAllUsers && styles.tabActive]}
            onPress={() => setShowAllUsers(true)}
          >
            <Text style={[styles.tabText, showAllUsers && styles.tabTextActive]}>
              {user?.role === "GARAGE" ? t("chat.clientsWhoMessaged") : t("chat.allUsers")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        {displayList.length === 0 ? (
          <View style={styles.center}>
            <MaterialCommunityIcons
              name={showAllUsers ? "account-search" : "chat-remove"}
              size={64}
              color={C.sub}
            />
            <Text style={styles.emptyText}>
              {showAllUsers ? t("chat.noUsers") : t("chat.noConversations")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayList}
            keyExtractor={(item) => (item.user ? item.user.id : item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              if (showAllUsers) {
                // Display all users
                return (
                  <UserCard
                    user={item}
                    onPress={() => navigateToChat(item)}
                    t={t}
                  />
                );
              } else {
                // Display conversations
                if (!item.user) return null;
                return (
                  <ConversationCard
                    conversation={item}
                    onPress={() => navigateToChat(item.user)}
                    t={t}
                  />
                );
              }
            }}
            refreshing={loading}
            onRefresh={loadData}
          />
        )}
    </AppBackground>
  );
}

function ConversationCard({ conversation, onPress, t }) {
  const { user, lastMessage, unreadCount } = conversation;
  const timeAgo = lastMessage
    ? formatTimeAgo(new Date(lastMessage.createdAt))
    : "";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.avatar}>
        <MaterialCommunityIcons
          name={user.role === "GARAGE" ? "garage" : "account"}
          size={24}
          color={user.role === "GARAGE" ? C.amber : C.primary}
        />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{user.name}</Text>
          {timeAgo && <Text style={styles.time}>{timeAgo}</Text>}
        </View>
        {lastMessage && (
          <View style={styles.cardFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {lastMessage.content}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.sub} />
    </TouchableOpacity>
  );
}

function UserCard({ user, onPress, t }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.avatar, { backgroundColor: user.role === "GARAGE" ? "rgba(250,204,21,0.15)" : "rgba(124,140,255,0.15)" }]}>
        <MaterialCommunityIcons
          name={user.role === "GARAGE" ? "garage" : "account"}
          size={24}
          color={user.role === "GARAGE" ? C.amber : C.primary}
        />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{user.name}</Text>
        <Text style={styles.cardSubtitle}>{user.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user.role}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.sub} />
    </TouchableOpacity>
  );
}

function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

