// apps/mobile/app/marketplace.js — client: browse marketplace listings
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Image, RefreshControl, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import AppBackground from "../components/layout/AppBackground";
import { api } from "../lib/api";
import { getHttpBase } from "../lib/httpBase";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { marketplaceStyles as styles } from "../styles/marketplaceStyles";

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
  const discountPercent = onSale ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  return { onSale, hasCompareAt, compareAt, discountPercent };
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const qNorm = q.trim().toLowerCase();

  async function load() {
    try {
      const base = await getHttpBase();
      setBaseUrl(base);
      const data = await api.get("/api/marketplace");
      setListings(data.listings || []);
    } catch (e) {
      console.error(e);
      setListings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } finally {
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  function imageUri(imageUrl) {
    if (!imageUrl || !baseUrl) return null;
    const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    return `${baseUrl}${path}`;
  }

  const grouped = useMemo(() => {
    const m = new Map();
    for (const p of listings) {
      const seller = p?.seller;
      const sid = seller?.id;
      if (!sid) continue;
      if (!m.has(sid)) {
        m.set(sid, {
          id: sid,
          seller,
          products: [],
          featuredCount: 0,
          latestAt: p.createdAt || "",
          preview: p,
        });
      }
      const g = m.get(sid);
      g.products.push(p);
      if (p.isFeatured) g.featuredCount += 1;
      const created = p.createdAt || "";
      if (created > g.latestAt) {
        g.latestAt = created;
      }
      if (p.isFeatured && !g.preview?.isFeatured) {
        g.preview = p;
      }
    }
    const arr = Array.from(m.values());
    const filtered = qNorm
      ? arr.filter((g) => {
          const sellerName = String(g.seller?.name || "").toLowerCase();
          const addr = String(g.seller?.address || "").toLowerCase();
          const hasProductMatch = g.products.some((p) => String(p.title || "").toLowerCase().includes(qNorm));
          return sellerName.includes(qNorm) || addr.includes(qNorm) || hasProductMatch;
        })
      : arr;
    filtered.sort((a, b) => {
      if ((b.featuredCount || 0) !== (a.featuredCount || 0)) {
        return (b.featuredCount || 0) - (a.featuredCount || 0);
      }
      return String(b.latestAt).localeCompare(String(a.latestAt));
    });
    return filtered;
  }, [listings, qNorm]);

  const featuredGarages = grouped.filter((g) => g.featuredCount > 0);
  const otherGarages = grouped.filter((g) => g.featuredCount === 0);

  function openGarage(g) {
    const seller = g.seller || {};
    router.push({
      pathname: "/garage-detail",
      params: {
        id: seller.id || "",
        name: seller.name || "",
        email: seller.email || "",
        address: seller.address || "",
        latitude: seller.latitude != null ? String(seller.latitude) : "",
        longitude: seller.longitude != null ? String(seller.longitude) : "",
        garageDescription: seller.garageDescription || "",
        workingHoursText: seller.workingHoursText || "",
      },
    });
  }

  function renderGarageItem({ item }) {
    const preview = item.preview;
    const uri = imageUri(preview?.imageUrl);
    const price = pricingView(preview || {});
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={() => openGarage(item)}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.seller?.name || t("nearestGarages.garageFallbackName")}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.seller?.address || t("nearestGarages.addressUnknown")}
        </Text>
        {uri ? <Image source={{ uri }} style={styles.thumb} resizeMode="cover" /> : <View style={styles.thumb} />}
        {(preview?.isFeatured || price.onSale) ? (
          <View style={styles.badgeRowWrap}>
            {preview?.isFeatured ? (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>{t("marketplace.featuredBadge")}</Text>
              </View>
            ) : null}
            {price.onSale ? (
              <View style={styles.saleBadge}>
                <Text style={styles.saleBadgeText}>
                  {t("marketplace.saleBadgeWithPercent", { percent: price.discountPercent })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.cardMeta} numberOfLines={1}>
          {preview?.title || t("marketplace.previewUnavailable")}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceText}>{formatPrice(preview?.priceCents, t)}</Text>
          {price.onSale ? (
            <Text style={styles.priceCompareText}>{formatPrice(price.compareAt, t)}</Text>
          ) : null}
        </View>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.cardMeta}>
            {t("marketplace.garageFeaturedCount", { count: item.featuredCount })}
          </Text>
          <Text style={styles.imagePickerText}>{t("marketplace.viewGarageStorefront")}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function listHeader() {
    const hasFeatured = featuredGarages.length > 0;
    return (
      <View>
        {hasFeatured ? (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t("marketplace.featuredGaragesTitle")}</Text>
            </View>
            <Text style={styles.sectionSubtitle}>{t("marketplace.featuredGaragesSubtitle")}</Text>
          </View>
        ) : null}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {qNorm ? t("marketplace.searchResultsSectionTitle") : t("marketplace.allGaragesTitle")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <AppBackground scrollable={false}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("marketplace.title")}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.subtitle}>{t("marketplace.subtitle")}</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t("marketplace.searchPlaceholder")}
          placeholderTextColor={C.sub}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
        />

        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={qNorm ? grouped : [...featuredGarages, ...otherGarages]}
            keyExtractor={(item) => item.id}
            renderItem={renderGarageItem}
            ListHeaderComponent={listHeader}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
            ListEmptyComponent={
              <Text style={[styles.subtitle, { textAlign: "center", marginTop: 32 }]}>
                {qNorm ? t("marketplace.searchEmpty") : t("marketplace.empty")}
              </Text>
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        )}
      </View>
    </AppBackground>
  );
}
