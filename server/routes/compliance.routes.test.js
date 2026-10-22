// HTTP-level tests for the compliance checks: the submit gate (a blocking rule stops a submit; everything else only warns), the
// run stored with the version, the background AI step and its fallback, the re-check route (owner only, cached by content, rate
// limited), the stored-run reads, who may read whose runs, and the stale flag. In-memory fake database, session user from the
// x-test-user header. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const F = require('../lib/compliance/fixtures');
const svc = require('../lib/compliance/service');
const { MockProvider, ProviderError } = require('../lib/compliance/providers');

// A form that follows the standard. A draft carries no catalog copy (the server adds it at submit), and the fake catalog below has
// one CLO (id c1) for IT 204, so every ILO is tagged with that one.
function conformingContent() {
  const c = F.good();
  delete c.catalog;
  c.plan.forEach((r) => r.ilos.forEach((il) => { if (il.tags.length) il.tags = ['clo:c1']; }));
  return c;
}

function makeDb() {
  const s = {
    settings: { vision: 'V', mission_lead: 'Lead', mission_items: JSON.stringify(['m1']), version: 1 },
    instEgas: [{ ega_no: 1, name: 'Thinker', short_name: 'Thinker' }, { ega_no: 2, name: 'Professional', short_name: 'Pro' }],
    programs: [
      { program_id: 1, code: 'BSIT', name: 'BS IT', egas_version: 1, pos_version: 1 },
      { program_id: 2, code: 'BSIE', name: 'BS IE', egas_version: 1, pos_version: 1 },
    ],
    egas: [ // each program's own EGAs
      { program_id: 1, ega_no: 1, name: 'Thinker', short_name: 'Thinker' }, { program_id: 1, ega_no: 2, name: 'Professional', short_name: 'Pro' },
      { program_id: 2, ega_no: 1, name: 'Engineer', short_name: 'Engineer' }, { program_id: 2, ega_no: 2, name: 'Leader', short_name: 'Leader' },
    ],
    pos: [
      { program_id: 1, po_no: 1, short_name: 'Apply', outcome_text: 'Apply knowledge', ega_nos: '1' },
      { program_id: 1, po_no: 2, short_name: 'Ethics', outcome_text: 'Be ethical', ega_nos: '2' },
      { program_id: 2, po_no: 1, short_name: 'Design', outcome_text: 'Design systems', ega_nos: '1' },
    ],
    courses: [
      { course_id: 10, code: 'IT 204', title: 'Programming 2', program_id: 1, clos_version: 1 },
      { course_id: 20, code: 'IE 101', title: 'Work Study', program_id: 2, clos_version: 1 },
    ],
    clos: [{ course_id: 10, ega_nos: '1', po_nos: '1' }, { course_id: 20, ega_nos: '2', po_nos: '1' }],
    syllabi: { 1: { syllabus_id: 1, user_id: 5, status: 'draft', version: 'v1.0', title: 'Programming 2', course_code: 'IT 204', course_id: 10, curriculum_id: null, file_path: null, content: JSON.stringify(conformingContent()) } },
    saved: [],
    installed: true, runs: [], areas: [], findings: [], versionId: 77, versions: [],
    people: { 5: { first_name: 'Fay', last_name: 'F' }, 6: { first_name: 'Gus', last_name: 'G' } },
  };
  for (const course of s.courses) course.standards_json = JSON.stringify({ vision:s.settings.vision, mission:{lead:s.settings.mission_lead,items:JSON.parse(s.settings.mission_items)}, egas:s.egas.filter(e=>e.program_id===course.program_id).map(e=>({no:e.ega_no,name:e.name,short:e.short_name})), pos:s.pos.filter(p=>p.program_id===course.program_id).map(p=>({no:p.po_no,short:p.short_name,text:p.outcome_text,egas:p.ega_nos.split(',').map(Number)})), versions:{vision:1,egas:1,pos:1} });
  const prog = (where) => s.programs.find(where);
  // svc.ADMIN_RUN_SQL: stored with a version, by someone other than the syllabus's owner
  const isAdminRun = (r) => r.version_id !== null && r.created_by !== null && r.created_by !== undefined && r.created_by !== s.syllabi[r.syllabus_id].user_id;
  const keep = (sql, r) => (!sql.includes('version_id IS NOT NULL') || r.version_id !== null) && (!sql.includes('created_by <>') || isAdminRun(r));
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT syllabus_id, user_id, status, title, course_code, content, course_id, archived_at FROM syllabi')) return [s.syllabi[p[0]] ? [s.syllabi[p[0]]] : []];
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]];
    if (sql.startsWith('SELECT vision')) return [[s.settings]];
    if (sql.startsWith('SELECT ega_no, name, short_name FROM institution_egas')) return [s.instEgas];
    if (sql.startsWith('SELECT ega_no FROM institution_egas')) return [s.instEgas.map((e) => ({ ega_no: e.ega_no }))];
    if (sql.startsWith('SELECT ega_no, name, short_name FROM program_egas')) return [s.egas.filter((e) => e.program_id === p[0])];
    if (sql.startsWith('SELECT p.program_id FROM programs p WHERE NOT EXISTS')) return [s.programs.filter((x) => !s.egas.some((e) => e.program_id === x.program_id)).map((x) => ({ program_id: x.program_id }))];
    if (sql.startsWith('SELECT version FROM institution_settings')) return [[{ version: s.settings.version }]];
    if (sql.startsWith('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE program_id')) return [s.programs.filter((x) => x.program_id === p[0])];
    if (sql.startsWith('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE code')) return [s.programs.filter((x) => x.code === p[0])];
    if (sql.startsWith('SELECT po_no FROM program_outcomes')) return [s.pos.filter((x) => x.program_id === p[0]).map((x) => ({ po_no: x.po_no }))];
    if (sql.startsWith('SELECT po_no, short_name')) return [s.pos.filter((x) => x.program_id === p[0])];
    if (sql.startsWith('SELECT o.po_no, o.ega_nos')) return [s.pos.filter((x) => x.program_id === p[0]).map((x) => ({ po_no: x.po_no, ega_nos: x.ega_nos, program_code: prog((y) => y.program_id === p[0]).code }))];
    if (sql.startsWith('SELECT c.code, k.ega_nos, k.po_nos')) return [s.clos.filter((k) => s.courses.find((c) => c.course_id === k.course_id).program_id === p[0]).map((k) => ({ code: s.courses.find((c) => c.course_id === k.course_id).code, ega_nos: k.ega_nos, po_nos: k.po_nos }))];
    if (sql.startsWith('SELECT code FROM courses WHERE program_id')) return [s.courses.filter((c) => c.program_id === p[0]).map((c) => ({ code: c.code }))];
    if (sql.startsWith('SELECT egas_version AS v')) return [[{ v: prog((x) => x.program_id === p[0]).egas_version }]];
    if (sql.startsWith('SELECT pos_version AS v')) return [[{ v: prog((x) => x.program_id === p[0]).pos_version }]];
    if (sql.startsWith('SELECT clos_version AS v')) { const c=s.courses.find(c=>c.course_id===p[0]); return [[{v:c.clos_version,standards_json:c.standards_json}]]; }
    if (sql.startsWith('INSERT INTO institution_settings')) { s.settings.version++; return [{}]; }
    if (sql.startsWith('UPDATE programs SET egas_version')) { prog((x) => x.program_id === p[0]).egas_version++; return [{}]; }
    if (sql.startsWith('UPDATE programs SET pos_version')) { prog((x) => x.program_id === p[0]).pos_version++; return [{}]; }
    if (sql.startsWith('UPDATE courses SET clos_version')) { s.courses.find((c) => c.course_id === p[0]).clos_version++; return [{}]; }
    if (sql.startsWith('DELETE FROM program_egas')) { s.egas = s.egas.filter((e) => e.program_id !== p[0]); return [{}]; }
    if (sql.startsWith('INSERT INTO program_egas')) { p[0].forEach(([program_id, ega_no, name, short_name]) => s.egas.push({ program_id, ega_no, name, short_name })); return [{}]; }
    if (sql.startsWith('DELETE FROM program_outcomes')) { s.pos = s.pos.filter((x) => x.program_id !== p[0]); return [{}]; }
    if (sql.startsWith('INSERT INTO program_outcomes')) { p[0].forEach(([program_id, po_no, short_name, outcome_text, ega_nos]) => s.pos.push({ program_id, po_no, short_name, outcome_text, ega_nos })); return [{}]; }
    if (sql.startsWith('SELECT c.course_id, c.code, c.title, c.clos_version, p.program_id')) return [s.courses.filter((c) => c.course_id === p[0]).map((c) => ({ ...c, program_code: prog((x) => x.program_id === c.program_id).code, program_name: 'x' }))];
    if (sql.startsWith('SELECT clo_id')) return [s.clos.filter((k) => k.course_id === p[0]).map((k, i) => ({ clo_id: i + 1, title: '', clo_level: 'Enabling', statement: 's', ega_nos: k.ega_nos, po_nos: k.po_nos }))];
    if (sql.startsWith('SELECT course_id FROM faculty_courses')) return [[{ course_id: 10 }]];
    if (sql.startsWith('SELECT program_id FROM faculty_programs')) return [[{ program_id: 1 }]];
    if (sql.startsWith('SELECT * FROM syllabi WHERE syllabus_id')) return [s.syllabi[p[0]] ? [s.syllabi[p[0]]] : []];
    if (sql.startsWith("SELECT user_id FROM users WHERE role = 'admin'")) return [[]];
    // ---- the compliance tables
    if (sql.startsWith('SELECT 1 FROM ai_check_runs')) { if (!s.installed) throw new Error("Table 'ai_check_runs' doesn't exist"); return [[]]; }
    if (sql.startsWith('INSERT INTO ai_check_runs')) {
      const [syllabus_id, version_id, content_hash, standard_version, overall, status, passed, conformant, ai_status, contact, created_by] = p;
      const row = { run_id: s.runs.length + 1, syllabus_id, version_id, content_hash, standard_version, overall, status, passed, conformant, ai_status, ai_error: null, provider: null, model: null, prompt_version: null, contact, created_by, created_at: '2026-01-01' };
      s.runs.push(row);
      return [{ insertId: row.run_id }];
    }
    if (sql.startsWith('INSERT INTO ai_check_area_scores')) { p[0].forEach(([run_id, area_key, name, weight, score]) => s.areas.push({ run_id, area_key, name, weight, score })); return [{}]; }
    if (sql.startsWith('INSERT INTO ai_findings')) {
      if (sql.includes('rule_id')) p[0].forEach(([run_id, kind, source, area, rule_id, severity, step, path, message, evidence, position]) => s.findings.push({ run_id, kind, source, area, rule_id, severity, step, path, message, evidence, position }));
      else p[0].forEach(([run_id, kind, source, area, title, message, step, based_on, links, priority, priority_level, position]) => s.findings.push({ run_id, kind, source, area, title, message, step, based_on, links, priority, priority_level, position }));
      return [{}];
    }
    if (sql.startsWith('DELETE FROM ai_findings')) { const kind = sql.includes("'finding'") ? 'finding' : 'recommendation'; s.findings = s.findings.filter((f) => !(f.run_id === p[0] && f.kind === kind)); return [{}]; }
    if (sql.startsWith('DELETE FROM ai_check_area_scores')) { s.areas = s.areas.filter((a) => a.run_id !== p[0]); return [{}]; }
    if (sql.startsWith('UPDATE ai_check_runs SET overall = ?')) { const [overall, status, passed, conformant, id] = p; Object.assign(s.runs.find((r) => r.run_id === id), { overall, status, passed, conformant }); return [{}]; }
    if (sql.startsWith('UPDATE ai_check_runs SET ai_status = ?, ai_error = ?, provider')) {
      const [ai_status, ai_error, provider, model, prompt_version, id] = p;
      Object.assign(s.runs.find((r) => r.run_id === id), { ai_status, ai_error, provider, model, prompt_version });
      return [{}];
    }
    if (sql.startsWith("UPDATE ai_check_runs SET ai_status = 'failed'")) { Object.assign(s.runs.find((r) => r.run_id === p[1]), { ai_status: 'failed', ai_error: p[0] }); return [{}]; }
    if (sql.startsWith('SELECT * FROM ai_check_runs WHERE syllabus_id = ? AND content_hash')) return [s.runs.filter((r) => r.syllabus_id === p[0] && r.content_hash === p[1] && r.standard_version === p[2] && keep(sql, r) && (!sql.includes('AND version_id = ?') || r.version_id === p[3])).slice(-1)];
    if (sql.startsWith('SELECT * FROM ai_check_runs WHERE syllabus_id')) return [s.runs.filter((r) => r.syllabus_id === p[0] && keep(sql, r)).slice(-1)];
    if (sql.startsWith('SELECT * FROM ai_check_runs WHERE run_id')) return [s.runs.filter((r) => r.run_id === p[0])];
    if (sql.startsWith('SELECT r.* FROM ai_check_runs')) return [p[0].map((id) => s.runs.filter((r) => r.syllabus_id === id && keep(sql, r)).slice(-1)[0]).filter(Boolean)];
    if (sql.startsWith('SELECT run_id, area_key')) return [s.areas.filter((a) => p[0].includes(a.run_id))];
    if (sql.startsWith('SELECT * FROM ai_findings')) return [s.findings.filter((f) => f.run_id === p[0]).sort((x, y) => x.position - y.position)];
    // the list: one row per syllabus with the faculty member, program and subject the real query joins in
    const labelled = (x) => ({ ...x, ...(s.people[x.user_id] || { first_name: '', last_name: '' }), course_title: x.course_id ? 'Computer Programming 2' : null, program_code: x.course_id ? 'BSIT' : null, program_name: x.course_id ? 'BS Information Technology' : null, curriculum_program: null });
    if (sql.startsWith('SELECT s.syllabus_id, s.user_id')) {
      const all = Object.values(s.syllabi);
      const rows = sql.includes("s.status <> 'draft' OR") ? all.filter(x=>x.status!=='draft'||x.user_id===p[0]) : sql.includes('s.user_id = ?') ? all.filter((x) => x.user_id === p[0]) : all.filter((x) => x.status !== 'draft');
      return [rows.map((x) => { const r = labelled(x); if (!sql.includes('s.content,')) delete r.content; return r; })];
    }
    if (sql.startsWith('SELECT r.run_id')) { // the history: runs stored with a version, newest first, with the syllabus's labels
      let at = 0; // the placeholders after the first ?-free part: from, then to, then the limit, each only when the SQL has it
      const lo = sql.includes('>= FROM_UNIXTIME') ? p[at++] * 1000 : -Infinity;
      const hi = sql.includes('< FROM_UNIXTIME') ? p[at++] * 1000 : Infinity;
      const limit = p[at];
      const inRange = (r) => { const t = Date.parse(r.created_at); return t >= lo && t < hi; };
      const latestOf = (id) => Math.max(...s.runs.filter((x) => x.syllabus_id === id && isAdminRun(x)).map((x) => x.run_id));
      return [s.runs.filter((r) => isAdminRun(r) && s.syllabi[r.syllabus_id].status !== 'draft' && r.run_id === latestOf(r.syllabus_id) && inRange(r)).reverse().slice(0, limit)
        .map((r) => ({ ...labelled(s.syllabi[r.syllabus_id]), run_id: r.run_id, syllabus_id: r.syllabus_id, version_label: (s.versions.find((v) => v.version_id === r.version_id) || {}).version_label, overall: r.overall, status: r.status, passed: r.passed, ai_status: r.ai_status, created_by: r.created_by, created_at: r.created_at, syllabus_status: s.syllabi[r.syllabus_id].status }))];
    }
    if (sql.startsWith('SELECT u.first_name, u.last_name')) return [s.syllabi[p[0]] ? [labelled(s.syllabi[p[0]])] : []];
    if (sql.startsWith('SELECT first_name, last_name FROM users WHERE user_id')) return [s.people[p[0]] ? [s.people[p[0]]] : []];
    if (sql.startsWith('INSERT INTO syllabus_versions')) { const v = { version_id: s.versionId + s.versions.length, syllabus_id: p[0], version_label: p[1], content: p[8] }; s.versions.push(v); return [{ insertId: v.version_id }]; }
    if (sql.startsWith('SELECT version_id, version_label, content FROM syllabus_versions')) return [s.versions.filter((v) => v.syllabus_id === p[0]).slice(-1)];
    if (sql.startsWith('SELECT version_label FROM syllabus_versions WHERE version_id')) return [s.versions.filter((v) => v.version_id === p[0]).map((v) => ({ version_label: v.version_label }))];
    if (sql.startsWith('SELECT file_path FROM syllabus_versions WHERE version_id')) return [s.versions.filter((v) => v.version_id === p[0]).map((v) => ({ file_path: v.file_path || null }))];
    if (sql.startsWith('SELECT v.syllabus_id, v.version_id, v.content')) return [p[0].map((id) => s.versions.filter((v) => v.syllabus_id === id).slice(-1)[0]).filter(Boolean)];
    if (sql.startsWith('UPDATE syllabi SET status = ?, version')) { if(s.trackStatus) Object.assign(s.syllabi[p[2]],{status:p[0],version:p[1]});return [{}]; }
    if (sql.startsWith('UPDATE syllabi SET content')) { s.saved.push(JSON.parse(p[0])); s.syllabi[p[p.length - 1]].content = p[0]; return [{}]; }
    if (/^(INSERT|UPDATE|DELETE)/.test(sql)) return [{}];
    if (/FROM course_prerequisites/.test(sql)) return [[]]; // a subject's prerequisites: none set
    throw new Error('unexpected query: ' + sql);
  };
  const conn = { query: async (q, p) => handle(q, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
  return { s, query: async (q, p) => handle(q, p), getConnection: async () => conn };
}


async function withServer(opts, fn) {
  if (typeof opts === 'function') { fn = opts; opts = {}; }
  const db = makeDb();
  db.s.installed = opts.installed !== false;
  svc.resetInstalledCache();
  svc.setProvider(opts.provider === undefined ? new MockProvider() : opts.provider);
  const compliance = require('./compliance');
  compliance.limiter.reset();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/syllabi', require('./syllabusContent'));
  app.use('/api', compliance);
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (as, method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})), headers: res.headers };
  };
  try { await fn({ db, call }); } finally { await svc.settled(); await new Promise((r) => server.close(r)); }
}

