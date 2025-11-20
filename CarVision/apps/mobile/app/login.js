import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
import { C } from "../styles/theme";
import { authStyles as styles } from "../styles/authStyles";

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

      <SafeAreaView style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}>
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
