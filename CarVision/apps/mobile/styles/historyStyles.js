// apps/mobile/styles/historyStyles.js
import { StyleSheet } from "react-native";
import { colors } from "./theme";

const C = colors.repairs; // Same theme as repairs

export const historyStyles = StyleSheet.create({
  topbar: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  topTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  ghostBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  ghostText: { color: C.text, fontWeight: "700", fontSize: 12 },
  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  date: { color: C.sub, fontSize: 12 },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontWeight: "800",
    fontSize: 11,
  },
  badgeNormal: {
    backgroundColor: "rgba(31,191,117,.14)",
    color: C.ok,
    borderWidth: 1,
    borderColor: "rgba(31,191,117,.28)",
  },
  badgeWarning: {
    backgroundColor: "rgba(245,183,58,.14)",
    color: C.warn,
    borderWidth: 1,
    borderColor: "rgba(245,183,58,.28)",
  },
  badgeCritical: {
    backgroundColor: "rgba(255,93,93,.14)",
    color: C.crit,
    borderWidth: 1,
    borderColor: "rgba(255,93,93,.28)",
  },
  title: { color: C.text, fontSize: 16, fontWeight: "900", marginTop: 4 },
  detail: { color: C.sub, marginTop: 4, lineHeight: 20 },
});