const admin = { id: 1, role: 'admin', firstName: 'Ann', lastName: 'A' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };
const gus = { id: 6, role: 'faculty', firstName: 'Gus', lastName: 'G' };
const setContent = (db, id, content) => { db.s.syllabi[id].content = JSON.stringify(content); };
const addSyllabus = (db, id, over) => { db.s.syllabi[id] = { ...db.s.syllabi[1], syllabus_id: id, ...over }; };
const withGaps = (c) => { c.plan[2].tasks = ''; return c; }; // one lesson without an assessment task: a warning, so there is something to recommend

test('grading that does not total 100, or an ILO with no CLO tag, blocks the submit: 409 with the failed rules, nothing saved', () => withServer(async ({ call, db }) => {
  const c = conformingContent();
  c.grading.rows[0].pct = 50; // totals 90
  c.plan[0].ilos[0].tags = [];
  setContent(db, 1, c);
  const r = await call(fay, 'POST', '/syllabi/1/submit', {});
  assert.strictEqual(r.status, 409);
  assert.match(r.body.error, /does not follow the form yet/);
  assert.deepStrictEqual(r.body.failed.map((x) => x.ruleId).sort(), ['T-13', 'T-24']);
  r.body.failed.forEach((x) => { assert.ok(x.id && x.step && x.path && x.message); });
  assert.deepStrictEqual(r.body.failed.find((x) => x.ruleId === 'T-24'), { id: 'T-24:grading.rows', ruleId: 'T-24', step: 'grade', path: 'grading.rows', message: 'The grading components total 90%, not 100%.' });
  assert.strictEqual(db.s.saved.length, 0);
  assert.strictEqual(db.s.runs.length, 0);
}));

