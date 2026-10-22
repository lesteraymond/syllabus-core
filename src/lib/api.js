import { tr } from "../i18n/index.js";
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

// The server refuses everything while a generated password is still to be replaced (403, code password_change_required). The app
// registers one handler that shows the "choose your own password" screen; any call that hits it ends up there.
let passwordChangeHandler = null;
export const onPasswordChangeRequired = (fn) => { passwordChangeHandler = fn; };

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
  if (res.status === 403 && data.code === 'password_change_required' && passwordChangeHandler) passwordChangeHandler();
  if (!res.ok) throw Object.assign(new Error(tr(data.message || data.error) || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

// Student registration: scan the COR (multipart), then register with only a password; the server keeps the scan.
export const students = {
  scan: async (file) => {
    const fd = new FormData();
    fd.append('cor', file);
    let res;
    try { res = await fetch(`${API}/students/scan`, { method: 'POST', credentials: 'include', body: fd }); }
    catch { throw new Error('Cannot reach the server. Check that the API is running and try again.'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(tr(data.message || data.error) || `Scan failed (${res.status})`);
    return data;
  },
  register: (password) => request('/students/register', { method: 'POST', body: JSON.stringify({ password }) }),
  me: () => request('/students/me'),
};

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
  // A temporary password is emailed; the answer is the same whether or not the email is registered.
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  // { newPassword } right after a generated password; { currentPassword, newPassword } otherwise.
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
};

export const syllabi = {
  list: () => request('/syllabi'),
  repository: () => request('/syllabi?scope=repository'),
  // Syllabi archived when their subject went to another faculty member: read-only records, left out of every other list.
  archived: (scope) => request('/syllabi?archived=1' + (scope === 'repository' ? '&scope=repository' : '')),
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
    if (!res.ok) throw new Error(tr(data.message || data.error) || `Save failed (${res.status})`);
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
  prepareCheck: id => request(`/syllabi/${id}/prepare-check`, { method: 'POST' }),
  resumeDraft: id => request(`/syllabi/${id}/resume-draft`, { method: 'POST' }),
  publishContent: (id, note, reviewedRunId) => request(`/syllabi/${id}/publish`, { method: 'POST', body: JSON.stringify({ note, reviewedRunId }) }),
  submitContent: (id, note) => request(`/syllabi/${id}/submit`, { method: 'POST', body: JSON.stringify({ note }) }),
  saveContent: (id, sections, schemaVersion) => request(`/syllabi/${id}/content`, { method: 'PUT', body: JSON.stringify({ sections, schemaVersion }) }),
};

// Institution and program outcomes (read-only for faculty).
// Compliance checks (rules, plus AI recommendations when a model runs) stored by the server. `get` and `list` read stored runs;
// `recheck` runs the rules: the owner on the saved draft, an administrator on the latest submitted version. The same content returns the stored run, `force` makes a new one.
export const compliance = {
  get: (id) => request(`/syllabi/${id}/compliance`),
  recheck: (id, force = false) => request(`/syllabi/${id}/compliance/recheck`, { method: 'POST', body: JSON.stringify(force ? { force: true } : {}) }),
  list: (syllabus = 'all', term = null) => request(`/compliance?syllabus=${encodeURIComponent(syllabus)}${term ? `&schoolYear=${encodeURIComponent(term.schoolYear)}&semester=${encodeURIComponent(term.semester)}` : ''}`),
  suggest: (id) => request(`/syllabi/${id}/suggestions`, { method: 'POST', body: '{}' }), // AI rewordings of what the latest check found weak: { suggestions: [{ id, path, label, before, after, why }] }
  terms: () => request('/compliance/terms'), // the school terms that have checks: [{ schoolYear, semester, checks, syllabi }]
  // admin: the latest check of each submitted syllabus, newest first. { limit, from, to }: from/to are ISO instants (from inclusive, to exclusive).
  history: ({ limit, from, to } = {}) => {
    const q = new URLSearchParams();
    if (limit) q.set('limit', limit);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request(`/compliance/history${q.toString() ? `?${q}` : ''}`);
  },
  run: (runId) => request(`/compliance/runs/${encodeURIComponent(runId)}`), // admin: one stored run in full, an earlier one too
};

export const outcomes = {
  institution: () => request('/institution/outcomes'),
  programs: () => request('/programs'),
  renameProgram: (id, name, expectedName, code, expectedCode) => request(`/programs/${id}`, { method: 'PATCH', body: JSON.stringify({ name, expectedName, code, expectedCode }) }),
  previewProgramDeletion: (id) => request(`/programs/${id}/deletion-preview`),
  deleteProgram: (id, confirmation) => request(`/programs/${id}`, { method: 'DELETE', body: JSON.stringify(confirmation) }),
  program: (code) => request(`/programs/${encodeURIComponent(code)}/outcomes`),
  // Admin only. The server refuses to remove an EGA or PO that a CLO tag still points at (409, naming what uses it).
  saveInstitution: (body) => request('/institution/outcomes', { method: 'PUT', body: JSON.stringify(body) }),
  // `version` is what the screen loaded: a save from an out-of-date screen is refused (409) instead of overwriting.
  saveProgram: (code, pos, version) => request(`/programs/${encodeURIComponent(code)}/outcomes`, { method: 'PUT', body: JSON.stringify({ pos, version }) }),
  saveProgramEgas: (code, egas, version) => request(`/programs/${encodeURIComponent(code)}/egas`, { method: 'PUT', body: JSON.stringify({ egas, version }) }),
};

// Course catalog: course code, title, program and the course learning outcomes (CLOs). Only admins write.
export const courses = {
  saveStandards: (id, section, value, version) => request(`/courses/${id}/standards`, { method: 'PUT', body: JSON.stringify({ section, value, version }) }),
  // forSyllabus: { except } asks the server to mark the subjects that already have a syllabus (`taken`); except is the one being edited.
  list: (program, forSyllabus) => request(`/courses?${[program ? `program=${encodeURIComponent(program)}` : '', forSyllabus ? `taken=1&except=${Number(forSyllabus.except) || 0}` : ''].filter(Boolean).join('&')}`),
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
  partners: () => request('/messages/partners'), // who each conversation is with: name, picture, role, program and subject
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

export const adminSettings = {
  get: () => request('/settings'),
  save: (settings) => request('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  standard: () => request('/settings/standard'), // the compliance standard, read-only
};

export const users = {
  updatePreferences: (preferredLanguage) => request('/users/me/preferences', { method: 'PATCH', body: JSON.stringify({ preferredLanguage }) }),
  updateProfile: (data) => request('/users/me/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  syncGoogleAvatar: (token) => request('/users/me/avatar/google', { method: 'POST', body: JSON.stringify({ token }) }),
  syncGoogleAvatarWithAccessToken: (accessToken) => request('/users/me/avatar/google', { method: 'POST', body: JSON.stringify({ accessToken }) }),
  list: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  // Email a user a new generated password (replaces the current one; they must choose their own at the next sign-in).
  resendCredentials: (id) => request(`/users/${id}/resend-credentials`, { method: 'POST' }),
  // Programs and courses an admin assigned to a faculty member. Faculty can create syllabi only for these.
  myAssignments: () => request('/users/me/assignments'),
  assignments: (id) => request(`/users/${id}/assignments`),
  subjectHolders: () => request('/users/subject-holders'),
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
    if (!res.ok) throw new Error(tr(data.message || data.error) || `Upload failed (${res.status})`);
    return data;
  },
  removeAvatar: () => request('/users/me/avatar', { method: 'DELETE' }),
};


// Time in the system, for the signed-in user only. `heartbeat` says "active now" (the server counts the time between beats);
// `summary` is the last 7 or 30 days. `enabled: false` means tracking is off or not set up yet.
export const usage = {
  heartbeat: (options = {}) => request('/usage/heartbeat', { method: 'POST', ...options }),
  summary: (days = 7) => request(`/usage/summary?days=${days === 30 ? 30 : 7}`),
};

// Subject submission deadlines. The administrator sets, changes and cancels them and reads each one's progress; a faculty member reads
// only their own (`mine`). `enabled: false` in an answer means the tables are not set up yet (see docs/deadlines.md).
export const deadlines = {
  list: () => request('/deadlines'),
  mine: () => request('/deadlines/mine'),
  create: (courseId, body) => request(`/deadlines/course/${courseId}`, { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/deadlines/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  cancel: (id) => request(`/deadlines/${id}`, { method: 'DELETE' }),
  progress: (id) => request(`/deadlines/${id}/progress`),
  // Remind the faculty who have not submitted (or only `userIds`). -> { sent, emailed, skipped: [{ userId, reason }] }
  remind: (id, userIds = []) => request(`/deadlines/${id}/remind`, { method: 'POST', body: JSON.stringify({ userIds }) }),
};

