// apps/mobile/lib/wsConfig.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

const KEY = "carvision.ws_url";
const KEY_LAST_IP = "carvision.last_ip"; // Track last known IP to detect network changes
const KEY_VALIDATED_AT = "carvision.validated_at"; // Cache validation timestamp
const PORT = 5173;
const PATH = "/ws";

// Validation cache duration (5 minutes)
const VALIDATION_CACHE_MS = 5 * 60 * 1000;

// fallback if nothing works
export const DEFAULT_WS_URL = `ws://192.168.1.50:${PORT}${PATH}`;

// 1) quick test for a single WS URL
async function tryWs(url, timeoutMs = 600) {
  return new Promise((resolve) => {
    let done = false;
    const ws = new WebSocket(url);

    const to = setTimeout(() => {
      if (done) return;
      done = true;
      ws.close?.();
      resolve(false);
    }, timeoutMs);

    ws.onopen = () => {
      if (done) return;
      done = true;
      clearTimeout(to);
      ws.close();
      resolve(true);
    };

    ws.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(to);
      resolve(false);
    };
  });
}

// Validate if saved URL still works (with shorter timeout for speed)
async function validateSavedUrl(url, timeoutMs = 400) {
  if (!url) return false;
  try {
    return await tryWs(url, timeoutMs);
  } catch {
    return false;
  }
}

// Check if validation is cached and still fresh
async function isValidationCached() {
  try {
    const cached = await AsyncStorage.getItem(KEY_VALIDATED_AT);
    if (cached) {
      const age = Date.now() - parseInt(cached, 10);
      return age < VALIDATION_CACHE_MS;
    }
  } catch {}
  return false;
}

// Mark URL as validated
async function markValidated() {
  try {
    await AsyncStorage.setItem(KEY_VALIDATED_AT, String(Date.now()));
  } catch {}
}

// 2) build candidates from ONE subnet + a list of hosts
function buildFromSubnet(subnet, hosts) {
  return hosts.map((h) => `ws://${subnet}${h}:${PORT}${PATH}`);
}

// 3) build ALL candidate IPs we want to try (aggressive scanning for better detection)
async function buildAllCandidates() {
  // More comprehensive host list for better detection
  const hosts = [2, 3, 4, 5, 10, 14, 15, 20, 25, 30, 40, 50, 60, 80, 100, 101, 102, 103, 200];

  // phone IP
  let phoneSubnet = null;
  try {
    const ip = await Network.getIpAddressAsync(); // e.g. 172.20.10.5 or 10.0.0.5
    if (ip) {
      const p = ip.split(".");
      if (p.length === 4) {
        const [a, b, c] = p;
        phoneSubnet = `${a}.${b}.${c}.`;
        console.log("📱 Phone subnet detected:", phoneSubnet);
      }
    }
  } catch {
    // ignore
  }

  const all = new Set();

  // (a) phone subnet — HIGHEST PRIORITY (scan FULL range 1-254 on this subnet)
  if (phoneSubnet) {
    // Scan ALL IPs from 1-254 on phone's subnet (most likely to have server)
    // This ensures we find the server no matter what IP it's on
    const phoneHosts = [];
    for (let i = 1; i <= 254; i++) {
      phoneHosts.push(i);
    }
    buildFromSubnet(phoneSubnet, phoneHosts).forEach((u) => all.add(u));
    console.log(`✅✅✅ Prioritizing ${phoneSubnet} subnet - scanning ALL 254 IPs (1-254)`);
    console.log(`   This ensures we find your server no matter what IP it's on!`);
  }

  // (b) common home subnets (only if phone subnet different)
  if (!phoneSubnet || (!phoneSubnet.startsWith("192.168.0") && !phoneSubnet.startsWith("192.168.1"))) {
    buildFromSubnet("192.168.0.", hosts).forEach((u) => all.add(u));
    buildFromSubnet("192.168.1.", hosts).forEach((u) => all.add(u));
  }

  // (c) common hotspot / enterprise ranges (only if phone subnet different)
  if (!phoneSubnet || !phoneSubnet.startsWith("172.20.10")) {
    buildFromSubnet("172.20.10.", hosts).forEach((u) => all.add(u));   // iPhone hotspot
  }
  if (!phoneSubnet || !phoneSubnet.startsWith("10.0.0")) {
    buildFromSubnet("10.0.0.", hosts).forEach((u) => all.add(u));
  }
  if (!phoneSubnet || !phoneSubnet.startsWith("10.10.0")) {
    buildFromSubnet("10.10.0.", hosts).forEach((u) => all.add(u));
  }

  const candidates = Array.from(all);
  console.log(`🔍 Will scan ${candidates.length} IP addresses for CarVision server...`);
  return candidates;
}

