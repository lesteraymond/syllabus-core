// Shared Program Outcomes: the migration guard, inherited standards, and the backend refusal to edit inherited outcomes.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { migrate, diffOutcomes } = require('../../db/migrate-program-outcome-sources');
const { loadResolvedProgram, inheritStandards, requireOwnOutcomes, findProgram } = require('../programs');
const { loadCourse } = require('../courses');

const PO = (n, text = 'Authoritative outcome ' + n) => ({ no: n, short_name: 'PO' + n, outcome_text: text, ega_nos: '1' });
const EGA = n => ({ no: n, name: 'EGA ' + n, short_name: 'E' + n });
// One in-memory database for everything below. `cyberPos` makes Cyber's own copy differ from BSIT's.
function makeDb({ linked = false, tableExists = true, cyberPos } = {}) {
  const s = {
    programs: [{ program_id: 1, code: 'BSIT', name: 'BSIT', egas_version: 3, pos_version: 7 }, { program_id: 2, code: 'BSIT-CYBERSECURITY', name: 'BSIT Cyber', egas_version: 1, pos_version: 1 }, { program_id: 3, code: 'BSIE', name: 'BSIE', egas_version: 1, pos_version: 1 }],
    pos: { 1: [PO(1), PO(2)], 2: cyberPos || [PO(1), PO(2)], 3: [PO(1, 'Industrial outcome')] },
    egas: { 1: [EGA(1)], 2: [EGA(1)], 3: [EGA(1)] },
    links: linked ? [{ program_id: 2, source_program_id: 1 }] : [], ddl: 0, inserts: [],
    courses: { 20: { course_id: 20, code: 'CS-301', title: 'Digital Forensics', clos_version: 1, program_id: 2, program_code: 'BSIT-CYBERSECURITY', program_name: 'BSIT Cyber', standards_json: JSON.stringify({ vision: 'V', mission: { lead: 'L', items: [] }, egas: [{ no: 1, name: 'EGA 1', short: 'E1' }], pos: [{ no: 1, short: 'OLD', text: 'Outdated stored copy', egas: [1] }], versions: { vision: 1, egas: 1, pos: 1 } }) } },
  };
  const query = async (sql, p = []) => {
    if (/FROM program_po_reference_active/.test(sql)) throw Object.assign(new Error('not migrated'),{code:'ER_NO_SUCH_TABLE'});
    if (/^CREATE TABLE IF NOT EXISTS program_outcome_sources/.test(sql)) { s.ddl++; return [{}]; }
    if (/FROM program_outcome_sources/.test(sql)) {
      if (!tableExists && s.ddl === 0) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
      if (/WHERE s\.program_id/.test(sql) && /JOIN programs p ON p\.program_id = s\.source_program_id/.test(sql)) return [s.links.filter(l => l.program_id === p[0]).map(l => s.programs.find(x => x.program_id === l.source_program_id))];
      if (/WHERE s\.source_program_id/.test(sql)) return [s.links.filter(l => l.source_program_id === p[0]).map(l => { const x = s.programs.find(r => r.program_id === l.program_id); return { id: x.program_id, code: x.code, name: x.name }; })];
      return [s.links.filter(l => l.program_id === p[0]).map(l => ({ source_program_id: l.source_program_id }))];
    }
    if (/^SELECT user_id FROM users WHERE user_id/.test(sql)) return [[{ user_id: p[0] }]];
    if (/^INSERT INTO program_outcome_sources/.test(sql)) { s.inserts.push(p); s.links = [{ program_id: p[0], source_program_id: p[1] }]; return [{}]; }
    if (/^SELECT program_id FROM programs WHERE code/.test(sql)) return [s.programs.filter(x => x.code === p[0])];
    if (/^SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE program_id/.test(sql)) return [s.programs.filter(x => x.program_id === Number(p[0]))];
    if (/^SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE code/.test(sql)) return [s.programs.filter(x => x.code === p[0])];
    if (/FROM program_outcomes/.test(sql)) return [s.pos[p[0]].map(x => (/AS no/.test(sql) ? { no: x.no, short_name: x.short_name, outcome_text: x.outcome_text, ega_nos: x.ega_nos } : { po_no: x.no, short_name: x.short_name, outcome_text: x.outcome_text, ega_nos: x.ega_nos }))];
    if (/FROM program_egas/.test(sql)) return [s.egas[p[0]].map(x => (/AS no/.test(sql) ? x : { ega_no: x.no, name: x.name, short_name: x.short_name }))];
    if (/FROM courses c JOIN programs p/.test(sql)) return [[s.courses[p[0]]].filter(Boolean)];
    if (/FROM course_clos/.test(sql)) return [[]];
    if (/FROM course_prerequisites/.test(sql)) return [[]]; // a subject's prerequisites: none set
    throw new Error('unexpected query: ' + sql);
  };
  return { s, query };
}

