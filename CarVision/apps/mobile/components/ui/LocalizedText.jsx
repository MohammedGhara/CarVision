import React from "react";
import { Text as RNText } from "react-native";
import { useLanguage } from "../../context/LanguageContext";

/**
 * RTL-aware Text: Arabic / Hebrew start from the correct edge (writingDirection + textAlign).
 * Explicit style.textAlign (e.g. center) still overrides when passed last via [...].
 */
export function LocalizedText({ style, ...rest }) {
  const { isRTL } = useLanguage();
  const dirStyle = isRTL
    ? { writingDirection: "rtl", textAlign: "right" }
    : { writingDirection: "ltr", textAlign: "left" };
  return <RNText {...rest} style={[dirStyle, style]} />;
}
