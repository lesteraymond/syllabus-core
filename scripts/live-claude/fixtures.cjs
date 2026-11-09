'use strict';
// SYNTHETIC test syllabi for the controlled real-Claude test (docs/checker-comprehensive/live/LIVE-TEST-PLAN.md). Everything here is invented: no faculty record, student
// data or institutional document. The institution, program outcomes and course are fictional, and the text is written so a real model has something meaningful to judge
// (the conformance fixtures use placeholder text such as "Topic 1", which is fine for a scripted provider and useless for a real one).
//   node scripts/live-claude/fixtures.cjs            writes docs/checker-comprehensive/live/fixtures/case-{a,b,c,d}.json (deterministic)
// Each file: { meta, content, masters, expectations }. `expectations` are PROVISIONAL, written by the developer to say what a careful reader would likely conclude; they are
// not the truth, are not faculty-validated, and a model that disagrees is not necessarily wrong (it is what the human review in the plan is for).
const fs = require('node:fs');
const path = require('node:path');
const harness = require('../../server/lib/syllabuscheck/vpaa-conformance/harness');

const CASES = ['a', 'b', 'c', 'd', 'e'];
const OUT = path.resolve(__dirname, '../../docs/checker-comprehensive/live/fixtures');

const EGAS = [
  { no: 1, name: 'Competence in the discipline', short: 'Competence' },
  { no: 2, name: 'Critical and creative thinking', short: 'Thinking' },
  { no: 3, name: 'Collaboration and communication', short: 'Collaboration' },
  { no: 4, name: 'Integrity and service', short: 'Integrity' },
];
const POS = [
  { no: 1, short: 'PO 1', text: 'Apply knowledge of computing and mathematics to solve computing problems.', egas: [1] },
  { no: 2, short: 'PO 2', text: 'Analyze a problem and identify the computing requirements appropriate to its solution.', egas: [2] },
  { no: 3, short: 'PO 3', text: 'Design, implement and evaluate computing-based solutions to meet desired needs.', egas: [1, 2] },
  { no: 4, short: 'PO 4', text: 'Work effectively in teams and communicate clearly with technical and non-technical audiences.', egas: [3] },
  { no: 5, short: 'PO 5', text: 'Practice professional, ethical and socially responsible conduct in computing.', egas: [4] },
];
const CLOS = [
  { title: 'Object-oriented concepts', level: 'Introductory', statement: 'Explain the basic concepts of object-oriented programming, namely classes, objects, encapsulation and inheritance, using Java examples.', egas: [1], pos: [1] },
  { title: 'Object-oriented problem solving', level: 'Enabling', statement: 'Apply inheritance, polymorphism and interfaces to design and write Java programs that solve well-defined problems.', egas: [1, 2], pos: [1, 3] },
  { title: 'Robust programs', level: 'Demonstrating', statement: 'Develop console applications that use exception handling, collections and file input and output, and verify them with unit tests.', egas: [1, 2], pos: [2, 3] },
  { title: 'Responsible teamwork', level: 'Integration of Values', statement: 'Work with teammates to deliver a software application, practicing honesty, collaboration and respect for the data of its users in the process.', egas: [3, 4], pos: [4, 5] },
];
const DESCRIPTION = 'This course continues the study of programming using the Java language, with emphasis on object-oriented design. Students learn to model problems with classes, inheritance, polymorphism and interfaces, to handle errors, to store data in collections and files, and to test their programs. Throughout the term they practice working in teams and taking responsibility for the quality and honesty of their software, culminating in a team mini-project.';

