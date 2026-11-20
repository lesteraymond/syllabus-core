'use strict';
// A tiny in-memory stand-in for the table syllabus_generate_jobs (db/generate-jobs-ddl.js), for tests of generateJobs.js and the generate routes. It answers exactly the statements
// generateJobs.js sends. `missing: true` makes every statement fail the way MySQL does without the table; `clock()` is "now" in milliseconds.
function fakeJobsDb({ clock = Date.now, missing = false } = {}) {
  const rows = [];
  const find = id => rows.find(r => r.job_id === id);
  const db = {
    rows,
    async query(sql, p = []) {
      const q = String(sql).replace(/\s+/g, ' ').trim();
      if (!/syllabus_generate_jobs/.test(q)) throw Object.assign(new Error('Unexpected query: ' + q), { code: 'UNEXPECTED' });
      if (missing) throw Object.assign(new Error("Table 'syllabus_generate_jobs' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' });
      if (q.startsWith('INSERT INTO')) { rows.push({ job_id: p[0], syllabus_id: p[1], user_id: p[2], status: 'running', step: 0, steps: p[3], stage: null, result_json: null, error_json: null, started_at: clock(), finished_at: null }); return [{ affectedRows: 1 }]; }
      if (q.startsWith('UPDATE') && q.includes('SET step = ?')) { const r = find(p[3]); if (r) Object.assign(r, { step: p[0], steps: p[1], stage: p[2] }); return [{ affectedRows: r ? 1 : 0 }]; }
      if (q.startsWith('UPDATE') && q.includes("SET status = 'done'")) { const r = find(p[1]); if (r) Object.assign(r, { status: 'done', result_json: p[0], finished_at: clock() }); return [{ affectedRows: r ? 1 : 0 }]; }
      if (q.startsWith('UPDATE') && q.includes("SET status = 'failed'")) { const r = find(p[1]); const ok = r && (!q.includes("AND status = 'running'") || r.status === 'running'); if (ok) Object.assign(r, { status: 'failed', error_json: p[0], finished_at: clock() }); return [{ affectedRows: ok ? 1 : 0 }]; }
      if (q.startsWith('UPDATE') && q.includes("SET status = 'applied'")) { let n = 0; for (const r of rows) if (r.syllabus_id === p[0] && r.user_id === p[1] && ['done', 'failed'].includes(r.status)) { Object.assign(r, { status: 'applied', result_json: null }); n++; } return [{ affectedRows: n }]; }
      if (q.startsWith('SELECT UNIX_TIMESTAMP')) return [rows.filter(r => r.user_id === p[0] && clock() - r.started_at < 24 * 60 * 60 * 1000).sort((a, b) => b.started_at - a.started_at).slice(0, p[1]).map(r => ({ at: Math.floor(r.started_at / 1000) }))];
      if (q.startsWith('SELECT * FROM')) return [rows.filter(r => r.syllabus_id === p[0] && r.user_id === p[1] && r.status !== 'applied').sort((a, b) => b.started_at - a.started_at).slice(0, 1)];
      throw Object.assign(new Error('Unexpected statement: ' + q), { code: 'UNEXPECTED' });
    },
  };
  return db;
}

module.exports = { fakeJobsDb };
