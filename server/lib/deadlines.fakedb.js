// An in-memory database for the deadline tests: just enough of the queries in lib/deadlines.js and lib/deadlineNotices.js to run them
// without MySQL. It mirrors what the SQL does (which submissions count, which notices exist), and the tests that use it also check the SQL text
// for the rules that matter. Not used outside tests.
const assert = require('node:assert');

const NOW = Date.UTC(2026, 9, 14, 2, 0, 0);          // 2026-10-14 10:00 in Philippine time
const s = (ms) => Math.floor(ms / 1000);

function makeDb() {
  const state = {
    courses: [{ id: 10, code: 'IT 204', title: 'Data Structures', program: 'BSIT' }, { id: 20, code: 'CS 101', title: 'Algorithms', program: 'BSCS' }],
    users: { 5: ['Fay', 'Cruz'], 6: ['Gus', 'Dela Cruz'], 7: ['Hana', 'Lim'], 8: ['Ivo', 'Reyes'] },
    emails: { 5: 'fay@x.ph', 6: 'gus@x.ph', 7: 'hana@x.ph', 8: null },
    settings: null,                                            // the administration settings row, as JSON text
    clock: NOW,                                                // when a new notice is written
    assigned: [[5, 10], [6, 10], [7, 10], [8, 20]],            // [user, course]
    versions: [],                                              // { user, course, status, at (ms) }
    deadlines: [],
    notices: [],
    nextId: 1,
    queries: [],
  };
  const sql1 = (t) => String(t).replace(/\s+/g, ' ').trim();
  const joined = (row) => {
    const c = state.courses.find((x) => x.id === row.course_id);
    return { deadline_id: row.deadline_id, course_id: row.course_id, term: row.term, due: s(row.due), opens: s(row.opens), instructions: row.instructions,
      created: s(row.created), cancelled: row.cancelled === null ? null : s(row.cancelled), course_code: c.code, course_title: c.title, program_code: c.program };
  };
  const firstSubmission = (userId, courseId, opens) => {
    const at = state.versions.filter((v) => v.user === userId && v.course === courseId && v.status !== 'draft' && v.at >= s(opens) * 1000).map((v) => v.at);
    return at.length ? s(Math.min(...at)) : null;
  };
  const db = {
    state,
    async query(text, p = []) {
      const q = sql1(text);
      state.queries.push(q);
      if (q.startsWith('SELECT course_id FROM courses WHERE')) return [state.courses.filter((c) => c.id === p[0]).map((c) => ({ course_id: c.id }))];
      if (q.startsWith('SELECT deadline_id, UNIX_TIMESTAMP(cancelled_at) AS cancelled FROM subject_deadlines WHERE course_id = ? AND term = ?')) {
        return [state.deadlines.filter((r) => r.course_id === p[0] && r.term === p[1]).map((r) => ({ deadline_id: r.deadline_id, cancelled: r.cancelled === null ? null : s(r.cancelled) }))];
      }
      if (q.startsWith('INSERT INTO subject_deadlines')) {
        const row = { deadline_id: state.nextId++, course_id: p[0], term: p[1], due: p[2] * 1000, opens: p[3] * 1000, instructions: p[4], created: NOW, cancelled: null, by: p[5] };
        state.deadlines.push(row);
        return [{ insertId: row.deadline_id }];
      }
      if (q.startsWith('UPDATE subject_deadlines SET due_at = FROM_UNIXTIME(?), opens_at = FROM_UNIXTIME(?), instructions = ?, created_by = ?, cancelled_at = NULL')) {
        const r = state.deadlines.find((x) => x.deadline_id === p[4]);
        Object.assign(r, { due: p[0] * 1000, opens: p[1] * 1000, instructions: p[2], by: p[3], cancelled: null });
        return [{}];
      }
      if (q.startsWith('UPDATE subject_deadlines SET term = ?')) {
        const r = state.deadlines.find((x) => x.deadline_id === p[4]);
        Object.assign(r, { term: p[0], due: p[1] * 1000, opens: p[2] * 1000, instructions: p[3] });
        return [{}];
      }
      if (q.startsWith('UPDATE subject_deadlines SET cancelled_at = NOW()')) { state.deadlines.find((x) => x.deadline_id === p[0]).cancelled = NOW; return [{}]; }
      if (q.startsWith('SELECT deadline_id FROM subject_deadlines WHERE course_id = ? AND term = ? AND deadline_id <> ?')) {
        return [state.deadlines.filter((r) => r.course_id === p[0] && r.term === p[1] && r.deadline_id !== p[2]).map((r) => ({ deadline_id: r.deadline_id }))];
      }
      if (q.startsWith('SELECT d.deadline_id')) {
        let rows = state.deadlines;
        if (q.includes('WHERE d.deadline_id = ?')) rows = rows.filter((r) => r.deadline_id === p[0]);
        else if (q.includes('JOIN faculty_courses fc')) rows = rows.filter((r) => r.cancelled === null && state.assigned.some(([u, c]) => u === p[0] && c === r.course_id));
        else if (q.includes('d.cancelled_at IS NULL')) rows = rows.filter((r) => r.cancelled === null);
        return [[...rows].sort((a, b) => a.due - b.due || a.deadline_id - b.deadline_id).map(joined)];
      }
      if (q.startsWith('SELECT fc.user_id, u.first_name, u.last_name FROM faculty_courses')) {
        return [state.assigned.filter(([, c]) => c === p[0]).map(([u]) => ({ user_id: u, first_name: state.users[u][0], last_name: state.users[u][1] }))
          .sort((a, b) => a.last_name.localeCompare(b.last_name))];
      }
      if (q.startsWith('SELECT s.user_id, MIN(UNIX_TIMESTAMP(v.created_at)) AS at FROM syllabus_versions')) {
        assert.ok(q.includes("v.status_at_save <> 'draft'") && q.includes('v.created_at >= FROM_UNIXTIME(?)') && q.includes('v.created_by = s.user_id'), 'the submission rules are in the SQL');
        const users = [...new Set(state.versions.filter((v) => v.course === p[0]).map((v) => v.user))];
        return [users.map((u) => ({ user_id: u, at: firstSubmission(u, p[0], p[1] * 1000) })).filter((r) => r.at !== null)];
      }
      if (q.startsWith('SELECT MIN(UNIX_TIMESTAMP(v.created_at)) AS at FROM syllabus_versions')) {
        assert.ok(q.includes("v.status_at_save <> 'draft'") && q.includes('s.user_id = ?'));
        return [[{ at: firstSubmission(p[1], p[0], p[2] * 1000) }]];
      }
      if (q.startsWith('SELECT user_id, MAX(UNIX_TIMESTAMP(created_at)) AS at FROM deadline_notices')) {
        return [state.notices.filter((n) => n.deadline_id === p[0]).map((n) => ({ user_id: n.user_id, at: s(n.at) }))];
      }
      if (q.startsWith('SELECT user_id, email, first_name, last_name FROM users WHERE user_id IN')) {
        return [p[0].filter((u) => state.users[u]).map((u) => ({ user_id: u, email: state.emails[u], first_name: state.users[u][0], last_name: state.users[u][1] }))];
      }
      if (q.startsWith('INSERT INTO deadline_notices')) { for (const [deadline_id, user_id, kind, sent_by] of p[0]) state.notices.push({ deadline_id, user_id, kind, sent_by, at: state.clock }); return [{}]; }
      if (q.startsWith('DELETE FROM deadline_notices WHERE deadline_id = ? AND kind IN')) { state.notices = state.notices.filter((n) => !(n.deadline_id === p[0] && ['before', 'due', 'missed'].includes(n.kind))); return [{}]; }
      if (q.startsWith('SELECT user_id, kind FROM deadline_notices WHERE deadline_id = ?')) { return [state.notices.filter((n) => n.deadline_id === p[0] && ['before', 'due', 'missed'].includes(n.kind)).map((n) => ({ user_id: n.user_id, kind: n.kind }))]; }
      if (q.startsWith('SELECT user_id FROM deadline_notices WHERE deadline_id = ? AND kind')) {
        const kinds = q.includes("kind = 'manual'") ? ['manual'] : ['created', 'updated', 'manual'];
        return [[...new Set(state.notices.filter((n) => n.deadline_id === p[0] && kinds.includes(n.kind) && n.at >= p[1] * 1000).map((n) => n.user_id))].map((u) => ({ user_id: u }))];
      }
      if (q.startsWith("SELECT setting_value FROM app_settings WHERE setting_key = 'administration'")) return [state.settings === null ? [] : [{ setting_value: state.settings }]];
      throw new Error('unexpected query: ' + q);
    },
  };
  return db;
}
const submit = (db, user, course, at, status = 'submitted') => db.state.versions.push({ user, course, status, at });

module.exports = { makeDb, submit, NOW };
