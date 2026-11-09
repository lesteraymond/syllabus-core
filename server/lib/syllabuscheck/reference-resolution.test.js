'use strict';
// Database-driven academic references: Policy V2 validates against the PUBLISHED reference version resolved for the syllabus's program and academic year, never against a fixed list of programs;
// versions are immutable and verified; a new version is a new question for the cache. Pure tests (no database); the end-to-end flow is scripts/release/dynamic-reference.integration.test.cjs.
const test = require('node:test'), assert = require('node:assert/strict');
const h = require('./vpaa-conformance/harness'), plan = require('./academicV2Plan'), refs = require('../programPoReferences'), gemini = require('./gemini');
const official = require('../../../src/data/officialProgramOutcomes.json');

const pos = [1, 2, 3].map((n) => ({ no: n, short: 'ZPO ' + n, text: `Zeta outcome number ${n} for a program that is in no list.`, egas: [1] }));
const reference = (extra = {}) => ({ id: 'po-77-v1', version: 'ZZNEW-2026-v1', sourceFile: 'admin-published:ZZNEW:2026', sourceSha256: refs.hashOutcomes(pos), contentSha256: refs.hashOutcomes(pos), outcomes: pos.map((p) => ({ ...p })), kind: 'admin_published', status: 'published', ...extra });
function setup({ program = 'ZZNEW', poReference = reference(), mastersPos = pos, cloPos = [[1], [2], [3], [3]], authored = pos, extra = {} } = {}) {
  const { content, masters } = h.sample(), c = JSON.parse(JSON.stringify(content)), m = JSON.parse(JSON.stringify(masters));
  c.meta.program = program; c.outcomes = { ...c.outcomes, pos: authored.map((p) => ({ ...p })) };
  c.clos.forEach((clo, i) => { clo.pos = cloPos[i] || []; });
  m.pos = mastersPos.map((p) => ({ ...p })); m.outcomeSource = null; m.referenceContext = { program: { id: 77, code: program }, po: { source: program, status: poReference ? 'versioned' : 'legacy_unversioned', reference: poReference ? { id: poReference.id } : null }, curriculum: {} };
  if (poReference) m.poReference = poReference; else delete m.poReference;
  Object.assign(m, extra);
  return { content: c, masters: m };
}
const refOf = ({ content, masters }) => plan.plan(content, masters);

