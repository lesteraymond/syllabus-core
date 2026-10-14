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
  const prog = (where) => s.programs.find(where);
  const handle = (sql, p = []) => {
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
    if (sql.startsWith('SELECT clos_version AS v')) return [[{ v: s.courses.find((c) => c.course_id === p[0]).clos_version }]];
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
    if (sql.startsWith('DELETE FROM ai_findings')) { s.findings = s.findings.filter((f) => !(f.run_id === p[0] && f.kind === 'recommendation')); return [{}]; }
    if (sql.startsWith('UPDATE ai_check_runs SET ai_status = ?, ai_error = ?, provider')) {
      const [ai_status, ai_error, provider, model, prompt_version, id] = p;
      Object.assign(s.runs.find((r) => r.run_id === id), { ai_status, ai_error, provider, model, prompt_version });
      return [{}];
    }
    if (sql.startsWith("UPDATE ai_check_runs SET ai_status = 'failed'")) { Object.assign(s.runs.find((r) => r.run_id === p[1]), { ai_status: 'failed', ai_error: p[0] }); return [{}]; }
    if (sql.startsWith('SELECT * FROM ai_check_runs WHERE syllabus_id = ? AND content_hash')) return [s.runs.filter((r) => r.syllabus_id === p[0] && r.content_hash === p[1] && r.standard_version === p[2] && (!sql.includes('version_id IS NOT NULL') || r.version_id !== null)).slice(-1)];
    if (sql.startsWith('SELECT * FROM ai_check_runs WHERE syllabus_id')) return [s.runs.filter((r) => r.syllabus_id === p[0] && (!sql.includes('version_id IS NOT NULL') || r.version_id !== null)).slice(-1)];
    if (sql.startsWith('SELECT * FROM ai_check_runs WHERE run_id')) return [s.runs.filter((r) => r.run_id === p[0])];
    if (sql.startsWith('SELECT r.* FROM ai_check_runs')) return [p[0].map((id) => s.runs.filter((r) => r.syllabus_id === id && (!sql.includes('version_id IS NOT NULL') || r.version_id !== null)).slice(-1)[0]).filter(Boolean)];
    if (sql.startsWith('SELECT run_id, area_key')) return [s.areas.filter((a) => p[0].includes(a.run_id))];
    if (sql.startsWith('SELECT * FROM ai_findings')) return [s.findings.filter((f) => f.run_id === p[0]).sort((x, y) => x.position - y.position)];
    // the list: one row per syllabus with the faculty member, program and subject the real query joins in
    const labelled = (x) => ({ ...x, ...(s.people[x.user_id] || { first_name: '', last_name: '' }), course_title: x.course_id ? 'Computer Programming 2' : null, program_code: x.course_id ? 'BSIT' : null, program_name: x.course_id ? 'BS Information Technology' : null, curriculum_program: null });
    if (sql.startsWith('SELECT s.syllabus_id, s.user_id')) {
      const all = Object.values(s.syllabi);
      const rows = sql.includes('s.user_id = ?') ? all.filter((x) => x.user_id === p[0]) : all.filter((x) => x.status !== 'draft');
      return [rows.map((x) => { const r = labelled(x); if (!sql.includes('s.content,')) delete r.content; return r; })];
    }
    if (sql.startsWith('SELECT r.run_id')) { // the history: runs stored with a version, newest first, with the syllabus's labels
      let at = 0; // the placeholders after the first ?-free part: from, then to, then the limit, each only when the SQL has it
      const lo = sql.includes('>= FROM_UNIXTIME') ? p[at++] * 1000 : -Infinity;
      const hi = sql.includes('< FROM_UNIXTIME') ? p[at++] * 1000 : Infinity;
      const limit = p[at];
      const inRange = (r) => { const t = Date.parse(r.created_at); return t >= lo && t < hi; };
      const latestOf = (id) => Math.max(...s.runs.filter((x) => x.syllabus_id === id && x.version_id !== null).map((x) => x.run_id));
      return [s.runs.filter((r) => r.version_id !== null && s.syllabi[r.syllabus_id].status !== 'draft' && r.run_id === latestOf(r.syllabus_id) && inRange(r)).reverse().slice(0, limit)
        .map((r) => ({ ...labelled(s.syllabi[r.syllabus_id]), run_id: r.run_id, syllabus_id: r.syllabus_id, overall: r.overall, status: r.status, passed: r.passed, ai_status: r.ai_status, created_by: r.created_by, created_at: r.created_at, syllabus_status: s.syllabi[r.syllabus_id].status }))];
    }
    if (sql.startsWith('SELECT u.first_name, u.last_name')) return [s.syllabi[p[0]] ? [labelled(s.syllabi[p[0]])] : []];
    if (sql.startsWith('SELECT first_name, last_name FROM users WHERE user_id')) return [s.people[p[0]] ? [s.people[p[0]]] : []];
    if (sql.startsWith('INSERT INTO syllabus_versions')) { const v = { version_id: s.versionId + s.versions.length, syllabus_id: p[0], version_label: p[1], content: p[8] }; s.versions.push(v); return [{ insertId: v.version_id }]; }
    if (sql.startsWith('SELECT version_id, version_label, content FROM syllabus_versions')) return [s.versions.filter((v) => v.syllabus_id === p[0]).slice(-1)];
    if (sql.startsWith('SELECT v.syllabus_id, v.content FROM syllabus_versions')) return [p[0].map((id) => s.versions.filter((v) => v.syllabus_id === id).slice(-1)[0]).filter(Boolean)];
    if (sql.startsWith('UPDATE syllabi SET content')) { s.saved.push(JSON.parse(p[0])); s.syllabi[p[1]].content = p[0]; return [{}]; }
    if (/^(INSERT|UPDATE|DELETE)/.test(sql)) return [{}];
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
  assert.strictEqual(run.standard_version, 'v4');
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

  db.s.settings.vision = 'A new vision';
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
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  assert.ok((await call(admin, 'GET', '/syllabi/1/compliance')).body.run); // now there is one stored with the version
}));

