// apps/mobile/app/diagnostics.js
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as FileSystem from "expo-file-system";            // NEW
import * as Sharing from "expo-sharing";                   // NEW
import { getWsUrl } from "../lib/wsConfig";
import { describeDtc } from "../lib/dtcDescriptions";      // NEW

const C = {
  bg: "#0B0F19", card: "rgba(22,26,36,0.85)", border: "rgba(255,255,255,0.06)",
  text: "#E6E9F5", sub: "#A8B2D1", primary: "#7C8CFF", ok:"#1FBF75", warn:"#F5B73A", crit:"#FF5D5D"
};

export default function Diagnostics() {
  const router = useRouter();
  const wsRef = useRef(null);
  const [wsUrl, setWsUrl] = useState(null);
  const [link, setLink] = useState({ status:"down", message:"Connecting..." });

  const [data, setData] = useState({
    monitors: { milOn:false, dtcCount:0, ignition:null, bytes:[] },
    dtcs:[], pending:[], permanent:[],
    adapter: null,                                        // NEW (אם השרת ישדר)
  });

  useEffect(() => { (async () => setWsUrl(await getWsUrl()))(); }, []);

  useEffect(() => {
    if (!wsUrl) return;
    let ws; let timer;
    function connect() {
      ws = new WebSocket(wsUrl); wsRef.current = ws;
      ws.onopen    = () => setLink({ status:"up", message:"Connected" });
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "link") setLink({ status: msg.status, message: msg.message });
          if (msg.type === "telemetry") {
            setData((d)=>({
              ...d,
              monitors: msg.data.monitors ?? d.monitors,
              dtcs: msg.data.dtcs ?? d.dtcs,
              pending: msg.data.pending ?? d.pending,
              permanent: msg.data.permanent ?? d.permanent,
              adapter: msg.data.adapter ?? d.adapter,      // NEW
            }));
          }
          // אופציונלי: אם תשדר type:"info" עם adapter
          if (msg.type === "info" && msg.adapter) {
            setData((d)=>({ ...d, adapter: msg.adapter }));
          }
        } catch {}
      };
      ws.onerror = () => { setLink({ status:"down", message:"Error" }); try{ws.close();}catch{} };
      ws.onclose = () => { setLink({ status:"down", message:"Disconnected" }); timer = setTimeout(connect, 1500); };
    }
    connect();
    return () => { clearTimeout(timer); try{ ws && ws.close(); }catch{} };
  }, [wsUrl]);

  function sendClear() {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "clearDTCs" }));
    }
  }

  // NEW: אישור מחיקה
  const onClear = () => {
    Alert.alert(
      "מחיקת קודי תקלה",
      "אתה בטוח? מחיקה תאפס את הקודים ותכבה את נורת המנוע אם אין תקלות פעילות.",
      [
        { text: "ביטול", style: "cancel" },
        { text: "מחק", style: "destructive", onPress: sendClear },
      ]
    );
  };

  // NEW: דוח לשיתוף
  async function exportReport() {
    try {
      const lines = [];
      lines.push(`Adapter: ${data.adapter ?? "-"}\n`);
      lines.push(`MIL: ${data.monitors?.milOn ? "ON" : "OFF"}`);
      lines.push(`DTC Count: ${data.monitors?.dtcCount ?? 0}\n`);

      const fmtList = (title, arr) => {
        lines.push(`${title}:`);
        if (!arr || arr.length === 0) { lines.push("  None"); return; }
        for (const code of arr) {
          lines.push(`  ${code} — ${describeDtc(code)}`);
        }
        lines.push("");
      };

      fmtList("Current",   data.dtcs);
      fmtList("Pending",   data.pending);
      fmtList("Permanent", data.permanent);

      // Raw readiness
      const raw = Array.isArray(data.monitors?.bytes) && data.monitors.bytes.length
        ? data.monitors.bytes.map(b => "0x"+b.toString(16).padStart(2,"0")).join(" ")
        : "-";
      lines.push(`Readiness raw: ${raw}\n`);
      lines.push(`Link: ${link.status} (${link.message})`);

      const txt = lines.join("\n");
      const path = FileSystem.cacheDirectory + `carvision_report_${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(path, txt);
      await Sharing.shareAsync(path);
    } catch (e) {
      console.log("exportReport failed:", e);
    }
  }

  const ign = data.monitors?.ignition || "Unknown"; // "Spark" / "Compression" אם השרת מספק

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }}>
      {/* topbar */}
      <View style={s.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Ionicons name="chevron-back" size={24} color="#E6E9F5"/></TouchableOpacity>
        <Text style={s.topTitle}>Diagnostics</Text>
        <View style={{flexDirection:"row", alignItems:"center", gap:8}}>
          {data.adapter ? <Text style={{color:C.sub, fontSize:12}}>{data.adapter}</Text> : null}
          <View style={s.dot(link.status==="up" ? C.ok : "#666")}/>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom:24 }}>
        {/* status card */}
        <View style={s.card}>
          <View style={s.row}>
            <Text style={[s.badge, data.monitors?.milOn? s.badgeWarn: s.badgeOk]}>
              MIL: {data.monitors?.milOn ? "ON" : "OFF"}
            </Text>
            <Text style={s.pill}>DTC Count: {data.monitors?.dtcCount ?? 0}</Text>
            <Text style={s.pill}>Ignition: {ign}</Text>
            <Text style={[s.pill, {opacity:0.8}]}>{link.message}</Text>
            <TouchableOpacity onPress={exportReport} style={[s.btn, {marginLeft:"auto"}]}>
              <Text style={s.btnText}>Export report</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* trouble codes */}
        <Text style={s.section}>Trouble Codes</Text>
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.h2}>Current</Text>
            <TouchableOpacity onPress={onClear} style={s.btn}><Text style={s.btnText}>Clear DTCs</Text></TouchableOpacity>
          </View>

          {/* רשימת Current עם תיאורים */}
          <Codes values={data.dtcs} />

          <Text style={[s.h2, {marginTop:12}]}>Pending</Text>
          <Codes values={data.pending} />

          <Text style={[s.h2, {marginTop:12}]}>Permanent</Text>
          <Codes values={data.permanent} />
        </View>

        {/* readiness snapshot (raw) */}
        <Text style={s.section}>Readiness (raw)</Text>
        <View style={s.card}>
          <Text style={{color:C.sub}}>
            Raw bytes from PID 01: {Array.isArray(data.monitors?.bytes) && data.monitors.bytes.length
              ? data.monitors.bytes.map(b => "0x"+b.toString(16).padStart(2,"0")).join(" ")
              : "not available"}
          </Text>
          <Text style={{color:C.sub, marginTop:8}}>
            Tip: ECUs משתנים בין יצרנים. אפשר להרחיב לפענוח מלא של Monitors אם תרצה.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// מציג קוד + תיאור (במקום שבבים קצרים)
function Codes({ values }) {
  const list = (values && values.length) ? values : [];
  if (!list.length) {
    return <Text style={[s.chip, {opacity:0.75}]}>None</Text>;
  }
  return (
    <View style={{gap:8, marginTop:6}}>
      {list.map((code, i) => (
        <View key={`${code}-${i}`} style={s.codeRow}>
          <Text style={s.code}>{code}</Text>
          <Text style={s.codeDesc}>{describeDtc(code)}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  topbar:{ paddingHorizontal:12, paddingTop:6, paddingBottom:6, flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  backBtn:{ width:40, height:40, borderRadius:12, alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:C.border, backgroundColor:"rgba(255,255,255,0.03)" },
  topTitle:{ color:C.text, fontSize:18, fontWeight:"800" },
  dot:(bg)=>({ width:10, height:10, borderRadius:99, backgroundColor:bg }),

  card:{ backgroundColor:C.card, borderColor:C.border, borderWidth:1, borderRadius:16, padding:14, marginHorizontal:12, marginTop:12 },
  row:{ flexDirection:"row", alignItems:"center", gap:10, flexWrap:"wrap" },

  badge:{ paddingVertical:4, paddingHorizontal:10, borderRadius:999, fontWeight:"800" },
  badgeOk:{ backgroundColor:"rgba(31,191,117,.14)", color:C.ok, borderWidth:1, borderColor:"rgba(31,191,117,.28)" },
  badgeWarn:{ backgroundColor:"rgba(245,183,58,.14)", color:C.warn, borderWidth:1, borderColor:"rgba(245,183,58,.28)" },

  pill:{ backgroundColor:"rgba(255,255,255,0.06)", color:C.text, borderWidth:1, borderColor:C.border, paddingVertical:6, paddingHorizontal:10, borderRadius:999 },

  chip:{ backgroundColor:"rgba(35,41,70,0.75)", color:"#CFD6FF", borderColor:"rgba(190,200,255,0.18)", borderWidth:1, paddingVertical:6, paddingHorizontal:10, borderRadius:999 },
  h2:{ color:C.text, fontSize:16, fontWeight:"800" },
  section:{ color:C.sub, fontWeight:"700", letterSpacing:0.4, marginTop:14, marginLeft:16 },

  btn:{ backgroundColor:C.primary, paddingHorizontal:12, paddingVertical:10, borderRadius:12 },
  btnText:{ color:"white", fontWeight:"800" },

  codeRow:{ borderWidth:1, borderColor:C.border, borderRadius:12, padding:10, backgroundColor:"rgba(255,255,255,0.04)" },
  code:{ color:C.text, fontWeight:"900", marginBottom:2 },
  codeDesc:{ color:C.sub },
});
