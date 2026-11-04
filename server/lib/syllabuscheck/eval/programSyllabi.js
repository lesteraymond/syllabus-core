'use strict';
// Representative 18-week syllabi for whole-pipeline tests: one course per program, BSIT IT 202, BSIE IE-402 and BSCpE CpE-304.
// REAL (from the repository's transcriptions): the course identity (code, title, units, prerequisite, year level, curriculum year) from
// db/local-curriculum-data.cjs, and the Program Outcomes and EGAs from db/local-outcome-data.cjs.
// SYNTHETIC (written by the assistant for testing, NOT a faculty syllabus): the description, CLOs, the 18-week plan and the references. Every
// reference uses an invented author and an "Example" publisher or example.org address; none is a real work. The institution vision and mission are
// the compliance fixture's placeholder text. Nothing here is an institutional learning plan.
// The structure (18 rows, examinations in weeks 6, 12 and 18, the reference groups, requirements, grading and sign-off) is the compliance fixture's,
// so the coded form rules pass and the official gates can be observed.
const F = require('../../compliance/fixtures');
const { sources } = require('../../../db/local-outcome-data.cjs');
const { programs } = require('../../../db/local-curriculum-data.cjs');

const squash = text => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const ORIENT_ACTIVITIES = '- Setting and sharing of class expectations\n- Discussion of the course outline, requirements, grading system and class policies';
const ORIENT_TASK = '- Written statement of personal learning goals for the course';
const ORIENT_VALUE = 'Community-orientedness: in small groups students agree on shared class expectations and present them to the class.';
// [contents, ILO, CLO number, activities, assessment tasks, values]; null marks an examination week
const COURSES = {
  bsit: {
    program: 'BSIT', code: 'IT 202', label: 'BSIT - IT 202 Computer Programming 1',
    description: 'This course introduces the fundamentals of programming using Java. Students learn how a program is written, compiled and run; how data are represented with variables, data types and operators; how programs make decisions and repeat actions with conditional and looping statements; and how methods and arrays organize larger programs. Laboratory work develops the habits of writing readable code, testing it against expected outputs and debugging it systematically. The course closes with a small programming project in which students design, implement and test a console application that solves a stated problem.',
    clos: [
      ['Introductory', 'Explain how a Java program is structured, compiled and executed, and how data are represented with variables, data types and operators.', [7, 9], [1, 2]],
      ['Enabling', 'Apply conditional and looping statements to write Java programs that make decisions and repeat actions correctly.', [6, 7], [1, 2]],
      ['Demonstrating', 'Develop modular Java programs that use methods, arrays and strings to process data.', [7, 8], [1, 2]],
      ['Integration of Values', 'Design, test and debug a console application that solves a stated problem, working responsibly and collaboratively.', [3, 8], [2, 3]],
    ],
    weeks: [
      ['Course orientation: course objectives, requirements, grading system and class policies; the vision, mission and goals of LCUP and of CITE', 'Describe the course objectives, requirements and grading system, and how the course supports the goals of the institution.', 1, ORIENT_ACTIVITIES, ORIENT_TASK, ORIENT_VALUE],
      ['Introduction to programming and the Java development environment: source code, compiler, Java Virtual Machine and the structure of a Java program', 'Explain how a Java source file is compiled and executed, and identify the parts of a simple Java program.', 1, '- Lecture-demonstration of installing and using the JDK and an IDE\n- Laboratory: write, compile and run a first Java program', '- Laboratory exercise: a program that prints a formatted greeting\n- Short quiz on the compile-run cycle', 'Humility: students compare their first program with a partner and accept corrections to errors they could not see themselves.'],
      ['Variables, primitive data types, constants and naming conventions', 'Declare and initialize variables of the appropriate primitive data types in Java programs.', 1, '- Guided coding of variable declarations with immediate feedback\n- Pair exercise: choose data types for given real-world values', '- Laboratory exercise on declaring and printing variables\n- Quiz on data types and ranges', 'Interiority: each student writes a short reflection on the mistakes they made in choosing data types and what they will check next time.'],
      ['Operators and expressions: arithmetic, relational, logical and assignment operators; operator precedence; type casting', 'Evaluate and write Java expressions using arithmetic, relational and logical operators with correct precedence.', 1, '- Worked examples of expression evaluation\n- Laboratory: tracing tables for expressions', '- Problem set: evaluate and write expressions\n- Laboratory exercise: a simple calculator program', 'Courage: students present their traced answers to the class, including the ones they got wrong, and explain the correction.'],
      ['Console input and output: the Scanner class, formatted output, and reading numeric and text input', 'Write Java programs that read user input with Scanner and display formatted output.', 1, '- Demonstration of Scanner and printf\n- Laboratory: interactive programs', '- Laboratory exercise: a program that computes and prints a receipt from user input', 'Compassion: students design input prompts and messages that are clear and kind to a first-time user and test them with a classmate.'],
      null,
      ['Conditional statements: if, if-else and nested if', 'Develop Java programs that use if, if-else and nested if statements to make decisions.', 2, '- Guided problem solving with flowcharts\n- Pair programming in the laboratory with peer code review', '- Programming task: a grade-classification program tested with boundary values', 'Humility: in the peer code review each student names one weakness in their own program and accepts the comments of the reviewer before revising.'],
      ['The switch statement and menu-driven programs', 'Write menu-driven Java programs using the switch statement.', 2, '- Demonstration of switch and its pitfalls\n- Laboratory: build a menu-driven program', '- Laboratory exercise: a menu-driven unit-conversion program', 'Community-orientedness: groups agree on a common menu design and divide the cases among members, integrating them into one program.'],
      ['Loops: while and do-while; sentinel-controlled and counter-controlled repetition', 'Apply while and do-while loops to solve problems that need counter-controlled and sentinel-controlled repetition.', 2, '- Trace tables for loops\n- Laboratory: repetition exercises', '- Programming task: a sentinel-controlled average calculator', 'Courage: students report honestly when a loop runs forever and ask for help to find the error instead of hiding it.'],
      ['The for loop and nested loops', 'Develop Java programs that use for loops and nested loops to generate patterns and tables.', 2, '- Worked examples of nested loops\n- Laboratory: pattern and table programs', '- Laboratory exercise: multiplication table and pattern programs\n- Quiz on loop tracing', 'Interiority: students keep a debugging journal of the loop errors they met and what they learned from them.'],
      ['Methods: defining and calling methods, parameters, return values and scope', 'Write modular Java programs by defining and calling methods with parameters and return values.', 3, '- Demonstration of refactoring a long program into methods\n- Laboratory: method exercises', '- Programming task: refactor an earlier program into methods and test each method', 'Missionary Spirit: students write a small reusable method that helps a classmate and explain it to them.'],
      null,
      ['One-dimensional arrays: declaration, traversal, searching and computing statistics', 'Develop Java programs that store and process data in one-dimensional arrays.', 3, '- Guided coding of array traversal\n- Laboratory: array processing', '- Laboratory exercise: compute the average, highest and lowest of a list of scores', 'Compassion: students build a program that summarizes class scores without exposing the score of any one student, respecting privacy.'],
      ['Two-dimensional arrays and their applications', 'Apply two-dimensional arrays to represent and process tabular data in Java programs.', 3, '- Demonstration with a seating-chart example\n- Laboratory: matrix exercises', '- Programming task: a seat-reservation program using a two-dimensional array', 'Community-orientedness: pairs design a shared seat-reservation program for a school event and test it with the data of the other pair.'],
      ['Strings and string methods', 'Use String methods to manipulate and validate text in Java programs.', 3, '- Worked examples of common String methods\n- Laboratory: text processing', '- Laboratory exercise: validate and format user names and identification numbers', 'Humility: students review the validation rules of a classmate and adopt the better approach when it handles more cases.'],
      ['Debugging and testing: reading error messages, planning test cases and systematic debugging', 'Test and debug Java programs using planned test cases and systematic debugging steps.', 4, '- Demonstration of the IDE debugger\n- Laboratory: find and fix bugs in a prepared program', '- Test report: test cases, expected and actual results for a given program', 'Courage: students report every failing test case truthfully in their test report, including cases they cannot yet fix.'],
      ['Mini project: design, implementation and testing of a console application', 'Design, implement and test a console application that solves a stated problem.', 4, '- Team project work with weekly consultations\n- Project demonstration to the class', '- Project: working program, test report and demonstration', 'Missionary Spirit: teams build an application that serves a real need of a campus office or community group and present it to them.'],
      null,
    ],
    refs: {
      books: ['Reyes, M. A., & Santos, J. B. (2022). Fundamentals of Java programming (3rd ed.). Example University Press.', 'Lim, K. T. (2021). Problem solving with Java. Example Academic Press.'],
      program: ['Example Institute of Computing. (2023). Laboratory manual for introductory programming (Report No. 3). Example Institute of Computing.'],
      online: ['Example Learning Network. (2024, March 5). Control statements in Java. https://www.example.org/java/control-statements'],
    },
  },
  bsie: {
    program: 'BSIE', code: 'IE-402', label: 'BSIE - IE-402 Systems Engineering',
    description: 'This course introduces systems engineering as an interdisciplinary approach to defining, designing, integrating and managing complex systems over their life cycle. Students apply systems thinking to industrial problems; elicit stakeholder needs and translate them into verifiable requirements; decompose functions, develop architectures and evaluate alternatives through trade studies; and plan integration, verification and validation. Reliability, risk and life-cycle cost are treated as design considerations. Through a team case study students produce the main systems engineering work products for an industrial system and present them for review.',
    clos: [
      ['Introductory', 'Explain the principles of systems thinking and the systems engineering life cycle and their role in industrial engineering practice.', [1, 12], [1, 2]],
      ['Enabling', 'Analyze stakeholder needs and write verifiable system requirements with traceability for an industrial system.', [3, 5], [1, 2]],
      ['Demonstrating', 'Develop functional and physical architectures and evaluate design alternatives using trade studies and modeling.', [3, 11], [1, 2]],
      ['Integration of Values', 'Plan the integration, verification, validation and risk management of a system responsibly as a member of a multidisciplinary team.', [4, 6], [2, 3]],
    ],
    weeks: [
      ['Course orientation: course objectives, requirements, grading system and class policies; the vision, mission and goals of LCUP and of the department', 'Describe the course objectives, requirements and grading system, and how the course supports the goals of the institution.', 1, ORIENT_ACTIVITIES, ORIENT_TASK, ORIENT_VALUE],
      ['Systems thinking: systems, subsystems, boundaries, interactions and emergent behaviour', 'Explain the elements of a system and describe the interactions and boundaries of a given industrial system.', 1, '- Lecture-discussion with industrial examples\n- Group activity: draw the system boundary and context diagram of a production line', '- Context diagram of an assigned industrial system', 'Community-orientedness: groups combine the view of every member into one shared context diagram of the system.'],
      ['The systems engineering life cycle and process models: waterfall, Vee and spiral', 'Compare systems engineering life-cycle models and select one suited to a given project.', 1, '- Lecture with case examples\n- Small-group comparison of life-cycle models', '- Short essay: choose and justify a life-cycle model for a case project', 'Interiority: students reflect in writing on how planning before acting applies to their own projects.'],
      ['Stakeholder analysis and elicitation of needs', 'Identify stakeholders and elicit their needs for an industrial system using interviews and observation.', 2, '- Demonstration of interview techniques\n- Role-play interviews with a stakeholder', '- Stakeholder register and summary of elicited needs', 'Compassion: during the role-play interviews students listen for the needs of workers who are affected by the system but have little say in it.'],
      ['Requirements analysis: writing verifiable requirements and building a traceability matrix', 'Write verifiable system requirements and trace them to stakeholder needs.', 2, '- Workshop on good and poor requirement statements\n- Team exercise: build a traceability matrix', '- Requirements document with a traceability matrix', 'Humility: teams invite another team to critique their requirements and revise the ones found ambiguous.'],
      null,
      ['Functional analysis and decomposition: functional flow block diagrams', 'Decompose system functions and represent them with functional flow block diagrams.', 3, '- Worked example of functional decomposition\n- Group exercise on an assembly process', '- Functional flow block diagram of the case system', 'Community-orientedness: each member decomposes one subsystem and the group integrates them into one diagram.'],
      ['System architecture: allocating functions to physical components; interfaces', 'Develop a physical architecture by allocating functions to components and defining interfaces.', 3, '- Lecture-demonstration\n- Team design session', '- Architecture diagram with an interface table', 'Courage: teams defend their architecture choices in a design review and accept challenges to them openly.'],
      ['Trade studies and multi-criteria decision analysis', 'Evaluate design alternatives with a weighted trade study and justify the selected alternative.', 3, '- Worked example of a weighted decision matrix\n- Team trade study', '- Trade study report with sensitivity analysis', 'Courage: students state honestly when the data do not favour the alternative they prefer.'],
      ['Modeling and simulation in systems engineering', 'Use a simple simulation model to predict the performance of a system alternative.', 3, '- Demonstration of a discrete-event simulation tool\n- Modeling exercise in groups', '- Simulation exercise report', 'Interiority: students keep a reflection log on the assumptions behind their model and its limits.'],
      ['Reliability, maintainability and availability', 'Calculate the reliability and availability of simple system configurations.', 3, '- Problem-solving session\n- Group computation exercise', '- Problem set on reliability and availability', 'Missionary Spirit: groups relate system reliability to the safety of the people who depend on the system and propose one improvement.'],
      null,
      ['System integration and interface management', 'Plan the integration sequence of subsystems and manage their interfaces.', 4, '- Case discussion of integration failures\n- Team planning exercise', '- Integration plan for the case system', 'Community-orientedness: teams coordinate their integration plans with another team whose subsystem interfaces with theirs.'],
      ['Verification and validation planning', 'Develop a verification and validation plan that links tests to requirements.', 4, '- Lecture on verification methods\n- Team workshop', '- Verification and validation matrix', 'Courage: teams report requirements that cannot be verified as written instead of hiding them.'],
      ['Risk management in systems engineering', 'Identify, assess and plan responses to project risks using a risk register.', 4, '- Lecture with case examples\n- Group risk workshop', '- Risk register for the case project', 'Compassion: groups consider how each risk could affect workers and the community, not only cost and schedule.'],
      ['Systems engineering management: planning, technical reviews and life-cycle cost', 'Prepare a systems engineering management plan with review milestones and a life-cycle cost estimate.', 4, '- Lecture-discussion\n- Team planning session', '- Systems engineering management plan outline', 'Humility: teams ask a faculty adviser to review their plan and incorporate the feedback.'],
      ['Case study presentation: systems engineering work products for an industrial system', 'Present and defend the systems engineering work products of the team case study.', 4, '- Team presentations and panel review', '- Final case study report and presentation', 'Missionary Spirit: teams present how their system would serve the people of a partner community or company.'],
      null,
    ],
    refs: {
      books: ['Garcia, T. R. (2020). Systems engineering principles and practice. Example Press.', 'Navarro, L. P., & Cruz, D. M. (2019). Requirements engineering for industrial systems (2nd ed.). Example Academic Press.'],
      program: ['Example Systems Engineering Society. (2022). Systems engineering handbook for industrial projects (Report No. 7). Example Systems Engineering Society.'],
      online: ['Example Engineering Library. (2023, August 14). Trade studies and decision analysis. https://www.example.org/se/trade-studies'],
    },
  },
  bscpe: {
    program: 'BSCPE', code: 'CpE-304', label: 'BSCpE - CpE-304 Fundamentals of Mixed Signals and Sensors',
    description: 'This course covers the principles of mixed-signal systems that connect the analog world to digital processors. Topics include analog and digital signals, operational amplifier circuits, signal conditioning and filtering, sampling and quantization, analog-to-digital and digital-to-analog conversion, and the operating principles of common sensors and transducers. Students analyze and design signal-conditioning circuits, interface sensors with microcontrollers and build a small data acquisition system, considering noise, accuracy and calibration throughout.',
    clos: [
      ['Introductory', 'Explain the characteristics of analog and digital signals, the operation of operational amplifier circuits and the principles of common sensors.', [1, 2], [1, 2]],
      ['Enabling', 'Analyze and design signal-conditioning circuits, including amplifiers and filters, for sensor signals.', [1, 3], [1, 2]],
      ['Demonstrating', 'Apply sampling, quantization and data conversion principles in analog-to-digital and digital-to-analog systems.', [5, 11], [1, 2]],
      ['Integration of Values', 'Design and test a sensor-based data acquisition system with a microcontroller, working safely and honestly as a team.', [3, 4], [2, 3]],
    ],
    weeks: [
      ['Course orientation: course objectives, requirements, grading system and laboratory safety policies; the vision, mission and goals of LCUP and of the department', 'Describe the course objectives, requirements and grading system, and how the course supports the goals of the institution.', 1, ORIENT_ACTIVITIES, ORIENT_TASK, ORIENT_VALUE],
      ['Analog and digital signals: amplitude, frequency, resolution and noise', 'Distinguish analog from digital signals and describe their key characteristics.', 1, '- Lecture-demonstration with an oscilloscope\n- Small-group signal identification exercise', '- Quiz on signal characteristics', 'Humility: students compare their readings of the oscilloscope traces in pairs and correct their own misreadings.'],
      ['Operational amplifier fundamentals: the ideal op-amp model and the characteristics of real op-amps', 'Explain the ideal op-amp model and the characteristics of real operational amplifiers.', 1, '- Lecture with worked examples\n- Simulation of basic op-amp behaviour', '- Problem set on op-amp characteristics', 'Interiority: students reflect on which assumption of the ideal model they misunderstood and how they clarified it.'],
      ['Op-amp circuits: inverting, non-inverting, summing and difference amplifiers', 'Design and test inverting and non-inverting amplifiers with a specified gain.', 2, '- Guided design example\n- Circuit simulation and breadboard practice', '- Practical: build and measure an amplifier and record the measured gain', 'Courage: students report a measured gain that misses the design value instead of adjusting the numbers.'],
      ['Signal conditioning and active filters', 'Design active low-pass and high-pass filters for conditioning sensor signals.', 2, '- Worked filter-design examples\n- Simulation exercise', '- Filter design problem with simulated frequency response', 'Community-orientedness: groups divide the filter designs and check the calculations of one another before simulation.'],
      null,
      ['Sampling and quantization: the sampling theorem, aliasing and resolution', 'Apply the sampling theorem to choose a sampling rate and resolution for a given signal.', 3, '- Lecture-demonstration of aliasing\n- Group computation exercise', '- Problem set on sampling rate and quantization error', 'Interiority: students write a short reflection on how careful measurement relates to integrity in engineering work.'],
      ['Analog-to-digital converter architectures: flash, successive approximation and sigma-delta', 'Compare ADC architectures and select one for a given application.', 3, '- Lecture with datasheet examples\n- Group datasheet analysis', '- Short report comparing converters for an application', 'Community-orientedness: groups share their datasheet findings so the whole class builds one comparison table.'],
      ['Digital-to-analog converters and their specifications', 'Explain the operation of digital-to-analog converters and interpret their key specifications.', 3, '- Lecture-demonstration\n- Simulation of an R-2R ladder converter', '- Quiz on converter operation and specifications', 'Humility: students check their simulation results against those of a classmate and resolve differences together.'],
      ['Sensors and transducers: temperature, light, pressure and motion sensors', 'Describe the operating principles of common sensors and select a sensor for a measurement task.', 1, '- Lecture with sensor samples\n- Group sensor selection exercise', '- Sensor selection worksheet', 'Missionary Spirit: groups choose a sensor for a measurement that would help a local community, such as monitoring flood levels.'],
      ['Interfacing sensors with a microcontroller', 'Interface an analog sensor with a microcontroller and read calibrated values.', 4, '- Demonstration with a microcontroller board\n- Hands-on interfacing exercise', '- Practical: read and display sensor values with a microcontroller', 'Courage: students admit wiring mistakes openly so that the team can fix them safely.'],
      null,
      ['Data acquisition systems: architecture and design', 'Design the architecture of a simple data acquisition system.', 4, '- Lecture with examples\n- Team design session', '- Data acquisition system block diagram and specification', 'Community-orientedness: team members agree on the interfaces between their blocks before building.'],
      ['Noise, grounding and shielding in mixed-signal circuits', 'Identify sources of noise in mixed-signal circuits and apply grounding and shielding techniques.', 2, '- Demonstration of noise effects\n- Group troubleshooting exercise', '- Troubleshooting report on a noisy circuit', 'Humility: students accept the corrections of the instructor and of peers when their troubleshooting goes the wrong way.'],
      ['Calibration and measurement accuracy', 'Calibrate a sensor measurement and estimate its accuracy.', 4, '- Calibration demonstration\n- Team calibration exercise', '- Calibration report with an error estimate', 'Courage: teams report their real calibration errors even when they exceed the target.'],
      ['Mixed-signal system design and integration', 'Integrate sensing, conditioning and conversion stages into one working system.', 4, '- Team integration work with consultations', '- Integration checkpoint demonstration', 'Compassion: teams make sure every member understands the integrated design, helping members who are behind.'],
      ['Design project: a sensor-based data acquisition system', 'Design, build and test a sensor-based data acquisition system and present its results.', 4, '- Project work and final demonstration', '- Project report, demonstration and peer evaluation', 'Missionary Spirit: teams present how their system could serve a community need.'],
      null,
    ],
    refs: {
      books: ['Tan, R. S. (2021). Operational amplifiers and signal conditioning. Example Press.', 'Villanueva, C. A., & Ong, P. L. (2022). Sensors and data acquisition systems (2nd ed.). Example University Press.'],
      program: ['Example Electronics Institute. (2023). Mixed-signal laboratory manual (Report No. 2). Example Electronics Institute.'],
      online: ['Example Embedded Network. (2024, January 22). Interfacing analog sensors with microcontrollers. https://www.example.org/embedded/analog-sensors'],
    },
  },
};
const EXAMS = ['PRELIM EXAMINATION', 'MIDTERM EXAMINATION', 'FINAL EXAMINATION'];