test('an unresolved tag blocks the submit too', () => withServer(async ({ call, db }) => {
  const c = conformingContent();
  c.plan[0].ilos[0].tags = ['clo:c1', 'clo:gone'];
  setContent(db, 1, c);
  const r = await call(fay, 'POST', '/syllabi/1/submit', {});
  assert.strictEqual(r.status, 409);
  assert.deepStrictEqual(r.body.failed.map((x) => x.ruleId), ['T-14']);
  assert.match(r.body.failed[0].message, /tag that no longer resolves: clo:gone/);
}));

test('warnings do not block: a missing exam row, an empty assessment column and rows out of order still submit', () => withServer(async ({ call, db }) => {
  const c = conformingContent();
  c.plan = c.plan.filter((r) => !/MIDTERM/.test(r.contents));
  c.plan.forEach((r) => { r.tasks = ''; });
  c.plan.reverse();
  setContent(db, 1, c);
  const r = await call(fay, 'POST', '/syllabi/1/submit', {});
  assert.strictEqual(r.status, 200);
  assert.strictEqual(db.s.runs.length, 1);
  assert.ok(db.s.runs[0].overall < 100);
  assert.strictEqual(db.s.runs[0].conformant, 1);
  assert.ok(db.s.findings.some((f) => f.kind === 'finding' && f.rule_id === 'A-03' && f.severity === 'major'));
}));

test('submit stores the run with the version, its area scores and findings, then runs the AI step afterwards', () => withServer(async ({ call, db }) => {
  setContent(db, 1, withGaps(conformingContent()));
  const r = await call(fay, 'POST', '/syllabi/1/submit', {});
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.version, 'v1.0');
  const run = db.s.runs[0];
  assert.strictEqual(run.version_id, 77);
  assert.strictEqual(run.syllabus_id, 1);
  assert.strictEqual(run.standard_version, 'v8');
  assert.match(run.content_hash, /^[0-9a-f]{64}$/);
  assert.strictEqual(run.created_by, 5);
  assert.deepStrictEqual(db.s.areas.map((a) => a.area_key), ['template', 'completeness', 'co_po', 'assessment', 'contact_hours', 'reference_currency']);
  assert.ok(db.s.findings.some((f) => f.kind === 'finding' && f.rule_id === 'A-01' && f.step === 'plan'));
  await svc.settled();
  assert.strictEqual(run.ai_status, 'ok');
  assert.strictEqual(run.provider, 'mock');
  const recs = db.s.findings.filter((f) => f.kind === 'recommendation');
  assert.ok(recs.length > 0 && recs.every((f) => f.source === 'ai' && f.step && f.priority !== null));
  assert.ok(recs.some((f) => JSON.parse(f.links).rows.includes(2))); // linked to the Learning Plan row that has no task
}));

test('the stored run belongs to the submit: it is not stale, and carries the version', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  const got = await call(fay, 'GET', '/syllabi/1/compliance');
  assert.strictEqual(got.body.run.stale, false);
  assert.strictEqual(got.body.run.versionId, 77);
  assert.strictEqual(got.body.run.conformant, true);
}));

test('the AI step failing never fails the submit; rule-based recommendations are stored and the failure is recorded', () => withServer({ provider: new MockProvider({ fail: new ProviderError('boom', 'service down') }) }, async ({ call, db }) => {
  setContent(db, 1, withGaps(conformingContent()));
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  await svc.settled();
  const run = db.s.runs[0];
  assert.strictEqual(run.ai_status, 'failed');
  assert.match(run.ai_error, /boom/);
  const recs = db.s.findings.filter((f) => f.kind === 'recommendation');
  assert.ok(recs.length > 0 && recs.every((f) => f.source === 'rule'));
  assert.strictEqual((await call(fay, 'GET', '/syllabi/1/compliance')).body.run.aiStatus, 'failed');
}));

test('with no AI provider configured the run is simply rule-based: no error, rule recommendations', () => withServer({ provider: null }, async ({ call, db }) => {
  setContent(db, 1, withGaps(conformingContent()));
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  await svc.settled();
  const run = db.s.runs[0];
  assert.strictEqual(run.ai_status, 'none');
  assert.strictEqual(run.ai_error, null);
  assert.strictEqual(run.provider, null);
  assert.ok(db.s.findings.some((f) => f.kind === 'recommendation' && f.source === 'rule'));
}));

test('the provider never sees the owner by name: the server masks it', () => withServer(async ({ call, db }) => {
  const seen = [];
  svc.setProvider(new MockProvider({ raw: (findings, excerpt) => { seen.push(JSON.stringify({ findings, excerpt })); return []; } }));
  const c = withGaps(conformingContent());
  c.description[0].t = 'Prepared by Fay F for the department. ' + c.description[0].t;
  setContent(db, 1, c);
  await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  await svc.settled();
  assert.strictEqual(seen.length, 1);
  assert.doesNotMatch(seen[0], /Fay/);
  assert.match(seen[0], /\[name\]/);
}));

test('before the migration is run, submit still works, nothing is stored, and the compliance routes say it is not set up', () => withServer({ installed: false }, async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  assert.strictEqual(db.s.runs.length, 0);
  const got = await call(fay, 'GET', '/syllabi/1/compliance');
  assert.deepStrictEqual([got.status, got.body.installed, got.body.run], [200, false, null]);
  const re = await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.strictEqual(re.status, 503);
  assert.match(re.body.error, /not set up/);
  assert.strictEqual((await call(fay, 'GET', '/compliance?syllabus=all')).body.installed, false);
}));

test('re-check: the same content gives the same run and does not use the limit; force makes a new run with the same score', () => withServer(async ({ call, db }) => {
  setContent(db, 1, withGaps(conformingContent()));
  const first = await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.cached, false);
  assert.strictEqual(first.body.run.stale, false);
  const again = await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.strictEqual(again.body.cached, true);
  assert.strictEqual(again.body.run.id, first.body.run.id);
  assert.strictEqual(db.s.runs.length, 1);
  const forced = await call(fay, 'POST', '/syllabi/1/compliance/recheck', { force: true });
  assert.strictEqual(forced.body.cached, false);
  assert.notStrictEqual(forced.body.run.id, first.body.run.id);
  assert.strictEqual(forced.body.run.overall, first.body.run.overall);
  assert.deepStrictEqual(forced.body.run.areas, first.body.run.areas);
  assert.deepStrictEqual(forced.body.run.findings, first.body.run.findings);
  assert.strictEqual(db.s.runs[1].version_id, null); // a re-check is not tied to a version
}));

test('editing the content marks the last run stale, and a re-check makes a fresh one', () => withServer(async ({ call, db }) => {
  setContent(db, 1, conformingContent());
  const run = (await call(fay, 'POST', '/syllabi/1/compliance/recheck', {})).body.run;
  assert.strictEqual((await call(fay, 'GET', '/syllabi/1/compliance')).body.run.stale, false);
  const edited = conformingContent();
  edited.plan[0].contents = 'Something else';
  setContent(db, 1, edited);
  const after = await call(fay, 'GET', '/syllabi/1/compliance');
  assert.strictEqual(after.body.run.id, run.id);
  assert.strictEqual(after.body.run.stale, true);
  const fresh = await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.strictEqual(fresh.body.cached, false);
  assert.notStrictEqual(fresh.body.run.id, run.id);
  assert.strictEqual(fresh.body.run.stale, false);
}));

test('a vision changed by an admin after a submit shows as a blocking failure on re-check, and a new submit picks up the new text', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  assert.strictEqual(db.s.saved[0].catalog.institution.vision, 'V');
  const ok = await call(fay, 'POST', '/syllabi/1/compliance/recheck', { force: true });
  assert.strictEqual(ok.body.run.conformant, true);

  const setup=JSON.parse(db.s.courses[0].standards_json);setup.vision='A new vision';db.s.courses[0].standards_json=JSON.stringify(setup);
  const re = await call(fay, 'POST', '/syllabi/1/compliance/recheck', { force: true });
  assert.strictEqual(re.body.run.conformant, false);
  const f = re.body.run.findings.find((x) => x.ruleId === 'T-09');
  assert.strictEqual(f.severity, 'blocking');
  assert.match(f.message, /not the school's current vision/);

  const again = await call(fay, 'POST', '/syllabi/1/submit', {}); // submitting again takes the current text
  assert.strictEqual(again.status, 200);
  assert.strictEqual(db.s.saved[1].catalog.institution.vision, 'A new vision');
  assert.strictEqual(db.s.runs[db.s.runs.length - 1].conformant, 1);
}));

