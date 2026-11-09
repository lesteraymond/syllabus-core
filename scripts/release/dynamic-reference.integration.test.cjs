'use strict';
// Integration test of the database-driven academic references: the real Express API (Admin and faculty roles), a scripted Claude double, an ISOLATED synthetic database (a fresh bootstrap of the
// repository schema, port E2E_DB_PORT, name containing "e2e"). Not part of `npm test` (it needs that database). Nothing is written to or read from a real database.
//   E2E_DB_PORT=43311 E2E_DB_NAME=syllabus_e2e_dynref node --test scripts/release/dynamic-reference.integration.test.cjs
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const ROOT = path.resolve(__dirname, '../..');
process.chdir(ROOT);
process.env.E2E_DB_PORT = process.env.E2E_DB_PORT || '43311'; process.env.E2E_DB_NAME = process.env.E2E_DB_NAME || 'syllabus_e2e_dynref';
require(path.join(ROOT, 'scripts/e2e/db-port-redirect.cjs'));
const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
const { seed, PASSWORD } = require(path.join(ROOT, 'scripts/e2e/seed-e2e.cjs'));
const { startApi, waitFor } = require(path.join(ROOT, 'scripts/e2e/stack.cjs'));
const { sample } = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/harness'));
const repo = require(path.join(ROOT, 'server/lib/syllabuscheck/repository'));
const plan = require(path.join(ROOT, 'server/lib/syllabuscheck/academicV2Plan'));
const refs = require(path.join(ROOT, 'server/lib/programPoReferences'));
const official = require(path.join(ROOT, 'src/data/officialProgramOutcomes.json'));
const PORT = Number(process.env.E2E_DB_PORT), DB = process.env.E2E_DB_NAME, FRONT = 'https://localhost:3644', API_PORT = 3427, BASE = `http://127.0.0.1:${API_PORT}`;
const YEAR1 = '2026–2027', YEAR2 = '2027–2028', S = { reports: {} };
let db, api, work, cookies = {}, s0;

