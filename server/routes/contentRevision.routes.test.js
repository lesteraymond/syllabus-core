// Two simultaneously open sessions on one syllabus (server/lib/contentRevision.js). The stateful fake below stores the content text the way the
// real table does, so a save from an outdated copy can be seen to be refused and the newer text to survive. It does not run SQL: it checks the
// route's wiring (revisions returned, compared under the row lock, never merged), not MySQL.
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const rev = require('../lib/contentRevision');

const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'G' };

function makeDb() {
  const s = { row: { syllabus_id: 1, user_id: 5, status: 'draft', version: 'v1.0', title: '', course_code: '', course_id: null, content: JSON.stringify({ description: ['Original description.'], reqs: [{ id: 'r1', text: 'Original requirement' }], schemaVersion: 3 }), content_schema_version: 3, content_updated_at: null, archived_at: null, admin_comment: '' }, saves: 0,
    activity: [], clock: 0, // account_activity rows (lib/accountActivity.js) and the fake's minutes since start, for the editing session
  };
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]]; // requireAuth: the account still exists
    if (sql.startsWith('SELECT program_id FROM faculty_programs')) return [[{ program_id: 1 }]];
    if (sql.startsWith('SELECT course_id FROM faculty_courses')) return [[{ course_id: 10 }]];
    if (sql.startsWith('SELECT syllabus_id, user_id, status, title, course_code, content, course_id, archived_at FROM syllabi')) return [[{ ...s.row }]];
    if (sql.startsWith('SELECT syllabus_id, user_id, status, version, content, content_schema_version')) return [[{ ...s.row }]];
    if (sql.startsWith('UPDATE syllabi SET content')) { s.row.content = p[0]; s.saves++; return [{}]; }
    if (sql.startsWith('SELECT 1 FROM account_activity WHERE user_id = ? AND syllabus_id = ?')) {
      const window = Number(/INTERVAL (\d+) MINUTE/.exec(sql)[1]);
      return [s.activity.filter((a) => a.user_id === p[0] && a.syllabus_id === p[1] && a.action === 'content_edit' && a.at > s.clock - window).slice(0, 1).map(() => ({ 1: 1 }))];
    }
    if (sql.startsWith('INSERT INTO account_activity')) { const [user_id, action, syllabus_id, subject, notes] = p; s.activity.push({ user_id, action, syllabus_id, subject, notes, at: s.clock }); return [{}]; }
    if (sql.startsWith('SELECT label, start_year, is_current FROM academic_years')) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); // a database before the year scope
    if (sql.startsWith("INSERT INTO syllabi (user_id, title, course_code, status, version)")) return [{ insertId: 77 }];
    throw new Error('unexpected query: ' + sql);
  };
  const conn = { query: async (q, p) => handle(q, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  return { s, query: async (q, p) => handle(q, p), getConnection: async () => conn };
}

async function withServer(fn) {
  const db = makeDb();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/syllabi', require('./syllabusContent'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (as, method, path, body) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try { await fn({ db, call }); } finally { await new Promise((r) => server.close(r)); }
}
const stored = (db) => JSON.parse(db.s.row.content);

test('revisions: stable under key order, change with content, and a missing section is "none"', () => {
  assert.strictEqual(rev.revisionOf({ a: 1, b: [1, { x: 1, y: 2 }] }), rev.revisionOf({ b: [1, { y: 2, x: 1 }], a: 1 }));
  assert.notStrictEqual(rev.revisionOf(['a']), rev.revisionOf(['b']));
  assert.strictEqual(rev.revisionOf(undefined), 'none');
  assert.deepStrictEqual(Object.keys(rev.revisionsOf({ plan: [] })), rev.SECTION_KEYS);
  assert.deepStrictEqual(rev.staleSections({ plan: ['x'] }, { plan: rev.revisionOf(['y']), reqs: 'none' }, ['plan', 'reqs']), ['plan']);
  assert.deepStrictEqual(rev.staleSections({ plan: ['x'] }, undefined, ['plan']), [], 'no base revision: not compared (new draft or an older caller)');
  assert.ok(rev.validBase(undefined) && rev.validBase({ plan: 'abc' }) && !rev.validBase([]) && !rev.validBase({ plan: 5 }) && !rev.validBase({ nope: 'x' }));
});

test("two open sessions: the second tab's save of a section the first tab changed is refused with 409, and the newer text survives", () => withServer(async ({ call, db }) => {
  const tabA = await call(fay, 'GET', '/syllabi/1/content');
  const tabB = await call(fay, 'GET', '/syllabi/1/content');
  assert.strictEqual(tabA.status, 200);
  assert.deepStrictEqual(tabA.body.revisions, tabB.body.revisions, 'both tabs opened the same version');
  assert.deepStrictEqual(Object.keys(tabA.body.revisions), rev.SECTION_KEYS);

  const saveA = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['Tab A wrote this newer description.'] }, schemaVersion: 3, baseRevisions: { description: tabA.body.revisions.description } });
  assert.strictEqual(saveA.status, 200);
  assert.notStrictEqual(saveA.body.revisions.description, tabA.body.revisions.description, "the save returns the section's new revision");

  const saveB = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['Tab B still holds the old copy and overwrites.'] }, schemaVersion: 3, baseRevisions: { description: tabB.body.revisions.description } });
  assert.strictEqual(saveB.status, 409);
  assert.strictEqual(saveB.body.code, 'revision_conflict');
  assert.deepStrictEqual(saveB.body.sections, ['description']);
  assert.match(saveB.body.error || saveB.body.message, /not applied|Newer changes/i);
  assert.strictEqual(saveB.body.revisions.description, saveA.body.revisions.description, 'the refusal tells the client what is stored now');
  assert.deepStrictEqual(stored(db).description, ['Tab A wrote this newer description.'], 'the newer faculty content was preserved');
  assert.strictEqual(db.s.saves, 1, 'the refused save wrote nothing');
}));

