// apps/mobile/app/marketplace-garage.js — garage: manage marketplace listings
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
import { useRouter, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import AppBackground from "../components/layout/AppBackground";
import { api } from "../lib/api";
import { getHttpBase } from "../lib/httpBase";
import { getUser } from "../lib/authStore";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { marketplaceStyles as styles } from "../styles/marketplaceStyles";

const SCREEN_SHELL = { flex: 1, paddingHorizontal: 0, paddingVertical: 0 };

function formatPrice(cents, t) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "—";
  const major = (n / 100).toFixed(2);
  return t("marketplace.priceDisplay", { amount: major });
}

function pricingView(item) {
  const price = Number(item?.priceCents);
  const compareAt = Number(item?.compareAtPriceCents);
  const onSale = Number.isFinite(compareAt) && compareAt > price;
  const discountPercent = onSale ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  return { onSale, compareAt, discountPercent };
}

export default function MarketplaceGarageScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");

  async function load() {
    try {
      const cached = await getUser();
      if (cached?.role !== "GARAGE") {
        router.replace("/");
        return;
      }
      const base = await getHttpBase();
      setBaseUrl(base);
      const data = await api.get("/api/marketplace/mine");
      const list = Array.isArray(data?.listings) ? data.listings : [];
      list.sort((a, b) => {
        if ((b.isFeatured ? 1 : 0) !== (a.isFeatured ? 1 : 0)) {
          return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        }
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
      setListings(list);
    } catch (e) {
      console.error(e);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [])
  );

  function imageUri(imageUrl) {
    if (!imageUrl || !baseUrl) return null;
    const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    return `${baseUrl}${path}`;
  }

  function renderCard(item) {
    const uri = imageUri(item.imageUrl);
    const price = pricingView(item);
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        activeOpacity={0.9}
        onPress={() =>
          router.push({
            pathname: "/marketplace-garage-form",
            params: { id: item.id },
          })
        }
      >
        {uri ? <Image source={{ uri }} style={styles.thumb} resizeMode="cover" /> : <View style={styles.thumb} />}
        {(item.isFeatured || price.onSale) ? (
          <View style={styles.badgeRowWrap}>
            {item.isFeatured ? (
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {!item.isActive ? (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>{t("marketplace.inactive")}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceText}>{formatPrice(item.priceCents, t)}</Text>
          {price.onSale ? (
            <Text style={styles.priceCompareText}>{formatPrice(price.compareAt, t)}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  const featuredListings = listings.filter((item) => !!item.isFeatured);
  const otherListings = listings.filter((item) => !item.isFeatured);

  return (
    <AppBackground scrollable={false} contentContainerStyle={SCREEN_SHELL}>
      <StatusBar barStyle="light-content" />

      <View style={styles.body}>
        <LinearGradient
          colors={["rgba(99,102,241,0.28)", "rgba(15,23,42,0.98)", "rgba(14,165,233,0.16)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.garageListingsHero}
        >
          <View style={styles.garageListingsHeroGlow} />
          <View style={styles.garageListingsHeaderRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
              <Ionicons name="arrow-back" size={22} color={C.text} />
            </TouchableOpacity>
            <View style={styles.garageListingsHeaderCopy}>
              <Text style={styles.garageListingsEyebrow}>Marketplace</Text>
              <Text style={styles.garageListingsTitle}>{t("marketplace.garageTitle")}</Text>
              <Text style={styles.garageListingsSubtitle}>{t("marketplace.garageSubtitle")}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.garageListingsAddBtn}
            onPress={() => router.push({ pathname: "/marketplace-garage-form", params: {} })}
            activeOpacity={0.9}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.garageListingsAddText}>{t("marketplace.addListing")}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 24 }} />
        ) : listings.length === 0 ? (
          <Text style={[styles.subtitle, { textAlign: "center", marginTop: 32 }]}>
            {t("marketplace.garageEmpty")}
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t("nearestGarages.garageFeaturedProductsTitle")}</Text>
              </View>
              {featuredListings.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.subtitle}>{t("nearestGarages.garageFeaturedProductsEmpty")}</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.storefrontRow}
                >
                  {featuredListings.map((item) => (
                    <View key={item.id} style={styles.storefrontCardWrap}>
                      {renderCard(item)}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t("nearestGarages.garageOtherProductsTitle")}</Text>
              </View>
              {otherListings.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.subtitle}>{t("marketplace.garageOtherEmpty")}</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.storefrontRow}
                >
                  {otherListings.map((item) => (
                    <View key={item.id} style={styles.storefrontCardWrap}>
                      {renderCard(item)}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </AppBackground>
  );
}
