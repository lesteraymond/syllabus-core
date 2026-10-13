const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
// Origin that serves /uploads (the API URL without its /api suffix).
export const API_ORIGIN = API.replace(/\/api\/?$/, '');
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
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || `Request failed (${res.status})`), { status: res.status, data });
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
  // Owner edit: multipart (optional file + note). Errors throw, unlike create/update above.
  edit: async (id, formData) => {
    let res;
    try {
      res = await fetch(`${API}/syllabi/${id}`, { method: 'PUT', credentials: 'include', headers: authHeaders(), body: formData });
    } catch {
      throw new Error('Cannot reach the server. Check that the API is running and try again.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || `Save failed (${res.status})`);
    return data;
  },
  versions: (id) => request(`/syllabi/${id}/versions`),
  // A syllabus as a reviewer reads it: the submitted version (the latest, or `versionId`) with its content, who wrote it and for which program and subject.
  review: (id, versionId) => request(`/syllabi/${id}/review${versionId ? '?version=' + versionId : ''}`),
  // The reviewer's comment thread of a syllabus; only an administrator can add to it.
  comments: (id) => request(`/syllabi/${id}/comments`),
  // A faculty member's syllabi with comments: { installed, counts: { [syllabusId]: { total, unread } } }; unread is null until the migration is run.
  commentSummary: () => request('/syllabi/comment-summary'),
  markCommentsRead: (id) => request(`/syllabi/${id}/comments/read`, { method: 'POST' }),
  addComment: (id, text) => request(`/syllabi/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  // Structured builder content: a draft is created lazily, then saved section by section.
  createDraft: () => request('/syllabi/drafts', { method: 'POST' }),
  getContent: (id) => request(`/syllabi/${id}/content`),
  // Submits a draft, or saves a new version of an existing syllabus (the current content is stored with it).
  submitContent: (id, note) => request(`/syllabi/${id}/submit`, { method: 'POST', body: JSON.stringify({ note }) }),
  saveContent: (id, sections, schemaVersion) => request(`/syllabi/${id}/content`, { method: 'PUT', body: JSON.stringify({ sections, schemaVersion }) }),
};

// Institution and program outcomes (read-only for faculty).
// Compliance checks (rules, plus AI recommendations when a model runs) stored by the server. `get` and `list` read stored runs;
// `recheck` runs the rules: the owner on the saved draft, an administrator on the latest submitted version. The same content returns the stored run, `force` makes a new one.
export const compliance = {
  get: (id) => request(`/syllabi/${id}/compliance`),
  recheck: (id, force = false) => request(`/syllabi/${id}/compliance/recheck`, { method: 'POST', body: JSON.stringify(force ? { force: true } : {}) }),
  list: (syllabus = 'all') => request(`/compliance?syllabus=${encodeURIComponent(syllabus)}`),
};

export const outcomes = {
  institution: () => request('/institution/outcomes'),
  programs: () => request('/programs'),
  program: (code) => request(`/programs/${encodeURIComponent(code)}/outcomes`),
  // Admin only. The server refuses to remove an EGA or PO that a CLO tag still points at (409, naming what uses it).
  saveInstitution: (body) => request('/institution/outcomes', { method: 'PUT', body: JSON.stringify(body) }),
  // `version` is what the screen loaded: a save from an out-of-date screen is refused (409) instead of overwriting.
  saveProgram: (code, pos, version) => request(`/programs/${encodeURIComponent(code)}/outcomes`, { method: 'PUT', body: JSON.stringify({ pos, version }) }),
  saveProgramEgas: (code, egas, version) => request(`/programs/${encodeURIComponent(code)}/egas`, { method: 'PUT', body: JSON.stringify({ egas, version }) }),
};

// Course catalog: course code, title, program and the course learning outcomes (CLOs). Only admins write.
export const courses = {
  list: (program) => request(`/courses${program ? `?program=${encodeURIComponent(program)}` : ''}`),
  get: (id) => request(`/courses/${id}`),
  create: (data) => request('/courses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/courses/${id}`, { method: 'DELETE' }),
  saveClos: (id, clos, version) => request(`/courses/${id}/clos`, { method: 'PUT', body: JSON.stringify({ clos, version }) }),
};

export const curriculum = {
  list: () => request('/curriculum'),
};

export const logs = {
  list: () => request('/logs'),
};

export const messages = {
  listMine: () => request('/messages'), // every message I sent or received, in one request
  list: (syllabusId) => request(`/messages/${syllabusId}`),
  // The server decides the receiver. Old callers may still pass (syllabusId, receiverId, text); it is ignored.
  send: (syllabusId, ...rest) => request(`/messages/${syllabusId}`, { method: 'POST', body: JSON.stringify({ text: rest[rest.length - 1] }) }),
  markRead: (syllabusId) => request(`/messages/read/${syllabusId}`, { method: 'PUT' }),
};

export const notifications = {
  list: () => request('/notifications'),
  summary: () => request('/notifications/summary'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  readAll: () => request('/notifications/read-all', { method: 'PUT' }),
};

export const users = {
  list: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  // Programs and courses an admin assigned to a faculty member. Faculty can create syllabi only for these.
  myAssignments: () => request('/users/me/assignments'),
  assignments: (id) => request(`/users/${id}/assignments`),
  saveAssignments: (id, body) => request(`/users/${id}/assignments`, { method: 'PUT', body: JSON.stringify(body) }),
  // Multipart upload: request() forces a JSON content type, so go direct and let the browser set the boundary.
  uploadAvatar: async (file) => {
    const body = new FormData();
    body.append('avatar', file);
    let res;
    try {
      res = await fetch(`${API}/users/me/avatar`, { method: 'POST', credentials: 'include', headers: authHeaders(), body });
    } catch {
      throw new Error('Cannot reach the server. Check that the API is running and try again.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || `Upload failed (${res.status})`);
    return data;
  },
  removeAvatar: () => request('/users/me/avatar', { method: 'DELETE' }),
};

export const mapping = {
  get: (curriculumId) => request(`/mapping/${curriculumId}`),
  save: (curriculumId, mappings) => request(`/mapping/${curriculumId}`, { method: 'PUT', body: JSON.stringify({ mappings }) }),
};