test('a stale whole-section save (the AI Checker Accept path) cannot overwrite newer rows of the same section', () => withServer(async ({ call, db }) => {
  const stale = await call(fay, 'GET', '/syllabi/1/content'); // the checker page loads, then shows a recommendation for a requirement row
  await call(fay, 'PUT', '/syllabi/1/content', { sections: { reqs: [{ id: 'r1', text: 'Original requirement' }, { id: 'r2', text: 'Added by the faculty in the builder tab' }] }, schemaVersion: 3, baseRevisions: { reqs: stale.body.revisions.reqs } });
  const accept = await call(fay, 'PUT', '/syllabi/1/content', { sections: { reqs: [{ id: 'r1', text: 'Recommended rewrite' }] }, schemaVersion: 3, baseRevisions: { reqs: stale.body.revisions.reqs } });
  assert.strictEqual(accept.status, 409);
  assert.strictEqual(stored(db).reqs.length, 2, 'the row the faculty added is still there');
  assert.strictEqual(stored(db).reqs[0].text, 'Original requirement', 'the recommendation was not written');
  // after loading the latest version the same change goes through: refresh and review, not a dead end
  const latest = await call(fay, 'GET', '/syllabi/1/content');
  const retry = await call(fay, 'PUT', '/syllabi/1/content', { sections: { reqs: [{ id: 'r1', text: 'Recommended rewrite' }, { id: 'r2', text: 'Added by the faculty in the builder tab' }] }, schemaVersion: 3, baseRevisions: { reqs: latest.body.revisions.reqs } });
  assert.strictEqual(retry.status, 200);
}));

test('different sections never conflict: a tab saving "reqs" is not blocked by another tab having saved "description"', () => withServer(async ({ call, db }) => {
  const a = await call(fay, 'GET', '/syllabi/1/content');
  const b = await call(fay, 'GET', '/syllabi/1/content');
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['A changed the description'] }, schemaVersion: 3, baseRevisions: { description: a.body.revisions.description } })).status, 200);
  const other = await call(fay, 'PUT', '/syllabi/1/content', { sections: { reqs: [{ id: 'r1', text: 'B changed the requirement' }] }, schemaVersion: 3, baseRevisions: { reqs: b.body.revisions.reqs } });
  assert.strictEqual(other.status, 200);
  assert.deepStrictEqual(stored(db).description, ['A changed the description']);
  assert.strictEqual(stored(db).reqs[0].text, 'B changed the requirement');
}));