test('an admin reviewing a submission sees the run stored with that version, not a re-check the owner ran afterwards', () => withServer(async ({ call, db }) => {
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  db.s.syllabi[1].status = 'submitted';
  const submitRun = db.s.runs[0].run_id;
  const edited = JSON.parse(db.s.syllabi[1].content);
  edited.plan[0].contents = 'Edited after the submit';
  setContent(db, 1, edited);
  const recheck = await call(fay, 'POST', '/syllabi/1/compliance/recheck', {});
  assert.notStrictEqual(recheck.body.run.id, submitRun);
  assert.strictEqual((await call(fay, 'GET', '/syllabi/1/compliance')).body.run.id, recheck.body.run.id); // the owner sees the newest
  const seen = await call(admin, 'GET', '/syllabi/1/compliance');
  assert.strictEqual(seen.body.run.id, submitRun); // the reviewer sees the one stored with the version
  assert.strictEqual(seen.body.run.versionId, 77);
  assert.strictEqual(seen.body.run.stale, false); // compared with the version the reviewer is looking at, not the author's edits in progress
  assert.strictEqual((await call(admin, 'GET', '/compliance?syllabus=1')).body.run.id, submitRun);
  assert.strictEqual((await call(admin, 'GET', '/compliance?syllabus=all')).body.syllabi[0].run.id, submitRun);
  assert.strictEqual((await call(fay, 'GET', '/compliance?syllabus=all')).body.syllabi[0].run.id, recheck.body.run.id);
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

test('GET /compliance: an admin sees every submitted syllabus (its version run), faculty only their own; averages skip unscored ones', () => withServer(async ({ call, db }) => {
  setContent(db, 1, conformingContent());
  addSyllabus(db, 2, { user_id: 6, status: 'under_review', course_code: 'IT 205', content: JSON.stringify(conformingContent()) });
  addSyllabus(db, 3, { user_id: 6, status: 'draft', course_code: 'IT 206', content: JSON.stringify(conformingContent()) });
  addSyllabus(db, 4, { user_id: 5, status: 'submitted', course_code: 'IT 207', content: JSON.stringify(F.empty()) });
  assert.strictEqual((await call(fay, 'POST', '/syllabi/1/submit', {})).status, 200);
  assert.strictEqual((await call(gus, 'POST', '/syllabi/2/submit', {})).status, 200);
  await call(fay, 'POST', '/syllabi/4/compliance/recheck', {}); // only a check, never submitted through the builder
  db.s.syllabi[1].status = 'submitted';

  const adminList = await call(admin, 'GET', '/compliance?syllabus=all');
  assert.strictEqual(adminList.status, 200);
  assert.deepStrictEqual(adminList.body.syllabi.map((x) => x.syllabusId).sort(), [1, 2, 4]); // no draft
  assert.strictEqual(adminList.body.summary.count, 3);
  assert.strictEqual(adminList.body.summary.scored, 2); // syllabus 4 has no run stored with a version
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
