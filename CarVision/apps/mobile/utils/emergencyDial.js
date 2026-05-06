// apps/mobile/utils/emergencyDial.js
import { Alert, Linking } from "react-native";

export function confirmDialEmergency(number, t) {
  const n = String(number || "").replace(/[^\d+]/g, "");
  if (!n) {
    Alert.alert(t("common.error"), t("safetyEmergency.invalidNumber"));
    return;
  }
  Alert.alert(t("safetyEmergency.callConfirmTitle"), t("safetyEmergency.callConfirmBody", { number: n }), [
    { text: t("common.cancel"), style: "cancel" },
    {
      text: t("safetyEmergency.callNow"),
      style: "destructive",
      onPress: () => {
        Linking.openURL(`tel:${n}`).catch(() => {
          Alert.alert(t("common.error"), t("safetyEmergency.cannotOpenDialer"));
        });
      },
    },
  ]);
}