test('a program in no list is accepted when a published reference matches its Program Outcomes, and every field comes from that reference', () => {
  const ctx = refOf(setup());
  assert.equal(ctx.reference.poUsable, true, JSON.stringify(ctx.reference.issues));
  assert.equal(ctx.reference.poVersion, 'ZZNEW-2026-v1'); assert.equal(ctx.reference.poReferenceId, 'po-77-v1'); assert.equal(ctx.reference.poSource, 'ZZNEW');
  assert.equal(ctx.reference.poSha256, refs.hashOutcomes(pos)); assert.equal(ctx.reference.authorization, null, 'an Admin-saved reference is authoritative: it carries no authorization or approval text'); assert.equal(ctx.reference.institutionalApproval, undefined);
  assert.ok(![...ctx.unavailable.values()].includes('po_reference_review'), 'no CLO-PO pair is held');
});
test('without a published version the CLO-PO relationships are NOT_CHECKED and no reference is attributed', () => {
  const ctx = refOf(setup({ poReference: null }));
  assert.equal(ctx.reference.poUsable, false); assert.ok(ctx.reference.issues.some((i) => i.code === 'po_reference_unpublished'));
  assert.equal(ctx.reference.poVersion, null); assert.equal(ctx.reference.authorization, null);
  assert.notEqual(ctx.reference.poVersion, official.version, 'the static official version is never borrowed');
  const held = [...ctx.unavailable.entries()].filter(([id, why]) => /^clo\d+-(po|anypo)/.test(id) && why === 'po_reference_review');
  assert.ok(held.length > 0);
});
test('the live Program Outcomes must equal the published statements: otherwise nothing is judged against them (the reference is not compared with itself)', () => {
  const drifted = pos.map((p) => (p.no === 2 ? { ...p, text: p.text + ' changed' } : p));
  const ctx = refOf(setup({ mastersPos: drifted }));
  assert.equal(ctx.reference.poUsable, false); assert.ok(ctx.reference.issues.some((i) => i.code === 'po_reference_unavailable'));
});
test('a syllabus whose authored Program Outcomes differ from the published reference is flagged for review, not remapped', () => {
  const ctx = refOf(setup({ authored: pos.map((p) => ({ ...p, text: p.text + ' (older wording)' })) }));
  assert.ok(ctx.reference.issues.some((i) => i.code === 'authored_po_basis_review'));
});
test('a CLO mapped to a PO number the published reference does not have is held on its own; the others are still judged', () => {
  const ctx = refOf(setup({ cloPos: [[1], [2], [3], [9]] }));
  assert.equal(ctx.reference.poUsable, true);
  assert.deepEqual([...ctx.reference.mappingsOutsideReference.entries()], [[3, [9]]]);
  const held = [...ctx.unavailable.entries()].filter(([id, why]) => why === 'po_reference_review').map(([id]) => id);
  assert.ok(held.length === 0 || held.every((id) => id.startsWith('clo3-')), 'only the CLO with the unknown PO is held: ' + held.join(','));
});
test('an inheritance that is not configured is reported, and the inherited program is named from data (outcomeSource), not from a code literal', () => {
  const ctx = refOf(setup({ program: 'ZZSPEC', extra: { outcomeSource: 'ZZNEW' } })); assert.equal(ctx.reference.poSource, 'ZZNEW'); assert.equal(ctx.reference.poUsable, true);
  const { content, masters } = setup({ program: 'ZZSPEC', poReference: null }); masters.referenceContext.po.status = 'inheritance_not_configured';
  assert.ok(plan.plan(content, masters).reference.issues.some((i) => i.code === 'inheritance_unverified'));
});
test('the four official programs keep working through their published (official source) versions, with no list consulted', () => {
  for (const code of ['BSIT', 'BSIE', 'BSCPE']) {
    const ref = official.programs[code], outcomes = ref.outcomes.map((p) => ({ no: p.no, short: p.short, text: p.text, egas: [] }));
    const ctx = refOf(setup({ program: code, mastersPos: outcomes, authored: outcomes, poReference: reference({ id: 'lcup-po-2026-10-29-' + code, version: official.version, kind: 'official_source', outcomes, authorization: official.authorization }), cloPos: [[1], [1], [1], [1]] }));
    assert.equal(ctx.reference.poUsable, true, code); assert.equal(ctx.reference.poVersion, official.version);
  }
});

test('hashOutcomes identifies the statements, not their formatting; any change of a statement, number or mapping changes it', () => {
  const base = refs.hashOutcomes(pos);
  assert.equal(refs.hashOutcomes([...pos].reverse().map((p) => ({ ...p, text: '  ' + p.text.replace(/ /g, '  ') + ' ' }))), base);
  assert.notEqual(refs.hashOutcomes(pos.map((p) => (p.no === 1 ? { ...p, text: p.text + '.' } : p))), base);
  assert.notEqual(refs.hashOutcomes(pos.map((p) => (p.no === 1 ? { ...p, egas: [1, 2] } : p))), base);
  assert.notEqual(refs.hashOutcomes(pos.slice(0, 2)), base);
});

