// apps/mobile/app/repairs.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, AppState
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getWsUrl, checkNetworkChange } from "../lib/wsConfig";
import { api } from "../lib/api";
import { describeDtc } from "../lib/dtcDescriptions";
import { useLanguage } from "../context/LanguageContext";
import { colors } from "../styles/theme";
import { repairsStyles as styles } from "../styles/repairsStyles";

const C = colors.repairs;

const STORAGE_KEY = "carvision.history.v1";
const DEDUP_COOLDOWN_MS = 60 * 1000; // re-log same key only after 60s

export default function RepaiScreen() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [wsUrl, setWsUrl] = useState(null);
  const wsRef = useRef(null);

  const [link, setLink] = useState({ status:"down", message:"Connecting..." });
  const issuesRef = useRef([]);            // in-memory list: [{id, ts, severity, title, detail, snapshot}]
  const lastSeenRef = useRef(new Map());   // per-key last ts to avoid spam
  const [, force] = useState(0);

  const [busyId, setBusyId] = useState(null); // which card is asking AI
  const [answers, setAnswers] = useState({}); // id -> ai reply

  // Build base URL for REST from ws://host/ws → http://host
  async function getApiBase() {
    return "http://192.168.1.50:5173";
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


  useEffect(() => {
    if (!wsUrl) return;
    let ws; let timer;
    let failureCount = 0;
    const MAX_FAILURES_BEFORE_REDETECT = 3;

    async function connect() {

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
                  snapshot: t,
                  translation: {
                    titleKey: it.titleKey,
                    titleParams: it.titleParams,
                    titleFallback: it.titleFallback || it.title,
                    detailKey: it.detailKey,
                    detailParams: it.detailParams,
                    detailFallback: it.detailFallback || it.detail,
                  },
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

  const getLocalizedText = (item, field) => {
    const translation = item.translation;
    if (translation && translation[`${field}Key`]) {
      const text = t(translation[`${field}Key`], translation[`${field}Params`] || {});
      if (text && text !== translation[`${field}Key`]) {
        return text;
      }
      if (translation[`${field}Fallback`]) {
        return translation[`${field}Fallback`];
      }
    }
    return item[field] || "";
  };

  const buildIssue = ({
    key,
    severity,
    titleKey,
    detailKey,
    titleParams = {},
    detailParams = {},
    titleFallback,
    detailFallback,
  }) => ({
    key,
    severity,
    titleKey,
    detailKey,
    titleParams,
    detailParams,
    titleFallback,
    detailFallback,
    title: titleFallback,
    detail: detailFallback,
  });

  // --- rules to turn telemetry into human issues ---
  function detectIssues(t) {
    const out = [];

    // Low ECU/battery voltage
    const vb = parseFloat(t.battery ?? t.moduleVoltage);
    if (!Number.isNaN(vb) && vb < 12.2) {
      out.push(buildIssue({
        key: "low_batt",
        severity: "WARNING",
        titleKey: "repairs.issues.low_batt.title",
        detailKey: "repairs.issues.low_batt.detail",
        detailParams: { voltage: vb.toFixed(2) },
        titleFallback: "Battery/ECU voltage low",
        detailFallback: `Measured ${vb.toFixed(2)}V (<12.2V)`,
      }));
    }

    // Overheat
    if (t.coolant != null && t.coolant >= 110) {
      out.push(buildIssue({
        key: "overheat_coolant",
        severity: "CRITICAL",
        titleKey: "repairs.issues.overheat_coolant.title",
        detailKey: "repairs.issues.overheat_coolant.detail",
        detailParams: { temperature: t.coolant },
        titleFallback: "Coolant overheat",
        detailFallback: `Coolant ${t.coolant}°C (≥110°C)`,
      }));
    }

    // Oil temperature high (if present)
    if (t.oilTemp != null && t.oilTemp >= 125) {
      out.push(buildIssue({
        key: "overheat_oil",
        severity: "WARNING",
        titleKey: "repairs.issues.overheat_oil.title",
        detailKey: "repairs.issues.overheat_oil.detail",
        detailParams: { temperature: t.oilTemp },
        titleFallback: "High oil temperature",
        detailFallback: `Oil ${t.oilTemp}°C (≥125°C)`,
      }));
    }

    // MIL / DTC count
    if (t.monitors?.milOn) {
      out.push(buildIssue({
        key: "mil_on",
        severity: "WARNING",
        titleKey: "repairs.issues.mil_on.title",
        detailKey: "repairs.issues.mil_on.detail",
        detailParams: { count: t.monitors?.dtcCount ?? 0 },
        titleFallback: "MIL is ON",
        detailFallback: `Engine light ON; DTC count ${t.monitors?.dtcCount ?? 0}`,
      }));
    }

    // DTC lists
    const allCodes = [...(t.dtcs||[]), ...(t.pending||[]), ...(t.permanent||[])];
    for (const code of allCodes) {
      const description = describeDtc(code) || "Trouble code detected";
      out.push(buildIssue({
        key: `dtc_${code}`,
        severity: "WARNING",
        titleKey: "repairs.issues.dtc.title",
        detailKey: "repairs.issues.dtc.detail",
        titleParams: { code },
        detailParams: { description },
        titleFallback: `DTC ${code}`,
        detailFallback: description,
      }));
    }

    // MAF impossible when engine running
    if ((t.rpm ?? 0) > 800 && (t.maf ?? 0) === 0) {
      out.push(buildIssue({
        key: "maf_zero",
        severity: "WARNING",
        titleKey: "repairs.issues.maf_zero.title",
        detailKey: "repairs.issues.maf_zero.detail",
        detailParams: { rpm: t.rpm ?? 0, maf: t.maf ?? 0 },
        titleFallback: "MAF reads 0 while engine running",
        detailFallback: `RPM ${t.rpm}, MAF ${t.maf}`,
      }));
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
      const localeMap = {
        ar: "Arabic",
        he: "Hebrew",
        en: "English",
      };
      const responseLanguage = localeMap[locale] || "English";
      const localizedTitle = getLocalizedText(item, "title");
      const localizedDetail = getLocalizedText(item, "detail");
      const context = [
        `Problem: ${localizedTitle}`,
        `Detail: ${localizedDetail}`,
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
        `Respond in ${responseLanguage}. If ${responseLanguage} is not possible, respond in English.\n\nVehicle data:\n${context}`;

      // ✅ call the new helper (it attaches base URL + Authorization and returns parsed JSON)
      const data = await api.post("/api/chat", { message: prompt });
      const reply = data?.reply?.trim?.() || t("repairs.noSuggestion");
      setAnswers(a => ({ ...a, [item.id]: reply }));
    } catch (e) {
      Alert.alert(t("repairs.aiError"), String(e?.message || e));
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
        <Text style={styles.topTitle}>{t("repairs.title")}</Text>
        <View style={{flexDirection:"row", alignItems:"center", gap:8}}>
          <TouchableOpacity onPress={clearHistory} style={styles.ghostBtn}>
            <Text style={styles.ghostText}>{t("common.delete")}</Text>
          </TouchableOpacity>
          <View style={[styles.dot, link.status==="up"? styles.dotOn: styles.dotOff]} />
        </View>
      </View>

      {issues.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Text style={{ color: C.sub, fontSize: 16 }}>{t("repairs.noIssues")}</Text>
        </View>
      ) : (
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
              <Text style={severityBadgeStyle(item.severity)}>
                {item.severity === "CRITICAL" ? t("repairs.critical") : 
                 item.severity === "WARNING" ? t("repairs.warning") : 
                 t("repairs.normal")}
              </Text>
            </View>

            <Text style={styles.title}>{getLocalizedText(item, "title")}</Text>
            <Text style={styles.detail}>{getLocalizedText(item, "detail")}</Text>

            <View style={{ flexDirection:"row", gap:10, marginTop:10 }}>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => askAI(item)}
                disabled={busyId === item.id}
                activeOpacity={0.85}
              >
                {busyId === item.id
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnText}>{t("repairs.askAI")}</Text>}
              </TouchableOpacity>
            </View>

            {answers[item.id] ? (
              <View style={styles.aiBox}>
                <Text style={styles.aiTitle}>{t("repairs.aiSuggestion")}</Text>
                <Text style={styles.aiText}>{answers[item.id]}</Text>
              </View>
            ) : null}
          </View>
        )}
      />)}
    </SafeAreaView>
  );
}

