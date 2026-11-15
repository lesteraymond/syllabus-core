'use strict';
// A SYNTHETIC syllabus for the first paid run of the re-planned checker (scripts/replan-paid-run.cjs). Invented course, invented outcomes, invented
// masters: no real syllabus, faculty or institutional text is sent. It follows every rule except the PLANTED problems below, each with the rule
// or relationship expected to catch it, so the run can report what the real model found, missed, or added.
const LEVELS = ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values'];

const MASTERS = {
  synthetic: true,
  institution: { egas: [
    { no: 1, name: 'Competent professional', text: 'Competent professional: applies the knowledge and skills of the discipline with excellence.' },
    { no: 2, name: 'Creative problem solver', text: 'Creative problem solver: designs and evaluates solutions to real problems.' },
    { no: 3, name: 'Socially responsible person', text: 'Socially responsible person of faith and values: acts ethically for the common good.' },
  ] },
  pos: [
    { no: 1, text: 'Apply knowledge of computing fundamentals appropriate to the discipline.', egas: [1] },
    { no: 2, text: 'Analyze complex computing problems and identify the requirements appropriate to their solution.', egas: [1, 2] },
    { no: 3, text: 'Design, implement and evaluate computer-based solutions that meet given requirements.', egas: [2] },
    { no: 4, text: 'Act ethically and responsibly in professional computing practice, with respect for privacy and the common good.', egas: [3] },
  ],
};

const PLANTED = [
  { id: 'P1', what: 'CLO 3 is about baking bread in a programming course', expect: ['CLO-TITLE'], where: 'clo:c3' },
  { id: 'P2', what: 'CLO 4 is saved as Introductory instead of Integration of Values', expect: ['CLO-LEVEL-LABEL'], where: 'clolevel:c4' },
  { id: 'P3', what: 'Week 5 ILO is about database design while the week teaches conditionals', expect: ['ILO-CONTENT'], where: 'ilo:i5' },
  { id: 'P4', what: 'Week 8 offers one learning activity only', expect: ['ACTIVITY-OPTIONS'], where: 'activities:r8' },
  { id: 'P5', what: 'Week 10 names "Honesty", not one of the six core values', expect: ['VALUES-WEEKLY'], where: 'values:r10' },
  { id: 'P6', what: 'Week 11 task is an essay on Roman history for a strings week', expect: ['TASK-FIT'], where: 'tasks:r11' },
  { id: 'P7', what: 'A 2015 reference (older than 5 years)', expect: ['REF-RECENCY'], where: 'ref:books:b3' },
  { id: 'P8', what: 'Week 14 ILO is written as what the teacher does', expect: ['ILO-CLO'], where: 'ilo:i14' },
];

const lesson = (week, contents, ilo, clo, activities, tasks, values) => ({
  id: 'r' + week, kind: 'lesson', week: String(week), contents,
  ilos: [{ id: 'i' + week, text: ilo, tags: [].concat(clo).map(c => 'clo:' + c) }], activities, tasks, values,
});
const exam = (week, name) => ({
  id: 'r' + week, kind: 'exam', week: String(week), contents: name + ' EXAMINATION', ilos: [{ id: 'i' + week, text: '', tags: [] }],
  activities: '', tasks: '', values: 'Interiority',
});
const two = (a, b) => `- ${a}\n- Option: ${b}`;

