// apps/mobile/app/marketplace-detail.js — listing detail + contact seller
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import AppBackground from "../components/layout/AppBackground";
import { api } from "../lib/api";
import { getHttpBase } from "../lib/httpBase";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { marketplaceStyles as styles } from "../styles/marketplaceStyles";

function readId(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value).trim();
}

function formatPrice(cents, t) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "—";
  const major = (n / 100).toFixed(2);
  return t("marketplace.priceDisplay", { amount: major });
}

function pricingView(item) {
  const price = Number(item?.priceCents);
  const compareAt = Number(item?.compareAtPriceCents);
  const hasCompareAt = Number.isFinite(compareAt) && compareAt > 0;
  const onSale = hasCompareAt && Number.isFinite(price) && compareAt > price;
  return { onSale, compareAt };
}

export default function MarketplaceDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const id = readId(params.id);

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!id) {
        router.back();
        return;
      }
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const base = await getHttpBase();
          if (!cancelled) setBaseUrl(base);
          const data = await api.get(`/api/marketplace/${id}`);
          if (!cancelled) setListing(data.listing || null);
        } catch (e) {
          console.error(e);
          if (!cancelled) setListing(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  function imageUri(imageUrl) {
    if (!imageUrl || !baseUrl) return null;
    const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    return `${baseUrl}${path}`;
  }

  function onMessageSeller() {
    if (!listing?.seller?.id) return;
    const draft = t("marketplace.chatDraft", { title: listing.title });
    router.push({
      pathname: "/chat",
      params: {
        userId: listing.seller.id,
        userName: listing.seller.name || "",
        initialDraft: draft,
      },
    });
  }

  if (!id) return null;

  return (
    <AppBackground scrollable={false}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("marketplace.detailTitle")}</Text>
      </View>

      {loading ? (
        <View style={[styles.body, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : !listing ? (
        <View style={styles.body}>
          <Text style={styles.subtitle}>{t("marketplace.notFound")}</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {(() => {
            const price = pricingView(listing);
            return (
              <>
          {imageUri(listing.imageUrl) ? (
            <Image source={{ uri: imageUri(listing.imageUrl) }} style={styles.detailImage} resizeMode="cover" />
          ) : null}
          {(listing.isFeatured || price.onSale) ? (
            <View style={styles.badgeRowWrap}>
              {listing.isFeatured ? (
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredBadgeText}>{t("marketplace.featuredBadge")}</Text>
                </View>
              ) : null}
              {price.onSale ? (
                <View style={styles.saleBadge}>
                  <Text style={styles.saleBadgeText}>{t("marketplace.saleBadge")}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.detailTitle}>{listing.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>{formatPrice(listing.priceCents, t)}</Text>
            {price.onSale ? (
              <Text style={styles.priceCompareText}>{formatPrice(price.compareAt, t)}</Text>
            ) : null}
          </View>
          <Text style={styles.detailSeller}>
            {t("marketplace.soldBy")}: {listing.seller?.name || "—"}
          </Text>
          {listing.description ? (
            <Text style={styles.detailDesc}>{listing.description}</Text>
          ) : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={onMessageSeller} activeOpacity={0.9}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>{t("marketplace.messageSeller")}</Text>
          </TouchableOpacity>
              </>
            );
          })()}
        </ScrollView>
      )}
    </AppBackground>
  );
}