test('a faculty member cannot read, list or re-check another one\'s runs; an admin reads submitted syllabi only', () => withServer(async ({ call, db }) => {
  setContent(db, 1, conformingContent());
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/compliance/recheck', {})).status, 200);
  assert.strictEqual((await call(gus, 'GET', '/syllabi/1/compliance')).status, 404);
  assert.strictEqual((await call(gus, 'POST', '/syllabi/1/compliance/recheck', {})).status, 404);
  assert.strictEqual((await call(gus, 'GET', '/compliance?syllabus=1')).status, 404);
  assert.deepStrictEqual((await call(gus, 'GET', '/compliance?syllabus=all')).body.syllabi, []);
  assert.strictEqual((await call(admin, 'GET', '/syllabi/1/compliance')).status, 404); // a draft is invisible to admins
  assert.strictEqual((await call(null, 'GET', '/syllabi/1/compliance')).status, 401);
  db.s.syllabi[1].status = 'submitted';
  const noVersionRun = await call(admin, 'GET', '/syllabi/1/compliance');
  assert.strictEqual(noVersionRun.status, 200);
  assert.strictEqual(noVersionRun.body.run, null); // only the owner's own check exists, none was stored with a submitted version
  const noVersion = await call(admin, 'POST', '/syllabi/1/compliance/recheck', {}); // an admin checks a submitted version; this one has none
  assert.strictEqual(noVersion.status, 409);
  assert.strictEqual(noVersion.body.code, 'no_form');
  assert.strictEqual((await call(fay, 'GET', '/syllabi/999/compliance')).status, 404);
  db.s.syllabi[1].status = 'for_revision'; // a submitted syllabus is locked: it is the one returned for revision that is submitted again
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', { note: 'Rewrote the grading section.' })).status, 200);
  assert.strictEqual((await call(admin, 'GET', '/syllabi/1/compliance')).body.run, null); // the submit stored the author's run: not an administrator's check
  assert.ok((await call(admin, 'POST', '/syllabi/1/compliance/recheck', {})).body.run); // the administrator checks it themselves
  assert.ok((await call(admin, 'GET', '/syllabi/1/compliance')).body.run); // and that one is what the administrator sees
}));

test('an admin sees only an administrator\'s check: not the run the faculty member\'s submit stored, nor a re-check the owner ran afterwards', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  db.s.syllabi[1].status = 'submitted';
  const submitRun = db.s.runs[0].run_id;
  const edited = JSON.parse(db.s.syllabi[1].content);
  edited.plan[0].contents = 'Edited after the submit';
  setContent(db, 1, edited);
  const recheck = await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.notStrictEqual(recheck.body.run.id, submitRun);
  assert.strictEqual((await call(fay, 'GET', '/syllabi/1/compliance')).body.run.id, recheck.body.run.id); // the owner sees their newest
  // nothing the faculty member ran counts for the administrator
  assert.strictEqual((await call(admin, 'GET', '/syllabi/1/compliance')).body.run, null);
  assert.strictEqual((await call(admin, 'GET', '/compliance?syllabus=1')).body.run, null);
  assert.strictEqual((await call(admin, 'GET', '/compliance?syllabus=all')).body.syllabi[0].run, null);
  // the administrator's own check is stored with the submitted version, says who made it, and is not stale against that version
  const mine = await call(admin, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.strictEqual(mine.status, 200);
  assert.strictEqual(mine.body.cached, false); // not answered by the run the submit stored, though the content is the same
  assert.strictEqual(mine.body.run.checkedBy, 'admin');
  assert.strictEqual(mine.body.run.versionId, 77);
  assert.strictEqual(mine.body.run.stale, false);
  assert.ok(![submitRun, recheck.body.run.id].includes(mine.body.run.id));
  assert.strictEqual((await call(admin, 'GET', '/syllabi/1/compliance')).body.run.id, mine.body.run.id);
  assert.strictEqual((await call(admin, 'GET', '/compliance?syllabus=all')).body.syllabi[0].run.id, mine.body.run.id);
  assert.strictEqual((await call(admin, 'POST', '/syllabi/1/compliance/recheck', {})).body.cached, true); // now the administrator's own run answers the same content
}));

test('re-check is rate limited per user; answers from a stored run are not counted', () => withServer(async ({ call }) => {
  for (let i = 0; i < 10; i++) assert.strictEqual((await call(fay, 'POST', '/syllabi/1/compliance/recheck', { force: true })).status, 200, 'call ' + i);
  const blocked = await call(fay, 'POST', '/syllabi/1/compliance/recheck', { force: true });
  assert.strictEqual(blocked.status, 429);
  assert.match(blocked.body.error, /too often/);
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/compliance/recheck', {})).status, 200);
}));

test('a nearly empty syllabus is "not enough content": no score, no AI call', () => withServer(async ({ call, db }) => {
  const p = new MockProvider();
  svc.setProvider(p);
  setContent(db, 1, F.empty());
  const r = await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.run.status, 'insufficient');
  assert.strictEqual(r.body.run.overall, null);
  assert.strictEqual(r.body.run.band, null);
  r.body.run.areas.forEach((a) => assert.strictEqual(a.score, null));
  assert.strictEqual(r.body.run.aiStatus, 'none');
  assert.strictEqual(p.calls, 0);
}));

test('the stored run reads back whole: areas, findings with their rule and step, recommendations with source and links', () => withServer(async ({ call, db }) => {
  setContent(db, 1, withGaps(conformingContent()));
  await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  await svc.settled();
  const { run } = (await call(fay, 'GET', '/syllabi/1/compliance')).body;
  assert.strictEqual(run.aiStatus, 'ok');
  assert.strictEqual(run.areas.length, 6);
  assert.ok(run.findings.length > 0 && run.findings.every((f) => f.source === 'rule' && f.ruleId && f.area && f.step));
  assert.ok(run.recommendations.length > 0);
  run.recommendations.forEach((x) => {
    assert.ok(['ai', 'rule'].includes(x.source));
    assert.ok(x.step && x.areas.length > 0);
    assert.ok(x.basedOn.every((id) => run.findings.some((f) => f.id === id)));
    assert.ok(['High', 'Medium', 'Low'].includes(x.level));
  });
  assert.strictEqual(run.passThreshold, 79);
  assert.strictEqual(run.contact.hoursPerWeek, 5);
}));

test('GET /compliance: an admin sees every submitted syllabus with the administrator\'s own check only, faculty only their own; averages skip unscored ones', () => withServer(async ({ call, db }) => {
  setContent(db, 1, conformingContent());
  addSyllabus(db, 2, { user_id: 6, status: 'for_revision', course_code: 'IT 205', content: JSON.stringify(conformingContent()) });
  addSyllabus(db, 3, { user_id: 6, status: 'draft', course_code: 'IT 206', content: JSON.stringify(conformingContent()) });
  addSyllabus(db, 4, { user_id: 5, status: 'submitted', course_code: 'IT 207', content: JSON.stringify(F.empty()) });
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  assert.strictEqual((await call(gus, 'POST', '/syllabi/2/submit', { note: 'Added the missing references.' })).status, 200);
  await call(fay, 'POST', '/syllabi/4/compliance/recheck', {}); // only a check, never submitted through the builder
  db.s.syllabi[1].status = 'submitted';

  // after the submits no administrator has checked anything: every submitted syllabus is still waiting
  const waiting = await call(admin, 'GET', '/compliance?syllabus=all');
  assert.deepStrictEqual(waiting.body.syllabi.map((x) => x.run), [null, null, null]);
  assert.strictEqual(waiting.body.summary.scored, 0);
  assert.strictEqual(waiting.body.summary.unchecked, 2); // syllabi 1 and 2 have a form; syllabus 4 has no submitted version
  assert.strictEqual((await call(admin, 'POST', '/syllabi/1/compliance/recheck', {})).status, 200);
  assert.strictEqual((await call(admin, 'POST', '/syllabi/2/compliance/recheck', {})).status, 200);

  const adminList = await call(admin, 'GET', '/compliance?syllabus=all');
  assert.strictEqual(adminList.status, 200);
  assert.deepStrictEqual(adminList.body.syllabi.map((x) => x.syllabusId).sort(), [1, 2, 4]); // no draft
  assert.strictEqual(adminList.body.summary.count, 3);
  assert.strictEqual(adminList.body.summary.scored, 2); // syllabus 4 has no administrator's check
  const score = adminList.body.syllabi.find((x) => x.syllabusId === 1).run.overall; // syllabi 1 and 2 have the same content
  assert.strictEqual(adminList.body.syllabi.find((x) => x.syllabusId === 2).run.overall, score);
  assert.strictEqual(adminList.body.summary.average, score);
  assert.strictEqual(adminList.body.syllabi.find((x) => x.syllabusId === 4).run, null);
  assert.strictEqual(adminList.body.summary.areas.length, 6);
  assert.ok(adminList.body.syllabi.every((x) => !('findings' in (x.run || {}))));

  const mine = await call(fay, 'GET', '/compliance?syllabus=all');
  assert.deepStrictEqual(mine.body.syllabi.map((x) => x.syllabusId).sort(), [1, 4]);
  assert.strictEqual(mine.body.syllabi.find((x) => x.syllabusId === 4).run.status, 'insufficient'); // the owner sees their own check
  const one = await call(fay, 'GET', '/compliance?syllabus=1');
  assert.ok(Array.isArray(one.body.run.findings));
  assert.strictEqual((await call(fay, 'GET', '/compliance?syllabus=abc')).status, 400);
  assert.strictEqual((await call(null, 'GET', '/compliance?syllabus=all')).status, 401);
}));

