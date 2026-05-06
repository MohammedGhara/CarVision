// apps/mobile/app/community-forum.js
import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import AppBackground from "../components/layout/AppBackground";
import ForumPostCard from "../components/ForumPostCard";
import { FORUM_CATEGORIES, FORUM_SORT_KEYS, forumCategoryKey } from "../constants/forumCategories";
import { fetchForumPosts } from "../lib/forumApi";
import { useLanguage } from "../context/LanguageContext";
import { forumStyles as styles } from "../styles/forumStyles";

const ALL = "all";

export default function CommunityForumScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState(ALL);
  const [sort, setSort] = useState("newest");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(search.trim()), 400);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setError("");
    try {
      const list = await fetchForumPosts({
        q: debouncedQ,
        category,
        sort,
      });
      setPosts(list);
    } catch (e) {
      setError(e?.message || String(e));
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedQ, category, sort]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const categoryOptions = useMemo(() => [ALL, ...FORUM_CATEGORIES], []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <AppBackground scrollable={false}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color="#E5E7EB" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t("forum.eyebrow")}</Text>
          <Text style={styles.headerTitle}>{t("forum.title")}</Text>
          <Text style={styles.headerSub}>{t("forum.subtitle")}</Text>
        </View>
      </View>

      <LinearGradient
        colors={["rgba(99,102,241,0.2)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.searchOuter}
      >
        <View style={styles.searchInner}>
          <Ionicons name="search-outline" size={20} color="#6366F1" />
          <TextInput
            style={styles.searchInput}
            placeholder={t("forum.searchPlaceholder")}
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {categoryOptions.map((c) => {
          const active = category === c;
          const label =
            c === ALL ? t("forum.allCategories") : t(`forum.${forumCategoryKey(c)}`);
          return (
            <TouchableOpacity
              key={c}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.sortRow}>
        {FORUM_SORT_KEYS.map((k) => {
          const active = sort === k;
          return (
            <TouchableOpacity key={k} style={[styles.sortChip, active && styles.sortChipActive]} onPress={() => setSort(k)}>
              <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{t(`forum.sort_${k}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <View style={styles.centerMsg}>
          <Text style={[styles.centerText, { color: "#FCA5A5" }]}>{error}</Text>
          <TouchableOpacity onPress={load} style={{ marginTop: 12 }}>
            <Text style={{ color: "#818CF8", fontWeight: "700" }}>{t("forum.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.centerMsg}>
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            !loading && !error ? (
              <View style={styles.centerMsg}>
                <Text style={styles.centerText}>{t("forum.empty")}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ForumPostCard post={item} onPress={() => router.push({ pathname: "/forum-post-details", params: { id: item.id } })} />
          )}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: 28 + insets.bottom }]}
        onPress={() => router.push("/create-forum-post")}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={t("forum.createPost")}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </AppBackground>
  );
}
