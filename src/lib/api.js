const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'sms_jwt';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch {} },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} },
};

// Adds Authorization: Bearer <jwt> when a token is stored.
function authHeaders(extra = {}) {
  const token = tokenStore.get();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      credentials: 'include',
      ...options,
      headers: authHeaders({ 'Content-Type': 'application/json', ...options.headers }),
    });
  } catch {
    throw new Error('Cannot reach the server. Check that the API is running and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) tokenStore.clear(); // expired/invalid JWT
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export const auth = {
  login: async (email, password, remember = false) => {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, remember }) });
    if (data.token) tokenStore.set(data.token);
    return data;
  },
  google: async (idToken) => {
    const data = await request('/auth/google', { method: 'POST', body: JSON.stringify({ token: idToken }) });
    tokenStore.set(data.token);
    return data;
  },
  logout: async () => { tokenStore.clear(); return request('/auth/logout', { method: 'POST' }); },
  me: () => request('/auth/me'),
};

export const syllabi = {
  list: () => request('/syllabi'),
  create: (formData) => fetch(`${API}/syllabi`, { method: 'POST', credentials: 'include', headers: authHeaders(), body: formData }).then(r => r.json()),
  update: (id, data) => fetch(`${API}/syllabi/${id}`, { method: 'PUT', credentials: 'include', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(data) }).then(r => r.json()),
  remove: (id) => request(`/syllabi/${id}`, { method: 'DELETE' }),
};

export const curriculum = {
  list: () => request('/curriculum'),
};

export const logs = {
  list: () => request('/logs'),
};

export const messages = {
  list: (syllabusId) => request(`/messages/${syllabusId}`),
  send: (syllabusId, receiverId, text) => request(`/messages/${syllabusId}`, { method: 'POST', body: JSON.stringify({ receiverId, text }) }),
  markRead: (syllabusId) => request(`/messages/read/${syllabusId}`, { method: 'PUT' }),
};

export const users = {
  list: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),
};

export const mapping = {
  get: (curriculumId) => request(`/mapping/${curriculumId}`),
  save: (curriculumId, mappings) => request(`/mapping/${curriculumId}`, { method: 'PUT', body: JSON.stringify({ mappings }) }),
};
