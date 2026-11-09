const test = require('node:test');
const assert = require('node:assert/strict');
const { mastersFor } = require('./repository');
const { outcomeSource } = require('../programs');
const { coded } = require('./engine');
const { sample } = require('./fixtures');
// A fake database that answers only the queries mastersFor makes. `withLink` adds the specialization -> source links (2 -> 1, and 4 -> 3: a second,
// made-up specialization, so nothing below can pass because of a rule written for one program's code).
function fakeDb({ withLink = true, tableExists = true } = {}) {
  const programs = [{ program_id: 1, code: 'BSIT', name: 'BSIT', egas_version: 1, pos_version: 1 }, { program_id: 2, code: 'BSIT-CYBERSECURITY', name: 'BSIT Cyber', egas_version: 1, pos_version: 1 },
    { program_id: 3, code: 'BSXX', name: 'BS Made-up Parent', egas_version: 1, pos_version: 1 }, { program_id: 4, code: 'BSXX-DATA', name: 'BS Made-up Specialization', egas_version: 1, pos_version: 1 }];
  const pos = { 1: [{ po_no: 1, short_name: 'BSIT PO', outcome_text: 'Authoritative BSIT outcome', ega_nos: '1' }], 2: [{ po_no: 1, short_name: 'COPY', outcome_text: 'Stale copy', ega_nos: '1' }],
    3: [{ po_no: 1, short_name: 'XX PO', outcome_text: 'Authoritative parent outcome', ega_nos: '1' }], 4: [] };
  const curricula = [{ reference_id: 'bsit', program_code: 'BSIT', curriculum_year: '2022-2023', source: 's', courses_json: '[{"code":"IT 101"}]' }, { reference_id: 'cyb', program_code: 'BSIT-CYBERSECURITY', curriculum_year: '2025-2026', source: 's', courses_json: '[{"code":"IT 101"},{"code":"CS 301"}]' },
    { reference_id: 'xx', program_code: 'BSXX', curriculum_year: '2024-2025', source: 's', courses_json: '[{"code":"XX 101"}]' }, { reference_id: 'xxd', program_code: 'BSXX-DATA', curriculum_year: '2024-2025', source: 's', courses_json: '[{"code":"XX 101"},{"code":"XD 201"}]' }];
  const links = { 2: 0, 4: 2 };
  return { query: async (sql, params = []) => {
    if (/FROM institution_settings/.test(sql)) return [[{ vision: 'V', mission_lead: 'L', mission_items: '[]', version: 1 }]];
    if (/FROM institution_egas/.test(sql)) return [[]];
    if (/FROM program_egas/.test(sql)) return [[]];
    if (/FROM program_outcome_sources/.test(sql)) {
      if (!tableExists) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
      return [withLink && links[params[0]] !== undefined ? [programs[links[params[0]]]] : []];
    }
    if (/FROM programs WHERE code/.test(sql)) return [programs.filter(p => p.code === params[0])];
    if (/FROM program_outcomes/.test(sql)) return [pos[params[0]]];
    if (/FROM syllabus_check_curricula/.test(sql)) return [curricula];
    return [[]];
  } };
}
const content = (program, curriculumYear) => ({ meta: { program, ...(curriculumYear ? { curriculumYear } : {}) } });

