// HTTP-level tests for the reviewer's comments (GET/POST /api/syllabi/:id/comments) and for the reason a decision now carries (a return
// for revision or a rejection needs one, and every reason is kept as a typed comment in the same transaction as the status change).
// In-memory fake database, session user from the x-test-user header. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const PEOPLE = { 1: { first_name: 'Ann', last_name: 'A', role: 'admin' }, 5: { first_name: 'Fay', last_name: 'F', role: 'faculty' }, 6: { first_name: 'Gus', last_name: 'G', role: 'faculty' } };

function makeDb() {
  const s = {
    syllabi: {
      1: { syllabus_id: 1, user_id: 5, status: 'submitted', version: 'v1.0', title: 'Programming 2', course_code: 'IT 204', admin_comment: '' },
      2: { syllabus_id: 2, user_id: 5, status: 'draft', version: 'v1.0', title: 'A draft', course_code: 'IT 205', admin_comment: '' },
      3: { syllabus_id: 3, user_id: 6, status: 'under_review', version: 'v1.0', title: 'Networks', course_code: 'IT 301', admin_comment: '' },
    },
    comments: [], notifications: [], logs: [], clock: 0,
    readsInstalled: false, reads: {}, // the comment_reads table, once the migration has been run
  };
  const joined = (c) => ({ ...c, ...PEOPLE[c.user_id] });
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]];
    if (sql.startsWith('SELECT syllabus_id, user_id, status, title, course_code FROM syllabi')) return [s.syllabi[p[0]] ? [s.syllabi[p[0]]] : []];
    if (sql.startsWith('SELECT * FROM syllabi WHERE syllabus_id')) return [s.syllabi[p[0]] ? [s.syllabi[p[0]]] : []];
    if (sql.startsWith('SELECT c.comment_id') && sql.includes('WHERE c.syllabus_id')) return [s.comments.filter((c) => c.syllabus_id === p[0]).sort((a, b) => a.created_at - b.created_at || a.comment_id - b.comment_id).map(joined)];
    if (sql.startsWith('SELECT c.comment_id') && sql.includes('WHERE c.comment_id')) return [s.comments.filter((c) => c.comment_id === p[0]).map(joined)];
    if (sql.startsWith('INSERT INTO comments')) {
      const [syllabus_id, user_id, comment_text, comment_type] = p;
      const row = { comment_id: s.comments.length + 1, syllabus_id, user_id, comment_text, comment_type, created_at: ++s.clock };
      s.comments.push(row);
      return [{ insertId: row.comment_id }];
    }
    if (sql.startsWith('SELECT 1 FROM comment_reads')) { if (!s.readsInstalled) throw new Error("Table 'comment_reads' doesn't exist"); return [[]]; }
    if (sql.startsWith('SELECT c.syllabus_id, COUNT(*) AS total')) {
      const withReads = sql.includes('SUM(');
      const me = withReads ? p[1] : p[0];
      const out = {};
      s.comments.forEach((c) => {
        const syl = s.syllabi[c.syllabus_id];
        if (!syl || syl.user_id !== me) return;
        const o = out[c.syllabus_id] || (out[c.syllabus_id] = { syllabus_id: c.syllabus_id, total: 0, unread: 0 });
        o.total += 1;
        if (c.comment_id > (s.reads[me + ':' + c.syllabus_id] || 0) && c.user_id !== me) o.unread += 1;
      });
      return [Object.values(out).map((o) => (withReads ? o : { syllabus_id: o.syllabus_id, total: o.total }))];
    }
    if (sql.startsWith('SELECT last_comment_id FROM comment_reads')) { const v = s.reads[p[0] + ':' + p[1]]; return [v === undefined ? [] : [{ last_comment_id: v }]]; }
    if (sql.startsWith('SELECT COALESCE(MAX(comment_id), 0) AS last FROM comments')) return [[{ last: Math.max(0, ...s.comments.filter((c) => c.syllabus_id === p[0]).map((c) => c.comment_id)) }]];
    if (sql.startsWith('INSERT INTO comment_reads')) { const k = p[0] + ':' + p[1]; s.reads[k] = Math.max(s.reads[k] || 0, p[2]); return [{}]; } // GREATEST(old, new)
    if (sql.startsWith('INSERT INTO notifications')) { s.notifications.push({ user_id: p[0], type: p[1], syllabus_id: p[2], title: p[3], body: p[4] }); return [{}]; }
    if (sql.startsWith('UPDATE syllabi SET status')) {
      const id = p[p.length - 1];
      s.syllabi[id].status = p[0];
      if (sql.includes('admin_comment')) s.syllabi[id].admin_comment = p[1];
      return [{}];
    }
    if (sql.startsWith('INSERT INTO submission_logs')) { s.logs.push(p); return [{}]; }
    if (/FROM course_prerequisites/.test(sql)) return [[]]; // a subject's prerequisites: none set
    throw new Error('unexpected query: ' + sql);
  };
  const conn = { query: async (q, p) => handle(q, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  return { s, query: async (q, p) => handle(q, p), getConnection: async () => conn };
}

async function withServer(opts, fn) {
  if (typeof opts === 'function') { fn = opts; opts = {}; }
  require('../lib/commentReads').resetInstalledCache();
  const db = makeDb();
  db.s.readsInstalled = !!opts.reads;
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/syllabi', require('./comments'));
  app.use('/api/syllabi', require('./syllabi'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api/syllabi`;
  const call = async (as, method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try { await fn({ db, call }); } finally { await new Promise((r) => server.close(r)); }
}

const admin = { id: 1, role: 'admin', firstName: 'Ann', lastName: 'A' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'G' };

test('an admin adds a comment; it comes back with its author, the owner can read the thread, and the owner is notified', () => withServer(async ({ call, db }) => {
  const r = await call(admin, 'POST', '/1/comments', { text: '  Please check the grading section.  ' });
  assert.strictEqual(r.status, 201);
  assert.deepStrictEqual(r.body.comment, { id: 1, text: 'Please check the grading section.', type: 'comment', createdAt: 1, author: { id: 1, name: 'Ann A', role: 'admin' } });
  await call(admin, 'POST', '/1/comments', { text: 'And the references.' });
  const thread = await call(fay, 'GET', '/1/comments'); // the faculty member who owns it reads the thread
  assert.strictEqual(thread.status, 200);
  assert.deepStrictEqual(thread.body.comments.map((c) => c.text), ['Please check the grading section.', 'And the references.']); // oldest first
  assert.strictEqual((await call(admin, 'GET', '/1/comments')).body.comments.length, 2);
  assert.strictEqual(db.s.notifications.length, 2);
  assert.deepStrictEqual([db.s.notifications[0].user_id, db.s.notifications[0].type, db.s.notifications[0].syllabus_id], [5, 'comment', 1]);
  assert.match(db.s.notifications[0].title, /New reviewer comment: IT 204/);
  assert.match(db.s.notifications[0].body, /grading section/);
}));

test('a comment must have text and not be too long; only an admin may write one', () => withServer(async ({ call, db }) => {
  for (const text of ['', '   ', undefined, 7, null]) assert.strictEqual((await call(admin, 'POST', '/1/comments', { text })).status, 400, String(text));
  assert.strictEqual((await call(admin, 'POST', '/1/comments', { text: 'x'.repeat(2001) })).status, 400);
  assert.strictEqual((await call(admin, 'POST', '/1/comments', { text: 'x'.repeat(2000) })).status, 201);
  assert.strictEqual((await call(fay, 'POST', '/1/comments', { text: 'I am the author' })).status, 403);
  assert.strictEqual((await call(null, 'POST', '/1/comments', { text: 'x' })).status, 401);
  assert.strictEqual(db.s.comments.length, 1);
}));

test('nobody can read or write on a syllabus they cannot see: other faculty, and a draft for an admin', () => withServer(async ({ call, db }) => {
  await call(admin, 'POST', '/1/comments', { text: 'hello' });
  assert.strictEqual((await call(gus, 'GET', '/1/comments')).status, 404);
  assert.strictEqual((await call(gus, 'POST', '/1/comments', { text: 'x' })).status, 404);
  assert.strictEqual((await call(admin, 'GET', '/2/comments')).status, 404); // a draft belongs to its owner
  assert.strictEqual((await call(admin, 'POST', '/2/comments', { text: 'x' })).status, 404);
  assert.deepStrictEqual((await call(fay, 'GET', '/2/comments')).body.comments, []); // the owner of a draft can read its (empty) thread
  assert.strictEqual((await call(admin, 'GET', '/999/comments')).status, 404);
  assert.strictEqual((await call(admin, 'GET', '/abc/comments')).status, 404);
  assert.strictEqual((await call(null, 'GET', '/1/comments')).status, 401);
  assert.strictEqual(db.s.comments.length, 1);
}));

test('approving needs no reason, but a note is kept as an approval comment', () => withServer(async ({ call, db }) => {
  const plain = await call(admin, 'PUT', '/1', { status: 'approved' });
  assert.strictEqual(plain.status, 200);
  assert.strictEqual(db.s.syllabi[1].status, 'approved');
  assert.strictEqual(db.s.comments.length, 0); // nothing to record
  db.s.syllabi[3].status = 'under_review';
  const noted = await call(admin, 'PUT', '/3', { status: 'approved', adminComment: '  Well organised.  ' });
  assert.strictEqual(noted.status, 200);
  assert.deepStrictEqual(db.s.comments.map((c) => [c.syllabus_id, c.user_id, c.comment_type, c.comment_text]), [[3, 1, 'approval', 'Well organised.']]);
  assert.strictEqual(db.s.syllabi[3].admin_comment, '  Well organised.  '); // what the route has always stored
}));

test('returning for revision or rejecting needs a reason of at least 5 characters, and nothing changes without one', () => withServer(async ({ call, db }) => {
  for (const status of ['for_revision', 'rejected']) {
    for (const adminComment of [undefined, '', '    ', 'no', 'four']) {
      const r = await call(admin, 'PUT', '/1', adminComment === undefined ? { status } : { status, adminComment });
      assert.strictEqual(r.status, 400, status + ' / ' + String(adminComment));
      assert.match(r.body.error, /at least 5 characters/);
    }
  }
  assert.strictEqual((await call(admin, 'PUT', '/1', { status: 'for_revision', adminComment: 'x'.repeat(2001) })).status, 400);
  assert.strictEqual(db.s.syllabi[1].status, 'submitted'); // untouched
  assert.strictEqual(db.s.comments.length, 0);
  assert.strictEqual(db.s.logs.length, 0);
}));

test('a valid reason is saved as a revision or rejection comment, and the faculty member is told with the reason', () => withServer(async ({ call, db }) => {
  const rev = await call(admin, 'PUT', '/1', { status: 'for_revision', adminComment: 'Add the missing weeks.' });
  assert.strictEqual(rev.status, 200);
  assert.strictEqual(db.s.syllabi[1].status, 'for_revision');
  const rej = await call(admin, 'PUT', '/3', { status: 'rejected', adminComment: 'Does not follow the template.' });
  assert.strictEqual(rej.status, 200);
  assert.deepStrictEqual(db.s.comments.map((c) => [c.syllabus_id, c.comment_type, c.comment_text]), [[1, 'revision', 'Add the missing weeks.'], [3, 'rejection', 'Does not follow the template.']]);
  assert.deepStrictEqual(db.s.notifications.map((n) => [n.user_id, n.type, n.title.split(':')[0]]), [[5, 'status', 'Revision requested'], [6, 'status', 'Syllabus rejected']]);
  assert.match(db.s.notifications[0].body, /Reviewer comment: Add the missing weeks\./);
  // and the thread the faculty member reads has both the reason and, later, an ordinary comment
  await call(admin, 'POST', '/1/comments', { text: 'Thanks for fixing it.' });
  assert.deepStrictEqual((await call(fay, 'GET', '/1/comments')).body.comments.map((c) => c.type), ['revision', 'comment']);
}));

test('only an administrator can decide; a faculty member cannot, whatever they send', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'PUT', '/1', { status: 'approved', adminComment: 'I approve my own' })).status, 403);
  assert.strictEqual(db.s.syllabi[1].status, 'submitted');
  assert.strictEqual(db.s.comments.length, 0);
}));

// ---- which comments a faculty member has read
const asAdminComment = (call, text) => call(admin, 'POST', '/1/comments', { text });

test('without the read-tracking table, faculty still see their comments; the unread count is simply not known', () => withServer(async ({ call }) => {
  await asAdminComment(call, 'One');
  await asAdminComment(call, 'Two');
  const thread = await call(fay, 'GET', '/1/comments');
  assert.strictEqual(thread.body.comments.length, 2);
  assert.strictEqual(thread.body.lastReadId, null);
  const sum = await call(fay, 'GET', '/comment-summary');
  assert.deepStrictEqual(sum.body, { installed: false, counts: { 1: { total: 2, unread: null } } });
  assert.deepStrictEqual((await call(fay, 'POST', '/1/comments/read')).body, { installed: false });
}));

test('with the table, the summary counts unread comments, reading clears them, and a new comment is unread again', () => withServer({ reads: true }, async ({ call, db }) => {
  assert.deepStrictEqual((await call(fay, 'GET', '/comment-summary')).body, { installed: true, counts: {} }); // nothing yet
  await asAdminComment(call, 'One');
  await asAdminComment(call, 'Two');
  await call(admin, 'PUT', '/1', { status: 'for_revision', adminComment: 'Add the missing weeks.' }); // a decision reason is a comment too
  assert.deepStrictEqual((await call(fay, 'GET', '/comment-summary')).body.counts, { 1: { total: 3, unread: 3 } });
  assert.strictEqual((await call(fay, 'GET', '/1/comments')).body.lastReadId, 0);

  assert.deepStrictEqual((await call(fay, 'POST', '/1/comments/read')).body, { installed: true });
  assert.deepStrictEqual((await call(fay, 'GET', '/comment-summary')).body.counts, { 1: { total: 3, unread: 0 } });
  assert.strictEqual((await call(fay, 'GET', '/1/comments')).body.lastReadId, 3);

  await asAdminComment(call, 'Three');
  assert.deepStrictEqual((await call(fay, 'GET', '/comment-summary')).body.counts, { 1: { total: 4, unread: 1 } });
  assert.strictEqual(db.s.reads['5:1'], 3);
}));

test('reading only ever moves forward, so a stale read cannot make comments unread again', () => withServer({ reads: true }, async ({ call, db }) => {
  await asAdminComment(call, 'One');
  await asAdminComment(call, 'Two');
  db.s.reads['5:1'] = 99; // something already recorded a later position
  await call(fay, 'POST', '/1/comments/read');
  assert.strictEqual(db.s.reads['5:1'], 99);
  assert.strictEqual((await call(fay, 'GET', '/comment-summary')).body.counts[1].unread, 0);
}));

test('the summary lists only your own syllabi, and each person has their own read position', () => withServer({ reads: true }, async ({ call, db }) => {
  await asAdminComment(call, 'For Fay');
  await call(admin, 'POST', '/3/comments', { text: 'For Gus' });
  assert.deepStrictEqual(Object.keys((await call(fay, 'GET', '/comment-summary')).body.counts), ['1']);
  assert.deepStrictEqual(Object.keys((await call(gus, 'GET', '/comment-summary')).body.counts), ['3']);
  await call(fay, 'POST', '/1/comments/read');
  assert.strictEqual((await call(gus, 'GET', '/comment-summary')).body.counts[3].unread, 1); // Gus has not read his
  assert.strictEqual(db.s.reads['6:3'], undefined);
}));

test('only the owner can mark a thread read; an admin has nothing to read, and other faculty cannot see it exists', () => withServer({ reads: true }, async ({ call, db }) => {
  await asAdminComment(call, 'One');
  assert.strictEqual((await call(admin, 'POST', '/1/comments/read')).status, 403);
  assert.strictEqual((await call(gus, 'POST', '/1/comments/read')).status, 404);
  assert.strictEqual((await call(null, 'POST', '/1/comments/read')).status, 401);
  assert.strictEqual((await call(admin, 'POST', '/2/comments/read')).status, 404); // a draft is invisible to an admin
  assert.strictEqual((await call(fay, 'POST', '/999/comments/read')).status, 404);
  assert.deepStrictEqual((await call(admin, 'GET', '/comment-summary')).body, { installed: true, counts: {} });
  assert.strictEqual((await call(null, 'GET', '/comment-summary')).status, 401);
  assert.strictEqual((await call(admin, 'GET', '/1/comments')).body.lastReadId, null); // an admin has no read position
  assert.deepStrictEqual(db.s.reads, {});
}));

test('the comment_reads table is defined the same way in the migration and in schema.sql', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const ddl = require('../db/comment-reads-ddl');
  const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8').replace(/\s+/g, ' ');
  assert.strictEqual(ddl.length, 1);
  assert.ok(ddl[0].includes('CREATE TABLE IF NOT EXISTS comment_reads'), 'idempotent');
  assert.ok(sql.includes(ddl[0].replace(/\s+/g, ' ').trim()), 'schema.sql differs from comment-reads-ddl.js');
  ['user_id', 'syllabus_id', 'last_comment_id', 'PRIMARY KEY (user_id, syllabus_id)'].forEach((x) => assert.ok(ddl[0].includes(x), x));
});
