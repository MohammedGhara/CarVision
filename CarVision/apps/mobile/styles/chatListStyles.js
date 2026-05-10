// apps/mobile/styles/chatListStyles.js
import { StyleSheet } from "react-native";
import { C } from "./theme";

export const chatListStyles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: C.text,
  },
  toggleBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(99,102,241,0.16)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(15,23,42,0.72)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tabActive: {
    backgroundColor: C.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.sub,
  },
  tabTextActive: {
    color: "#fff",
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  list: {
    padding: 18,
    paddingBottom: 40,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.78)",
    borderRadius: 24,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(124,140,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: C.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: C.sub,
    marginTop: 2,
  },
  time: {
    fontSize: 12,
    color: C.sub,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  lastMessage: {
    flex: 1,
    fontSize: 13,
    color: C.sub,
  },
  unreadBadge: {
    backgroundColor: C.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(250,204,21,0.15)",
  },
  roleText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.amber,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    color: C.sub,
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
});


