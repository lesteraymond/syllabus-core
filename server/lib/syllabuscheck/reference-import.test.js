'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { programs, BLANK } = require('../../db/local-curriculum-data.cjs');
const { sources } = require('../../db/local-outcome-data.cjs');
const { validateData } = require('../../db/seed-local-references');
const { migrate } = require('../../db/migrate-course-program-codes');

test('all 243 source subjects match every printed term and program unit total', () => {
  assert.doesNotThrow(() => validateData());
  assert.deepEqual(programs.map(p => p.terms.flatMap(t => t.rows).length), [53, 63, 66, 61]);
  const bad = structuredClone(programs); bad[0].terms[0].rows[0].lecture++;
  assert.throws(() => validateData(bad), /term credit total/);
});
test('source blank prerequisites, practical hours and source code punctuation are preserved', () => {
  const ie = programs.find(p => p.code === 'BSIE').terms.flatMap(t => t.rows);
  assert.equal(ie.find(c => c.code === 'MA 7').prereq, BLANK);
  assert.equal(ie.find(c => c.code === 'MA 7').rawPrerequisite, '');
  const practicum = ie.find(c => c.code === 'IE-PRAC');
  assert.equal(practicum.lectureHours, 240);
  assert.equal(practicum.lecture, 3);
  assert.ok(programs.find(p => p.code === 'BSIT-CYBERSECURITY').terms.flatMap(t => t.rows).some(c => c.code === 'IT 103-'));
});
test('source outcome omissions are explicit and no Cybersecurity outcomes or crosswalks are fabricated', () => {
  for (const code of ['BSIE', 'BSCPE']) {
    assert.equal(sources[code].pos.length, 13);
    assert.equal(sources[code].egas.length, 4);
    assert.equal(sources[code].pos[11].sourceIncomplete, true);
    assert.match(sources[code].pos[11].text, /and in$/);
    assert.ok(sources[code].pos.every(p => p.egas.length === 0));
  }
  assert.equal(sources['BSIT-CYBERSECURITY'], undefined);
  assert.equal(sources.BSIT.pos.length, 9);
});
test('course uniqueness migration creates program constraint before dropping global constraint and is idempotent', async () => {
  let indexes = [{ Key_name: 'code', Non_unique: 0, Seq_in_index: 1, Column_name: 'code' }];
  const mutations = [];
  const db = { query: async sql => {
    if (sql === 'SHOW INDEX FROM courses') return [indexes];
    mutations.push(sql);
    if (sql.includes('ADD UNIQUE')) indexes.push(...['program_id', 'code'].map((Column_name, i) => ({ Key_name: 'courses_program_code', Non_unique: 0, Seq_in_index: i + 1, Column_name })));
    if (sql.includes('DROP INDEX')) indexes = indexes.filter(i => i.Key_name !== 'code');
    return [{}];
  } };
  await migrate(db);
  assert.match(mutations[0], /ADD UNIQUE/);
  assert.match(mutations[1], /DROP INDEX/);
  await migrate(db);
  assert.equal(mutations.length, 2);
});
