import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../context/LanguageContext";

let alertCallback = null;

export function showCustomAlert(title, message, buttons = []) {
  if (alertCallback) {
    alertCallback({ title, message, buttons, visible: true });
  }
}

export function CustomAlertProvider() {
  const [alert, setAlert] = React.useState({ visible: false, title: "", message: "", buttons: [] });
  const { t } = useLanguage();

  React.useEffect(() => {
    alertCallback = setAlert;
    return () => {
      alertCallback = null;
    };
  }, []);

  const handlePress = (button) => {
    setAlert({ ...alert, visible: false });
    if (button.onPress) {
      setTimeout(() => button.onPress(), 100);
    }
  };

  if (!alert.visible) return null;

  const resolvedButtons =
    alert.buttons && alert.buttons.length > 0
      ? alert.buttons
      : [{ text: t("common.ok") }];

  return (
    <Modal
      transparent
      visible={alert.visible}
      animationType="fade"
      onRequestClose={() => {
        if (resolvedButtons.length === 0 || !resolvedButtons[0].onPress) {
          handlePress(resolvedButtons[0] || {});
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.backdrop}>
          <View style={styles.container}>
            <LinearGradient
              colors={["rgba(124,140,255,0.25)", "rgba(15,23,42,0.95)"]}
              style={styles.card}
            >
              <Text style={styles.title}>{alert.title}</Text>
              <Text style={styles.message}>{alert.message}</Text>
              
              <View style={styles.buttonContainer}>
                {resolvedButtons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      index === 0 && alert.buttons.length > 1 && styles.buttonPrimary
                    ]}
                    onPress={() => handlePress(button)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.buttonText,
                      index === 0 && alert.buttons.length > 1 && styles.buttonTextPrimary
                    ]}>
                      {button.text || t("common.ok")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </LinearGradient>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  backdrop: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  container: {
    width: "85%",
    maxWidth: 400,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    color: "#94A3B8",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    minWidth: 80,
    alignItems: "center",
  },
  buttonPrimary: {
    backgroundColor: "#7C8CFF",
    borderColor: "#7C8CFF",
  },
  buttonText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonTextPrimary: {
    color: "#FFFFFF",
  },
});