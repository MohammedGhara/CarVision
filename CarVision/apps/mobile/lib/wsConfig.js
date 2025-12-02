// apps/mobile/lib/wsConfig.js
// Ultra-fast auto-detection - works with ANY IP and ANY WiFi network
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

const PORT = 5173;
const PATH = "/ws";
const PING_TIMEOUT = 300; // Faster timeout for speed

// Storage keys
const KEY_IP_CACHE = "carvision.ip_cache"; // Stores: { "192.168.1": "192.168.1.50" }
const KEY_LAST_SUBNET = "carvision.last_subnet";

// Test if server is at this IP by pinging /api/ping endpoint
async function pingServer(ip) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);
    
    const response = await fetch(`http://${ip}:${PORT}/api/ping`, {
      method: "GET",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return data.ok === true;
    }
  } catch {
    // Connection failed - server not at this IP
  }
  return false;
}

// Get device's current subnet (e.g., "192.168.1")
async function getCurrentSubnet() {
  try {
    const ip = await Network.getIpAddressAsync();
    if (!ip) return null;
    
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
  } catch {
    // Network API failed
  }
  return null;
}

// Load cached IP for current subnet
async function getCachedIp(subnet) {
  try {
    const cacheStr = await AsyncStorage.getItem(KEY_IP_CACHE);
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      return cache[subnet] || null;
    }
  } catch {
    // Cache read failed
  }
  return null;
}

// Save IP to cache for subnet
async function cacheIp(subnet, ip) {
  try {
    const cacheStr = await AsyncStorage.getItem(KEY_IP_CACHE) || "{}";
    const cache = JSON.parse(cacheStr);
    cache[subnet] = ip;
    await AsyncStorage.setItem(KEY_IP_CACHE, JSON.stringify(cache));
  } catch {
    // Cache write failed - ignore
  }
}

// Ultra-fast parallel scan - scans ALL IPs in subnet efficiently
async function scanSubnetFast(subnet) {
  console.log(`🔍 Fast scanning ${subnet}.x (1-254) for CarVision server...`);
  
  // Create all IPs to scan (1-254)
  const allIPs = [];
  for (let i = 1; i <= 254; i++) {
    allIPs.push(`${subnet}.${i}`);
  }
  
  // Scan ALL IPs in parallel with large batches for maximum speed
  const BATCH_SIZE = 50; // Scan 50 IPs simultaneously
  
  for (let i = 0; i < allIPs.length; i += BATCH_SIZE) {
    const batch = allIPs.slice(i, i + BATCH_SIZE);
    
    // Scan batch in parallel
    const batchPromises = batch.map(ip => 
      pingServer(ip).then(ok => ok ? ip : null)
    );
    
    // Use Promise.race to return as soon as we find the server
    const batchResults = await Promise.all(batchPromises);
    const found = batchResults.find(ip => ip !== null);
    
    if (found) {
      console.log(`✅ Server found at ${found} (scanned ${i + batch.length}/254 IPs)`);
      return found;
    }
  }
  
  console.log(`❌ Server not found in subnet ${subnet}.x`);
  return null;
}

// Scan multiple common subnets in parallel (for cases where device IP doesn't match server subnet)
async function scanMultipleSubnets(primarySubnet) {
  console.log(`🔍 Scanning multiple common subnets in parallel...`);
  
  // Common subnets to try (besides the primary one)
  const commonSubnets = [
    "192.168.1", "192.168.0", "192.168.2",
    "10.0.0", "10.0.1", 
    "172.16.0", "172.20.10"
  ].filter(s => s !== primarySubnet);
  
  // Add primary subnet first (highest priority)
  const allSubnets = [primarySubnet, ...commonSubnets];
  
  // Scan all subnets in parallel - quick scan first on all, then full scan on primary
  const subnetPromises = allSubnets.map(async (subnet, index) => {
    // Quick scan: try common IPs first (covers most cases fast)
    const quickIPs = [1, 2, 10, 20, 50, 86, 100, 101, 102, 200, 254, 
                      3, 5, 15, 25, 30, 40, 60, 80, 90, 103, 150, 250]; // More IPs for better coverage
    
    const quickPromises = quickIPs.map(host => {
      const ip = `${subnet}.${host}`;
      return pingServer(ip).then(ok => ok ? ip : null);
    });
    
    const quickResults = await Promise.all(quickPromises);
    const found = quickResults.find(ip => ip !== null);
    
    if (found) {
      console.log(`✅ Server found at ${found} (quick scan on ${subnet}.x)`);
      return found;
    }
    
    // Full scan only for primary subnet (device's network) - most likely location
    if (subnet === primarySubnet) {
      return await scanSubnetFast(subnet);
    }
    
    return null;
  });
  
  // Wait for any subnet to find the server
  const results = await Promise.allSettled(subnetPromises);
  
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      return result.value;
    }
  }
  
  return null;
}

