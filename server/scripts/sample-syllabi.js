// Makes five sample syllabi from four programs (BSIT x2, BSIT-CS, BSCPE, BSIE) through the application's own API routes, for trying the app.
//   node scripts/sample-syllabi.js            # from server/
// What it does, as the administrator and then as the faculty member (the routes run in this process against your database, so no password is
// needed; sessions are supplied by the script):
//   1. fills what the catalog still lacks for those subjects: the school vision, mission and EGAs, each program's EGAs and program outcomes,
//      and each subject's setup and CLOs (nothing that already exists is changed);
//   2. builds each syllabus the way the Syllabus Builder does (the subject's CLOs, units and pre-requisite, 15 weekly lessons and the three
//      examination rows), saves it as a draft, submits it, and has the administrator check and approve it, or leave it as submitted or a draft.
// The AI step uses the offline provider unless COMPLIANCE_AI_PROVIDER says otherwise, so it costs no tokens. A subject that already has a
// syllabus of its faculty member is skipped, so it is safe to run again.
require('dotenv').config();
process.env.COMPLIANCE_AI_PROVIDER = process.env.COMPLIANCE_AI_PROVIDER || 'mock';
const path = require('path');
const { pathToFileURL } = require('url');
const express = require('express');
const mysql = require('mysql2/promise');
const { toSessionUser } = require('../middleware/auth');
const svc = require('../lib/compliance/service');
const { PROGRAM_POS, SUBJECTS, VALUES } = require('./sample-syllabi-data');

const log = (m) => console.log(m);

