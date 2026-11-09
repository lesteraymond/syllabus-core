'use strict';
// Audit: can the CURRENT AI Checker consume Admin-managed programs and references dynamically?
// Drives the real Express API (server/index.js) with a SCRIPTED Claude double on an ISOLATED synthetic database (port 43310, name contains "e2e", DDL blocked, no migration):
//   1. control   the seeded synthetic program (BSIT) and its syllabus,
//   2. new       an Admin creates a NEW program (ZZNEW, not in any list), its EGAs and POs, and subject; a curriculum reference is created and approved; a syllabus is checked,
//   3. edit      the Admin edits a PO; the same unchanged syllabus is checked again; the first saved report is compared,
//   4. year      the Admin creates a NEW academic year and copies the catalog; the new year's program is edited; the old year is compared.
// Nothing here changes any rule, score or reference of a real database. Output: docs/release-candidate/dynamic-reference-audit[-<label>].json
//   node scripts/release/dynamic-reference-audit.cjs [--root <repo root or snapshot>] [--label name]
const path = require('node:path'), fs = require('node:fs');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', path.resolve(__dirname, '../..'))), OUTROOT = path.resolve(__dirname, '../..'), label = arg('label', '');
process.chdir(ROOT);
process.env.E2E_DB_PORT = '43310'; process.env.E2E_DB_NAME = 'syllabus_e2e_po_1105_regression'; process.env.E2E_SKIP_BOOTSTRAP = '1'; process.env.E2E_NO_DDL = '1';
require(path.join(ROOT, 'scripts/e2e/db-port-redirect.cjs'));
const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
const { seed, ACCOUNTS, PASSWORD } = require(path.join(ROOT, 'scripts/e2e/seed-e2e.cjs'));
const { startApi, waitFor } = require(path.join(ROOT, 'scripts/e2e/stack.cjs'));
const { sample } = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/harness'));
const DB = process.env.E2E_DB_NAME, FRONT = 'https://localhost:3644', PORT = 3425, BASE = `http://127.0.0.1:${PORT}`;
const out = { kind: 'OFFLINE audit: scripted Claude double, isolated synthetic database, no network, no migration', root: ROOT, at: new Date().toISOString(), findings: [], steps: {} };
const find = (id, verdict, text, evidence) => { out.findings.push({ id, verdict, text, ...(evidence !== undefined ? { evidence } : {}) }); console.log(`${verdict.padEnd(8)} ${id}  ${text}`); };