function syntheticSyllabus() {
  const clos = [
    { id: 'c1', title: 'Python foundations', statement: 'Explain the basic concepts of Python programming, including data types, operators and control structures.', pos: [1], egas: [1] },
    { id: 'c2', title: 'Problem analysis', statement: 'Analyze programming problems and evaluate alternative Python solutions that use functions and data structures.', pos: [2], egas: [1, 2] },
    { id: 'c3', title: 'Bread making', statement: 'Bake artisan bread using traditional fermentation and kneading techniques.', pos: [3], egas: [2] }, // P1
    { id: 'c4', title: 'Responsible software', statement: 'Evaluate the ethical responsibilities of programmers and create a Python application that respects user privacy and the common good.', pos: [4], egas: [3] },
  ].map((c, i) => ({ ...c, level: i === 3 ? 'Introductory' : LEVELS[i] })); // P2
  const plan = [
    lesson(1, 'Course orientation: vision, mission, course outcomes, requirements, grading system and class policies', 'Explain the course outcomes, requirements and grading policies of the course.', 'c1', two('Orientation talk and syllabus walkthrough', 'small-group discussion of class agreements'), '- Short reflection on learning goals', 'Community-orientedness'),
    lesson(2, 'Introduction to Python: installing Python, using the interpreter and an editor, writing and running a first program', 'Write and run a simple Python program using the interpreter and an editor.', 'c1', two('Guided installation and first program', 'video walkthrough with a step-by-step handout'), '- Lab exercise: first program', 'Humility'),
    lesson(3, 'Variables and data types: integers, floats, strings, booleans and type conversion', 'Explain Python data types and convert values between types.', 'c1', two('Lecture-discussion with live coding', 'pair programming on type-conversion exercises'), '- Quiz on data types', 'Interiority'),
    lesson(4, 'Operators and expressions: arithmetic, comparison and logical operators, operator precedence', 'Evaluate Python expressions that combine arithmetic, comparison and logical operators.', 'c1', two('Worked examples on the board', 'self-paced practice set with instant feedback'), '- Problem set on expressions', 'Courage'),
    lesson(5, 'Conditional statements: if, elif and else; nested conditions', 'Design a normalized relational database schema for a library system.', 'c1', two('Live coding of decision programs', 'flowchart-first exercise for visual learners'), '- Lab exercise: grade calculator with conditions', 'Interiority'), // P3
    exam(6, 'PRELIM'),
    lesson(7, 'Loops: while and for loops, range, break and continue', 'Write Python loops that repeat tasks and stop on a condition.', 'c2', two('Trace-the-loop exercises', 'pair programming on loop puzzles'), '- Quiz on loops', 'Courage'),
    lesson(8, 'Functions: defining functions, parameters, return values and scope', 'Analyze a problem and decompose it into Python functions with parameters and return values.', 'c2', '- Lecture on functions', '- Lab exercise: refactor a program into functions', 'Humility'), // P4
    lesson(9, 'Lists and tuples: indexing, slicing, list methods and iteration', 'Evaluate when to use a list or a tuple to solve a programming problem.', 'c2', two('Live coding with lists and tuples', 'card-sorting activity on choosing data structures'), '- Problem set on lists and tuples', 'Compassion'),
    lesson(10, 'Dictionaries and sets: keys and values, membership, set operations', 'Analyze problems that need lookups and solve them with dictionaries and sets.', 'c2', two('Worked examples on word counting', 'peer teaching in small groups'), '- Lab exercise: word-frequency counter', 'Honesty'), // P5
    lesson(11, 'Strings: string methods, formatting and text processing', 'Apply string methods to clean and format text data in Python.', 'c2', two('Live coding on text cleaning', 'self-paced notebook on string formatting'), '- Essay on the history of the Roman Empire', 'Interiority'), // P6
    exam(12, 'MIDTERM'),
    lesson(13, 'File handling: reading and writing text and CSV files', 'Create Python programs that read and write text and CSV files.', 'c3', two('Guided lab on file input and output', 'video demonstration with a practice file set'), '- Lab exercise: CSV report generator', 'Missionary Spirit'),
    lesson(14, 'Exceptions: try, except, finally; raising and handling errors', 'The teacher will discuss exception handling in Python.', 'c3', two('Debugging clinic on common errors', 'pair programming on error-handling exercises'), '- Quiz on exceptions', 'Humility'), // P8
    lesson(15, 'Modules and packages: importing modules, the standard library, creating a module', 'Create a reusable Python module and import it into a program.', 'c3', two('Live coding of a small module', 'research task on one standard-library module'), '- Lab exercise: build and import a module', 'Community-orientedness'),
    lesson(16, 'Introduction to object-oriented programming: classes, objects, attributes and methods', 'Create simple Python classes with attributes and methods.', 'c3', two('Modeling real objects as classes', 'design-on-paper activity before coding'), '- Lab exercise: class design', 'Courage'),
    lesson(17, 'Final project: a small Python application that handles user data responsibly', 'Create a small Python application that protects user data and evaluate the ethical choices made in its design.', ['c4', 'c3'], two('Project work in teams with mentoring', 'individual project option with weekly check-ins'), '- Final project and ethics reflection paper', 'Missionary Spirit'),
    exam(18, 'FINAL'),
  ];
  return {
    schemaVersion: 2,
    meta: { courseId: 9999, code: 'SYN 101', title: 'Introduction to Python Programming', program: 'BSIT', lecture: '2', lab: '1', prereq: 'None' },
    description: [{ id: 'd1', t: 'A synthetic course used only to evaluate the checker.' }],
    clos, plan, reqs: [{ id: 'q1', t: 'Laboratory exercises' }, { id: 'q2', t: 'Quizzes' }, { id: 'q3', t: 'Examinations' }, { id: 'q4', t: 'Final project' }],
    refs: {
      books: { na: false, items: [
        { id: 'b1', t: 'Matthes, E. (2023). Python crash course (3rd ed.). No Starch Press.' },
        { id: 'b2', t: 'Sweigart, A. (2025). Automate the boring stuff with Python (3rd ed.). No Starch Press.' },
        { id: 'b3', t: 'Downey, A. B. (2015). Think Python: How to think like a computer scientist. O\'Reilly Media.' }, // P7
      ] },
      program: { na: true, items: [] },
      online: { na: false, items: [{ id: 'o1', t: 'Python Software Foundation. (2025). The Python tutorial. https://docs.python.org/3/tutorial/' }] },
      electronics: { na: true, items: [] },
    },
    grading: { rows: [{ id: 'g1', label: 'Class Standing', pct: 60 }, { id: 'g2', label: 'Examination', pct: 40 }], override: { on: false, term: '', final: '' } },
    signoff: {},
  };
}

// Which planted problems a check (and its plan) found: by rule name among the misalignments and review items, at the planted field.
function plantedReport(result, plan = null) {
  const found = [
    ...result.misalignments.map(m => ({ rule: m.rule, key: m.fieldKey || null, where: m.where || null })),
    ...result.fixed.findings.filter(f => f.severity === 'review').map(f => ({ rule: f.rule, key: null, where: f.where })),
    ...result.judged.results.filter(r => r.status !== 'ok' && r.status !== 'not_checked').map(r => ({ rule: r.relationship, key: r.fieldKey })),
  ];
  const at = (p, f) => {
    const [kind, a, b] = p.where.split(':');
    if (f.key) return f.key === p.where || (kind === 'clolevel' && f.key === 'clo:' + a);
    const w = f.where || {};
    return (kind === 'clolevel' && w.cloId === a) || (['activities', 'values', 'tasks'].includes(kind) && w.row === a) || (kind === 'ref' && w.group === a && w.ref === b) || (kind === 'ilo' && w.ilo === a);
  };
  return PLANTED.map(p => ({ ...p, found: found.some(f => p.expect.includes(f.rule) && at(p, f)), changedByPlan: plan ? plan.changes.some(c => c.key === p.where || (p.where.startsWith('clolevel') && c.key === p.where)) : null }));
}

module.exports = { syntheticSyllabus, MASTERS, PLANTED, plantedReport };
