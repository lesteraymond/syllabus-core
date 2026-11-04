// Fill and check Jp's assigned MA 7 draft. Never changes official masters or submits.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  assert.ok(process.env.FILL_EMAIL && process.env.FILL_PASSWORD, 'Supply FILL_EMAIL and FILL_PASSWORD');
  const root = path.resolve(__dirname, '..');
  const base = 'http://localhost:3001/api';
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.FILL_EMAIL, password: process.env.FILL_PASSWORD }) });
  assert.equal(login.status, 200);
  const { user } = await login.json();
  const headers = { 'Content-Type': 'application/json', Cookie: login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
  async function request(url, method = 'GET', body) {
    const response = await fetch(base + url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.ok(response.ok, `${url}: ${response.status} ${data.error || data.message}`);
    return data;
  }
  const assigned = (await request('/courses?program=BSIE')).find(c => c.code.replace(/\s+/g, '').toUpperCase() === 'MA7');
  assert.ok(assigned, 'MA 7 must be assigned to this faculty account');
  const drafts = (await request('/syllabi')).filter(s => s.userId === user.id && s.courseId === assigned.id && s.status === 'draft');
  assert.equal(drafts.length, 1, 'Expected one existing MA 7 draft');
  const id = drafts[0].id;
  const before = await request(`/syllabi/${id}/content`);
  assert.ok(before.editable && before.status === 'draft');
  const institution = await request('/institution/outcomes');
  const program = await request('/programs/BSIE/outcomes');
  const d = structuredClone(before.content);
  const key = name => `ma7_${id}_${name}`;
  d.meta = { ...d.meta, lecture: '3', lab: '0', yearLevel: '1', curriculumYear: '2022-2023', prereq: 'Not specified in the source curriculum (blank prerequisite cell).' };
  d.description = [{ id: key('description'), t: 'Differential Calculus introduces functions, limits, continuity, derivatives and applications of differentiation to introductory engineering problems. Students analyze changing quantities, compute and interpret derivatives, model related rates, examine curves and construct optimization models with stated assumptions. Worked examples and problem-solving activities support mathematical reasoning, interpretation and clear communication. This is a deliberately misaligned test draft: its CLO statements and EGA mappings are intentionally inappropriate, so they must be reviewed rather than used for instruction. The prerequisite cell is blank in the supplied curriculum image; this draft does not assert an official prerequisite of None.' }];
  d.outcomes = {
    vision: institution.vision, mission: institution.mission, egas: institution.egas,
    pos: program.pos.length ? program.pos : [
      { no: 1, short: 'Draft: Mathematical engineering analysis', text: 'Draft proposal only, not an official BSIE PO: Apply mathematics and engineering reasoning to analyze industrial-system problems.', egas: [1] },
      { no: 2, short: 'Draft: Responsible engineering practice', text: 'Draft proposal only, not an official BSIE PO: Communicate engineering decisions ethically and consider their effects on communities.', egas: [2, 3] },
    ],
  };
  const specs = [
    ['Cosmetics brand recall', 'Introductory', 'Memorize and recite cosmetic brand names from a product catalog.', 3],
    ['Costume color recall', 'Enabling', 'Identify the names of costume colors in a dance-performance photograph.', 4],
    ['Floral decoration', 'Demonstrating', 'Reproduce a decorative bouquet from a sample photograph using color and shape.', 2],
    ['Cooking vocabulary', 'Integration of Values', 'Recall the names of kitchen utensils and cake decorations from a picture list.', 1],
  ];
  d.clos = specs.map(([title, level, statement, ega], i) => ({ id: key(`clo${i + 1}`), title, level, statement, egas: [ega], pos: [d.outcomes.pos[i % d.outcomes.pos.length].no] }));
  const topics = [
    ['Functions and engineering quantities', 'Represent an engineering quantity as a function and identify its domain and units.'],
    ['Graphs and transformations', 'Interpret graphs and transformations of functions used in engineering models.'],
    ['Limits from tables and graphs', 'Estimate limits from numerical tables and graphs and explain the result.'],
    ['Algebraic limit techniques', 'Evaluate limits using factorization, simplification and appropriate limit laws.'],
    ['Continuity', 'Analyze continuity at a point and identify the source of a discontinuity.'],
    ['Derivative from first principles', 'Compute a derivative using the limit definition and interpret the rate of change.'],
    ['Power and sum rules', 'Apply differentiation rules to polynomial functions and verify the result.'],
    ['Product and quotient rules', 'Differentiate products and quotients and explain the solution steps.'],
    ['Chain rule', 'Analyze a composite function and apply the chain rule correctly.'],
    ['Implicit differentiation', 'Apply implicit differentiation to determine a slope in a constrained relation.'],
    ['Trigonometric derivatives', 'Compute and interpret derivatives of trigonometric functions.'],
    ['Exponential and logarithmic derivatives', 'Differentiate exponential and logarithmic engineering models.'],
    ['Related rates', 'Construct a related-rates model and solve for an unknown rate with consistent units.'],
    ['Curve analysis', 'Analyze critical points, intervals of increase and concavity using derivatives.'],
    ['Optimization models', 'Design an optimization model for a constrained engineering decision and justify the selected optimum.'],
  ];
  let lesson = 0;
  d.plan = Array.from({ length: 18 }, (_, i) => {
    const week = i + 1, exam = { 6: 'PRELIM', 12: 'MIDTERM', 18: 'FINAL' }[week];
    const row = { id: key(`week${week}`), week: String(week) };
    if (exam) return { ...row, kind: 'exam', ilos: [{ id: key(`ilo${week}`), text: '', tags: [] }], contents: `${exam} EXAMINATION`, activities: 'Individual written assessment.', tasks: 'Solve calculus problems and explain mathematical reasoning.', values: 'Interiority: reflect honestly on individual reasoning.' };
    const [contents, text] = topics[lesson];
    const clo = d.clos[lesson % d.clos.length];
    lesson++;
    const unrelated = [4, 9, 14, 17].includes(week);
    return { ...row, kind: 'lesson', ilos: [{ id: key(`ilo${week}`), text, tags: [`clo:${clo.id}`] }], contents,
      activities: unrelated ? 'Practice folk-dance steps and select costume colors.' : 'Guided calculus examples, individual problem solving and peer explanation.',
      tasks: unrelated ? 'Multiple-choice recall quiz on flower names and costume colors only.' : 'Solve a calculus problem, show the derivation and explain the result in context.',
      values: 'Community-orientedness: explain how an engineering model can affect the people who depend on its results.',
    };
  });
  d.reqs = ['Complete weekly differential-calculus problem sets with solution steps.', 'Participate in mathematical modeling and peer explanation exercises.', 'Submit a related-rates and optimization portfolio with assumptions and interpretations.', 'Complete preliminary, midterm and final examinations.'].map((t, i) => ({ id: key(`req${i + 1}`), t }));
  d.refs = { books: { na: false, items: [{ id: key('book'), t: 'Stewart, J. (2016). Calculus: Early transcendentals (8th ed.). Cengage Learning.' }] }, program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] } };
  d.grading = { rows: [{ id: key('grade1'), label: 'Problem sets and modeling portfolio', abbr: 'PS', pct: 40 }, { id: key('grade2'), label: 'Quizzes and participation', abbr: 'QP', pct: 20 }, { id: key('grade3'), label: 'Term examinations', abbr: 'TE', pct: 40 }], override: { on: false, term: '', final: '' } };
  assert.deepEqual((await request(`/syllabi/${id}/content`)).content, before.content, 'Draft changed during preparation');
  const backupDir = path.join(root, '.api-test-backups');
  await fs.mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `ma7-before-test-${id}-${Date.now()}.json`);
  await fs.writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx' });
  const sections = Object.fromEntries(['meta', 'outcomes', 'description', 'clos', 'plan', 'reqs', 'refs', 'grading'].map(k => [k, d[k]]));
  await request(`/syllabi/${id}/content`, 'PUT', { sections, schemaVersion: 3 });
  const saved = await request(`/syllabi/${id}/content`);
  for (const field of Object.keys(sections)) assert.deepEqual(saved.content[field], d[field]);
  await fs.writeFile(path.join(backupDir, 'ma7-semantic-diagnostic-input.json'), JSON.stringify({ content: saved.content, masters: { institution, pos: program.pos }, synthetic: true }, null, 2));
  const checked = await request(`/syllabi/${id}/compliance/recheck`, 'POST', { force: true });
  const reread = await request(`/syllabi/${id}/compliance`);
  assert.equal(reread.run.id, checked.run.id);
  assert.deepEqual(await request(`/syllabi/${id}/content`), saved, 'Checking must not alter the saved draft');
  const result = {
    account: user.email, syllabusId: id, subject: assigned, status: saved.status,
    sourceVerification: { file: 'reference-data/BSIE-1.jpeg', page: 1, program: 'BSIE', curriculumYear: '2022-2023', yearLevel: 1, semester: 1, code: 'MA 7', title: 'DIFFERENTIAL CALCULUS', lectureUnits: 3, labUnits: 0, prerequisiteCell: 'blank', method: 'Visual verification against the supplied curriculum image; not an approved database import.' },
    createdClos: d.clos, intendedMismatches: ['All calculus ILOs map to unrelated cosmetics, costumes, flowers or kitchen-vocabulary CLOs.', 'CLO EGA tags are syntactically valid but intentionally do not demonstrate the designated graduate attributes.', 'Weeks 4, 9, 14 and 17 pair mathematical objectives with dance activities and flower/costume recall quizzes.'],
    runId: checked.run.id, score: checked.run.score, ready: checked.run.hybrid.ready, alignment: checked.run.hybrid.alignment,
    findings: checked.run.findings, deductions: checked.run.hybrid.deductions,
    officialProgramPosAvailable: program.pos.length > 0, reportPersisted: true, draftUnchangedByChecker: true, submitted: false, backup: path.relative(root, backup), testedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(root, 'docs/ma7-misalignment-test-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, findings: result.findings.map(f => ({ ruleId: f.ruleId, severity: f.severity, message: f.message })), createdClos: d.clos.map(c => ({ statement: c.statement, egas: c.egas })) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