test('BSIT-CYBERSECURITY is checked against the authoritative BSIT Program Outcomes, not its own copy', async () => {
  const m = await mastersFor(fakeDb(), content('BSIT-CYBERSECURITY'));
  assert.equal(m.pos[0].text, 'Authoritative BSIT outcome');
});
// Owner policy 2026-11-09: a specialization has its OWN approved curriculum reference and shares its source program's POs. The two are resolved independently.
test('Cyber Security resolves its own approved curriculum (not BSIT\'s) while its POs come from BSIT', async () => {
  const m = await mastersFor(fakeDb(), content('BSIT-CYBERSECURITY'));
  assert.deepEqual(m.curricula.map(c => c.id), ['cyb'], 'its own reference, and only it: BSIT\'s curriculum is not used because the POs are shared');
  assert.deepEqual(m.programCodes, ['BSIT-CYBERSECURITY']);
  assert.equal(m.pos[0].text, 'Authoritative BSIT outcome', 'no duplicate POs are needed: the inherited BSIT outcomes are used');
  assert.equal(m.outcomeSource, 'BSIT');
  assert.equal(m.referenceContext.program.code, 'BSIT-CYBERSECURITY');
  assert.equal(m.referenceContext.po.source, 'BSIT');
  assert.equal(m.referenceContext.curriculum.source, 'BSIT-CYBERSECURITY');
  assert.deepEqual(m.referenceContext.curriculum.referenceIds, ['cyb']);
  assert.ok(m.otherCurricula.some(c => c.program === 'BSIT'), 'BSIT\'s curriculum stays available only as the "exists in another program" hint');
});
test('the curriculum year still selects within the program\'s own references, never falling back to the source program\'s', async () => {
  assert.deepEqual((await mastersFor(fakeDb(), content('BSIT-CYBERSECURITY', '2025-2026'))).curricula.map(c => c.id), ['cyb']);
  assert.deepEqual((await mastersFor(fakeDb(), content('BSIT-CYBERSECURITY', '2022-2023'))).curricula.map(c => c.id), [], 'BSIT\'s 2022-2023 is not borrowed');
});
test('the same holds for any specialization: nothing depends on one program\'s code', async () => {
  const m = await mastersFor(fakeDb(), content('BSXX-DATA'));
  assert.deepEqual(m.curricula.map(c => c.id), ['xxd']);
  assert.equal(m.pos[0].text, 'Authoritative parent outcome');
  assert.equal(m.referenceContext.curriculum.source, 'BSXX-DATA'); assert.equal(m.referenceContext.po.source, 'BSXX');
  const parent = await mastersFor(fakeDb(), content('BSXX'));
  assert.deepEqual(parent.curricula.map(c => c.id), ['xx'], 'the source program keeps its own curriculum');
});
test('a specialization subject found only in the specialization\'s curriculum is recognized', async () => {
  for (const [program, code] of [['BSIT-CYBERSECURITY', 'CS 301'], ['BSXX-DATA', 'XD 201']]) {
    const masters = await mastersFor(fakeDb(), content(program));
    const c = JSON.parse(JSON.stringify(sample().content)); Object.assign(c.meta, { program, code, curriculumYear: '' });
    const report = coded(c, masters), check = report.checks.filter(x => x.ruleId === 'CUR-CODE');
    assert.deepEqual(check.map(x => x.status), ['PASS'], `${program} ${code} is evaluated against its own curriculum and found: ${JSON.stringify(check)}`);
    assert.equal(report.findings.filter(f => f.ruleId === 'CUR-CODE').length, 0);
  }
});
test('BSIT is unchanged; an unconfigured specialization never treats its old PO copy as authoritative', async () => {
  const bsit = await mastersFor(fakeDb(), content('BSIT'));
  assert.equal(bsit.pos[0].text, 'Authoritative BSIT outcome'); assert.deepEqual(bsit.curricula.map(c => c.id), ['bsit']);
  const unlinked = await mastersFor(fakeDb({ withLink: false }), content('BSIT-CYBERSECURITY'));
  assert.deepEqual(unlinked.pos, []); assert.deepEqual(unlinked.curricula.map(c => c.id), ['cyb'], 'the curriculum does not depend on the PO link');
  assert.deepEqual((await mastersFor(fakeDb({ tableExists: false }), content('BSIT-CYBERSECURITY'))).pos, []);
});
test('outcomeSource returns the program itself when nothing links it', async () => {
  const program = { program_id: 9 };
  assert.equal(await outcomeSource({ query: async () => [[]] }, program), program);
});
