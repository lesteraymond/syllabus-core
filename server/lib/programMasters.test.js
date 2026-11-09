'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { blankStandards, standardsFromMasters, applyMasters } = require('./subjectStandards');
const { parseEgas, parsePos } = require('./programOutcomesInput');
const { syncSubjects } = require('./programMasters');

const MASTERS = {
  institution: { vision: 'V', mission: { lead: 'L', items: ['M1'] } },
  egas: [{ no: 1, name: 'One', short: '1' }, { no: 2, name: 'Two', short: '2' }],
  pos: [{ no: 1, short: 'P1', text: 'Outcome one', egas: [1, 2] }],
};

test('a subject starts as a copy of its program\'s masters, or blank when the program has no EGAs yet', () => {
  assert.deepStrictEqual(standardsFromMasters(null), blankStandards());
  assert.deepStrictEqual(standardsFromMasters({ ...MASTERS, egas: [] }), blankStandards());
  const copy = standardsFromMasters(MASTERS);
  assert.deepStrictEqual([copy.vision, copy.mission, copy.egas, copy.pos, copy.versions], ['V', { lead: 'L', items: ['M1'] }, MASTERS.egas, MASTERS.pos, { vision: 1, egas: 1, pos: 1 }]);
  copy.egas[0].name = 'changed'; copy.pos[0].egas.push(9);
  assert.strictEqual(MASTERS.egas[0].name, 'One', 'the copy shares nothing with the masters');
  assert.deepStrictEqual(MASTERS.pos[0].egas, [1, 2]);
});

test('applyMasters changes only what differs, bumps those versions, and refuses to drop an EGA or PO a CLO still uses', () => {
  const current = standardsFromMasters(MASTERS);
  const same = applyMasters(current, MASTERS, []);
  assert.deepStrictEqual([same.changed, same.conflict], [[], null]);
  const edited = { ...MASTERS, institution: { vision: 'V2', mission: MASTERS.institution.mission }, pos: [{ no: 1, short: 'P1', text: 'Outcome one, reworded', egas: [1] }, { no: 2, short: 'P2', text: 'Two', egas: [2] }] };
  const result = applyMasters(current, edited, [{ egas: [1], pos: [1] }]);
  assert.deepStrictEqual(result.changed, ['vision', 'pos']);
  assert.deepStrictEqual(result.next.versions, { vision: 2, egas: 1, pos: 2 });
  assert.strictEqual(result.next.pos.length, 2); assert.strictEqual(current.pos.length, 1, 'the input is not modified');
  const lostPo = applyMasters(current, { ...MASTERS, pos: [] }, [{ egas: [1], pos: [1] }]);
  assert.match(lostPo.conflict, /PO 1 is still used/); assert.strictEqual(lostPo.next, current);
  const lostEga = applyMasters(current, { ...MASTERS, egas: [MASTERS.egas[1]], pos: [] }, [{ egas: [1], pos: [] }]);
  assert.match(lostEga.conflict, /EGA 1 is still used/);
});

test('EGA and PO input is validated with one set of rules', () => {
  assert.deepStrictEqual(parseEgas([{ no: '2', name: ' Two ', short: ' 2 ' }]), [{ no: 2, name: 'Two', short: '2' }]);
  for (const bad of [undefined, [], [{ no: 0, name: 'a', short: 'b' }], [{ no: 100, name: 'a', short: 'b' }], [{ no: 1, name: 'a', short: 'b' }, { no: 1, name: 'c', short: 'd' }], [{ no: 1, name: 'a', short: ' ' }], [{ no: 1, name: 'x'.repeat(256), short: 'b' }]]) assert.throws(() => parseEgas(bad), (e) => e.status === 400, JSON.stringify(bad));
  assert.deepStrictEqual(parsePos([{ no: 1, short: 'P', text: ' T ', egas: [2, 1, 2] }], new Set([1, 2])), [{ no: 1, short: 'P', text: 'T', egas: [1, 2] }]);
  assert.deepStrictEqual(parsePos([], new Set()), []);
  for (const bad of [undefined, [{ no: 1, short: '', text: 'T' }], [{ no: 1, short: 'P', text: '' }], [{ no: 1, short: 'P', text: 'T', egas: [3] }], [{ no: 1, short: 'P', text: 'x'.repeat(2001) }]]) assert.throws(() => parsePos(bad, new Set([1, 2])), (e) => e.status === 400, JSON.stringify(bad));
});

test('syncSubjects updates what can be updated, reports the rest, and does nothing for a program without masters', async () => {
  const rows = [
    { course_id: 1, code: 'A', standards_json: JSON.stringify(blankStandards()) },
    { course_id: 2, code: 'B', standards_json: JSON.stringify(standardsFromMasters(MASTERS)) },
    { course_id: 3, code: 'C', standards_json: JSON.stringify({ ...blankStandards(), egas: [{ no: 5, name: 'Old', short: 'O' }], pos: [{ no: 5, short: 'O', text: 'Old', egas: [5] }] }) },
  ];
  const saved = {};
  const conn = {
    async query(sql, p = []) {
      if (sql.startsWith('SELECT ega_no, name, short_name FROM program_egas')) return [MASTERS.egas.map((e) => ({ ega_no: e.no, name: e.name, short_name: e.short }))];
      if (sql.startsWith('SELECT po_no')) return [MASTERS.pos.map((o) => ({ po_no: o.no, short_name: o.short, outcome_text: o.text, ega_nos: o.egas.join(',') }))];
      if (sql.startsWith('SELECT vision, mission_lead')) return [[{ vision: 'V', mission_lead: 'L', mission_items: JSON.stringify(['M1']), version: 1 }]];
      if (sql.startsWith('SELECT ega_no, name, short_name FROM institution_egas')) return [[]];
      if (sql.startsWith('SELECT course_id, code, standards_json FROM courses')) return [rows];
      if (sql.startsWith('SELECT clo_id')) return [p[0] === 3 ? [{ clo_id: 1, title: 't', clo_level: 'Enabling', statement: 's', ega_nos: '5', po_nos: '5' }] : []];
      if (sql.startsWith('UPDATE courses SET standards_json')) { saved[p[1]] = JSON.parse(p[0]); return [{}]; }
      throw new Error('unexpected query: ' + sql);
    },
  };
  const out = await syncSubjects(conn, 9);
  assert.deepStrictEqual([out.subjects, out.updated, out.unchanged], [3, 1, 1]);
  assert.deepStrictEqual(out.skipped, [{ id: 3, code: 'C', reason: 'EGA 5 is still used by a CLO of this subject' }]);
  assert.deepStrictEqual(Object.keys(saved), ['1']); assert.strictEqual(saved[1].egas.length, 2);
  const none = await syncSubjects({ query: async () => [[]] }, 9);
  assert.deepStrictEqual(none, { masters: false, subjects: 0, updated: 0, unchanged: 0, skipped: [] });
});
