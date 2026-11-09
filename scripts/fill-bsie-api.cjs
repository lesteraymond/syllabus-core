// Fill the existing BSIE Computing draft by HTTP only. Never runs an AI check or submits.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  const root = path.resolve(__dirname, '..');
  const base = 'http://localhost:3001/api';
  const guide = await fs.readFile(path.join(root, 'HOW-TO-RUN.md'), 'utf8');
  const demo = guide.match(/^\| Admin \|\s*([^|]+)\|\s*([^|]+)\|/m);
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.FILL_EMAIL || demo[1].trim(), password: process.env.FILL_PASSWORD || demo[2].trim() }) });
  assert.equal(login.status, 200, 'Sign-in failed');
  const user = (await login.json()).user;
  const headers = { 'Content-Type': 'application/json', Cookie: login.headers.getSetCookie().map(x => x.split(';')[0]).join('; ') };
  const request = async (url, body) => {
    const response = await fetch(base + url, { headers, ...(body ? { method: 'PUT', body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.ok(response.ok, `${url}: ${response.status} ${data.message || data.error}`);
    return data;
  };
  const list = await request('/syllabi');
  const matches = list.filter(s => s.userId === user.id && s.programCode === 'BSIE' && s.courseCode === 'IE 204' && s.status === 'draft');
  assert.equal(matches.length, 1, 'Expected one editable BSIE Computing draft');
  const id = matches[0].id;
  const before = await request(`/syllabi/${id}/content`);
  assert.ok(before.editable && before.status === 'draft');
  const institution = await request('/institution/outcomes');
  const program = await request('/programs/BSIE/outcomes');
  const d = structuredClone(before.content);
  const item = (key, t) => ({ id: `bsie${id}_${key}`, t });
  if (!String(d.meta.lecture || '').trim()) d.meta.lecture = '3';
  if (!String(d.meta.lab || '').trim()) d.meta.lab = '0';
  d.meta.prereq = 'Draft assumption: None. Confirm against the approved curriculum before submission.';
  d.description = [item('description', 'Computing introduces the use of algorithms, Python programming and spreadsheet models to solve introductory industrial engineering problems. Students translate process requirements into computational steps, organize production and inventory data, implement calculations and decision rules, and test results using normal and boundary cases. Learning activities address productivity, capacity, basic inventory analysis, data summaries and clear technical reporting. The course culminates in a documented computing project that supports an operational decision and explains its assumptions and limitations. This is a sample teaching draft: the units, prerequisite, assessment weights and proposed BSIE program outcomes require faculty confirmation before submission.')];
  d.outcomes = {
    vision: institution.vision,
    mission: institution.mission,
    egas: program.egas.length ? program.egas : institution.egas,
    pos: program.pos.length ? program.pos : [
      { no: 1, short: 'Draft: Engineering problem solving', text: 'Proposed BSIE outcome for this draft: Apply mathematics, engineering reasoning and computing tools to analyze industrial systems and develop evidence-based solutions.', egas: [1, 4] },
      { no: 2, short: 'Draft: Responsible practice', text: 'Proposed BSIE outcome for this draft: Communicate technical results, collaborate effectively and evaluate operational decisions with attention to professional ethics, sustainability and community needs.', egas: [2, 3] },
    ],
  };
  const egaNos = d.outcomes.egas.map(e => e.no);
  const poNos = d.outcomes.pos.map(p => p.no);
  const specs = [
    ['Computational problem analysis', 'Introductory', 'Analyze an industrial engineering problem and express its inputs, outputs, assumptions and solution steps using pseudocode and a flowchart.', [1]],
    ['Programming and spreadsheet solutions', 'Enabling', 'Develop Python programs and spreadsheet models using variables, decisions, iteration, functions and tabular data to solve production and inventory problems.', [1]],
    ['Testing and interpretation', 'Demonstrating', 'Test computing solutions with normal, boundary and invalid inputs, verify calculations against independent estimates and interpret the results for an operational decision.', [1]],
    ['Responsible communication and teamwork', 'Integration of Values', 'Document and present a team computing project with traceable individual contributions, proper attribution, responsible data handling and an explanation of social and environmental implications.', [2]],
  ];
  d.clos = specs.map(([title, level, statement, desired], i) => {
    const pos = desired.filter(n => poNos.includes(n));
    if (!pos.length) pos.push(poNos[0]);
    const egas = [...new Set(d.outcomes.pos.filter(p => pos.includes(p.no)).flatMap(p => p.egas))].filter(n => egaNos.includes(n));
    return { id: before.content.clos[i]?.id || `bsie${id}_clo${i + 1}`, title, level, statement, pos, egas: egas.length ? egas : [egaNos[0]] };
  });
  const lessons = [
    ['Computing in industrial engineering; data ethics', 'Identify inputs, outputs and data-handling responsibilities in a production case.', 'Case discussion and guided workstation orientation.', 'Annotated production problem brief and data-ethics reflection.', 0],
    ['Algorithms, pseudocode and flowcharts', 'Construct a flowchart and pseudocode for a capacity calculation.', 'Worked examples and peer walkthrough of an algorithm.', 'Flowchart, pseudocode and a manually traced example.', 0],
    ['Python variables, data types and arithmetic', 'Implement a program that computes productivity from validated numerical inputs.', 'Guided coding and pair tracing with sample production data.', 'Productivity calculator with expected and actual outputs.', 1],
    ['Input validation and conditional decisions', 'Use conditional statements to classify inventory levels and reject invalid inputs.', 'Decision-table exercise and paired programming.', 'Inventory decision program and boundary-case tests.', 1],
    ['Iteration and cumulative calculations', 'Use loops to summarize daily production and detect incomplete records.', 'Loop tracing and a guided production-summary exercise.', 'Weekly production summary program and preliminary review.', 1],
    ['Functions and modular program design', 'Decompose a computing task into reusable functions with clear parameters and return values.', 'Refactor a production calculator into testable functions.', 'Documented functions and individual code explanation.', 1],
    ['Lists, dictionaries and tabular records', 'Organize machine and inventory records using appropriate data structures.', 'Record-modeling exercise and small-group code review.', 'Machine-record processing exercise with sample results.', 1],
    ['CSV files and data quality', 'Read a CSV file and identify missing values, duplicates and invalid measurements.', 'Guided file processing and collaborative data-quality review.', 'CSV processing script and data-quality log.', 2],
    ['Spreadsheet formulas and cell references', 'Build a production-cost worksheet using formulas and appropriate cell references.', 'Spreadsheet demonstration and independently reproduced calculations.', 'Auditable cost worksheet with a calculation trace.', 1],
    ['Descriptive summaries and charts', 'Summarize production measurements and choose charts that communicate variation accurately.', 'Guided data-summary and chart interpretation activity.', 'Summary table, chart and a short interpretation of limitations.', 2],
    ['Production capacity and scenario analysis', 'Compare capacity scenarios using documented assumptions and consistent units.', 'Small-group modeling and sensitivity-table workshop.', 'Capacity comparison model with unit and boundary tests.', 2],
    ['Inventory calculations and replenishment models', 'Implement and verify basic inventory calculations under explicitly stated assumptions.', 'Worked inventory examples and cross-checking with a spreadsheet.', 'Inventory model, hand-calculation comparison and assumptions log.', 2],
    ['Debugging, exceptions and test design', 'Design normal, boundary and invalid-input tests and explain how defects were corrected.', 'Debugging clinic and peer review of failing test cases.', 'Test matrix, corrected program and defect log.', 2],
    ['Team project integration and documentation', 'Integrate a computing solution and document data sources, methods, limitations and contributions.', 'Project workshop, code review and individual progress conference.', 'Working project, user guide, contribution log and attributed sources.', 3],
    ['Project presentation and responsible recommendations', 'Defend a computing recommendation using verified results and discuss its operational and community implications.', 'Team demonstration, peer questions and individual reflection.', 'Project presentation, reproducible outputs and individual oral defense.', 3],
  ];
  let lesson = 0;
  d.plan = Array.from({ length: 18 }, (_, i) => {
    const week = i + 1;
    const exam = { 6: 'PRELIM', 12: 'MIDTERM', 18: 'FINAL' }[week];
    const common = { id: `bsie${id}_week${week}`, week: String(week) };
    if (exam) return { ...common, kind: 'exam', ilos: [{ id: `bsie${id}_ilo${week}`, text: '', tags: [] }], contents: `${exam} EXAMINATION`, activities: 'Individual written and practical assessment.', tasks: 'Explain solution steps, complete computing exercises and interpret results.', values: 'Academic honesty, accuracy and accountability.' };
    const [contents, text, activities, tasks, clo] = lessons[lesson++];
    return { ...common, kind: 'lesson', ilos: [{ id: `bsie${id}_ilo${week}`, text, tags: [`clo:${d.clos[clo].id}`] }], contents, activities, tasks, values: 'Honesty in reporting results; responsible stewardship of data and resources; respect for teammates.' };
  });
  d.reqs = [
    'Complete weekly programming and spreadsheet exercises with reproducible inputs, calculations and outputs.',
    'Submit quizzes and practical tasks with explanations of algorithms, assumptions and test cases.',
    'Maintain a computing portfolio containing code, spreadsheets, test records and short learning reflections.',
    'Develop and present a team computing project for an industrial engineering case, with a user guide and individual contribution log.',
    'Complete preliminary, midterm and final written and practical examinations with academic integrity.',
  ].map((text, i) => item(`req${i + 1}`, text));
  d.refs = {
    books: { na: false, items: [item('book', 'Downey, A. B. (2015). Think Python: How to think like a computer scientist (2nd ed.). O\'Reilly Media.')] },
    program: { na: false, items: [item('python', 'Python Software Foundation. (n.d.). The Python tutorial. Python documentation. https://docs.python.org/3/tutorial/')] },
    online: { na: false, items: [item('online', 'OpenStax. (n.d.). Introduction to Python Programming. https://openstax.org/details/books/introduction-python-programming')] },
    electronics: { na: true, items: [] },
  };
  d.grading = { rows: [
    { id: `bsie${id}_grade1`, label: 'Programming and spreadsheet exercises', abbr: 'PE', pct: 25 },
    { id: `bsie${id}_grade2`, label: 'Quizzes and practical tasks', abbr: 'QP', pct: 20 },
    { id: `bsie${id}_grade3`, label: 'Computing project and portfolio', abbr: 'CP', pct: 15 },
    { id: `bsie${id}_grade4`, label: 'Term examinations', abbr: 'TE', pct: 40 },
  ], override: { on: false, term: '', final: '' } };
  const keys = ['meta', 'outcomes', 'description', 'clos', 'plan', 'reqs', 'refs', 'grading'];
  const sections = Object.fromEntries(keys.map(k => [k, d[k]]));
  const latest = await request(`/syllabi/${id}/content`);
  assert.deepEqual(latest.content, before.content, 'Draft changed during preparation');
  assert.ok(latest.editable && latest.status === 'draft');
  const backupDir = path.join(root, '.api-test-backups');
  await fs.mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `bsie-draft-${id}-${Date.now()}.json`);
  await fs.writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx' });
  await request(`/syllabi/${id}/content`, { sections, schemaVersion: 3, baseRevisions: latest.revisions });
  const after = await request(`/syllabi/${id}/content`);
  assert.equal(after.status, 'draft');
  for (const key of keys) assert.deepEqual(after.content[key], d[key], `Saved ${key}`);
  console.log(JSON.stringify({ saved: true, id, program: d.meta.program, course: `${d.meta.code} - ${d.meta.title}`, status: after.status, clos: d.clos.length, planRows: d.plan.length, requirements: d.reqs.length, gradingTotal: d.grading.rows.reduce((s, r) => s + r.pct, 0), aiCheckRun: false, proposedProgramOutcomes: !program.pos.length, backup: path.relative(root, backup) }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
