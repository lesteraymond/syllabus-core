const API = 'http://localhost:3001/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const auth = {
  login: (email, password, remember = false) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, remember }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
};

export const syllabi = {
  list: () => request('/syllabi'),
  create: (formData) => fetch(`${API}/syllabi`, { method: 'POST', credentials: 'include', body: formData }).then(r => r.json()),
  update: (id, data) => fetch(`${API}/syllabi/${id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
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
