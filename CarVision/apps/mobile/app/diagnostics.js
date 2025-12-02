// apps/mobile/app/diagnostics.js
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { getWsUrl, checkNetworkChange } from "../lib/wsConfig";
import { describeDtc } from "../lib/dtcDescriptions";
import { useLanguage } from "../context/LanguageContext";
import { diagnosticsStyles as styles } from "../styles/diagnosticsStyles";

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
  const { t } = useLanguage();
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

  // Load WS URL and detect network changes
  useEffect(() => {
    (async () => {
      const url = await getWsUrl();
      setWsUrl(url);
      console.log("📡 WebSocket URL loaded:", url);
    })();
    
    // Check for network changes periodically and when app becomes active
    const checkNetwork = async () => {
      try {
        const changed = await checkNetworkChange();
        if (changed) {
          console.log("🔄 Network changed, re-detecting server...");
          const newUrl = await getWsUrl();
          setWsUrl(newUrl);
        }
      } catch (e) {
        // Ignore errors
      }
    };
    
    const interval = setInterval(checkNetwork, 30000);
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setTimeout(checkNetwork, 1000);
      }
    });
    
    return () => {
      clearInterval(interval);
      subscription?.remove();
    };
  }, []);

  // Connect WebSocket
  useEffect(() => {
    if (!wsUrl) return;

    let ws;
    let timer;
    let failureCount = 0;
    const MAX_FAILURES_BEFORE_REDETECT = 3;

    async function connect() {

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setLink({ status: "up", message: "Connected to adapter" });
        failureCount = 0; // Reset on successful connection
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
        failureCount++;
        setLink({ status: "down", message: "Connection error" });
        try {
          ws.close();
        } catch {}
      };

      ws.onclose = () => {
        failureCount++;
        if (failureCount < MAX_FAILURES_BEFORE_REDETECT) {
          setLink({ status: "down", message: "Disconnected – retrying…" });
        } else {
          setLink({ status: "down", message: "Network changed – re-detecting…" });
        }
        timer = setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      if (timer) clearTimeout(timer);
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
      Alert.alert(t("diagnostics.noCodesToClear"), t("diagnostics.noCodesToClearMessage"));
      return;
    }

    Alert.alert(
      t("diagnostics.clearCodesConfirm"),
      t("diagnostics.clearCodesMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.delete"), style: "destructive", onPress: sendClear },
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
      Alert.alert(t("common.error"), t("diagnostics.exportFailed") || "Could not generate PDF report. Please try again.");
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

  let statusLevel = t("diagnostics.ok");
  let statusText = t("diagnostics.noActiveCodes");
  if (milOn && dtcCount > 0) {
    statusLevel = t("diagnostics.attention");
    statusText = t("diagnostics.checkEngineOn");
  } else if (!milOn && hasCodes) {
    statusLevel = t("diagnostics.historyStatus");
    statusText = t("diagnostics.storedCodes");
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
          <Text style={styles.topTitle}>{t("diagnostics.title")}</Text>
          <Text style={styles.topSubtitle}>{t("diagnostics.subtitle")}</Text>
        </View>

        <View style={styles.rightWrap}>
          {/* NEW: History button */}
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push("/history")}
            activeOpacity={0.85}
          >
            <Ionicons name="time-outline" size={14} color={C.text} />
            <Text style={styles.historyText}>{t("diagnostics.history")}</Text>
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
            <Text style={styles.pill}>{t("diagnostics.mil")}: {milOn ? t("diagnostics.on") : t("diagnostics.off")}</Text>
            <Text style={styles.pill}>{t("diagnostics.codes")}: {dtcCount}</Text>
            <Text style={styles.pill}>{t("diagnostics.ignition")}: {ign === "Unknown" ? t("diagnostics.unknown") : ign}</Text>
          </View>

          <Text style={styles.summaryText}>{statusText}</Text>

          <Text style={styles.helpText}>
            • <Text style={styles.helpStrong}>{t("diagnostics.currentHelp")}</Text>: {t("diagnostics.currentHelpDesc")} {"\n"}
            • <Text style={styles.helpStrong}>{t("diagnostics.pendingHelp")}</Text>: {t("diagnostics.pendingHelpDesc")} {"\n"}
            • <Text style={styles.helpStrong}>{t("diagnostics.permanentHelp")}</Text>: {t("diagnostics.permanentHelpDesc")}
          </Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.mainBtn, { backgroundColor: C.primary }]}
              onPress={exportPdfReport}
            >
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.mainBtnText}>{t("diagnostics.export")} PDF</Text>
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
                {t("diagnostics.clearCodes")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trouble Codes card */}
        <Text style={styles.sectionLabel}>{t("cardata.troubleCodes")}</Text>
        <View style={styles.card}>
          <CodeSection
            title={t("diagnostics.currentCodes")}
            description={t("diagnostics.currentCodesDesc")}
            values={data.dtcs}
          />
          <CodeSection
            title={t("diagnostics.pendingCodes")}
            description={t("diagnostics.pendingCodesDesc")}
            values={data.pending}
          />
          <CodeSection
            title={t("diagnostics.permanentCodes")}
            description={t("diagnostics.permanentCodesDesc")}
            values={data.permanent}
          />
        </View>

        {/* Readiness Snapshot */}
        <Text style={styles.sectionLabel}>{t("diagnostics.readinessSnapshot")}</Text>
        <View style={styles.card}>
          <Text style={styles.bodyText}>
            {t("diagnostics.readinessDescription")}
          </Text>
          <Text style={styles.rawBox}>
            {Array.isArray(data.monitors?.bytes) &&
            data.monitors.bytes.length ? (
              data.monitors.bytes
                .map((b) => "0x" + b.toString(16).padStart(2, "0"))
                .join(" ")
            ) : (
              <>{t("diagnostics.notAvailable")}</>
            )}
          </Text>
          <Text style={[styles.bodyText, { fontSize: 11, opacity: 0.75 }]}>
            {t("diagnostics.readinessNote")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ----- Subcomponents -----

function CodeSection({ title, description, values }) {
  const { t } = useLanguage();
  const list = values && values.length ? values : [];

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.bodyText}>{description}</Text>

      {list.length === 0 ? (
        <View style={styles.emptyChip}>
          <Text style={styles.emptyChipText}>{t("diagnostics.noCodesInCategory")}</Text>
        </View>
      ) : (
        <View style={{ marginTop: 8, gap: 8 }}>
          {list.map((code, idx) => {
            const desc = describeDtc(code) || t("diagnostics.noDescription");
            return (
              <View key={`${code}-${idx}`} style={styles.codeRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{code}</Text>
                  </View>
                  <Text style={styles.codeTitle}>{desc}</Text>
                </View>
                <Text style={styles.codeHint}>
                  {t("diagnostics.codeHint")}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

