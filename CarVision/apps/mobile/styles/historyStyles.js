// apps/mobile/styles/historyStyles.js
import { StyleSheet } from "react-native";
import { colors } from "./theme";

const C = colors.repairs; // Same theme as repairs

export const historyStyles = StyleSheet.create({
  topbar: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(15,23,42,0.72)",
  },
  topTitle: { color: C.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.2 },
  ghostBtn: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(15,23,42,0.72)",
  },
  ghostText: { color: C.text, fontWeight: "700", fontSize: 12 },
  card: {
    backgroundColor: "rgba(15,23,42,0.78)",
    borderColor: "rgba(148,163,184,0.25)",
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
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
  title: { color: C.text, fontSize: 19, fontWeight: "900", marginTop: 6 },
  detail: { color: C.sub, marginTop: 6, lineHeight: 21, fontSize: 14 },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 34,
    gap: 14,
  },
});

