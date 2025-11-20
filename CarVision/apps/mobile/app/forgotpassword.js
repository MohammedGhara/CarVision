import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  ScrollView,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getHttpBase } from "../lib/httpBase";
import { showCustomAlert } from "../components/CustomAlert";
import { forgotpasswordStyles as styles } from "../styles/forgotpasswordStyles";

const C = {
  text: "#E6E9F5",
  sub: "#A8B2D1",
  primary: "#7C8CFF",
  border: "rgba(255,255,255,.12)",
  glass: "rgba(18,22,33,.72)",
};

export default function ForgotPassword() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("request"); // "request", "verify", or "reset"
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeVerified, setCodeVerified] = useState(false);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

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
        // Use console.log to avoid Metro stack trace errors
        console.log("⚠️ JSON parse error:", parseError.message || parseError);
        setBusy(false);
        showCustomAlert(
          "Server Error", 
          `Invalid response from server.\n\nStatus: ${resp.status}\nResponse: ${responseText.substring(0, 100)}`
        );
        return;
      }
      
      if (!resp.ok || !data.ok) {
        const errorMsg = data.error || "Failed to send reset code. Please try again.";
        // Use console.log instead of console.error to avoid Metro stack trace errors
        console.log("⚠️ Forgot password failed:", errorMsg);
        setBusy(false);
        
        // Check if email not found - show signup message
        if (resp.status === 404 || errorMsg.toLowerCase().includes("not found") || errorMsg.toLowerCase().includes("sign up")) {
          showCustomAlert(
            "Email Not Found",
            "This email is not registered. Please sign up to create an account.",
            [
              {
                text: "Sign Up",
                onPress: () => r.replace("/signup")
              },
              {
                text: "Cancel",
                style: "cancel"
              }
            ]
          );
        } else {
          showCustomAlert("Error", errorMsg);
        }
        return;
      }
      
      // If code is returned (for testing/development when email is not configured)
      if (data.resetCode) {
        setCode(data.resetCode);
        setStep("verify");
        showCustomAlert(
          "Development Mode",
          "Email service is not configured. Your verification code is:\n\n" + data.resetCode,
          [{ text: "OK" }]
        );
      } else {
        setStep("verify");
        showCustomAlert(
          "Check Your Email",
          "A 6-digit verification code has been sent to your email. Please enter it below.",
          [{ text: "OK" }]
        );
      }
      
      setBusy(false);
    } catch (e) {
      // Use console.log to avoid Metro stack trace errors for expected network issues
      console.log("⚠️ Request reset error:", e.message || e);
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
  async function onVerifyCode() {
    if (!code) {
      showCustomAlert("Code Required", "Please enter the 6-digit verification code.");
      return;
    }
    
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      showCustomAlert("Invalid Code", "Please enter a valid 6-digit code.");
      return;
    }
    
    setBusy(true);
    
    try {
      const base = await getHttpBase();
      console.log("🔵 Verifying code for:", email);
      
      const resp = await fetch(`${base}/api/auth/verify-reset-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      
      console.log("📥 Response status:", resp.status);
      
      let data;
      let responseText = "";
      try {
        responseText = await resp.text();
        console.log("📥 Response text:", responseText);
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        // Use console.log to avoid Metro stack trace errors
        console.log("⚠️ JSON parse error:", parseError.message || parseError);
        setBusy(false);
        showCustomAlert(
          "Server Error", 
          `Invalid response from server.\n\nStatus: ${resp.status}\nResponse: ${responseText.substring(0, 100)}`
        );
        return;
      }
      
      if (!resp.ok || !data.ok) {
        const errorMsg = data.error || "Invalid verification code. Please try again.";
        // Use console.log instead of console.error to avoid Metro stack trace errors
        console.log("⚠️ Verify code failed:", errorMsg);
        setBusy(false);
        showCustomAlert("Invalid Code", errorMsg);
        return;
      }
      
      setCodeVerified(true);
      setStep("reset");
      showCustomAlert(
        "✅ Code Verified",
        "Your verification code is correct. You can now reset your password.",
        [{ text: "OK" }]
      );
      setBusy(false);
    } catch (e) {
      // Use console.log to avoid Metro stack trace errors for expected network issues
      console.log("⚠️ Verify code error:", e.message || e);
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
    
    // Check if code is verified
    if (!codeVerified || !code) {
      showCustomAlert("Error", "Please verify your code first.");
      return;
    }
    
    setBusy(true);
    
    try {
      const base = await getHttpBase();
      console.log("🔵 Resetting password with code for:", email);
      
      const resp = await fetch(`${base}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
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
        // Use console.log to avoid Metro stack trace errors
        console.log("⚠️ JSON parse error:", parseError.message || parseError);
        setBusy(false);
        showCustomAlert(
          "Server Error", 
          `Invalid response from server.\n\nStatus: ${resp.status}\nResponse: ${responseText.substring(0, 100)}`
        );
        return;
      }
      
      if (!resp.ok || !data.ok) {
        const errorMsg = data.error || "Failed to reset password. Please try again.";
        // Use console.log instead of console.error to avoid Metro stack trace errors
        console.log("⚠️ Reset password failed:", errorMsg);
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
      // Use console.log to avoid Metro stack trace errors for expected network issues
      console.log("⚠️ Reset password error:", e.message || e);
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
        pointerEvents="none"
      />

      <SafeAreaView style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
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
                {step === "request" ? "Forgot Password" : step === "verify" ? "Verify Code" : "Reset Password"}
              </Text>
              {step === "request" ? (
                <>
                  <Text style={styles.h2}>
                    Enter your email to receive a verification code.
                  </Text>
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
                      <Text style={styles.btnText}>Send Code</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : step === "verify" ? (
                <>
                  <Text style={styles.h2}>
                    Enter the 6-digit code sent to your email.
                  </Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="keypad-outline" size={20} color={C.sub} style={styles.iconLeft} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={C.sub}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={code}
                      onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ""))}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.btn, busy && { opacity: 0.7 }]}
                    onPress={onVerifyCode}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>Verify Code</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ marginTop: 12 }}
                    onPress={() => {
                      setStep("request");
                      setCode("");
                    }}
                  >
                    <Text style={[styles.link, { textAlign: "center" }]}>
                      Didn't receive code? Request again
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.h2}>
                    Enter your new password.
                  </Text>
                  
                  <View style={styles.inputWrap} key="new-password-field">
                    <Ionicons name="lock-closed-outline" size={20} color={C.sub} style={styles.iconLeft} />
                    <TextInput
                      style={styles.input}
                      placeholder="New Password"
                      placeholderTextColor={C.sub}
                      secureTextEntry={true}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      autoCapitalize="none"
                      keyboardType="default"
                    />
                  </View>

                  <View style={styles.inputWrap} key="confirm-password-field">
                    <Ionicons name="lock-closed-outline" size={20} color={C.sub} style={styles.iconLeft} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor={C.sub}
                      secureTextEntry={true}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      autoCapitalize="none"
                      keyboardType="default"
                      onSubmitEditing={onResetPassword}
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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