// A syllabus and its reference masters from a spec in the COURSES format (Phase 3 builds its Cyber Security fixture with it, eval/phase3/fixtures.js).
// Optional spec fields: `outcomes` names the program whose transcribed POs and EGAs apply (a specialization uses its parent's), `curriculumYear` must
// match the transcription, and `fixture` / `outcomeSource` describe the masters. The course is the row whose code is exactly spec.code, else the
// only row whose code matches without spaces and hyphens: an ambiguous code is an error, never a guess.
function buildSyllabus(key, spec) {
  const curriculum = programs.find(p => p.code === spec.program);
  if (!curriculum) throw new Error(`${spec.program} has no transcribed curriculum`);
  if (spec.curriculumYear && spec.curriculumYear !== curriculum.curriculumYear) throw new Error(`${spec.program} is transcribed for ${curriculum.curriculumYear}, not ${spec.curriculumYear}`);
  const rows = curriculum.terms.flatMap(t => t.rows.map(r => ({ ...r, yearLevel: t.yearLevel })));
  const exact = rows.filter(r => r.code === spec.code), loose = rows.filter(r => squash(r.code) === squash(spec.code));
  const record = loose.length === 1 ? (exact[0] || loose[0]) : null;
  if (!record) throw new Error(exact.length + loose.length ? `${spec.code} matches more than one course of the transcribed ${spec.program} curriculum` : `${spec.code} is not in the transcribed ${spec.program} curriculum`);
  const src = sources[spec.outcomes || spec.program];
  const content = F.good(), catalog = F.catalog();
  Object.assign(content.meta, { program: spec.program, code: record.code, title: record.title, lecture: String(record.lecture), lab: String(record.lab), prereq: record.prereq, yearLevel: String(record.yearLevel), curriculumYear: curriculum.curriculumYear });
  content.description = [{ id: 'd1', t: spec.description }];
  content.clos = spec.clos.map(([level, statement, pos, egas], k) => ({ id: `c${k + 1}`, title: `CLO ${k + 1}`, level, statement, pos, egas }));
  let exam = 0;
  content.plan = spec.weeks.map((w, i) => (w === null
    ? { id: `x${i + 1}`, kind: 'exam', week: String(i + 1), ilos: [{ id: `xi${i + 1}`, text: '', tags: [] }], contents: EXAMS[exam++], activities: '', tasks: '', values: '' }
    : { id: `r${i + 1}`, kind: 'lesson', week: String(i + 1), ilos: [{ id: `i${i + 1}`, text: w[1], tags: [`clo:c${w[2]}`] }], contents: w[0], activities: w[3], tasks: w[4], values: w[5] }));
  const group = list => ({ na: false, items: list.map((t, k) => ({ id: `${key}-ref-${k + 1}`, t })) });
  content.refs = { books: group(spec.refs.books), program: group(spec.refs.program), online: group(spec.refs.online), electronics: { na: true, items: [] } };
  content.outcomes = structuredClone({ ...catalog.institution, egas: src.egas, pos: src.pos });
  const masters = {
    synthetic: false, fixture: spec.fixture || 'representative-18-week (synthetic plan, real curriculum identity and outcomes)',
    institution: { ...catalog.institution, egas: src.egas }, pos: src.pos,
    curricula: [{ program: spec.program, curriculumYear: curriculum.curriculumYear, status: 'approved', courses: rows.map(r => ({ code: r.code, title: r.title, prereq: r.prereq, lecture: r.lecture, lab: r.lab, yearLevel: r.yearLevel })) }],
    otherCurricula: programs.filter(p => p.code !== spec.program).map(p => ({ program: p.code, curriculumYear: p.curriculumYear, courses: p.terms.flatMap(t => t.rows.map(r => ({ code: r.code, title: r.title }))) })),
    ...(spec.outcomeSource ? { outcomeSource: spec.outcomeSource } : {}),
  };
  return { key, label: spec.label, program: spec.program, record, content, masters };
}
const programSyllabus = key => buildSyllabus(key, COURSES[key]);
module.exports = { programSyllabus, buildSyllabus, PROGRAMS: Object.keys(COURSES) };
