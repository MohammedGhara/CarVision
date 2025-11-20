// apps/mobile/app/repairs.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, AppState
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getWsUrl, forceReDetect, checkNetworkChange } from "../lib/wsConfig";
// ❌ removed old helper:
// import { postJson } from "../lib/api";
// ✅ new helper:
import { api } from "../lib/api";
import { describeDtc } from "../lib/dtcDescriptions";

const C = {
  bg:"#0B0F19", card:"rgba(22,26,36,0.85)", border:"rgba(255,255,255,0.06)",
  text:"#E6E9F5", sub:"#A8B2D1", primary:"#7C8CFF",
  ok:"#1FBF75", warn:"#F5B73A", crit:"#FF5D5D"
};

const STORAGE_KEY = "carvision.history.v1";
const DEDUP_COOLDOWN_MS = 60 * 1000; // re-log same key only after 60s

export default function RepaiScreen() {
  const router = useRouter();
  const [wsUrl, setWsUrl] = useState(null);
  const wsRef = useRef(null);

  const [link, setLink] = useState({ status:"down", message:"Connecting..." });
  const issuesRef = useRef([]);            // in-memory list: [{id, ts, severity, title, detail, snapshot}]
  const lastSeenRef = useRef(new Map());   // per-key last ts to avoid spam
  const [, force] = useState(0);

  const [busyId, setBusyId] = useState(null); // which card is asking AI
  const [answers, setAnswers] = useState({}); // id -> ai reply

  // Build base URL for REST from ws://host/ws → http://host
  // (kept as-is in case you use it elsewhere, but not needed for askAI anymore)
  async function getApiBase() {
    const u = await getWsUrl();
    const m = u.match(/^wss?:\/\/([^/]+)\/ws$/i);
    if (!m) throw new Error("Bad WS URL in settings");
    return `http://${m[1]}`; // switch to https:// if you serve TLS
  }

  // Load persisted history on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) issuesRef.current = parsed;
          force(x => x + 1);
        }
      } catch {}
      // Check network change on startup - this will auto-detect if WiFi changed
      const url = await getWsUrl(false, true);
      const oldUrl = wsUrl;
      setWsUrl(url);
      if (url !== oldUrl) {
        console.log("📡 WebSocket URL updated (WiFi changed):", url);
      } else {
        console.log("📡 WebSocket URL loaded:", url);
      }
    })();
  }, []); // Empty deps - only run once on mount

  // Monitor network changes when app comes to foreground and periodically
  useEffect(() => {
    if (!wsUrl) return; // Don't monitor if no URL set yet
    
    let intervalId;
    
    // Check network change periodically (every 15 seconds - less frequent to save battery)
    intervalId = setInterval(async () => {
      try {
        const changed = await checkNetworkChange();
        if (changed) {
          console.log("Network change detected during runtime, re-detecting...");
          const newUrl = await forceReDetect();
          if (newUrl && newUrl !== wsUrl) {
            setWsUrl(newUrl);
          }
        }
      } catch (e) {
        // Silent fail
      }
    }, 15000); // Check every 15 seconds

    // Also check when app comes to foreground (with delay to not block UI)
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (nextAppState === "active") {
        // Delay check slightly so app can render first
        setTimeout(async () => {
          try {
            const changed = await checkNetworkChange();
            if (changed) {
              const newUrl = await forceReDetect();
              if (newUrl && newUrl !== wsUrl) {
                setWsUrl(newUrl);
              }
            }
          } catch (e) {
            // Silent fail
          }
        }, 500); // 500ms delay so UI can render first
      }
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      subscription?.remove();
    };
  }, [wsUrl]);

  useEffect(() => {
    if (!wsUrl) return;
    let ws; let timer;
    let failureCount = 0;
    const MAX_FAILURES_BEFORE_REDETECT = 3;

    async function connect() {
      // Check if we need to re-detect after multiple failures
      if (failureCount >= MAX_FAILURES_BEFORE_REDETECT) {
        failureCount = 0; // Reset counter
        setLink({ status:"down", message:"Network changed, re-detecting server..." });
        
        try {
          // Force re-detection
          const newUrl = await forceReDetect();
          if (newUrl && newUrl !== wsUrl) {
            // URL changed, update state to trigger reconnect
            setWsUrl(newUrl);
            return; // Exit, will reconnect with new URL
          }
        } catch (e) {
          console.log("Re-detection failed:", e);
        }
      }

      ws = new WebSocket(wsUrl); wsRef.current = ws;

      ws.onopen    = () => { 
        setLink({ status:"up", message:"Connected" });
        failureCount = 0; // Reset on successful connection
      };
      ws.onerror   = () => { 
        failureCount++;
        setLink({ status:"down", message:"Connection error" }); 
        try{ws.close();}catch{} 
      };
      ws.onclose   = () => { 
        failureCount++;
        if (failureCount < MAX_FAILURES_BEFORE_REDETECT) {
          setLink({ status:"down", message:"Disconnected - retrying..." });
        } else {
          setLink({ status:"down", message:"Network changed - re-detecting..." });
        }
        timer = setTimeout(connect, 2000);
      };

      // === Normalized handler ===
      ws.onmessage = async (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "link") {
            setLink({ status: msg.status, message: msg.message });
            return;
          }
          if (msg.type === "telemetry") {
            const raw = msg.data || {};
            // normalize field names so detectIssues() is stable
            const t = {
              ...raw,
              dtcs: raw.dtcs || raw.codes?.current || [],
              pending: raw.pending || raw.codes?.pending || [],
              permanent: raw.permanent || raw.codes?.permanent || [],
              monitors: raw.monitors || raw.readiness || {},
            };

            const now = Date.now();
            const newIssues = detectIssues(t);

            let added = false;
            for (const it of newIssues) {
              const key = it.key;
              const last = lastSeenRef.current.get(key) || 0;
              if (now - last >= DEDUP_COOLDOWN_MS) {
                lastSeenRef.current.set(key, now);
                const entry = {
                  id: `${now}-${key}`,
                  ts: now,
                  severity: it.severity,
                  title: it.title,
                  detail: it.detail,
                  snapshot: t
                };
                issuesRef.current.push(entry);
                added = true;
              }
            }
            if (added) {
              // persist full history
              try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(issuesRef.current)); } catch {}
              force(x => x + 1);
            }
          }
        } catch (e) {
          // console.log("history parse error", e);
        }
      };
    }

    connect();
    return () => { 
      if (timer) clearTimeout(timer); 
      try{ ws && ws.close(); }catch{} 
    };
  }, [wsUrl]);

  // --- rules to turn telemetry into human issues ---
  function detectIssues(t) {
    const out = [];

    // Low ECU/battery voltage
    const vb = parseFloat(t.battery ?? t.moduleVoltage);
    if (!Number.isNaN(vb) && vb < 12.2) {
      out.push({
        key:"low_batt", severity:"WARNING", title:"Battery/ECU voltage low",
        detail:`Measured ${vb.toFixed(2)}V (<12.2V)`
      });
    }

    // Overheat
    if (t.coolant != null && t.coolant >= 110) {
      out.push({
        key:"overheat_coolant", severity:"CRITICAL", title:"Coolant overheat",
        detail:`Coolant ${t.coolant}°C (≥110°C)`
      });
    }

    // Oil temperature high (if present)
    if (t.oilTemp != null && t.oilTemp >= 125) {
      out.push({
        key:"overheat_oil", severity:"WARNING", title:"High oil temperature",
        detail:`Oil ${t.oilTemp}°C (≥125°C)`
      });
    }

    // MIL / DTC count
    if (t.monitors?.milOn) {
      out.push({
        key:"mil_on", severity:"WARNING", title:"MIL is ON",
        detail:`Engine light ON; DTC count ${t.monitors?.dtcCount ?? 0}`
      });
    }

    // DTC lists
    const allCodes = [...(t.dtcs||[]), ...(t.pending||[]), ...(t.permanent||[])];
    for (const code of allCodes) {
      out.push({
        key:`dtc_${code}`,
        severity:"WARNING",
        title:`DTC ${code}`,
        detail: describeDtc(code) || "Trouble code detected"
      });
    }

    // MAF impossible when engine running
    if ((t.rpm ?? 0) > 800 && (t.maf ?? 0) === 0) {
      out.push({
        key:"maf_zero", severity:"WARNING", title:"MAF reads 0 while engine running",
        detail:`RPM ${t.rpm}, MAF ${t.maf}`
      });
    }

    return out;
  }

  function severityBadgeStyle(sv) {
    if (sv === "CRITICAL") return [styles.badge, styles.badgeCritical];
    if (sv === "WARNING")  return [styles.badge, styles.badgeWarning];
    return [styles.badge, styles.badgeNormal];
  }

  async function askAI(item) {
    try {
      setBusyId(item.id);

      const s = item.snapshot || {};
      const context = [
        `Problem: ${item.title}`,
        `Detail: ${item.detail}`,
        `Time: ${new Date(item.ts).toLocaleString()}`,
        `RPM=${s.rpm ?? "-"} | Speed=${s.speed ?? "-"} km/h | Coolant=${s.coolant ?? "-"}°C | OilTemp=${s.oilTemp ?? "-"}`,
        `Battery=${s.battery ?? s.moduleVoltage ?? "-"}V | Load=${s.load ?? "-"}% | Throttle=${s.throttle ?? "-"}% | Fuel=${s.fuel ?? "-"}%`,
        `MAF=${s.maf ?? "-"} g/s | MAP=${s.map ?? "-"} kPa | STFT=${s.stft ?? "-"}% | LTFT=${s.ltft ?? "-"}%`,
        `DTCs: ${(s.dtcs || []).join(", ") || "none"} | Pending: ${(s.pending || []).join(", ") || "none"}`
      ].join("\n");

      const prompt =
        `You are a professional car technician assistant. Give detailed but clear help to a normal driver.\n` +
        `Use about 200 words max. NO markdown (** or #). Write in clear lines and short paragraphs.\n` +
        `Your answer must have these parts:\n` +
        `1. PROBLEM SUMMARY: what this issue means in simple words.\n` +
        `2. LIKELY CAUSES: 3–5 reasons for why it happens, practical not theoretical.\n` +
        `3. FIX AND STEPS: what the driver should check or do (step by step, 4–6 steps max).\n` +
        `4. WHEN TO STOP DRIVING: when this problem becomes dangerous and they should call a mechanic.\n` +
        `Be professional and realistic — your goal is to guide the driver safely.\n\n` +
        `Vehicle data:\n${context}`;

      // ✅ call the new helper (it attaches base URL + Authorization and returns parsed JSON)
      const data = await api.post("/api/chat", { message: prompt });
      const reply = data?.reply?.trim?.() || "No suggestion generated.";
      setAnswers(a => ({ ...a, [item.id]: reply }));
    } catch (e) {
      Alert.alert("AI error", String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function clearHistory() {
    issuesRef.current = [];
    lastSeenRef.current.clear();
    setAnswers({});
    try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
    force(x => x + 1);
  }

  // Sort issues: CRITICAL first, then by newest timestamp
  const issues = useMemo(() =>
    [...issuesRef.current].sort((a, b) =>
      (a.severity === b.severity)
        ? b.ts - a.ts
        : (a.severity === "CRITICAL" ? -1 : b.severity === "CRITICAL" ? 1 : 0)
    ),
  [link, answers]);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: C.bg }}>
      {/* top bar */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#E6E9F5" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Reparing</Text>
        <View style={{flexDirection:"row", alignItems:"center", gap:8}}>
          <TouchableOpacity onPress={clearHistory} style={styles.ghostBtn}>
            <Text style={styles.ghostText}>Clear</Text>
          </TouchableOpacity>
          <View style={[styles.dot, link.status==="up"? styles.dotOn: styles.dotOff]} />
        </View>
      </View>

      <FlatList
        data={issues}
        keyExtractor={(it)=>it.id}
        contentContainerStyle={{ padding:12, paddingBottom:24, gap:12 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:10, marginBottom:8 }}>
              <View style={[styles.iconWrap, { backgroundColor:"rgba(255,255,255,0.04)", borderColor:C.border }]}>
                <MaterialCommunityIcons
                  name={ item.severity === "CRITICAL" ? "alert-octagon" : "alert-circle-outline" }
                  size={20}
                  color={ item.severity === "CRITICAL" ? C.crit : C.warn }
                />
              </View>
              <Text style={styles.badgeTs}>
                {new Date(item.ts).toLocaleString()}
              </Text>
              <Text style={severityBadgeStyle(item.severity)}>{item.severity}</Text>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.detail}>{item.detail}</Text>

            <View style={{ flexDirection:"row", gap:10, marginTop:10 }}>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => askAI(item)}
                disabled={busyId === item.id}
                activeOpacity={0.85}
              >
                {busyId === item.id
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnText}>Ask AI</Text>}
              </TouchableOpacity>
            </View>

            {answers[item.id] ? (
              <View style={styles.aiBox}>
                <Text style={styles.aiTitle}>AI Suggestion</Text>
                <Text style={styles.aiText}>{answers[item.id]}</Text>
              </View>
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topbar:{ paddingHorizontal:12, paddingTop:6, paddingBottom:6, flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  backBtn:{ width:40, height:40, borderRadius:12, alignItems:"center", justifyContent:"center",
            borderWidth:1, borderColor:C.border, backgroundColor:"rgba(255,255,255,0.03)" },
  topTitle:{ color:C.text, fontSize:18, fontWeight:"800" },

  dot:{ width:10, height:10, borderRadius:99, backgroundColor:"#666" },
  dotOn:{ backgroundColor:C.ok }, dotOff:{ backgroundColor:"#666" },

  ghostBtn:{ borderWidth:1, borderColor:C.border, paddingHorizontal:10, paddingVertical:8, borderRadius:10, backgroundColor:"rgba(255,255,255,0.03)" },
  ghostText:{ color:C.text, fontWeight:"700" },

  card:{ backgroundColor:C.card, borderColor:C.border, borderWidth:1, borderRadius:16, padding:12 },
  iconWrap:{ width:36, height:36, borderRadius:12, alignItems:"center", justifyContent:"center", borderWidth:1 },
  badge:{ paddingVertical:4, paddingHorizontal:10, borderRadius:999, fontWeight:"800" },
  badgeNormal:{ backgroundColor:"rgba(31,191,117,.14)", color:C.ok, borderWidth:1, borderColor:"rgba(31,191,117,.28)" },
  badgeWarning:{ backgroundColor:"rgba(245,183,58,.14)", color:C.warn, borderWidth:1, borderColor:"rgba(245,183,58,.28)" },
  badgeCritical:{ backgroundColor:"rgba(255,93,93,.14)", color:C.crit, borderWidth:1, borderColor:"rgba(255,93,93,.28)" },

  badgeTs:{ color:C.sub, fontSize:12, marginLeft:2 },

  title:{ color:C.text, fontSize:16, fontWeight:"900" },
  detail:{ color:C.sub, marginTop:6, lineHeight:20 },

  btn:{ backgroundColor:C.primary, paddingHorizontal:12, paddingVertical:10, borderRadius:12, alignItems:"center", justifyContent:"center" },
  btnText:{ color:"#fff", fontWeight:"800" },

  aiBox:{ marginTop:10, borderTopWidth:1, borderTopColor:C.border, paddingTop:10 },
  aiTitle:{ color:C.text, fontWeight:"800", marginBottom:6 },
  aiText:{ color:C.sub, lineHeight:20 },
});
