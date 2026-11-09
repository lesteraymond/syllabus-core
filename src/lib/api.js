import { tr } from "../i18n/index.js";
import { baseRevisionsFor, nextKnown, isRevisionProblem } from './contentRevisions.js';
import { approvedRefusalText } from './approvedRefusal.js';
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
  if (!res.ok) throw Object.assign(new Error(approvedRefusalText(data) || tr(data.message || data.error) || `Request failed (${res.status})`), { status: res.status, data });
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

// Mandatory revision contract for builder content (see lib/contentRevisions.js and server/lib/contentRevision.js). Revisions live only in this tab's memory, so a tab
// that is still showing older text always carries older revisions and its save is refused instead of overwriting newer content.
const contentRevisions = new Map();
export const isRevisionConflict = isRevisionProblem; // a 409 (outdated copy) or a 428 (no base revision): in both nothing was written

// "?year=..." for a list request, or "" when no year is asked for (the server then uses the current academic year). `joiner` is '?' for the first parameter, '&' after one.
const yearQuery = (year, joiner = '?') => (year ? `${joiner}year=${encodeURIComponent(year)}` : '');

export const syllabi = {
  pdfImportConfig: ({ signal } = {}) => request('/syllabi/pdf-import/config', { signal }),
  importPdf: async (id, file) => {
    const body = new FormData(); body.append('file', file);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150000);
    try {
      const res = await fetch(`${API}/syllabi/${id}/import-pdf`, { method: 'POST', credentials: 'include', headers: authHeaders(), body, signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'pdfImport.failed'), { status: res.status, data });
      if (!data.fields || !Array.isArray(data.pages)) throw new Error('pdfImport.failed');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('pdfImport.timeout');
      throw error;
    } finally { clearTimeout(timeout); }
  },
  // `year` is the academic year (a label, or 'all'); without it the server answers for the current academic year (lib/academicYear.js)
  list: (year) => request('/syllabi' + yearQuery(year)),
  repository: (year) => request('/syllabi?scope=repository' + yearQuery(year, '&')),
  // Syllabi archived when their subject went to another faculty member: read-only records, left out of every other list.
  archived: (scope, year) => request('/syllabi?archived=1' + (scope === 'repository' ? '&scope=repository' : '') + yearQuery(year, '&')),
  create: (formData) => fetch(`${API}/syllabi`, { method: 'POST', credentials: 'include', headers: authHeaders(), body: formData }).then(r => r.json()),
  update: (id, data) => fetch(`${API}/syllabi/${id}`, { method: 'PUT', credentials: 'include', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(data) }).then(r => r.json()),
  remove: (id) => request(`/syllabi/${id}`, { method: 'DELETE' }),
  // The review chain: a reviewer (dean, Asst. VPAA, LIC Director) clears their own stage on the newest version; `stages` says who cleared which.
  clearStage: (id, note) => request(`/syllabi/${id}/stage-clear`, { method: 'POST', body: JSON.stringify(note ? { note } : {}) }),
  // A reviewer chooses to review the newest version without an AI check (server/lib/reviewAiChoice.js).
  reviewWithoutAi: (id, note) => request(`/syllabi/${id}/review-without-ai`, { method: 'POST', body: JSON.stringify(note ? { note } : {}) }),
  stages: (id) => request(`/syllabi/${id}/stages`),
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
  // The author's review of changed Program Outcomes: what changed, and the explicit adoption of exactly what was reviewed.
  poReview: (id) => request(`/syllabi/${id}/po-review`),
  adoptPoReview: (id, reviewedSha256) => request(`/syllabi/${id}/po-review/adopt`, { method: 'POST', body: JSON.stringify({ reviewedSha256, confirm: true }) }),
  // Structured builder content: a draft is created lazily, then saved section by section.
  createDraft: () => request('/syllabi/drafts', { method: 'POST' }),
  getContent: async (id) => {
    const res = await request(`/syllabi/${id}/content`);
    if (res && res.revisions) contentRevisions.set(String(id), { ...res.revisions });
    return res;
  },
  // Submits a draft, or saves a new version of an existing syllabus (the current content is stored with it).
  prepareCheck: id => request(`/syllabi/${id}/prepare-check`, { method: 'POST' }),
  resumeDraft: id => request(`/syllabi/${id}/resume-draft`, { method: 'POST' }),
  publishContent: (id, note, reviewedRunId) => request(`/syllabi/${id}/publish`, { method: 'POST', body: JSON.stringify({ note, reviewedRunId }) }),
  submitContent: (id, note) => request(`/syllabi/${id}/submit`, { method: 'POST', body: JSON.stringify({ note }) }),
  saveContent: async (id, sections, schemaVersion) => {
    const known = contentRevisions.get(String(id));
    const body = { sections, schemaVersion };
    const baseRevisions = baseRevisionsFor(known, sections);
    if (baseRevisions) body.baseRevisions = baseRevisions;
    const res = await request(`/syllabi/${id}/content`, { method: 'PUT', body: JSON.stringify(body) });
    const next = nextKnown(known, sections, res);
    if (next) contentRevisions.set(String(id), next);
    return res;
  },
};