(async () => {
  const admin = await mysql.createConnection({ host: '127.0.0.1', port: 43310, user: 'root', password: '', database: DB });
  const [[idn]] = await admin.query('SELECT @@port AS port, @@max_allowed_packet AS pk');
  if (idn.port !== 43310) throw Error('not the isolated server');
  await admin.query('SET FOREIGN_KEY_CHECKS=0');
  const [tables] = await admin.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  for (const t of tables) await admin.query('DELETE FROM ??', [t.name]);
  await admin.query('SET FOREIGN_KEY_CHECKS=1');
  await admin.query('INSERT INTO academic_years(label,start_year,is_current) VALUES(?,?,1)', ['2026–2027', 2026]);
  const seeded = await seed({ host: '127.0.0.1', port: 43310, user: 'root', password: '', database: DB });
  const work = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'dyn-audit-'));
  const control = path.join(work, 'mode.txt'); fs.writeFileSync(control, 'ok');
  const api = startApi({ port: PORT, work, front: FRONT, control, providerLog: path.join(work, 'p.jsonl'), serverLog: path.join(work, 'api.log'),
    extraEnv: { E2E_DB_PORT: '43310', SYLLABUS_CHECK_PROFILE: 'comprehensive-testing', SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_AI_MAX_COST_USD: '100' } });
  const cookies = {};
  const call = async (who, method, url, body) => {
    const r = await fetch(BASE + '/api' + url, { method, headers: { 'Content-Type': 'application/json', Origin: FRONT, 'X-Forwarded-Proto': 'https', ...(cookies[who] ? { Cookie: cookies[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch { /* none */ }
    if (url === '/auth/login') cookies[who] = (r.headers.getSetCookie() || []).map((c) => c.split(';')[0]).filter((c) => c.startsWith('connect.sid')).join('; ');
    return { status: r.status, body: j };
  };
  const putContent = async (who, id, sections) => {
    const cur = await call(who, 'GET', `/syllabi/${id}/content`);
    const base = Object.fromEntries(Object.keys(sections).map((k) => [k, (cur.body.revisions || {})[k]]));
    return call(who, 'PUT', `/syllabi/${id}/content`, { sections, schemaVersion: 3, baseRevisions: base });
  };
  try {
    await waitFor(BASE + '/api/health', 60000);
    for (const [who, email] of [['admin', 'e2e.admin@e2e.invalid'], ['faculty', 'e2e.faculty@e2e.invalid']]) { const l = await call(who, 'POST', '/auth/login', { email, password: PASSWORD }); if (l.status !== 200) throw Error('login ' + who + ' ' + l.status); }
    const s0 = sample(), sections = (c) => Object.fromEntries(['clos', 'plan', 'reqs', 'refs', 'grading', 'outcomes', 'meta', 'description'].filter((k) => c[k] !== undefined).map((k) => [k, c[k]]));
    const v2Of = (run) => (run.hybrid.academicV2 && run.hybrid.academicV2.academic) || {};
    const summarize = (run) => {
      const rel = (v2Of(run).relationships || []), by = (re) => rel.filter((r) => re.test(r.relationshipType));
      const po = by(/^CLO-(PO|anyPO)$/);
      return { overall: run.overall, status: run.status, passed: run.passed, threshold: run.passThreshold,
        v2: { relationships: rel.length, notChecked: rel.filter((r) => r.status === 'NOT_CHECKED').length, vpaaTypes: [...new Set(rel.map((r) => r.relationshipType))].length },
        cloPoV2: { count: po.length, notChecked: po.filter((r) => r.status === 'NOT_CHECKED').length, reasons: [...new Set(po.map((r) => r.explanation || r.reason || r.verification && r.verification.reason).filter(Boolean))].slice(0, 3) },
        legacyCloPo: ((run.hybrid.alignment && run.hybrid.alignment.judgements) || []).filter((j) => /^CLO-(PO|anyPO)$/.test(j.type)).length,
        reference: v2Of(run).reference ? { poUsable: v2Of(run).reference.poUsable, issues: (v2Of(run).reference.issues || []).map((i) => i.code), poVersion: v2Of(run).reference.poVersion, authorization: v2Of(run).reference.authorization, poSource: v2Of(run).reference.poSource } : null,
        referenceContext: run.hybrid.referenceContext || null, p03: ((run.hybrid.ruleCoverage || {}).rules || []).filter((r) => r.ruleId === 'P-03').map((r) => r.status),
        blocking: (run.findings || []).filter((f) => f.severity === 'blocking').map((f) => f.ruleId + ':' + String(f.message).slice(0, 80)), coverageCounts: (run.hybrid.ruleCoverage || {}).counts || null };
    };
    const recheck = async (who, id) => { const r = await call(who, 'POST', `/syllabi/${id}/compliance/recheck`, {}); return r; };

    // ---------------- 1. control: the seeded program ----------------
    const d1 = await call('faculty', 'POST', '/syllabi/drafts');
    await putContent('faculty', d1.body.id, sections(s0.content));
    const r1 = await recheck('faculty', d1.body.id);
    out.steps.control = { httpStatus: r1.status, ...(r1.body && r1.body.run ? summarize(r1.body.run) : { body: JSON.stringify(r1.body).slice(0, 300) }) };

    // ---------------- 2. new program created by the Admin ----------------
    const egas = [{ no: 1, name: 'Zeta competence', short: 'Zeta1' }, { no: 2, name: 'Zeta thinking', short: 'Zeta2' }, { no: 3, name: 'Zeta service', short: 'Zeta3' }];
    const pos = [
      { no: 1, short: 'ZPO 1', text: 'Zeta: apply knowledge of computing and mathematics to solve computing problems.', egas: [1] },
      { no: 2, short: 'ZPO 2', text: 'Zeta: analyze a problem and identify the computing requirements appropriate to its solution.', egas: [2] },
      { no: 3, short: 'ZPO 3', text: 'Zeta: design, implement and evaluate computing-based solutions to meet desired needs.', egas: [1, 2] },
      { no: 4, short: 'ZPO 4', text: 'Zeta: work effectively in teams and communicate clearly with technical and non-technical audiences.', egas: [3] },
      { no: 5, short: 'ZPO 5', text: 'Zeta: practice professional, ethical and socially responsible conduct in computing.', egas: [] }, // NO approved PO-EGA mapping: must be NOT_CHECKED, never invented
    ];
    const created = await call('admin', 'POST', '/courses', { code: 'ZZ 101', title: 'Zeta Programming Fundamentals', program: 'ZZNEW', programName: 'BS Zeta Computing (synthetic program)', outcomes: { egas, pos } });
    out.steps.createProgram = { status: created.status, body: created.status === 200 ? { id: created.body.id, programCreated: created.body.programCreated, program: created.body.program } : created.body };
    if (created.status !== 200) throw Error('program creation failed: ' + JSON.stringify(created.body).slice(0, 300));
    const courseId = created.body.id, programId = created.body.program && (created.body.program.id || created.body.program.program_id);
    const [[pr]] = await admin.query('SELECT program_id, code, pos_version, egas_version, academic_year FROM programs WHERE code = ?', ['ZZNEW']);
    out.steps.createProgram.dbProgram = pr;
    await admin.query('INSERT INTO faculty_courses (user_id, course_id) VALUES (?, ?)', [seeded.counts ? (await admin.query('SELECT user_id FROM users WHERE email = ?', ['e2e.faculty@e2e.invalid']))[0][0].user_id : 0, courseId]);
    const curricula0 = await call('admin', 'GET', '/syllabus-check/references');
    out.steps.curriculumBefore = { zzRows: (curricula0.body || []).filter((c) => c.program === 'ZZNEW').length };
    // the subject the Admin created does NOT create the approved curriculum the checker needs: say what the check does without it, then create and approve one
    const draftNew = await call('faculty', 'POST', '/syllabi/drafts');
    const content = JSON.parse(JSON.stringify(s0.content));
    Object.assign(content.meta, { courseId, code: 'ZZ 101', title: 'Zeta Programming Fundamentals', program: 'ZZNEW', curriculumYear: 'zeta-2026', prereq: 'ZZ 100 - Prerequisite', lecture: '2', lab: '1', yearLevel: '2' });
    content.outcomes = { vision: s0.masters.institution.vision, mission: s0.masters.institution.mission, egas: egas.map((e) => ({ ...e })), pos: pos.map((p) => ({ ...p })) };
    content.clos.forEach((c) => { c.pos = (c.pos || []).filter((n) => n <= 5); c.egas = (c.egas || []).filter((n) => n <= 3); });
    const put2 = await putContent('faculty', draftNew.body.id, sections(content));
    out.steps.saveNewProgramSyllabus = { status: put2.status, body: put2.status === 200 ? undefined : JSON.stringify(put2.body).slice(0, 300) };
    const noCur = await recheck('faculty', draftNew.body.id);
    out.steps.newProgramNoCurriculum = { httpStatus: noCur.status, ...(noCur.body && noCur.body.run ? summarize(noCur.body.run) : { body: JSON.stringify(noCur.body).slice(0, 300) }) };
    const ref = await call('admin', 'POST', '/syllabus-check/references', { program: 'ZZNEW', curriculumYear: 'zeta-2026', source: 'synthetic audit curriculum (not an official reference)', courses: [{ code: 'ZZ 101', title: 'Zeta Programming Fundamentals', prereq: 'ZZ 100 - Prerequisite', lecture: 2, lab: 1, yearLevel: 2 }] });
    const appr = ref.status === 201 ? await call('admin', 'POST', `/syllabus-check/references/${ref.body.id}/approve`, { confirmedAgainstSource: true }) : ref;
    out.steps.curriculumCreated = { createStatus: ref.status, approveStatus: appr.status, body: ref.status === 201 ? undefined : ref.body };
    const withCur = await recheck('faculty', draftNew.body.id);
    out.steps.newProgramWithCurriculum = { httpStatus: withCur.status, ...(withCur.body && withCur.body.run ? summarize(withCur.body.run) : { body: JSON.stringify(withCur.body).slice(0, 300) }) };
    const firstRunId = withCur.body && withCur.body.run && withCur.body.run.id;

    // 2b. variants: (i) the syllabus carries the INSTITUTION's EGAs (not the program's own), (ii) a CLO is tagged with PO 5, which has no approved PO-EGA mapping
    const dv = { body: { id: draftNew.body.id } }; // the same syllabus: its content is changed for this variant and restored afterwards
    const c2 = JSON.parse(JSON.stringify(content));
    c2.outcomes.egas = s0.masters.institution.egas.map((e) => ({ ...e }));
    c2.clos[0].pos = [1, 5]; c2.clos[0].egas = [1];
    const put3 = await putContent('faculty', dv.body.id, sections(c2));
    const var1 = await recheck('faculty', dv.body.id);
    out.steps.variantInstitutionEgasAndUnmappedPo = { saveStatus: put3.status, httpStatus: var1.status, ...(var1.body && var1.body.run ? summarize(var1.body.run) : { body: JSON.stringify(var1.body).slice(0, 300) }) };
    if (var1.body && var1.body.run) { const rr = ((var1.body.run.hybrid.ruleCoverage || {}).rules || []).filter((r) => r.ruleId === 'P-03'); out.steps.variantInstitutionEgasAndUnmappedPo.p03Detail = rr.map((r) => ({ status: r.status, verified: r.verified, reason: String(r.reason || '').slice(0, 140) })); }

    await putContent('faculty', draftNew.body.id, sections(content)); // restore the original content
    // ---------------- 3. the Admin edits a PO ----------------
    const [[beforeRep]] = await admin.query('SELECT report_json FROM syllabus_check_reports WHERE run_id = ?', [firstRunId]);
    const edited = pos.map((p) => (p.no === 1 ? { ...p, text: p.text + ' EDITED-BY-ADMIN' } : p));
    const edit = await call('admin', 'PUT', `/programs/${pr.program_id}/outcomes`, { pos: edited, version: pr.pos_version });
    out.steps.editPo = { status: edit.status, body: edit.status === 200 ? { versions: edit.body.versions, poReference: edit.body.poReference || null } : edit.body };
    const after = await recheck('faculty', draftNew.body.id);
    out.steps.recheckAfterPoEdit = { httpStatus: after.status, ...(after.body && after.body.run ? summarize(after.body.run) : { body: JSON.stringify(after.body).slice(0, 300) }) };
    const hist = await call('faculty', 'GET', `/compliance?syllabus=${draftNew.body.id}`);
    const stored = beforeRep && beforeRep.report_json ? JSON.parse(beforeRep.report_json) : null;
    out.steps.historicalReport = { firstRunId, oldReportStillHasOldPoText: !!stored && JSON.stringify(stored).includes('Zeta: apply knowledge') && !JSON.stringify(stored).includes('EDITED-BY-ADMIN'), oldReportRecordsPoVersion: !!(stored && stored.hybrid && stored.hybrid.referenceContext && stored.hybrid.referenceContext.po && stored.hybrid.referenceContext.po.reference), oldReportReferenceContext: stored && stored.hybrid && stored.hybrid.referenceContext && stored.hybrid.referenceContext.po, oldReportInstitutionVersion: stored && stored.hybrid && stored.hybrid.referenceContext && stored.hybrid.referenceContext.institution || null };
    const [poRows] = await admin.query('SELECT po_no, outcome_text FROM program_outcomes WHERE program_id = ? ORDER BY po_no', [pr.program_id]);
    const [verTables] = await admin.query("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND (TABLE_NAME LIKE '%po%version%' OR TABLE_NAME LIKE '%reference%' OR TABLE_NAME LIKE '%outcome%')");
    out.steps.poStorage = { livePo1: poRows[0] && poRows[0].outcome_text.slice(-20), tables: verTables.map((x) => x.t) };
    const [[subj]] = await admin.query('SELECT standards_json FROM courses WHERE course_id = ?', [courseId]);
    out.steps.subjectSnapshot = { subjectKeepsOwnSnapshot: !!subj.standards_json, snapshotStillHasOldPo1: !!subj.standards_json && JSON.stringify(JSON.parse(subj.standards_json).pos || []).includes('Zeta: apply knowledge') && !subj.standards_json.includes('EDITED-BY-ADMIN') };

    // ---------------- 4. a new academic year ----------------
    const yr = await call('admin', 'POST', '/academic-years', { label: '2027–2028', startYear: 2027 });
    const sw = yr.status < 300 ? await call('admin', 'PUT', '/academic-years/current', { label: '2027–2028' }) : yr;
    const cp = sw.status < 300 ? await call('admin', 'POST', '/academic-years/copy-catalog', {}) : sw;
    out.steps.newYear = { create: yr.status, makeCurrent: sw.status, copyCatalog: cp.status, copyBody: cp.status === 200 ? cp.body : cp.body };
    const [progs] = await admin.query("SELECT program_id, code, academic_year, pos_version FROM programs WHERE code = 'ZZNEW' ORDER BY program_id");
    out.steps.newYear.programRows = progs;
    if (progs.length > 1) {
      const y2 = progs[progs.length - 1], [y2pos] = await admin.query('SELECT po_no FROM program_outcomes WHERE program_id = ?', [y2.program_id]);
      const y2egas = (await admin.query('SELECT ega_no FROM program_egas WHERE program_id = ?', [y2.program_id]))[0].map((x) => x.ega_no);
      const e2 = await call('admin', 'PUT', `/programs/${y2.program_id}/outcomes`, { pos: edited.map((p) => (p.no === 2 ? { ...p, text: p.text + ' YEAR-2-ONLY' } : p)).filter((p) => y2pos.some((r) => r.po_no === p.no) || true), version: y2.pos_version });
      const [[y1txt]] = await admin.query('SELECT outcome_text FROM program_outcomes WHERE program_id = ? AND po_no = 2', [progs[0].program_id]);
      const [[y2txt]] = await admin.query('SELECT outcome_text FROM program_outcomes WHERE program_id = ? AND po_no = 2', [y2.program_id]);
      out.steps.newYear.isolation = { editStatus: e2.status, copiedPoCount: y2pos.length, copiedEgas: y2egas.length, year1Unchanged: !y1txt.outcome_text.includes('YEAR-2-ONLY'), year2Edited: y2txt.outcome_text.includes('YEAR-2-ONLY') };
    }
    const [[inst]] = await admin.query('SELECT version, vision FROM institution_settings WHERE setting_id = 1');
    out.steps.institution = { singleRowId1: true, version: inst.version, perYearOrVersioned: false, note: 'institution_settings is one row (setting_id=1) with a version counter; no historical rows' };
    out.summary = { control: out.steps.control, newNoCur: out.steps.newProgramNoCurriculum, newWithCur: out.steps.newProgramWithCurriculum, afterEdit: out.steps.recheckAfterPoEdit };
  } catch (e) { out.error = String(e && e.stack || e).slice(0, 1200); console.error(out.error); }
  finally {
    api.kill(); await admin.end().catch(() => {});
    fs.writeFileSync(path.join(OUTROOT, 'docs/release-candidate', `dynamic-reference-audit${label ? '-' + label : ''}.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out.steps, (k, v) => (typeof v === 'string' && v.length > 160 ? v.slice(0, 160) + '…' : v), 1).slice(0, 9000));
  }
})();
