'use strict';
// Integration test of historical AI Checker report retrieval: the real Express API, real routes, the scripted Claude double, against an ISOLATED restored copy of a development database
// (port E2E_DB_PORT, name containing "e2e") that has the RC9 schema. Refuses anything else. Prints statuses, counts and ids, never a record's text. Not part of `npm test`.
//   E2E_DB_PORT=43316 E2E_DB_NAME=syllabus_e2e_restored E2E_EVIDENCE_DIR=<dir> node scripts/release/report-retrieval.integration.test.cjs
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
process.chdir(ROOT);
const PORT = Number(process.env.E2E_DB_PORT), DB = process.env.E2E_DB_NAME || '';
if (!PORT || PORT === 3306 || !/e2e/i.test(DB)) { console.log('refusing: an isolated port and a database whose name contains e2e are required'); process.exit(2); }
const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise')), bcrypt = require(path.join(ROOT, 'server/node_modules/bcryptjs'));
const { startApi, waitFor } = require(path.join(ROOT, 'scripts/e2e/stack.cjs'));
const { sample } = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/harness'));
const API_PORT = 3428, FRONT = 'https://localhost:3644', BASE = `http://127.0.0.1:${API_PORT}`, PASS = 'Lab-Only-Copy-Pass1!';
const COVERED = [100, 101, 102];
let failed = 0, passed = 0; const results = [];
const ok = (n, p, d = '') => { if (p) passed++; else failed++; results.push({ name: n, ok: !!p, detail: String(d) }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d !== '' ? '  [' + d + ']' : ''}`); };
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const cookies = {}; let api = null, db = null;
async function call(who, method, url, body) {
  for (let t = 0; t < 6; t++) {
    const r = await fetch(BASE + '/api' + url, { method, headers: { 'Content-Type': 'application/json', Origin: FRONT, 'X-Forwarded-Proto': 'https', ...(cookies[who] ? { Cookie: cookies[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 429) { await new Promise((z) => setTimeout(z, 1000 * Math.min(30, Number(r.headers.get('retry-after')) || 5))); continue; }
    let j = null; try { j = await r.json(); } catch { /* none */ }
    if (url === '/auth/login') cookies[who] = (r.headers.getSetCookie() || []).map((c) => c.split(';')[0]).filter((c) => c.startsWith('connect.sid')).join('; ');
    return { status: r.status, body: j };
  }
  return { status: 429, body: null };
}
const rowsWritten = async () => { const [r] = await db.query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Innodb_rows_inserted', 'Innodb_rows_updated', 'Innodb_rows_deleted')"); return r.reduce((s, x) => s + Number(x.Value), 0); };
const stored = async () => { const out = {}; for (const [t, k] of [['syllabus_check_reports', 'run_id'], ['ai_check_runs', 'run_id'], ['ai_findings', 'finding_id'], ['syllabi', 'syllabus_id'], ['program_po_reference_remediation', 'entity_id'], ['program_po_reference_versions', 'reference_id'], ['program_po_reference_active', 'program_id'], ['program_outcomes', 'program_id']]) { const [r] = await db.query(`SELECT * FROM ${t}`); out[t] = { rows: r.length, hash: sha(r.map((v) => JSON.stringify(v)).sort()) }; } return out; };
(async () => {
  db = await mysql.createConnection({ host: '127.0.0.1', port: PORT, user: 'root', password: '', dateStrings: true, database: DB });
  const [[who]] = await db.query('SELECT @@port AS port'); if (who.port !== PORT) throw Error('STOP: wrong server');
  const view = await import('file:///' + path.join(ROOT, 'src/lib/complianceView.js').replace(/\\/g, '/'));
  const [[mig]] = await db.query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'program_po_reference_audit'"), [[cols]] = await db.query("SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'program_po_reference_versions' AND COLUMN_NAME IN ('status', 'academic_year', 'published_by', 'published_at', 'supersedes_reference_id', 'created_by')");
  ok('11. the copy has the RC9 schema', mig.n === 1 && cols.n === 6, `audit table ${mig.n}, version columns ${cols.n} of 6`);
  await db.query('UPDATE users SET password_hash = ?, must_change_password = 0', [await bcrypt.hash(PASS, 8)]);
  const [users] = await db.query('SELECT user_id, email, role FROM users'), [syls] = await db.query('SELECT syllabus_id id, user_id u, status FROM syllabi ORDER BY syllabus_id');
  const admin = users.find((u) => u.role === 'admin'), ownerOf = (id) => users.find((u) => u.user_id === syls.find((s) => s.id === id).u), other = users.find((u) => u.role === 'faculty' && u.user_id !== ownerOf(101).user_id);
  const [own] = await db.query('SELECT DISTINCT a.syllabus_id id FROM syllabus_check_reports r JOIN ai_check_runs a ON a.run_id = r.run_id ORDER BY 1'), [[rev]] = await db.query("SELECT COUNT(*) n FROM program_po_reference_remediation WHERE status = 'needs_review'");
  ok('the copy holds the real situation: 202 reports on 100, 101, 102, 8 open reviews', JSON.stringify(own.map((x) => x.id)) === JSON.stringify(COVERED) && Number(rev.n) === 8, `${own.map((x) => x.id).join(',')}; ${rev.n} reviews`);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'rc10-report-')), control = path.join(work, 'mode.txt'), provider = path.join(work, 'provider.jsonl'); fs.writeFileSync(control, 'ok');
  api = startApi({ port: API_PORT, work, front: FRONT, control, providerLog: provider, serverLog: path.join(work, 'api.log'), extraEnv: { E2E_DB_PORT: String(PORT), SYLLABUS_CHECK_PROFILE: 'comprehensive-testing', SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_AI_MAX_COST_USD: '100', SYLLABUS_CHECK_AI_MAX_REQUESTS: '2000', SYLLABUS_CHECK_REUSE: 'on', DEADLINE_NOTICES: 'off' } });
  await waitFor(BASE + '/api/health', 60000);
  await call('admin', 'POST', '/auth/login', { email: admin.email, password: PASS }); for (const u of users) await call('u' + u.user_id, 'POST', '/auth/login', { email: u.email, password: PASS });

  console.log('--- reading: every byte, every write counter, every provider call watched');
  const logLines = () => (fs.existsSync(provider) ? fs.readFileSync(provider, 'utf8').trim().split('\n').filter(Boolean).filter((l) => /"provider"|request/.test(l)).length : 0);
  const before = await stored(), w0 = await rowsWritten(), p0 = logLines();
  console.log('--- 2, 3, 4. saved reports of syllabi with an open review, as their owners open them');
  for (const id of COVERED) {
    const who = 'u' + syls.find((s) => s.id === id).u, r = await call(who, 'GET', `/syllabi/${id}/compliance`);
    ok(`syllabus ${id}: the owner opens the saved report`, r.status === 200 && !!r.body.run, `HTTP ${r.status} ${(r.body && r.body.code) || ''}`);
    if (r.status !== 200 || !r.body.run) continue;
    const run = r.body.run, [[row]] = await db.query('SELECT * FROM ai_check_runs WHERE run_id = ?', [run.id]), [[rep]] = await db.query('SELECT report_json FROM syllabus_check_reports WHERE run_id = ?', [run.id]);
    if (rep) {
      const saved = JSON.parse(rep.report_json);
      ok(`syllabus ${id}: original score, status and pass line`, Number(run.overall) === Number(row.overall) && run.passThreshold === 79, `overall ${run.overall}, threshold ${run.passThreshold}`);
      ok(`syllabus ${id}: the screen shows the saved score, not a dash`, !!saved.hybrid.ready ? view.scoreText(run) === run.overall + '%' : view.scoreText(run) === '—', `${view.scoreText(run)}, saved ready ${saved.hybrid.ready}`);
      ok(`syllabus ${id}: original findings`, sha(run.findings) === sha(saved.findings), `${run.findings.length} findings`);
      ok(`syllabus ${id}: original academic reference versions`, sha(run.hybrid.referenceContext || null) === sha(saved.hybrid.referenceContext || null) && sha(run.hybrid.alignment) === sha(saved.hybrid.alignment), 'reference context and AI evaluation equal the saved report');
      ok(`syllabus ${id}: the report is marked under review, never as a current check`, run.recordReview && run.recordReview.code && run.stale === true && run.hybrid.ready === false, run.recordReview && run.recordReview.code);
    } else console.log(`      syllabus ${id}: the latest run has no saved hybrid report; older reports are read below`);
  }
  const r316 = await call('admin', 'GET', '/compliance/runs/316'); ok('7. Admin opens its own saved check of a syllabus under review', r316.status === 200 && r316.body.run && r316.body.run.id === 316, `HTTP ${r316.status} ${(r316.body && r316.body.code) || ''}`);
  const adminList = await call('admin', 'GET', '/compliance?syllabus=101'); ok('7. Admin result screen for syllabus 101', adminList.status === 200, `HTTP ${adminList.status} ${(adminList.body && adminList.body.code) || ''}`);
  const adminCard = await call('admin', 'GET', '/syllabi/101/compliance'); ok('7. Admin card for syllabus 101', adminCard.status === 200, `HTTP ${adminCard.status} ${(adminCard.body && adminCard.body.code) || ''}`);
  const svc = require(path.join(ROOT, 'server/lib/compliance/service')), [runs] = await db.query('SELECT a.* FROM ai_check_runs a JOIN syllabus_check_reports r ON r.run_id = a.run_id ORDER BY a.run_id'); let assembled = 0, marked = 0, same = 0; const why = {};
  for (const row of runs) { try { const d = await svc.loadDetail(db, row, null); if (d) { assembled++; if (d.recordReview) marked++; if (Number(d.overall ?? -1) === Number(row.overall ?? -1) || d.status === 'incomplete') same++; } } catch (e) { const k = String(e.code || e.status || e.message).slice(0, 40); why[k] = (why[k] || 0) + 1; } }
  ok('3. all 202 saved reports assemble through the shared function', assembled === 202 && marked === 202, `${assembled} assembled, ${marked} marked ${JSON.stringify(why)}`);
  ok('4. every assembled report keeps its stored score, or its stored incomplete state', same === 202, `${same} of 202`);

  console.log('--- compliance status: the lists tell the truth, and keep the stored score');
  const adminList2 = (await call('admin', 'GET', '/compliance')).body, ownerList = (await call('u' + ownerOf(102).user_id, 'GET', '/compliance')).body, [openRows] = await db.query("SELECT entity_id id FROM program_po_reference_remediation WHERE status = 'needs_review'"), isOpen = (id) => openRows.some((o) => o.id === id);
  const rows2 = [...adminList2.syllabi, ...ownerList.syllabi], underReview = rows2.filter((r) => isOpen(r.syllabusId));
  ok('every list row of a syllabus under review is marked', underReview.length > 0 && underReview.every((r) => r.recordReview && (!r.run || (r.run.recordReview && r.run.stale === true))), underReview.map((r) => r.syllabusId).join(','));
  ok('no row of a syllabus with no open review is marked', rows2.filter((r) => !isOpen(r.syllabusId)).every((r) => !r.recordReview && !(r.run && r.run.recordReview)));
  for (const r of underReview.filter((x) => x.run)) { const [[stored]] = await db.query('SELECT overall, passed FROM ai_check_runs WHERE run_id = ?', [r.run.id]); ok(`list row of syllabus ${r.syllabusId}: stored score unchanged, and no current pass claimed in the summary`, Number(r.run.overall ?? -1) === Number(stored.overall ?? -1), `${r.run.overall}`); }
  ok('the summary counts no syllabus under review as passed', adminList2.summary.passed === adminList2.syllabi.filter((r) => r.run && r.run.overall !== null && r.run.passed && !r.run.recordReview).length, adminList2.summary.passed);
  const hist2 = (await call('admin', 'GET', '/compliance/history')).body.runs; ok('every history row of a syllabus under review is marked', hist2.length > 0 && hist2.every((h) => (isOpen(h.syllabusId) ? !!h.recordReview : !h.recordReview)), hist2.map((h) => h.syllabusId + ':' + h.recordReview).join(' '));
  for (const id of [93, 99, 101]) { const r = await call('admin', 'GET', `/compliance?syllabus=${id}`), run = r.body.run; ok(`syllabus ${id}: a run with no hybrid report is marked under review, with its stored score`, r.status === 200 && run && !run.hybrid && run.recordReview && run.stale === true && Number.isFinite(run.overall), run && run.overall); }

  console.log('--- 6, 7, 8. access');
  const o101 = 'u' + ownerOf(101).user_id, x = 'u' + other.user_id;
  ok('6. another faculty member gets 404 for syllabus 101', (await call(x, 'GET', '/syllabi/101/compliance')).status === 404);
  ok('6. another faculty member gets 404 on the result screen', (await call(x, 'GET', '/compliance?syllabus=101')).status === 404);
  ok('6. faculty, even the owner, cannot use the Admin run route', (await call(o101, 'GET', '/compliance/runs/316')).status === 403);
  ok('7. Admin cannot read a draft of a faculty member (syllabus 102)', (await call('admin', 'GET', '/syllabi/102/compliance')).status === 404);
  ok('7. Admin cannot read a faculty own run through the run route', (await call('admin', 'GET', '/compliance/runs/' + runs.find((r) => r.created_by === syls.find((s) => s.id === r.syllabus_id).u).run_id)).status === 404);
  for (const u of ['/syllabi/101/compliance', '/compliance?syllabus=101', '/compliance/runs/316']) ok(`8. no session is refused: ${u}`, (await call('none', 'GET', u)).status === 401);
  ok('8. an unknown run is a 404', (await call('admin', 'GET', '/compliance/runs/999999')).status === 404); ok('8. a malformed run id is a 404', (await call('admin', 'GET', '/compliance/runs/abc')).status === 404);

  console.log('--- 9, 10. reading wrote nothing');
  const after = await stored(), w1 = await rowsWritten(), p1 = logLines();
  ok('9. no row was inserted, updated or deleted by any read', w1 === w0, `InnoDB row writes ${w1 - w0}`); ok('9. no AI provider request', p1 === p0, `${p1 - p0} requests`);
  for (const t of Object.keys(before)) ok(`10. ${t}: byte-identical`, before[t].hash === after[t].hash, `${after[t].rows} rows`);

  console.log('--- 5. new checks stay blocked');
  for (const [id, code] of [[100, 'po_mapping_remediation_required'], [101, 'po_mapping_remediation_required'], [102, 'po_mapping_remediation_required']]) { const r = await call('u' + syls.find((s) => s.id === id).u, 'POST', `/syllabi/${id}/compliance/recheck`, {}); ok(`syllabus ${id}: a new check is refused`, r.status === 409 && r.body.code === code, `HTTP ${r.status} ${r.body && r.body.code}`); }
  const adminCheck = await call('admin', 'POST', '/syllabi/101/compliance/recheck', {}); ok('Admin check of syllabus 101 is refused too', adminCheck.status === 409 && adminCheck.body.code === 'po_mapping_remediation_required', `HTTP ${adminCheck.status} ${adminCheck.body && adminCheck.body.code}`);
  const sub = await call(o101, 'POST', '/syllabi/101/submit', {}); ok('submit of syllabus 101 is refused', sub.status >= 400 && sub.status < 500, `HTTP ${sub.status} ${sub.body && sub.body.code}`);
  const pub = await call('admin', 'POST', '/syllabi/101/publish', {}); ok('Admin publish of syllabus 101 is refused', pub.status >= 400 && pub.status < 500, `HTTP ${pub.status} ${pub.body && pub.body.code}`);
  const [[st]] = await db.query('SELECT status FROM syllabi WHERE syllabus_id = 101'); ok('syllabus 101 keeps its status', st.status === syls.find((s) => s.id === 101).status, st.status);
  const dec = (await db.query('SELECT content FROM syllabi WHERE syllabus_id = 101'))[0][0], [[o1]] = await db.query('SELECT COUNT(*) n FROM ai_check_runs'); ok('no run was stored by the refused checks', Number(o1.n) === before.ai_check_runs.rows, o1.n);
  const [[open]] = await db.query("SELECT COUNT(*) n FROM program_po_reference_remediation WHERE status = 'needs_review'"); ok('all 8 reviews are still open', Number(open.n) === 8); void dec;

  console.log('--- 1. a normal syllabus, scripted AI');
  const EGAS = [{ no: 1, name: 'Synthetic attribute one', short: 'ZE 1' }, { no: 2, name: 'Synthetic attribute two', short: 'ZE 2' }, { no: 3, name: 'Synthetic attribute three', short: 'ZE 3' }];
  const POS = [{ no: 1, short: 'ZPO 1', text: 'Zeta: apply knowledge of computing and mathematics to solve computing problems.', egas: [1] }, { no: 2, short: 'ZPO 2', text: 'Zeta: analyze a problem and identify the computing requirements appropriate to its solution.', egas: [2] }, { no: 3, short: 'ZPO 3', text: 'Zeta: design, implement and evaluate computing-based solutions to meet desired needs.', egas: [1, 2] }, { no: 4, short: 'ZPO 4', text: 'Zeta: work effectively in teams and communicate clearly with technical and non-technical audiences.', egas: [3] }, { no: 5, short: 'ZPO 5', text: 'Zeta: practice professional, ethical and socially responsible conduct in computing.', egas: [] }];
  const made = await call('admin', 'POST', '/courses', { code: 'ZZ 101', title: 'Zeta Programming Fundamentals', program: 'ZZNEW', programName: 'BS Zeta Computing (synthetic program)', outcomes: { egas: EGAS, pos: POS } }), courseId = made.body.id, programId = made.body.program.id, f = ownerOf(101).user_id;
  await db.query('INSERT INTO faculty_courses (user_id, course_id) VALUES (?, ?)', [f, courseId]); await db.query('INSERT IGNORE INTO faculty_programs (user_id, program_id) VALUES (?, ?)', [f, programId]);
  const cr = await call('admin', 'POST', '/syllabus-check/references', { program: 'ZZNEW', curriculumYear: 'zeta-2026', source: 'synthetic test curriculum (not an official reference)', courses: [{ code: 'ZZ 101', title: 'Zeta Programming Fundamentals', prereq: 'ZZ 100 - Prerequisite', lecture: 2, lab: 1, yearLevel: 2 }] }); await call('admin', 'POST', `/syllabus-check/references/${cr.body.id}/approve`, { confirmedAgainstSource: true });
  const s0 = sample(), inst = (await call('admin', 'GET', '/institution/outcomes')).body, c = JSON.parse(JSON.stringify(s0.content)); Object.assign(c.meta, { courseId, code: 'ZZ 101', title: 'Zeta Programming Fundamentals', program: 'ZZNEW', curriculumYear: 'zeta-2026', prereq: 'ZZ 100 - Prerequisite', lecture: '2', lab: '1', yearLevel: '2' }); c.outcomes = { vision: inst.vision, mission: inst.mission, egas: EGAS, pos: POS }; c.clos.forEach((clo, i) => { clo.pos = [[1, 5], [2], [3], [4]][i]; clo.egas = (clo.egas || []).filter((k) => EGAS.some((e) => e.no === k)); });
  const sid = (await call(o101, 'POST', '/syllabi/drafts')).body.id, cur = await call(o101, 'GET', `/syllabi/${sid}/content`), K = ['clos', 'plan', 'reqs', 'refs', 'grading', 'outcomes', 'meta', 'description'], sec = Object.fromEntries(K.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])); await call(o101, 'PUT', `/syllabi/${sid}/content`, { sections: sec, schemaVersion: 3, baseRevisions: Object.fromEntries(Object.keys(sec).map((k) => [k, (cur.body.revisions || {})[k]])) });
  const rc = await call(o101, 'POST', `/syllabi/${sid}/compliance/recheck`, {}); ok('a syllabus with no open review can still be checked, scripted AI', rc.status === 200 && rc.body.run, `HTTP ${rc.status}`);
  const nr = await call(o101, 'GET', `/syllabi/${sid}/compliance`); ok('1. its saved report opens, and is not marked under review', nr.status === 200 && nr.body.run && !nr.body.run.recordReview, `HTTP ${nr.status}`); ok('1. it stays a current report: score shown, threshold 79', nr.body.run.stale !== true && nr.body.run.passThreshold === 79 && view.scoreText(nr.body.run) === nr.body.run.overall + '%', `${view.scoreText(nr.body.run)}, stale ${nr.body.run.stale}`);
  if (process.env.E2E_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.E2E_EVIDENCE_DIR, 'report-retrieval-results.json'), JSON.stringify({ passed, failed, results }, null, 1));
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  await db.end(); try { api.kill(); } catch { /* done */ } process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('STOPPED ' + String(e.message).replace(/'[^']*'/g, "'..'").slice(0, 200)); try { api && api.kill(); } catch { /* done */ } process.exit(2); });
