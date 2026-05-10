import React, { useEffect, useMemo, useState } from "react";
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Image, StatusBar, Linking } from "react-native"
import { LocalizedText as Text } from "../components/ui/LocalizedText";
import { useRouter, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import AppBackground from "../components/layout/AppBackground";
import { api } from "../lib/api";
import { getHttpBase } from "../lib/httpBase";
import { getUser } from "../lib/authStore";
import { openNavigationChooser } from "../lib/navigation";
import { showCustomAlert } from "../components/CustomAlert";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { marketplaceStyles as styles } from "../styles/marketplaceStyles";

const garageStorefrontCache = new Map();

function readParam(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value).trim();
}

function formatPrice(cents, t) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "—";
  return t("marketplace.priceDisplay", { amount: (n / 100).toFixed(2) });
}

function pricingView(item) {
  const price = Number(item?.priceCents);
  const compareAt = Number(item?.compareAtPriceCents);
  const hasCompareAt = Number.isFinite(compareAt) && compareAt > 0;
  const onSale = hasCompareAt && Number.isFinite(price) && compareAt > price;
  const discountPercent = onSale ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  return { onSale, compareAt, discountPercent };
}

function toSnippet(text, max = 96) {
  const raw = text != null ? String(text).trim() : "";
  if (!raw) return "";
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1)}…`;
}

function ProductCard({ product, imageUri, t, onOpenProduct }) {
  const uri = imageUri(product.imageUrl);
  const price = pricingView(product);
  return (
    <TouchableOpacity
      key={product.id}
      style={styles.card}
      activeOpacity={0.92}
      onPress={() => onOpenProduct(product.id)}
    >
      {uri ? <Image source={{ uri }} style={styles.thumb} resizeMode="cover" /> : <View style={styles.thumb} />}
      {(product.isFeatured || price.onSale) ? (
        <View style={styles.badgeRowWrap}>
          {product.isFeatured ? (
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
      <Text style={styles.cardTitle} numberOfLines={2}>
        {product.title}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.priceText}>{formatPrice(product.priceCents, t)}</Text>
        {price.onSale ? (
          <Text style={styles.priceCompareText}>{formatPrice(price.compareAt, t)}</Text>
        ) : null}
      </View>
      {product.description ? (
        <Text style={styles.cardMeta} numberOfLines={2}>
          {toSnippet(product.description)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function GarageDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useLanguage();

  const garageId = readParam(params.id);
  const garageName = readParam(params.name);
  const garageEmail = readParam(params.email);
  const garageAddress = readParam(params.address);
  const garageDescription = readParam(params.garageDescription);
  const garageHours = readParam(params.workingHoursText);
  const garageLat = readParam(params.latitude);
  const garageLng = readParam(params.longitude);
  const cachedStorefront = garageStorefrontCache.get(garageId);

  const [loading, setLoading] = useState(!cachedStorefront);
  const [baseUrl, setBaseUrl] = useState(cachedStorefront?.baseUrl || "");
  const [products, setProducts] = useState(cachedStorefront?.products || []);
  const [productsError, setProductsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!garageId) {
        router.back();
        return;
      }
      const me = await getUser();
      if (!me) {
        router.replace("/login");
        return;
      }
      if (me.role === "GARAGE") {
        router.replace("/garage");
        return;
      }
      const existing = garageStorefrontCache.get(garageId);
      if (!existing) {
        setLoading(true);
      } else {
        setBaseUrl(existing.baseUrl || "");
        setProducts(existing.products || []);
        setLoading(false);
      }
      setProductsError("");
      try {
        const base = await getHttpBase();
        if (!cancelled) setBaseUrl(base);
        const data = await api.get(`/api/marketplace/garage/${encodeURIComponent(garageId)}`);
        const nextProducts = Array.isArray(data?.listings) ? data.listings : [];
        garageStorefrontCache.set(garageId, {
          baseUrl: base || "",
          products: nextProducts,
        });
        if (!cancelled) setProducts(nextProducts);
      } catch (e) {
        if (!cancelled) {
          setProductsError(String(e?.message || e));
        }
      } finally {
        if (!cancelled && !existing) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [garageId, router]);

  const heroAddress = useMemo(() => garageAddress || t("nearestGarages.addressUnknown"), [garageAddress, t]);
  const hasEmail = garageEmail.length > 0;
  const hasDescription = garageDescription.length > 0;
  const hasHours = garageHours.length > 0;
  const featuredProducts = useMemo(() => products.filter((p) => !!p?.isFeatured), [products]);
  const otherProducts = useMemo(() => products.filter((p) => !p?.isFeatured), [products]);

  function imageUri(imageUrl) {
    if (!imageUrl || !baseUrl) return null;
    const p = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    return `${baseUrl}${p}`;
  }

  async function onNavigate() {
    await openNavigationChooser({
      latitude: garageLat,
      longitude: garageLng,
      t,
      onError: () => showCustomAlert(t("common.error"), t("nearestGarages.navigateFailed")),
    });
  }

  async function onEmail() {
    if (!hasEmail) return;
    try {
      await Linking.openURL(`mailto:${garageEmail}`);
    } catch (_) {
      showCustomAlert(t("common.error"), t("nearestGarages.emailFailed"));
    }
  }

  function onMessage() {
    router.push({
      pathname: "/chat",
      params: {
        userId: garageId,
        userName: garageName,
        initialDraft: t("nearestGarages.chatInitialDraft"),
      },
    });
  }

  function onOpenProduct(productId) {
    if (!productId) return;
    router.push({
      pathname: "/marketplace-detail",
      params: { id: productId },
    });
  }

  if (!garageId) return null;

  return (
    <AppBackground scrollable={false}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("nearestGarages.garageDetailsTitle")}</Text>
      </View>

      {loading ? (
        <View style={[styles.body, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={[styles.subtitle, { marginTop: 12 }]}>{t("common.loading")}</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          <View style={styles.garageHeroCard}>
            <View style={styles.garageHeroTopRow}>
              <View style={styles.garageHeroIconWrap}>
                <Ionicons name="storefront-outline" size={22} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailTitle}>{garageName || t("nearestGarages.garageFallbackName")}</Text>
                <Text style={[styles.cardMeta, { marginBottom: 0 }]}>{heroAddress}</Text>
              </View>
            </View>
            {hasDescription ? (
              <Text style={styles.garageHeroDescription}>{garageDescription}</Text>
            ) : (
              <Text style={styles.garageHeroMissing}>{t("nearestGarages.garageDescriptionMissing")}</Text>
            )}
            {hasHours ? (
              <View style={styles.badgeRow}>
                <Ionicons name="time-outline" size={14} color={C.sub} />
                <Text style={styles.cardMeta}>{garageHours}</Text>
              </View>
            ) : null}
            {hasEmail ? (
              <View style={styles.badgeRow}>
                <Ionicons name="mail-outline" size={14} color={C.sub} />
                <Text style={styles.cardMeta}>{garageEmail}</Text>
              </View>
            ) : null}

            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.smallBtn} onPress={onNavigate} activeOpacity={0.9}>
                <View style={styles.smallBtnContent}>
                  <Ionicons name="location-outline" size={14} color={C.text} />
                  <Text style={styles.smallBtnText}>{t("nearestGarages.location")}</Text>
                </View>
              </TouchableOpacity>
              {hasEmail ? (
                <TouchableOpacity style={styles.smallBtn} onPress={onEmail} activeOpacity={0.9}>
                  <View style={styles.smallBtnContent}>
                    <Ionicons name="mail-outline" size={14} color={C.text} />
                    <Text style={styles.smallBtnText}>{t("nearestGarages.emailGarage")}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.smallBtn} onPress={onMessage} activeOpacity={0.9}>
                <View style={styles.smallBtnContent}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={C.text} />
                  <Text style={styles.smallBtnText}>{t("nearestGarages.messageGarage")}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t("nearestGarages.garageProductsTitle")}</Text>
            </View>
            <Text style={styles.sectionSubtitle}>{t("nearestGarages.garageProductsSubtitle")}</Text>
          </View>

          {productsError ? (
            <Text style={styles.subtitle}>{productsError}</Text>
          ) : products.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.subtitle}>{t("nearestGarages.garageProductsEmpty")}</Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t("nearestGarages.garageFeaturedProductsTitle")}</Text>
              </View>
              {featuredProducts.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.subtitle}>{t("nearestGarages.garageFeaturedProductsEmpty")}</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.storefrontRow}
                >
                  {featuredProducts.map((product) => (
                    <View key={product.id} style={styles.storefrontCardWrap}>
                      <ProductCard product={product} imageUri={imageUri} t={t} onOpenProduct={onOpenProduct} />
                    </View>
                  ))}
                </ScrollView>
              )}

              {otherProducts.length > 0 ? (
                <>
                  <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
                    <Text style={styles.sectionTitle}>{t("nearestGarages.garageOtherProductsTitle")}</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.storefrontRow}
                  >
                    {otherProducts.map((product) => (
                      <View key={product.id} style={styles.storefrontCardWrap}>
                        <ProductCard product={product} imageUri={imageUri} t={t} onOpenProduct={onOpenProduct} />
                      </View>
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </AppBackground>
  );
}
