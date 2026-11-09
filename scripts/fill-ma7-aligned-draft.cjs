// Save an aligned MA 7 teaching draft through the faculty API. Never calls the
// AI CHECK endpoint, submits a syllabus, or changes official references.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require('../server/node_modules/dotenv').config({ path: path.join(root, 'server/.env'), quiet: true });

function alignedContent(before, institution, program) {
  const d = structuredClone(before);
  const item = (id, t) => ({ id: `ma7_aligned_${id}`, t });
  d.outcomes = { vision: institution.vision, mission: institution.mission, egas: institution.egas, pos: program.pos };
  d.description = [item('description', 'Differential Calculus develops the mathematical reasoning used to analyze changing quantities in industrial engineering. Students represent engineering functions, evaluate limits and continuity, calculate and verify derivatives, and formulate related-rates and optimization models. Worked examples, graph interpretation, peer review and individual problem solving connect symbolic methods with physical units, assumptions and realistic constraints. Students communicate justified recommendations, examine consequences for workers and communities, and practice Marian-Augustinian honesty, humility and compassionate service. A modeling project and reflective revision develop independent learning and responsible mathematical practice.')];
  const specs = [
    ['Functions, limits and continuity', 'Introductory', 'Represent and analyze engineering functions, evaluate limits and continuity, and justify domains, units and assumptions using mathematical and scientific knowledge.', [1], [1]],
    ['Differentiation and verification', 'Enabling', 'Apply differentiation rules to algebraic, trigonometric, exponential, logarithmic and implicit functions; verify solution steps and interpret derivatives as engineering rates of change.', [1], [1]],
    ['Engineering problem formulation and modeling', 'Demonstrating', 'Identify and formulate related-rates and optimization problems in industrial engineering, construct and solve calculus models within stated constraints, and justify the resulting engineering recommendation.', [1, 5], [1]],
    ['Responsible communication and reflective learning', 'Integration of Values', 'Evaluate and communicate calculus-based engineering recommendations with honest evidence and attention to workers and communities; practice Catholic Augustinian-Marian professional values of truth, humility and compassionate service, revise work using feedback, and identify an independent learning goal.', [6, 7, 8, 9], [2, 3, 4]],
  ];
  d.clos = specs.map(([title, level, statement, pos, egas], i) => ({ id: `ma7_aligned_clo${i + 1}`, title, level, statement, pos, egas }));
  // Topic, observable ILO, aligned practice, evidence to be assessed, CLO index,
  // named value and its concrete application in the activity/assessment.
  const lessons = [
    ['Functions, domains and engineering units', 'Represent a production-cost relationship as a function, identify its domain and units, and justify the chosen assumptions.', 'Build a cost function from a production case; compare domains and dimensional consistency in pairs.', 'Submit the function, a labeled graph, a domain justification and a dimensional check; explain each assumption.', 0, 'Humility', 'invite a peer to challenge the domain assumptions and record a correction without hiding the original error'],
    ['Graphs and transformations of engineering functions', 'Analyze transformations and piecewise graphs of an engineering function and explain their effect on the modeled quantity.', 'Sketch and compare transformed throughput graphs, then explain the meaning of each change in a peer walkthrough.', 'Produce and interpret labeled graphs, identify relevant intervals, and explain how the transformations change throughput.', 0, 'Community-orientedness', 'explain how misleading throughput graphs could affect the workers who rely on production targets'],
    ['Limits from numerical tables and graphs', 'Estimate one-sided and two-sided limits of an engineering function from tables and graphs and justify whether a limit exists.', 'Generate tables approaching a production threshold from both sides and compare the graphical and numerical evidence.', 'Submit tables, graphs, one-sided limits and a written explanation supported by the observed values.', 0, 'Courage', 'state honestly when the evidence does not support a two-sided limit and defend the conclusion respectfully'],
    ['Algebraic evaluation of limits', 'Evaluate limits using factorization, simplification and limit laws, and verify the result using a numerical check.', 'Solve production-cost limit examples with annotated algebra; exchange solutions and independently check the result.', 'Provide a worked limit solution, justification of each algebraic step and an independent numerical verification.', 0, 'Compassion', 'give a struggling peer a patient explanation of one algebraic step while preserving their responsibility to solve the problem'],
    ['Continuity and model assumptions', 'Analyze continuity at a production transition and identify the assumptions needed for the engineering model to remain valid.', 'Inspect piecewise production models, diagnose discontinuities and revise unjustified assumptions in a reflective peer review.', 'Submit a continuity analysis with a graph, the relevant limits and a justified revision to the assumptions.', 0, 'Interiority', 'reflect on a mistaken assumption, explain its consequence and document a specific improvement in reasoning'],
    ['Derivative from first principles and basic differentiation', 'Compute a derivative from the limit definition, verify it using basic differentiation rules, and interpret its engineering units.', 'Derive a rate-of-change function from a machine-position example; compare the limit derivation with power-rule results.', 'Submit the limit derivation, rule-based verification and an interpretation of the derivative with correct units.', 1, 'Humility', 'accept and document peer corrections to the derivation rather than presenting an unchecked calculation as certain'],
    ['Product and quotient differentiation rules', 'Differentiate product and quotient functions in engineering examples, justify the selected rule and verify the result.', 'Compare product and quotient solutions in a guided workshop; diagnose a deliberately incorrect derivative.', 'Submit two worked derivatives, explain rule selection, correct the supplied error and verify using numerical slopes.', 1, 'Courage', 'identify and explain the incorrect result openly, including how the correction improves the engineering conclusion'],
    ['Chain rule and composite engineering functions', 'Analyze a composite engineering function, apply the chain rule correctly and interpret how the component rates combine.', 'Decompose a nested machine-response function into inner and outer functions and trace the derivative in pairs.', 'Submit a composition diagram, an annotated chain-rule solution and an explanation of the combined rate and its units.', 1, 'Community-orientedness', 'peer-check the combined rate and discuss how an incorrect rate could mislead a machine operator'],
    ['Implicit differentiation and constrained relationships', 'Apply implicit differentiation to determine a slope in a constrained engineering relationship and verify the result at a valid point.', 'Differentiate a geometric constraint, discuss dependent variables and cross-check the slope at a feasible operating point.', 'Submit the differentiated equation, the slope at a feasible point, a verification and a statement of the constraint.', 1, 'Interiority', 'identify an initially overlooked constraint and explain how checking assumptions changed the solution'],
    ['Trigonometric, exponential and logarithmic derivatives', 'Compute and verify derivatives of trigonometric, exponential and logarithmic engineering functions and explain their rates of change.', 'Compare vibration, growth and logarithmic-response models; practice rule selection and numerical verification.', 'Complete one worked derivative for each function family and explain the result in context with a numerical check.', 1, 'Missionary Spirit', 'share an accessible worked explanation with a classmate who needs support, as a concrete act of learning through service'],
    ['Related-rates models', 'Formulate and solve a related-rates engineering problem, defining variables, differentiating the constraint and interpreting the answer with consistent units.', 'Build a related-rates model for a changing container or conveyor geometry; review variable definitions and constraints in groups.', 'Submit a diagram, variable definitions, the constraint, the differentiated model, the calculated rate and a reasonableness check.', 2, 'Compassion', 'consider the people affected by an incorrect rate estimate and explain the need for a careful verification'],
    ['Curve analysis and engineering interpretation', 'Analyze critical points, monotonicity and concavity of an engineering function and justify the resulting interpretation of its behavior.', 'Construct derivative sign charts and compare the predicted behavior with a graph of the engineering function.', 'Submit first- and second-derivative calculations, sign charts, a labeled graph and a justified interpretation.', 2, 'Courage', 'defend the interpretation using mathematical evidence while remaining open to a peer counterexample'],
    ['Constrained optimization', 'Formulate and solve a constrained production or material-use optimization problem and justify the optimum using calculus and feasible endpoints.', 'Translate a case into an objective and constraint, eliminate variables, identify feasible candidates and compare alternatives.', 'Submit the objective, constraint, feasible domain, derivative analysis, endpoint comparison and a justified engineering recommendation.', 2, 'Community-orientedness', 'explain how the selected optimum affects workers and resource use rather than reporting a numerical optimum without context'],
    ['Model construction, validation and revision', 'Construct and validate a calculus-based model for an industrial engineering decision, test assumptions and revise the model using documented feedback.', 'Develop a production or material-use model in a workshop; exchange verification notes and revise assumptions using the received feedback.', 'Submit the model, worked solution, independent verification, assumptions log and a before-and-after revision record.', 2, 'Humility', 'acknowledge model limitations, credit the reviewer and make a documented correction to improve the work'],
    ['Engineering recommendation, ethical reporting and independent learning', 'Evaluate and communicate a verified calculus-based recommendation, explain its effects on workers and communities, and propose an independent learning goal based on feedback.', 'Present the project and conduct an individual oral defense; discuss truthful reporting, compassionate service, feedback and the next learning goal.', 'Submit the final recommendation with calculations and limitations, deliver an individual oral explanation, and provide a reflective revision and independent learning plan.', 3, 'Missionary Spirit', 'communicate the recommendation in accessible language for the people it serves, linking professional honesty and care for others with Catholic Augustinian-Marian service'],
  ];
  let lesson = 0;
  d.plan = Array.from({ length: 18 }, (_, i) => {
    const week = i + 1;
    const exam = { 6: ['PRELIM', 'functions, limits and continuity'], 12: ['MIDTERM', 'derivatives, verification and engineering rates'], 18: ['FINAL', 'related rates, curve analysis and optimization'] }[week];
    if (exam) return { id: `ma7_aligned_week${week}`, week: String(week), kind: 'exam', ilos: [{ id: `ma7_aligned_ilo${week}`, text: '', tags: [] }], contents: `${exam[0]} EXAMINATION`, activities: `Individual written assessment of ${exam[1]}.`, tasks: 'Solve engineering calculus problems, show and justify solution steps, verify results and interpret units and assumptions.', values: 'Honesty in independent work and responsible reporting of results.' };
    const [contents, text, activities, tasks, clo, value, application] = lessons[lesson++];
    return { id: `ma7_aligned_week${week}`, week: String(week), kind: 'lesson', ilos: [{ id: `ma7_aligned_ilo${week}`, text, tags: [`clo:${d.clos[clo].id}`] }], contents,
      activities: `${activities} Value integration: ${application}.`,
      tasks: `${tasks} Include a brief account of how you ${application}.`,
      values: `${value}: ${application}.` };
  });
  d.reqs = [
    'Complete individual weekly problem sets with annotated mathematical reasoning, labeled graphs where appropriate, correct units and independent verification.',
    'Complete short quizzes that require worked calculus solutions and interpretation of results rather than recall of unrelated facts.',
    'Complete preliminary, midterm and final written examinations covering the scheduled mathematical outcomes and engineering applications.',
    'Develop a calculus-based engineering modeling project with an objective, constraints, assumptions, derivations, verified results, limitations and a justified recommendation.',
    'Present the modeling recommendation and complete an individual oral defense, addressing professional honesty and the consequences for workers and communities.',
    'Maintain a short reflective learning journal documenting peer feedback, revisions, Marian-Augustinian value applications and one independent learning goal.',
  ].map((text, i) => item(`requirement${i + 1}`, text));
  d.grading = { rows: [
    { id: 'ma7_aligned_grade1', label: 'Worked problem sets', abbr: 'PS', pct: 25 },
    { id: 'ma7_aligned_grade2', label: 'Quizzes with solution explanations', abbr: 'QZ', pct: 10 },
    { id: 'ma7_aligned_grade3', label: 'Engineering modeling project and oral defense', abbr: 'MP', pct: 20 },
    { id: 'ma7_aligned_grade4', label: 'Reflective revision and learning journal', abbr: 'RJ', pct: 5 },
    { id: 'ma7_aligned_grade5', label: 'Term examinations', abbr: 'TE', pct: 40 },
  ], override: { on: false, term: '', final: '' } };
  return d;
}

