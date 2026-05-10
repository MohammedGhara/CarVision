// apps/mobile/components/ForumPostCard.js
import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, Image } from "react-native"
import { LocalizedText as Text } from "./ui/LocalizedText";
import Ionicons from "@expo/vector-icons/Ionicons";

import { forumCategoryKey } from "../constants/forumCategories";
import { formatForumDate } from "../utils/forumUtils";
import { forumStyles as styles } from "../styles/forumStyles";
import { useLanguage } from "../context/LanguageContext";
import { getHttpBase } from "../lib/httpBase";
import ForumRoleBadge from "./ForumRoleBadge";
import ForumImageLightbox from "./ForumImageLightbox";

export default function ForumPostCard({ post, onPress }) {
  const { t, language } = useLanguage();
  const catKey = `forum.${forumCategoryKey(post.category)}`;
  const catLabel = t(catKey);
  const catDisplay = catLabel !== catKey ? catLabel : post.category;
  const [baseUrl, setBaseUrl] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await getHttpBase();
        if (!cancelled) setBaseUrl(b);
      } catch {
        if (!cancelled) setBaseUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function imageUri(url) {
    if (!url || !baseUrl) return null;
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${baseUrl.replace(/\/$/, "")}${path}`;
  }

  const uri = imageUri(post.imageUrl);

  return (
    <View style={styles.postCard}>
      <View style={styles.postCardInner}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
          <View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{catDisplay}</Text>
              </View>
              {post.dtcCode ? (
                <View style={styles.dtcBadge}>
                  <Text style={styles.dtcBadgeText}>{post.dtcCode}</Text>
                </View>
              ) : null}
              <Text style={post.status === "solved" ? styles.statusSolved : styles.statusOpen}>
                {post.status === "solved" ? t("forum.solved") : t("forum.open")}
              </Text>
            </View>
            <Text style={styles.postTitle} numberOfLines={2}>
              {post.title}
            </Text>
            <View style={styles.authorRow}>
              <Text style={styles.postMeta}>
                {post.authorName} · {formatForumDate(post.createdAt, language)}
              </Text>
              <ForumRoleBadge role={post.authorRole} />
            </View>
          </View>
        </TouchableOpacity>

        {uri ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setViewerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("forum.expandImage")}
          >
            <Image source={{ uri }} style={styles.postThumbList} resizeMode="cover" />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
          <View>
            <Text style={styles.postPreview} numberOfLines={2}>
              {post.description}
            </Text>
            <View style={styles.postFooter}>
              <View style={styles.statRow}>
                <Ionicons name="chatbubble-outline" size={16} color="#94A3B8" />
                <Text style={styles.statText}>{post.commentsCount ?? 0}</Text>
                <Ionicons name="arrow-up-outline" size={16} color="#94A3B8" style={{ marginLeft: 8 }} />
                <Text style={styles.statText}>{post.likes ?? 0}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#64748B" />
            </View>
          </View>
        </TouchableOpacity>
      </View>
      <ForumImageLightbox visible={viewerOpen} uri={uri} onClose={() => setViewerOpen(false)} />
    </View>
  );
}
