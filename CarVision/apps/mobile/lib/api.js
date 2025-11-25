// apps/mobile/lib/api.js
import { getHttpBase } from "./httpBase";
import { getToken, clearAuth } from "./authStore";

async function request(path, { method = "GET", body, headers, isFormData = false } = {}) {
  const base = await getHttpBase();
  const token = await getToken();

  const requestHeaders = {
    ...(headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Don't set Content-Type for FormData, let the browser set it with boundary
  if (!isFormData) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(`${base}${path}`, {
    method,
    headers: requestHeaders,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });

  let data = null;
  try { data = await res.json(); } catch {}

  if (!res.ok || (data && data.ok === false)) {
    const msg = (data && data.error) || `HTTP ${res.status}`;
    // Auto-logout on expired/invalid token:
    if (res.status === 401) {
      try { await clearAuth(); } catch {}
    }
    throw new Error(msg);
  }
  return data ?? {};
}

export const api = {
  get:  (p)        => request(p),
  post: (p, body)  => request(p, { method: "POST", body }),
  put:  (p, body)  => request(p, { method: "PUT", body }),
  del:  (p)        => request(p, { method: "DELETE" }),
};