// association: undefined = a database without the association columns (the query fails like MariaDB does); a row answers it; programCodes answers the same-program check
function fakeDb(row, { association, programCodes } = {}) {
  return { query: async (sql) => {
    if (/SELECT association, associated_by/.test(sql)) { if (association === undefined) throw Object.assign(new Error('Unknown column'), { code: 'ER_BAD_FIELD_ERROR' }); return [[association]]; }
    if (/FROM program_po_reference_active/.test(sql)) return [[row]];
    if (/FROM programs WHERE program_id IN/.test(sql)) return [programCodes || []];
    throw Error('unexpected ' + sql);
  } };
}
const versionRow = (extra = {}) => ({ reference_id: 'po-77-v1', program_id: 77, source_program_id: 77, version_label: 'ZZNEW-2026-v1', source_file: 'admin-published:ZZNEW:2026', source_sha256: refs.hashOutcomes(pos), outcomes_json: JSON.stringify(refs.canonicalOutcomes(pos)), status: 'published', academic_year: '2026–2027', published_by: 5, published_at: new Date(), supersedes_reference_id: null, ...extra });
test('activeFor: an administrator-published version is verified against its own hash; a changed or non-published row is refused', async () => {
  const ok = await refs.activeFor(fakeDb(versionRow()), 77);
  assert.equal(ok.kind, 'admin_published'); assert.equal(ok.authorization, undefined); assert.equal(ok.institutionalApproval, undefined); assert.equal(ok.academicYear, '2026–2027');
  const forged = JSON.parse(versionRow().outcomes_json); forged[0].text += ' forged';
  await assert.rejects(() => refs.activeFor(fakeDb(versionRow({ outcomes_json: JSON.stringify(forged) })), 77), (e) => e.body.code === 'po_reference_integrity');
  await assert.rejects(() => refs.activeFor(fakeDb(versionRow({ status: 'draft' })), 77), (e) => e.body.code === 'po_reference_drift');
  await assert.rejects(() => refs.activeFor(fakeDb(versionRow({ source_program_id: 12 })), 77), (e) => e.body.code === 'po_reference_drift');
});
test('activeFor: the official authorization text goes only to a row that matches the official source exactly, never to an administrator-published version', async () => {
  const b = official.programs.BSIT, row = versionRow({ reference_id: 'lcup-po-2026-10-29-BSIT', version_label: official.version, source_file: b.sourceFile, source_sha256: b.sha256, outcomes_json: JSON.stringify(b.outcomes), status: undefined });
  const off = await refs.activeFor(fakeDb(row), 77);
  assert.equal(off.kind, 'official_source'); assert.equal(off.authorization, official.authorization); assert.equal(off.institutionalApproval, 'not_recorded');
  const pretend = await refs.activeFor(fakeDb(versionRow({ version_label: official.version })), 77);
  assert.notEqual(pretend.authorization, official.authorization, 'an admin version that reuses the official label does not inherit its authorization');
  const missingTables = { query: async () => { throw Object.assign(Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); } };
  assert.equal(await refs.activeFor(missingTables, 77), null, 'a database without the tables is an unversioned database, as before');
});
test('the judgement cache key distinguishes the reference version for CLO-PO relationships only, and is what it always was without one', () => {
  const pair = { type: 'CLO-PO', source: 'PO text', target: 'CLO text' };
  const base = gemini.pairKey(pair, 'anthropic', 'm', 'v1', 'course');
  assert.equal(gemini.pairKey(pair, 'anthropic', 'm', 'v1', 'course', ''), base, 'no reference: unchanged');
  const a = gemini.pairKey(pair, 'anthropic', 'm', 'v1', 'course', 'po-1:aaa'), b = gemini.pairKey(pair, 'anthropic', 'm', 'v1', 'course', 'po-2:aaa');
  assert.notEqual(a, base); assert.notEqual(a, b, 'a new version is a new question even when the statement reads the same');
});