// week -> [clo index, contents, ILO, learning activities, assessment task, value]
const LESSONS = {
  1: [0, 'Course orientation; review of Java syntax; classes and objects', 'Describe the purpose of a class and an object in a Java program', 'Lecture-discussion on classes and objects; guided coding of a Student class', '- Seatwork: identify the classes and objects in a short problem description', 'Core Value: Excellence'],
  2: [0, 'Encapsulation: access modifiers, constructors, getters and setters', 'Explain how encapsulation protects the data of an object', 'Live coding of an Account class with private fields; pair debugging exercise', '- Quiz 1: encapsulation concepts', 'Core Value: Integrity'],
  3: [0, 'Inheritance, the super keyword and method overriding', 'Describe how a subclass inherits and overrides the members of a superclass', 'Demonstration of a Vehicle class hierarchy; drawing class diagrams in groups', '- Seatwork: draw a class diagram for a given inheritance problem', 'Core Value: Excellence'],
  4: [1, 'Polymorphism and abstract classes', 'Apply polymorphism to write code that handles different subclasses through one superclass type', 'Laboratory: implement a Shape hierarchy with an abstract class and an overridden area method', '- Laboratory exercise 1: Shape hierarchy program', 'Core Value: Excellence'],
  5: [1, 'Interfaces and their use as contracts', 'Implement an interface in a class to satisfy a defined contract', 'Laboratory: implement a Payable interface in several Employee classes', '- Laboratory exercise 2: interface implementation', 'Core Value: Integrity'],
  7: [1, 'Packages, access control and design principles: cohesion and coupling', 'Organize classes into packages and justify a design using cohesion and coupling', 'Group refactoring workshop on a poorly organized program', '- Seatwork: refactoring write-up', 'Core Value: Collaboration'],
  8: [1, 'Review of object-oriented design; specification of the mini-project', 'Design the classes of a mini-project by applying object-oriented principles', 'Design clinic: each team presents its class design and receives feedback', '- Class design submission for the mini-project', 'Core Value: Collaboration'],
  9: [2, 'Exception handling: try, catch, finally and custom exceptions', 'Write code that handles runtime errors with exceptions', 'Laboratory: add input validation and exception handling to a banking program', '- Laboratory exercise 3: exception handling', 'Core Value: Responsibility'],
  10: [2, 'The collections framework: lists, sets and maps', 'Use collections to store and process groups of objects', 'Laboratory: build a student record manager with ArrayList and HashMap', '- Laboratory exercise 4: collections', 'Core Value: Excellence'],
  11: [2, 'Generics and sorting with Comparable and Comparator', 'Sort collections of objects using Comparable and Comparator', 'Laboratory: sort student records by grade and by name', '- Quiz 2: collections and sorting', 'Core Value: Excellence'],
  13: [2, 'File input and output: reading and writing text files', 'Read and write data in text files from a Java program', 'Laboratory: save and load the student record manager from a file', '- Laboratory exercise 5: file persistence', 'Core Value: Responsibility'],
  14: [2, 'Unit testing with JUnit and debugging practices', 'Create unit tests that verify the behavior of classes', 'Pair programming: write tests for the record manager, then fix the defects they reveal', '- Laboratory exercise 6: unit tests', 'Core Value: Integrity'],
  15: [3, 'Teamwork in software development: version control and code review', 'Collaborate with teammates using version control and code review', 'Team workshop on a shared repository; peer code review with a checklist', '- Peer code review report', 'Core Value: Collaboration'],
  16: [3, 'Responsible software practice: documentation, licensing and user privacy', "Explain how documentation and respect for users' data reflect responsible programming", 'Case discussion of privacy mistakes in real applications; documentation workshop', '- Reflection paper on responsible programming', 'Core Value: Integrity'],
  17: [3, 'Mini-project presentation and demonstration', 'Present and demonstrate a team application, stating honestly what it can and cannot do', 'Team project demonstrations with a question-and-answer round', '- Mini-project demonstration with a rubric-based evaluation', 'Core Value: Collaboration'],
};

