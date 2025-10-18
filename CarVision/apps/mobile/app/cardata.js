import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Ionicons from "@expo/vector-icons/Ionicons"; // (for the back arrow if you want)
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
// ====== CONFIG ======
//const WS_URL = "ws://192.168.1.7:5173/ws"; // <-- set to your server
import { getWsUrl } from "../lib/wsConfig";
export default function CarData() {
  const router = useRouter();
  const wsRef = useRef(null);
  const [link, setLink] = useState({ status: "down", message: "Connecting..." });
  const [queued, setQueued] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
    const [wsUrl, setWsUrl] = useState(null);
  const samplesRef = useRef([]);
  const [isLogging, setIsLogging] = useState(false);
  const [telemetry, setTelemetry] = useState({
    battery: null, rpm: null, speed: null, coolant: null,
    load: null, throttle: null, fuel: null, iat: null, maf: null, map: null, baro: null,
    stft: null, ltft: null,
    dtcs: [], pending: [], permanent: [],
    monitors: { milOn: false, dtcCount: 0 },
    status: { level: "NORMAL", reason: "" }
  });

  // ---------- WebSocket ----------
    useEffect(() => {
    let mounted = true;
    (async () => {
        const url = await getWsUrl();
        if (mounted) setWsUrl(url);
    })();
    return () => { mounted = false; };
    }, []);
  useEffect(() => {
  if (!wsUrl) return;             // wait until URL is loaded

  let ws;
  let retryTimer;

  function connect() {
    ws = new WebSocket(wsUrl);    // <-- use the saved URL
    wsRef.current = ws;

    ws.onopen = () => {
      setLink({ status: "up", message: "Connected" });
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "link") setLink({ status: msg.status, message: msg.message });
        if (msg.type === "telemetry") {
        setTelemetry((t) => {
          const next = { ...t, ...msg.data };
          if (isLogging) {
            samplesRef.current.push({
              t: Date.now(),
              rpm: next.rpm, speed: next.speed, coolant: next.coolant,
              load: next.load, throttle: next.throttle, fuel: next.fuel,
              iat: next.iat, maf: next.maf, map: next.map, baro: next.baro,
              stft: next.stft, ltft: next.ltft
            });
            if (samplesRef.current.length > 5000) samplesRef.current.shift(); // keep memory bounded
          }
          return next;
        });
      }

        if (msg.type === "queued") setQueued(true);
        if (msg.type === "ack") setQueued(false);
      } catch {}
    };
    ws.onerror = () => {
      setLink({ status: "down", message: "Error" });
      try { ws.close(); } catch {}
    };
    ws.onclose = () => {
      setLink({ status: "down", message: "Disconnected" });
      if (!retryTimer) retryTimer = setTimeout(connect, 1800);
    };
  }

  connect();
  return () => { try { ws && ws.close(); } catch {} };
}, [wsUrl]);   // <-- re-run if the saved URL changes
  // ---------- Helpers ----------
  const fmt = (v, unit = "", digits = 0) =>
    (v === null || v === undefined) ? "—" : `${typeof v === "number" ? v.toFixed(digits) : v}${unit}`;
  const pct = (v) => (v === null || v === undefined) ? "—" : `${v.toFixed(0)}%`;
  const signedPct = (v) => (v === null || v === undefined) ? "—" : `${(v >= 0 ? "+" : "")}${v.toFixed(0)}%`;

  const badgeStyle = useMemo(() => {
    const lvl = telemetry?.status?.level || "NORMAL";
    return [
      styles.badge,
      lvl === "CRITICAL" ? styles.badgeCritical : (lvl === "WARNING" ? styles.badgeWarning : styles.badgeNormal)
    ];
  }, [telemetry]);

 const advisories = useMemo(() => {
  const out = [];
  const vb = Number.parseFloat(telemetry.battery ?? telemetry.moduleVoltage);
  if (!Number.isNaN(vb) && vb < 12.2) out.push("Battery/ECU voltage low (<12.2V)");
  if (telemetry.coolant != null && telemetry.coolant >= 110) out.push("Coolant overheat (≥110°C)");
  if (telemetry.oilTemp != null && telemetry.oilTemp >= 125) out.push("High oil temperature (≥125°C)");
  if (telemetry.fuelRateLph != null && (telemetry.speed ?? 0) < 2 && telemetry.fuelRateLph > 1.2)
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
  function toggleLogging() {
    setIsLogging((v) => !v);
  }

  async function exportCsv() {
    try {
      const rows = samplesRef.current.map(s =>
        [s.t, s.rpm, s.speed, s.coolant, s.load, s.throttle, s.fuel, s.iat, s.maf, s.map, s.baro, s.stft, s.ltft].join(",")
      );
      const header = "ts,rpm,speed,coolant,load,throttle,fuel,iat,maf,map,baro,stft,ltft\n";
      const csv = header + rows.join("\n");
      const path = FileSystem.cacheDirectory + `carvision_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv);
      await Sharing.shareAsync(path);
    } catch (e) {
      console.log("Export CSV failed:", e);
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
  const Bar = ({ value, accent = "#7C8CFF" }) => {
    if (value === null || value === undefined || isNaN(value)) {
      return <View style={styles.barTrack}><View style={[styles.barFill, { width: "0%" }]} /></View>;
    }
    const w = Math.max(0, Math.min(100, value));
    return (
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${w}%`, backgroundColor: accent }]} />
      </View>
    );
  };

  function MetricTile({ icon, accent, label, value, hint }) {
    return (
      <View style={styles.tile}>
        <View style={[styles.iconWrap, { backgroundColor: `${accent}22`, borderColor: `${accent}44` }]}>
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

  // Primary, user-facing metrics with icons
  const primaryMetricDefs = [
    { label: "Battery",  value: fmt(telemetry.battery, "", 1), icon: "car-battery", accent: "#38BDF8" },
    { label: "RPM",      value: fmt(telemetry.rpm, "", 0),     icon: "engine",       accent: "#8B5CF6" },
    { label: "Speed",    value: fmt(telemetry.speed, " km/h", 0), icon: "speedometer", accent: "#22C55E" },
    { label: "Coolant",  value: fmt(telemetry.coolant, " °C", 0), icon: "coolant-temperature", accent: "#F97316" },
    { label: "Engine Load", value: pct(telemetry.load), icon: "gauge", accent: "#06B6D4",
      hint: <Bar value={telemetry.load ?? 0} accent="#06B6D4" /> },
    { label: "Throttle", value: pct(telemetry.throttle), icon: "gauge", accent: "#F59E0B",
      hint: <Bar value={telemetry.throttle ?? 0} accent="#F59E0B" /> },
    { label: "Fuel Level", value: pct(telemetry.fuel), icon: "gas-station", accent: "#10B981",
      hint: <Bar value={telemetry.fuel ?? 0} accent="#10B981" /> },
  ];
  const timeHms = (s) => (s==null) ? "—" : new Date(s*1000).toISOString().substr(11,8);

  // Secondary sensors (smaller tiles)
  const secondaryMetricDefs = [
    { label: "Intake Air", value: fmt(telemetry.iat, " °C", 0), icon: "thermometer", accent: "#60A5FA" },
    { label: "MAF", value: telemetry.maf == null ? "—" : `${telemetry.maf.toFixed(1)} g/s`, icon: "air-filter", accent: "#A78BFA" },
    { label: "MAP", value: telemetry.map == null ? "—" : `${telemetry.map} kPa`, icon: "gauge", accent: "#34D399" },
    { label: "Baro", value: telemetry.baro == null ? "—" : `${telemetry.baro} kPa`, icon: "weather-windy", accent: "#F472B6" },
    { label: "STFT", value: signedPct(telemetry.stft), icon: "chart-line-variant", accent: "#F87171",
      hint: <Bar value={(telemetry.stft ?? 0) + 50} accent="#F87171" /> },
    { label: "LTFT", value: signedPct(telemetry.ltft), icon: "chart-line-variant", accent: "#FDBA74",
      hint: <Bar value={(telemetry.ltft ?? 0) + 50} accent="#FDBA74" /> },
    { label: "Oil Temp", value: fmt(telemetry.oilTemp, " °C", 0), icon: "oil", accent: "#F59E0B" },
    { label: "Ambient", value: fmt(telemetry.ambient, " °C", 0), icon: "weather-sunny", accent: "#22C55E" },
    { label: "Fuel Rate", value: telemetry.fuelRateLph==null ? "—" : `${telemetry.fuelRateLph.toFixed(2)} L/h`, icon: "gas-station", accent: "#10B981" },
    { label: "ECU Voltage", value: telemetry.moduleVoltage==null ? "—" : `${telemetry.moduleVoltage.toFixed(2)} V`, icon: "car-battery", accent: "#38BDF8" },
    { label: "O₂ B1S1", value: telemetry.o2b1s1V==null ? "—" : `${telemetry.o2b1s1V.toFixed(3)} V`, icon: "molecule-co", accent: "#8B5CF6" },
    { label: "Runtime", value: timeHms(telemetry.runtimeSec), icon: "clock-outline", accent: "#94A3B8" },
    { label: "Dist MIL", value: telemetry.distSinceMIL_km==null ? "—" : `${telemetry.distSinceMIL_km} km`, icon: "map-marker-distance", accent: "#64748B" },
  ];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>

        {/* TOP BAR with Back + Title + Reconnect */}
       <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={24} color="#E6E9F5" />
        </TouchableOpacity>

        <Text style={styles.topTitle}>Live Data</Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* ✅ correct: used only in onPress */}
          <TouchableOpacity style={styles.ghostBtn} onPress={toggleLogging}>
            <Text style={styles.ghostText}>{isLogging ? "Stop Log" : "Start Log"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={exportCsv}>
            <Text style={styles.ghostText}>Export</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={onReconnect}>
            <Text style={styles.ghostText}>Reconnect</Text>
          </TouchableOpacity>
        </View>
      </View>



        {/* Status / hero */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={badgeStyle}>{telemetry?.status?.level ?? "NORMAL"}</Text>
            <Text style={styles.reason}>
              {telemetry?.status?.reason || "All readings within range, no DTCs"}
            </Text>
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <Text style={[styles.pill, telemetry?.monitors?.milOn ? styles.pillWarn : styles.pillOk]}>
              MIL: {telemetry?.monitors?.milOn ? "ON" : "OFF"}
            </Text>
            <Text style={styles.pill}>DTC Count: {telemetry?.monitors?.dtcCount ?? 0}</Text>
            <View style={styles.dot} />
            <Text style={styles.statusText}>{link.message}</Text>
          </View>
        </View>

        {/* Content */}
        <ScrollView
          refreshControl={<RefreshControl tintColor="#E6E9F5" refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {/* Primary Metrics */}
          <Text style={styles.groupLabel}>Live Metrics</Text>
          <View style={styles.tiles}>
            {primaryMetricDefs.map((m) => (
              <MetricTile key={m.label} {...m} />
            ))}
          </View>

          {/* Secondary sensors */}
          <Text style={styles.groupLabel}>Sensors</Text>
          <View style={styles.tilesSmall}>
            {secondaryMetricDefs.map((m) => (
              <MetricTile key={m.label} {...m} />
            ))}
          </View>

          {/* DTCs */}
          <Text style={styles.groupLabel}>Trouble Codes</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.h2}>Current</Text>
              <TouchableOpacity style={styles.btn} onPress={onClear} disabled={queued || link.status !== "up"}>
                <Text style={styles.btnText}>{queued ? "Clearing…" : "Clear DTCs"}</Text>
              </TouchableOpacity>
            </View>
            <Chips values={telemetry?.dtcs} fallback="None" />

            <Text style={[styles.h2, { marginTop: 12 }]}>Pending</Text>
            <Chips values={telemetry?.pending} fallback="None" />

            <Text style={[styles.h2, { marginTop: 12 }]}>Permanent</Text>
            <Chips values={telemetry?.permanent} fallback="None" />
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          <View style={[styles.dot, link.status === "up" ? styles.dotOn : styles.dotOff]} />
          <Text style={styles.footerText}>
            {link.status === "up" ? "Live" : "Offline"} · {link.message}
          </Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Chips({ values, fallback = "None" }) {
  const list = (values && values.length) ? values : [fallback];
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

// ====== THEME ======
const C = {
  bg: "#0B0F19",
  card: "rgba(22,26,36,0.85)",
  border: "rgba(255,255,255,0.06)",
  text: "#E6E9F5",
  sub: "#A8B2D1",
  primary: "#7C8CFF",
  ok: "#1FBF75",
  warn: "#F5B73A",
  crit: "#FF5D5D",
  chipBg: "rgba(35,41,70,0.75)",
  chipBorder: "rgba(190,200,255,0.18)",
};

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor: C.bg },

  // TOP BAR
  topbar:{
    paddingHorizontal:12, paddingTop:6, paddingBottom:6,
    flexDirection:"row", alignItems:"center", justifyContent:"space-between",
  },
  backBtn:{
    width:40, height:40, borderRadius:12, alignItems:"center", justifyContent:"center",
    borderWidth:1, borderColor:C.border, backgroundColor:"rgba(255,255,255,0.03)"
  },
  backIcon:{ color:C.text, fontSize:24, fontWeight:"900", lineHeight:24 },
  topTitle:{ color:C.text, fontSize:18, fontWeight:"800" },

  // Cards
  card:{
    backgroundColor:C.card, borderColor:C.border, borderWidth:1, borderRadius:16,
    padding:14, marginHorizontal:12, marginTop:12,
  },
  row:{ flexDirection:"row", alignItems:"center", gap:10, flexWrap:"wrap" },

  // Badges
  badge:{ paddingVertical:4, paddingHorizontal:10, borderRadius:999, fontWeight:"800" },
  badgeNormal:{ backgroundColor:"rgba(31,191,117,.14)", color:C.ok, borderWidth:1, borderColor:"rgba(31,191,117,.28)" },
  badgeWarning:{ backgroundColor:"rgba(245,183,58,.14)", color:C.warn, borderWidth:1, borderColor:"rgba(245,183,58,.28)" },
  badgeCritical:{ backgroundColor:"rgba(255,93,93,.14)", color:C.crit, borderWidth:1, borderColor:"rgba(255,93,93,.28)" },
  reason:{ color:C.sub, flexShrink:1 },

  // Section label
  groupLabel:{ color:C.sub, fontWeight:"700", letterSpacing:0.4, marginTop:14, marginLeft:16 },

  // Tiles grid
  tiles:{
    paddingHorizontal:12, marginTop:8, flexDirection:"row", flexWrap:"wrap", gap:12,
  },
  tilesSmall:{
    paddingHorizontal:12, marginTop:8, flexDirection:"row", flexWrap:"wrap", gap:12,
  },
  tile:{
    flexBasis: "47%",
    backgroundColor:"rgba(19,22,34,0.9)", borderColor:C.border, borderWidth:1, borderRadius:14,
    padding:12, gap:10, flexDirection:"row", alignItems:"center",
  },
  iconWrap:{
    width:36, height:36, borderRadius:12, alignItems:"center", justifyContent:"center",
    borderWidth:1,
  },

  mLabel:{ color:C.sub, fontSize:12 },
  mValue:{ color:C.text, fontSize:20, fontWeight:"700" },

  // Chips / Pills
  chip:{ backgroundColor:C.chipBg, color:"#CFD6FF", borderColor:C.chipBorder, borderWidth:1, paddingVertical:6, paddingHorizontal:10, borderRadius:999 },
  pill:{ backgroundColor:"rgba(255,255,255,0.06)", color:C.text, borderWidth:1, borderColor:C.border, paddingVertical:6, paddingHorizontal:10, borderRadius:999 },
  pillOk:{ backgroundColor:"rgba(31,191,117,.12)", color:C.ok, borderColor:"rgba(31,191,117,.28)" },
  pillWarn:{ backgroundColor:"rgba(245,183,58,.12)", color:C.warn, borderColor:"rgba(245,183,58,.28)" },

  h2:{ color:C.text, fontSize:16, fontWeight:"800" },

  // Buttons
  btn:{ backgroundColor:C.primary, paddingHorizontal:12, paddingVertical:10, borderRadius:12 },
  btnText:{ color:"white", fontWeight:"800" },

  // Bars
  barTrack:{ height:7, borderRadius:7, backgroundColor:"rgba(255,255,255,0.07)", overflow:"hidden" },
  barFill:{ height:7, backgroundColor:C.primary },

  // Footer
  footer:{ position:"absolute", bottom:0, left:0, right:0, flexDirection:"row", alignItems:"center",
    gap:8, paddingHorizontal:12, paddingVertical:8, borderTopWidth:1, borderTopColor:C.border, backgroundColor:"rgba(10,13,22,0.95)" },
  footerText:{ color:C.sub, fontSize:12 },

  // Status dot for footer
  dot:{ width:8, height:8, borderRadius:999, backgroundColor:"#666" },
  dotOn:{ backgroundColor:C.ok }, dotOff:{ backgroundColor:"#666" },
  statusText:{ color:C.sub },
});