test('activeFor: a version owned by another program row is refused, unless an administrator explicitly associated it and both rows are the same program code', async () => {
  const foreign = versionRow({ source_program_id: 12, program_id: 12 });
  await assert.rejects(() => refs.activeFor(fakeDb(foreign), 77), (e) => e.body.code === 'po_reference_drift', 'a database without association columns: every pointer is an owner pointer');
  await assert.rejects(() => refs.activeFor(fakeDb(foreign, { association: { association: 'owner' } }), 77), (e) => e.body.code === 'po_reference_drift');
  const adopted = { association: 'adopted', associated_by: 5, associated_at: new Date(), association_note: 'The same statements apply this year.' };
  await assert.rejects(() => refs.activeFor(fakeDb(foreign, { association: adopted, programCodes: [{ program_id: 12, code: 'ZZNEW' }, { program_id: 77, code: 'OTHER' }] }), 77), (e) => e.body.code === 'po_reference_drift', 'adopted from a different program code');
  const ok = await refs.activeFor(fakeDb(foreign, { association: adopted, programCodes: [{ program_id: 12, code: 'ZZNEW' }, { program_id: 77, code: 'ZZNEW' }] }), 77);
  assert.equal(ok.association, 'adopted'); assert.equal(ok.ownerProgramId, 12); assert.equal(ok.associationNote, 'The same statements apply this year.');
});
test('compareOutcomes reports added, removed and changed Program Outcomes by number, and what about them changed', () => {
  const changed = pos.map((p) => (p.no === 2 ? { ...p, text: p.text + ' revised', egas: [1, 2] } : p)).filter((p) => p.no !== 3).concat([{ no: 4, short: 'ZPO 4', text: 'A new outcome.', egas: [] }]);
  const diff = refs.compareOutcomes(pos, changed);
  assert.deepEqual(diff.added.map((p) => p.no), [4]); assert.deepEqual(diff.removed.map((p) => p.no), [3]); assert.deepEqual(diff.changed.map((c) => [c.no, c.fields]), [[2, ['text', 'egas']]]); assert.equal(diff.unchanged, 1); assert.equal(diff.identical, false);
  assert.equal(refs.compareOutcomes(pos, [...pos].reverse()).identical, true);
});

test('a save keeps the stored PO statements of a mapped syllabus, whatever the request sends, until the author adopts them', () => {
  const { forceStandards, poReviewPending } = require('../syllabusOutcomes');
  const egas = [{ no: 1, name: 'E', short: 'E' }], old = [{ no: 1, short: 'P1', text: 'Stored statement.', egas: [1] }];
  const standards = { vision: 'V', mission: { lead: 'L', items: [] }, egas, pos: [{ no: 1, short: 'P1', text: 'Updated statement.', egas: [1] }], poReference: { id: 'po-1-v2' } };
  const stored = { outcomes: { vision: 'V', mission: { lead: 'L', items: [] }, egas, pos: old, poReference: { id: 'po-1-v1' } }, clos: [{ pos: [1] }], plan: [] };
  const forged = { vision: 'Forged', mission: { lead: 'x', items: [] }, egas: [], pos: [{ no: 1, short: 'x', text: 'Forged statement.', egas: [] }] };
  forceStandards(forged, standards, stored);
  assert.equal(forged.pos[0].text, 'Stored statement.', 'neither the forged nor the updated statement is taken'); assert.equal(forged.vision, 'V'); assert.equal(forged.poReference.id, 'po-1-v1');
  const shared = JSON.parse(JSON.stringify(stored)); forceStandards(shared.outcomes, standards, shared);
  assert.equal(shared.outcomes.pos[0].text, 'Stored statement.', 'a partial save passes the stored object itself');
  const noMapping = { ...stored, clos: [{ pos: [] }] }, draft = { pos: [] };
  assert.equal(poReviewPending(noMapping, standards), false);
  forceStandards(draft, standards, noMapping); assert.equal(draft.pos[0].text, 'Updated statement.', 'a draft with no mappings fills in');
  const adopted = forceStandards({ pos: [] }, standards); assert.equal(adopted.pos[0].text, 'Updated statement.', 'adoption passes no stored content');
  const dropped = { ...standards, egas: [{ no: 2, name: 'F', short: 'F' }], pos: [{ no: 1, short: 'P1', text: 'Updated statement.', egas: [2] }] };
  const kept = forceStandards({}, dropped, stored); assert.deepEqual(kept.egas, egas, 'stored statements never point at a missing EGA');
});