test('migration guard: identical outcomes are linked, once, and a rerun changes nothing (idempotent)', async () => {
  const db = makeDb();
  const first = await migrate(db);
  assert.equal(first[0].linked, true); assert.deepEqual(first[0].differences, []); assert.equal(db.s.inserts.length, 1);
  const again = await migrate(db);
  assert.equal(again[0].alreadyLinked, true); assert.equal(db.s.inserts.length, 1);
});
test('migration guard: differing Program Outcomes refuse the link and list the differences', async () => {
  const db = makeDb({ cyberPos: [PO(1), PO(2, 'Edited copy')] });
  const [row] = await migrate(db);
  assert.equal(row.linked, false); assert.equal(row.refused, true); assert.deepEqual(row.differences, ['PO 2: outcome_text differs']);
  assert.equal(db.s.inserts.length, 0);
});
test('migration guard: missing and extra outcomes are reported too', () => {
  const diff = diffOutcomes({ pos: [PO(1), PO(2)], egas: [EGA(1)] }, { pos: [PO(1), PO(9)], egas: [] });
  assert.deepEqual(diff, ['PO 2: missing in the copy', 'PO 9: only in the copy', 'EGA 1: missing in the copy']);
});
test('--dry-run and --verify write nothing, not even the table', async () => {
  const db = makeDb({ tableExists: false });
  const [row] = await migrate(db, { dryRun: true });
  assert.equal(row.wouldLink, true); assert.equal(db.s.ddl, 0); assert.equal(db.s.inserts.length, 0);
});
test('--force needs --confirm naming the specialization; with it the differences are still reported', async () => {
  await assert.rejects(migrate(makeDb({ cyberPos: [PO(1)] }), { force: true }), /--confirm/);
  await assert.rejects(migrate(makeDb({ cyberPos: [PO(1)] }), { force: true, confirm: 'BSIE' }), /--confirm/);
  const db = makeDb({ cyberPos: [PO(1)] });
  const [row] = await migrate(db, { force: true, confirm: 'BSIT-CYBERSECURITY' });
  assert.equal(row.linked, true); assert.equal(row.forced, true); assert.deepEqual(row.differences, ['PO 2: missing in the copy']);
  assert.equal(db.s.inserts.length, 1);
});

test('a linked specialization resolves to the authoritative POs, EGAs and versions; others are unchanged; no table means no change', async () => {
  const linked = makeDb({ linked: true, cyberPos: [PO(1, 'Stale copy')] });
  const cyber = await loadResolvedProgram(linked, linked.s.programs[1]);
  assert.equal(cyber.pos[0].text, 'Authoritative outcome 1'); assert.equal(cyber.code, 'BSIT-CYBERSECURITY'); assert.equal(cyber.inheritedFrom.code, 'BSIT'); assert.equal(cyber.versions.pos, 7);
  assert.equal((await loadResolvedProgram(linked, linked.s.programs[2])).pos[0].text, 'Industrial outcome');
  const bsit = await loadResolvedProgram(linked, linked.s.programs[0]); assert.equal(bsit.inheritedFrom, undefined);
  const none = makeDb({ tableExists: false, cyberPos: [PO(1, 'Own copy')] });
  assert.equal((await loadResolvedProgram(none, none.s.programs[1])).pos[0].text, 'Own copy');
});
test('a subject of a linked specialization never reads its outdated stored PO copy', async () => {
  const linked = makeDb({ linked: true });
  const course = await loadCourse(linked, 20);
  assert.equal(course.standards.pos[0].text, 'Authoritative outcome 1'); assert.equal(course.standards.inheritedFrom.code, 'BSIT'); assert.equal(course.standards.vision, 'V');
  const unlinked = makeDb({ linked: false });
  assert.equal((await loadCourse(unlinked, 20)).standards.pos[0].text, 'Outdated stored copy');
});
test('inheritStandards leaves a program without a link alone', async () => {
  const db = makeDb(); const standards = { egas: [], pos: [], versions: { egas: 1, pos: 1 } };
  assert.equal(await inheritStandards(db, 3, standards), standards);
});