// A syllabus that was submitted before the compliance tables existed: a version with the form, and no run stored with it.
function submittedBefore(db, id, over = {}) {
  addSyllabus(db, id, { user_id: 5, status: 'submitted', course_code: 'IT 204', content: JSON.stringify(conformingContent()), ...over });
  db.s.versions.push({ version_id: 500 + id, syllabus_id: id, version_label: 'v1.0', content: db.s.syllabi[id].content });
}

test('an admin can check a submitted syllabus that has no stored run: the run is tied to its version and says an administrator made it', () => withServer(async ({ call, db }) => {
  submittedBefore(db, 2);
  const first = await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.cached, false);
  assert.strictEqual(first.body.run.versionId, 502);
  assert.strictEqual(first.body.run.createdBy, 1);
  assert.strictEqual(first.body.run.checkedBy, 'admin');
  assert.strictEqual(first.body.run.stale, false);
  assert.strictEqual(db.s.runs[0].version_id, 502);
  assert.strictEqual(db.s.runs[0].created_by, 1);
  // the same version is answered from the stored run; Re-check makes a new one with the same score
  const again = await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  assert.strictEqual(again.body.cached, true);
  assert.strictEqual(again.body.run.id, first.body.run.id);
  const forced = await call(admin, 'POST', '/syllabi/2/compliance/recheck', { force: true });
  assert.strictEqual(forced.body.cached, false);
  assert.strictEqual(forced.body.run.overall, first.body.run.overall);
  // the author sees it too, and the owner of the syllabus is recorded as the author of their own checks
  const mine = await call(fay, 'GET', '/syllabi/2/compliance');
  assert.strictEqual(mine.status, 200);
}));

test('an admin checks the submitted version, not the faculty member\'s working draft, and is not told it is stale by edits in progress', () => withServer(async ({ call, db }) => {
  submittedBefore(db, 2);
  const working = JSON.parse(db.s.syllabi[2].content);
  working.plan[0].contents = 'Edited after the submit, not submitted yet';
  setContent(db, 2, working);
  const run = (await call(admin, 'POST', '/syllabi/2/compliance/recheck', {})).body.run;
  assert.strictEqual(run.stale, false); // compared with the version
  assert.strictEqual((await call(admin, 'GET', '/syllabi/2/compliance')).body.run.stale, false);
  assert.strictEqual((await call(admin, 'GET', '/compliance?syllabus=2')).body.run.stale, false);
  assert.strictEqual((await call(admin, 'GET', '/compliance?syllabus=all')).body.syllabi[0].run.stale, false);
  // the author, comparing with their working draft, is told the stored admin run is not about it
  assert.strictEqual(db.s.runs[0].content_hash, svc.hashOf(JSON.parse(db.s.versions[0].content)));
  assert.notStrictEqual(db.s.runs[0].content_hash, svc.hashOf(working));
}));

test('a check an author made on the same content does not stand in for the administrator\'s check of the version', () => withServer(async ({ call, db }) => {
  submittedBefore(db, 2);
  assert.strictEqual((await call(fay, 'POST', '/syllabi/2/compliance/recheck', {})).status, 200); // no version stored with this one
  assert.strictEqual(db.s.runs[0].version_id, null);
  const admins = await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  assert.strictEqual(admins.body.cached, false);
  assert.strictEqual(admins.body.run.versionId, 502);
  assert.strictEqual(db.s.runs.length, 2);
}));

test('a syllabus submitted as an uploaded file has no form to check: the admin is told why, and it is listed as not checkable', () => withServer(async ({ call, db }) => {
  addSyllabus(db, 2, { user_id: 5, status: 'submitted', course_code: 'IT304', title: 'Data Analytics', course_id: null, content: null });
  db.s.versions.push({ version_id: 600, syllabus_id: 2, version_label: 'v1.1', content: null });
  const r = await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.body.code, 'no_form');
  assert.match(r.body.error, /uploaded file/);
  assert.strictEqual(db.s.runs.length, 0);
  const list = await call(admin, 'GET', '/compliance?syllabus=all');
  const row = list.body.syllabi.find((x) => x.syllabusId === 2);
  assert.strictEqual(row.checkable, false);
  assert.strictEqual(row.run, null);
  assert.strictEqual(list.body.summary.uploaded, 1);
  assert.strictEqual(list.body.summary.unchecked, 0);
  assert.strictEqual(list.body.summary.average, null);
  assert.strictEqual((await call(admin, 'GET', '/compliance?syllabus=2')).body.syllabus.checkable, false);
}));

test('the list names the faculty member, program and subject of each syllabus, and counts what still needs a check', () => withServer(async ({ call, db }) => {
  submittedBefore(db, 2);
  submittedBefore(db, 3, { user_id: 6, course_code: 'IT 205' });
  await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  const list = await call(admin, 'GET', '/compliance?syllabus=all');
  const a = list.body.syllabi.find((x) => x.syllabusId === 2);
  const b = list.body.syllabi.find((x) => x.syllabusId === 3);
  assert.deepStrictEqual([a.facultyName, a.programCode, a.programName, a.courseTitle, a.checkable], ['Fay F', 'BSIT', 'BS Information Technology', 'Computer Programming 2', true]);
  assert.deepStrictEqual([b.facultyName, b.programCode, b.checkable, b.run], ['Gus G', 'BSIT', true, null]);
  assert.strictEqual(list.body.summary.unchecked, 1); // syllabus 3 has a form and no check yet
  assert.strictEqual(list.body.summary.scored, 1);
  const one = await call(admin, 'GET', '/compliance?syllabus=3');
  assert.deepStrictEqual([one.body.syllabus.facultyName, one.body.syllabus.programCode, one.body.syllabus.checkable], ['Gus G', 'BSIT', true]);
  // a faculty member's own list carries the same fields
  const mine = await call(gus, 'GET', '/compliance?syllabus=all');
  assert.deepStrictEqual(mine.body.syllabi.map((x) => [x.syllabusId, x.facultyName]), [[3, 'Gus G']]);
}));

test('administrator checks are rate limited like any other, and a draft cannot be checked by an admin', () => withServer(async ({ call, db }) => {
  submittedBefore(db, 2);
  assert.strictEqual((await call(admin, 'POST', '/syllabi/1/compliance/recheck', {})).status, 404); // syllabus 1 is a draft
  for (let i = 0; i < 10; i++) assert.strictEqual((await call(admin, 'POST', '/syllabi/2/compliance/recheck', { force: true })).status, 200, 'call ' + i);
  const blocked = await call(admin, 'POST', '/syllabi/2/compliance/recheck', { force: true });
  assert.strictEqual(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  assert.strictEqual((await call(gus, 'POST', '/syllabi/2/compliance/recheck', {})).status, 404); // other faculty still cannot
}));

test('a syllabus with no stored run reads as run: null', () => withServer(async ({ call }) => {
  assert.deepStrictEqual((await call(fay, 'GET', '/syllabi/1/compliance')).body, { installed: true, run: null });
  const list = await call(fay, 'GET', '/compliance?syllabus=all');
  assert.strictEqual(list.body.syllabi[0].run, null);
  assert.strictEqual(list.body.summary.average, null);
}));

test('an approved syllabus cannot be checked again: 409 before the limiter is used, for the owner and the administrator', () => withServer(async ({ call, db }) => {
  submittedBefore(db, 2);
  assert.strictEqual((await call(admin, 'POST', '/syllabi/2/compliance/recheck', {})).status, 200); // checked before it is approved
  db.s.syllabi[2].status = 'approved';
  for (let i = 0; i < 12; i++) { // more than the limit: a refusal takes no slot
    const r = await call(admin, 'POST', '/syllabi/2/compliance/recheck', { force: true });
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.code, 'approved');
    assert.match(r.body.error, /approved, so it cannot be checked again/);
  }
  assert.strictEqual((await call(fay, 'POST', '/syllabi/2/compliance/recheck', {})).status, 409);
  assert.strictEqual(db.s.runs.length, 1);
  const read = await call(admin, 'GET', '/syllabi/2/compliance'); // reading the stored check stays open
  assert.strictEqual(read.status, 200);
  assert.ok(read.body.run);
}));

test('GET /compliance/history: one item per syllabus (its latest check), newest first, drafts and draft-only checks left out, the limit capped', () => withServer(async ({ call, db }) => {
  submittedBefore(db, 2);
  submittedBefore(db, 3);
  await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  await call(admin, 'POST', '/syllabi/2/compliance/recheck', { force: true });
  await call(admin, 'POST', '/syllabi/3/compliance/recheck', {});
  db.s.runs.push({ ...db.s.runs[0], run_id: 99, syllabus_id: 1, version_id: null }); // a draft check by an owner: not part of the history
  const h = await call(admin, 'GET', '/compliance/history');
  assert.strictEqual(h.status, 200);
  assert.strictEqual(h.body.installed, true);
  assert.deepStrictEqual(h.body.runs.map((r) => r.runId), [3, 2]); // syllabus 2 was checked twice: only its latest run is listed
  const top = h.body.runs[0];
  assert.strictEqual(top.syllabusId, 3);
  assert.strictEqual(top.checkedBy, 'admin');
  assert.strictEqual(top.facultyName, 'Fay F');
  assert.ok(top.createdAt && typeof top.overall === 'number' && top.scored === true);
  assert.strictEqual((await call(admin, 'GET', '/compliance/history?limit=1')).body.runs.length, 1);
  assert.strictEqual((await call(admin, 'GET', '/compliance/history?limit=100000')).body.runs.length, 2); // capped, not an error
  assert.strictEqual((await call(fay, 'GET', '/compliance/history')).status, 403);
  assert.strictEqual((await call(null, 'GET', '/compliance/history')).status, 401);
}));