// 4) Force re-detection (clear cache and scan)
export async function forceReDetect() {
  // Clear saved URL and validation cache
  await AsyncStorage.removeItem(KEY);
  await AsyncStorage.removeItem(KEY_LAST_IP);
  await AsyncStorage.removeItem(KEY_VALIDATED_AT);
  
  // Re-detect
  return await detectAndSave();
}

// 5) Detect and save new URL (aggressive detection - finds server on any WiFi)
async function detectAndSave() {
  // Ensure subnet is saved
  let currentSubnet = null;
  try {
    const ip = await Network.getIpAddressAsync();
    if (ip) {
      const p = ip.split(".");
      if (p.length === 4) {
        const [a, b, c] = p;
        currentSubnet = `${a}.${b}.${c}.`;
        await AsyncStorage.setItem(KEY_LAST_IP, currentSubnet);
        console.log("💾 Current subnet saved:", currentSubnet);
        console.log("📱 Your phone's IP:", ip);
      }
    }
  } catch {
    // ignore
  }

  // Build all candidates
  const candidates = await buildAllCandidates();

  if (candidates.length === 0) {
    console.log("⚠️ No candidates to scan - using default URL");
    return DEFAULT_WS_URL;
  }

  // Separate phone subnet candidates from others for prioritized scanning
  const phoneSubnetCandidates = currentSubnet 
    ? candidates.filter(url => url.startsWith(`ws://${currentSubnet}`))
    : [];
  const otherCandidates = currentSubnet
    ? candidates.filter(url => !url.startsWith(`ws://${currentSubnet}`))
    : candidates;

  console.log("🔍🔍🔍 Starting aggressive network scan for CarVision server...");
  console.log(`   Total IPs to scan: ${candidates.length}`);
  if (currentSubnet && phoneSubnetCandidates.length > 0) {
    console.log(`   📱 Prioritizing YOUR subnet (${currentSubnet}): ${phoneSubnetCandidates.length} IPs`);
    console.log(`   🌐 Other subnets: ${otherCandidates.length} IPs`);
  }
  console.log(`   ⏱️  Timeout per IP: 1500ms (giving server time to respond)`);

  // Scan phone subnet FIRST (most likely to have server)
  if (phoneSubnetCandidates.length > 0) {
    console.log(`\n📡 Scanning YOUR subnet first: ${currentSubnet}...`);
    const phonePromises = phoneSubnetCandidates.map((url) =>
      tryWs(url, 1500).then((ok) => {
        if (ok) {
          // Extract IP from URL for logging
          const ipMatch = url.match(/ws:\/\/(\d+\.\d+\.\d+\.\d+)/);
          console.log(`   ✅✅✅ FOUND SERVER AT: ${ipMatch ? ipMatch[1] : url}`);
        }
        return { url, ok };
      })
    );

    // Check phone subnet results as they come in (return immediately on first success)
    const phoneResults = await Promise.allSettled(phonePromises);
    const phoneWinner = phoneResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value)
      .find((r) => r.ok);

    if (phoneWinner) {
      console.log("🎉🎉🎉 SERVER FOUND ON YOUR SUBNET! WebSocket URL:", phoneWinner.url);
      await AsyncStorage.setItem(KEY, phoneWinner.url);
      await markValidated();
      return phoneWinner.url;
    }
    
    console.log(`   ⚠️ No server found on ${currentSubnet} subnet (scanned ${phoneSubnetCandidates.length} IPs)`);
  }

  // If not found on phone subnet, try other subnets
  if (otherCandidates.length > 0) {
    console.log(`\n🌐 Scanning other subnets...`);
    const otherPromises = otherCandidates.map((url) =>
      tryWs(url, 1500).then((ok) => {
        if (ok) {
          const ipMatch = url.match(/ws:\/\/(\d+\.\d+\.\d+\.\d+)/);
          console.log(`   ✅✅✅ FOUND SERVER AT: ${ipMatch ? ipMatch[1] : url}`);
        }
        return { url, ok };
      })
    );

    const otherResults = await Promise.allSettled(otherPromises);
    const otherWinner = otherResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value)
      .find((r) => r.ok);

    if (otherWinner) {
      console.log("🎉 SERVER FOUND! WebSocket URL:", otherWinner.url);
      await AsyncStorage.setItem(KEY, otherWinner.url);
      await markValidated();
      return otherWinner.url;
    }
  }

  // Nothing found after scanning all IPs
  console.log("\n⚠️⚠️⚠️ NO SERVER FOUND after scanning", candidates.length, "IP addresses");
  console.log("   Possible reasons:");
  console.log("   1. CarVision server is not running");
  console.log("   2. Server is on a different network/subnet");
  console.log("   3. Firewall blocking WebSocket connections");
  console.log("   4. Server is using a different port (expected: 5173)");
  console.log(`\n   Using default URL (will likely fail): ${DEFAULT_WS_URL}`);
  console.log("   Will keep trying to detect on next connection attempt...");
  
  // DON'T save default URL - keep trying to detect on next startup
  return DEFAULT_WS_URL;
}

