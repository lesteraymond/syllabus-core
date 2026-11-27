// PDF import jobs that outlive the request which started them, so a browser refresh during or after a scan can pick it up again.
// The builder names each scan with an id of its own (?job=..., kept in its URL) before uploading; the server records that scan
// under the person who started it. After a refresh the builder asks for the job by that id: a running scan is waited for,
// a finished one hands back its preview (and the PDF, for the preview pane) without uploading or scanning again.
// Kept in memory only, never on disk: one job per person (a new scan replaces the last one), dropped TTL_MS after it ends.
const TTL_MS = 30 * 60 * 1000;
// A running scan ends on its own within pdfImport.MAX_MS (9 minutes); this only frees a job whose worker never reported back.
const RUNNING_MS = 15 * 60 * 1000;
const JOB_ID = /^[A-Za-z0-9_-]{8,64}$/;
const validJobId = id => typeof id === 'string' && JOB_ID.test(id);

function createJobStore({ ttlMs = TTL_MS, runningMs = RUNNING_MS, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const byUser = new Map(); // String(person id) -> job
  const expire = (key, job, ms) => {
    clearTimer(job.timer);
    job.timer = setTimer(() => { if (byUser.get(key) === job) byUser.delete(key); }, ms);
    job.timer?.unref?.();
  };
  return {
    // kind: 'extract' (no subject chosen yet; courseId is filled in when the PDF names one) or 'syllabus' (POST /:id/import-pdf).
    start(userId, id, { kind, syllabusId = null, file }) {
      if (!validJobId(id)) throw new Error('invalid job id');
      const key = String(userId);
      const previous = byUser.get(key);
      if (previous) clearTimer(previous.timer);
      const job = { id, kind, syllabusId, state: 'running', file: { name: String(file?.name || 'syllabus.pdf'), size: Number(file?.size) || 0, buffer: file?.buffer || null }, result: null, error: null, courseId: null, timer: null };
      byUser.set(key, job);
      expire(key, job, runningMs);
      return job;
    },
    finish(userId, id, { result = null, courseId = null } = {}) {
      const key = String(userId), job = byUser.get(key);
      if (!job || job.id !== id) return;
      Object.assign(job, { state: 'done', result, courseId });
      expire(key, job, ttlMs);
    },
    // error: { status, body } exactly as the request would have answered (sendError's shape).
    fail(userId, id, error) {
      const key = String(userId), job = byUser.get(key);
      if (!job || job.id !== id) return;
      Object.assign(job, { state: 'failed', error });
      expire(key, job, ttlMs);
    },
    get(userId, id) {
      const job = byUser.get(String(userId));
      return job && validJobId(id) && job.id === id ? job : null;
    },
    size: () => byUser.size,
  };
}

// What a failed request answers (server/lib/http.js sendError): a refusal keeps its message and fields, anything else is generic.
const errorRecord = (error, serverMessage) => (error && error.status
  ? { status: error.status, body: { error: error.message, ...(error.body || {}) } }
  : { status: 500, body: { error: serverMessage } });

module.exports = { TTL_MS, RUNNING_MS, validJobId, createJobStore, errorRecord };