test('GET /compliance/history before the migration: not installed, no runs', () => withServer({ installed: false }, async ({ call }) => {
  assert.deepStrictEqual((await call(admin, 'GET', '/compliance/history')).body, { installed: false, runs: [] });
}));

test('GET /compliance/runs/:id: one stored run in full, an earlier one too, an approved syllabus as well; admin only', () => withServer(async ({ call, db }) => {
  submittedBefore(db, 2);
  const first = (await call(admin, 'POST', '/syllabi/2/compliance/recheck', {})).body.run;
  const second = (await call(admin, 'POST', '/syllabi/2/compliance/recheck', { force: true })).body.run;
  const old = await call(admin, 'GET', '/compliance/runs/' + first.id);
  assert.strictEqual(old.status, 200);
  assert.strictEqual(old.body.run.id, first.id);
  assert.strictEqual(old.body.isLatest, false);
  assert.strictEqual(old.body.syllabus.syllabusId, 2);
  assert.ok(Array.isArray(old.body.run.areas) && old.body.run.areas.length === 6 && Array.isArray(old.body.run.findings));
  assert.strictEqual((await call(admin, 'GET', '/compliance/runs/' + second.id)).body.isLatest, true);
  db.s.syllabi[2].status = 'approved';
  const approved = await call(admin, 'GET', '/compliance/runs/' + second.id);
  assert.strictEqual(approved.status, 200);
  assert.strictEqual(approved.body.syllabus.status, 'approved');
  assert.strictEqual((await call(fay, 'GET', '/compliance/runs/' + second.id)).status, 403);
  assert.strictEqual((await call(admin, 'GET', '/compliance/runs/9999')).status, 404);
  assert.strictEqual((await call(admin, 'GET', '/compliance/runs/abc')).status, 404);
}));

test('GET /compliance/runs/:id before the migration: not installed', () => withServer({ installed: false }, async ({ call }) => {
  const r = await call(admin, 'GET', '/compliance/runs/1');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.installed, false);
}));

// The date filter. The mock db keeps a created_at per run, so a run can be placed on either side of a day boundary.
const stampRuns = (db, stamps) => stamps.forEach((t, i) => { db.s.runs[i].created_at = t; });

test('GET /compliance/history?from&to: a range keeps the checks stored in it (from inclusive, to exclusive), either side may be left out', () => withServer(async ({ call, db }) => {
  submittedBefore(db, 2);
  submittedBefore(db, 3);
  submittedBefore(db, 4);
  await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  await call(admin, 'POST', '/syllabi/3/compliance/recheck', {});
  await call(admin, 'POST', '/syllabi/4/compliance/recheck', {});
  stampRuns(db, ['2026-03-01T23:59:59Z', '2026-03-02T00:00:00Z', '2026-03-02T23:59:59Z']); // runs 1, 2, 3
  const ids = async (q) => (await call(admin, 'GET', '/compliance/history' + q)).body.runs.map((r) => r.runId);
  assert.deepStrictEqual(await ids(''), [3, 2, 1]);
  assert.deepStrictEqual(await ids('?from=2026-03-02T00:00:00Z&to=2026-03-03T00:00:00Z'), [3, 2]); // one day: 00:00:00 in, the next midnight out
  assert.deepStrictEqual(await ids('?from=2026-03-02T00:00:00Z'), [3, 2]);
  assert.deepStrictEqual(await ids('?to=2026-03-02T00:00:00Z'), [1]);
  assert.deepStrictEqual(await ids('?from=2026-04-01T00:00:00Z'), []); // nothing in range is an empty list, not an error
  assert.deepStrictEqual(await ids('?from=&to='), [3, 2, 1]); // empty values mean no filter
}));

test('GET /compliance/history with a range still lists one item per syllabus: its latest check, and only if that one is in range', () => withServer(async ({ call, db }) => {
  submittedBefore(db, 2);
  await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  await call(admin, 'POST', '/syllabi/2/compliance/recheck', { force: true }); // an older run 1 and the latest run 2 of the same syllabus
  stampRuns(db, ['2026-03-01T10:00:00Z', '2026-03-05T10:00:00Z']);
  const ids = async (q) => (await call(admin, 'GET', '/compliance/history' + q)).body.runs.map((r) => r.runId);
  assert.deepStrictEqual(await ids('?from=2026-03-01T00:00:00Z&to=2026-03-02T00:00:00Z'), []); // the older run is not listed even though it is in range
  assert.deepStrictEqual(await ids('?from=2026-03-05T00:00:00Z&to=2026-03-06T00:00:00Z'), [2]);
}));

test('GET /compliance/history: a bad date or a range that ends before it starts is a 400; a filter does not lift the cap or the admin check', () => withServer(async ({ call }) => {
  assert.strictEqual((await call(admin, 'GET', '/compliance/history?from=yesterday')).status, 400);
  assert.strictEqual((await call(admin, 'GET', '/compliance/history?to=2026-13-45')).status, 400);
  assert.strictEqual((await call(admin, 'GET', '/compliance/history?from=2026-03-05T00:00:00Z&to=2026-03-01T00:00:00Z')).status, 400);
  assert.strictEqual((await call(admin, 'GET', '/compliance/history?from=2026-03-01T00:00:00Z&limit=100000')).status, 200);
  assert.strictEqual((await call(fay, 'GET', '/compliance/history?from=2026-03-01T00:00:00Z')).status, 403);
}));

test('the history and the single-run read never show the run a faculty submit stored; only the administrator own check', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  db.s.syllabi[1].status = 'submitted';
  const submitRun = db.s.runs[0].run_id;
  assert.deepStrictEqual((await call(admin, 'GET', '/compliance/history')).body.runs, []); // nothing is checked yet, though a run is stored
  assert.strictEqual((await call(admin, 'GET', '/compliance/runs/' + submitRun)).status, 404); // and the author's run is not the administrator's to open
  const mine = await call(admin, 'POST', '/syllabi/1/compliance/recheck', {});
  const history = await call(admin, 'GET', '/compliance/history');
  assert.deepStrictEqual(history.body.runs.map((r) => r.runId), [mine.body.run.id]);
  assert.strictEqual(history.body.runs[0].checkedBy, 'admin');
  assert.strictEqual(history.body.runs[0].versionLabel, 'v1.0'); // the card says which version the check was made on
  const read = await call(admin, 'GET', '/compliance/runs/' + mine.body.run.id);
  assert.strictEqual(read.status, 200);
  assert.strictEqual(read.body.run.versionLabel, 'v1.0');
  assert.strictEqual(read.body.isLatest, true);
}));

// ---- a syllabus uploaded as a file: the administrator's rule check of the file and its course details ----
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const pdfText = (pages) => '%PDF-1.4\n' + Array.from({ length: pages }, (_, i) => `${i + 1} 0 obj\n<< /Type /Page >>\nendobj\n`).join('') + '%%EOF\n';
const withUploads = async (files, fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
  Object.entries(files).forEach(([name, text]) => fs.writeFileSync(path.join(dir, name), text, 'latin1'));
  const old = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = dir;
  try { await fn(dir); } finally { if (old === undefined) delete process.env.UPLOAD_DIR; else process.env.UPLOAD_DIR = old; fs.rmSync(dir, { recursive: true, force: true }); }
};
const uploaded = (db, id, file, over = {}) => {
  addSyllabus(db, id, { user_id: 5, status: 'submitted', course_code: 'FM 202', title: 'Fundamentals of Mathematics', content: null, file_path: file, ...over });
  db.s.versions.push({ version_id: 600 + id, syllabus_id: id, version_label: 'v1.0', content: null, file_path: file });
};

test('an administrator can check an uploaded PDF by the rules: the file and its course details, with a note that the template match is not done', () => withUploads({ 'fm.pdf': pdfText(5) }, () => withServer(async ({ call, db }) => {
  uploaded(db, 2, '/uploads/fm.pdf');
  const list = await call(admin, 'GET', '/compliance?syllabus=all');
  assert.strictEqual(list.body.syllabi.find((x) => x.syllabusId === 2).checkable, true); // an upload can be checked now
  const r = await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.cached, false);
  assert.strictEqual(r.body.run.checkedBy, 'admin');
  assert.strictEqual(r.body.run.versionId, 602);
  assert.strictEqual(r.body.run.overall, 100);
  assert.strictEqual(r.body.run.stale, false);
  assert.strictEqual(r.body.run.areas.find((a) => a.key === 'template').score, 100);
  assert.ok(r.body.run.areas.filter((a) => a.key !== 'template').every((a) => a.score === null)); // the form's areas do not apply to a file
  assert.strictEqual(r.body.run.aiStatus, 'none');
  assert.deepStrictEqual(r.body.run.recommendations.map((x) => x.title), ['Matching to the template is not done yet']);
  assert.strictEqual(db.s.runs[0].ai_status, 'none');
  // the same file is answered by the stored run; the admin screens count it as checked
  assert.strictEqual((await call(admin, 'POST', '/syllabi/2/compliance/recheck', {})).body.cached, true);
  assert.strictEqual((await call(admin, 'GET', '/compliance?syllabus=all')).body.syllabi.find((x) => x.syllabusId === 2).run.overall, 100);
  assert.strictEqual((await call(admin, 'GET', '/compliance/history')).body.runs[0].syllabusId, 2);
  assert.strictEqual((await call(admin, 'GET', '/syllabi/2/compliance')).body.run.stale, false);
})));

