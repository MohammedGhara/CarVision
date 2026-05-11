import React, { useRef, useState, useCallback } from "react";
import { Modal, View, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { LocalizedText as Text } from "../../../components/ui/LocalizedText";
import { CameraView, useCameraPermissions } from "expo-camera";
import Ionicons from "@expo/vector-icons/Ionicons";

const DC = {
  bg: "#030712",
  text: "#F8FAFC",
  sub: "#94A3B8",
  cyan: "#22D3EE",
  border: "rgba(148,163,184,0.2)",
};

/**
 * Full-screen camera capture using expo-camera (DoctorCar Vision AI).
 * @param {{ visible: boolean, onClose: () => void, onCaptured: (uri: string) => void }} props
 */
export default function CameraCaptureModal({ visible, onClose, onCaptured }) {
  const camRef = useRef(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const snap = useCallback(async () => {
    if (!camRef.current || busy) return;
    setBusy(true);
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.85, skipProcessing: Platform.OS === "ios" });
      if (pic?.uri) onCaptured(pic.uri);
      onClose();
    } catch {
      // fall through
    } finally {
      setBusy(false);
    }
  }, [busy, onCaptured, onClose]);

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {!perm?.granted ? (
          <View style={styles.center}>
            <Text style={styles.title}>Camera access</Text>
            <Text style={styles.sub}>Vision AI needs the camera to capture the vehicle concern.</Text>
            <TouchableOpacity style={styles.btn} onPress={() => requestPerm()}>
              <Text style={styles.btnText}>Allow camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnTextGhost}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              ref={camRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="picture"
              onCameraReady={() => setReady(true)}
            />
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                <Ionicons name="close" size={26} color={DC.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={[styles.shutter, (!ready || busy) && styles.shutterDisabled]}
                onPress={snap}
                disabled={!ready || busy}
              >
                {busy ? <ActivityIndicator color="#020617" /> : <View style={styles.shutterInner} />}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DC.bg },
  center: { flex: 1, justifyContent: "center", padding: 24 },
  title: { color: DC.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  sub: { color: DC.sub, fontSize: 14, lineHeight: 20, marginBottom: 24 },
  btn: {
    backgroundColor: DC.cyan,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  btnText: { color: "#020617", fontWeight: "800", fontSize: 16 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: DC.border },
  btnTextGhost: { color: DC.text, fontWeight: "700", fontSize: 16 },
  topBar: {
    position: "absolute",
    top: 48,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(2,6,23,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: DC.cyan,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.9)",
  },
  shutterDisabled: { opacity: 0.45 },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DC.cyan,
  },
});