function caseA() {
  const { content, masters } = harness.sample();
  const m = structuredClone(masters), c = structuredClone(content);
  m.institution.egas = structuredClone(EGAS); m.pos = structuredClone(POS);
  c.outcomes.egas = structuredClone(EGAS); c.outcomes.pos = structuredClone(POS);
  c.catalog = { ...c.catalog, institution: { ...(c.catalog?.institution || {}), egas: structuredClone(EGAS) } };
  c.description = [{ id: 'd1', t: DESCRIPTION }];
  c.clos = c.clos.map((clo, i) => ({ ...clo, ...CLOS[i] }));
  for (const row of c.plan) {
    const lesson = LESSONS[Number(row.week)];
    if (!lesson) continue; // exam rows keep their text
    const [clo, contents, ilo, activities, tasks, value] = lesson;
    Object.assign(row, { contents, activities, tasks, values: value, ilos: [{ ...row.ilos[0], text: ilo, tags: [`clo:${c.clos[clo].id}`] }] });
  }
  return { content: c, masters: m };
}
const weekRow = (c, week) => c.plan.find((r) => String(r.week) === String(week));

function build(which) {
  const base = caseA();
  const c = base.content;
  const expectations = { relationships: [], classification: [], note: '' };
  if (which === 'a') {
    expectations.note = 'Meaningfully aligned throughout. Expect mostly ALIGNED. A model that flags a few weeks as PARTIALLY_ALIGNED is not necessarily wrong: the human review decides.';
  }
  if (which === 'b') {
    Object.assign(weekRow(c, 2), { contents: 'Menu planning and food costing for catering services' });
    Object.assign(weekRow(c, 4), { activities: 'Field trip to a local bakery and a tasting session' });
    weekRow(c, 7).ilos[0].text = 'Compose a poem about the autumn season';
    Object.assign(weekRow(c, 9), { tasks: '- Essay: the causes of the First World War' });
    Object.assign(weekRow(c, 13), { tasks: '- Quiz 3: inheritance and polymorphism' });
    expectations.relationships = [
      { week: 2, type: 'Content-course', expect: 'not aligned: catering content in a Java programming course' },
      { week: 2, type: 'Content-ILO', expect: 'not aligned: the ILO is about encapsulation, the content is about menu planning' },
      { week: 4, type: 'ILO-activity', expect: 'not aligned: a bakery field trip does not practise polymorphism' },
      { week: 4, type: 'Content-activity', expect: 'not aligned: polymorphism content, bakery activity' },
      { week: 7, type: 'Content-ILO', expect: 'not aligned: a poem is unrelated to packages and design principles' },
      { week: 7, type: 'ILO-CLO', expect: 'not aligned: a poem does not build CLO2' },
      { week: 9, type: 'Content-assessment', expect: 'not aligned: a history essay does not measure exception handling' },
      { week: 13, type: 'Activity-assessment', expect: 'not aligned: the quiz covers inheritance, the activity is file input and output' },
    ];
    expectations.note = 'Deliberate mismatches in weeks 2, 4, 7, 9 and 13; every other week is as in Case A.';
  }
  if (which === 'c') {
    c.clos[0].statement = 'Design, implement and defend an original, scalable distributed system architecture for an enterprise setting.';
    c.clos[1].statement = 'List the names of the primitive data types of Java.';
    c.clos[2].statement = 'Define the term algorithm.';
    c.clos[3].statement = 'Compute the time complexity of common sorting algorithms using Big-O notation.';
    expectations.classification = [
      { clo: 1, label: 'Introductory', expect: 'does not fit: the statement demands expert-level design and defense' },
      { clo: 2, label: 'Enabling', expect: 'does not fit: recalling names of data types is introductory recall, not applying' },
      { clo: 3, label: 'Demonstrating', expect: 'does not fit: a definition is not a demonstration of a competence' },
      { clo: 4, label: 'Integration of Values', expect: 'does not fit: no value is integrated; the statement is purely technical' },
    ];
    expectations.note = 'Only the four CLO statements are altered; the weekly plan is as in Case A, so ILO-CLO relationships will also show tension with the altered CLOs.';
  }
  if (which === 'd') {
    for (const week of [3, 8, 11, 16]) Object.assign(weekRow(c, week), { contents: 'Various topics', activities: 'Class activities', tasks: '- Assessment' });
    for (const week of [3, 8, 11, 16]) weekRow(c, week).ilos[0].text = 'Understand the lesson';
    c.clos[1].statement = 'Appreciate programming.';
    expectations.relationships = [3, 8, 11, 16].map((week) => ({ week, type: 'all weekly relationships', expect: 'insufficient evidence: the text is too vague to judge alignment either way' }));
    expectations.classification = [{ clo: 2, label: 'Enabling', expect: 'insufficient evidence: "Appreciate programming" does not state a competence' }];
    expectations.note = 'Weeks 3, 8, 11 and 16 and CLO 2 are deliberately vague. The checker should say it cannot tell (INSUFFICIENT_EVIDENCE / Not checked), never invent support.';
  }
  if (which === 'e') {
    // Case E: a REAL course identity from the approved BSIT 2022-2023 curriculum (IT 202, row copied from the approved reference) with SYNTHETIC syllabus content. Used by the
    // single-request smoke test, which sends week 1 (the seven VPAA relationships) and the classification of CLO 1: only those parts are written for this course. The rest of the
    // plan is carried over from Case A and is NOT part of the smoke scope. No PO text is sent by the smoke request; the institution and program outcomes stay fictional.
    Object.assign(c.meta, { code: 'IT 202', title: 'COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING)', program: 'BSIT', lecture: '2', lab: '1', prereq: 'IT 101', yearLevel: '2', curriculumYear: '2022-2023' });
    c.description = [{ id: 'd1', t: 'This course introduces the fundamentals of programming using the Java language. Students learn to express solutions to simple problems with variables, expressions, conditions, loops and methods, and to test and debug small console programs.' }];
    Object.assign(c.clos[0], { title: 'Programming fundamentals', level: 'Introductory', statement: 'Explain the basic building blocks of a program, namely variables, data types, expressions and control structures, using Java examples.' });
    Object.assign(weekRow(c, 1), { contents: 'Course orientation; the structure of a Java program; variables, data types and expressions', activities: 'Lecture-discussion on variables and data types; guided coding of a program that reads two numbers and prints their sum', tasks: '- Seatwork: trace the output of five short Java statements', values: 'Core Value: Integrity' });
    weekRow(c, 1).ilos[0].text = 'Describe the role of variables and data types in a simple Java program';
    base.masters.curricula = [{ program: 'BSIT', curriculumYear: '2022-2023', status: 'approved', courses: [{ code: 'IT 202', title: 'COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING)', prereq: 'IT 101', lecture: 2, lab: 1, yearLevel: 2 }] }];
    expectations.note = 'Meaningfully aligned in week 1 and CLO 1 (the only parts the smoke sends). Provisional: a model that flags something is not necessarily wrong; the human review decides. Course identity IT 202 is from the approved BSIT curriculum; everything else is invented.';
  }
  return { meta: { case: which.toUpperCase(), synthetic: true, course: which === 'e' ? 'IT 202 Computer Programming 1 (approved identity; synthetic content)' : 'IT 204 Computer Programming 2 (fictional)', generatedBy: 'scripts/live-claude/fixtures.cjs', provisionalExpectations: true }, content: c, masters: base.masters, expectations };
}

function load(which) { return JSON.parse(fs.readFileSync(path.join(OUT, `case-${which}.json`), 'utf8')); }
function write() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const which of CASES) fs.writeFileSync(path.join(OUT, `case-${which}.json`), JSON.stringify(build(which), null, 2) + '\n');
  return CASES.map((w) => path.join(OUT, `case-${w}.json`));
}

module.exports = { CASES, build, load, write, OUT };
if (require.main === module) { for (const f of write()) console.log('wrote ' + path.relative(process.cwd(), f)); }
