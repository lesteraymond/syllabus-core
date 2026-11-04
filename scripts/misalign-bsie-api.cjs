// Deliberately introduce semantic mismatches in the faculty's BSIE test draft.
// Uses authenticated API writes only; never submits or invokes a checker.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  assert.ok(process.env.FILL_EMAIL && process.env.FILL_PASSWORD, 'Supply FILL_EMAIL and FILL_PASSWORD');
  const base = 'http://localhost:3001/api';
  const root = path.resolve(__dirname, '..');
  const login = await fetch(base + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.FILL_EMAIL, password: process.env.FILL_PASSWORD }),
  });
  assert.equal(login.status, 200, 'Sign-in failed');
  const { user } = await login.json();
  const headers = { 'Content-Type': 'application/json', Cookie: login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
  async function request(url, body) {
    const response = await fetch(base + url, { headers, ...(body ? { method: 'PUT', body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.ok(response.ok, `${url}: HTTP ${response.status}: ${data.message || data.error}`);
    return data;
  }
  const id = 100;
  const list = await request('/syllabi');
  const target = list.find(s => s.id === id && s.userId === user.id && s.programCode === 'BSIE' && s.courseCode === 'IE 204');
  assert.ok(target, 'The BSIE draft does not belong to this account');
  const before = await request(`/syllabi/${id}/content`);
  assert.ok(before.editable && before.status === 'draft', 'Only the editable test draft may change');
  const d = structuredClone(before.content);
  assert.equal(d.clos.length, 4);
  assert.equal(d.plan.length, 18);
  assert.ok(d.outcomes.pos.some(p => p.no === 2));
  d.description.push({ id: 'bsie100_misalignment_note', t: 'Deliberately misaligned test draft. Prepared for testing syllabus review; not for teaching or publication.' });
  // Outcome IDs remain valid while their meaning no longer fits the course or mapped PO.
  d.clos[0].pos = [2];
  d.clos[0].egas = [...d.outcomes.pos.find(p => p.no === 2).egas];
  d.clos[3].title = 'Floral arrangement';
  d.clos[3].statement = 'Create decorative floral centerpieces using color harmony, bouquet composition and flower-care techniques.';
  const lessons = d.plan.filter(row => row.kind === 'lesson');
  const mappingWeeks = [2, 3, 4, 5, 7];
  const taskWeeks = [8, 9, 10, 11, 13];
  for (const row of lessons) {
    const week = Number(row.week);
    if (mappingWeeks.includes(week)) {
      // Computing ILOs deliberately point to a floral-arrangement CLO.
      for (const ilo of row.ilos) if (ilo.text.trim()) ilo.tags = [`clo:${d.clos[3].id}`];
    }
    if (taskWeeks.includes(week)) {
      // Relevant computing ILO/content remain, but instruction and evidence do not support them.
      row.activities = 'Practice a group folk-dance routine and discuss costume color combinations.';
      row.tasks = 'Perform the folk dance. Award marks for rhythm, costume appearance and stage presence only.';
    }
    if (week === 14) {
      row.contents = 'Flower selection, bouquet shapes and decorative centerpiece design.';
      row.activities = 'Arrange flowers by height, texture and color.';
      // The original debugging/testing ILO and its computing assessment remain unchanged.
    }
  }
  for (const row of d.plan.filter(row => row.kind === 'exam')) {
    row.activities = 'Individual closed-book recall exercise.';
    row.tasks = 'List flower varieties and memorize costume colors; no programming, spreadsheet modeling or solution testing is assessed.';
  }
  d.reqs = [
    'Submit a scrapbook of flower varieties with decorative borders.',
    'Participate in a folk-dance performance and provide a costume photograph.',
    'Create a floral centerpiece and describe its color palette.',
    'Complete recall quizzes on flower names and costume colors.',
  ].map((t, i) => ({ id: `bsie100_misaligned_req${i + 1}`, t }));
  d.grading.rows = [
    { id: 'bsie100_misaligned_grade1', label: 'Floral centerpiece appearance', abbr: 'FC', pct: 40 },
    { id: 'bsie100_misaligned_grade2', label: 'Dance performance and costumes', abbr: 'DP', pct: 35 },
    { id: 'bsie100_misaligned_grade3', label: 'Flower-name recall examinations', abbr: 'FR', pct: 25 },
  ];
  const keys = ['description', 'clos', 'plan', 'reqs', 'grading'];
  const sections = Object.fromEntries(keys.map(key => [key, d[key]]));
  const latest = await request(`/syllabi/${id}/content`);
  assert.deepEqual(latest, before, 'Draft changed during preparation');
  const backupDir = path.join(root, '.api-test-backups');
  await fs.mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `bsie-before-misalignment-${id}-${Date.now()}.json`);
  await fs.writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx' });
  await request(`/syllabi/${id}/content`, { sections, schemaVersion: 3 });
  const after = await request(`/syllabi/${id}/content`);
  assert.equal(after.status, 'draft');
  for (const key of keys) assert.deepEqual(after.content[key], d[key], `Persisted ${key}`);
  for (const key of ['meta', 'outcomes', 'refs']) assert.deepEqual(after.content[key], before.content[key], `Preserved ${key}`);
  const manifest = {
    syllabusId: id, course: 'BSIE / IE 204 Computing', status: after.status,
    savedAt: new Date().toISOString(), backup: path.relative(root, backup), aiCheckRun: false,
    deliberateMismatches: [
      'CLO 1 computational problem analysis maps only to PO 2 responsible communication instead of engineering problem solving.',
      'CLO 4 concerns floral arrangement rather than computing and does not support its professional-practice PO.',
      `Weeks ${mappingWeeks.join(', ')} retain computing ILOs but tag the floral-arrangement CLO.`,
      `Weeks ${taskWeeks.join(', ')} teach and assess dance while retaining computing ILOs and content.`,
      'Week 14 teaches floral design while retaining the debugging/testing ILO and computing assessment.',
      'All three examinations assess flowers and costume colors rather than computing.',
      'Requirements and grading assess floral design and dance instead of the stated computing course outcomes.',
    ],
    planRows: after.content.plan.length,
    gradingTotal: after.content.grading.rows.reduce((sum, row) => sum + row.pct, 0),
  };
  await fs.writeFile(path.join(root, 'docs/bsie-misalignment-test.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
