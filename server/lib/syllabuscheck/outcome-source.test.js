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
  const subjects = [[10, 'IT 101', 1], [20, 'IT 101', 2], [21, 'CS 301', 2], [30, 'XX 101', 3], [40, 'XX 101', 4], [41, 'XD 201', 4]].map(([course_id, code, program_id]) => ({ course_id, code, title: 'T', program_id, program_code: programs[program_id - 1].code }));
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
    if (/syllabus_check_curricula/.test(sql)) throw new Error('the printed curricula must not be read');
    if (/WHERE c\.course_id = \?/.test(sql)) return [subjects.filter(s => s.course_id === params[0])];
    if (/WHERE c\.program_id = \?/.test(sql)) return [subjects.filter(s => s.program_id === params[0])];
    return [[]];
  } };
}
const SUBJECT = { BSIT: 10, 'BSIT-CYBERSECURITY': 20, BSXX: 30, 'BSXX-DATA': 40 };
const content = (program, curriculumYear) => ({ meta: { program, courseId: SUBJECT[program], ...(curriculumYear ? { curriculumYear } : {}) } });

test('BSIT-CYBERSECURITY is checked against the authoritative BSIT Program Outcomes, not its own copy', async () => {
  const m = await mastersFor(fakeDb(), content('BSIT-CYBERSECURITY'));
  assert.equal(m.pos[0].text, 'Authoritative BSIT outcome');
});
// Owner policy 2026-11-09: a specialization has its OWN subjects and shares its source program's POs. The two are resolved independently.
test('Cyber Security is checked against its own subject (not BSIT\'s) while its POs come from BSIT', async () => {
  const m = await mastersFor(fakeDb(), content('BSIT-CYBERSECURITY'));
  assert.deepEqual(m.curricula.map(c => [c.id, c.program]), [['subject:20', 'BSIT-CYBERSECURITY']], 'its own subject, and only it: BSIT\'s is not used because the POs are shared');
  assert.deepEqual(m.programCodes, ['BSIT-CYBERSECURITY']);
  assert.equal(m.pos[0].text, 'Authoritative BSIT outcome', 'no duplicate POs are needed: the inherited BSIT outcomes are used');
  assert.equal(m.outcomeSource, 'BSIT');
  assert.equal(m.referenceContext.program.code, 'BSIT-CYBERSECURITY');
  assert.equal(m.referenceContext.po.source, 'BSIT');
  assert.equal(m.referenceContext.curriculum.source, 'BSIT-CYBERSECURITY');
  assert.deepEqual(m.referenceContext.curriculum.referenceIds, ['subject:20']);
  assert.deepEqual(m.programSubjects.map(s => s.code), ['IT 101', 'CS 301'], 'the generator knows the specialization\'s subjects');
});
test('the year a draft names never selects another reference', async () => {
  for (const year of ['2025-2026', '2022-2023']) assert.deepEqual((await mastersFor(fakeDb(), content('BSIT-CYBERSECURITY', year))).curricula.map(c => c.id), ['subject:20']);
});
test('the same holds for any specialization: nothing depends on one program\'s code', async () => {
  const m = await mastersFor(fakeDb(), content('BSXX-DATA'));
  assert.deepEqual(m.curricula.map(c => c.id), ['subject:40']);
  assert.equal(m.pos[0].text, 'Authoritative parent outcome');
  assert.equal(m.referenceContext.curriculum.source, 'BSXX-DATA'); assert.equal(m.referenceContext.po.source, 'BSXX');
  assert.deepEqual((await mastersFor(fakeDb(), content('BSXX'))).curricula.map(c => c.id), ['subject:30'], 'the source program keeps its own subject');
});
test('a subject found only in the specialization is recognized', async () => {
  for (const [program, code, courseId] of [['BSIT-CYBERSECURITY', 'CS 301', 21], ['BSXX-DATA', 'XD 201', 41]]) {
    const masters = await mastersFor(fakeDb(), { meta: { program, courseId } });
    const c = JSON.parse(JSON.stringify(sample().content)); Object.assign(c.meta, { program, code, courseId, curriculumYear: '' });
    const report = coded(c, masters), check = report.checks.filter(x => x.ruleId === 'CUR-CODE');
    assert.deepEqual(check.map(x => x.status), ['PASS'], `${program} ${code} is evaluated against its own subject: ${JSON.stringify(check)}`);
    assert.equal(report.findings.filter(x => x.ruleId === 'CUR-CODE').length, 0);
  }
});
test('BSIT is unchanged; an unconfigured specialization never treats its old PO copy as authoritative', async () => {
  const bsit = await mastersFor(fakeDb(), content('BSIT'));
  assert.equal(bsit.pos[0].text, 'Authoritative BSIT outcome'); assert.deepEqual(bsit.curricula.map(c => c.id), ['subject:10']);
  const unlinked = await mastersFor(fakeDb({ withLink: false }), content('BSIT-CYBERSECURITY'));
  assert.deepEqual(unlinked.pos, []); assert.deepEqual(unlinked.curricula.map(c => c.id), ['subject:20'], 'the reference does not depend on the PO link');
  assert.deepEqual((await mastersFor(fakeDb({ tableExists: false }), content('BSIT-CYBERSECURITY'))).pos, []);
});
test('outcomeSource returns the program itself when nothing links it', async () => {
  const program = { program_id: 9 };
  assert.equal(await outcomeSource({ query: async () => [[]] }, program), program);
});
