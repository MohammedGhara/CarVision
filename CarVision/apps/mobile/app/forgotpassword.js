import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getHttpBase } from "../lib/httpBase";
import { showCustomAlert } from "../components/CustomAlert";

const C = {
  text: "#E6E9F5",
  sub: "#A8B2D1",
  primary: "#7C8CFF",
  border: "rgba(255,255,255,.12)",
  glass: "rgba(18,22,33,.72)",
};

export default function ForgotPassword() {
  const r = useRouter();
  const params = useLocalSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("request"); // "request" or "reset"
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Check if token is provided in URL (from email link)
  useEffect(() => {
    if (params?.token) {
      setResetToken(params.token);
      setStep("reset");
      console.log("🔐 Reset token received from URL");
    }
  }, [params?.token]);

  async function onRequestReset() {
    if (!email) {
      showCustomAlert("Email Required", "Please enter your email address.");
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showCustomAlert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    
    setBusy(true);
    
    try {
      const base = await getHttpBase();
      console.log("🔵 Requesting password reset for:", email);
      console.log("🔵 Base URL:", base);
      
      const resp = await fetch(`${base}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      console.log("📥 Response status:", resp.status);
      
      // Try to parse JSON response
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
      
      if (!resp.ok || !data.ok) {
        const errorMsg = data.error || "Failed to send reset link. Please try again.";
        console.error("❌ Forgot password failed:", errorMsg);
        setBusy(false);
        showCustomAlert("Error", errorMsg);
        return;
      }
      
      // If token is returned (for testing/development when email is not configured)
      if (data.resetToken) {
        setResetToken(data.resetToken);
        setStep("reset");
        showCustomAlert(
          "Reset Token",
          "Email service is not configured. Using token for testing:\n\n" + data.resetToken.substring(0, 20) + "...",
          [{ text: "OK" }]
        );
      } else {
        showCustomAlert(
          "Check Your Email",
          "If an account exists with this email, a reset link has been sent. Please check your inbox and click the link to reset your password.",
          [
            {
              text: "OK",
              onPress: () => r.back()
            }
          ]
        );
      }
      
      setBusy(false);
    } catch (e) {
      console.error("❌ Request reset error:", e);
      setBusy(false);
      
      let errorMsg = "Cannot connect to the server. Please check your connection and try again.";
      if (e.message) {
        if (e.message.includes("fetch") || e.message.includes("network") || e.message.includes("Failed to fetch")) {
          errorMsg = "Cannot connect to the server.\n\nPlease check:\n• Your internet connection\n• Server settings\n• That the server is running";
        } else if (e.message.includes("timeout")) {
          errorMsg = "The request took too long. Please check your connection and try again.";
        } else {
          errorMsg = `Connection error: ${e.message}`;
        }
      }
      
      showCustomAlert("Connection Error", errorMsg);
    }
  }
  async function onResetPassword() {
    // Validate that both password fields are filled
    if (!newPassword) {
      showCustomAlert("Password Required", "Please enter a new password.");
      return;
    }
    
    if (!confirmPassword) {
      showCustomAlert("Confirm Password Required", "Please confirm your new password.");
      return;
    }
    
    // Validate password length
    if (newPassword.length < 6) {
      showCustomAlert("Weak Password", "Password must be at least 6 characters long.");
      return;
    }
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      showCustomAlert("Passwords Don't Match", "Please make sure both passwords match.");
      return;
    }
    
    // Check if resetToken exists (should always be set, but just in case)
    if (!resetToken) {
      showCustomAlert("Error", "Reset session expired. Please request a new password reset.");
      return;
    }
    
    setBusy(true);
    
    try {
      const base = await getHttpBase();
      console.log("🔵 Resetting password with token:", resetToken.substring(0, 8) + "...");
      
      const resp = await fetch(`${base}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      
      console.log("📥 Response status:", resp.status);
      
      // Try to parse JSON response
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
      
      if (!resp.ok || !data.ok) {
        const errorMsg = data.error || "Failed to reset password. Please try again.";
        console.error("❌ Reset password failed:", errorMsg);
        setBusy(false);
        showCustomAlert("Error", errorMsg);
        return;
      }
      
      showCustomAlert(
        "✅ Success!",
        "Your password has been reset successfully. You can now log in with your new password.",
        [
          {
            text: "OK",
            onPress: () => r.replace("/login")
          }
        ]
      );
      
      setBusy(false);
    } catch (e) {
      console.error("❌ Reset password error:", e);
      setBusy(false);
      
      let errorMsg = "Cannot connect to the server. Please check your connection and try again.";
      if (e.message) {
        if (e.message.includes("fetch") || e.message.includes("network") || e.message.includes("Failed to fetch")) {
          errorMsg = "Cannot connect to the server.\n\nPlease check:\n• Your internet connection\n• Server settings\n• That the server is running";
        } else if (e.message.includes("timeout")) {
          errorMsg = "The request took too long. Please check your connection and try again.";
        } else {
          errorMsg = `Connection error: ${e.message}`;
        }
      }
      
      showCustomAlert("Connection Error", errorMsg);
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
          <View style={styles.topbar}>
            <TouchableOpacity onPress={() => r.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.logo}>CarVision</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.cardWrap}>
            <View style={styles.card}>
              <Text style={styles.h1}>
                {step === "request" ? "Forgot Password" : "Reset Password"}
              </Text>
              <Text style={styles.h2}>
                {step === "request"
                  ? "Enter your email to receive a reset link."
                  : "Enter your new password."}
              </Text>

              {step === "request" ? (
                <>
                  <View style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={20} color={C.sub} style={styles.iconLeft} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor={C.sub}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.btn, busy && { opacity: 0.7 }]}
                    onPress={onRequestReset}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                 

                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={20} color={C.sub} style={styles.iconLeft} />
                    <TextInput
                      style={styles.input}
                      placeholder="New Password"
                      placeholderTextColor={C.sub}
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                  </View>

                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={20} color={C.sub} style={styles.iconLeft} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor={C.sub}
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.btn, busy && { opacity: 0.7 }]}
                    onPress={onResetPassword}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>Reset Password</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <View style={{ alignItems: "center", marginTop: 14 }}>
                <Text style={{ color: C.sub }}>
                  Remember your password?{" "}
                  <Text onPress={() => r.replace("/login")} style={styles.link}>
                    Log in
                  </Text>
                </Text>
              </View>
            </View>
          </View>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  logo: { color: C.text, fontSize: 26, fontWeight: "900", letterSpacing: 0.5 },
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
  iconLeft: { paddingLeft: 12, paddingRight: 6 },
  input: {
    flex: 1,
    color: C.text,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  btn: {
    marginTop: 16,
    backgroundColor: C.primary,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 12,
  },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  link: { color: C.primary, fontWeight: "800" },
});