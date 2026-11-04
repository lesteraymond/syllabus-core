// Save a deliberately misaligned testing version through the faculty API only.
// Preserves the active record and its workflow; never invokes AI CHECK or submit.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
  assert.ok(process.env.FILL_EMAIL && process.env.FILL_PASSWORD, 'Supply faculty credentials in the environment.');
  const base = 'http://localhost:3001/api';
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.FILL_EMAIL, password: process.env.FILL_PASSWORD }) });
  assert.equal(login.status, 200, 'Login failed');
  const { user } = await login.json();
  const headers = { 'Content-Type': 'application/json', Cookie: login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
  const request = async (url, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const value = await response.json();
    assert.ok(response.ok, `${url}: ${response.status} ${value.error || ''}`);
    return value;
  };
  const course = (await request('/courses?program=BSIE')).find(c => c.code === 'MA 7' && c.program === 'BSIE');
  assert.ok(course, 'Assigned BSIE MA 7 is required.');
  const records = (await request('/syllabi')).filter(s => s.userId === user.id && s.courseId === course.id && !s.archived);
  assert.equal(records.length, 1, 'Expected one existing MA 7 record; do not bypass the subject lock.');
  const id = records[0].id;
  const before = await request(`/syllabi/${id}/content`);
  assert.ok(before.editable && ['draft', 'for_revision', 'rejected'].includes(before.status), 'MA 7 must be editable.');
  const [institution, program, oldReport] = await Promise.all([
    request('/institution/outcomes'), request('/programs/BSIE/outcomes'), request(`/syllabi/${id}/compliance`),
  ]);
  const aligned = JSON.parse(await fs.readFile(path.join(root, 'docs/ma7-aligned-draft.json'), 'utf8')).content;
  const content = structuredClone(aligned);
  content.meta = before.content.meta;
  content.refs = before.content.refs;
  content.outcomes = { vision: institution.vision, mission: institution.mission, egas: institution.egas, pos: program.pos };
  assert.equal(content.clos.length, 4);
  // Retain calculus CLOs and valid CLO tags; meaning, rather than missing fields
  // or dangling references, is the intentional failure under test.
  const mismatches = [
    ['Museum exhibition design', 'Design a museum exhibition floor plan and justify the arrangement of paintings by artistic period.', 'Memorize a list of painters and copy their birth dates from a handout.', 'Ten-item multiple-choice quiz recalling painters and their birth dates.'],
    ['Restaurant menu development', 'Construct a three-course restaurant menu and evaluate its visual presentation for a seasonal festival.', 'Watch a restaurant advertisement and repeat the names of kitchen utensils.', 'True-or-false recall quiz identifying the names of kitchen utensils.'],
    ['Theatrical costume design', 'Create a theatrical costume collection and defend the selection of fabrics for contrasting stage characters.', 'Read a costume-color glossary aloud and copy its definitions.', 'Match color names to swatches in a five-item worksheet.'],
    ['Travel brochure production', 'Evaluate competing travel brochure layouts and develop an illustrated destination campaign for visitors.', 'Listen to a list of capital cities and memorize their spelling.', 'Fill-in-the-blank quiz recalling capital-city names.'],
    ['Floral arrangement planning', 'Design and critique a floral centerpiece for a wedding reception using contrasting visual compositions.', 'Recite the common names of flowers shown on flashcards.', 'Multiple-choice recall quiz identifying flower names from photographs.'],
  ];
  let lesson = 0;
  for (const row of content.plan) {
    if (row.kind === 'exam') continue;
    const [topic, text, activities, tasks] = mismatches[lesson++ % mismatches.length];
    row.contents = topic;
    row.ilos = [{ ...row.ilos[0], text }];
    row.activities = activities;
    row.tasks = tasks;
    row.values = `Compassion: provide patient and respectful peer feedback while discussing ${topic.toLowerCase()}.`;
    assert.ok(content.clos.some(clo => row.ilos[0].tags.includes(`clo:${clo.id}`)));
  }
  content.reqs = [
    'Complete weekly recall quizzes on painters, kitchen utensils, costume colors, capital cities and flower names.',
    'Submit an exhibition floor plan, restaurant menu, costume collection, travel brochure and floral centerpiece proposal.',
    'Participate respectfully in peer feedback and submit an individual reflection.',
    'Complete the scheduled preliminary, midterm and final examinations.',
  ].map((t, i) => ({ id: `ma7_misaligned_requirement${i + 1}`, t }));
  const backupDir = path.join(root, '.api-test-backups');
  await fs.mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `ma7-before-misaligned-${id}-${Date.now()}.json`);
  await fs.writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx' });
  const current = await request(`/syllabi/${id}/content`);
  assert.deepEqual(current.content, before.content, 'Concurrent edit; refusing overwrite.');
  assert.equal(current.status, before.status);
  const keys = ['outcomes', 'description', 'clos', 'plan', 'reqs', 'grading'];
  await request(`/syllabi/${id}/content`, 'PUT', { schemaVersion: 3, sections: Object.fromEntries(keys.map(k => [k, content[k]])) });
  const saved = await request(`/syllabi/${id}/content`);
  for (const k of keys) assert.deepEqual(saved.content[k], content[k], `Saved ${k}`);
  assert.deepEqual(saved.content.meta, before.content.meta);
  assert.deepEqual(saved.content.refs, before.content.refs);
  assert.equal(saved.status, before.status);
  const report = await request(`/syllabi/${id}/compliance`);
  assert.equal(report.run?.id, oldReport.run?.id, 'Saving must not create an AI check.');
  const result = { syllabusId: id, account: user.email, subject: 'BSIE MA 7 — Differential Calculus', status: saved.status, variant: 'deliberately misaligned learning plan', calculusCLOs: content.clos.length, misalignedLessons: lesson, totalWeeks: content.plan.length, aiCheckTriggered: false, submitted: false, backup: path.relative(root, backup), savedAt: new Date().toISOString() };
  await fs.writeFile(path.join(root, 'docs/ma7-misaligned-draft.json'), JSON.stringify({ ...result, content: saved.content }, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
