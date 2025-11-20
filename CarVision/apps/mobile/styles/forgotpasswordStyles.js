// apps/mobile/styles/forgotpasswordStyles.js
import { StyleSheet } from "react-native";

const C = {
  text: "#E6E9F5",
  sub: "#A8B2D1",
  primary: "#7C8CFF",
  border: "rgba(255,255,255,.12)",
  glass: "rgba(18,22,33,.72)",
};

export const forgotpasswordStyles = StyleSheet.create({
  topbar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  brandWrap: { paddingTop: 8, alignItems: "center" },
  logo: { color: C.text, fontSize: 26, fontWeight: "900", letterSpacing: 0.5 },
  tagline: { color: C.sub, marginTop: 2, textAlign: "center", fontSize: 13 },
  cardWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 16 },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  h1: { color: C.text, fontSize: 24, fontWeight: "900" },
  h2: { color: C.sub, marginTop: 6, marginBottom: 14 },
  inputWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    height: 52,
  },
  iconLeft: { paddingLeft: 12, paddingRight: 6 },
  input: {
    flex: 1,
    color: C.text,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  btn: {
    marginTop: 16,
    backgroundColor: C.primary,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 12,
  },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  link: { color: C.primary, fontWeight: "800" },
});

