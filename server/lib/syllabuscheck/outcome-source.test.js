const test = require('node:test');
const assert = require('node:assert/strict');
const { mastersFor } = require('./repository');
const { outcomeSource } = require('../programs');
// A fake database that answers only the queries mastersFor makes. `withLink` adds the specialization -> source link.
function fakeDb({ withLink = true, tableExists = true } = {}) {
  const programs = [{ program_id: 1, code: 'BSIT', name: 'BSIT', egas_version: 1, pos_version: 1 }, { program_id: 2, code: 'BSIT-CYBERSECURITY', name: 'BSIT Cyber', egas_version: 1, pos_version: 1 }];
  const pos = { 1: [{ po_no: 1, short_name: 'BSIT PO', outcome_text: 'Authoritative BSIT outcome', ega_nos: '1' }], 2: [{ po_no: 1, short_name: 'COPY', outcome_text: 'Stale copy', ega_nos: '1' }] };
  const curricula = [{ reference_id: 'bsit', program_code: 'BSIT', curriculum_year: '2022-2023', source: 's', courses_json: '[{"code":"IT 101"}]' }, { reference_id: 'cyb', program_code: 'BSIT-CYBERSECURITY', curriculum_year: '2025-2026', source: 's', courses_json: '[{"code":"CS 301"}]' }];
  return { query: async (sql, params = []) => {
    if (/FROM institution_settings/.test(sql)) return [[{ vision: 'V', mission_lead: 'L', mission_items: '[]', version: 1 }]];
    if (/FROM institution_egas/.test(sql)) return [[]];
    if (/FROM program_egas/.test(sql)) return [[]];
    if (/FROM program_outcome_sources/.test(sql)) {
      if (!tableExists) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
      return [withLink && params[0] === 2 ? [programs[0]] : []];
    }
    if (/FROM programs WHERE code/.test(sql)) return [programs.filter(p => p.code === params[0])];
    if (/FROM program_outcomes/.test(sql)) return [pos[params[0]]];
    if (/FROM syllabus_check_curricula/.test(sql)) return [curricula];
    return [[]];
  } };
}
const content = program => ({ meta: { program } });

test('BSIT-CYBERSECURITY is checked against the authoritative BSIT Program Outcomes, not its own copy', async () => {
  const m = await mastersFor(fakeDb(), content('BSIT-CYBERSECURITY'));
  assert.equal(m.pos[0].text, 'Authoritative BSIT outcome');
});
test('its own curriculum is kept: course identity still resolves against the cyber reference, not BSIT', async () => {
  const m = await mastersFor(fakeDb(), content('BSIT-CYBERSECURITY'));
  assert.deepEqual(m.curricula.map(c => c.id), ['cyb']);
  assert.deepEqual(m.programCodes, ['BSIT-CYBERSECURITY']);
});
test('BSIT is unchanged, and without the link or the table a program uses its own outcomes (backward compatible)', async () => {
  assert.equal((await mastersFor(fakeDb(), content('BSIT'))).pos[0].text, 'Authoritative BSIT outcome');
  assert.equal((await mastersFor(fakeDb({ withLink: false }), content('BSIT-CYBERSECURITY'))).pos[0].text, 'Stale copy');
  assert.equal((await mastersFor(fakeDb({ tableExists: false }), content('BSIT-CYBERSECURITY'))).pos[0].text, 'Stale copy');
});
test('outcomeSource returns the program itself when nothing links it', async () => {
  const program = { program_id: 9 };
  assert.equal(await outcomeSource({ query: async () => [[]] }, program), program);
});
