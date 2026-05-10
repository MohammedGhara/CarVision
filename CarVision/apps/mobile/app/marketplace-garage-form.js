// apps/mobile/app/marketplace-garage-form.js — garage: create / edit listing
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Switch,
  StatusBar,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";

import AppBackground from "../components/layout/AppBackground";
import { api } from "../lib/api";
import { getHttpBase } from "../lib/httpBase";
import { getUser } from "../lib/authStore";
import { showCustomAlert } from "../components/CustomAlert";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { marketplaceStyles as styles } from "../styles/marketplaceStyles";

function readId(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value).trim();
}

export default function MarketplaceGarageFormScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const editId = readId(params.id);

  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceText, setPriceText] = useState("");
  const [compareAtPriceText, setCompareAtPriceText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [pickedUri, setPickedUri] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const cached = await getUser();
        if (cached?.role !== "GARAGE") {
          router.replace("/");
          return;
        }
        const base = await getHttpBase();
        if (!cancelled) setBaseUrl(base);

        if (!editId) {
          if (!cancelled) {
            setTitle("");
            setDescription("");
            setPriceText("");
            setCompareAtPriceText("");
            setIsActive(true);
            setIsFeatured(false);
            setExistingImageUrl(null);
            setPickedUri(null);
            setRemoveImage(false);
            setLoading(false);
          }
          return;
        }

        setLoading(true);
        try {
          const data = await api.get(`/api/marketplace/${editId}`);
          const L = data.listing;
          if (!cancelled && L) {
            setTitle(L.title || "");
            setDescription(L.description || "");
            setPriceText(L.priceCents != null ? (Number(L.priceCents) / 100).toFixed(2) : "");
            setCompareAtPriceText(
              L.compareAtPriceCents != null ? (Number(L.compareAtPriceCents) / 100).toFixed(2) : ""
            );
            setIsActive(!!L.isActive);
            setIsFeatured(!!L.isFeatured);
            setExistingImageUrl(L.imageUrl || null);
            setPickedUri(null);
            setRemoveImage(false);
          }
        } catch (e) {
          console.error(e);
          if (!cancelled) showCustomAlert(t("common.error"), String(e.message || e));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [editId])
  );

  function displayImageUri() {
    if (pickedUri) return pickedUri;
    if (removeImage || !existingImageUrl || !baseUrl) return null;
    const path = existingImageUrl.startsWith("/") ? existingImageUrl : `/${existingImageUrl}`;
    return `${baseUrl}${path}`;
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showCustomAlert(t("common.error"), t("marketplace.photoPermission"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setPickedUri(result.assets[0].uri);
    setRemoveImage(false);
  }

  async function onSave() {
    const priceNum = Number(priceText.replace(",", "."));
    const compareAtNumRaw = compareAtPriceText.trim();
    const compareAtNum = compareAtNumRaw ? Number(compareAtNumRaw.replace(",", ".")) : null;
    if (!title.trim()) {
      showCustomAlert(t("common.error"), t("marketplace.titleRequired"));
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      showCustomAlert(t("common.error"), t("marketplace.priceInvalid"));
      return;
    }
    if (compareAtNumRaw) {
      if (!Number.isFinite(compareAtNum) || compareAtNum <= 0) {
        showCustomAlert(t("common.error"), t("marketplace.compareAtPriceInvalid"));
        return;
      }
      if (compareAtNum <= priceNum) {
        showCustomAlert(t("common.error"), t("marketplace.compareAtMustBeHigher"));
        return;
      }
    }

    setSaving(true);
    try {
      if (!editId) {
        const form = new FormData();
        form.append("title", title.trim());
        form.append("description", description.trim());
        form.append("price", String(priceNum));
        form.append("isFeatured", isFeatured ? "true" : "false");
        if (compareAtNumRaw) {
          form.append("compareAtPrice", String(compareAtNum));
        }
        if (pickedUri) {
          const name = pickedUri.split("/").pop() || "listing.jpg";
          form.append("image", {
            uri: pickedUri,
            name,
            type: "image/jpeg",
          });
        }
        await api.postFile("/api/marketplace", form);
        showCustomAlert(t("common.success"), t("marketplace.saveSuccess"));
        router.back();
        return;
      }

      if (pickedUri) {
        const form = new FormData();
        form.append("title", title.trim());
        form.append("description", description.trim());
        form.append("price", String(priceNum));
        form.append("isActive", isActive ? "true" : "false");
        form.append("isFeatured", isFeatured ? "true" : "false");
        if (compareAtNumRaw) {
          form.append("compareAtPrice", String(compareAtNum));
        } else {
          form.append("clearCompareAtPrice", "true");
        }
        const name = pickedUri.split("/").pop() || "listing.jpg";
        form.append("image", {
          uri: pickedUri,
          name,
          type: "image/jpeg",
        });
        await api.putFile(`/api/marketplace/${editId}`, form);
      } else {
        await api.put(`/api/marketplace/${editId}`, {
          title: title.trim(),
          description: description.trim(),
          price: priceNum,
          isActive,
          isFeatured,
          ...(compareAtNumRaw
            ? { compareAtPrice: compareAtNum }
            : { clearCompareAtPrice: true }),
          ...(removeImage ? { removeImage: true } : {}),
        });
      }
      showCustomAlert(t("common.success"), t("marketplace.saveSuccess"));
      router.back();
    } catch (e) {
      showCustomAlert(t("common.error"), String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editId) return;
    Alert.alert(t("marketplace.deleteConfirm"), t("marketplace.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.del(`/api/marketplace/${editId}`);
            router.back();
          } catch (e) {
            showCustomAlert(t("common.error"), String(e.message || e));
          }
        },
      },
    ]);
  }

  const showImg = displayImageUri();

  return (
    <AppBackground scrollable={false}>
      <StatusBar barStyle="light-content" />
      <View style={styles.formHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.formHeaderTitle}>
          {editId ? t("marketplace.editListing") : t("marketplace.newListing")}
        </Text>
        <View style={styles.formHeaderSpacer} />
      </View>

      {loading ? (
        <View style={[styles.body, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>Product details</Text>

            <Text style={styles.label}>{t("marketplace.fieldTitle")}</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t("marketplace.fieldTitlePh")}
              placeholderTextColor={C.sub}
            />

            <View style={styles.priceGrid}>
              <View style={styles.priceField}>
                <Text style={styles.label}>{t("marketplace.fieldOriginalPrice")}</Text>
                <TextInput
                  style={styles.input}
                  value={compareAtPriceText}
                  onChangeText={setCompareAtPriceText}
                  placeholder={t("marketplace.fieldOriginalPricePh")}
                  placeholderTextColor={C.sub}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.priceField}>
                <Text style={styles.label}>{t("marketplace.fieldDiscountPrice")}</Text>
                <TextInput
                  style={styles.input}
                  value={priceText}
                  onChangeText={setPriceText}
                  placeholder={t("marketplace.fieldDiscountPricePh")}
                  placeholderTextColor={C.sub}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Text style={styles.fieldHint}>{t("marketplace.fieldDiscountPriceHint")}</Text>

            <Text style={styles.label}>{t("marketplace.fieldDescription")}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder={t("marketplace.fieldDescriptionPh")}
              placeholderTextColor={C.sub}
              multiline
            />
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>Availability</Text>
            {editId ? (
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchTitle}>{t("marketplace.fieldActive")}</Text>
                  <Text style={styles.switchHint}>Clients can see this listing.</Text>
                </View>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: "#334155", true: C.primary }} />
              </View>
            ) : null}
            <View style={styles.switchRow}>
              <View style={styles.switchCopy}>
                <Text style={styles.switchTitle}>{t("marketplace.fieldFeatured")}</Text>
                <Text style={styles.switchHint}>Show this product first in your marketplace.</Text>
              </View>
              <Switch value={isFeatured} onValueChange={setIsFeatured} trackColor={{ false: "#334155", true: C.primary }} />
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>{t("marketplace.fieldPhoto")}</Text>
            <View style={styles.photoRow}>
              {showImg ? (
                <Image source={{ uri: showImg }} style={styles.previewThumb} resizeMode="cover" />
              ) : (
                <View style={styles.previewThumbPlaceholder}>
                  <Ionicons name="image-outline" size={28} color={C.primary} />
                </View>
              )}
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage} activeOpacity={0.85}>
                  <Ionicons name="image-outline" size={20} color={C.primary} />
                  <Text style={styles.imagePickerText}>{t("marketplace.pickPhoto")}</Text>
                </TouchableOpacity>
                {(existingImageUrl || pickedUri) && !removeImage ? (
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => {
                      setPickedUri(null);
                      setRemoveImage(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.removePhotoText}>{t("marketplace.removePhoto")}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={onSave}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{t("common.save")}</Text>
              )}
            </TouchableOpacity>

            {editId ? (
              <TouchableOpacity style={[styles.secondaryBtn, styles.dangerBtn]} onPress={onDelete} activeOpacity={0.9}>
                <Text style={styles.dangerBtnText}>{t("common.delete")}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      )}
    </AppBackground>
  );
}
