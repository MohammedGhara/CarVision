// apps/mobile/components/ForumRoleBadge.js
import React from "react";
import { View, Text } from "react-native";

import { useLanguage } from "../context/LanguageContext";
import { forumStyles as styles } from "../styles/forumStyles";

/** API sends User.role: CLIENT | GARAGE | ADMIN */
export default function ForumRoleBadge({ role }) {
  const { t } = useLanguage();
  const r = (role || "CLIENT").toUpperCase();
  let label = t("forum.roleClient");
  let variant = "client";
  if (r === "GARAGE") {
    label = t("forum.roleGarage");
    variant = "garage";
  } else if (r === "ADMIN") {
    label = t("forum.roleAdmin");
    variant = "admin";
  }

  return (
    <View style={[styles.roleBadge, styles[`roleBadge_${variant}`]]}>
      <Text style={[styles.roleBadgeText, styles[`roleBadgeText_${variant}`]]}>{label}</Text>
    </View>
  );
}
