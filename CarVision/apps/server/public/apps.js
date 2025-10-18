// App.js — Expo React Native client for CarVision bridge (WebSocket)
import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView, View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";

const BRIDGE_HOST = "172.19.32.78"; // <-- PUT YOUR LAPTOP IP HERE
const WS_URL = `ws://${BRIDGE_HOST}:5173/ws`;

export default function App() {
  const wsRef = useRef(null);
  const [link, setLink] = useState({ status: "down", message: "Connecting..." });
  const [telemetry, setTelemetry] = useState(null);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    let ws;
    function connect() {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setLink({ status: "up", message: "Connected" });
      ws.onclose = () => setLink({ status: "down", message: "Disconnected" });
      ws.onerror = () => setLink({ status: "down", message: "Error" });

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "link") setLink({ status: msg.status, message: msg.message });
        if (msg.type === "telemetry") setTelemetry(msg.data);
        if (msg.type === "queued") setQueued(true);
        if (msg.type === "ack") setQueued(false);
      };
    }
    connect();
    return () => ws && ws.close();
  }, []);

  const badgeStyle = useMemo(() => {
    const lvl = telemetry?.status?.level || "NORMAL";
    return [
      styles.badge,
      lvl === "CRITICAL" ? styles.badgeCritical : lvl === "WARNING" ? styles.badgeWarning : styles.badgeNormal
    ];
  }, [telemetry]);

  const dtcs = telemetry?.dtcs ?? [];

  const onClear = () => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "clearDTCs" }));
    }
  };

  const fmt = (v, suf="") => (v === null || v === undefined) ? "—" : `${v}${suf}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CarVision</Text>
        <View style={[styles.dot, link.status === "up" ? styles.dotOn : styles.dotOff]} />
        <Text style={styles.link}>{link.message}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={badgeStyle}>{telemetry?.status?.level ?? "NORMAL"}</Text>
          <Text style={styles.reason}>{telemetry?.status?.reason ?? "All good"}</Text>
        </View>
        <View style={styles.grid}>
          <Metric label="Battery" value={telemetry?.battery ?? "—"} />
          <Metric label="RPM" value={fmt(telemetry?.rpm)} />
          <Metric label="Speed" value={fmt(telemetry?.speed, " km/h")} />
          <Metric label="Coolant" value={fmt(telemetry?.coolant, " °C")} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.h2}>DTCs</Text>
          <TouchableOpacity style={styles.btn} onPress={onClear} disabled={queued || link.status !== "up"}>
            <Text style={styles.btnText}>{queued ? "Clearing…" : "Clear DTCs"}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={dtcs.length ? dtcs : ["None"]}
          keyExtractor={(item, i) => `${item}-${i}`}
          renderItem={({item}) => <Text style={styles.chip}>{item}</Text>}
          horizontal
          contentContainerStyle={{gap:8}}
        />
      </View>
    </SafeAreaView>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.mLabel}>{label}</Text>
      <Text style={styles.mValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:"#0f1220", padding:12 },
  header:{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:12 },
  title:{ color:"#e6e9f5", fontSize:20, fontWeight:"800" },
  dot:{ width:10, height:10, borderRadius:999 },
  dotOn:{ backgroundColor:"#1fbf75" }, dotOff:{ backgroundColor:"#666" },
  link:{ color:"#9aa4c7" },

  card:{ backgroundColor:"#161a2b", borderColor:"#242a46", borderWidth:1, borderRadius:16, padding:12, marginBottom:12 },
  row:{ flexDirection:"row", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" },
  badge:{ paddingVertical:4, paddingHorizontal:10, borderRadius:999, fontWeight:"800" },
  badgeNormal:{ backgroundColor:"rgba(31,191,117,.15)", color:"#1fbf75", borderWidth:1, borderColor:"rgba(31,191,117,.35)" },
  badgeWarning:{ backgroundColor:"rgba(245,183,58,.15)", color:"#f5b73a", borderWidth:1, borderColor:"rgba(245,183,58,.35)" },
  badgeCritical:{ backgroundColor:"rgba(255,93,93,.15)", color:"#ff5d5d", borderWidth:1, borderColor:"rgba(255,93,93,.35)" },
  reason:{ color:"#9aa4c7" },
  grid:{ flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:6 },
  metric:{ backgroundColor:"#13182b", borderColor:"#232848", borderWidth:1, borderRadius:12, padding:10, minWidth:"47%" },
  mLabel:{ color:"#9aa4c7", marginBottom:4 }, mValue:{ color:"#e6e9f5", fontSize:20, fontWeight:"700" },

  h2:{ color:"#e6e9f5", fontSize:16, fontWeight:"800" },
  btn:{ backgroundColor:"#7c8cff", paddingHorizontal:12, paddingVertical:8, borderRadius:10 },
  btnText:{ color:"white", fontWeight:"800" },
  chip:{ backgroundColor:"#232946", color:"#cfd6ff", borderColor:"#2e3561", borderWidth:1, paddingVertical:6, paddingHorizontal:10, borderRadius:999, marginRight:4 }
});
