import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getHttpBase } from "../lib/httpBase";
import { saveToken, saveUser, getToken } from "../lib/authStore";
import { showCustomAlert } from "../components/CustomAlert";
const C = {
  text: "#E6E9F5",
  sub: "#A8B2D1",
  primary: "#7C8CFF",
  border: "rgba(255,255,255,.12)",
  glass: "rgba(18,22,33,.72)",
};

export default function Login() {
  const r = useRouter();
  const [identifier, setIdentifier] = useState(""); // Changed from email to identifier
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) r.replace("/");
    })();
  }, []);

  function validate() {
    if (!identifier || !password) {
      showCustomAlert("Missing", "Please fill username/email and password.");
      return false;
    }
    // No email validation - accept both username and email
    return true;
  }
  async function onLogin() {
    // Validate first - these alerts should work immediately
    if (!identifier || !password) {
      showCustomAlert("Missing", "Please fill username/email and password.");
      return;
    }
    
    setBusy(true);
    
    console.log("🔵 Starting login...", { identifier: identifier.substring(0, 5) + "***" });
    
    try {
      const base = await getHttpBase();
      
      // Determine if it's an email or username
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
      
      const resp = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEmail 
            ? { email: identifier, password } 
            : { username: identifier, password }
        ),
      });
      
      // Try to parse JSON response
      let data;
      let responseText = "";
      try {
        responseText = await resp.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        setBusy(false);
        showCustomAlert(
          "Server Error", 
          `Invalid response from server.\n\nStatus: ${resp.status}`
        );
        return;
      }
      
      if (!resp.ok || !data.ok) {
        // Show specific error message from server
        const errorMsg = data.error || "Login failed. Please try again.";
        setBusy(false);
        
        // Show specific alerts based on error type
        if (errorMsg.toLowerCase().includes("password")) {
          showCustomAlert("❌ Incorrect Password", "The password you entered is incorrect. Please try again.");
        } else if (errorMsg.toLowerCase().includes("email") || errorMsg.toLowerCase().includes("username")) {
          showCustomAlert("❌ Account Not Found", "No account found with this email/username. Please check and try again.");
        } else if (errorMsg.toLowerCase().includes("required")) {
          showCustomAlert("⚠️ Missing Information", errorMsg);
        } else {
          showCustomAlert("❌ Login Failed", errorMsg);
        }
        return;
      }
      
      // Check if we have token and user
      if (!data.token || !data.user) {
        console.error("❌ Missing token or user in response:", data);
        setBusy(false);
        showCustomAlert("Login Error", "Server response is incomplete. Please try again.");
        return;
      }
      
      console.log("✅ Login successful!");
      
      // Save credentials
      try {
        await saveToken(data.token);
        await saveUser(data.user);
        console.log("✅ Credentials saved");
      } catch (saveError) {
        console.error("❌ Save error:", saveError);
        setBusy(false);
        showCustomAlert("Storage Error", "Login successful but failed to save credentials. Please try again.");
        return;
      }
      
      // Success - Show alert FIRST, then redirect after user presses OK
      setBusy(false);
      
      setTimeout(() => {
        console.log("🟢 Showing success alert...");
        showCustomAlert(
          "✅ Login Successful!", 
          `Welcome back, ${data.user.name || data.user.email.split("@")[0]}!`,
          [
            { 
              text: "OK", 
              onPress: () => {
                console.log("User pressed OK, redirecting...");
                setTimeout(() => {
                  r.replace("/");
                }, 300);
              }
            }
          ]
        );
      }, 500);
      
    } catch (e) {
      // Network or other errors
      console.error("❌ Login exception:", e);
      setBusy(false);
      
      let errorMsg = "Network error. Please check your connection and try again.";
      if (e.message) {
        if (e.message.includes("fetch") || e.message.includes("network") || e.message.includes("Failed to fetch")) {
          errorMsg = "Cannot connect to the server.\n\nPlease check:\n• Your internet connection\n• Server settings\n• That the server is running";
        } else if (e.message.includes("timeout")) {
          errorMsg = "The request took too long. Please check your connection and try again.";
        } else {
          errorMsg = e.message;
        }
      }
      
      showCustomAlert("❌ Connection Error", errorMsg);
    }
  }

  return (
    <LinearGradient colors={["#07101F", "#0B0F19"]} style={{ flex: 1 }}>
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1400&auto=format&fit=crop",
        }}
        resizeMode="cover"
        style={{ flex: 1, opacity: 0.22 }}
      />

      <SafeAreaView style={StyleSheet.absoluteFill}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          {/* ─── top bar with settings ─── */}
          <View style={styles.topbar}>
            <View style={{ width: 40 }} />
            <Text style={styles.logo}>CarVision</Text>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => r.push("/settings")}
            >
              <Ionicons name="settings-outline" size={20} color={C.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.tagline}>Drive smarter. Diagnose faster.</Text>

          <View style={styles.cardWrap}>
            <View style={styles.card}>
              <Text style={styles.h1}>Log in</Text>
              <Text style={styles.h2}>Welcome back! Please enter your details.</Text>

              {/* Username or Email */}
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={20} color={C.sub} style={styles.iconLeft} />
                <TextInput
                  style={styles.input}
                  placeholder="Username or Email"
                  placeholderTextColor={C.sub}
                  autoCapitalize="none"
                  keyboardType="default"
                  value={identifier}
                  onChangeText={setIdentifier}
                />
              </View>

              {/* Password */}
              <View style={styles.smallInputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={C.sub} style={styles.iconLeft} />
                <TextInput
                  style={styles.smallInput}
                  placeholder="Password"
                  placeholderTextColor={C.sub}
                  secureTextEntry={!showPwd}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={styles.iconRight}>
                  <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color={C.sub} />
                </TouchableOpacity>
              </View>

              {/* Row */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Switch value={remember} onValueChange={setRemember} />
                  <Text style={styles.rememberText}>Remember me</Text>
                </View>
                <TouchableOpacity onPress={() => r.push("/forgotpassword")}>
                  <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, busy && { opacity: 0.7 }]}
                onPress={onLogin}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log in</Text>}
              </TouchableOpacity>

              <View style={{ alignItems: "center", marginTop: 14 }}>
                <Text style={{ color: C.sub }}>
                  No account?{" "}
                  <Text onPress={() => r.push("/signup")} style={styles.link}>
                    Sign up
                  </Text>
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.footer}>© 2025 CarVision</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  brandWrap: { paddingTop: 8, alignItems: "center" },
  logo: { color: C.text, fontSize: 26, fontWeight: "900", letterSpacing: 0.5 },
  tagline: { color: C.sub, marginTop: 2, textAlign: "center", fontSize: 13 },
  cardWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 16 },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  h1: { color: C.text, fontSize: 24, fontWeight: "900" },
  h2: { color: C.sub, marginTop: 6, marginBottom: 14 },
  inputWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    height: 52,
  },
  smallInputWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    height: 42,
  },
  iconLeft: { paddingLeft: 12, paddingRight: 6 },
  iconRight: { paddingHorizontal: 12, height: "100%", justifyContent: "center" },
  input: {
    flex: 1,
    color: C.text,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  smallInput: {
    flex: 1,
    color: C.text,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  row: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  rememberText: { color: C.sub },
  link: { color: C.primary, fontWeight: "800" },
  btn: {
    marginTop: 16,
    backgroundColor: C.primary,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 12,
  },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  footer: { color: C.sub, textAlign: "center", marginBottom: 14, fontSize: 12 },
});