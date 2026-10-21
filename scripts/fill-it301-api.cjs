// Populate the existing demo owner's IT 301 draft through authenticated HTTP only.
// Defaults to a dry run. Pass --write to back up, save and verify. Never submits or publishes.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const base = 'http://localhost:3001/api';
const sectionKeys = ['meta', 'outcomes', 'description', 'clos', 'plan', 'reqs', 'refs', 'grading'];
const blank = value => !String(value ?? '').trim();
const clone = value => JSON.parse(JSON.stringify(value));
async function main() {
  // Sign in as yourself: FILL_EMAIL and FILL_PASSWORD (read from the environment, never printed or saved). Without them, the documented demo login is used.
  let demo;
  if (process.env.FILL_EMAIL && process.env.FILL_PASSWORD) demo = [null, process.env.FILL_EMAIL, process.env.FILL_PASSWORD];
  else {
    const readme = await fs.readFile(path.join(root, 'README.md'), 'utf8');
    demo = readme.match(/^\| Admin \(Dean\) \|\s*([^|]+)\|\s*([^|]+)\|/m);
    if (!demo) throw new Error('The documented demo login is unavailable.');
  }
  const loginResponse = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: demo[1].trim(), password: demo[2].trim() }) });
  const login = await loginResponse.json();
  if (!loginResponse.ok) throw new Error('Sign-in failed (' + loginResponse.status + '): ' + (login.message || login.error || 'no reason given'));
  if (login.user.mustChangePassword) throw new Error('That account must change its password in the app first.');
  // Protected endpoints use the signed session cookie. Tokens/cookies never leave this process.
  const headers = { 'Content-Type': 'application/json', Cookie: loginResponse.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
  const request = async (url, options = {}) => {
    const response = await fetch(base + url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(`${options.method || 'GET'} ${url}: ${response.status} ${data.message || data.error}`);
    return data;
  };
  const list = await request('/syllabi');
  const matches = list.filter(s => String(s.courseCode || '').replace(/\s+/g, '').toUpperCase() === 'IT301' && s.status === 'draft' && s.userId === login.user.id);
  if (matches.length !== 1) throw new Error('Expected exactly one IT 301 draft owned by the demo account. No data changed.');
  const id = matches[0].id;
  const before = await request(`/syllabi/${id}/content`);
  if (!before.editable || before.status !== 'draft') throw new Error('The selected syllabus is not an editable draft.');
  const d = clone(before.content);
  if (!d?.outcomes) throw new Error('This API must support syllabus-owned Step 2 outcomes.');
  const label = `${d.meta.code} — ${d.meta.title}`;
  if (blank(d.meta.lecture)) d.meta.lecture = '2';
  if (blank(d.meta.lab)) d.meta.lab = '1';
  if (blank(d.meta.prereq)) d.meta.prereq = 'None specified (sample draft; confirm the official prerequisite).';
  const description = `Sample content for API form testing: ${label} introduces the analysis, design, implementation and evaluation of information technology solutions. Students examine a small organizational scenario, identify stakeholder needs, model data and workflows, and construct a tested prototype. Practical activities develop problem solving, documentation, teamwork and responsible computing habits. Learners evaluate usability, privacy, security and accessibility, communicate design decisions, and reflect on the social impact of their proposed solution. Course details, references and assessment weights are illustrative and require faculty review before any submission.`;
  if (!d.description.some(p => !blank(p.t))) d.description = [{ id: d.description[0]?.id || `api${id}_description`, t: description }];
  // Retain the user's existing CLO text/IDs; complete empty mappings and add sample CLOs.
  const pos = d.outcomes.pos;
  const egas = d.outcomes.egas;
  if (!egas.length || !pos.length) throw new Error('The selected draft needs its EGA and PO definitions before sample mapping.');
  for (const c of d.clos) {
    if (!c.pos.length) c.pos = [pos[0].no];
    if (!c.egas.length) c.egas = pos.filter(p => c.pos.includes(p.no)).flatMap(p => p.egas).filter((n, i, values) => values.indexOf(n) === i);
    if (!c.egas.length) c.egas = [egas[0].no];
  }
  const samples = [
    ['Requirements analysis', 'Enabling', 'Analyze stakeholder requirements and model a practical information technology problem.', [1, 2]],
    ['Solution development', 'Demonstrating', 'Design, implement and test a prototype that addresses documented user requirements.', [3]],
    ['Responsible evaluation', 'Integration of Values', 'Evaluate the solution for usability, privacy, security and its effects on the community.', [4, 7]],
  ];
  if (d.clos.length < 4) for (const [index, [title, level, statement, desired]] of samples.entries()) {
    const key = `api${id}_clo${index + 2}`;
    if (d.clos.some(c => c.id === key) || d.clos.length >= 4) continue;
    const chosen = desired.filter(no => pos.some(p => p.no === no));
    const mappings = chosen.length ? chosen : [pos[0].no];
    const attributes = [...new Set(pos.filter(p => mappings.includes(p.no)).flatMap(p => p.egas))];
    d.clos.push({ id: key, title, level, statement, pos: mappings, egas: attributes.length ? attributes : [egas[0].no] });
  }
  const topics = [
    'Course orientation and problem context', 'Stakeholders and organizational workflows', 'Requirements elicitation and analysis', 'Data modeling and validation', 'Process models and solution proposals',
    'Solution architecture and interface design', 'Data storage and access', 'Prototype implementation', 'Input validation and error handling', 'Integration and technical documentation',
    'Testing and quality assurance', 'Security, privacy and access control', 'Usability and accessibility evaluation', 'Deployment planning and community impact', 'Project demonstration and reflective evaluation',
  ];
  if (!d.plan.some(row => !blank(row.week) || !blank(row.contents) || row.ilos.some(il => !blank(il.text)))) {
    let topicIndex = 0;
    d.plan = Array.from({ length: 18 }, (_, index) => {
      const week = index + 1;
      const exam = { 6: 'PRELIM', 12: 'MIDTERM', 18: 'FINAL' }[week];
      if (exam) return { id: `api${id}_week${week}`, kind: 'exam', week: String(week), ilos: [{ id: `api${id}_ilo${week}`, text: '', tags: [] }], contents: `${exam} EXAMINATION`, activities: '', tasks: '', values: '' };
      const topic = topics[topicIndex++];
      const c = d.clos[(topicIndex - 1) % d.clos.length];
      return { id: index === 0 ? before.content.plan[0].id : `api${id}_week${week}`, kind: 'lesson', week: String(week), ilos: [{ id: `api${id}_ilo${week}`, text: `Explain and apply ${topic.toLowerCase()} to the sample project scenario.`, tags: ['clo:' + c.id] }], contents: topic, activities: 'Guided discussion, worked example and collaborative laboratory exercise.', tasks: `- Weekly practice task ${topicIndex}\n- Project evidence and reflection`, values: 'Core Value: Responsibility; respect for others and ethical computing.' };
    });
  }
  if (!d.reqs.length) d.reqs = ['Participate in guided classroom and laboratory activities.', 'Complete practice tasks, quizzes and laboratory exercises.', 'Develop and document a small group prototype with individual contributions.', 'Complete the preliminary, midterm and final examinations.'].map((t, i) => ({ id: `api${id}_req${i + 1}`, t }));
  const sampleReferences = {
    books: `${d.meta.code} teaching team. (2026). Sample BSS course notes for API form testing. Unpublished sample material; replace with approved course references.`,
    program: `${d.meta.code} teaching team. (2026). Sample prototype development and testing workbook. Unpublished sample exercises.`,
    online: `${d.meta.code} teaching team. (2026). Sample online reading list. Placeholder for faculty-approved web resources.`,
  };
  for (const [group, text] of Object.entries(sampleReferences)) if (!d.refs[group].na && !d.refs[group].items.length) d.refs[group].items = [{ id: `api${id}_ref_${group}`, t: text }];
  if (!d.refs.electronics.items.length) d.refs.electronics.na = true;
  if (!d.grading.rows.length) d.grading.rows = [{ id: `api${id}_grade1`, label: 'Class Standing', abbr: 'CS', pct: 60 }, { id: `api${id}_grade2`, label: 'Examination', abbr: 'TE', pct: 40 }];
  const { createModel, SCHEMA_VERSION } = await import(pathToFileURL(path.join(root, 'src/lib/syllabusModel.js')).href);
  const model = createModel({ institution: d.outcomes, programs: { [d.meta.program]: { name: d.meta.program, egas: d.outcomes.egas, pos: d.outcomes.pos } }, year: 2026 });
  const blockers = ['info', 'clos', 'plan', 'reqs', 'refs', 'grade'].flatMap(step => model.blockers(d, step).map(issue => ({ step, text: issue.text })));
  if (blockers.length) throw new Error('Sample draft validation failed: ' + JSON.stringify(blockers));
  const sections = Object.fromEntries(sectionKeys.filter(key => JSON.stringify(d[key]) !== JSON.stringify(before.content[key])).map(key => [key, d[key]]));
  const preview = { id, course: label, ownerId: login.user.id, changedSections: Object.keys(sections), clos: d.clos.length, planRows: d.plan.length, gradingTotal: d.grading.rows.reduce((sum, row) => sum + Number(row.pct), 0), blockers };
  console.log(JSON.stringify({ mode: process.argv.includes('--write') ? 'write' : 'dry-run', ...preview }));
  if (!process.argv.includes('--write') || !Object.keys(sections).length) return;
  const latest = await request(`/syllabi/${id}/content`);
  if (latest.status !== 'draft' || !latest.editable || JSON.stringify(latest.content) !== JSON.stringify(before.content)) throw new Error('The draft changed during preparation. No data saved.');
  const backupDir = path.join(root, '.api-test-backups');
  await fs.mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `it301-draft-${id}-${Date.now()}.json`);
  await fs.writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx' });
  const save = await request(`/syllabi/${id}/content`, { method: 'PUT', body: JSON.stringify({ sections, schemaVersion: SCHEMA_VERSION }) });
  const after = await request(`/syllabi/${id}/content`);
  assert.equal(after.status, 'draft');
  for (const key of Object.keys(sections)) assert.deepEqual(after.content[key], d[key], 'Persisted section: ' + key);
  assert.deepEqual(after.content.outcomes, before.content.outcomes, 'Existing Vision, Mission, EGA and PO preserved');
  for (const c of before.content.clos) {
    const kept = after.content.clos.find(item => item.id === c.id);
    assert.equal(kept.title, c.title);
    assert.equal(kept.statement, c.statement);
  }
  console.log(JSON.stringify({ saved: true, verifiedByApiReadback: true, status: after.status, bytes: save.bytes, backup: path.relative(root, backup), ...preview }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