// ---- Backend enforcement (not only the UI) ----
async function withApp(db, fn) {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.session = { user: req.headers['x-user'] ? JSON.parse(req.headers['x-user']) : undefined }; next(); });
  app.locals.db = { ...db, getConnection: async () => { throw new Error('a refused edit must not open a transaction'); } };
  app.use('/programs', require('../../routes/programs'));
  const server = await new Promise(resolve => { const h = app.listen(0, () => resolve(h)); });
  const call = (method, path, body, user) => fetch(`http://127.0.0.1:${server.address().port}/programs${path}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { 'x-user': JSON.stringify(user) } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, body: await r.json() }));
  try { await fn(call); } finally { await new Promise(resolve => server.close(resolve)); }
}
const admin = { id: 1, role: 'admin' };
test('the API refuses to edit the POs or EGAs of a linked specialization, naming where to edit them', async () => {
  const db = makeDb({ linked: true });
  await withApp(db, async call => {
    const po = await call('PUT', '/BSIT-CYBERSECURITY/outcomes', { pos: [{ no: 1, short: 'X', text: 'Y', egas: [1] }], version: 1 }, admin);
    assert.equal(po.status, 409); assert.equal(po.body.code, 'outcomes_inherited'); assert.equal(po.body.source, 'BSIT'); assert.match(po.body.error, /inherits its Program Outcomes and EGAs from BSIT\. Edit them in BSIT\./);
    const ega = await call('PUT', '/2/egas', { egas: [{ no: 1, name: 'N', short: 'S' }], version: 1 }, admin);
    assert.equal(ega.status, 409); assert.equal(ega.body.code, 'outcomes_inherited');
  });
  assert.equal(db.s.pos[2].length, 2);
});
test('permissions are unchanged: faculty and anonymous callers are refused before anything else', async () => {
  await withApp(makeDb({ linked: true }), async call => {
    for (const user of [{ id: 2, role: 'faculty' }, null]) assert.ok([401, 403].includes((await call('PUT', '/BSIT-CYBERSECURITY/outcomes', { pos: [], version: 1 }, user)).status));
  });
});
test('requireOwnOutcomes lets an unlinked program through and works without the table', async () => {
  const db = makeDb({ linked: true });
  await requireOwnOutcomes(db, await findProgram(db, 'BSIE'));
  await requireOwnOutcomes(makeDb({ tableExists: false }), { program_id: 2, code: 'BSIT-CYBERSECURITY' });
  await assert.rejects(requireOwnOutcomes(db, await findProgram(db, 'BSIT-CYBERSECURITY')), /Edit them in BSIT/);
});

test('existing syllabus compatibility: a saved syllabus holding outdated POs is flagged by the checker, never silently accepted or rewritten', () => {
  const { sample } = require('./fixtures');
  const { coded } = require('./engine');
  const { content, masters } = sample();
  const before = JSON.stringify(content);
  assert.ok(!coded(content, masters).findings.some(f => f.ruleId === 'PO-EXACT'));
  masters.pos = masters.pos.map((po, i) => (i === 0 ? { ...po, text: 'Revised authoritative outcome' } : po));
  const found = coded(content, masters).findings.find(f => f.ruleId === 'PO-EXACT');
  assert.ok(found); assert.ok(found.replacement, 'the exact master text is offered as a suggestion for the author to accept');
  assert.equal(JSON.stringify(content), before, 'the saved content is not modified');
});