// Check if network changed (compares current IP subnet with saved one)
export async function checkNetworkChange(fastMode = false) {
  try {
    // In fast mode, just check saved subnet without calling Network API
    if (fastMode) {
      const lastSubnet = await AsyncStorage.getItem(KEY_LAST_IP);
      return !lastSubnet; // If no subnet saved, assume network might have changed
    }
    
    // Full check - get current IP (this is fast, just reads IP, doesn't scan network)
    const currentIp = await Network.getIpAddressAsync();
    if (!currentIp) {
      console.log("⚠️ Could not get current IP address");
      return false;
    }
    
    const p = currentIp.split(".");
    if (p.length !== 4) {
      console.log("⚠️ Invalid IP address format:", currentIp);
      return false;
    }
    
    const [a, b, c] = p;
    const currentSubnet = `${a}.${b}.${c}.`;
    const lastSubnet = await AsyncStorage.getItem(KEY_LAST_IP);
    
    console.log("🔍 Network check - Current subnet:", currentSubnet, "| Last subnet:", lastSubnet);
    
    // Network changed if subnet is different
    if (lastSubnet && lastSubnet !== currentSubnet) {
      console.log("🔄 WiFi/NETWORK CHANGED!");
      console.log("   Old subnet:", lastSubnet);
      console.log("   New subnet:", currentSubnet);
      console.log("   Clearing old WebSocket URL...");
      
      // Clear saved URL and cache
      await AsyncStorage.removeItem(KEY);
      await AsyncStorage.removeItem(KEY_VALIDATED_AT);
      // Update saved subnet
      await AsyncStorage.setItem(KEY_LAST_IP, currentSubnet);
      return true; // Network changed!
    }
    
    // Update saved subnet if it wasn't set (first time)
    if (!lastSubnet) {
      console.log("💾 Saving current subnet:", currentSubnet);
      await AsyncStorage.setItem(KEY_LAST_IP, currentSubnet);
    } else {
      console.log("✅ Same network/subnet - no change detected");
    }
    
    return false; // Network didn't change
  } catch (e) {
    console.log("❌ Network check error:", e);
    return false;
  }
}

