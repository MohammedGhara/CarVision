// apps/mobile/styles/settingsStyles.js
import { StyleSheet } from "react-native";
import { colors } from "./theme";

const C = colors.settings;

export const settingsStyles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
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
  h1: { color: C.text, fontSize: 22, fontWeight: "900" },
  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 12,
    marginTop: 12,
  },
  label: { color: C.sub, marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  btn: {
    backgroundColor: C.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  secondary: { backgroundColor: "rgba(255,255,255,0.06)" },
  btnText: { color: "#fff", fontWeight: "800" },
  hint: { color: C.sub, marginTop: 12, lineHeight: 20 },
  section: { color: C.sub, fontWeight: "700", marginTop: 16, marginLeft: 16 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  chip: {
    backgroundColor: "rgba(35,41,70,0.75)",
    color: "#CFD6FF",
    borderColor: "rgba(190,200,255,0.18)",
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  accountLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  accountTitle: { color: C.text, fontSize: 16, fontWeight: "700" },
  accountSub: { color: C.sub, fontSize: 13, marginTop: 2 },
});

