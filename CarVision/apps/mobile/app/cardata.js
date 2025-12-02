// apps/mobile/app/cardata.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ImageBackground,
  Alert,
  AppState,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

import { getWsUrl, checkNetworkChange } from "../lib/wsConfig";
import { useLanguage } from "../context/LanguageContext";
import { colors } from "../styles/theme";
import { cardataStyles as styles } from "../styles/cardataStyles";

// ===== CONFIG =====
const MAX_SAMPLES = 300; // limit per logging session

// ===== THEME =====
const C = colors.cardata;

export default function CarData() {
  const router = useRouter();
  const { t } = useLanguage();
  const wsRef = useRef(null);
  const samplesRef = useRef([]); // logged samples (current session only)

  const [wsUrl, setWsUrl] = useState(null);
  const [link, setLink] = useState({ status: "down", message: "Connecting..." });
  const [queued, setQueued] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  const [telemetry, setTelemetry] = useState({
    battery: null,
    rpm: null,
    speed: null,
    coolant: null,
    load: null,
    throttle: null,
    fuel: null,
    iat: null,
    maf: null,
    map: null,
    baro: null,
    stft: null,
    ltft: null,
    dtcs: [],
    pending: [],
    permanent: [],
    monitors: { milOn: false, dtcCount: 0 },
    status: { level: "NORMAL", reason: "" },
  });

  // ----- Load WebSocket URL and detect network changes -----
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
          const newUrl = await getWsUrl(); // This will auto-detect new network
          setWsUrl(newUrl);
        }
      } catch (e) {
        // Ignore errors
      }
    };
    
    // Check every 30 seconds
    const interval = setInterval(checkNetwork, 30000);
    
    // Check when app becomes active
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        setTimeout(checkNetwork, 1000); // Delay slightly
      }
    });
    
    return () => {
      clearInterval(interval);
      subscription?.remove();
    };
  }, []);

  // ----- WebSocket connection -----
  useEffect(() => {
    if (!wsUrl) return;

    let ws;
    let retryTimer;
    let failureCount = 0;
    const MAX_FAILURES_BEFORE_REDETECT = 3;

    async function connect() {

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setLink({ status: "up", message: "Connected" });
        failureCount = 0; // Reset on successful connection
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);

          if (msg.type === "link") {
            setLink({ status: msg.status, message: msg.message });
          }

          if (msg.type === "telemetry") {
            setTelemetry((prev) => {
              const next = { ...prev, ...msg.data };

              // logging: save samples only while isLogging === true
              if (isLogging) {
                samplesRef.current.push({
                  t: Date.now(),
                  rpm: next.rpm,
                  speed: next.speed,
                  coolant: next.coolant,
                  load: next.load,
                  throttle: next.throttle,
                  fuel: next.fuel,
                  iat: next.iat,
                  maf: next.maf,
                  map: next.map,
                  baro: next.baro,
                  stft: next.stft,
                  ltft: next.ltft,
                });

                // keep at most MAX_SAMPLES
                if (samplesRef.current.length > MAX_SAMPLES) {
                  samplesRef.current.shift(); // drop oldest
                }
              }

              return next;
            });
          }

          if (msg.type === "queued") setQueued(true);
          if (msg.type === "ack") setQueued(false);
        } catch {
          // ignore bad messages
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
          setLink({ status: "down", message: "Disconnected - retrying..." });
        } else {
          setLink({ status: "down", message: "Network changed - re-detecting..." });
        }
        if (!retryTimer) retryTimer = setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      try {
        ws && ws.close();
      } catch {}
    };
  }, [wsUrl, isLogging]);

  // ---------- Helpers ----------
  const fmt = (v, unit = "", digits = 0) =>
    v === null || v === undefined
      ? "—"
      : `${typeof v === "number" ? v.toFixed(digits) : v}${unit}`;

  const pct = (v) =>
    v === null || v === undefined ? "—" : `${v.toFixed(0)}%`;

  const signedPct = (v) =>
    v === null || v === undefined
      ? "—"
      : `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`;

  const timeHms = (s) =>
    s == null ? "—" : new Date(s * 1000).toISOString().substr(11, 8);

  const badgeStyle = useMemo(() => {
    const lvl = telemetry?.status?.level || "NORMAL";
    return [
      styles.badge,
      lvl === "CRITICAL"
        ? styles.badgeCritical
        : lvl === "WARNING"
        ? styles.badgeWarning
        : styles.badgeNormal,
    ];
  }, [telemetry]);

  const advisories = useMemo(() => {
    const out = [];
    const vb = Number.parseFloat(telemetry.battery ?? telemetry.moduleVoltage);
    if (!Number.isNaN(vb) && vb < 12.2) out.push("Battery/ECU voltage low (<12.2V)");
    if (telemetry.coolant != null && telemetry.coolant >= 110)
      out.push("Coolant overheat (≥110°C)");
    if (telemetry.oilTemp != null && telemetry.oilTemp >= 125)
      out.push("High oil temperature (≥125°C)");
    if (
      telemetry.fuelRateLph != null &&
      (telemetry.speed ?? 0) < 2 &&
      telemetry.fuelRateLph > 1.2
    )
      out.push("High idle fuel rate");
    if ((telemetry.rpm ?? 0) > 800 && (telemetry.maf ?? 0) === 0)
      out.push("MAF reads 0 while engine running");
    return out;
  }, [telemetry]);

  const onClear = () => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "clearDTCs" }));
    }
  };

  // ----- Start/Stop logging (fresh session) -----
  function toggleLogging() {
    setIsLogging((prev) => {
      const next = !prev;

      // when we turn logging ON -> start a *fresh* session
      if (next) {
        samplesRef.current = []; // clear old data
      }

      return next;
    });
  }

  // ----- Export logged samples as PDF -----
  async function exportPdf() {
    // use only the most recent MAX_SAMPLES (already capped, but safe)
    const samples = samplesRef.current.slice(-MAX_SAMPLES);

    if (!samples.length) {
      Alert.alert(
        "No logged data",
        "Tap 'Start Log', let the engine run or drive for a bit, then stop and export."
      );
      return;
    }

    const rowsHtml = samples
      .map((s, idx) => {
        const time = new Date(s.t).toLocaleTimeString();
        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${time}</td>
            <td>${s.rpm ?? ""}</td>
            <td>${s.speed ?? ""}</td>
            <td>${s.coolant ?? ""}</td>
            <td>${s.load ?? ""}</td>
            <td>${s.throttle ?? ""}</td>
            <td>${s.fuel ?? ""}</td>
            <td>${s.iat ?? ""}</td>
            <td>${s.maf ?? ""}</td>
            <td>${s.map ?? ""}</td>
            <td>${s.baro ?? ""}</td>
            <td>${s.stft ?? ""}</td>
            <td>${s.ltft ?? ""}</td>
          </tr>
        `;
      })
      .join("\n");

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>CarVision – Live Data Log</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            padding: 16px;
            background: #0b0f19;
            color: #e5e7eb;
            font-size: 11px;
          }
          h1 {
            text-align: center;
            margin: 0 0 4px;
          }
          .sub {
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
            margin-bottom: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
          }
          th, td {
            border: 1px solid rgba(156,163,175,0.6);
            padding: 4px 3px;
            text-align: right;
          }
          th {
            background: #111827;
            text-align: center;
          }
          tr:nth-child(even) {
            background: rgba(15,23,42,0.9);
          }
          tr:nth-child(odd) {
            background: rgba(17,24,39,0.9);
          }
          .col-idx { width: 32px; }
          .col-time { width: 60px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>CarVision – Live Data Log</h1>
        <div class="sub">
          Samples: ${samples.length}<br/>
          Generated at: ${new Date().toLocaleString()}
        </div>

        <table>
          <thead>
            <tr>
              <th class="col-idx">#</th>
              <th class="col-time">Time</th>
              <th>RPM</th>
              <th>Speed</th>
              <th>Coolant</th>
              <th>Load%</th>
              <th>Throttle%</th>
              <th>Fuel%</th>
              <th>IAT</th>
              <th>MAF</th>
              <th>MAP</th>
              <th>Baro</th>
              <th>STFT%</th>
              <th>LTFT%</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share CarVision live data log",
      });
    } catch (e) {
      console.log("PDF export error:", e);
      Alert.alert("Error", "Could not create PDF log.");
    }
  }

  const onReconnect = () => {
    try {
      if (wsRef.current) wsRef.current.close();
    } catch {}
  };

  const onRefresh = () => {
    setRefreshing(true);
    onReconnect();
    setTimeout(() => setRefreshing(false), 900);
  };

  // ---------- Tiny UI atoms ----------
  const Bar = ({ value, accent = C.primary }) => {
    if (value === null || value === undefined || isNaN(value)) {
      return (
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: "0%", backgroundColor: accent }]} />
        </View>
      );
    }
    const w = Math.max(0, Math.min(100, value));
    return (
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${w}%`, backgroundColor: accent }]}
        />
      </View>
    );
  };

  function MetricTile({ icon, accent, label, value, hint }) {
    return (
      <View style={styles.tile}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: `${accent}22`,
              borderColor: `${accent}55`,
            },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={22} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.mLabel}>{label}</Text>
          <Text style={styles.mValue}>{value}</Text>
          {hint ? <View style={{ marginTop: 8 }}>{hint}</View> : null}
        </View>
      </View>
    );
  }

  // Primary metrics shown as "Key vitals"
  const primaryMetricDefs = [
    {
      label: "RPM",
      value: fmt(telemetry.rpm, "", 0),
      icon: "engine",
      accent: "#8B5CF6",
    },
    {
      label: "Speed",
      value: fmt(telemetry.speed, " km/h", 0),
      icon: "speedometer",
      accent: "#22C55E",
    },
    {
      label: "Coolant",
      value: fmt(telemetry.coolant, " °C", 0),
      icon: "coolant-temperature",
      accent: "#F97316",
    },
    {
      label: "Battery",
      value: fmt(telemetry.battery ?? telemetry.moduleVoltage, " V", 1),
      icon: "car-battery",
      accent: "#38BDF8",
    },
  ];

  // Engine & fuel gauges
  const engineMetricDefs = [
    {
      label: "Engine Load",
      value: pct(telemetry.load),
      icon: "gauge",
      accent: "#06B6D4",
      hint: <Bar value={telemetry.load ?? 0} accent="#06B6D4" />,
    },
    {
      label: "Throttle",
      value: pct(telemetry.throttle),
      icon: "gauge",
      accent: "#F59E0B",
      hint: <Bar value={telemetry.throttle ?? 0} accent="#F59E0B" />,
    },
    {
      label: "Fuel Level",
      value: pct(telemetry.fuel),
      icon: "gas-station",
      accent: "#10B981",
      hint: <Bar value={telemetry.fuel ?? 0} accent="#10B981" />,
    },
  ];

  // Secondary sensors
  const secondaryMetricDefs = [
    {
      label: "Intake Air",
      value: fmt(telemetry.iat, " °C", 0),
      icon: "thermometer",
      accent: "#60A5FA",
    },
    {
      label: "MAF",
      value:
        telemetry.maf == null ? "—" : `${telemetry.maf.toFixed(1)} g/s`,
      icon: "air-filter",
      accent: "#A78BFA",
    },
    {
      label: "MAP",
      value: telemetry.map == null ? "—" : `${telemetry.map} kPa`,
      icon: "gauge",
      accent: "#34D399",
    },
    {
      label: "Baro",
      value: telemetry.baro == null ? "—" : `${telemetry.baro} kPa`,
      icon: "weather-windy",
      accent: "#F472B6",
    },
    {
      label: "STFT",
      value: signedPct(telemetry.stft),
      icon: "chart-line-variant",
      accent: "#F87171",
      hint: (
        <Bar value={(telemetry.stft ?? 0) + 50} accent="#F87171" />
      ),
    },
    {
      label: "LTFT",
      value: signedPct(telemetry.ltft),
      icon: "chart-line-variant",
      accent: "#FDBA74",
      hint: (
        <Bar value={(telemetry.ltft ?? 0) + 50} accent="#FDBA74" />
      ),
    },
    {
      label: "Oil Temp",
      value: fmt(telemetry.oilTemp, " °C", 0),
      icon: "oil",
      accent: "#F59E0B",
    },
    {
      label: "Ambient",
      value: fmt(telemetry.ambient, " °C", 0),
      icon: "weather-sunny",
      accent: "#22C55E",
    },
    {
      label: "Fuel Rate",
      value:
        telemetry.fuelRateLph == null
          ? "—"
          : `${telemetry.fuelRateLph.toFixed(2)} L/h`,
      icon: "gas-station",
      accent: "#10B981",
    },
    {
      label: "ECU Voltage",
      value:
        telemetry.moduleVoltage == null
          ? "—"
          : `${telemetry.moduleVoltage.toFixed(2)} V`,
      icon: "car-battery",
      accent: "#38BDF8",
    },
    {
      label: "O₂ B1S1",
      value:
        telemetry.o2b1s1V == null
          ? "—"
          : `${telemetry.o2b1s1V.toFixed(3)} V`,
      icon: "molecule-co",
      accent: "#8B5CF6",
    },
    {
      label: "Runtime",
      value: timeHms(telemetry.runtimeSec),
      icon: "clock-outline",
      accent: "#94A3B8",
    },
    {
      label: "Dist MIL",
      value:
        telemetry.distSinceMIL_km == null
          ? "—"
          : `${telemetry.distSinceMIL_km} km`,
      icon: "map-marker-distance",
      accent: "#64748B",
    },
  ];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {/* background image */}
        <ImageBackground
          source={{
            uri: "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?q=80&w=1600&auto=format&fit=crop",
          }}
          style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}
          imageStyle={{ opacity: 0.09 }}
        />

        <LinearGradient colors={[C.bg1, C.bg2]} style={styles.overlay}>
          {/* TOP BAR */}
          <View style={styles.topbar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </TouchableOpacity>

            <View style={{ alignItems: "center" }}>
              <Text style={styles.topTitle}>{t("cardata.title")}</Text>
              <Text style={styles.topSubtitle}>{t("cardata.subtitle")}</Text>
            </View>

            <View style={styles.linkPill}>
              <View
                style={[
                  styles.linkDot,
                  link.status === "up" ? styles.linkDotOn : styles.linkDotOff,
                ]}
              />
              <Text style={styles.linkText}>
                {link.status === "up" ? t("cardata.online") : t("cardata.offline")}
              </Text>
            </View>
          </View>

          {/* Status / hero card */}
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={badgeStyle}>
                {telemetry?.status?.level ?? "NORMAL"}
              </Text>
              <Text style={styles.reasonText}>
                {telemetry?.status?.reason ||
                  "All readings within range, no critical issues detected."}
              </Text>
            </View>

            <View style={styles.statusRowBottom}>
              <Text
                style={[
                  styles.pill,
                  telemetry?.monitors?.milOn ? styles.pillWarn : styles.pillOk,
                ]}
              >
                MIL: {telemetry?.monitors?.milOn ? "ON" : "OFF"}
              </Text>
              <Text style={styles.pill}>
                DTCs: {telemetry?.monitors?.dtcCount ?? 0}
              </Text>
              {advisories.length > 0 && (
                <Text style={styles.advisoryText}>
                  {advisories[0]}
                  {advisories.length > 1 ? " (+ more)" : ""}
                </Text>
              )}
            </View>
          </View>

          {/* ACTION BAR */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                isLogging && { backgroundColor: "rgba(34,197,94,0.12)" },
              ]}
              onPress={toggleLogging}
            >
              <Ionicons
                name={isLogging ? "pause-circle-outline" : "recording-outline"}
                size={18}
                color={C.text}
              />
              <Text style={styles.actionText}>
                {isLogging ? t("cardata.stopLog") : t("cardata.startLog")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={exportPdf}>
              <Ionicons name="download-outline" size={18} color={C.text} />
              <Text style={styles.actionText}>{t("cardata.exportPDF")}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={onReconnect}>
              <Ionicons name="refresh-outline" size={18} color={C.text} />
              <Text style={styles.actionText}>{t("cardata.reconnect")}</Text>
            </TouchableOpacity>
          </View>

          {/* MAIN SCROLL CONTENT */}
          <ScrollView
            refreshControl={
              <RefreshControl
                tintColor={C.text}
                refreshing={refreshing}
                onRefresh={onRefresh}
              />
            }
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Key Vitals */}
            <Text style={styles.groupLabel}>{t("cardata.keyVitals")}</Text>
            <View style={styles.vitalsRow}>
              {primaryMetricDefs.map((m) => (
                <View key={m.label} style={styles.vitalCard}>
                  <View style={styles.vitalHeader}>
                    <MaterialCommunityIcons
                      name={m.icon}
                      size={18}
                      color={m.accent}
                    />
                    <Text style={styles.vitalLabel}>{m.label}</Text>
                  </View>
                  <Text style={styles.vitalValue}>{m.value}</Text>
                </View>
              ))}
            </View>

            {/* Engine & fuel */}
            <Text style={styles.groupLabel}>{t("cardata.engineFuel")}</Text>
            <View style={styles.tiles}>
              {engineMetricDefs.map((m) => (
                <MetricTile key={m.label} {...m} />
              ))}
            </View>

            {/* Sensors */}
            <Text style={styles.groupLabel}>{t("cardata.sensors")}</Text>
            <View style={styles.tilesSmall}>
              {secondaryMetricDefs.map((m) => (
                <MetricTile key={m.label} {...m} />
              ))}
            </View>

            {/* DTCs */}
            <Text style={styles.groupLabel}>{t("cardata.troubleCodes")}</Text>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.h2}>{t("cardata.current")}</Text>
                <TouchableOpacity
                  style={[
                    styles.clearBtn,
                    (queued || link.status !== "up") && { opacity: 0.6 },
                  ]}
                  onPress={onClear}
                  disabled={queued || link.status !== "up"}
                >
                  <Text style={styles.clearBtnText}>
                    {queued ? t("common.loading") : t("cardata.clearDTCs")}
                  </Text>
                </TouchableOpacity>
              </View>
              <Chips values={telemetry?.dtcs} fallback={t("cardata.none")} />

              <Text style={[styles.h2, { marginTop: 12 }]}>{t("cardata.pending")}</Text>
              <Chips values={telemetry?.pending} fallback={t("cardata.none")} />

              <Text style={[styles.h2, { marginTop: 12 }]}>{t("cardata.permanent")}</Text>
              <Chips values={telemetry?.permanent} fallback={t("cardata.none")} />
            </View>
          </ScrollView>

          {/* FOOTER STATUS */}
          <View style={styles.footer}>
            <View
              style={[
                styles.dot,
                link.status === "up" ? styles.dotOn : styles.dotOff,
              ]}
            />
            <Text style={styles.footerText}>
              {link.status === "up" ? t("cardata.live") : t("cardata.offline")} · {link.message}
            </Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Chips({ values, fallback = "None" }) {
  const list = values && values.length ? values : [fallback];
  return (
    <FlatList
      horizontal
      data={list.map((x, i) => ({ id: `${x}-${i}`, text: x }))}
      keyExtractor={(it) => it.id}
      renderItem={({ item }) => <Text style={styles.chip}>{item.text}</Text>}
      contentContainerStyle={{ gap: 8 }}
      showsHorizontalScrollIndicator={false}
    />
  );
}

