// apps/mobile/app/forum-post-details.js
import React, { useCallback, useState, useMemo, useEffect } from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from "react-native"
import { LocalizedText as Text } from "../components/ui/LocalizedText";
import { LocalizedTextInput as TextInput } from "../components/ui/LocalizedTextInput";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import AppBackground from "../components/layout/AppBackground";
import { forumCategoryKey } from "../constants/forumCategories";
import {
  fetchForumPost,
  addForumComment,
  toggleForumPostLike,
  toggleForumCommentLike,
  markForumSolution,
} from "../lib/forumApi";
import { getUser } from "../lib/authStore";
import { useLanguage } from "../context/LanguageContext";
import { forumStyles as styles } from "../styles/forumStyles";
import { formatForumDate } from "../utils/forumUtils";
import { showCustomAlert } from "../components/CustomAlert";
import { getHttpBase } from "../lib/httpBase";
import ForumRoleBadge from "../components/ForumRoleBadge";
import ForumImageLightbox from "../components/ForumImageLightbox";

function readId(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return String(v[0] ?? "").trim();
  return String(v).trim();
}

export default function ForumPostDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = readId(params.id);
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [baseUrl, setBaseUrl] = useState(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  useEffect(() => {
    setImageViewerOpen(false);
  }, [id]);

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

  const displayComments = useMemo(() => {
    const sol = comments.filter((c) => c.isSolution);
    const rest = comments.filter((c) => !c.isSolution);
    return [...sol, ...rest];
  }, [comments]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchForumPost(id);
      setPost(data.post);
      setComments(data.comments || []);
    } catch (e) {
      showCustomAlert(t("common.error"), e?.message || String(e));
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onTogglePostLike() {
    const me = await getUser();
    if (!me) {
      showCustomAlert(t("common.error"), t("forum.loginRequired"));
      return;
    }
    try {
      const r = await toggleForumPostLike(id);
      setPost((p) => (p ? { ...p, likes: r.likesCount, likedByMe: r.liked } : p));
    } catch (e) {
      showCustomAlert(t("common.error"), e?.message || String(e));
    }
  }

  async function onToggleCommentLike(commentId) {
    const me = await getUser();
    if (!me) {
      showCustomAlert(t("common.error"), t("forum.loginRequired"));
      return;
    }
    try {
      const r = await toggleForumCommentLike(commentId);
      setComments((list) =>
        list.map((c) => (c.id === commentId ? { ...c, likes: r.likesCount, likedByMe: r.liked } : c))
      );
    } catch (e) {
      showCustomAlert(t("common.error"), e?.message || String(e));
    }
  }

  async function onMarkSolution(commentId) {
    try {
      await markForumSolution(id, commentId);
      await load();
    } catch (e) {
      showCustomAlert(t("common.error"), e?.message || String(e));
    }
  }

  async function onSendComment() {
    const text = newComment.trim();
    if (!text) {
      showCustomAlert(t("common.error"), t("forum.commentEmpty"));
      return;
    }
    const me = await getUser();
    if (!me) {
      showCustomAlert(t("common.error"), t("forum.loginRequired"));
      router.replace("/login");
      return;
    }
    setSending(true);
    try {
      const c = await addForumComment(id, text);
      setComments((prev) => [...prev, c]);
      setNewComment("");
      setPost((p) => (p ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
    } catch (e) {
      showCustomAlert(t("common.error"), e?.message || String(e));
    } finally {
      setSending(false);
    }
  }

  if (!id) {
    return (
      <AppBackground scrollable={false}>
        <Text style={{ color: "#fff", padding: 24 }}>{t("forum.missingId")}</Text>
      </AppBackground>
    );
  }

  const catKey = post ? `forum.${forumCategoryKey(post.category)}` : "";
  const catLabel = post && catKey ? t(catKey) : "";
  const catDisplay = catLabel && catLabel !== catKey ? catLabel : post?.category;

  return (
    <AppBackground scrollable={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#E5E7EB" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {post?.title || "…"}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerMsg}>
            <ActivityIndicator color="#6366F1" />
          </View>
        ) : !post ? (
          <View style={styles.centerMsg}>
            <Text style={styles.centerText}>{t("forum.notFound")}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <View style={[styles.postCard, { marginTop: 8 }]}>
              <View style={styles.postCardInner}>
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
                <Text style={[styles.postTitle, { marginTop: 10 }]}>{post.title}</Text>
                <View style={styles.authorRow}>
                  <Text style={styles.postMeta}>
                    {post.authorName} · {formatForumDate(post.createdAt, language)}
                  </Text>
                  <ForumRoleBadge role={post.authorRole} />
                </View>
                {imageUri(post.imageUrl) ? (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => setImageViewerOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t("forum.expandImage")}
                  >
                    <Image source={{ uri: imageUri(post.imageUrl) }} style={styles.postThumb} resizeMode="cover" />
                  </TouchableOpacity>
                ) : null}
                <Text style={[styles.postPreview, { marginTop: 10, color: "#E5E7EB" }]}>{post.description}</Text>
                {(post.carBrand || post.carModel || post.carYear || post.engineType) && (
                  <Text style={[styles.postMeta, { marginTop: 12 }]}>
                    {[post.carBrand, post.carModel, post.carYear, post.engineType].filter(Boolean).join(" · ")}
                  </Text>
                )}
                <View style={styles.postFooter}>
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6 }} onPress={onTogglePostLike}>
                    <Ionicons name={post.likedByMe ? "arrow-up" : "arrow-up-outline"} size={20} color="#818CF8" />
                    <Text style={styles.statText}>{post.likes ?? 0}</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="chatbubble-outline" size={18} color="#94A3B8" />
                    <Text style={styles.statText}>{post.commentsCount ?? comments.length}</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={[styles.label, { marginHorizontal: 14, marginTop: 16, marginBottom: 8 }]}>
              {t("forum.comments")}
            </Text>
            {displayComments.map((c) => (
              <View key={c.id} style={styles.commentBox}>
                {c.isSolution ? (
                  <View style={styles.solutionRibbon}>
                    <Text style={styles.solutionRibbonText}>{t("forum.solutionBadge")}</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Text style={styles.commentAuthor}>{c.authorName}</Text>
                  <ForumRoleBadge role={c.authorRole} />
                </View>
                <Text style={styles.commentBody}>{c.content}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, justifyContent: "space-between" }}>
                  <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6 }} onPress={() => onToggleCommentLike(c.id)}>
                    <Ionicons name={c.likedByMe ? "arrow-up" : "arrow-up-outline"} size={18} color="#818CF8" />
                    <Text style={styles.statText}>{c.likes ?? 0}</Text>
                  </TouchableOpacity>
                  {post.isAuthor && !c.isSolution ? (
                    <TouchableOpacity onPress={() => onMarkSolution(c.id)}>
                      <Text style={{ color: "#86EFAC", fontWeight: "800", fontSize: 12 }}>{t("forum.markSolution")}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}

            <View style={{ marginHorizontal: 14, marginTop: 16 }}>
              <Text style={styles.label}>{t("forum.addComment")}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { marginTop: 8 }]}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                placeholder={t("forum.commentPlaceholder")}
                placeholderTextColor="#64748B"
              />
              <TouchableOpacity
                style={[styles.submitBtn, { marginHorizontal: 0 }, sending && { opacity: 0.7 }]}
                onPress={onSendComment}
                disabled={sending}
              >
                {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{t("forum.postComment")}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <ForumImageLightbox
        visible={imageViewerOpen}
        uri={post ? imageUri(post.imageUrl) : null}
        onClose={() => setImageViewerOpen(false)}
      />
    </AppBackground>
  );
}