test('an uploaded file that is missing or not a whole PDF fails the blocking rules but is still stored and shown', () => withUploads({ 'bad.pdf': 'not a pdf' }, () => withServer(async ({ call, db }) => {
  uploaded(db, 2, '/uploads/bad.pdf');
  uploaded(db, 3, '/uploads/gone.pdf');
  const bad = await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  assert.strictEqual(bad.status, 200);
  assert.deepStrictEqual(bad.body.run.findings.map((f) => f.ruleId), ['U-02']);
  assert.strictEqual(bad.body.run.findings[0].severity, 'blocking');
  assert.strictEqual(bad.body.run.passed, false);
  const gone = await call(admin, 'POST', '/syllabi/3/compliance/recheck', {});
  assert.deepStrictEqual(gone.body.run.findings.map((f) => f.ruleId), ['U-01']);
  assert.strictEqual(db.s.runs.length, 2);
})));

test('a new upload (a new version) is not answered by the run of the old file, and only the administrator checks a file', () => withUploads({ 'v1.pdf': pdfText(3), 'v2.pdf': pdfText(6) }, () => withServer(async ({ call, db }) => {
  uploaded(db, 2, '/uploads/v1.pdf');
  const first = await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  assert.strictEqual((await call(fay, 'POST', '/syllabi/2/compliance/recheck', {})).status, 409); // the owner has no form to check, and files are the administrator's
  db.s.versions.push({ version_id: 700, syllabus_id: 2, version_label: 'v1.1', content: null, file_path: '/uploads/v2.pdf' });
  const list = await call(admin, 'GET', '/compliance?syllabus=all');
  assert.strictEqual(list.body.syllabi.find((x) => x.syllabusId === 2).run, null); // the new version has not been checked
  const second = await call(admin, 'POST', '/syllabi/2/compliance/recheck', {});
  assert.strictEqual(second.body.cached, false);
  assert.notStrictEqual(second.body.run.id, first.body.run.id);
  assert.strictEqual(second.body.run.versionId, 700);
})));

// ---- versions: one is saved only when the faculty member changed something, and says what ----
const changeDescription = (db, text) => { const c = JSON.parse(db.s.syllabi[1].content); c.description[0].t = text; setContent(db, 1, c); };

test('back from "For revision": an unchanged resubmission saves nothing, a change needs a note, and then a new version is saved', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200); // v1.0
  db.s.syllabi[1].status = 'for_revision'; // the administrator returned it
  const unchanged = await call(fay, 'POST', '/syllabi/1/submit', { note: 'I looked at it again.' });
  assert.strictEqual(unchanged.status, 409);
  assert.strictEqual(unchanged.body.code, 'unchanged');
  assert.match(unchanged.body.error, /Nothing has changed/);
  assert.strictEqual(db.s.versions.length, 1); // nothing was saved
  changeDescription(db, 'A better description of the course, rewritten after the review.');
  const noNote = await call(fay, 'POST', '/syllabi/1/submit', {});
  assert.strictEqual(noNote.status, 400);
  assert.strictEqual(noNote.body.code, 'need_note');
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', { note: 'too short' })).status, 400);
  assert.strictEqual(db.s.versions.length, 1);
  const ok = await call(fay, 'POST', '/syllabi/1/submit', { note: 'Rewrote the course description.' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.version, 'v1.1');
  assert.strictEqual(db.s.versions.length, 2);
}));

test('a spacing-only edit is not a change, but a single letter is', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  db.s.syllabi[1].status = 'for_revision';
  const c = JSON.parse(db.s.syllabi[1].content);
  const original = c.description[0].t;
  changeDescription(db, '  ' + original.replace(/ /g, '   ') + '\n\n');
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', { note: 'Fixed the spacing.' })).status, 409);
  changeDescription(db, original.replace('word3', 'wrod3'));
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', { note: 'Fixed a typo in the text.' })).status, 200);
}));

test('content that returns to what an earlier version said is a new version and needs its own administrator check', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200); // v1.0, version 77
  db.s.syllabi[1].status = 'submitted';
  const first = await call(admin, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.strictEqual(first.body.run.versionId, 77);
  const original = JSON.parse(db.s.syllabi[1].content).description[0].t;
  db.s.syllabi[1].status = 'for_revision';
  changeDescription(db, original + ' Extra sentence.');
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', { note: 'Added a sentence.' })).status, 200); // v1.1, version 78
  db.s.syllabi[1].version = 'v1.1'; db.s.syllabi[1].status = 'submitted';
  assert.strictEqual((await call(admin, 'POST', '/syllabi/1/compliance/recheck', {})).body.run.versionId, 78);
  db.s.syllabi[1].status = 'for_revision';
  changeDescription(db, original); // back to the v1.0 text
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', { note: 'Took the sentence out again.' })).status, 200); // v1.2, version 79
  db.s.syllabi[1].version = 'v1.2'; db.s.syllabi[1].status = 'submitted';
  const listed = await call(admin, 'GET', '/compliance?syllabus=all');
  assert.strictEqual(listed.body.syllabi.find((x) => x.syllabusId === 1).run, null); // v1.2 is waiting for a check
  const third = await call(admin, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.strictEqual(third.body.cached, false); // not answered by the v1.0 run, though the content is the same
  assert.strictEqual(third.body.run.versionId, 79);
  assert.ok((await call(admin, 'GET', '/compliance?syllabus=all')).body.syllabi.find((x) => x.syllabusId === 1).run);
  assert.strictEqual((await call(admin, 'POST', '/syllabi/1/compliance/recheck', {})).body.cached, true); // the same version is answered by its own run
}));

test('admin drafts cannot enter AI Checker; completed forms require an explicit handoff and approval', () => withServer(async ({call,db}) => {
  const draft=JSON.parse(db.s.syllabi[1].content);const course=await require('../lib/courses').loadCourse(db,10);draft.clos=course.clos;Object.assign(draft.meta,{code:course.code,title:course.title,program:course.program.code});db.s.syllabi[1].content=JSON.stringify(draft);
  db.s.syllabi[1].user_id=admin.id;db.s.people[admin.id]={first_name:'Ann',last_name:'A'};db.s.trackStatus=true;
  const list=await call(admin,'GET','/compliance?syllabus=all');
  assert.strictEqual(list.status,200);assert.ok(!list.body.syllabi.some(row=>row.syllabusId===1));
  assert.strictEqual((await call(admin,'POST','/syllabi/1/compliance/recheck',{})).status,409);assert.strictEqual(db.s.runs.length,0);
  assert.strictEqual((await call(admin,'POST','/syllabi/1/publish',{})).status,409);
  assert.strictEqual((await call(fay,'POST','/syllabi/1/prepare-check',{})).status,403);
  assert.strictEqual((await call({id:2,role:'admin'},'POST','/syllabi/1/prepare-check',{})).status,404);
  assert.strictEqual((await call(admin,'POST','/syllabi/1/prepare-check',{})).status,200);
  assert.strictEqual(db.s.syllabi[1].status,'under_review');assert.strictEqual(db.s.runs.length,0);
  const queued=await call(admin,'GET','/compliance?syllabus=all');assert.ok(queued.body.syllabi.some(row=>row.syllabusId===1&&row.status==='under_review'));
  const check=await call(admin,'POST','/syllabi/1/compliance/recheck',{});
  assert.strictEqual(check.status,200);await svc.settled();
  assert.strictEqual(db.s.syllabi[1].status,'under_review'); // a check never approves
  const state=db.s.runs[0].ai_status;
  for (const ai_status of ['pending','failed']) { db.s.runs[0].ai_status=ai_status; assert.strictEqual((await call(admin,'POST','/syllabi/1/publish',{})).status,409); }
  db.s.runs[0].ai_status=state;
  const newest=await call(admin,'POST','/syllabi/1/compliance/recheck',{force:true});await svc.settled();
  assert.strictEqual((await call(admin,'POST','/syllabi/1/publish',{reviewedRunId:check.body.run.id})).status,409);
  assert.strictEqual((await call(admin,'POST','/syllabi/1/publish',{reviewedRunId:'invalid'})).status,400);
  const published=await call(admin,'POST','/syllabi/1/publish',{reviewedRunId:newest.body.run.id});
  assert.strictEqual(published.status,200,JSON.stringify(published.body));assert.strictEqual(published.body.status,'approved');
  assert.strictEqual(db.s.syllabi[1].status,'approved');assert.strictEqual(db.s.versions.length,1);
  assert.strictEqual((await call(admin,'POST','/syllabi/1/publish',{})).status,409);
}));
test('incomplete admin forms remain drafts; returning for edits removes the item and invalidates its old check', () => withServer(async ({call,db}) => {
  db.s.syllabi[1].user_id=admin.id;db.s.trackStatus=true;
  const original=JSON.parse(db.s.syllabi[1].content);const course=await require('../lib/courses').loadCourse(db,10);original.clos=course.clos;Object.assign(original.meta,{code:course.code,title:course.title,program:course.program.code});
  const incomplete=structuredClone(original);incomplete.grading.rows[0].pct=1;db.s.syllabi[1].content=JSON.stringify(incomplete);
  const refused=await call(admin,'POST','/syllabi/1/prepare-check',{});assert.strictEqual(refused.status,409);assert.ok(refused.body.failed.length);assert.strictEqual(db.s.syllabi[1].status,'draft');
  db.s.syllabi[1].content=JSON.stringify(original);
  assert.strictEqual((await call(admin,'POST','/syllabi/1/prepare-check',{})).status,200);
  assert.strictEqual((await call(admin,'POST','/syllabi/1/compliance/recheck',{})).status,200);await svc.settled();
  assert.strictEqual((await call(fay,'POST','/syllabi/1/resume-draft',{})).status,403);
  assert.strictEqual((await call(admin,'POST','/syllabi/1/resume-draft',{})).status,200);
  assert.strictEqual(db.s.syllabi[1].status,'draft');
  assert.ok(!(await call(admin,'GET','/compliance?syllabus=all')).body.syllabi.some(row=>row.syllabusId===1));
  assert.strictEqual((await call(admin,'POST','/syllabi/1/compliance/recheck',{})).status,409);
  assert.strictEqual((await call(admin,'POST','/syllabi/1/prepare-check',{})).status,200);
  assert.strictEqual((await call(admin,'POST','/syllabi/1/publish',{})).status,409); // a new review cycle requires another check even without edits
  assert.strictEqual(db.s.versions.length,1); // no duplicate revision for an unchanged form
  const prior = db.s.versions[0].content;
  assert.strictEqual((await call(admin,'POST','/syllabi/1/resume-draft',{})).status,200);
  const revised=JSON.parse(db.s.syllabi[1].content);revised.description.push('Additional administrator revision after AI review.');
  const saved=await call(admin,'PUT','/syllabi/1/content',{sections:{description:revised.description}});
  assert.strictEqual(saved.status,200,JSON.stringify(saved.body));
  assert.strictEqual(db.s.versions.length,1); // autosave leaves history untouched
  const next=await call(admin,'POST','/syllabi/1/prepare-check',{});
  assert.strictEqual(next.status,200,JSON.stringify(next.body));assert.strictEqual(next.body.version,'v1.1');
  assert.strictEqual(db.s.versions.length,2);assert.strictEqual(db.s.versions[0].content,prior);
  assert.ok(JSON.parse(db.s.versions[1].content).description.includes('Additional administrator revision after AI review.'));
}));

