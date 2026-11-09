// Two test versions of the faculty's existing MA 7 draft. Uses normal API
// ownership/subject locks; never installs references, submits or approves.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/bsie-ma7-tests');
const sections = ['meta', 'outcomes', 'description', 'clos', 'plan', 'reqs', 'refs', 'grading'];

function versions(original, institution, program) {
  const aligned = structuredClone(original);
  aligned.outcomes = { vision: institution.vision, mission: institution.mission, egas: institution.egas, pos: program.pos.length ? program.pos : [
    { no: 1, short: 'TEST ONLY: Mathematical analysis', text: 'Test proposal, not an official BSIE Program Outcome: Apply mathematics and engineering reasoning to analyze industrial-system problems.', egas: [1] },
    { no: 2, short: 'TEST ONLY: Responsible practice', text: 'Test proposal, not an official BSIE Program Outcome: Communicate engineering decisions ethically and consider their effects on communities.', egas: [2, 3] },
  ] };
  assert.equal(program.pos.length, 0, 'Official POs now exist: adapt these examples to their actual meaning before proceeding.');
  const statements = [
    ['Functions, limits and continuity', 'Introductory', 'Analyze engineering functions, graphs, limits and continuity, explaining domains, units and the assumptions used in mathematical reasoning.', [1]],
    ['Differentiation and verification', 'Enabling', 'Compute derivatives of algebraic, trigonometric, exponential, logarithmic and implicit functions, verify solution steps and interpret rates of change in engineering problems.', [1]],
    ['Engineering calculus models', 'Demonstrating', 'Construct and analyze related-rates, curve-analysis and optimization models for industrial engineering decisions, justify mathematical assumptions and explain effects on workers and communities.', [1, 2]],
    ['Responsible mathematical communication', 'Integration of Values', 'Evaluate and communicate a calculus-based engineering recommendation with verified calculations, clear assumptions, honest limitations and an explanation of its effects on workers and communities.', [1, 2]],
  ];
  aligned.clos = statements.map(([title, level, statement, pos], i) => ({ id: `bsie_test_clo${i + 1}`, title, level, statement, pos, egas: [...new Set(aligned.outcomes.pos.filter(p => pos.includes(p.no)).flatMap(p => p.egas))] }));
  aligned.description = [{ id: 'bsie_test_description', t: 'ALIGNED TEST VERSION: This teaching draft demonstrates constructive alignment for Differential Calculus. Students analyze engineering functions, limits and continuity; calculate and verify derivatives; and construct related-rates and optimization models. They explain their mathematical reasoning and communicate engineering recommendations with honest limitations and consideration for workers and communities. Weekly practice and assessment use the same mathematical objectives. Program Outcomes labeled TEST ONLY are provisional examples, not official institutional references. This draft must not be submitted as an officially verified syllabus.' }];
  aligned.plan = aligned.plan.map(row => {
    if (row.kind === 'exam') return row;
    const w = Number(row.week);
    const clo = w <= 5 ? 0 : w <= 11 ? 1 : w === 16 ? 3 : 2;
    const text = w === 16 ? 'Evaluate and communicate a calculus-based engineering recommendation using verified derivatives, explicit assumptions, honest limitations and an explanation of its impact on workers and communities.' : row.ilos[0].text;
    return { ...row, ilos: [{ id: `bsie_test_ilo${w}`, text, tags: [`clo:${aligned.clos[clo].id}`] }],
      activities: `Work through ${row.contents.toLowerCase()} using an engineering example. ${text} Compare mathematical reasoning in pairs, check units and assumptions, and explain any disagreement.`,
      tasks: `Individual worked engineering problem and short oral explanation: ${text} Submit calculations or graphs, justify each step and verify the result against an independent calculation or graphical check.`,
      values: `Community-orientedness: during the ${row.contents.toLowerCase()} activity, identify who could be affected by an incorrect engineering calculation, peer-check the assumptions and explain how accurate, honest results protect workers and communities.` };
  });
  const misaligned = structuredClone(aligned);
  misaligned.description[0].t = aligned.description[0].t.replace('ALIGNED TEST VERSION', 'DELIBERATELY MISALIGNED TEST VERSION') + ' Intentional test errors: cosmetic-brand, costume, floral-decoration and cooking-vocabulary CLOs are assigned to calculus ILOs; dance activities and flower-name recall assessments do not measure the mathematical objectives.';
  const unrelated = [
    'Memorize and recite cosmetic brand names from a product catalog.',
    'Identify costume colors in a ballroom-dance photograph.',
    'Reproduce a decorative flower bouquet by matching its colors and shapes.',
    'Recall the names of kitchen utensils and cake decorations from a picture list.',
  ];
  misaligned.clos.forEach((clo, i) => { clo.title = `Intentional mismatch ${i + 1}`; clo.statement = unrelated[i]; });
  misaligned.plan.forEach(row => {
    if (row.kind === 'exam') return;
    row.activities = 'Practice ballroom-dance steps and select costume colors. No calculus or engineering calculations are performed.';
    row.tasks = 'Multiple-choice recall quiz naming flowers and costume colors. No mathematical reasoning, derivative calculation or engineering model is assessed.';
  });
  return { aligned, misaligned };
}

