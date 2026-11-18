'use strict';
// Background jobs of the AI Syllabus Generator. A generation takes several minutes (CLOs, outline, two weekly chunks, requirements, then the check and repair), so the
// request that starts it answers at once and the screen polls for progress. One job per syllabus; only the person who started it can read it.
//
// Two copies of a job: the one running in THIS process (memory) and a row in syllabus_generate_jobs (db/generate-jobs-ddl.js, db/migrate-generate-jobs.js). The row makes a
// finished result survive a server restart until the screen has applied it, and counts a person's generations in the last 24 hours for the daily limit. A job that was
// "running" when the server stopped can never finish: the next read marks it failed. Everything is best effort: without the table (before the migration) the jobs and the
// daily count live in memory only, as they first did, and the server console says so once. A finished job is kept 30 minutes in memory.
const crypto = require('node:crypto');

const KEEP_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const STEPS = 7;
const INTERRUPTED = { status: 502, message: 'The generation was interrupted because the server restarted. Nothing was changed. Try again.' };

const parseJson = text => { try { return text ? JSON.parse(text) : null; } catch { return null; } };

function createJobs({ now = Date.now } = {}) {
  const live = new Map(); // syllabusId -> job of this process (running, or finished and not yet taken)
  let persistent = true, reported = false;
  const memoryCounts = new Map(); // userId -> start times, used only while the table is missing
  const guard = async (work) => {
    if (!persistent) return undefined;
    try { return await work(); } catch (error) {
      if (error && error.code === 'ER_NO_SUCH_TABLE') persistent = false;
      if (!reported) { reported = true; console.error('AI Syllabus Generator jobs: ' + (error && error.code === 'ER_NO_SUCH_TABLE' ? 'the table syllabus_generate_jobs is missing, so jobs and the daily limit are kept in memory only. Run "npm run migrate-generate-jobs" in server/.' : 'could not use the database (' + ((error && (error.code || error.message)) || error) + ')')); }
      return undefined;
    }
  };
  const sweep = () => { for (const [key, job] of live) if (job.finishedAt && now() - job.finishedAt > KEEP_MS) live.delete(key); };
  const view = job => (job ? {
    id: job.id, status: job.status, step: job.step, steps: job.steps, stage: job.stage, startedAt: job.startedAt,
    ...(job.status === 'done' ? { result: job.result } : {}), ...(job.status === 'failed' ? { error: job.error } : {}),
  } : { status: 'none' });
  const fromRow = row => ({
    id: row.job_id, status: row.status, step: row.step, steps: row.steps, stage: row.stage, startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    result: parseJson(row.result_json), error: parseJson(row.error_json),
  });

  return {
    isPersistent: () => persistent,
    // True while a generation of THIS syllabus runs in this process. There is no limit across syllabi: every faculty member can generate at the same time (owner decision 2026-11-18).
    isRunning(syllabusId) { sweep(); const job = live.get(syllabusId); return !!job && job.status === 'running'; },
    runningCount() { sweep(); return [...live.values()].filter(job => job.status === 'running').length; },

    // The daily limit: how many generations this person started in the last 24 hours, against `max`. -> { ok, used, retryAfterSec }.
    async allowance(db, userId, max) {
      const rows = await guard(async () => (await db.query('SELECT UNIX_TIMESTAMP(started_at) AS at FROM syllabus_generate_jobs WHERE user_id = ? AND started_at > (NOW() - INTERVAL 1 DAY) ORDER BY started_at DESC LIMIT ?', [userId, max]))[0]);
      const times = rows ? rows.map(r => Number(r.at) * 1000) : (memoryCounts.get(userId) || []).filter(t => now() - t < DAY_MS).sort((a, b) => b - a);
      memoryCounts.set(userId, (memoryCounts.get(userId) || []).filter(t => now() - t < DAY_MS));
      if (times.length < max) return { ok: true, used: times.length, retryAfterSec: 0 };
      return { ok: false, used: times.length, retryAfterSec: Math.max(1, Math.ceil((times[max - 1] + DAY_MS - now()) / 1000)) };
    },

    // run(onProgress) -> a promise of the generator's result. Returns the job's view at once; its outcome is read with get().
    async start({ db, syllabusId, userId, run }) {
      sweep();
      const job = { id: crypto.randomBytes(8).toString('hex'), syllabusId, userId, status: 'running', step: 0, steps: STEPS, stage: null, startedAt: now(), finishedAt: null, chain: Promise.resolve() };
      live.set(syllabusId, job);
      memoryCounts.set(userId, [...(memoryCounts.get(userId) || []), job.startedAt]);
      await guard(() => db.query('INSERT INTO syllabus_generate_jobs (job_id, syllabus_id, user_id, status, steps) VALUES (?, ?, ?, \'running\', ?)', [job.id, syllabusId, userId, STEPS]));
      const write = (sql, params) => { job.chain = job.chain.then(() => guard(() => db.query(sql, params))); return job.chain; }; // in order, never failing the job
      Promise.resolve()
        .then(() => run(p => {
          if (p && Number.isInteger(p.step)) {
            job.step = p.step; job.steps = p.steps || STEPS; job.stage = p.stage || null;
            write('UPDATE syllabus_generate_jobs SET step = ?, steps = ?, stage = ? WHERE job_id = ?', [job.step, job.steps, job.stage, job.id]);
          }
        }))
        .then(result => { job.status = 'done'; job.result = result; job.finishedAt = now(); return write('UPDATE syllabus_generate_jobs SET status = \'done\', result_json = ?, finished_at = NOW() WHERE job_id = ?', [JSON.stringify(result), job.id]); })
        .catch(error => {
          job.status = 'failed'; job.error = { status: (error && error.status) || 502, message: String((error && error.message) || error).slice(0, 400) }; job.finishedAt = now();
          return write('UPDATE syllabus_generate_jobs SET status = \'failed\', error_json = ?, finished_at = NOW() WHERE job_id = ?', [JSON.stringify(job.error), job.id]);
        });
      return view(job);
    },

    // This process's job when there is one, else the person's latest job on the syllabus from the table (a result that outlived a restart, or one that was interrupted by it).
    async get(db, syllabusId, userId) {
      sweep();
      const mine = live.get(syllabusId);
      if (mine) return view(mine.userId === userId ? mine : null);
      const row = await guard(async () => (await db.query('SELECT * FROM syllabus_generate_jobs WHERE syllabus_id = ? AND user_id = ? AND status <> \'applied\' ORDER BY started_at DESC LIMIT 1', [syllabusId, userId]))[0][0]);
      if (!row) return view(null);
      if (row.status === 'running') { // no job of this process: the server restarted while it ran
        await guard(() => db.query('UPDATE syllabus_generate_jobs SET status = \'failed\', error_json = ?, finished_at = NOW() WHERE job_id = ? AND status = \'running\'', [JSON.stringify(INTERRUPTED), row.job_id]));
        return view({ ...fromRow(row), status: 'failed', error: INTERRUPTED });
      }
      return view(fromRow(row));
    },

    // The screen has applied (or dismissed) a finished job: its result is emptied, the row stays as the record. A running job is never removed.
    async clear(db, syllabusId, userId) {
      const mine = live.get(syllabusId);
      if (mine && mine.userId === userId && mine.status === 'running') return false;
      let cleared = false;
      if (mine && mine.userId === userId) { live.delete(syllabusId); cleared = true; }
      const changed = await guard(async () => (await db.query('UPDATE syllabus_generate_jobs SET status = \'applied\', result_json = NULL WHERE syllabus_id = ? AND user_id = ? AND status IN (\'done\', \'failed\')', [syllabusId, userId]))[0].affectedRows);
      return cleared || changed > 0;
    },
    reset() { live.clear(); memoryCounts.clear(); persistent = true; reported = false; },
  };
}

module.exports = { createJobs, STEPS, KEEP_MS, INTERRUPTED };
