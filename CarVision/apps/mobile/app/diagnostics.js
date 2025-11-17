// apps/mobile/app/diagnostics.js
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { getWsUrl } from "../lib/wsConfig";
import { describeDtc } from "../lib/dtcDescriptions";

const C = {
  bg: "#050712",
  card: "rgba(17, 23, 41, 0.96)",
  border: "rgba(148, 163, 184, 0.35)",
  text: "#E5E7EB",
  sub: "#9CA3AF",
  primary: "#7C8CFF",
  ok: "#22C55E",
  warn: "#FACC15",
  crit: "#F97373",
};

export default function Diagnostics() {
  const router = useRouter();
  const wsRef = useRef(null);

  const [wsUrl, setWsUrl] = useState(null);
  const [link, setLink] = useState({ status: "down", message: "Connecting…" });

  const [data, setData] = useState({
    monitors: { milOn: false, dtcCount: 0, ignition: null, bytes: [] },
    dtcs: [],
    pending: [],
    permanent: [],
    adapter: null,
  });

  // Load WS URL
  useEffect(() => {
    (async () => {
      const url = await getWsUrl();
      setWsUrl(url);
    })();
  }, []);

  // Connect WebSocket
  useEffect(() => {
    if (!wsUrl) return;

    let ws;
    let timer;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setLink({ status: "up", message: "Connected to adapter" });
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);

          if (msg.type === "link") {
            setLink({ status: msg.status, message: msg.message });
          }

          if (msg.type === "telemetry") {
            setData((prev) => ({
              ...prev,
              monitors: msg.data.monitors ?? prev.monitors,
              dtcs: msg.data.dtcs ?? prev.dtcs,
              pending: msg.data.pending ?? prev.pending,
              permanent: msg.data.permanent ?? prev.permanent,
              adapter: msg.data.adapter ?? prev.adapter,
            }));
          }

          if (msg.type === "info" && msg.adapter) {
            setData((prev) => ({ ...prev, adapter: msg.adapter }));
          }
        } catch {
          // ignore malformed
        }
      };

      ws.onerror = () => {
        setLink({ status: "down", message: "Connection error" });
        try {
          ws.close();
        } catch {}
      };

      ws.onclose = () => {
        setLink({ status: "down", message: "Disconnected – retrying…" });
        timer = setTimeout(connect, 1500);
      };
    }

    connect();
    return () => {
      clearTimeout(timer);
      try {
        ws && ws.close();
      } catch {}
    };
  }, [wsUrl]);

  // -------- Actions --------

  function sendClear() {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "clearDTCs" }));
    }
  }

  function onClear() {
    if (!data.dtcs?.length && !data.pending?.length && !data.permanent?.length) {
      Alert.alert("No codes", "There are no stored fault codes to clear.");
      return;
    }

    Alert.alert(
      "Clear fault codes?",
      "This will clear stored trouble codes and may turn off the Check Engine Light if no active faults remain. Only do this after fixing the issue.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: sendClear },
      ]
    );
  }

  async function exportPdfReport() {
    try {
      const { monitors, dtcs, pending, permanent, adapter } = data;

      const section = (title, arr) => {
        if (!arr || arr.length === 0) {
          return `<p style="color:#6B7280;margin:2px 0 10px 0;">None</p>`;
        }
        const rows = arr
          .map((code) => {
            const desc = describeDtc(code) || "No description available";
            return `
              <tr>
                <td style="padding:6px 8px;border:1px solid #E5E7EB;font-family:system-ui;font-size:13px;">${code}</td>
                <td style="padding:6px 8px;border:1px solid #E5E7EB;font-family:system-ui;font-size:13px;">${desc}</td>
              </tr>
            `;
          })
          .join("");
        return `
          <table style="border-collapse:collapse;width:100%;margin-bottom:12px;">
            <thead>
              <tr style="background:#F3F4F6;">
                <th style="text-align:left;padding:6px 8px;border:1px solid #E5E7EB;font-family:system-ui;font-size:13px;">Code</th>
                <th style="text-align:left;padding:6px 8px;border:1px solid #E5E7EB;font-family:system-ui;font-size:13px;">Description</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      };

      const rawBytes =
        Array.isArray(monitors?.bytes) && monitors.bytes.length
          ? monitors.bytes
              .map((b) => "0x" + b.toString(16).padStart(2, "0"))
              .join(" ")
          : "Not available";

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>CarVision Diagnostics Report</title>
        </head>
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont; margin: 16px; color:#111827;">
          <h1 style="font-size:22px;margin-bottom:4px;">CarVision Diagnostics Report</h1>
          <p style="margin-top:0;color:#6B7280;font-size:13px;">
            This report summarizes the current diagnostic trouble codes (DTCs) read from your vehicle.
            Share it with your mechanic or keep it for your records.
          </p>

          <hr style="margin:16px 0;" />

          <h2 style="font-size:18px;margin-bottom:4px;">Vehicle / Adapter</h2>
          <p style="margin:0 0 8px 0;font-size:13px;">
            Adapter: <strong>${adapter || "Not reported"}</strong><br/>
            OBD-Link Status: <strong>${link.status.toUpperCase()}</strong> (${link.message})
          </p>

          <h2 style="font-size:18px;margin-bottom:4px;margin-top:12px;">Check Engine Status</h2>
          <p style="margin:0 0 8px 0;font-size:13px;">
            MIL (Check Engine Light): <strong>${
              monitors?.milOn ? "ON" : "OFF"
            }</strong><br/>
            Stored DTC Count: <strong>${monitors?.dtcCount ?? 0}</strong><br/>
            Ignition Type: <strong>${monitors?.ignition || "Unknown"}</strong>
          </p>
          <p style="margin:0 0 12px 0;font-size:12px;color:#6B7280;">
            • <strong>Current codes</strong> are active problems now.<br/>
            • <strong>Pending codes</strong> are issues the ECU is still verifying.<br/>
            • <strong>Permanent codes</strong> remain until the ECU confirms several clean drive cycles.
          </p>

          <h2 style="font-size:18px;margin-bottom:4px;margin-top:12px;">Current Trouble Codes</h2>
          ${section("Current", dtcs)}

          <h2 style="font-size:18px;margin-bottom:4px;margin-top:12px;">Pending Trouble Codes</h2>
          ${section("Pending", pending)}

          <h2 style="font-size:18px;margin-bottom:4px;margin-top:12px;">Permanent Trouble Codes</h2>
          ${section("Permanent", permanent)}

          <h2 style="font-size:18px;margin-bottom:4px;margin-top:12px;">Readiness Snapshot</h2>
          <p style="margin:0 0 8px 0;font-size:13px;">
            Raw readiness bytes (PID 01):<br/>
            <code style="font-size:12px;background:#F9FAFB;padding:4px 6px;border-radius:4px;">
              ${rawBytes}
            </code>
          </p>
          <p style="margin:0;font-size:11px;color:#6B7280;">
            Note: Some modules and readiness flags vary between manufacturers.  
            This report is for information only and does not replace professional diagnosis.
          </p>
        </body>
        </html>
      `;

      const file = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share diagnostics report",
      });
    } catch (e) {
      console.log("exportPdfReport failed:", e);
      Alert.alert("Export failed", "Could not generate PDF report. Please try again.");
    }
  }

  // -------- Derived UI state --------

  const milOn = !!data.monitors?.milOn;
  const dtcCount = data.monitors?.dtcCount ?? 0;
  const hasCodes =
    (data.dtcs?.length || 0) +
      (data.pending?.length || 0) +
      (data.permanent?.length || 0) >
    0;

  let statusLevel = "OK";
  let statusText = "No active trouble codes reported.";
  if (milOn && dtcCount > 0) {
    statusLevel = "ATTENTION";
    statusText =
      "Your Check Engine Light is ON and there are active trouble codes. We recommend having the vehicle checked.";
  } else if (!milOn && hasCodes) {
    statusLevel = "HISTORY";
    statusText =
      "There are stored or historical codes. If the car drives normally, you can monitor and clear if needed.";
  }

  const ign = data.monitors?.ignition || "Unknown";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.topTitle}>Diagnostics</Text>
          <Text style={styles.topSubtitle}>Understand your Check Engine Light</Text>
        </View>

        <View style={styles.rightWrap}>
          {/* NEW: History button */}
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push("/history")}
            activeOpacity={0.85}
          >
            <Ionicons name="time-outline" size={14} color={C.text} />
            <Text style={styles.historyText}>History</Text>
          </TouchableOpacity>

          {data.adapter ? (
            <Text style={styles.adapterText} numberOfLines={1}>
              {data.adapter}
            </Text>
          ) : null}
          <View
            style={[
              styles.dot,
              link.status === "up" ? styles.dotOn : styles.dotOff,
            ]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        {/* Summary card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text
              style={[
                styles.badge,
                statusLevel === "OK"
                  ? styles.badgeOk
                  : statusLevel === "ATTENTION"
                  ? styles.badgeWarn
                  : styles.badgeInfo,
              ]}
            >
              {statusLevel}
            </Text>
            <Text style={styles.pill}>MIL: {milOn ? "ON" : "OFF"}</Text>
            <Text style={styles.pill}>Codes: {dtcCount}</Text>
            <Text style={styles.pill}>Ignition: {ign}</Text>
          </View>

          <Text style={styles.summaryText}>{statusText}</Text>

          <Text style={styles.helpText}>
            • <Text style={styles.helpStrong}>Current</Text>: active issues now {"\n"}
            • <Text style={styles.helpStrong}>Pending</Text>: ECU is still checking these {"\n"}
            • <Text style={styles.helpStrong}>Permanent</Text>: stored until several clean drive cycles
          </Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.mainBtn, { backgroundColor: C.primary }]}
              onPress={exportPdfReport}
            >
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.mainBtnText}>Export PDF report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mainBtn,
                { backgroundColor: "rgba(248, 113, 113, 0.18)" },
              ]}
              onPress={onClear}
            >
              <Ionicons name="trash-outline" size={18} color={C.crit} />
              <Text style={[styles.mainBtnText, { color: C.crit }]}>
                Clear codes
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trouble Codes card */}
        <Text style={styles.sectionLabel}>Trouble codes</Text>
        <View style={styles.card}>
          <CodeSection
            title="Current codes"
            description="Active problems that can turn on the Check Engine Light."
            values={data.dtcs}
          />
          <CodeSection
            title="Pending codes"
            description="Problems the ECU is still verifying. If they repeat, they become current."
            values={data.pending}
          />
          <CodeSection
            title="Permanent codes"
            description="Historical/emission-related codes stored until the ECU sees several clean drive cycles."
            values={data.permanent}
          />
        </View>

        {/* Readiness Snapshot */}
        <Text style={styles.sectionLabel}>Readiness snapshot</Text>
        <View style={styles.card}>
          <Text style={styles.bodyText}>
            Raw readiness bytes (PID 01) from the ECU. These indicate which
            emission and system monitors have completed since the last reset.
          </Text>
          <Text style={styles.rawBox}>
            {Array.isArray(data.monitors?.bytes) &&
            data.monitors.bytes.length ? (
              data.monitors.bytes
                .map((b) => "0x" + b.toString(16).padStart(2, "0"))
                .join(" ")
            ) : (
              <>Not available from this vehicle.</>
            )}
          </Text>
          <Text style={[styles.bodyText, { fontSize: 11, opacity: 0.75 }]}>
            Note: Interpretation of these bits varies slightly between
            manufacturers. A mechanic can use them to verify if the vehicle is
            ready for an emissions or inspection test.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ----- Subcomponents -----

function CodeSection({ title, description, values }) {
  const list = values && values.length ? values : [];

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.bodyText}>{description}</Text>

      {list.length === 0 ? (
        <View style={styles.emptyChip}>
          <Text style={styles.emptyChipText}>No codes in this category</Text>
        </View>
      ) : (
        <View style={{ marginTop: 8, gap: 8 }}>
          {list.map((code, idx) => {
            const desc = describeDtc(code) || "No description available.";
            return (
              <View key={`${code}-${idx}`} style={styles.codeRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{code}</Text>
                  </View>
                  <Text style={styles.codeTitle}>{desc}</Text>
                </View>
                <Text style={styles.codeHint}>
                  If the light is on or the car drives unusually (loss of
                  power, shaking, noises), avoid heavy driving and contact a
                  mechanic as soon as possible.
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ----- Styles -----

const styles = StyleSheet.create({
  topbar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
  },
  topTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  topSubtitle: { color: C.sub, fontSize: 11, marginTop: 2 },
  rightWrap: {
    alignItems: "flex-end",
    gap: 4,
    width: 110,
  },
  adapterText: {
    color: C.sub,
    fontSize: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: "#4B5563" },
  dotOn: { backgroundColor: C.ok },
  dotOff: { backgroundColor: "#4B5563" },

  // NEW: history button styles
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(15,23,42,0.9)",
    marginBottom: 2,
  },
  historyText: {
    color: C.text,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
  },

  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 12,
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "800",
  },
  badgeOk: {
    backgroundColor: "rgba(34,197,94,0.12)",
    color: C.ok,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
  },
  badgeWarn: {
    backgroundColor: "rgba(250,204,21,0.12)",
    color: C.warn,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.38)",
  },
  badgeInfo: {
    backgroundColor: "rgba(129,140,248,0.12)",
    color: "#A5B4FC",
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.40)",
  },

  pill: {
    backgroundColor: "rgba(15,23,42,0.9)",
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
  },

  summaryText: {
    marginTop: 10,
    color: C.text,
    fontSize: 13,
    fontWeight: "600",
  },
  helpText: {
    marginTop: 8,
    color: C.sub,
    fontSize: 12,
    lineHeight: 16,
  },
  helpStrong: {
    fontWeight: "700",
    color: C.text,
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  mainBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: "center",
  },
  mainBtnText: {
    color: "#F9FAFB",
    fontWeight: "800",
    fontSize: 13,
  },

  sectionLabel: {
    color: C.sub,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginTop: 16,
    marginLeft: 16,
    fontSize: 12,
  },
  h2: {
    color: C.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  bodyText: {
    color: C.sub,
    fontSize: 12,
    lineHeight: 16,
  },

  emptyChip: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyChipText: {
    color: C.sub,
    fontSize: 12,
  },

  codeRow: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(248,250,252,0.06)",
    borderWidth: 1,
    borderColor: "rgba(209,213,219,0.45)",
    marginRight: 8,
  },
  codeBadgeText: {
    color: "#E5E7EB",
    fontWeight: "800",
    fontSize: 11,
  },
  codeTitle: {
    color: C.text,
    fontWeight: "700",
    fontSize: 13,
    flexShrink: 1,
  },
  codeHint: {
    color: C.sub,
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
  },

  rawBox: {
    marginTop: 8,
    marginBottom: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: C.border,
    color: "#E5E7EB",
    fontSize: 12,
    fontFamily: "monospace",
  },
});