async function prepare() {
  assert.ok(process.env.FILL_EMAIL && process.env.FILL_PASSWORD, 'Supply faculty credentials in the environment.');
  const base = 'http://localhost:3001/api';
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.FILL_EMAIL, password: process.env.FILL_PASSWORD }) });
  assert.equal(login.status, 200, 'Login failed');
  const { user } = await login.json();
  const headers = { 'Content-Type': 'application/json', Cookie: login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
  const request = async (url, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const value = await response.json(); assert.ok(response.ok, `${url}: ${response.status} ${value.error || value.message || ''}`); return value;
  };
  const courses = await request('/courses?program=BSIE');
  const course = courses.find(c => c.code.replace(/\s/g, '').toUpperCase() === 'MA7');
  assert.ok(course, 'MA 7 must already be assigned.');
  const drafts = (await request('/syllabi')).filter(s => s.userId === user.id && s.courseId === course.id && s.status === 'draft' && !s.archived);
  assert.equal(drafts.length, 1, 'Expected one existing MA 7 draft.');
  const id = drafts[0].id;
  const before = await request(`/syllabi/${id}/content`);
  assert.ok(before.editable, 'Existing draft must be editable.');
  const [institution, program] = await Promise.all([request('/institution/outcomes'), request('/programs/BSIE/outcomes')]);
  const tests = versions(before.content, institution, program);
  await fs.mkdir(output, { recursive: true });
  const backupDir = path.join(root, '.api-test-backups'); await fs.mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `ma7-before-two-version-test-${id}-${Date.now()}.json`);
  await fs.writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx' });
  for (const [name, content] of Object.entries(tests)) await fs.writeFile(path.join(output, `${name}.builder.json`), JSON.stringify({ content, testOnly: true, variant: name, syllabusId: id }, null, 2) + '\n');
  const reports = {};
  let expected = before.content;
  for (const name of ['misaligned', 'aligned']) {
    const current = await request(`/syllabi/${id}/content`);
    assert.deepEqual(current.content, expected, 'Draft changed concurrently; refusing to overwrite.');
    assert.ok(current.editable && current.status === 'draft');
    const content = tests[name];
    await request(`/syllabi/${id}/content`, 'PUT', { sections: Object.fromEntries(sections.map(key => [key, content[key]])), schemaVersion: 3, baseRevisions: current.revisions });
    const saved = await request(`/syllabi/${id}/content`);
    for (const key of sections) assert.deepEqual(saved.content[key], content[key], `${name}: saved ${key}`);
    expected = saved.content;
    // Store the server-normalized form for exact reproduction by the CLI.
    await fs.writeFile(path.join(output, `${name}.builder.json`), JSON.stringify({ content: saved.content, testOnly: true, variant: name, syllabusId: id }, null, 2) + '\n');
    const response = await request(`/syllabi/${id}/compliance/recheck`, 'POST', { force: true });
    const persisted = await request(`/syllabi/${id}/compliance`);
    assert.equal(response.run.id, persisted.run.id);
    assert.deepEqual((await request(`/syllabi/${id}/content`)).content, expected, 'Checker changed the draft.');
    reports[name] = { runId: response.run.id, score: response.run.score, baseScore: response.run.hybrid.baseScore, ready: response.run.hybrid.ready, alignment: response.run.hybrid.alignment.status, blockers: response.run.findings.filter(f => f.severity === 'blocking').map(f => ({ ruleId: f.ruleId, message: f.message })) };
  }
  const result = { syllabusId: id, subject: `${course.program} ${course.code}`, finalBuilderVersion: 'aligned', draftStatus: 'draft', submitted: false, officialReferencesModified: false, backup: path.relative(root, backup), testedAt: new Date().toISOString(), reports };
  await fs.writeFile(path.join(output, 'builder-check-results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}

async function diagnose() {
  require('../server/node_modules/dotenv').config({ path: path.join(root, 'server/.env'), quiet: true });
  const { run } = require('../server/lib/syllabuscheck/engine');
  const { providerConfig } = require('../server/lib/syllabuscheck/gemini');
  const config = providerConfig(); assert.ok(config.configured, 'Configure the Gemini provider first.');
  const results = {};
  for (const name of ['aligned', 'misaligned']) {
    const { content } = JSON.parse(await fs.readFile(path.join(output, `${name}.builder.json`), 'utf8'));
    // Isolated fixtures only. Never persisted to the reference database or
    // submitted as official evidence. synthetic=true prevents authorization.
    const masters = { synthetic: true, institution: { vision: content.outcomes.vision, mission: content.outcomes.mission, egas: content.outcomes.egas }, pos: content.outcomes.pos,
      curricula: [{ program: content.meta.program, curriculumYear: content.meta.curriculumYear, status: 'approved', source: 'TEST FIXTURE ONLY: form identity, not an approved official curriculum', courses: [{ code: content.meta.code, title: content.meta.title, prereq: content.meta.prereq, lecture: Number(content.meta.lecture), lab: Number(content.meta.lab), yearLevel: Number(content.meta.yearLevel) }] }] };
    console.log(`Starting live ${name} diagnostic (${config.provider}/${config.model}).`);
    const report = await run(content, masters, { useAi: true });
    assert.equal(report.hybrid.ready, false);
    assert.equal(report.score, null);
    await fs.writeFile(path.join(output, `${name}.diagnostic.json`), JSON.stringify({ scope: 'Synthetic-reference full semantic diagnostic; not an official syllabus score', canAuthorizeSubmission: false, ...report }, null, 2) + '\n');
    const judgements = report.hybrid.alignment.judgements;
    results[name] = { provider: report.hybrid.alignment.provider, model: report.hybrid.alignment.model, status: report.hybrid.alignment.status, reason: report.hybrid.alignment.reason, baseScore: report.hybrid.baseScore, diagnosticScore: report.hybrid.alignment.status === 'completed' ? report.hybrid.provisionalScore : null, finalOfficialScore: null, deductions: report.hybrid.deductions.reduce((sum, d) => sum + d.points, 0), relationships: judgements.length, labels: Object.fromEntries(['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED', 'INSUFFICIENT_EVIDENCE'].map(label => [label, judgements.filter(j => j.label === label).length])) };
    console.log(JSON.stringify({ variant: name, ...results[name] }));
  }
  const comparison = { testedAt: new Date().toISOString(), syntheticReferences: true, canAuthorizeSubmission: false, results };
  await fs.writeFile(path.join(output, 'diagnostic-comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
  if (Object.values(results).some(r => r.status !== 'completed')) process.exitCode = 1;
}
(process.argv.includes('--diagnose') ? diagnose() : prepare()).catch(error => { console.error(error.message); process.exitCode = 1; });