test('the base revision is MANDATORY for a section that already has content: no base is refused with 428, nothing is written, and the answer carries the current revisions', () => withServer(async ({ call, db }) => {
  const none = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['no base'] }, schemaVersion: 3 });
  assert.strictEqual(none.status, 428);
  assert.strictEqual(none.body.code, 'revision_required');
  assert.deepStrictEqual(none.body.sections, ['description']);
  assert.match(none.body.error || none.body.message, /refused rather than risk replacing newer content/);
  assert.deepStrictEqual(Object.keys(none.body.revisions), rev.SECTION_KEYS, 'the client is told what is stored, so it can load and retry');
  const partial = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['x'], reqs: [{ id: 'r1', text: 'x' }] }, schemaVersion: 3, baseRevisions: { description: none.body.revisions.description } });
  assert.strictEqual(partial.status, 428, 'every stored section being saved needs its own base');
  assert.deepStrictEqual(partial.body.sections, ['reqs']);
  assert.deepStrictEqual(stored(db).description, ['Original description.']);
  assert.strictEqual(db.s.saves, 0, 'nothing was written');
  // malformed bases are a client error too
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['x'] }, schemaVersion: 3, baseRevisions: [] })).status, 400);
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['x'] }, schemaVersion: 3, baseRevisions: { description: 7 } })).status, 400);
  // there is no way round it: an empty object, a base for another section, or "none" for a section that has content do not satisfy the contract
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['x'] }, schemaVersion: 3, baseRevisions: {} })).status, 428);
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['x'] }, schemaVersion: 3, baseRevisions: { reqs: none.body.revisions.reqs } })).status, 428);
  const lie = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['x'] }, schemaVersion: 3, baseRevisions: { description: 'none' } });
  assert.strictEqual(lie.status, 409);
  assert.strictEqual(db.s.saves, 0);
}));

test('safe initial content: a section with nothing stored yet needs no base, and a brand-new draft with no content at all can be saved for the first time', () => withServer(async ({ call, db }) => {
  const first = await call(fay, 'PUT', '/syllabi/1/content', { sections: { grading: { rows: [] } }, schemaVersion: 3 });
  assert.strictEqual(first.status, 200, 'nothing is stored for grading, so nothing can be overwritten');
  assert.ok(first.body.revisions.grading && first.body.revisions.grading !== 'none');
  // once it has content the contract applies to it like any other section
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', { sections: { grading: { rows: [1] } }, schemaVersion: 3 })).status, 428);
  // a draft row with no content at all (POST /drafts): the first save is unconditional, the second needs the revisions the first returned
  db.s.row.content = null;
  const create = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['first save'] }, schemaVersion: 3 });
  assert.strictEqual(create.status, 200);
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['second, no base'] }, schemaVersion: 3 })).status, 428);
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['second, with base'] }, schemaVersion: 3, baseRevisions: { description: create.body.revisions.description } })).status, 200);
  assert.deepStrictEqual(stored(db).description, ['second, with base']);
}));

test('two tabs both creating the same section: the second save carries "none" as its base and is refused (409) once the first has stored content', () => withServer(async ({ call, db }) => {
  db.s.row.content = null;
  const a = await call(fay, 'GET', '/syllabi/1/content'), b = await call(fay, 'GET', '/syllabi/1/content');
  assert.strictEqual(a.body.revisions.description, 'none');
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['tab A'] }, schemaVersion: 3, baseRevisions: { description: a.body.revisions.description } })).status, 200);
  const late = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['tab B'] }, schemaVersion: 3, baseRevisions: { description: b.body.revisions.description } });
  assert.strictEqual(late.status, 409);
  assert.deepStrictEqual(stored(db).description, ['tab A']);
}));

