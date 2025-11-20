// apps/mobile/app/history.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors } from "../styles/theme";
import { historyStyles as styles } from "../styles/historyStyles";

const C = colors.repairs; // Same theme as repairs

// ⚠️ مهم: هذا هو نفس الـ key الموجود في repairs.js
// حتى نستخدم نفس الـ history الذي يسجّله كود الـ Repairs
const STORAGE_KEY = "carvision.history.v1";

export default function HistoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // newest first
            parsed.sort((a, b) => b.ts - a.ts);
            setItems(parsed);
          }
        }
      } catch (e) {
        console.log("Failed to load history:", e);
        Alert.alert("Error", "Could not load history.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function severityBadgeStyle(sv) {
    if (sv === "CRITICAL") return [styles.badge, styles.badgeCritical];
    if (sv === "WARNING") return [styles.badge, styles.badgeWarning];
    return [styles.badge, styles.badgeNormal];
  }

  async function exportPdf() {
    if (!items.length) {
      Alert.alert("No history", "There are no events to export yet.");
      return;
    }

    try {
      setExporting(true);

      // Build simple HTML for PDF with light theme (better for reading/printing)
      const rowsHtml = items
        .map((it, idx) => {
          const dateStr = new Date(it.ts).toLocaleString();
          const sevRaw = it.severity || "NORMAL";
          const sev = sevRaw.toUpperCase();

          // normalize to 3 classes only: critical / warning / normal
          const sevClass =
            sev === "CRITICAL"
              ? "critical"
              : sev === "WARNING"
              ? "warning"
              : "normal";

          const title = it.title || "";
          const detail = (it.detail || "").replace(/\n/g, "<br/>");

          return `
            <div class="card">
              <div class="head">
                <span class="index">#${items.length - idx}</span>
                <span class="date">${dateStr}</span>
                <span class="sev sev-${sevClass}">${sev}</span>
              </div>
              <div class="title">${title}</div>
              <div class="detail">${detail}</div>
            </div>
          `;
        })
        .join("\n");

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>CarVision – Diagnostic History</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              padding: 24px;
              background: #ffffff;
              color: #111827;
              font-size: 13px;
              line-height: 1.5;
            }
            h1 {
              text-align: center;
              margin: 0 0 4px 0;
              font-size: 20px;
              color: #111827;
            }
            .sub {
              text-align: center;
              font-size: 11px;
              color: #6b7280;
              margin-bottom: 18px;
            }
            .card {
              border-radius: 10px;
              border: 1px solid #e5e7eb;
              padding: 10px 12px;
              margin-bottom: 10px;
              background: #f9fafb;
              page-break-inside: avoid;
            }
            .head {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 11px;
              margin-bottom: 4px;
              gap: 8px;
            }
            .index {
              color: #6b7280;
              font-weight: 500;
            }
            .date {
              color: #6b7280;
              flex: 1;
              text-align: center;
            }
            .sev {
              padding: 3px 9px;
              border-radius: 999px;
              font-weight: 700;
              font-size: 10px;
              border: 1px solid transparent;
              white-space: nowrap;
            }
            .sev-critical {
              background: #fee2e2;
              color: #b91c1c;
              border-color: #fecaca;
            }
            .sev-warning {
              background: #fef3c7;
              color: #92400e;
              border-color: #fde68a;
            }
            .sev-normal {
              background: #dcfce7;
              color: #166534;
              border-color: #bbf7d0;
            }
            .title {
              font-size: 14px;
              font-weight: 700;
              margin-top: 4px;
              margin-bottom: 3px;
              color: #111827;
            }
            .detail {
              font-size: 12px;
              color: #374151;
            }
          </style>
        </head>
        <body>
          <h1>CarVision – Diagnostic History</h1>
          <div class="sub">
            Total events: ${items.length}<br/>
            Generated at: ${new Date().toLocaleString()}
          </div>
          ${rowsHtml}
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share CarVision history",
      });
    } catch (e) {
      console.log("PDF export error:", e);
      Alert.alert("Error", "Could not create PDF report.");
    } finally {
      setExporting(false);
    }
  }


  async function clearHistory() {
    Alert.alert(
      "Clear history",
      "Are you sure you want to delete all diagnostic history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEY);
              setItems([]);
            } catch (e) {
              Alert.alert("Error", "Could not clear history.");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#E6E9F5" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>History</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            onPress={clearHistory}
            style={styles.ghostBtn}
            disabled={!items.length}
          >
            <Text style={styles.ghostText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={exportPdf}
            style={[styles.ghostBtn, exporting && { opacity: 0.7 }]}
            disabled={!items.length || exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={C.text} />
            ) : (
              <Text style={styles.ghostText}>Export PDF</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ color: C.sub, marginTop: 8 }}>Loading history…</Text>
        </View>
      ) : !items.length ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: C.sub }}>No diagnostic events yet.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 24, gap: 10 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: "rgba(255,255,255,0.04)", borderColor: C.border },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        item.severity === "CRITICAL"
                          ? "alert-octagon"
                          : "alert-circle-outline"
                      }
                      size={20}
                      color={
                        item.severity === "CRITICAL"
                          ? C.crit
                          : item.severity === "WARNING"
                          ? C.warn
                          : C.ok
                      }
                    />
                  </View>
                  <Text style={styles.date}>
                    {new Date(item.ts).toLocaleString()}
                  </Text>
                </View>
                <Text style={severityBadgeStyle(item.severity)}>
                  {item.severity || "NORMAL"}
                </Text>
              </View>

              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.detail}>{item.detail}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