// 6) MAIN: get WS URL (optimized for INSTANT startup + automatic network change detection)
export async function getWsUrl(forceReconnect = false, skipValidation = false) {
  // If forced reconnect, clear and re-detect
  if (forceReconnect) {
    return await forceReDetect();
  }

  // CRITICAL: ALWAYS check network change FIRST (synchronously, but fast - just compares subnets)
  // This detects WiFi changes immediately on startup
  console.log("🔍 Checking network change on startup...");
  
  // Check if we have a saved subnet - if not, always re-detect (first time use)
  const lastSubnet = await AsyncStorage.getItem(KEY_LAST_IP);
  
  // Check if network changed (this will update subnet if changed)
  const networkChanged = await checkNetworkChange(false); // Full check to detect WiFi changes
  
  // If network changed, force re-detection immediately and return new URL
  if (networkChanged) {
    console.log("✅✅✅ WiFi/NETWORK CHANGED DETECTED! Re-detecting server...");
    const newUrl = await detectAndSave();
    console.log("✅✅✅ New WebSocket URL detected and saved:", newUrl);
    return newUrl; // Return new URL immediately
  }
  
  // If no saved subnet (first time), always re-detect
  if (!lastSubnet) {
    console.log("⚠️ No saved subnet - first time or cleared. Detecting current network...");
    const newUrl = await detectAndSave();
    console.log("✅ Detected WebSocket URL:", newUrl);
    return newUrl;
  }
  
  console.log("✅ Network unchanged - using saved URL if available");

  // 1) Check saved URL (FAST - just read from storage)
  const saved = await AsyncStorage.getItem(KEY);
  
  // If saved URL is the default (shouldn't be saved, but clear it if it is)
  if (saved === DEFAULT_WS_URL) {
    console.log("⚠️ Found default URL saved - clearing it (default shouldn't be saved)");
    await AsyncStorage.removeItem(KEY);
    await AsyncStorage.removeItem(KEY_VALIDATED_AT);
    // Continue to detection below
  }
  
  // 2) If we have a saved URL (and it's not the default)
  if (saved && saved !== DEFAULT_WS_URL) {
    // Skip URL validation on first load for INSTANT startup
    // (Network change already checked above, so we know we're on same WiFi)
    if (skipValidation) {
      // Validate URL in background without blocking
      setTimeout(() => {
        validateSavedUrl(saved, 200).then((isValid) => {
          if (isValid) {
            markValidated();
          } else {
            // URL doesn't work, clear it for next time
            AsyncStorage.removeItem(KEY);
            AsyncStorage.removeItem(KEY_VALIDATED_AT);
          }
        }).catch(() => {});
      }, 0);
      
      return saved; // Return immediately - network already checked above
    }
    
    // Check if validation is cached (recently validated)
    const isCached = await isValidationCached();
    if (isCached) {
      return saved; // Use cached validation, skip re-validation
    }
    
    // Quick validation (non-blocking if possible, but we wait for it)
    const isValid = await validateSavedUrl(saved, 300);
    if (isValid) {
      await markValidated();
      return saved; // Still works, use it
    }
    
    // Saved URL doesn't work anymore, clear it and re-detect
    await AsyncStorage.removeItem(KEY);
    await AsyncStorage.removeItem(KEY_VALIDATED_AT);
  }

  // 3) Auto-detect and save new URL (only if no saved URL or validation failed)
  console.log("🔍 No saved URL found - starting auto-detection...");
  const detected = await detectAndSave();
  
  // Only save if it's not the default URL (default means detection failed)
  if (detected && detected !== DEFAULT_WS_URL) {
    console.log("✅ Detected and saved new URL:", detected);
    return detected;
  }
  
  // If detection failed and we got default, log it but still return it
  console.log("⚠️ Detection failed - returning default URL:", DEFAULT_WS_URL);
  console.log("   Will try again on next connection attempt");
  return detected;
}

export async function setWsUrl(url) {
  await AsyncStorage.setItem(KEY, url.trim());
}

export async function resetWsUrl() {
  await AsyncStorage.removeItem(KEY);
  await AsyncStorage.removeItem(KEY_LAST_IP);
  await AsyncStorage.removeItem(KEY_VALIDATED_AT);
}

// Get current IP subnet (for monitoring)
export async function getCurrentSubnet() {
  try {
    const ip = await Network.getIpAddressAsync();
    if (!ip) return null;
    const p = ip.split(".");
    if (p.length !== 4) return null;
    const [a, b, c] = p;
    return `${a}.${b}.${c}.`;
  } catch {
    return null;
  }
}