// Institution and program outcomes (read-only for faculty).
// Compliance checks (rules, plus AI recommendations when a model runs) stored by the server. `get` and `list` read stored runs;
// `recheck` runs the rules: the owner on the saved draft, an administrator on the latest submitted version. The same content returns the stored run, `force` makes a new one.
export const compliance = {
  get: (id) => request(`/syllabi/${id}/compliance`),
  recheck: (id, force = false) => request(`/syllabi/${id}/compliance/recheck`, { method: 'POST', body: JSON.stringify(force ? { force: true } : {}) }),
  list: (syllabus = 'all', year) => request(`/compliance?syllabus=${encodeURIComponent(syllabus)}${yearQuery(year, '&')}`),
  // reviewers: when each subject's syllabus was approved, for Program Compliance over time (the dashboard's View analytics)
  programApprovals: (year) => request(`/compliance/program-approvals${yearQuery(year)}`),
  // admin: the latest check of each submitted syllabus, newest first. { limit, from, to }: from/to are ISO instants (from inclusive, to exclusive).
  history: ({ limit, from, to, year } = {}) => {
    const q = new URLSearchParams();
    if (year) q.set('year', year);
    if (limit) q.set('limit', limit);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request(`/compliance/history${q.toString() ? `?${q}` : ''}`);
  },
  run: (runId) => request(`/compliance/runs/${encodeURIComponent(runId)}`), // admin: one stored run in full, an earlier one too
};

export const outcomes = {
  institution: () => request('/institution/outcomes'),
  // `year`: the academic year of the catalog (the catalog is per year); without it the server answers for the current one
  programs: (year) => request('/programs' + yearQuery(year)),
  createProgram: (body) => request('/programs', { method: 'POST', body: JSON.stringify(body) }),
  renameProgram: (id, name, expectedName, code, expectedCode) => request(`/programs/${id}`, { method: 'PATCH', body: JSON.stringify({ name, expectedName, code, expectedCode }) }),
  previewProgramDeletion: (id) => request(`/programs/${id}/deletion-preview`),
  deleteProgram: (id, confirmation) => request(`/programs/${id}`, { method: 'DELETE', body: JSON.stringify(confirmation) }),
  program: (code) => request(`/programs/${encodeURIComponent(code)}/outcomes`),
  // Admin only. The server refuses to remove an EGA or PO that a CLO tag still points at (409, naming what uses it).
  saveInstitution: (body) => request('/institution/outcomes', { method: 'PUT', body: JSON.stringify(body) }),
  // `version` is what the screen loaded: a save from an out-of-date screen is refused (409) instead of overwriting.
  saveProgram: (code, pos, version) => request(`/programs/${encodeURIComponent(code)}/outcomes`, { method: 'PUT', body: JSON.stringify({ pos, version }) }),
  syncSubjects: (id) => request(`/programs/${id}/sync-subjects`, { method: 'POST' }),
  saveProgramEgas: (code, egas, version) => request(`/programs/${encodeURIComponent(code)}/egas`, { method: 'PUT', body: JSON.stringify({ egas, version }) }),
};

