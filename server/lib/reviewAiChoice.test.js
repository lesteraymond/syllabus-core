'use strict';
// A reviewer's choice to review a submitted syllabus without an AI check (lib/reviewAiChoice.js): the policy, the per-version, per-reviewer rule,
// failing closed, and the table definition (the migration and schema.sql must agree).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const choice = require('./reviewAiChoice');

// rows: { syllabus_id, version_id, reviewer_id }; `table: false` is a database before the migration.
function fakeDb({ rows = [], table = true, broken = false } = {}) {
  const writes = [];
  return {
    writes,
    async query(sql, p = []) {
      if (sql.startsWith('SELECT 1 FROM syllabus_review_ai_choices')) { if (!table) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); return [[]]; }
      if (sql.startsWith('SELECT syllabus_id, version_id FROM syllabus_review_ai_choices')) { if (broken) throw new Error('connection lost'); return [rows.filter((r) => p[0].includes(r.syllabus_id) && r.reviewer_id === p[1])]; }
      if (sql.startsWith('INSERT IGNORE INTO syllabus_review_ai_choices')) { const dup = rows.some((r) => r.syllabus_id === p[0] && r.version_id === p[1] && r.reviewer_id === p[2]); if (!dup) rows.push({ syllabus_id: p[0], version_id: p[1], reviewer_id: p[2] }); writes.push(p); return [{ affectedRows: dup ? 0 : 1 }]; }
      throw new Error('unexpected query: ' + sql);
    },
  };
}
const withGate = async (value, fn) => { const before = process.env.SYLLABUS_CHECK_AI_GATE; if (value === undefined) delete process.env.SYLLABUS_CHECK_AI_GATE; else process.env.SYLLABUS_CHECK_AI_GATE = value; try { await fn(); } finally { if (before === undefined) delete process.env.SYLLABUS_CHECK_AI_GATE; else process.env.SYLLABUS_CHECK_AI_GATE = before; } };

test('the choice is offered under the advisory policy (the default) and never when the institution requires the AI check', () => {
  assert.equal(choice.allowed({}), true);
  assert.equal(choice.allowed({ SYLLABUS_CHECK_AI_GATE: 'advisory' }), true);
  assert.equal(choice.allowed({ SYLLABUS_CHECK_AI_GATE: 'required' }), false);
  assert.equal(choice.allowed({ SYLLABUS_CHECK_AI_GATE: 'REQUIRED' }), false);
});

test('a reviewer may act when there is nothing to check, when it was checked with AI, or when THEY chose to review this version without AI', () => withGate(undefined, async () => {
  choice.resetInstalledCache();
  const db = fakeDb({ rows: [{ syllabus_id: 1, version_id: 10, reviewer_id: 7 }] });
  assert.equal(await choice.mayReview(db, 1, null, 7), true, 'no check state: nothing to wait for');
  assert.equal(await choice.mayReview(db, 1, { checkable: false, checked: false, versionId: 10 }, 7), true, 'nothing a check can read');
  assert.equal(await choice.mayReview(db, 1, { checkable: true, checked: true, versionId: 10 }, 8), true, 'checked with AI on the newest version');
  assert.equal(await choice.mayReview(db, 1, { checkable: true, checked: false, versionId: 10 }, 7), true, 'this reviewer chose to review it without AI');
  assert.equal(await choice.mayReview(db, 1, { checkable: true, checked: false, versionId: 10 }, 8), false, 'another reviewer\'s choice is theirs, not this one\'s');
  assert.equal(await choice.mayReview(db, 1, { checkable: true, checked: false, versionId: 11 }, 7), false, 'a new version asks again');
}));

test('a stored choice does not count once the institution requires the AI check, and choosing is refused', () => withGate('required', async () => {
  choice.resetInstalledCache();
  const db = fakeDb({ rows: [{ syllabus_id: 1, version_id: 10, reviewer_id: 7 }] });
  assert.equal(await choice.mayReview(db, 1, { checkable: true, checked: false, versionId: 10 }, 7), false);
  await assert.rejects(choice.record(db, { syllabusId: 1, versionId: 10, reviewerId: 7 }), (e) => e.status === 409 && e.body.code === 'ai_check_required');
  assert.equal(db.writes.length, 0);
}));

test('before the migration nothing is read (no reviewer has chosen) and choosing answers 503 naming the migration', () => withGate(undefined, async () => {
  choice.resetInstalledCache();
  const db = fakeDb({ table: false });
  assert.equal((await choice.choicesOf(db, [1], 7)).size, 0);
  assert.equal(await choice.mayReview(db, 1, { checkable: true, checked: false, versionId: 10 }, 7), false, 'the gate stays as it was');
  await assert.rejects(choice.record(db, { syllabusId: 1, versionId: 10, reviewerId: 7 }), (e) => e.status === 503 && /migrate-review-ai-choice/.test(e.message));
}));

test('recording is idempotent per (syllabus, version, reviewer), and a failed read fails closed', () => withGate(undefined, async () => {
  choice.resetInstalledCache();
  const db = fakeDb();
  assert.deepEqual(await choice.record(db, { syllabusId: 1, versionId: 10, reviewerId: 7, note: '  read it in full  ' }), { created: true });
  assert.deepEqual(await choice.record(db, { syllabusId: 1, versionId: 10, reviewerId: 7 }), { created: false }, 'choosing again changes nothing');
  assert.equal(db.writes[0][3], 'without_ai'); assert.equal(db.writes[0][4], 'read it in full');
  choice.resetInstalledCache();
  assert.equal(await choice.mayReview(fakeDb({ rows: [{ syllabus_id: 1, version_id: 10, reviewer_id: 7 }], broken: true }), 1, { checkable: true, checked: false, versionId: 10 }, 7), false, 'when the choice cannot be read the reviewer is asked again (never let through)');
}));

test('the migration and schema.sql define the same table', () => {
  const norm = (s) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  const ddl = norm(require('../db/review-ai-choice-ddl')[0]);
  const schema = norm(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
  assert.ok(schema.includes(ddl), 'server/db/schema.sql carries the table exactly as db/review-ai-choice-ddl.js');
  assert.match(ddl, /UNIQUE KEY uniq_ai_choice_per_version \(syllabus_id, version_id, reviewer_id\)/);
  assert.match(ddl, /FOREIGN KEY \(syllabus_id\) REFERENCES syllabi\(syllabus_id\) ON DELETE CASCADE/, 'deleting a syllabus removes its choices');
});
