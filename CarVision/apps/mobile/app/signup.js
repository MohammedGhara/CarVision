import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getHttpBase } from "../lib/httpBase";
import { saveToken, saveUser } from "../lib/authStore";
import { showCustomAlert } from "../components/CustomAlert";
import { useLanguage } from "../context/LanguageContext";
import { C } from "../styles/theme";
import { authStyles as styles } from "../styles/authStyles";

const ROLES = ["CLIENT", "GARAGE"];

export default function Signup() {
  const r = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("CLIENT");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  function validate() {
    if (!email) {
      Alert.alert("Email Required", "Please enter your email address.");
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address (e.g., name@example.com).");
      return false;
    }
    
    if (!password) {
      Alert.alert("Password Required", "Please enter a password.");
      return false;
    }
    
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters long.");
      return false;
    }
    
    return true;
  }

// ... existing code ...

async function onSignup() {
  // First validate
  if (!email) {
    showCustomAlert("Email Required", "Please enter your email address.");
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showCustomAlert("Invalid Email", "Please enter a valid email address (e.g., name@example.com).");
    return;
  }
  
  if (!password) {
    showCustomAlert("Password Required", "Please enter a password.");
    return;
  }
  
  if (password.length < 6) {
    showCustomAlert("Weak Password", "Password must be at least 6 characters long.");
    return;
  }
  
  setBusy(true);
  
  console.log("🔵 Starting signup...", { email, name, role, passwordLength: password.length });
  
  try {
    let base;
    try {
      base = await getHttpBase();
      console.log("✅ Base URL:", base);
    } catch (urlError) {
      console.error("❌ URL Error:", urlError);
      setBusy(false);
      showCustomAlert(
        "Connection Error", 
        "Cannot get server URL. Please check your settings and make sure the server is running.\n\n" + urlError.message
      );
      return;
    }
  
    const url = `${base}/api/auth/signup`;
    console.log("📤 Sending request to:", url);
    
    const requestBody = { email, name: name.trim() || null, role, password };
    console.log("📤 Request body:", { ...requestBody, password: "***" });
    
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    
    console.log("📥 Response status:", resp.status, resp.statusText);
    
    let data;
    let responseText = "";
    try {
      responseText = await resp.text();
      console.log("📥 Response text:", responseText);
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError);
      setBusy(false);
      showCustomAlert(
        "Server Error", 
        `Invalid response from server.\n\nStatus: ${resp.status}\nResponse: ${responseText.substring(0, 100)}`
      );
      return;
    }
    
    console.log("📥 Parsed data:", data);
    
    if (!resp.ok || !data.ok) {
      const errorMsg = data.error || `Server returned error (${resp.status})`;
      console.error("❌ Signup failed:", errorMsg);
      setBusy(false);
      
      if (errorMsg.toLowerCase().includes("email") && errorMsg.toLowerCase().includes("already")) {
        showCustomAlert("Email Already Registered", "This email is already in use. Please use a different email or try logging in.");
      } else if (errorMsg.toLowerCase().includes("email")) {
        showCustomAlert("Email Error", errorMsg);
      } else if (errorMsg.toLowerCase().includes("password")) {
        showCustomAlert("Password Error", errorMsg);
      } else if (resp.status === 500) {
        showCustomAlert("Server Error", "The server encountered an error. Please try again later.\n\n" + errorMsg);
      } else if (resp.status === 400) {
        showCustomAlert("Invalid Data", errorMsg);
      } else {
        showCustomAlert("Signup Failed", errorMsg);
      }
      return;
    }
    
    if (!data.token || !data.user) {
      console.error("❌ Missing token or user in response:", data);
      setBusy(false);
      showCustomAlert("Signup Error", "Server response is incomplete. Please try again.");
      return;
    }
    
    console.log("✅ Signup successful!");
    
    try {
      await saveToken(data.token);
      await saveUser(data.user);
      console.log("✅ Credentials saved");
    } catch (saveError) {
      console.error("❌ Save error:", saveError);
      setBusy(false);
      showCustomAlert("Storage Error", "Account created but failed to save credentials. Please try logging in.");
      return;
    }
    
    // Success
    setBusy(false);
    setTimeout(() => {
      console.log("🟢 Showing success alert...");
      const redirectPath = data.user.role === "GARAGE" ? "/garage" : "/";
      showCustomAlert(
        "✅ Success!", 
        `Account created successfully!\n\nWelcome to CarVision, ${data.user.name || data.user.email.split("@")[0]}!`,
        [
          { 
            text: "OK", 
            onPress: () => {
              console.log("User pressed OK, redirecting...");
              setTimeout(() => r.replace(redirectPath), 300);
            }
          }
        ]
      );
    }, 300);
    
  } catch (e) {
    console.error("❌ Signup exception:", e);
    setBusy(false);
    
    let errorMsg = "An unexpected error occurred.";
    let errorTitle = "Signup Error";
    
    if (e.message) {
      if (e.message.includes("fetch") || e.message.includes("network") || e.message.includes("Failed to fetch")) {
        errorTitle = "Connection Error";
        errorMsg = "Cannot connect to the server.\n\nPlease check:\n• Your internet connection\n• Server settings\n• That the server is running";
      } else if (e.message.includes("timeout")) {
        errorTitle = "Timeout Error";
        errorMsg = "The request took too long. Please check your connection and try again.";
      } else {
        errorMsg = e.message;
      }
    }
    
    showCustomAlert(errorTitle, errorMsg);
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
          <View style={styles.brandWrap}>
            <Text style={styles.logo}> CarVision</Text>
            <Text style={styles.tagline}>Join the smarter driving community</Text>
          </View>

          <View style={styles.cardWrap}>
            <View style={styles.card}>
              <Text style={styles.h1}>{t("signup.title")}</Text>
              <Text style={styles.h2}>{t("signup.subtitle")}</Text>

              {/* Name */}
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={20} color={C.sub} style={styles.iconLeft} />
                <TextInput
                  style={styles.input}
                  placeholder={t("signup.name")}
                  placeholderTextColor={C.sub}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Email */}
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={20} color={C.sub} style={styles.iconLeft} />
                <TextInput
                  style={styles.input}
                  placeholder={t("signup.email")}
                  placeholderTextColor={C.sub}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* Role Selector */}
              <Text style={styles.label}>{t("signup.role")}</Text>
              <View style={styles.roles}>
                {ROLES.map((opt) => {
                  const active = role === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setRole(opt)}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                    >
                      <Text style={[styles.roleText, active && styles.roleTextActive]}>
                        {opt === "CLIENT" ? t("signup.client") : t("signup.garage")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Password */}
              <View style={styles.smallInputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={C.sub} style={styles.iconLeft} />
                <TextInput
                  style={styles.smallInput}
                  placeholder={t("signup.password")}
                  placeholderTextColor={C.sub}
                  secureTextEntry={!showPwd}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={styles.iconRight}>
                  <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color={C.sub} />
                </TouchableOpacity>
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity style={[styles.btn, busy && { opacity: 0.7 }]} onPress={onSignup} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t("signup.signupButton")}</Text>}
              </TouchableOpacity>

              {/* Link to login */}
              <View style={{ alignItems: "center", marginTop: 14 }}>
                <Text style={{ color: C.sub }}>
                  {t("signup.haveAccount")}{" "}
                  <Text onPress={() => r.push("/login")} style={styles.link}>
                    {t("signup.login")}
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