test('sections the server itself derives (the catalog supplies CLOs when no outcomes are authored) are reported, so the saving client can adopt them without hiding anyone else\'s change', () => withServer(async ({ call }) => {
  const a = await call(fay, 'GET', '/syllabi/1/content');
  const saved = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['changed'] }, schemaVersion: 3, baseRevisions: { description: a.body.revisions.description } });
  assert.strictEqual(saved.status, 200);
  assert.ok(Array.isArray(saved.body.derivedSections));
  assert.ok(saved.body.derivedSections.includes('clos'), 'clos was set by the server, not by the client');
  assert.ok(!saved.body.derivedSections.includes('description') && !saved.body.derivedSections.includes('reqs'));
}));

test('authorization is unchanged: a conflicting save from another user is still 404/403, never a revision answer', () => withServer(async ({ call, db }) => {
  const a = await call(fay, 'GET', '/syllabi/1/content');
  const other = await call(gus, 'PUT', '/syllabi/1/content', { sections: { description: ['intruder'] }, schemaVersion: 3, baseRevisions: { description: 'deadbeef' } });
  assert.ok([403, 404].includes(other.status), 'HTTP ' + other.status);
  assert.notStrictEqual(other.body.code, 'revision_conflict');
  assert.strictEqual((await call(null, 'PUT', '/syllabi/1/content', { sections: { description: ['anon'] }, schemaVersion: 3 })).status, 401);
  const noBaseOther = await call(gus, 'PUT', '/syllabi/1/content', { sections: { description: ['intruder'] }, schemaVersion: 3 });
  assert.ok([403, 404].includes(noBaseOther.status), 'another user without a base is still refused for authorization, not told about revisions: ' + noBaseOther.status);
  assert.notStrictEqual(noBaseOther.body.code, 'revision_required');
  assert.deepStrictEqual(stored(db).description, ['Original description.']);
  assert.ok(a.body.revisions);
}));

test('a locked syllabus is still reported as locked (409 without a revision code)', () => withServer(async ({ call, db }) => {
  db.s.row.status = 'submitted';
  const r = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['x'] }, schemaVersion: 3, baseRevisions: { description: 'zzz' } });
  assert.strictEqual(r.status, 409);
  assert.notStrictEqual(r.body.code, 'revision_conflict');
  const noBase = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['x'] }, schemaVersion: 3 });
  assert.strictEqual(noBase.status, 409);
  assert.notStrictEqual(noBase.body.code, 'revision_required', 'a locked syllabus is reported as locked, not as a missing revision');
}));

// Recent Activity for transparency (lib/accountActivity.js): a new draft, and one "edited" line per editing session (autosave saves every few seconds),
// with the status it was edited in. A refused save records nothing.
test('a new draft and each editing session are recorded in the account activity; autosave within a session adds nothing, a refused save nothing', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/drafts')).status, 200);
  const open = await call(fay, 'GET', '/syllabi/1/content');
  let base = open.body.revisions;
  const save = async (text) => { const r = await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: [text] }, schemaVersion: 3, baseRevisions: { description: base.description } }); if (r.status === 200) base = r.body.revisions; return r.status; };
  assert.strictEqual(await save('First edit.'), 200);
  db.s.clock = 10; assert.strictEqual(await save('Second edit, same session.'), 200);
  assert.strictEqual((await call(fay, 'PUT', '/syllabi/1/content', { sections: { description: ['stale'] }, schemaVersion: 3, baseRevisions: { description: open.body.revisions.description } })).status, 409, 'an outdated copy is refused');
  db.s.clock = 45; assert.strictEqual(await save('Back later: a new session.'), 200);
  assert.strictEqual((await call(gus, 'PUT', '/syllabi/1/content', { sections: { description: ['x'] }, schemaVersion: 3, baseRevisions: { description: base.description } })).status, 404, 'not the owner: never revealed, nothing recorded');
  assert.deepStrictEqual(db.s.activity.map((a) => [a.user_id, a.action, a.syllabus_id, a.notes, a.at]), [
    [5, 'draft_create', 77, null, 0], [5, 'content_edit', 1, 'draft', 0], [5, 'content_edit', 1, 'draft', 45]]);
}));
