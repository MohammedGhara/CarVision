// apps/mobile/styles/settingsStyles.js
import { StyleSheet } from "react-native";
import { colors } from "./theme";

const C = colors.settings;

export const settingsStyles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
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
  h1: { color: C.text, fontSize: 22, fontWeight: "900" },
  card: {
    backgroundColor: "rgba(15,23,42,0.78)",
    borderColor: "rgba(148,163,184,0.25)",
    borderWidth: 1,
    borderRadius: 24,
    padding: 17,
    marginHorizontal: 18,
    marginTop: 14,
  },
  label: { color: C.sub, marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    color: C.text,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(2,6,23,0.34)",
  },
  btn: {
    backgroundColor: C.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  secondary: { backgroundColor: "rgba(255,255,255,0.06)" },
  btnText: { color: "#fff", fontWeight: "800" },
  hint: { color: C.sub, marginTop: 12, lineHeight: 20 },
  section: {
    color: C.sub,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 22,
    marginLeft: 22,
    fontSize: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 18,
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

