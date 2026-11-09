// The Admin Program Outcome reference API (server/routes/programPoReference.js). Its own small client so the panel does not depend on the shared api.js; it uses the same base URL,
// credentials and bearer token. Every call is Admin-only on the server; a 403 here means the signed-in role may not do it.
const BASE = (import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:3001/api';
const token = () => { try { return localStorage.getItem('sms_jwt'); } catch { return null; } };
async function request(path, options = {}) {
  let res;
  try { res = await fetch(`${BASE}${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...options.headers } }); }
  catch { throw new Error('Cannot reach the server. Check that the API is running and try again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || data.message || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}
const base = (id) => `/programs/${encodeURIComponent(id)}/po-reference`;
export const poReference = {
  overview: (id) => request(base(id)),
  compare: (id, from, to) => request(`${base(id)}/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  candidates: (id) => request(`${base(id)}/candidates`),
  record: (id) => request(`${base(id)}/record`, { method: 'POST', body: '{}' }),
  adopt: (id, referenceId, note) => request(`${base(id)}/adopt`, { method: 'POST', body: JSON.stringify({ referenceId, note }) }),
};