const dbConn = () => mysql.createConnection({ host: '127.0.0.1', port: PORT, user: 'root', password: '', database: DB });
function launch(flags = {}) {
  const control = path.join(work, 'mode.txt'); fs.writeFileSync(control, 'ok');
  return startApi({ port: API_PORT, work, front: FRONT, control, providerLog: path.join(work, 'p-' + Object.keys(flags).length + '.jsonl'), serverLog: path.join(work, 'api.log'),
    extraEnv: { E2E_DB_PORT: String(PORT), SYLLABUS_CHECK_PROFILE: 'comprehensive-testing', SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_AI_MAX_COST_USD: '100', SYLLABUS_CHECK_REUSE: 'on', ...flags } });
}
async function call(who, method, url, body) {
  const r = await fetch(BASE + '/api' + url, { method, headers: { 'Content-Type': 'application/json', Origin: FRONT, 'X-Forwarded-Proto': 'https', ...(cookies[who] ? { Cookie: cookies[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* none */ }
  if (url === '/auth/login') cookies[who] = (r.headers.getSetCookie() || []).map((c) => c.split(';')[0]).filter((c) => c.startsWith('connect.sid')).join('; ');
  return { status: r.status, body: j };
}
async function login() { for (const [who, email] of [['admin', 'e2e.admin@e2e.invalid'], ['faculty', 'e2e.faculty@e2e.invalid']]) assert.equal((await call(who, 'POST', '/auth/login', { email, password: PASSWORD })).status, 200); }
const SECTIONS = ['clos', 'plan', 'reqs', 'refs', 'grading', 'outcomes', 'meta', 'description'];
async function putContent(id, content) {
  const cur = await call('faculty', 'GET', `/syllabi/${id}/content`);
  const sections = Object.fromEntries(SECTIONS.filter((k) => content[k] !== undefined).map((k) => [k, content[k]]));
  return call('faculty', 'PUT', `/syllabi/${id}/content`, { sections, schemaVersion: 3, baseRevisions: Object.fromEntries(Object.keys(sections).map((k) => [k, (cur.body.revisions || {})[k]])) });
}
const recheck = (id) => call('faculty', 'POST', `/syllabi/${id}/compliance/recheck`, {});
// the content of a syllabus for a program: the program's own EGAs and POs as the Admin entered them, CLO tags kept inside the program's PO range
function contentFor({ courseId, code, title, program, egas, pos, curriculumYear, cloPos }) {
  const c = JSON.parse(JSON.stringify(s0.content)), max = Math.max(...pos.map((p) => p.no)), nos = new Set(pos.map((p) => p.no));
  Object.assign(c.meta, { courseId, code, title, program, curriculumYear, prereq: 'ZZ 100 - Prerequisite', lecture: '2', lab: '1', yearLevel: '2' });
  c.outcomes = { vision: s0.masters.institution.vision, mission: s0.masters.institution.mission, egas: egas.map((e) => ({ ...e })), pos: pos.map((p) => ({ ...p })) };
  c.clos.forEach((clo, i) => { clo.pos = (cloPos ? cloPos[i] : (clo.pos || []).filter((n) => nos.has(n) && n <= max)); clo.egas = (clo.egas || []).filter((n) => egas.some((e) => e.no === n)); });
  return c;
}
const relOf = (run) => ((run.hybrid.academicV2 && run.hybrid.academicV2.academic) || {}).relationships || [];
const poRel = (run) => relOf(run).filter((r) => /^CLO-(PO|anyPO)$/.test(r.relationshipType));
const refIssues = (run) => (((run.hybrid.academicV2 || {}).academic || {}).references || {}).issues || [];
const official1 = (run) => JSON.stringify({ overall: run.overall, status: run.status, passed: run.passed, threshold: run.passThreshold, areas: (run.areas || []).map((a) => [a.id || a.name, a.score]) });

test.before(async () => {
  db = await dbConn();
  const [[idn]] = await db.query('SELECT @@port AS port'); assert.equal(idn.port, PORT);
  await db.query('SET FOREIGN_KEY_CHECKS=0');
  const [tables] = await db.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  for (const t of tables) await db.query('DELETE FROM ??', [t.name]);
  await db.query('SET FOREIGN_KEY_CHECKS=1');
  await db.query('INSERT INTO academic_years(label,start_year,is_current) VALUES(?,?,1)', [YEAR1, 2026]);
  await seed({ host: '127.0.0.1', port: PORT, user: 'root', password: '', database: DB });
  s0 = sample();
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'dynref-'));
  api = launch(); await waitFor(BASE + '/api/health', 60000); await login();
});
test.after(async () => { try { api && api.kill(); } catch { /* done */ } if (db) await db.end(); });

// ---------------- 1-4. the existing programs resolve their official versions ----------------
test('1-4. BSIT 9, BSIE 13, BSCpE 13 and Cyber Security (inherits BSIT) resolve from the database; Policy V2 accepts their published version without any fixed list', async () => {
  const inst = s0.masters.institution.egas;
  const make = async (code, name) => {
    const ref = official.programs[code === 'BSIT-CYBERSECURITY' ? 'BSIT' : code];
    const [[existing]] = await db.query('SELECT program_id FROM programs WHERE code = ?', [code]);
    let id = existing && existing.program_id;
    if (!id) { const [r] = await db.query('INSERT INTO programs (code, name, academic_year) VALUES (?, ?, ?)', [code, name, YEAR1]); id = r.insertId; }
    for (const e of inst) await db.query('INSERT IGNORE INTO program_egas (program_id, ega_no, name, short_name) VALUES (?, ?, ?, ?)', [id, e.no, e.name, e.short]);
    return { id, ref };
  };
  const bsit = await make('BSIT', 'BS Information Technology'); const out = {};
  await db.query('DELETE FROM program_outcomes WHERE program_id = ?', [bsit.id]);
  for (const [code, name] of [['BSIE', 'BS Industrial Engineering'], ['BSCPE', 'BS Computer Engineering']]) out[code] = await make(code, name);
  out.BSIT = bsit;
  for (const code of ['BSIT', 'BSIE', 'BSCPE']) {
    const { id, ref } = out[code], refId = `lcup-po-2026-10-29-${code}`;
    await db.query('DELETE FROM program_outcomes WHERE program_id = ?', [id]);
    for (const p of ref.outcomes) await db.query('INSERT INTO program_outcomes (program_id, po_no, short_name, outcome_text, ega_nos) VALUES (?, ?, ?, ?, ?)', [id, p.no, p.short, p.text, (p.egas || []).join(',')]);
    await db.query('INSERT INTO program_po_reference_versions (reference_id, program_id, version_label, source_file, source_sha256, outcomes_json) VALUES (?, ?, ?, ?, ?, ?)', [refId, id, official.version, ref.sourceFile, ref.sha256, JSON.stringify(ref.outcomes)]);
    await db.query('INSERT INTO program_po_reference_active (program_id, reference_id) VALUES (?, ?)', [id, refId]);
  }
  const cyber = await make('BSIT-CYBERSECURITY', 'BS Information Technology - Cyber Security');
  await db.query('INSERT INTO program_outcome_sources (program_id, source_program_id, specialization) VALUES (?, ?, ?)', [cyber.id, bsit.id, 'Cyber Security']);
  const expected = { BSIT: 9, BSIE: 13, BSCPE: 13, 'BSIT-CYBERSECURITY': 9 };
  for (const [code, n] of Object.entries(expected)) {
    const m = await repo.mastersFor(db, { meta: { program: code } }, {});
    assert.equal(m.pos.length, n, code + ' PO count from the database');
    assert.equal(m.poReference.version, official.version); assert.equal(m.poReference.kind, 'official_source');
    assert.equal(m.referenceContext.po.reference.version, official.version);
    assert.equal(m.outcomeSource, code === 'BSIT-CYBERSECURITY' ? 'BSIT' : null, code + ' inheritance is data, not a list');
    // Policy V2: the published version is the authority; the faculty-authored numbers are checked against it
    const content = contentFor({ courseId: 1, code: 'X 1', title: 'Synthetic', program: code, egas: inst, pos: m.pos, curriculumYear: 'test-2026' });
    const ctx = plan.plan(content, { ...m, curricula: m.curricula });
    assert.equal(ctx.reference.poUsable, true, code + ': ' + JSON.stringify(ctx.reference.issues));
    assert.equal(ctx.reference.poVersion, official.version);
    assert.equal(ctx.reference.poSource, code === 'BSIT-CYBERSECURITY' ? 'BSIT' : code);
    assert.ok(![...ctx.unavailable.values()].includes('po_reference_review'), code + ': no CLO-PO pair is held');
  }
  // Cyber keeps its OWN curriculum source; only its POs follow BSIT (owner policy 2026-11-09)
  const cm = await repo.mastersFor(db, { meta: { program: 'BSIT-CYBERSECURITY' } }, {});
  assert.equal(cm.referenceContext.curriculum.source, 'BSIT-CYBERSECURITY'); assert.equal(cm.referenceContext.po.source, 'BSIT');
});

// ---------------- 5-8, 15, 16, 17. a new program: saved by the Admin, so its version exists at once ----------------
const EGAS = [{ no: 1, name: 'Zeta competence', short: 'Zeta1' }, { no: 2, name: 'Zeta thinking', short: 'Zeta2' }, { no: 3, name: 'Zeta service', short: 'Zeta3' }];
const POS = [
  { no: 1, short: 'ZPO 1', text: 'Zeta: apply knowledge of computing and mathematics to solve computing problems.', egas: [1] },
  { no: 2, short: 'ZPO 2', text: 'Zeta: analyze a problem and identify the computing requirements appropriate to its solution.', egas: [2] },
  { no: 3, short: 'ZPO 3', text: 'Zeta: design, implement and evaluate computing-based solutions to meet desired needs.', egas: [1, 2] },
  { no: 4, short: 'ZPO 4', text: 'Zeta: work effectively in teams and communicate clearly with technical and non-technical audiences.', egas: [3] },
  { no: 5, short: 'ZPO 5', text: 'Zeta: practice professional, ethical and socially responsible conduct in computing.', egas: [] }, // no PO-EGA mapping: none is invented
];
const reviewOf = (id) => call('faculty', 'GET', `/syllabi/${id}/po-review`);
const adoptReview = (id, reviewedSha256, confirm = true) => call('faculty', 'POST', `/syllabi/${id}/po-review/adopt`, { reviewedSha256, confirm });
const statementsOf = async (id) => (await call('faculty', 'GET', `/syllabi/${id}/content`)).body.content;
// a save of one section that has nothing to do with Program Outcomes
const saveOnly = async (id, section) => { const cur = await call('faculty', 'GET', `/syllabi/${id}/content`); return call('faculty', 'PUT', `/syllabi/${id}/content`, { sections: { [section]: cur.body.content[section] }, schemaVersion: 3, baseRevisions: { [section]: (cur.body.revisions || {})[section] } }); };
const overview = async (id) => (await call('admin', 'GET', `/programs/${id}/po-reference`)).body;
const auditRows = async (programId, action) => (await db.query('SELECT * FROM program_po_reference_audit WHERE program_id <=> ? AND action = ? ORDER BY audit_id', [programId, action]))[0].map((r) => ({ ...r, details: JSON.parse(r.details_json) }));
const restart = async () => { api.kill(); await new Promise((r) => setTimeout(r, 1500)); api = launch(); await waitFor(BASE + '/api/health', 60000); cookies = {}; await login(); }; // also resets the app's limit of 10 checks a minute per user
test('5, 15, 17. an Admin-created program has version 1 in force at once, with no approval or document; the program EGAs are accepted; CUR-REF still blocks without a curriculum', async () => {
  const created = await call('admin', 'POST', '/courses', { code: 'ZZ 101', title: 'Zeta Programming Fundamentals', program: 'ZZNEW', programName: 'BS Zeta Computing (synthetic program)', outcomes: { egas: EGAS, pos: POS } });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  S.courseId = created.body.id; S.programId = created.body.program.id;
  const view = await overview(S.programId);
  assert.equal(view.liveStatus, 'published'); assert.equal(view.active.outcomeCount, 5); assert.match(view.active.version, /^ZZNEW-2026.2027-v1$/); assert.deepEqual(view.active.appliesTo.map((x) => x.academicYear), [YEAR1]);
  S.v1 = { id: view.active.id, version: view.active.version, sha256: view.active.sha256 };
  const [[row]] = await db.query('SELECT * FROM program_po_reference_versions WHERE reference_id = ?', [S.v1.id]);
  assert.equal(row.status, 'published'); assert.ok(row.published_by && row.published_at); assert.equal(row.academic_year, YEAR1); assert.equal(row.source_sha256, refs.hashOutcomes(JSON.parse(row.outcomes_json)));
  assert.ok(!('institutional_approval' in row) && !('authorization_note' in row) && !('source_evidence' in row), 'the version table has no approval or document column');
  const [saved] = await auditRows(S.programId, 'saved'); assert.equal(saved.details.previous, null); assert.equal(saved.details.next.id, S.v1.id); assert.ok(saved.actor_id && saved.at);
  const [fac] = (await db.query('SELECT user_id FROM users WHERE email = ?', ['e2e.faculty@e2e.invalid']))[0];
  await db.query('INSERT INTO faculty_courses (user_id, course_id) VALUES (?, ?)', [fac.user_id, S.courseId]);
  S.content = contentFor({ courseId: S.courseId, code: 'ZZ 101', title: 'Zeta Programming Fundamentals', program: 'ZZNEW', egas: EGAS, pos: POS, curriculumYear: 'zeta-2026', cloPos: [[1, 5], [2], [3], [4]] });
  const draft = await call('faculty', 'POST', '/syllabi/drafts'); S.syllabusId = draft.body.id;
  assert.equal((await putContent(S.syllabusId, S.content)).status, 200);
  const r = await recheck(S.syllabusId); assert.equal(r.status, 200, JSON.stringify(r.body));
  const run = r.body.run;
  assert.ok(run.findings.some((f) => f.ruleId === 'CUR-REF' && f.severity === 'blocking'), 'a subject without an approved curriculum is still blocked by CUR-REF');
  assert.ok(!run.findings.some((f) => f.ruleId === 'INST-EXACT'), 'the program EGAs are the EGA master: ' + JSON.stringify(run.findings.filter((f) => f.severity === 'blocking').map((f) => f.ruleId)));
  assert.ok(!refIssues(run).some((i) => i.code === 'po_reference_unpublished'), 'the saved outcomes are the reference');
  assert.equal(run.hybrid.referenceContext.po.reference.id, S.v1.id); assert.equal(run.hybrid.referenceContext.ega.source, 'program');
  assert.ok(!JSON.stringify(run).includes('lcup-po-2026-10-29'), 'no other program version is attributed to the new program');
});
test('5b. a program with no Program Outcomes yet has no reference: CLO-PO stays NOT_CHECKED until the Admin saves them', async () => {
  const [p] = await db.query('INSERT INTO programs (code, name, academic_year) VALUES (?, ?, ?)', ['ZZEMPTY', 'BS Empty (synthetic program)', YEAR1]);
  assert.equal((await overview(p.insertId)).active, null);
  const m = await repo.mastersFor(db, { meta: { program: 'ZZEMPTY' } }, {});
  const ctx = plan.plan(contentFor({ courseId: 1, code: 'X 1', title: 'T', program: 'ZZEMPTY', egas: EGAS, pos: POS, curriculumYear: 'x', cloPos: [[1], [2], [3], [4]] }), m);
  assert.equal(ctx.reference.poUsable, false); assert.ok(ctx.reference.issues.some((i) => i.code === 'po_reference_unpublished'));
});
test('7. an approved curriculum becomes resolvable for its program and syllabus year', async () => {
  const ref = await call('admin', 'POST', '/syllabus-check/references', { program: 'ZZNEW', curriculumYear: 'zeta-2026', source: 'synthetic test curriculum (not an official reference)', courses: [{ code: 'ZZ 101', title: 'Zeta Programming Fundamentals', prereq: 'ZZ 100 - Prerequisite', lecture: 2, lab: 1, yearLevel: 2 }] });
  assert.equal(ref.status, 201);
  assert.equal((await call('admin', 'POST', `/syllabus-check/references/${ref.body.id}/approve`, { confirmedAgainstSource: true })).status, 200);
  S.curriculumId = ref.body.id;
  const r = await recheck(S.syllabusId); const run = r.body.run;
  assert.ok(!run.findings.some((f) => f.ruleId === 'CUR-REF' && f.severity === 'blocking'), 'CUR-REF no longer blocks');
  assert.deepEqual(run.hybrid.referenceContext.curriculum.referenceIds, [S.curriculumId]);
  assert.equal(run.hybrid.referenceContext.curriculum.selectedYear, 'zeta-2026');
});
test('9, 12, 16, 18. the new program needs no change to the checker: each CLO-PO relationship is judged by the provider against its own POs, none is assumed aligned; P-03 stays NOT_CHECKED; the report records the real reference', async () => {
  const r = await recheck(S.syllabusId); assert.equal(r.status, 200, JSON.stringify(r.body)); const run = r.body.run; S.reports.v1 = run;
  const po = poRel(run);
  assert.ok(po.length > 0 && po.every((x) => x.status !== 'NOT_CHECKED' && (x.attempted !== false || x.reused === true)), 'every CLO-PO relationship was judged by the provider, now or in the check just before: ' + JSON.stringify(po.map((x) => [x.id, x.status, x.attempted, x.reused])));
  assert.ok(po.some((x) => String(x.sourceText).includes('Zeta: apply knowledge')) || po.some((x) => String(x.targetText).includes('Zeta: apply knowledge')), 'the model was given the Admin-saved PO text');
  assert.ok(!refIssues(run).some((i) => i.code === 'po_reference_unpublished' || i.code === 'po_reference_unavailable'));
  assert.deepEqual(run.hybrid.ruleCoverage.rules.filter((x) => x.ruleId === 'P-03').map((x) => x.status), ['NOT_CHECKED'], 'a PO-to-EGA crosswalk is never invented');
  assert.equal(run.passThreshold, 79); assert.notEqual(run.status, 'incomplete', JSON.stringify(run.findings.filter((f) => f.severity === 'blocking').map((f) => f.ruleId)));
  const ctx = run.hybrid.referenceContext, acad = run.hybrid.academicV2.academic.references;
  assert.equal(ctx.program.code, 'ZZNEW'); assert.equal(ctx.program.academicYear, YEAR1); assert.equal(ctx.po.reference.id, S.v1.id); assert.equal(ctx.po.reference.version, S.v1.version);
  assert.equal(ctx.po.reference.contentSha256, S.v1.sha256); assert.equal(ctx.po.reference.kind, 'admin_published'); assert.equal(ctx.po.reference.institutionalApproval, undefined, 'an Admin-saved reference carries no approval field');
  assert.equal(ctx.po.sourceProgram.code, 'ZZNEW'); assert.equal(ctx.ega.source, 'program'); assert.equal(ctx.ega.count, 3); assert.ok(ctx.ega.sha256 && ctx.institution.version >= 1); assert.deepEqual(ctx.curriculum.referenceIds, [S.curriculumId]); assert.equal(ctx.curriculum.sha256.length, 1);
  assert.equal(acad.poVersion, S.v1.version); assert.equal(acad.poReferenceId, S.v1.id); assert.equal(acad.poSource, 'ZZNEW');
  const [[stored]] = await db.query('SELECT report_json FROM syllabus_check_reports ORDER BY run_id DESC LIMIT 1'); // what is saved is what was resolved
  assert.ok(!stored.report_json.includes('lcup-po-2026-10-29') && !stored.report_json.includes('User instruction 2026-10-29'));
  assert.ok(stored.report_json.includes(S.v1.id));
  assert.ok(!/officially approved|approval status/i.test(plan.V2_PROMPT), 'Claude is never asked whether a reference is approved');
});
test('19a. an unchanged re-check reuses the cached judgements', async () => {
  const run = (await recheck(S.syllabusId)).body.run;
  assert.ok(poRel(run).every((x) => x.reused === true), 'unchanged reference: reused: ' + JSON.stringify(poRel(run).map((x) => x.reused)));
});

// ---------------- 11, 13, 14, 19b, 12. the Admin edits a saved reference: the save is the new version ----------------
test('11, 13. only an Admin can save; a stale screen is refused; saving the same statements makes no version', async () => {
  S.changed = POS.map((p) => (p.no === 5 ? { ...p, text: p.text + ' (revised wording)', egas: [3] } : p));
  assert.equal((await call('faculty', 'PUT', `/programs/${S.programId}/outcomes`, { pos: S.changed, version: 1 })).status, 403);
  assert.equal((await call('admin', 'POST', `/programs/${S.programId}/po-reference/publish`, {})).status, 404, 'there is no publication step');
  assert.equal((await call('admin', 'PUT', `/programs/${S.programId}/po-reference/draft`, { pos: S.changed })).status, 404, 'there is no draft step');
  const cur = await call('admin', 'GET', `/programs/${S.programId}/outcomes`); assert.equal(cur.status, 200); assert.equal(cur.body.referencesVersioned, true);
  S.posVersion = cur.body.versions.pos;
  assert.equal((await call('admin', 'PUT', `/programs/${S.programId}/outcomes`, { pos: S.changed, version: S.posVersion - 1 })).status, 409, 'an out-of-date screen is refused');
  const same = await call('admin', 'PUT', `/programs/${S.programId}/outcomes`, { pos: POS, version: S.posVersion }); assert.equal(same.status, 200, JSON.stringify(same.body));
  S.posVersion = same.body.versions.pos;
  const view = await overview(S.programId); assert.equal(view.active.id, S.v1.id); assert.equal(view.history.length, 1, 'nothing changed, so there is no new version');
});
test('14, 12. saving changed outcomes puts the next version in force at once; the previous version is unchanged; the log says who, when, the previous and the new version', async () => {
  const [[before]] = await db.query('SELECT outcomes_json, source_sha256 FROM program_po_reference_versions WHERE reference_id = ?', [S.v1.id]);
  const saved = await call('admin', 'PUT', `/programs/${S.programId}/outcomes`, { pos: S.changed, version: S.posVersion }); assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const view = await overview(S.programId); S.v2 = { id: view.active.id, version: view.active.version, sha256: view.active.sha256 };
  assert.match(S.v2.version, /-v2$/); assert.notEqual(S.v2.id, S.v1.id);
  const [[old]] = await db.query('SELECT * FROM program_po_reference_versions WHERE reference_id = ?', [S.v1.id]);
  assert.equal(old.status, 'superseded'); assert.equal(old.outcomes_json, before.outcomes_json, 'previous outcomes untouched'); assert.equal(old.source_sha256, before.source_sha256);
  const [[now]] = await db.query('SELECT supersedes_reference_id FROM program_po_reference_versions WHERE reference_id = ?', [S.v2.id]); assert.equal(now.supersedes_reference_id, S.v1.id);
  assert.ok((await db.query('SELECT outcome_text FROM program_outcomes WHERE program_id = ? AND po_no = 5', [S.programId]))[0][0].outcome_text.includes('revised wording'));
  assert.equal((await call('admin', 'GET', `/programs/${S.programId}/po-reference/compare?from=active&to=live`)).body.identical, true, 'the rows and the version never differ');
  const log = (await auditRows(S.programId, 'saved')).at(-1);
  assert.equal(log.details.previous.id, S.v1.id); assert.equal(log.details.previous.version, S.v1.version); assert.equal(log.details.next.id, S.v2.id); assert.equal(log.details.next.sha256, S.v2.sha256); assert.ok(log.actor_id && log.at);
  assert.deepEqual(view.history.map((h) => h.status).sort(), ['published', 'superseded']);
  assert.equal(view.changes[0].next.id, S.v2.id); assert.equal(view.changes[0].previous.id, S.v1.id); assert.match(view.changes[0].by, /Test Administrator/);
});
test('14b, 12b. a syllabus authored under the earlier version is not silently re-scored: the check is refused until its mappings are reviewed; the earlier saved report is unchanged', async () => {
  const r = await recheck(S.syllabusId);
  assert.equal(r.status, 409); assert.equal(r.body.code, 'po_reference_review_required'); assert.equal(r.body.referenceId, S.v2.id);
  const [all] = await db.query('SELECT r.run_id, r.report_json FROM syllabus_check_reports r JOIN ai_check_runs a ON a.run_id = r.run_id WHERE a.syllabus_id = ? ORDER BY r.run_id', [S.syllabusId]);
  const stored = all.map((x) => JSON.parse(x.report_json)).find((x) => x.hybrid.referenceContext.po.reference && x.hybrid.referenceContext.po.reference.id === S.v1.id);
  assert.ok(stored, 'the earlier report still names the earlier version'); assert.equal(all.length >= 3, true);
  assert.ok(!JSON.stringify(stored).includes('revised wording'));
  assert.equal((await call('faculty', 'GET', `/compliance?syllabus=${S.syllabusId}`)).status, 200);
});
test('19b. after Apply to subjects and the author adopting the new reference, judgements made under the earlier version are not reused', async () => {
  await restart();
  assert.equal((await call('admin', 'POST', `/programs/${S.programId}/sync-subjects`)).status, 200);
  const review = await reviewOf(S.syllabusId); assert.equal(review.body.pending, true, JSON.stringify(review.body));
  assert.equal((await adoptReview(S.syllabusId, review.body.reviewedSha256)).status, 200);
  S.content.outcomes.pos = S.changed.map((p) => ({ ...p }));
  const r = await recheck(S.syllabusId); assert.equal(r.status, 200, JSON.stringify(r.body)); const run = r.body.run; S.reports.v2 = run;
  assert.equal(run.hybrid.referenceContext.po.reference.id, S.v2.id); assert.equal(run.hybrid.referenceContext.po.reference.version, S.v2.version);
  assert.ok(poRel(run).length > 0 && poRel(run).every((x) => x.reused === false && x.status !== 'NOT_CHECKED'), 'CLO-PO asked again under the new version: ' + JSON.stringify(poRel(run).map((x) => x.reused)));
  assert.ok(relOf(run).filter((x) => !/^CLO-(PO|anyPO)$/.test(x.relationshipType) && x.attempted !== undefined).some((x) => x.reused === true), 'everything that does not read the PO reference is still reused');
});
test('12c. a version altered after it was saved is refused (integrity), then restored', async () => {
  const [[row]] = await db.query('SELECT outcomes_json FROM program_po_reference_versions WHERE reference_id = ?', [S.v2.id]);
  const forged = JSON.parse(row.outcomes_json); forged[0].text += ' FORGED';
  await db.query('UPDATE program_po_reference_versions SET outcomes_json = ? WHERE reference_id = ?', [JSON.stringify(forged), S.v2.id]);
  try { const r = await recheck(S.syllabusId); assert.equal(r.status, 409); assert.ok(['po_reference_integrity', 'po_reference_drift'].includes(r.body.code), JSON.stringify(r.body)); }
  finally { await db.query('UPDATE program_po_reference_versions SET outcomes_json = ? WHERE reference_id = ?', [row.outcomes_json, S.v2.id]); }
  assert.equal((await recheck(S.syllabusId)).status, 200);
});
test('EGA save: the log keeps the statements before and after with who and when; faculty are refused; CLO-EGA is asked again while CLO-PO is reused', async () => {
  await restart();
  const cur = (await call('admin', 'GET', `/programs/${S.programId}/outcomes`)).body;
  const revised = EGAS.map((e) => (e.no === 2 ? { ...e, name: 'Zeta critical thinking (revised)' } : e));
  assert.equal((await call('faculty', 'PUT', `/programs/${S.programId}/egas`, { egas: revised, version: cur.versions.egas })).status, 403);
  const saved = await call('admin', 'PUT', `/programs/${S.programId}/egas`, { egas: revised, version: cur.versions.egas }); assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const log = (await auditRows(S.programId, 'ega_saved')).at(-1);
  assert.ok(log.actor_id && log.at); assert.equal(log.details.previous.egas.find((e) => e.no === 2).name, 'Zeta thinking'); assert.equal(log.details.next.egas.find((e) => e.no === 2).name, 'Zeta critical thinking (revised)');
  assert.notEqual(log.details.previous.version, log.details.next.version);
  assert.equal((await call('admin', 'POST', `/programs/${S.programId}/sync-subjects`)).status, 200);
  S.content.outcomes.egas = revised.map((e) => ({ ...e }));
  assert.equal((await putContent(S.syllabusId, S.content)).status, 200);
  const r = await recheck(S.syllabusId); assert.equal(r.status, 200, JSON.stringify(r.body));
  const ega = relOf(r.body.run).filter((x) => /^CLO-(EGA|anyEGA)$/.test(x.relationshipType));
  assert.ok(ega.length > 0 && ega.some((x) => x.reused === false), 'a changed EGA statement is judged again: ' + JSON.stringify(ega.map((x) => x.reused)));
  assert.ok(poRel(r.body.run).every((x) => x.reused === true), 'the Program Outcomes did not change');
  assert.equal(r.body.run.hybrid.referenceContext.po.reference.id, S.v2.id, 'an EGA save does not make a PO version');
});
test('Vision and Mission save: the log keeps the record before and after with who and when; faculty only read it', async () => {
  const before = (await call('faculty', 'GET', '/institution/outcomes')).body; assert.ok(before.vision !== undefined, 'faculty can read the references');
  const body = { vision: 'Synthetic vision saved by the test administrator.', mission: { lead: 'Synthetic mission lead.', items: ['Synthetic mission item.'] }, egas: before.egas, version: before.version };
  assert.equal((await call('faculty', 'PUT', '/institution/outcomes', body)).status, 403);
  assert.equal((await call('admin', 'PUT', '/institution/outcomes', body)).status, 200);
  const log = (await auditRows(null, 'institution_saved')).at(-1);
  assert.ok(log.actor_id && log.at); assert.equal(log.details.previous.vision, before.vision); assert.equal(log.details.next.vision, body.vision); assert.notEqual(log.details.previous.version, log.details.next.version);
});

// ---------------- Apply to Subjects: a saved version applies to the program; an existing subject moves only when the Admin says so ----------------
test('Apply to Subjects: an existing subject and its syllabus stay on their version until the Admin applies it; nothing is rewritten; the checker refuses to treat the old reference as aligned; reports and cache stay accurate', async () => {
  await restart();
  const egas = [{ no: 1, name: 'Apply competence', short: 'Ap1' }, { no: 2, name: 'Apply thinking', short: 'Ap2' }];
  const pos = [
    { no: 1, short: 'APO 1', text: 'Apply: use computing knowledge to solve well-defined problems.', egas: [1] },
    { no: 2, short: 'APO 2', text: 'Apply: analyze requirements and design computing solutions.', egas: [2] },
    { no: 3, short: 'APO 3', text: 'Apply: communicate technical work clearly to varied audiences.', egas: [] }, // no PO-EGA mapping: none may be invented
    { no: 4, short: 'APO 4', text: 'Apply: practice professional and ethical conduct in computing.', egas: [1] },
  ];
  const made = await call('admin', 'POST', '/courses', { code: 'ZA 101', title: 'Apply Programming', program: 'ZZAPPLY', programName: 'BS Apply Computing (synthetic program)', outcomes: { egas, pos } }); assert.equal(made.status, 200, JSON.stringify(made.body));
  const programId = made.body.program.id, courseId = made.body.id;
  const [[fac]] = await db.query('SELECT user_id FROM users WHERE email = ?', ['e2e.faculty@e2e.invalid']); await db.query('INSERT INTO faculty_courses (user_id, course_id) VALUES (?, ?)', [fac.user_id, courseId]);
  const cur = await call('admin', 'POST', '/syllabus-check/references', { program: 'ZZAPPLY', curriculumYear: 'apply-2026', source: 'synthetic test curriculum', courses: [{ code: 'ZA 101', title: 'Apply Programming', prereq: 'ZZ 100 - Prerequisite', lecture: 2, lab: 1, yearLevel: 2 }, { code: 'ZA 102', title: 'Apply Later Subject', prereq: 'ZA 101 - Apply Programming', lecture: 2, lab: 1, yearLevel: 2 }] });
  assert.equal((await call('admin', 'POST', `/syllabus-check/references/${cur.body.id}/approve`, { confirmedAgainstSource: true })).status, 200);
  const closSaved = await call('admin', 'PUT', `/courses/${courseId}/clos`, { clos: [{ title: 'Catalog CLO', level: 'Introductory', statement: 'Solve well-defined computing problems.', egas: [1], pos: [1] }], version: made.body.version }); assert.equal(closSaved.status, 200, JSON.stringify(closSaved.body));
  const v1 = (await overview(programId)).active;
  const content = contentFor({ courseId, code: 'ZA 101', title: 'Apply Programming', program: 'ZZAPPLY', egas, pos, curriculumYear: 'apply-2026', cloPos: [[1], [2], [3], [4]] });
  const syllabusId = (await call('faculty', 'POST', '/syllabi/drafts')).body.id;
  assert.equal((await putContent(syllabusId, content)).status, 200);
  const first = await recheck(syllabusId); assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.run.hybrid.referenceContext.po.reference.id, v1.id);
  const [[reportBefore]] = await db.query('SELECT r.run_id, r.report_json FROM syllabus_check_reports r JOIN ai_check_runs a ON a.run_id = r.run_id WHERE a.syllabus_id = ? ORDER BY r.run_id DESC LIMIT 1', [syllabusId]);
  const storedBefore = (await db.query('SELECT standards_json FROM courses WHERE course_id = ?', [courseId]))[0][0].standards_json;
  const authored = (await call('faculty', 'GET', `/syllabi/${syllabusId}/content`)).body.content;

  // the Admin updates a Program Outcome: a new program-level version is in force at once
  const current = (await call('admin', 'GET', `/programs/${programId}/outcomes`)).body;
  const revised = current.pos.map((p) => (p.no === 2 ? { ...p, text: 'Apply: analyze requirements and evaluate computing solutions (revised).' } : p));
  assert.equal((await call('admin', 'PUT', `/programs/${programId}/outcomes`, { pos: revised, version: current.versions.pos })).status, 200);
  const v2 = (await overview(programId)).active;
  assert.match(v2.version, /-v2$/); assert.notEqual(v2.id, v1.id);

  // the existing subject still shows the reference it was given, and has not inherited the new one
  const before = await call('faculty', 'GET', `/courses/${courseId}`); assert.equal(before.status, 200, JSON.stringify(before.body));
  assert.ok(!before.body.standards.pos[1].text.includes('(revised)'), 'the subject does not silently take the new statement');
  assert.equal(before.body.standards.poReference.id, v1.id, 'the subject names the version it is on');
  assert.deepEqual(before.body.clos.map((c) => c.pos), [[1]], 'the catalog CLO mapping is untouched, and the subject can still be read');
  assert.equal((await db.query('SELECT standards_json FROM courses WHERE course_id = ?', [courseId]))[0][0].standards_json, storedBefore, 'the stored copy is not overwritten');
  // a faculty save keeps the subject's version; it does not pull the newer statements into the syllabus
  const saved = await putContent(syllabusId, content); assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const afterSave = (await call('faculty', 'GET', `/syllabi/${syllabusId}/content`)).body.content;
  assert.ok(!JSON.stringify(afterSave.outcomes.pos).includes('(revised)'), 'the syllabus keeps the reference of its subject');
  // a new subject of the program starts on the version in force
  const later = await call('admin', 'POST', '/courses', { code: 'ZA 102', title: 'Apply Later Subject', program: 'ZZAPPLY' }); assert.equal(later.status, 200, JSON.stringify(later.body));
  assert.ok(later.body.standards.pos[1].text.includes('(revised)')); assert.equal(later.body.standards.poReference.id, v2.id, 'a new subject uses the applicable version');

  // the checker never treats the outdated reference as aligned with the newer program master
  const refused = await recheck(syllabusId);
  assert.equal(refused.status, 409, JSON.stringify(refused.body)); assert.equal(refused.body.code, 'po_reference_review_required'); assert.equal(refused.body.referenceId, v2.id);
  await assert.rejects(() => repo.mastersFor(db, afterSave, { syllabusId }), (e) => e.body.code === 'po_reference_review_required', 'the resolver itself refuses the outdated basis');
  const stale = plan.plan(afterSave, await repo.mastersFor(db, { meta: afterSave.meta }, {}));
  assert.equal(stale.reference.poUsable, false); assert.ok(stale.reference.issues.some((i) => i.code === 'authored_po_basis_review'), JSON.stringify(stale.reference.issues));
  assert.ok([...stale.unavailable.values()].includes('po_reference_review'), 'its CLO-PO relationships are NOT_CHECKED, not judged against the newer statements');

  // Apply to Subjects moves the subject, explicitly; the CLO mappings and the saved syllabus are not rewritten
  assert.equal((await call('faculty', 'POST', `/programs/${programId}/sync-subjects`)).status, 403);
  const applied = await call('admin', 'POST', `/programs/${programId}/sync-subjects`); assert.equal(applied.status, 200, JSON.stringify(applied.body)); assert.equal(applied.body.updated, 1, JSON.stringify(applied.body)); assert.equal(applied.body.skipped.length, 0);
  const after = (await call('faculty', 'GET', `/courses/${courseId}`)).body;
  assert.ok(after.standards.pos[1].text.includes('(revised)')); assert.equal(after.standards.poReference.id, v2.id); assert.deepEqual(after.clos.map((c) => c.pos), [[1]], 'Apply does not rewrite a CLO mapping');
  const untouched = (await call('faculty', 'GET', `/syllabi/${syllabusId}/content`)).body.content;
  assert.deepEqual(untouched.outcomes.pos, afterSave.outcomes.pos, 'Apply does not reach into a saved syllabus'); assert.deepEqual(untouched.clos.map((c) => c.pos), authored.clos.map((c) => c.pos), 'the faculty CLO-PO mappings are unchanged');
  assert.deepEqual(untouched.clos.map((c) => c.statement), authored.clos.map((c) => c.statement));
  assert.equal((await db.query('SELECT report_json FROM syllabus_check_reports WHERE run_id = ?', [reportBefore.run_id]))[0][0].report_json, reportBefore.report_json, 'the saved report is byte-identical');
  assert.ok(reportBefore.report_json.includes(v1.id) && !reportBefore.report_json.includes('(revised)'));

  // Apply makes the update available for review; nothing adopts it until the author does
  const pendingText = untouched.outcomes.pos[1].text;
  for (const section of ['refs', 'plan', 'description', 'meta']) { const s = await saveOnly(syllabusId, section); assert.equal(s.status, 200, section + ' ' + JSON.stringify(s.body)); assert.equal((await statementsOf(syllabusId)).outcomes.pos[1].text, pendingText, 'saving only ' + section + ' keeps the stored statements'); }
  const forged = JSON.parse(JSON.stringify(untouched.outcomes)); forged.pos[1].text = 'A forged Program Outcome statement.';
  const revs = (await call('faculty', 'GET', `/syllabi/${syllabusId}/content`)).body.revisions;
  const forgedSave = await call('faculty', 'PUT', `/syllabi/${syllabusId}/content`, { sections: { outcomes: forged }, schemaVersion: 3, baseRevisions: { outcomes: revs.outcomes } });
  assert.equal(forgedSave.status, 200, JSON.stringify(forgedSave.body)); assert.equal((await statementsOf(syllabusId)).outcomes.pos[1].text, pendingText, 'a forged save cannot replace the stored statements');
  const adoptBySave = JSON.parse(JSON.stringify(untouched.outcomes)); adoptBySave.pos = after.standards.pos;
  const revs2 = (await call('faculty', 'GET', `/syllabi/${syllabusId}/content`)).body.revisions;
  await call('faculty', 'PUT', `/syllabi/${syllabusId}/content`, { sections: { outcomes: adoptBySave }, schemaVersion: 3, baseRevisions: { outcomes: revs2.outcomes } });
  assert.equal((await statementsOf(syllabusId)).outcomes.pos[1].text, pendingText, 'sending the updated statements in a save is not an adoption either');
  const stillRefused = await recheck(syllabusId); assert.equal(stillRefused.status, 409); assert.equal(stillRefused.body.code, 'po_reference_review_required');
  // the review shows both statements, and the confirmation must match what was shown
  const review = await reviewOf(syllabusId);
  assert.equal(review.body.pending, true); assert.deepEqual(review.body.changes.map((c) => c.no), [2]); assert.equal(review.body.changes[0].before, pendingText); assert.ok(review.body.changes[0].after.includes('(revised)'));
  assert.equal(review.body.reviewedSha256, require(path.join(ROOT, 'server/lib/programPoReferences')).hashOutcomes(after.standards.pos), 'the hash is of the statements the server resolved');
  assert.equal(review.body.changes[0].clos.join(), 'CLO 2', 'the review names the CLOs mapped to the changed PO'); assert.equal(review.body.references.updated.id, v2.id);
  const wrong = await adoptReview(syllabusId, 'f'.repeat(64)); assert.equal(wrong.status, 409); assert.equal(wrong.body.code, 'po_review_changed');
  const unconfirmed = await adoptReview(syllabusId, review.body.reviewedSha256, false); assert.equal(unconfirmed.status, 400); assert.equal(unconfirmed.body.code, 'po_review_confirmation_required');
  assert.equal((await adoptReview(syllabusId, 'not-a-hash')).status, 400);
  assert.equal((await statementsOf(syllabusId)).outcomes.pos[1].text, pendingText, 'no refused adoption changed anything');
  // the submission gate holds while the review is pending
  const submit = await call('faculty', 'POST', `/syllabi/${syllabusId}/submit`, {}); assert.notEqual(submit.status, 200, 'a syllabus waiting for its review cannot be submitted: ' + JSON.stringify(submit.body));
  assert.equal((await db.query('SELECT status FROM syllabi WHERE syllabus_id = ?', [syllabusId]))[0][0].status, 'draft');
  // nobody else can adopt
  assert.equal((await call('other', 'POST', '/auth/login', { email: 'e2e.other@e2e.invalid', password: PASSWORD })).status, 200);
  assert.equal((await call('other', 'POST', `/syllabi/${syllabusId}/po-review/adopt`, { reviewedSha256: review.body.reviewedSha256, confirm: true })).status, 404, 'another faculty member cannot see it, or adopt for it');
  assert.equal((await call('other', 'GET', `/syllabi/${syllabusId}/po-review`)).status, 404);
  assert.equal((await call('admin', 'POST', `/syllabi/${syllabusId}/po-review/adopt`, { reviewedSha256: review.body.reviewedSha256, confirm: true })).status === 200, false, 'only the author can adopt');
  const mappingsBefore = JSON.stringify((await statementsOf(syllabusId)).clos.map((c) => c.pos)), planBefore = JSON.stringify((await statementsOf(syllabusId)).plan);
  const adopted = await adoptReview(syllabusId, review.body.reviewedSha256); assert.equal(adopted.status, 200, JSON.stringify(adopted.body));
  const adoptedContent = await statementsOf(syllabusId);
  assert.ok(adoptedContent.outcomes.pos[1].text.includes('(revised)'), 'the adopted statements are the server\'s'); assert.equal(JSON.stringify(adoptedContent.clos.map((c) => c.pos)), mappingsBefore, 'the CLO-PO mappings are preserved'); assert.equal(JSON.stringify(adoptedContent.plan), planBefore);
  assert.equal(adoptedContent.outcomes.poReference.id, v2.id);
  assert.equal((await reviewOf(syllabusId)).body.pending, false); assert.equal((await adoptReview(syllabusId, review.body.reviewedSha256)).body.code, 'po_review_not_pending');
  assert.ok((await overview(programId)).changes.some((c) => c.action === 'faculty_adopted' && c.next.id === v2.id), 'the change log records the adoption');
  assert.equal((await db.query('SELECT report_json FROM syllabus_check_reports WHERE run_id = ?', [reportBefore.run_id]))[0][0].report_json, reportBefore.report_json, 'the saved report is still byte-identical');

  // the check uses the new version, its report says so, and judgments made under the old version are not reused
  const second = await recheck(syllabusId); assert.equal(second.status, 200, JSON.stringify(second.body));
  const run = second.body.run;
  assert.equal(run.hybrid.referenceContext.po.reference.id, v2.id); assert.equal(run.hybrid.referenceContext.po.reference.version, v2.version); assert.equal(run.hybrid.referenceContext.po.reference.contentSha256, v2.sha256);
  assert.ok(poRel(run).length > 0 && poRel(run).every((x) => x.reused === false && x.status !== 'NOT_CHECKED'), 'every CLO-PO relationship is asked again under the new version: ' + JSON.stringify(poRel(run).map((x) => [x.id, x.reused, x.status])));
  assert.deepEqual(run.hybrid.ruleCoverage.rules.filter((x) => x.ruleId === 'P-03').map((x) => x.status), ['NOT_CHECKED'], 'no PO-to-EGA crosswalk is invented'); assert.equal(run.passThreshold, 79);
  const third = (await recheck(syllabusId)).body.run;
  assert.ok(poRel(third).every((x) => x.reused === true), 'an unchanged re-check reuses them');
});

test('Review and adopt: an update made after the author opened the review is refused and shown again; a removed PO that is still mapped blocks adoption; the mapping is kept', async () => {
  await restart();
  const egas = [{ no: 1, name: 'Race competence', short: 'R1' }], pos = [1, 2, 3, 4].map((no) => ({ no, short: 'RPO ' + no, text: 'Race: outcome number ' + no + ' of the synthetic program.', egas: [1] }));
  const made = await call('admin', 'POST', '/courses', { code: 'ZR 101', title: 'Race Programming', program: 'ZZRACE', programName: 'BS Race Computing (synthetic program)', outcomes: { egas, pos } }); assert.equal(made.status, 200, JSON.stringify(made.body));
  const programId = made.body.program.id, [[fac]] = await db.query('SELECT user_id FROM users WHERE email = ?', ['e2e.faculty@e2e.invalid']); await db.query('INSERT INTO faculty_courses (user_id, course_id) VALUES (?, ?)', [fac.user_id, made.body.id]);
  const content = contentFor({ courseId: made.body.id, code: 'ZR 101', title: 'Race Programming', program: 'ZZRACE', egas, pos, curriculumYear: 'race-2026', cloPos: [[1], [2], [3], [4]] });
  const id = (await call('faculty', 'POST', '/syllabi/drafts')).body.id; assert.equal((await putContent(id, content)).status, 200);
  const save = async (next) => { const cur = (await call('admin', 'GET', `/programs/${programId}/outcomes`)).body; assert.equal((await call('admin', 'PUT', `/programs/${programId}/outcomes`, { pos: next(cur.pos), version: cur.versions.pos })).status, 200); assert.equal((await call('admin', 'POST', `/programs/${programId}/sync-subjects`)).status, 200); };
  await save((rows) => rows.map((p) => (p.no === 1 ? { ...p, text: p.text + ' First update.' } : p)));
  const seen = (await reviewOf(id)).body; assert.equal(seen.pending, true);
  await save((rows) => rows.map((p) => (p.no === 1 ? { ...p, text: p.text + ' Second update.' } : p)));
  const late = await adoptReview(id, seen.reviewedSha256); assert.equal(late.status, 409); assert.equal(late.body.code, 'po_review_changed');
  assert.ok(!(await statementsOf(id)).outcomes.pos[0].text.includes('update'), 'nothing was adopted');
  const fresh = (await reviewOf(id)).body; assert.ok(fresh.changes[0].after.includes('Second update.')); assert.equal((await adoptReview(id, fresh.reviewedSha256)).status, 200);
  assert.ok((await statementsOf(id)).outcomes.pos[0].text.includes('Second update.'));
  // the subject has no catalog CLO on PO 4, so the Admin can drop it, but this syllabus still maps it: the review says so and nothing is rewritten
  await save((rows) => rows.filter((p) => p.no !== 4));
  const removal = (await reviewOf(id)).body; assert.deepEqual(removal.missingMappings, [4]); assert.equal(removal.changes.find((c) => c.no === 4).after, null);
  const blocked = await adoptReview(id, removal.reviewedSha256); assert.equal(blocked.status, 409); assert.equal(blocked.body.code, 'po_review_mapping_missing'); assert.deepEqual(blocked.body.pos, [4]);
  assert.deepEqual((await statementsOf(id)).clos.map((c) => c.pos), [[1], [2], [3], [4]], 'the mapping is not rewritten');
  // choosing a different subject is not a review: that subject's outcomes apply, and the old subject's stored statements do not follow
  const other = await call('admin', 'POST', '/courses', { code: 'ZR 102', title: 'Race Later', program: 'ZZRACE' }); assert.equal(other.status, 200, JSON.stringify(other.body));
  await db.query('INSERT INTO faculty_courses (user_id, course_id) VALUES (?, ?)', [fac.user_id, other.body.id]);
  const before = await call('faculty', 'GET', `/syllabi/${id}/content`);
  const moved = await call('faculty', 'PUT', `/syllabi/${id}/content`, { sections: { meta: { ...before.body.content.meta, courseId: other.body.id, code: 'ZR 102' }, clos: [], plan: before.body.content.plan.map((row) => ({ ...row, ilos: row.ilos.map((il) => ({ ...il, tags: [] })) })), outcomes: before.body.content.outcomes }, schemaVersion: 3, baseRevisions: { meta: before.body.revisions.meta, clos: before.body.revisions.clos, plan: before.body.revisions.plan, outcomes: before.body.revisions.outcomes } });
  assert.equal(moved.status, 200, JSON.stringify(moved.body)); assert.deepEqual((await statementsOf(id)).outcomes.pos.map((p) => p.no), [1, 2, 3], 'the new subject has three POs');
});
test('Inheritance: a specialization follows its source program with no Apply, but its mapped syllabus keeps its statements until its author adopts them', async () => {
  await restart();
  const egas = [{ no: 1, name: 'Base competence', short: 'B1' }, { no: 2, name: 'Base thinking', short: 'B2' }], pos = [1, 2, 3, 4].map((no) => ({ no, short: 'BPO ' + no, text: 'Base: outcome number ' + no + ' of the synthetic source program.', egas: [1] }));
  const base = await call('admin', 'POST', '/courses', { code: 'ZB 101', title: 'Base Programming', program: 'ZZBASE', programName: 'BS Base Computing (synthetic program)', outcomes: { egas, pos } }); assert.equal(base.status, 200, JSON.stringify(base.body));
  const baseId = base.body.program.id, [spec] = await db.query('INSERT INTO programs (code, name, academic_year) VALUES (?, ?, ?)', ['ZZBASE-SPEC', 'BS Base Computing - Specialization (synthetic)', YEAR1]);
  await db.query('INSERT INTO program_outcome_sources (program_id, source_program_id, specialization) VALUES (?, ?, ?)', [spec.insertId, baseId, 'Specialization']);
  for (const e of egas) await db.query('INSERT INTO program_egas (program_id, ega_no, name, short_name) VALUES (?, ?, ?, ?)', [spec.insertId, e.no, e.name, e.short]);
  const c = await call('admin', 'POST', '/courses', { code: 'ZS 101', title: 'Specialized Programming', program: 'ZZBASE-SPEC' }); assert.equal(c.status, 200, JSON.stringify(c.body));
  const [[fac]] = await db.query('SELECT user_id FROM users WHERE email = ?', ['e2e.faculty@e2e.invalid']); await db.query('INSERT INTO faculty_courses (user_id, course_id) VALUES (?, ?)', [fac.user_id, c.body.id]);
  const cur = await call('admin', 'POST', '/syllabus-check/references', { program: 'ZZBASE', curriculumYear: 'base-2026', source: 'synthetic test curriculum', courses: [{ code: 'ZS 101', title: 'Specialized Programming', prereq: 'ZZ 100 - Prerequisite', lecture: 2, lab: 1, yearLevel: 2 }] });
  assert.equal((await call('admin', 'POST', `/syllabus-check/references/${cur.body.id}/approve`, { confirmedAgainstSource: true })).status, 200);
  const content = contentFor({ courseId: c.body.id, code: 'ZS 101', title: 'Specialized Programming', program: 'ZZBASE-SPEC', egas, pos, curriculumYear: 'base-2026', cloPos: [[1], [2], [3], [4]] });
  const id = (await call('faculty', 'POST', '/syllabi/drafts')).body.id; assert.equal((await putContent(id, content)).status, 200);
  const first = await recheck(id); assert.equal(first.status, 200, JSON.stringify(first.body)); assert.equal(first.body.run.hybrid.referenceContext.po.source, 'ZZBASE');
  const [[reportBefore]] = await db.query('SELECT r.run_id, r.report_json FROM syllabus_check_reports r JOIN ai_check_runs a ON a.run_id = r.run_id WHERE a.syllabus_id = ? ORDER BY r.run_id DESC LIMIT 1', [id]);
  const was = (await call('admin', 'GET', `/programs/${baseId}/outcomes`)).body;
  assert.equal((await call('admin', 'PUT', `/programs/${baseId}/outcomes`, { pos: was.pos.map((p) => (p.no === 2 ? { ...p, text: p.text + ' (revised)' } : p)), version: was.versions.pos })).status, 200);
  const v2 = (await overview(baseId)).active;
  assert.ok((await call('faculty', 'GET', `/courses/${c.body.id}`)).body.standards.pos[1].text.includes('(revised)'), 'the specialization subject follows its source with no Apply');
  for (const section of ['refs', 'plan']) { assert.equal((await saveOnly(id, section)).status, 200); assert.ok(!(await statementsOf(id)).outcomes.pos[1].text.includes('(revised)'), 'saving only ' + section + ' keeps the stored statements'); }
  const refused = await recheck(id); assert.equal(refused.status, 409); assert.equal(refused.body.code, 'po_reference_review_required');
  const review = (await reviewOf(id)).body; assert.equal(review.pending, true); assert.equal((await adoptReview(id, review.reviewedSha256)).status, 200);
  const after = await recheck(id); assert.equal(after.status, 200, JSON.stringify(after.body));
  const run = after.body.run; assert.equal(run.hybrid.referenceContext.po.reference.id, v2.id); assert.equal(run.hybrid.referenceContext.po.source, 'ZZBASE');
  assert.ok(poRel(run).length > 0 && poRel(run).every((x) => x.reused === false && x.status !== 'NOT_CHECKED'), 'every CLO-PO relationship is judged again: ' + JSON.stringify(poRel(run).map((x) => [x.id, x.reused, x.status])));
  assert.equal((await db.query('SELECT report_json FROM syllabus_check_reports WHERE run_id = ?', [reportBefore.run_id]))[0][0].report_json, reportBefore.report_json, 'the earlier report is byte-identical');
});

// ---------------- 6, 10. a second new program with a different PO count; generic inheritance ----------------
test('6, 10. a second new program with 3 POs is evaluated from its own database rows (a different PO count)', async () => {
  await restart();
  const egas = [{ no: 1, name: 'Omega one', short: 'Om1' }, { no: 2, name: 'Omega two', short: 'Om2' }];
  const pos = [{ no: 1, short: 'OPO 1', text: 'Omega: apply computing knowledge to well-defined problems.', egas: [1] }, { no: 2, short: 'OPO 2', text: 'Omega: design and evaluate computing solutions.', egas: [1, 2] }, { no: 3, short: 'OPO 3', text: 'Omega: communicate technical work clearly.', egas: [2] }];
  const c = await call('admin', 'POST', '/courses', { code: 'ZO 201', title: 'Omega Programming', program: 'ZZTWO', programName: 'BS Omega Computing (synthetic program)', outcomes: { egas, pos } }); assert.equal(c.status, 200, JSON.stringify(c.body));
  const [[fac]] = await db.query('SELECT user_id FROM users WHERE email = ?', ['e2e.faculty@e2e.invalid']); await db.query('INSERT INTO faculty_courses (user_id, course_id) VALUES (?, ?)', [fac.user_id, c.body.id]);
  const cur = await call('admin', 'POST', '/syllabus-check/references', { program: 'ZZTWO', curriculumYear: 'omega-2026', source: 'synthetic test curriculum', courses: [{ code: 'ZO 201', title: 'Omega Programming', prereq: 'ZZ 100 - Prerequisite', lecture: 2, lab: 1, yearLevel: 2 }] });
  assert.equal((await call('admin', 'POST', `/syllabus-check/references/${cur.body.id}/approve`, { confirmedAgainstSource: true })).status, 200);
  const content = contentFor({ courseId: c.body.id, code: 'ZO 201', title: 'Omega Programming', program: 'ZZTWO', egas, pos, curriculumYear: 'omega-2026', cloPos: [[1], [2], [3], [3]] });
  const d = await call('faculty', 'POST', '/syllabi/drafts'); assert.equal((await putContent(d.body.id, content)).status, 200);
  const run = (await recheck(d.body.id)).body.run, m = await repo.mastersFor(db, { meta: { program: 'ZZTWO' } }, {});
  assert.equal(m.pos.length, 3, 'the PO count comes from the database');
  assert.ok(poRel(run).length >= 4 && poRel(run).every((x) => x.status !== 'NOT_CHECKED'), 'every CLO-PO relationship of the 3-PO program is evaluated: ' + JSON.stringify(poRel(run).map((x) => [x.id, x.status])));
  assert.equal(run.hybrid.referenceContext.po.reference.contentSha256 !== undefined, true);
  S.omegaProgram = c.body.program.id;
});
test('16b. a specialization inherits its POs through program_outcome_sources (data), with no fixed program list', async () => {
  const [r] = await db.query('INSERT INTO programs (code, name, academic_year) VALUES (?, ?, ?)', ['ZZSPEC', 'BS Zeta Computing - Specialization', YEAR1]);
  await db.query('INSERT INTO program_outcome_sources (program_id, source_program_id, specialization) VALUES (?, ?, ?)', [r.insertId, S.programId, 'Specialization']);
  const m = await repo.mastersFor(db, { meta: { program: 'ZZSPEC' } }, {});
  assert.equal(m.outcomeSource, 'ZZNEW'); assert.equal(m.pos.length, 5); assert.equal(m.poReference.id, S.v2.id);
  const ctx = plan.plan(contentFor({ courseId: 1, code: 'X 1', title: 'T', program: 'ZZSPEC', egas: EGAS, pos: m.pos, curriculumYear: 'x', cloPos: [[1], [2], [3], [4]] }), m);
  assert.equal(ctx.reference.poUsable, true, JSON.stringify(ctx.reference.issues)); assert.equal(ctx.reference.poSource, 'ZZNEW');
  assert.equal((await call('admin', 'PUT', `/programs/${r.insertId}/outcomes`, { pos: POS, version: 1 })).status >= 400, true, 'a specialization cannot save its own outcomes');
});
test('14c. the original four programs follow the same path: an Admin save supersedes the source version, BSIT-Cyber Security follows BSIT, and BSIE and BSCpE are untouched', async () => {
  const [[bsit]] = await db.query("SELECT program_id FROM programs WHERE code = 'BSIT'"), [[cyber]] = await db.query("SELECT program_id FROM programs WHERE code = 'BSIT-CYBERSECURITY'");
  const cur = (await call('admin', 'GET', `/programs/${bsit.program_id}/outcomes`)).body;
  const revised = cur.pos.map((p) => (p.no === 1 ? { ...p, text: p.text + ' (synthetic revision)' } : p));
  const saved = await call('admin', 'PUT', `/programs/${bsit.program_id}/outcomes`, { pos: revised, version: cur.versions.pos }); assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const m = await repo.mastersFor(db, { meta: { program: 'BSIT' } }, {});
  assert.equal(m.poReference.kind, 'admin_published'); assert.ok(m.pos[0].text.includes('synthetic revision')); assert.equal(m.pos.length, 9);
  const { inheritStandards } = require(path.join(ROOT, 'server/lib/programs'));
  const stale = await inheritStandards(db, bsit.program_id, { vision: '', mission: {}, egas: [], pos: [{ no: 1, short: 'Old', text: 'A copy from before the source version.', egas: [] }], versions: {} });
  assert.equal(stale.poReference.id, 'lcup-po-2026-10-29-BSIT', 'a subject read through the source version stays on it until Apply to Subjects'); assert.equal(stale.pos.length, 9); assert.ok(!stale.pos[0].text.includes('synthetic revision'));
  const [[source]] = await db.query("SELECT status, outcomes_json FROM program_po_reference_versions WHERE reference_id = 'lcup-po-2026-10-29-BSIT'");
  assert.equal(source.status, 'superseded'); assert.ok(!source.outcomes_json.includes('synthetic revision'), 'the source version is preserved');
  const c = await repo.mastersFor(db, { meta: { program: 'BSIT-CYBERSECURITY' } }, {});
  assert.equal(c.outcomeSource, 'BSIT'); assert.equal(c.poReference.id, m.poReference.id); assert.equal(c.pos.length, 9); assert.equal(c.referenceContext.curriculum.source, 'BSIT-CYBERSECURITY', 'its own curriculum (owner policy 2026-11-09): only the POs follow BSIT');
  const spec = await inheritStandards(db, cyber.program_id, { vision: '', mission: {}, egas: [], pos: [], versions: {} }, { code: 'BSIT-CYBERSECURITY' });
  assert.equal(spec.poReference.id, m.poReference.id, 'a specialization has no outcomes of its own: its subjects follow its source program'); assert.equal(spec.curriculumSource, undefined, 'outcome inheritance carries no curriculum');
  assert.equal((await call('admin', 'PUT', `/programs/${cyber.program_id}/outcomes`, { pos: revised, version: 1 })).status >= 400, true, 'Cyber Security edits nothing of its own');
  assert.equal((await repo.mastersFor(db, { meta: { program: 'BSIE' } }, {})).poReference.kind, 'official_source'); assert.equal((await repo.mastersFor(db, { meta: { program: 'BSCPE' } }, {})).poReference.kind, 'official_source');
});

// ---------------- 6b. academic year applicability ----------------
test('new academic year: a copied catalog keeps using the same version with no copy of it; saving there makes that year its own version; a syllabus keeps the version of its own year', async () => {
  const [[counts]] = await db.query('SELECT COUNT(*) AS n FROM program_po_reference_versions');
  assert.equal((await call('admin', 'POST', '/academic-years', { label: YEAR2, startYear: 2027 })).status, 200);
  assert.equal((await call('admin', 'PUT', '/academic-years/current', { label: YEAR2 })).status, 200);
  assert.equal((await call('admin', 'POST', '/academic-years/copy-catalog', {})).status, 200);
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM program_po_reference_versions'))[0][0].n, counts.n, 'no version was duplicated');
  const [rows] = await db.query("SELECT program_id, academic_year FROM programs WHERE code = 'ZZNEW' ORDER BY program_id"); assert.equal(rows.length, 2);
  const [y1, y2] = rows; S.years = { y1, y2 };
  const v = await overview(y2.program_id);
  assert.equal(v.active.id, S.v2.id, 'the new year uses the version it was copied from'); assert.equal(v.active.association, 'adopted'); assert.equal(v.program.academicYear, YEAR2);
  assert.deepEqual(v.active.appliesTo.map((x) => [x.academicYear, x.association]).sort(), [[YEAR1, 'owner'], [YEAR2, 'adopted']]);
  assert.match(v.active.associationNote, /Copied with the catalog/); assert.equal((await auditRows(y2.program_id, 'copied')).length, 1);
  const inherited = await db.query("SELECT p.program_id, p.academic_year FROM programs p WHERE p.code = 'BSIT-CYBERSECURITY' ORDER BY p.program_id");
  assert.equal((await repo.mastersFor(db, { meta: { program: 'BSIT-CYBERSECURITY' } }, {})).outcomeSource, 'BSIT', 'the inheritance survives the copy (' + inherited[0].length + ' rows)');
  const m1 = await repo.mastersFor(db, S.content, { syllabusId: S.syllabusId });
  assert.equal(m1.referenceContext.program.academicYear, YEAR1); assert.equal(m1.poReference.id, S.v2.id);
  assert.equal((await call('admin', 'PUT', `/programs/${y1.program_id}/outcomes`, { pos: POS, version: 99 })).status, 403, 'a past academic year is read-only');
  const cur = (await call('admin', 'GET', `/programs/${y2.program_id}/outcomes`)).body;
  const revised = cur.pos.map((p) => (p.no === 2 ? { ...p, text: p.text + ' (revised for the new year)' } : p));
  assert.equal((await call('admin', 'PUT', `/programs/${y2.program_id}/outcomes`, { pos: revised, version: cur.versions.pos })).status, 200);
  const after = await overview(y2.program_id);
  assert.equal(after.active.version, 'ZZNEW-2027–2028-v1'); assert.equal(after.active.association, 'owner');
  const [[kept]] = await db.query('SELECT status FROM program_po_reference_versions WHERE reference_id = ?', [S.v2.id]); assert.equal(kept.status, 'published', 'the version in force in the earlier year is not superseded from the new year');
  const [[a1]] = await db.query('SELECT reference_id FROM program_po_reference_active WHERE program_id = ?', [y1.program_id]); assert.equal(a1.reference_id, S.v2.id);
  const diff = (await call('admin', 'GET', `/programs/${y2.program_id}/po-reference/compare?from=${S.v2.id}&to=active`)).body; assert.deepEqual(diff.changed.map((c) => c.no), [2]);
  assert.equal((await repo.mastersFor(db, S.content, { syllabusId: S.syllabusId })).poReference.id, S.v2.id, 'a syllabus of the earlier year still resolves that year');
});

// ---------------- 20. optimization flags ON/OFF: the same official result and the same CLO-PO outcomes ----------------
test('20. recommended optimization flags change nothing about the official result or the reference handling', async () => {
  // a fresh server for each configuration also resets the app's own limit of 10 checks a minute per user
  api.kill(); await new Promise((r) => setTimeout(r, 1500)); api = launch(); await waitFor(BASE + '/api/health', 60000); cookies = {}; await login();
  // The syllabus belongs to the earlier year; test 19 made the later year active. Policy (RC14): a new check only for the active academic year, so it is refused first, then its year is activated for this comparison and the later year is restored at the end.
  const refused = await recheck(S.syllabusId); assert.equal(refused.status, 409, JSON.stringify(refused.body)); assert.equal(refused.body.code, 'inactive_academic_year');
  assert.equal((await call('admin', 'PUT', '/academic-years/current', { label: YEAR1 })).status, 200);
  const off = (await recheck(S.syllabusId)); assert.equal(off.status, 200, JSON.stringify(off.body));
  api.kill(); await new Promise((r) => setTimeout(r, 1500));
  api = launch({ SYLLABUS_CHECK_CACHE_WARMUP: 'on', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped', SYLLABUS_CHECK_REUSE: 'off' }); await waitFor(BASE + '/api/health', 60000); cookies = {}; await login();
  const on = await recheck(S.syllabusId); assert.equal(on.status, 200, JSON.stringify(on.body));
  assert.equal(official1(on.body.run), official1(off.body.run), 'official score, status, threshold and areas identical');
  assert.deepEqual(poRel(on.body.run).map((x) => [x.id, x.status]), poRel(off.body.run).map((x) => [x.id, x.status]));
  assert.equal(on.body.run.hybrid.referenceContext.po.reference.id, off.body.run.hybrid.referenceContext.po.reference.id);
  assert.equal(on.body.run.passThreshold, 79);
  assert.equal((await call('admin', 'PUT', '/academic-years/current', { label: YEAR2 })).status, 200, 'the later year is active again for the tests that follow');
});

// ---------------- academic-year reuse, comparison and history ----------------
test('compare: the Admin sees exactly what differs between the earlier and the later version; faculty cannot', async () => {
  const diff = (await call('admin', 'GET', `/programs/${S.programId}/po-reference/compare?from=${S.v1.id}&to=${S.v2.id}`)).body;
  assert.deepEqual(diff.changed.map((c) => [c.no, c.fields.sort()]), [[5, ['egas', 'text']]]); assert.equal(diff.added.length + diff.removed.length, 0); assert.equal(diff.unchanged, 4); assert.equal(diff.identical, false);
  assert.equal((await call('admin', 'GET', `/programs/${S.programId}/po-reference/compare?from=active&to=live`)).body.identical, true, 'the live rows equal the version in force');
  assert.equal((await call('faculty', 'GET', `/programs/${S.programId}/po-reference/compare?from=active&to=live`)).status, 403);
  assert.equal((await call('admin', 'GET', `/programs/${S.programId}/po-reference/compare?from=nope&to=active`)).status, 404);
});
test('academic-year reuse: a version of the same program in another year can be used again, not copied, when the statements match; its identity and hash stay as saved', async () => {
  const [rows] = await db.query("SELECT program_id, academic_year FROM programs WHERE code = 'ZZTWO' ORDER BY program_id"); assert.equal(rows.length, 2, 'the copied catalog has a ZZTWO row for the new year');
  const [y1, y2] = rows, [[owned]] = await db.query('SELECT * FROM program_po_reference_versions WHERE program_id = ? AND status = ?', [y1.program_id, 'published']);
  const url = (p, s) => `/programs/${p}/po-reference${s}`;
  assert.equal((await overview(y2.program_id)).active.id, owned.reference_id, 'the copy already uses it');
  const cur = (await call('admin', 'GET', `/programs/${y2.program_id}/outcomes`)).body, original = cur.pos;
  const revised = original.map((p) => (p.no === 3 ? { ...p, text: p.text + ' (revised for the new year)' } : p));
  const one = await call('admin', 'PUT', `/programs/${y2.program_id}/outcomes`, { pos: revised, version: cur.versions.pos }); assert.equal(one.status, 200, JSON.stringify(one.body));
  assert.equal((await overview(y2.program_id)).active.version, 'ZZTWO-2027–2028-v1');
  const [[still]] = await db.query('SELECT status FROM program_po_reference_versions WHERE reference_id = ?', [owned.reference_id]); assert.equal(still.status, 'published', 'the version still in force in the owner year is not superseded from another year');
  const mismatch = await call('admin', 'POST', url(y2.program_id, '/adopt'), { referenceId: owned.reference_id }); assert.equal(mismatch.status, 409); assert.equal(mismatch.body.code, 'po_reference_adopt_mismatch');
  const cand = (await call('admin', 'GET', url(y2.program_id, '/candidates'))).body.candidates; assert.equal(cand.length, 1); assert.equal(cand[0].id, owned.reference_id); assert.equal(cand[0].ownerYear, YEAR1); assert.equal(cand[0].identicalToLiveRows, false);
  const two = await call('admin', 'PUT', `/programs/${y2.program_id}/outcomes`, { pos: original, version: one.body.versions.pos }); assert.equal(two.status, 200, JSON.stringify(two.body));
  assert.equal((await overview(y2.program_id)).active.version, 'ZZTWO-2027–2028-v2', 'going back to the old wording is one more version');
  const before = (await db.query('SELECT COUNT(*) AS n FROM program_po_reference_versions'))[0][0].n;
  assert.equal((await call('faculty', 'POST', url(y2.program_id, '/adopt'), { referenceId: owned.reference_id })).status, 403);
  const other = await call('admin', 'POST', url(y2.program_id, '/adopt'), { referenceId: S.v2.id }); assert.equal(other.status, 409); assert.equal(other.body.code, 'po_reference_other_program');
  assert.equal((await call('admin', 'POST', url(y1.program_id, '/adopt'), { referenceId: owned.reference_id })).status, 403, 'a past academic year catalog is view only');
  const a = await call('admin', 'POST', url(y2.program_id, '/adopt'), { referenceId: owned.reference_id }); assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.association, 'adopted'); assert.equal(a.body.sha256, owned.source_sha256); assert.equal(a.body.ownerYear, YEAR1);
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM program_po_reference_versions'))[0][0].n, before, 'no version was copied or created');
  const [[after]] = await db.query('SELECT * FROM program_po_reference_versions WHERE reference_id = ?', [owned.reference_id]);
  assert.equal(after.outcomes_json, owned.outcomes_json); assert.equal(after.academic_year, YEAR1); assert.equal(after.published_by, owned.published_by);
  const m = await repo.mastersFor(db, { meta: { program: 'ZZTWO' } }, {});
  assert.equal(m.poReference.id, owned.reference_id); assert.equal(m.poReference.association, 'adopted'); assert.equal(m.referenceContext.program.academicYear, YEAR2); assert.equal(m.pos.length, 3);
  assert.equal((await auditRows(y2.program_id, 'adopted')).at(-1).details.next.sha256, owned.source_sha256);
});
test('a saved report is never rewritten by anything above', async () => {
  const [all] = await db.query('SELECT report_json FROM syllabus_check_reports ORDER BY run_id LIMIT 1');
  assert.ok(all[0].report_json.includes(S.v1.id) || all[0].report_json.length > 0); assert.ok(!all[0].report_json.includes('revised wording'), 'the first report still reads as it was saved');
});
