import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { runVisionAgent } from "../services/visionAgent.js";

/**
 * @typedef {'idle'|'picking'|'analyzing'|'done'|'error'} VisionPhase
 */

export function useVisionScan() {
  const [phase, setPhase] = /** @type {[VisionPhase, import('react').Dispatch<import('react').SetStateAction<VisionPhase>>]} */ (
    useState("idle")
  );
  const [imageUri, setImageUri] = useState(/** @type {string|null} */ (null));
  const [fileName, setFileName] = useState(/** @type {string|null} */ (null));
  const [userHint, setUserHint] = useState("");
  const [result, setResult] = useState(/** @type {import('../models/scanTypes.js').VisionScanResult|null} */ (null));
  const [error, setError] = useState(/** @type {string|null} */ (null));

  const reset = useCallback(() => {
    setPhase("idle");
    setImageUri(null);
    setFileName(null);
    setUserHint("");
    setResult(null);
    setError(null);
  }, []);

  const pickLibrary = useCallback(async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission denied.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setImageUri(a.uri);
    setFileName(a.fileName || a.uri.split("/").pop() || "upload.jpg");
    setResult(null);
    setPhase("idle");
  }, []);

  const pickCameraPicker = useCallback(async () => {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Camera permission denied.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setImageUri(a.uri);
    setFileName(a.fileName || "camera.jpg");
    setResult(null);
    setPhase("idle");
  }, []);

  const setCapturedUri = useCallback((uri) => {
    setImageUri(uri);
    setFileName(uri.split("/").pop() || "capture.jpg");
    setResult(null);
    setPhase("idle");
    setError(null);
  }, []);

  /**
   * @param {{ demoKnowledgeId?: string|null, userHintOverride?: string|null }} [opts]
   */
  const analyze = useCallback(
    async (opts = {}) => {
      setError(null);
      if (!imageUri && !opts.demoKnowledgeId) {
        setError("Select or capture an image first.");
        return;
      }
      const mergedHint = (opts.userHintOverride ?? userHint).trim() || null;
      setPhase("analyzing");
      try {
        const res = await runVisionAgent({
          imageUri: imageUri || "demo://placeholder",
          fileName,
          userHint: mergedHint,
          demoKnowledgeId: opts.demoKnowledgeId || null,
        });
        setResult(res);
        setPhase("done");
      } catch (e) {
        setError(e?.message || "Analysis failed.");
        setPhase("error");
      }
    },
    [imageUri, fileName, userHint]
  );

  return {
    phase,
    imageUri,
    fileName,
    userHint,
    setUserHint,
    result,
    error,
    setError,
    reset,
    pickLibrary,
    pickCameraPicker,
    setCapturedUri,
    analyze,
  };
}