test('the AI judges the fields: a placeholder description it flags lowers the score, shows as an AI finding, and the recommendations are written from it', () => {
  const { LlmProvider } = require('../lib/compliance/providers');
  require('../lib/compliance/meaning').clearVerdictCache();
  const prompts = [];
  const client = { complete: async (prompt) => {
    prompts.push(prompt);
    if (prompt.includes('ITEMS:')) return JSON.stringify([{ id: 'desc', reason: 'placeholder text, nothing about the course' }]);
    return JSON.stringify([{ title: 'Rewrite the course description', text: 'Describe what the course covers.', basedOn: ['J-01:description'] }]);
  } };
  return withServer({ provider: new LlmProvider({ client, model: 'test-model' }) }, async ({ call, db }) => {
    setContent(db, 1, withGaps(conformingContent()));
    const r = await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.run.aiStatus, 'pending', 'a clean run still waits for the AI to judge the fields');
    const before = r.body.run.overall;
    await svc.settled();
    const run = db.s.runs[0];
    assert.strictEqual(run.ai_status, 'ok');
    assert.strictEqual(run.model, 'test-model');
    assert.ok(run.overall < before, 'the score fell once the AI flagged the description: ' + run.overall + ' < ' + before);
    const ai = db.s.findings.filter((f) => f.kind === 'finding' && f.source === 'ai');
    assert.deepStrictEqual(ai.map((f) => f.rule_id), ['J-01']);
    assert.match(ai[0].message, /placeholder text, nothing about the course/);
    const recs = db.s.findings.filter((f) => f.kind === 'recommendation');
    assert.ok(recs.some((f) => f.title === 'Rewrite the course description'));
    assert.strictEqual(prompts.length, 2, 'one call to judge the fields, one for the recommendations');
    assert.strictEqual(db.s.areas.filter((a) => a.run_id === run.run_id).length, 6, 'the area scores were replaced, not doubled');
    const read = await call(fay, 'GET', '/syllabi/1/compliance');
    assert.strictEqual(read.body.run.overall, run.overall);
    assert.ok(read.body.run.findings.some((f) => f.ruleId === 'J-01' && f.source === 'ai'));
  });
});

test('if the AI cannot judge the fields, the rules\' own score stands and the run records that the AI failed', () => {
  const { LlmProvider } = require('../lib/compliance/providers');
  require('../lib/compliance/meaning').clearVerdictCache();
  const client = { complete: async (prompt) => { if (prompt.includes('ITEMS:')) throw Object.assign(new Error('down'), { code: 'http_503' }); return '[]'; } };
  return withServer({ provider: new LlmProvider({ client, model: 'm' }) }, async ({ call, db }) => {
    setContent(db, 1, withGaps(conformingContent()));
    const r = await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
    const before = r.body.run.overall;
    await svc.settled();
    const run = db.s.runs[0];
    assert.strictEqual(run.overall, before);
    assert.ok(!db.s.findings.some((f) => f.source === 'ai' && f.kind === 'finding'));
    assert.strictEqual(run.ai_status, 'failed');
  });
});

// ---- suggested fixes (suggest.js, fixes.js): the owner asks, nothing in the form changes ----
const LONG = 'This course introduces students to programming. They learn variables, loops, functions and simple data structures, practise them in weekly laboratory work, and build small programs that solve everyday problems, working alone and in pairs.';
const suggestingProvider = (calls = []) => Object.assign(new MockProvider(), {
  judge: async (prompt) => {
    if (!/fix the parts of a course syllabus/.test(prompt)) return '[]'; // the meaning check: everything is fine
    calls.push(prompt);
    const item = JSON.parse(prompt.split('ITEMS: ')[1]).find((x) => x.role === 'course description');
    return JSON.stringify(item ? [{ id: item.id, text: LONG, why: 'Added what the course covers.' }] : []);
  },
});
const withProblems = (db) => { const c = conformingContent(); c.description = [{ t: 'A programming course.' }]; c.grading.rows[0].pct += 10; setContent(db, 1, c); return c; };

test('suggestions: the owner gets the fixes, the score they would give and what is left; the form is not changed', () => withServer({ provider: suggestingProvider() }, async ({ call, db }) => {
  withProblems(db);
  const before = db.s.syllabi[1].content;
  await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  const got = await call(fay, 'POST', '/syllabi/1/suggestions', {});
  assert.strictEqual(got.status, 200);
  assert.strictEqual(got.body.ai, 'ok');
  const kinds = got.body.suggestions.map((x) => x.kind).sort();
  assert.deepStrictEqual(kinds, ['grading', 'institution', 'institution', 'text']); // the test form's vision and mission are not the LCUP's
  const text = got.body.suggestions.find((x) => x.kind === 'text');
  assert.deepStrictEqual([text.changes[0].before, text.changes[0].after], ['A programming course.', LONG]);
  assert.ok(got.body.suggestions.every((x) => x.id && x.ops.length && Array.isArray(x.covers)));
  assert.ok(got.body.score.after > got.body.score.now, JSON.stringify(got.body.score));
  assert.ok(Array.isArray(got.body.remaining));
  assert.strictEqual(db.s.syllabi[1].content, before);
}));

test('suggestions: only the owner, only after a current check, and not on an approved syllabus', () => withServer({ provider: suggestingProvider() }, async ({ call, db }) => {
  const c = withProblems(db);
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/suggestions', {})).body.code, 'no_check');
  await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.strictEqual((await call(gus, 'POST', '/syllabi/1/suggestions', {})).status, 404); // another faculty member cannot even see it
  c.description = [{ t: 'Changed after the check.' }];
  setContent(db, 1, c);
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/suggestions', {})).body.code, 'stale');
  await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  db.s.syllabi[1].status = 'approved';
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/suggestions', {})).body.code, 'approved');
}));

test('suggestions: without an AI provider the fixes that need no AI still come', () => withServer({ provider: null }, async ({ call, db }) => {
  withProblems(db);
  await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  const got = await call(fay, 'POST', '/syllabi/1/suggestions', {});
  assert.strictEqual(got.status, 200);
  assert.strictEqual(got.body.ai, 'unavailable');
  assert.deepStrictEqual(got.body.suggestions.map((x) => x.kind), ['grading', 'institution', 'institution']);
}));

test('suggestions: asking again for the same text uses the remembered answer; the owner is masked in the prompt', () => {
  const calls = [];
  return withServer({ provider: suggestingProvider(calls) }, async ({ call, db }) => {
    require('../lib/compliance/suggest').clearCache();
    const c = conformingContent();
    c.description = [{ t: 'Prepared by Fay F. A programming course.' }];
    setContent(db, 1, c);
    await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
    await call(fay, 'POST', '/syllabi/1/suggestions', {});
    await call(fay, 'POST', '/syllabi/1/suggestions', {});
    assert.strictEqual(calls.length, 1);
    assert.doesNotMatch(calls[0], /Fay/);
  });
});
