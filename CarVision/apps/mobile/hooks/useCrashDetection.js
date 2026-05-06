// apps/mobile/hooks/useCrashDetection.js
import { useEffect, useRef, useCallback } from "react";
import { AppState, Platform } from "react-native";
import { Accelerometer } from "expo-sensors";
import { CRASH_CONFIG } from "../lib/emergencyConfig";

function magnitudeG(x, y, z) {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Monitors accelerometer for strong impact spikes (no automatic emergency calls).
 * @param {{ enabled: boolean; onPossibleCrash: () => void }} opts
 */
export function useCrashDetection({ enabled, onPossibleCrash }) {
  const lastFireRef = useRef(0);
  const streakRef = useRef(0);
  const cbRef = useRef(onPossibleCrash);
  cbRef.current = onPossibleCrash;

  const maybeFire = useCallback(() => {
    const now = Date.now();
    if (now - lastFireRef.current < CRASH_CONFIG.cooldownMs) return;
    lastFireRef.current = now;
    streakRef.current = 0;
    cbRef.current?.();
  }, []);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return undefined;

    let accelSub;
    let cancelled = false;

    const appSub = AppState.addEventListener("change", (next) => {
      if (next !== "active") streakRef.current = 0;
    });

    (async () => {
      try {
        const ok = await Accelerometer.isAvailableAsync();
        if (!ok || cancelled) return;

        Accelerometer.setUpdateInterval(CRASH_CONFIG.updateIntervalMs);

        accelSub = Accelerometer.addListener(({ x, y, z }) => {
          if (AppState.currentState !== "active" || !enabled) return;
          const mag = magnitudeG(x, y, z);
          if (mag >= CRASH_CONFIG.magnitudeThresholdG) {
            streakRef.current += 1;
            if (streakRef.current >= CRASH_CONFIG.consecutiveSamples) {
              maybeFire();
            }
          } else {
            streakRef.current = 0;
          }
        });
      } catch {
        /* sensor unavailable */
      }
    })();

    return () => {
      cancelled = true;
      streakRef.current = 0;
      try {
        accelSub?.remove?.();
      } catch {
        /* ignore */
      }
      appSub?.remove?.();
    };
  }, [enabled, maybeFire]);

  return {};
}