(async () => {
  assert.ok(process.env.FILL_EMAIL && process.env.FILL_PASSWORD, 'Supply credentials in the environment.');
  const base = 'http://localhost:3001/api';
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.FILL_EMAIL, password: process.env.FILL_PASSWORD }) });
  assert.equal(login.status, 200, 'Login failed');
  const { user } = await login.json();
  const headers = { 'Content-Type': 'application/json', Cookie: login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
  const request = async (url, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); assert.ok(response.ok, `${url}: ${response.status} ${result.error || result.message || ''}`); return result;
  };
  const course = (await request('/courses?program=BSIE')).find(c => c.code === 'MA 7');
  assert.ok(course, 'MA 7 must already be assigned.');
  const drafts = (await request('/syllabi')).filter(s => s.userId === user.id && s.courseId === course.id && s.status === 'draft' && !s.archived);
  assert.equal(drafts.length, 1, 'Expected the existing MA 7 draft.');
  const id = drafts[0].id;
  const before = await request(`/syllabi/${id}/content`);
  assert.ok(before.editable && before.status === 'draft');
  const [institution, program, oldReport] = await Promise.all([request('/institution/outcomes'), request('/programs/BSIE/outcomes'), request(`/syllabi/${id}/compliance`)]);
  const d = alignedContent(before.content, institution, program);
  const db = await require('../server/node_modules/mysql2/promise').createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  let coded;
  try {
    const masters = await require('../server/lib/syllabuscheck/repository').mastersFor(db, d);
    coded = require('../server/lib/syllabuscheck/engine').coded(d, masters);
  } finally { await db.end(); }
  assert.deepEqual(coded.findings.filter(f => f.severity === 'blocking'), [], 'Resolve deterministic blockers before saving.');
  const backupDir = path.join(root, '.api-test-backups'); await fs.mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `ma7-before-aligned-draft-${id}-${Date.now()}.json`);
  await fs.writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx' });
  const latestForSave = await request(`/syllabi/${id}/content`);
  assert.deepEqual(latestForSave.content, before.content, 'Concurrent edit; refusing overwrite.');
  const keys = ['outcomes', 'description', 'clos', 'plan', 'reqs', 'grading'];
  await request(`/syllabi/${id}/content`, 'PUT', { schemaVersion: 3, sections: Object.fromEntries(keys.map(key => [key, d[key]])), baseRevisions: latestForSave.revisions });
  const saved = await request(`/syllabi/${id}/content`);
  for (const key of keys) assert.deepEqual(saved.content[key], d[key], `Saved ${key}`);
  assert.deepEqual(saved.content.meta, before.content.meta);
  assert.deepEqual(saved.content.refs, before.content.refs);
  assert.equal(saved.status, 'draft');
  const latestReport = await request(`/syllabi/${id}/compliance`);
  assert.equal(latestReport.run?.id, oldReport.run?.id, 'Saving must not trigger an AI check.');
  assert.ok(!latestReport.run || latestReport.run.stale, 'The previous report must be marked stale.');
  const summary = { syllabusId: id, subject: `${course.program} ${course.code} ${course.title}`, status: saved.status, officialPOs: saved.content.outcomes.pos.length, clos: saved.content.clos.map(c => ({ title: c.title, pos: c.pos, egas: c.egas })), planRows: saved.content.plan.length, gradingTotal: saved.content.grading.rows.reduce((sum, row) => sum + row.pct, 0), codedBaseline: coded.base.overall, hardBlockers: [], codedFindings: coded.findings, aiCheckTriggered: false, finalAiScore: null, submitted: false, previousRunId: oldReport.run?.id, previousRunStale: latestReport.run?.stale, backup: path.relative(root, backup), savedAt: new Date().toISOString() };
  await fs.writeFile(path.join(root, 'docs/ma7-aligned-draft.json'), JSON.stringify({ ...summary, content: saved.content }, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