// Course catalog: course code, title, program and the course learning outcomes (CLOs). Only admins write.
export const courses = {
  saveStandards: (id, section, value, version) => request(`/courses/${id}/standards`, { method: 'PUT', body: JSON.stringify({ section, value, version }) }),
  // forSyllabus: { except } asks the server to mark the subjects that already have a syllabus (`taken`); except is the one being edited.
  list: (program, forSyllabus, year) => request(`/courses?${[program ? `program=${encodeURIComponent(program)}` : '', forSyllabus ? `taken=1&except=${Number(forSyllabus.except) || 0}` : '', year ? `year=${encodeURIComponent(year)}` : ''].filter(Boolean).join('&')}`),
  get: (id) => request(`/courses/${id}`),
  create: (data) => request('/courses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/courses/${id}`, { method: 'DELETE' }),
  saveClos: (id, clos, version) => request(`/courses/${id}/clos`, { method: 'PUT', body: JSON.stringify({ clos, version }) }),
};

// The academic years an administrator offers when adding a subject. Everyone reads; only admins add.
export const academicYears = {
  list: () => request('/academic-years'),
  create: (startYear) => request('/academic-years', { method: 'POST', body: JSON.stringify({ startYear }) }),
  // Admin only: make an existing year the current one (new syllabi are stamped with it and every list starts on it). Answers with the list.
  // Admin only: fill the current (empty) year's catalog from an earlier year's. Answers { from, to, programs, subjects, years }.
  copyCatalog: (from) => request('/academic-years/copy-catalog', { method: 'POST', body: JSON.stringify(from ? { from } : {}) }),
  setCurrent: (label) => request('/academic-years/current', { method: 'PUT', body: JSON.stringify({ label }) }),
  // Admin only: delete a year nothing belongs to (refused for the current year and for one that syllabi, programs or subjects use). Answers with the list.
  remove: (label) => request('/academic-years/' + encodeURIComponent(label), { method: 'DELETE' }),
};

export const curriculum = {
  list: () => request('/curriculum'),
};

export const syllabusCheck = {
  status: () => request('/syllabus-check/status'),
  // The approved curriculum references (administrator only): [{ id, program, curriculumYear, status, source, courses }]
  references: () => request('/syllabus-check/references'),
  decisions: (runId) => request(`/syllabus-check/runs/${runId}/decisions`),
  // Check one AI recommendation against every relationship its text touches, and get the text to use (nothing is saved or applied).
  refine: (runId, suggestionId, editedText) => request(`/syllabus-check/runs/${runId}/suggestions/${encodeURIComponent(suggestionId)}/refine`, {
    method: 'POST',
    ...(typeof editedText === 'string' && editedText.trim() ? { body: JSON.stringify({ editedText }) } : {}),
  }),
  decide: (runId, body) => request(`/syllabus-check/runs/${runId}/decisions`, { method: 'POST', body: JSON.stringify(body) }),
  getImprovementPlan: (runId) => request(`/syllabus-check/runs/${runId}/improvement-plan`),
  applyImprovementPlan: (runId, body) => request(`/syllabus-check/runs/${runId}/improvement-plan/apply`, { method: 'POST', body: JSON.stringify(body || {}) }),
};

export const logs = {
  // no options: the signed-in account's own activity. The administrator may pass { scope: 'all' } for everyone's, with { userId } for one person's.
  list: ({ scope, userId } = {}) => { const q = new URLSearchParams(); if (scope) q.set('scope', scope); if (userId) q.set('userId', String(userId)); const text = q.toString(); return request('/logs' + (text ? '?' + text : '')); },
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
  // the switches that change the app for everyone (strict step order, AI checking, email), readable by any signed-in person
  policy: () => request('/settings/policy'),
  save: (settings) => request('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};

export const users = {
  updatePreferences: (preferredLanguage) => request('/users/me/preferences', { method: 'PATCH', body: JSON.stringify({ preferredLanguage }) }),
  updateProfile: (data) => request('/users/me/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  syncGoogleAvatar: (token) => request('/users/me/avatar/google', { method: 'POST', body: JSON.stringify({ token }) }),
  syncGoogleAvatarWithAccessToken: (accessToken) => request('/users/me/avatar/google', { method: 'POST', body: JSON.stringify({ accessToken }) }),
  list: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  disable: (id) => request(`/users/${id}/disable`, { method: 'POST' }),
  enable: (id) => request(`/users/${id}/enable`, { method: 'POST' }),
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

