// API client: in-memory access token, httpOnly-cookie refresh, single-flight refresh, uniform errors.
let token = null; let refreshing = null;
export class ApiError extends Error { constructor(msg, status, code, details) { super(msg); this.status = status; this.code = code; this.details = details; } }
export const setToken = (t) => { token = t; };
export const hasToken = () => Boolean(token);
const BASE = '/api/v1';

export async function refresh() {
  refreshing ||= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' }).then(async (r) => {
    if (!r.ok) { token = null; return null; }
    const d = await r.json(); token = d.accessToken; return d;
  }).catch(() => null).finally(() => { refreshing = null; });
  return refreshing;
}

export async function api(path, { method = 'GET', body, raw = false, retry = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try { res = await fetch(BASE + path, { method, headers, credentials: 'include', body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch { throw new ApiError('You appear to be offline. Check your connection and try again.', 0, 'NETWORK'); }
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const ok = await refresh();
    if (ok) return api(path, { method, body, raw, retry: false });
    window.dispatchEvent(new CustomEvent('ex:signedout'));
  }
  if (raw && res.ok) return res;
  let data = null; try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (data?.code === 'MAINTENANCE') window.dispatchEvent(new CustomEvent('ex:maintenance'));
    throw new ApiError(data?.error || 'Something went wrong', res.status, data?.code, data?.details);
  }
  return data;
}
api.get = (p) => api(p); api.post = (p, body = {}) => api(p, { method: 'POST', body });
api.put = (p, body) => api(p, { method: 'PUT', body }); api.patch = (p, body) => api(p, { method: 'PATCH', body }); api.del = (p) => api(p, { method: 'DELETE' });
export async function download(path, filename) {
  const res = await api(path, { raw: true }); const blob = await res.blob();
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