async function main() {
  const root = path.join(__dirname, '..', '..', 'src');
  const model = await import(pathToFileURL(path.join(root, 'lib', 'syllabusModel.js')).href);
  const seed = await import(pathToFileURL(path.join(root, 'data', 'outcomesSeed.js')).href);
  const db = await mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, connectionLimit: 5 });
  const [[admin]] = await db.query("SELECT * FROM users WHERE role = 'admin' ORDER BY user_id LIMIT 1");
  const [[faculty]] = await db.query("SELECT * FROM users WHERE role = 'faculty' ORDER BY user_id LIMIT 1");
  if (!admin || !faculty) throw new Error('Needs one administrator and one faculty account.');

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  const people = new Map([[String(admin.user_id), admin], [String(faculty.user_id), faculty]]);
  app.use((req, res, next) => { const row = people.get(String(req.headers['x-user'])); req.session = row ? { user: toSessionUser(row), destroy: (cb) => cb && cb() } : {}; next(); });
  app.locals.db = db;
  app.use('/api/institution', require('../routes/institution'));
  app.use('/api/programs', require('../routes/programs'));
  app.use('/api/courses', require('../routes/courses'));
  app.use('/api/users', require('../routes/users'));
  app.use('/api/syllabi', require('../routes/syllabi'));
  app.use('/api/syllabi', require('../routes/syllabusContent'));
  app.use('/api', require('../routes/compliance'));
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (who, method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'x-user': String(who.user_id) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(`${method} ${url}: ${res.status} ${data.error || data.message || ''}`); err.data = data; err.status = res.status; throw err; }
    return data;
  };

  // ---- 1. the catalog
  const lcup = require('../lib/compliance/standard-v4.json').constants.institution;
  const inst = await call(admin, 'GET', '/api/institution/outcomes');
  if (!inst.vision) {
    await call(admin, 'PUT', '/api/institution/outcomes', { vision: lcup.vision, mission: lcup.mission, egas: seed.INSTITUTION.egas.map((e) => ({ no: e.no, name: e.name, short: e.short })) });
    log('institution vision, mission and EGAs: added');
  }
  const programs = await call(admin, 'GET', '/api/programs');
  const prog = (code) => programs.find((p) => p.code === code);
  for (const code of [...new Set(SUBJECTS.map((s) => s.program))]) {
    const p = prog(code);
    let o = await call(admin, 'GET', `/api/programs/${p.id}/outcomes`);
    if (!o.egas.length) {
      o = await call(admin, 'PUT', `/api/programs/${p.id}/egas`, { egas: seed.INSTITUTION.egas.map((e) => ({ no: e.no, name: e.name, short: e.short })), version: o.versions.egas });
      log(`${code}: EGAs added`);
    }
    if (!o.pos.length) {
      const pos = code === 'BSIT' ? seed.PROGRAMS.BSIT.pos : PROGRAM_POS[code].map(([short, text, egas], i) => ({ no: i + 1, short, text, egas }));
      await call(admin, 'PUT', `/api/programs/${p.id}/outcomes`, { pos: pos.map((x) => ({ no: x.no, short: x.short, text: x.text, egas: x.egas })), version: o.versions.pos });
      log(`${code}: ${pos.length} program outcomes added`);
    }
  }

  const results = [];
  for (const spec of SUBJECTS) {
    const list = await call(admin, 'GET', `/api/courses?program=${encodeURIComponent(spec.program)}`);
    const found = list.find((c) => c.code === spec.code);
    if (!found) { log(`${spec.program} ${spec.code}: not in the catalog, skipped`); continue; }
    let course = await call(admin, 'GET', `/api/courses/${found.id}`);
    const progData = await call(admin, 'GET', `/api/programs/${course.program.id}/outcomes`);
    const st = course.standards;
    if (!st.vision) {
      course = await call(admin, 'PUT', `/api/courses/${found.id}/standards`, { section: 'vision', value: { vision: lcup.vision, mission: lcup.mission }, version: st.versions.vision });
      log(`${spec.code}: vision and mission set`);
    }
    if (!course.standards.egas.length) {
      course = await call(admin, 'PUT', `/api/courses/${found.id}/standards`, { section: 'egas', value: progData.egas.map((e) => ({ no: e.no, name: e.name, short: e.short })), version: course.standards.versions.egas });
    }
    if (!course.standards.pos.length) {
      course = await call(admin, 'PUT', `/api/courses/${found.id}/standards`, { section: 'pos', value: progData.pos.map((p) => ({ no: p.no, short: p.short, text: p.text, egas: p.egas })), version: course.standards.versions.pos });
    }
    if (!course.clos.length) {
      course = await call(admin, 'PUT', `/api/courses/${found.id}/clos`, { clos: spec.clos.map(([title, level, statement, egas, pos]) => ({ title, level, statement, egas, pos })), version: course.version });
      log(`${spec.code}: ${spec.clos.length} CLOs added`);
    }
    course = await call(admin, 'GET', `/api/courses/${found.id}`);

    // ---- 2. the syllabus
    const mine = await call(faculty, 'GET', '/api/syllabi');
    if (mine.some((s) => s.courseId === found.id)) { log(`${spec.program} ${spec.code}: already has a syllabus, skipped`); continue; }
    let n = 0;
    const newId = () => 'sg' + (++n) + Math.random().toString(36).slice(2, 6);
    const d = model.applyCourse(model.emptyDraft(newId), course);
    d.description = [{ id: newId(), t: spec.description }];
    const cloTag = (i) => 'clo:' + course.clos[i % course.clos.length].id;
    const weeks = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17];
    d.plan = [];
    spec.topics.forEach((line, i) => {
      const [verb, topic, what] = line.split('|').map((x) => x.trim());
      d.plan.push({ id: newId(), kind: 'lesson', week: String(weeks[i]), ilos: [{ id: newId(), text: `${verb} ${what}`, tags: [cloTag(i)] }], contents: `**${topic}**`,
        activities: `- Lecture and discussion on ${what}\n- Guided practice on ${what}`, tasks: `- Quiz on ${what}`, values: VALUES[i % VALUES.length] });
    });
    [['PRELIM', 6], ['MIDTERM', 12], ['FINAL', 18]].forEach(([name, week]) => {
      const at = d.plan.findIndex((r) => Number(r.week) > week);
      const row = { id: newId(), kind: 'exam', week: String(week), ilos: [{ id: newId(), text: '', tags: [] }], contents: `**${name} EXAMINATION**`, activities: '- Examination', tasks: '', values: '' };
      if (at < 0) d.plan.push(row); else d.plan.splice(at, 0, row);
    });
    d.reqs = spec.reqs.map((t) => ({ id: newId(), t }));
    for (const g of ['books', 'program', 'online', 'electronics']) {
      const items = spec.refs[g] || [];
      d.refs[g] = items.length ? { na: false, items: items.map((t) => ({ id: newId(), t })) } : { na: true, items: [] };
    }
    d.grading.rows = spec.grading.map(([label, pct]) => ({ id: newId(), label, pct }));

    const draft = await call(faculty, 'POST', '/api/syllabi/drafts');
    const sections = {};
    ['meta', 'outcomes', 'description', 'clos', 'plan', 'reqs', 'refs', 'grading'].forEach((k) => { if (d[k] !== undefined) sections[k] = d[k]; });
    await call(faculty, 'PUT', `/api/syllabi/${draft.id}/content`, { sections, schemaVersion: model.SCHEMA_VERSION });
    const row = { id: draft.id, program: spec.program, code: spec.code, title: course.title, want: spec.final, status: 'draft', score: null };
    results.push(row);
    if (spec.final === 'draft') continue;

    const sub = await call(faculty, 'POST', `/api/syllabi/${draft.id}/submit`, { note: '' });
    row.status = 'submitted';
    row.score = sub.check && sub.check.overall !== undefined ? sub.check.overall : null;
    if (spec.final === 'approved') {
      const run = await call(admin, 'POST', `/api/syllabi/${draft.id}/compliance/recheck`, {});
      row.score = run.run && run.run.overall !== undefined ? run.run.overall : row.score;
      await call(admin, 'PUT', `/api/syllabi/${draft.id}`, { status: 'approved' });
      row.status = 'approved';
    }
  }
  await svc.settled(); // let the offline AI step finish writing its recommendations
  server.close();
  await db.end();
  log('\nid | program | subject | status | score');
  results.forEach((r) => log(`${r.id} | ${r.program} | ${r.code} ${r.title} | ${r.status}${r.status !== r.want ? ' (wanted ' + r.want + ')' : ''} | ${r.score === null ? '-' : r.score + '%'}`));
}

main().catch((err) => { console.error('Failed:', err.message); if (err.data) console.error(JSON.stringify(err.data).slice(0, 1500)); process.exit(1); });