// Main function: Get WebSocket URL with auto-detection
export async function getWsUrl() {
  try {
    // Get current subnet
    const subnet = await getCurrentSubnet();
    
    // Check if subnet changed
    const lastSubnet = await AsyncStorage.getItem(KEY_LAST_SUBNET);
    const subnetChanged = lastSubnet !== subnet;
    
    if (subnetChanged && subnet) {
      console.log(`🔄 Network changed: ${lastSubnet || "unknown"} → ${subnet}`);
      await AsyncStorage.setItem(KEY_LAST_SUBNET, subnet);
    }
    
    // Try cached IP first (if same subnet and we have one)
    if (!subnetChanged && subnet) {
      const cachedIp = await getCachedIp(subnet);
      if (cachedIp) {
        // Very fast check if cached IP still works
        const stillWorks = await pingServer(cachedIp);
        if (stillWorks) {
          console.log(`✅ Using cached IP: ${cachedIp}`);
          return `ws://${cachedIp}:${PORT}${PATH}`;
        } else {
          console.log(`⚠️ Cached IP ${cachedIp} no longer works, re-scanning...`);
        }
      }
    }
    
    // Auto-detect: Scan network (works with ANY IP and ANY subnet)
    let serverIp = null;
    
    if (subnet) {
      // First try quick scan on current subnet
      const quickIPs = [1, 2, 10, 20, 50, 86, 100, 101, 102, 200, 254];
      const quickPromises = quickIPs.map(host => {
        const ip = `${subnet}.${host}`;
        return pingServer(ip).then(ok => ok ? ip : null);
      });
      
      const quickResults = await Promise.all(quickPromises);
      serverIp = quickResults.find(ip => ip !== null);
      
      // If not found in quick scan, do full scan (all IPs in parallel batches)
      if (!serverIp) {
        serverIp = await scanSubnetFast(subnet);
      }
      
      // If still not found, try other common subnets in parallel
      if (!serverIp) {
        serverIp = await scanMultipleSubnets(subnet);
      }
    } else {
      // No subnet detected - try common subnets
      console.log("⚠️ Could not detect subnet, trying common networks...");
      serverIp = await scanMultipleSubnets("192.168.1");
    }
    
    // Cache and return if found
    if (serverIp && subnet) {
      await cacheIp(subnet, serverIp);
      console.log(`✅ Auto-detected server at: ${serverIp}`);
      return `ws://${serverIp}:${PORT}${PATH}`;
    }
    
    // Fallback - try a few common IPs
    console.log(`⚠️ Server not found, trying fallback IPs...`);
    const fallbackIPs = ["192.168.1.50", "192.168.1.100", "192.168.0.50"];
    for (const ip of fallbackIPs) {
      if (await pingServer(ip)) {
        if (subnet) await cacheIp(subnet, ip);
        return `ws://${ip}:${PORT}${PATH}`;
      }
    }
    
    // Last resort fallback
    console.log(`⚠️ Using default fallback IP: 192.168.1.50`);
    return `ws://192.168.1.50:${PORT}${PATH}`;
    
  } catch (error) {
    console.error("❌ Error in getWsUrl:", error);
    return `ws://192.168.1.50:${PORT}${PATH}`; // Fallback
  }
}

// Force re-detection (clear cache and scan again)
export async function forceReDetect() {
  try {
    const subnet = await getCurrentSubnet();
    if (subnet) {
      // Clear cache for current subnet
      const cacheStr = await AsyncStorage.getItem(KEY_IP_CACHE) || "{}";
      const cache = JSON.parse(cacheStr);
      delete cache[subnet];
      await AsyncStorage.setItem(KEY_IP_CACHE, JSON.stringify(cache));
      
      console.log(`🔄 Force re-detection for subnet ${subnet}.x`);
    }
    return await getWsUrl();
  } catch {
    return await getWsUrl();
  }
}

// Set WebSocket URL manually (for settings)
export async function setWsUrl(url) {
  try {
    // Support various URL formats
    let ip = null;
    let port = PORT;
    
    // Try different URL patterns
    const patterns = [
      /^wss?:\/\/(\d+\.\d+\.\d+\.\d+)(?::(\d+))?\/ws$/i,
      /^wss?:\/\/(\d+\.\d+\.\d+\.\d+)(?::(\d+))?$/i,
      /^(\d+\.\d+\.\d+\.\d+)(?::(\d+))?$/i,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        ip = match[1];
        if (match[2]) port = parseInt(match[2], 10);
        break;
      }
    }
    
    if (ip) {
      const subnet = ip.split(".").slice(0, 3).join(".");
      await cacheIp(subnet, ip);
      await AsyncStorage.setItem(KEY_LAST_SUBNET, subnet);
      console.log(`💾 Saved IP ${ip} for subnet ${subnet}.x`);
      // Note: Port is fixed at 5173, but IP is cached correctly
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Check if network changed
export async function checkNetworkChange() {
  try {
    const currentSubnet = await getCurrentSubnet();
    const lastSubnet = await AsyncStorage.getItem(KEY_LAST_SUBNET);
    
    if (currentSubnet && lastSubnet && currentSubnet !== lastSubnet) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Reset/clear all cached IPs
export async function resetWsUrl() {
  try {
    await AsyncStorage.removeItem(KEY_IP_CACHE);
    await AsyncStorage.removeItem(KEY_LAST_SUBNET);
  } catch {
    // Ignore errors
  }
}

// Get current subnet (for display)
export async function getCurrentSubnetDisplay() {
  return await getCurrentSubnet();
}

export const DEFAULT_WS_URL = `ws://192.168.1.50:${PORT}${PATH}`;
