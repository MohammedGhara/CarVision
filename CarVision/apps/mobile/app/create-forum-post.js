// apps/mobile/app/create-forum-post.js
import React, { useState, useMemo } from "react";
import { View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from "react-native"
import { LocalizedText as Text } from "../components/ui/LocalizedText";
import { LocalizedTextInput as TextInput } from "../components/ui/LocalizedTextInput";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import * as ImagePicker from "expo-image-picker";

import AppBackground from "../components/layout/AppBackground";
import { FORUM_CATEGORIES, forumCategoryKey } from "../constants/forumCategories";
import { createForumPost } from "../lib/forumApi";
import { getUser } from "../lib/authStore";
import { useLanguage } from "../context/LanguageContext";
import { forumStyles as styles } from "../styles/forumStyles";
import { showCustomAlert } from "../components/CustomAlert";

function readParam(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return String(v[0] ?? "").trim();
  return String(v).trim();
}

export default function CreateForumPostScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const initialDtc = readParam(params.initialDtc);
  const initialCategory = readParam(params.initialCategory);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(
    initialCategory && FORUM_CATEGORIES.includes(initialCategory) ? initialCategory : FORUM_CATEGORIES[0]
  );
  const [carBrand, setCarBrand] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [engineType, setEngineType] = useState("");
  const [dtcCode, setDtcCode] = useState(initialDtc);
  const [pickedImageUri, setPickedImageUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const valid = useMemo(() => title.trim() && description.trim() && category, [title, description, category]);

  async function onSubmit() {
    setError("");
    if (!title.trim()) {
      setError(t("forum.validationTitle"));
      return;
    }
    if (!description.trim()) {
      setError(t("forum.validationDescription"));
      return;
    }
    if (!category) {
      setError(t("forum.validationCategory"));
      return;
    }

    const me = await getUser();
    if (!me) {
      showCustomAlert(t("common.error"), t("forum.loginRequired"));
      router.replace("/login");
      return;
    }

    setSubmitting(true);
    try {
      const post = await createForumPost(
        {
          title: title.trim(),
          description: description.trim(),
          category,
          carBrand: carBrand.trim() || undefined,
          carModel: carModel.trim() || undefined,
          carYear: carYear.trim() ? parseInt(carYear.trim(), 10) : undefined,
          engineType: engineType.trim() || undefined,
          dtcCode: dtcCode.trim() || undefined,
        },
        pickedImageUri ? { imageUri: pickedImageUri } : {}
      );
      router.replace({ pathname: "/forum-post-details", params: { id: post.id } });
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showCustomAlert(t("common.error"), t("forum.photoPermissionDenied"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPickedImageUri(result.assets[0].uri);
    }
  }

  return (
    <AppBackground scrollable={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#E5E7EB" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{t("forum.eyebrow")}</Text>
            <Text style={styles.headerTitle}>{t("forum.createTitle")}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t("forum.fieldTitle")}</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder={t("forum.fieldTitlePh")}
              placeholderTextColor="#64748B"
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t("forum.fieldDescription")}</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder={t("forum.fieldDescriptionPh")}
              placeholderTextColor="#64748B"
            />
          </View>

          <View style={{ marginHorizontal: 14, marginBottom: 12 }}>
            <Text style={styles.label}>{t("forum.fieldCategory")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {FORUM_CATEGORIES.map((c) => {
                const active = category === c;
                const lk = forumCategoryKey(c);
                const lab = t(`forum.${lk}`);
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, active && styles.chipActive, { marginRight: 8 }]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                      {lab !== `forum.${lk}` ? lab : c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <Text style={[styles.label, { marginHorizontal: 14, marginBottom: 8 }]}>{t("forum.optionalVehicle")}</Text>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t("forum.fieldBrand")}</Text>
            <TextInput style={styles.textInput} value={carBrand} onChangeText={setCarBrand} placeholderTextColor="#64748B" />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t("forum.fieldModel")}</Text>
            <TextInput style={styles.textInput} value={carModel} onChangeText={setCarModel} placeholderTextColor="#64748B" />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t("forum.fieldYear")}</Text>
            <TextInput
              style={styles.textInput}
              value={carYear}
              onChangeText={setCarYear}
              keyboardType="number-pad"
              placeholderTextColor="#64748B"
            />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t("forum.fieldEngine")}</Text>
            <TextInput style={styles.textInput} value={engineType} onChangeText={setEngineType} placeholderTextColor="#64748B" />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t("forum.fieldDtc")}</Text>
            <TextInput
              style={styles.textInput}
              value={dtcCode}
              onChangeText={(x) => setDtcCode(x.toUpperCase())}
              autoCapitalize="characters"
              placeholder={t("forum.fieldDtcPh")}
              placeholderTextColor="#64748B"
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.label}>{t("forum.addPhoto")}</Text>
            <Text style={[styles.errorText, { color: "#94A3B8", marginBottom: 8, marginTop: 0, marginHorizontal: 0 }]}>{t("forum.photoHint")}</Text>
            {pickedImageUri ? (
              <View>
                <Image source={{ uri: pickedImageUri }} style={{ width: "100%", height: 200, borderRadius: 14, backgroundColor: "rgba(15,23,42,0.8)" }} resizeMode="cover" />
                <TouchableOpacity onPress={() => setPickedImageUri(null)} style={{ marginTop: 8 }}>
                  <Text style={{ color: "#F87171", fontWeight: "800", fontSize: 13 }}>{t("forum.removePhoto")}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.textInput, { alignItems: "center", justifyContent: "center", paddingVertical: 14 }]}
                onPress={pickPhoto}
              >
                <Text style={{ color: "#A5B4FC", fontWeight: "800" }}>{t("forum.addPhoto")}</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (!valid || submitting) && { opacity: 0.55 }]}
            onPress={onSubmit}
            disabled={!valid || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{t("forum.submit")}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}
