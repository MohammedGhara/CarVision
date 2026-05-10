import React from "react";
import { TextInput as RNTextInput } from "react-native";
import { useLanguage } from "../../context/LanguageContext";

export function LocalizedTextInput({ style, ...rest }) {
  const { isRTL } = useLanguage();
  const dirStyle = isRTL
    ? { writingDirection: "rtl", textAlign: "right" }
    : { writingDirection: "ltr", textAlign: "left" };
  return <RNTextInput {...rest} style={[dirStyle, style]} />;
}
