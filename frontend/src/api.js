// Semua komunikasi dengan backend. Request lewat path relatif /api;
// nginx di container frontend meneruskannya ke container backend.
export const API = process.env.REACT_APP_API_URL || "/api";

// Panggil API dan lempar error berisi pesan dari backend kalau status bukan 2xx.
export async function api(path, options = {}) {
  const headers = options.headers || (options.body ? { "Content-Type": "application/json" } : undefined);
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
