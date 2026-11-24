// Where the app is, kept in the URL hash so a browser refresh lands back there.
//  - every screen is "#<page>" (#reports, #my-syllabi);
//  - the Syllabus Builder adds what it needs to come back to the same work: "#builder?id=12&mode=upload&job=abc",
//    id = the saved draft, mode = 'upload' while a PDF import is open, job = the PDF scan the server keeps for that import
//    (server/lib/pdfImportJobs.js). A new builder with nothing saved yet is just "#builder".
// On a page load, "#builder" alone opens My Syllabi (a blank builder would only lose the person's place); with a draft id or an
// open PDF import the builder is opened again on that work.

const JOB_ID = /^[A-Za-z0-9_-]{8,64}$/;

// { page, params } from a hash such as "#builder?id=3" or "#/reports". A malformed hash gives page ''.
export function readHash(hash) {
  let raw = String(hash || '').replace(/^#\/?/, '');
  const q = raw.indexOf('?');
  const query = q >= 0 ? raw.slice(q + 1) : '';
  if (q >= 0) raw = raw.slice(0, q);
  let page = '';
  try { page = decodeURIComponent(raw); } catch { /* malformed hash */ }
  let params;
  try { params = new URLSearchParams(query); } catch { params = new URLSearchParams(); }
  return { page, params };
}

export const pageOfHash = (hash) => readHash(hash).page;

// The builder's own part of the hash; anything unusable is dropped (null).
export function builderState(hash) {
  const { page, params } = readHash(hash);
  if (page !== 'builder') return null;
  const n = Number(params.get('id'));
  const id = Number.isSafeInteger(n) && n > 0 ? n : null;
  const mode = params.get('mode') === 'upload' ? 'upload' : null;
  const rawJob = params.get('job');
  const job = mode && rawJob && JOB_ID.test(rawJob) ? rawJob : null;
  return { id, mode, job };
}

// The hash for the builder's current work.
export function builderHash({ id = null, mode = null, job = null } = {}) {
  const params = new URLSearchParams();
  if (Number.isSafeInteger(id) && id > 0) params.set('id', String(id));
  if (mode === 'upload') {
    params.set('mode', 'upload');
    if (job && JOB_ID.test(job)) params.set('job', job);
  }
  const query = params.toString();
  return '#builder' + (query ? '?' + query : '');
}

// What a page load opens: { page, editing, restore }. `editing` is the draft to open in the builder ({ syllabusId }) and
// `restore` the builder's mode and PDF scan to pick up again; both are null for every other screen.
export function routeOnLoad(hash) {
  const page = pageOfHash(hash);
  if (page !== 'builder') return { page, editing: null, restore: null };
  const state = builderState(hash);
  if (!state.id && !state.mode) return { page: 'my-syllabi', editing: null, restore: null };
  return { page: 'builder', editing: state.id ? { syllabusId: state.id } : null, restore: { mode: state.mode || 'form', job: state.job } };
}

// A fresh id for one PDF scan (sent as ?job=..., kept in the builder's hash).
export function newImportJobId(random = () => Math.random()) {
  try {
    if (globalThis.crypto?.randomUUID) return 'j' + globalThis.crypto.randomUUID().replace(/-/g, '');
  } catch { /* not available (an insecure origin): fall back */ }
  let s = 'j' + Date.now().toString(36);
  while (s.length < 28) s += Math.floor(random() * 36).toString(36);
  return s;
}
