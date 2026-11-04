#!/usr/bin/env node
'use strict';
// Builds docs/lcup-faculty-validation-1/, the faculty academic validation package: 21 relationships from the three verified LCUP syllabi
// (IT 202, IE-402, CpE 304), three for each of the seven academic relationships, prepared for blind faculty judgment.
//   node scripts/lcup-faculty-validation/build.cjs [--out <dir>]
// Offline. Reads the frozen benchmark lcup-academic-benchmark-1 and nothing else: docs/lcup-academic-benchmark/package/cases.json and its
// adjudication and model-result templates, each checked against the benchmark's package-manifest.json, and the cases against the benchmark
// content hash. Calls no provider, runs no checker, sends nothing anywhere and changes no source or evidence file.
// Writes only inside --out (the benchmark and evaluation folders are refused): into an empty folder, or over files this script wrote and
// nobody has changed since (checked against the package's package-manifest.json), so a filled-in form is never overwritten; otherwise it
// refuses and writes nothing. The two AUTHORED files are written by hand and only recorded in the manifest. The same inputs give
// byte-identical files.
// Blinding: for-reviewers/ carries no benchmark id, case hash, selection signal or model output. The selection signals are written to
// coordinator-only/selection-record.* alone, and the comparison templates hold no model result.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..');
const BENCH = path.join(ROOT, 'docs', 'lcup-academic-benchmark', 'package');
const option = name => { const i = process.argv.indexOf(name); return i > 1 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null; };
const OUT = option('--out') || path.join(ROOT, 'docs', 'lcup-faculty-validation-1');
const VERSION = 'lcup-faculty-validation-1', BUILT = '2026-10-29';
const AUTHORED = ['README.md', 'institutional-definitions-and-evidence-gaps.md'];
const within = (dir, p) => { const r = path.relative(dir, p); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
for (const frozen of ['docs/lcup-academic-benchmark', 'docs/lcup-v2-evaluation', 'docs/faculty-review', 'docs/lcup-approved-offline', 'docs/academic-references', 'reference-data'].map(p => path.join(ROOT, p)))
  if (within(frozen, OUT) || within(OUT, frozen)) { console.log(`REFUSED: --out must not be, lie inside or contain ${path.relative(ROOT, frozen)}`); process.exit(2); }
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const json = o => JSON.stringify(o, null, 2) + '\n';
const flat = s => String(s ?? '').replace(/\s+/g, ' ').trim();
// whitespace-normalised containment, the way gemini.js evidenceQuote finds a faculty quote in a case's source or target text
const contains = (text, part) => flat(text).includes(flat(part));

// ---- the frozen benchmark ----
const benchManifest = readJson(path.join(BENCH, 'package-manifest.json'));
const benchFile = name => {
  const entry = benchManifest.files.find(f => f.file === name), buf = fs.readFileSync(path.join(BENCH, name));
  if (!entry || entry.sha256 !== sha(buf)) throw new Error(`benchmark file ${name} does not match the benchmark's package-manifest.json`);
  return { name, sha256: entry.sha256, data: JSON.parse(buf.toString('utf8')) };
};
const CASES = benchFile('cases.json'), ADJ = benchFile('adjudication-template.json'), MODEL = benchFile('model-results.template.json');
const dataset = CASES.data;
const { hash, POLICY } = require('../../server/lib/syllabuscheck/academicV2Plan');
{ const { benchmarkHash, ...body } = dataset; if (hash(body) !== benchmarkHash || benchmarkHash !== benchManifest.benchmarkHash) throw new Error('benchmark content hash mismatch'); }

const REL = {
  'Content-course': 'Course Title ↔ Course Content',
  'Content-ILO': 'Course Content ↔ ILO',
  'ILO-CLO': 'ILO ↔ CLO',
  'Content-activity': 'Course Content ↔ Learning Activities',
  'ILO-activity': 'ILO ↔ Learning Activities',
  'Content-assessment': 'Course Content ↔ Assessment',
  'Activity-assessment': 'Learning Activities ↔ Assessment',
};
if (JSON.stringify(Object.keys(REL)) !== JSON.stringify(POLICY.weeklyTypes)) throw new Error('the seven relationships differ from the evaluation policy');
const LABELS = ['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED', 'INSUFFICIENT_EVIDENCE'];
const CLASSIFICATION = ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values']; // LCUP's fixed classification of CLO 1 to CLO 4
const COURSES = ['ctx-it202', 'ctx-ie402', 'ctx-cpe304'];
// The cases that already have a Claude output (the Policy V2 smoke, run with the baseline and with the r2 contract). They are left out, so
// no earlier output can reach the blind materials or shape the sample.
const EARLIER_OUTPUT = ['BM1-IT202-096', 'BM1-IE402-074', 'BM1-CPE304-051'];

// ---- the sample: [course context, relationship, benchmark pair, surface signal, observation] ----
// The signal is the coordinator's reason for including the case, read from the wording alone by Claude Code (an AI assistant) when the
// sample was drawn. It is not a judgment or an expected answer. It is never shown to reviewers and never sent to any model.
const SIGNALS = ['apparent alignment', 'apparent partial alignment', 'apparent misalignment', 'limited evidence'];
const SELECTION = [
  ['ctx-it202', 'Content-activity', 'row0-contentactivity', 'apparent alignment', 'Every item of the orientation content (course contents, requirements and activities, objectives, grading system and policies) is named in an activity.'],
  ['ctx-it202', 'Content-ILO', 'row3-ilo1-contentilo', 'apparent misalignment', 'The ILO names Java methods. The week\'s content lists the parts of a Java program, print and println, and data types; "XII. JAVA METHOD" is the Week 15 content.'],
  ['ctx-it202', 'Activity-assessment', 'row3-activityassessment', 'apparent misalignment', 'The assessment names a simulation of the external and internal parts of the System Unit, which no activity names; the seatwork, laboratory and machine problem of the activities are not named in the assessment.'],
  ['ctx-it202', 'ILO-CLO', 'row6-ilo0-clo:it202_clo3', 'apparent partial alignment', 'Both name Java programs, and the ILO\'s "real-world problems" is close to the CLO\'s "social challenges"; the CLO\'s collaboration in multi-disciplinary, culturally diverse teams is not in the ILO.'],
  ['ctx-it202', 'Content-assessment', 'row10-contentassessment', 'apparent misalignment', 'The machine problem names "C programs" while the week\'s content and the course are Java; the recitation and quiz name no topic.'],
  ['ctx-it202', 'Content-course', 'row11-content', 'apparent partial alignment', 'The content names Java, the course language; its topic, a database connection through UCanAccess, is not among the topics the course description names.'],
  ['ctx-it202', 'ILO-activity', 'row11-ilo1-activity', 'apparent misalignment', 'The ILO names Augustinian spirituality through value webbing; no activity names either.'],
  ['ctx-ie402', 'Content-course', 'row0-content', 'limited evidence', 'The orientation content (course contents, requirements, objectives, grading and policies) names no systems engineering topic.'],
  ['ctx-ie402', 'Content-assessment', 'row1-contentassessment', 'apparent alignment', 'The quiz and the case study report name the content\'s topics: systems engineering management and DoD acquisition.'],
  ['ctx-ie402', 'Content-course', 'row3-content', 'apparent alignment', 'The content names "The Systems Engineering Process" and steps that the course description lists, such as requirements analysis.'],
  ['ctx-ie402', 'Content-activity', 'row3-contentactivity', 'apparent partial alignment', 'Two of the six listed topics (functional analysis and allocation; process outputs) are named in the activities; the overview, requirements analysis, design synthesis and verification are not. The workshop description is printed twice.'],
  ['ctx-ie402', 'ILO-CLO', 'row5-ilo0-clo:ie402_clo4', 'apparent misalignment', 'The ILO names creating and interpreting a WBS; the CLO names Augustinian spirituality through value webbing; no element is shared. The same ILO is also mapped to CLO 3.'],
  ['ctx-ie402', 'Activity-assessment', 'row5-activityassessment', 'apparent partial alignment', 'Both name risk assessment and mitigation. The WBS and configuration management activities are not assessed, and the experimental design and robust design of the tasks are not among this week\'s activities (they are Week 15-17 topics).'],
  ['ctx-ie402', 'Content-ILO', 'row6-ilo1-contentilo', 'apparent partial alignment', 'Both name management considerations; the ILO\'s resource allocation, risk assessment and stakeholder engagement are not named in the content.'],
  ['ctx-ie402', 'Activity-assessment', 'row6-activityassessment', 'apparent alignment', 'The planning workshop and the plan development task name the same plan elements (objectives, resource allocation, timeline, milestones); the brainstorming session and the proposal task both name a product improvement strategy.'],
  ['ctx-ie402', 'ILO-activity', 'row7-ilo1-activity', 'apparent alignment', 'The "Design and Conduct Experiments" activity names designing and conducting an experiment, collecting data and analysing results, as the ILO does.'],
  ['ctx-cpe304', 'ILO-CLO', 'row1-ilo1-clo:cpe304_clo1', 'apparent alignment', 'The ILO repeats the CLO\'s phrase "design process of electronic circuits and systems"; the CLO\'s experiments and data analysis are not in the ILO.'],
  ['ctx-cpe304', 'ILO-activity', 'row1-ilo0-activity', 'apparent partial alignment', 'The ILO names developing analysis and design skills; the only activity is a lecture-discussion, and no practice activity is named.'],
  ['ctx-cpe304', 'Content-activity', 'row2-contentactivity', 'limited evidence', 'The only activity, "Lecture- Discussion using PowerPoint", names a teaching method and no topic, against the operational-amplifier topics the content lists.'],
  ['ctx-cpe304', 'Content-assessment', 'row5-contentassessment', 'limited evidence', 'The only assessment, "Quiz on the topics discussed", names no topic.'],
  ['ctx-cpe304', 'Content-ILO', 'row7-ilo0-contentilo', 'apparent alignment', 'Both name sensors and transducers.'],
];
// Authentic candidates kept in reserve for the two coverage gaps of the sample (selection-record.md), with the same kind of signal.
const RESERVES = [
  ['ctx-ie402', 'Content-assessment', 'row5-contentassessment', 'apparent partial alignment', 'Both name risk; the tasks name experimental design and robust design, which the Weeks 10-11 content does not list. It would add an apparent partial alignment to Course Content ↔ Assessment.'],
  ['ctx-ie402', 'ILO-CLO', 'row3-ilo1-clo:ie402_clo2', 'apparent alignment', 'Both name analysing systems, and the ILO\'s stakeholder needs are close to the CLO\'s "people". It would add CLO 2 (Enabling), which the sample does not cover.'],
];

// ---- reading the syllabus records ----
const byPair = new Map(dataset.cases.map(c => [`${c.contextId}|${c.relationshipType}|${c.pairId}`, c]));
const eligible = c => c.kind === 'academic-semantic' && c.requiredWeekly && !c.optionalDiagnostic && !c.holds.length && !c.reviewOnlyUntilBasisResolved && !c.missingEvidence && c.claudeEligibility === 'candidate_pending_authorization';
const rowOf = c => Number(c.pairId.match(/^row(\d+)-/)[1]);
const iloOf = c => { const m = c.pairId.match(/-ilo(\d+)-/); return m ? Number(m[1]) : null; };
const weekOf = row => `Week ${row.week}`;
const headingOf = text => flat(text).split(/\s*[•●▪➢]\s*|\s+[A-H]\.\s+/)[0];
const cloNo = (content, tag) => content.clos.findIndex(x => `clo:${x.id}` === tag) + 1;
const mapped = (content, ilo) => (ilo?.tags || []).filter(t => t.startsWith('clo:')).map(t => cloNo(content, t));
const printedTag = text => { const m = flat(text).match(/(?:^|[\s.:\]])((?:[[(]\s*)?CLO\s*\d[^]*)$/); return m ? m[1] : null; };
// a statement as separate lines, one per bullet of the printed cell (presentation only; the stored text is unchanged)
const lines = text => flat(text).split(/\s+(?=[•●▪➢]\s?)/);
const courseKey = ctx => ctx.content.meta.code;

function statementsOf(type, ctx, row, ilo, clo) {
  const m = ctx.content.meta, w = weekOf(row);
  const content = { role: `Course content, ${w}`, text: flat(row.contents) };
  const outcome = { role: `Intended learning outcome (ILO), ${w}`, text: flat(ilo?.text) };
  const activities = { role: `Learning activities, ${w}`, text: flat(row.activities) };
  const assessment = { role: `Assessment, ${w}`, text: flat(row.tasks) };
  switch (type) {
    case 'Content-course': return [[{ role: 'Course title', text: `${m.code} - ${m.title}` }, 'source'], [content, 'target']];
    case 'Content-ILO': return [[content, 'source'], [outcome, 'target']];
    case 'ILO-CLO': return [[outcome, 'target'], [{ role: `Course learning outcome, CLO ${clo} (${CLASSIFICATION[clo - 1]})`, text: flat(ctx.content.clos[clo - 1].statement) }, 'source']];
    case 'Content-activity': return [[content, 'source'], [activities, 'target']];
    case 'ILO-activity': return [[outcome, 'source'], [activities, 'target']];
    case 'Content-assessment': return [[content, 'source'], [assessment, 'target']];
    case 'Activity-assessment': return [[activities, 'source'], [assessment, 'target']];
    default: throw new Error(`unknown relationship ${type}`);
  }
}

function caseOf([contextId, type, pairId, signal, observation]) {
  const c = byPair.get(`${contextId}|${type}|${pairId}`);
  if (!c) throw new Error(`no benchmark case for ${contextId} ${type} ${pairId}`);
  if (!eligible(c)) throw new Error(`${c.id} is held, missing evidence or not eligible`);
  if (EARLIER_OUTPUT.includes(c.id)) throw new Error(`${c.id} already has a model output`);
  if (!SIGNALS.includes(signal)) throw new Error(`unknown signal ${signal}`);
  const ctx = dataset.contexts[contextId], content = ctx.content, row = content.plan[rowOf(c)], j = iloOf(c), ilo = j === null ? null : row.ilos[j];
  if (row.kind === 'exam' || (j !== null && !ilo)) throw new Error(`${c.id}: not a lesson ILO`);
  const clo = type === 'ILO-CLO' ? cloNo(content, pairId.slice(pairId.indexOf('clo:'))) : null;
  if (type === 'ILO-CLO' && (!(clo >= 1 && clo <= 4) || !mapped(content, ilo).includes(clo) || !printedTag(ilo.text))) throw new Error(`${c.id}: the ILO-CLO mapping cannot be read`);
  const statements = statementsOf(type, ctx, row, ilo, clo).map(([s, side]) => {
    if (!s.text || !contains(c[`${side}Text`], s.text)) throw new Error(`${c.id}: the ${s.role} is not the benchmark's ${side} text`);
    return { ...s, benchmarkSide: side };
  });
  return {
    signal, observation, contextId, rowIndex: rowOf(c), iloIndex: j, typeIndex: POLICY.weeklyTypes.indexOf(type),
    record: {
      caseId: null,
      relationship: { key: type, name: REL[type] },
      program: content.meta.program,
      course: { code: content.meta.code, title: content.meta.title },
      week: weekOf(row),
      lesson: headingOf(row.contents),
      statements,
      iloCloMapping: type === 'ILO-CLO' ? {
        ilo: flat(ilo.text),
        mappingAsPrinted: printedTag(ilo.text),
        facultyAssignedClos: mapped(content, ilo),
        cloInThisRelationship: clo,
        cloStatement: flat(content.clos[clo - 1].statement),
        requiredClassification: CLASSIFICATION[clo - 1],
        otherMappingsOfThisIlo: mapped(content, ilo).filter(n => n !== clo).map(n => ({ clo: n, requiredClassification: CLASSIFICATION[n - 1], note: 'A separate relationship; not part of this case.' })),
        weeklyCourseContent: flat(row.contents),
      } : null,
      weekRow: {
        week: weekOf(row),
        content: flat(row.contents),
        ilos: (row.ilos || []).map((x, k) => ({ text: flat(x.text), facultyAssignedClos: mapped(content, x), inThisCase: k === j })),
        activities: flat(row.activities),
        assessment: flat(row.tasks),
      },
      benchmark: { id: c.id, caseHash: c.caseHash, relationshipType: c.relationshipType, pairId: c.pairId, path: c.path, sourceText: c.sourceText, targetText: c.targetText },
      provenance: c.sourceRefs,
    },
  };
}

const drawn = SELECTION.map(caseOf).sort((a, b) => COURSES.indexOf(a.contextId) - COURSES.indexOf(b.contextId) || a.rowIndex - b.rowIndex || a.typeIndex - b.typeIndex || (a.iloIndex ?? -1) - (b.iloIndex ?? -1));
drawn.forEach((d, i) => { d.record.caseId = `FV-${String(i + 1).padStart(2, '0')}`; });
const cases = drawn.map(d => d.record);
if (new Set(cases.map(c => c.benchmark.id)).size !== 21) throw new Error('the sample must hold 21 distinct relationships');
for (const t of POLICY.weeklyTypes) if (cases.filter(c => c.relationship.key === t).length !== 3) throw new Error(`${t}: the sample must hold three cases`);
const reserves = RESERVES.map(caseOf).map(d => ({ benchmarkId: d.record.benchmark.id, course: d.record.course.code, week: d.record.week, relationship: d.record.relationship.name, signal: d.signal, observation: d.observation }));
if (reserves.some(r => cases.some(c => c.benchmark.id === r.benchmarkId))) throw new Error('a reserve is already in the sample');

function courseOf(contextId) {
  const ctx = dataset.contexts[contextId], m = ctx.content.meta;
  return {
    program: m.program, code: m.code, title: m.title,
    units: { lecture: m.lecture, laboratory: m.lab }, prerequisite: m.prereq,
    description: flat((ctx.content.description || []).map(p => p.t).join(' ')),
    clos: ctx.content.clos.map((x, i) => ({ clo: i + 1, statement: flat(x.statement), requiredClassification: CLASSIFICATION[i] ?? null })),
    lessonOutline: ctx.content.plan.map(r => (r.kind === 'exam' ? { week: weekOf(r), kind: 'examination' } : { week: weekOf(r), kind: 'lesson', heading: headingOf(r.contents) })),
  };
}
const courses = Object.fromEntries(COURSES.map(id => [courseKey(dataset.contexts[id]), courseOf(id)]));

// ---- relationships that cannot be evaluated, kept apart from the sample ----
const genuine = dataset.cases.filter(c => COURSES.includes(c.contextId) && POLICY.weeklyTypes.includes(c.relationshipType));
const sampleIds = new Map(cases.map(c => [c.benchmark.id, c.caseId]));
const iloCloRelationships = [];
for (const id of COURSES) {
  const ctx = dataset.contexts[id], content = ctx.content;
  content.plan.forEach((row, i) => {
    if (row.kind === 'exam') return;
    (row.ilos?.length ? row.ilos : [null]).forEach((ilo, j) => {
      const clos = mapped(content, ilo);
      for (const n of clos.length ? clos : [null]) {
        const pairId = n ? `row${i}-ilo${j}-clo:${content.clos[n - 1].id}` : `row${i}-ilo${j}-unassigned-clo`, c = byPair.get(`${id}|ILO-CLO|${pairId}`);
        if (!c) throw new Error(`no ILO-CLO case for ${id} ${pairId}`);
        iloCloRelationships.push({
          course: content.meta.code, week: weekOf(row), ilo: ilo ? flat(ilo.text) : null,
          clo: n, requiredClassification: n ? CLASSIFICATION[n - 1] : null,
          status: !ilo ? 'not evaluable: the lesson has no ILO' : !n ? 'not evaluable: the ILO is mapped to no CLO' : 'evaluable',
          benchmarkId: c.id, inSample: sampleIds.get(c.id) || null,
        });
      }
    });
  });
}
const evaluable = iloCloRelationships.filter(r => r.status === 'evaluable').length;
if (evaluable !== 65 || iloCloRelationships.length !== 81) throw new Error(`expected 65 + 16 ILO-CLO relationships, found ${evaluable} of ${iloCloRelationships.length}`);
const missing = genuine.filter(c => c.missingEvidence), held = genuine.filter(c => c.holds.length);
const placeOf = c => { const ctx = dataset.contexts[c.contextId], row = ctx.content.plan[rowOf(c)]; return { course: ctx.content.meta.code, week: weekOf(row), lesson: headingOf(row.contents), row }; };
const notEvaluable = {
  note: 'These relationships are not among the 21 cases and are not on the evaluation form. They cannot be judged as they stand: an ILO with no CLO mapping has no ILO-CLO relationship to judge, a lesson with no ILO has no ILO relationships, and a reference-held case waits for an institutional confirmation.',
  ilosWithoutClo: iloCloRelationships.filter(r => r.status === 'not evaluable: the ILO is mapped to no CLO').map(r => ({ course: r.course, week: r.week, ilo: r.ilo, relationship: REL['ILO-CLO'], benchmarkId: r.benchmarkId })),
  lessonsWithoutIlo: COURSES.flatMap(id => dataset.contexts[id].content.plan.map((row, i) => ({ row, i, id })).filter(x => x.row.kind !== 'exam' && !x.row.ilos?.length)).map(({ row, i, id }) => ({
    course: dataset.contexts[id].content.meta.code, week: weekOf(row), lesson: headingOf(row.contents),
    relationshipsNotEvaluable: missing.filter(c => c.contextId === id && rowOf(c) === i).map(c => ({ relationship: REL[c.relationshipType], benchmarkId: c.id })),
  })),
  closWithoutIlo: COURSES.flatMap(id => { const content = dataset.contexts[id].content, built = new Set(content.plan.filter(r => r.kind !== 'exam').flatMap(r => (r.ilos || []).flatMap(x => mapped(content, x)))); return content.clos.map((x, i) => ({ course: content.meta.code, clo: i + 1, requiredClassification: CLASSIFICATION[i], statement: flat(x.statement) })).filter(x => !built.has(x.clo)); }),
  referenceHeld: held.map(c => ({ ...(({ course, week, lesson }) => ({ course, week, lesson }))(placeOf(c)), relationship: REL[c.relationshipType], benchmarkId: c.id, holds: c.holds })),
};
const accounted = notEvaluable.ilosWithoutClo.length + notEvaluable.lessonsWithoutIlo.reduce((s, x) => s + x.relationshipsNotEvaluable.length, 0) + notEvaluable.referenceHeld.length;
if (missing.length + held.length !== 26 || accounted !== 26) throw new Error(`expected 26 relationships that cannot be evaluated, accounted for ${accounted}`);
notEvaluable.counts = { ilosWithoutClo: notEvaluable.ilosWithoutClo.length, relationshipsOfLessonsWithoutIlo: accounted - notEvaluable.ilosWithoutClo.length - notEvaluable.referenceHeld.length, referenceHeld: notEvaluable.referenceHeld.length, total: accounted, closWithoutIlo: notEvaluable.closWithoutIlo.length };

// ---- the provisional rubric: one source for the Markdown file, the booklet and the form ----
const INSTITUTION = 'Answer "yes" to "Requires an institutional decision?" if your judgment depends on it.';
const GENERIC = 'LCUP does not say whether an activity or assessment worded only in general terms (for example, a teaching method, or a quiz "on the topics discussed") is enough evidence. It can be read as saying too little to judge, or read together with the week\'s content. Choose the reading you can defend, say which one you used, and answer "yes" to "Requires an institutional decision?".';
const RUBRIC = {
  status: 'Provisional draft, prepared on 2026-10-29 for the capstone research team and the faculty reviewers. It is not an LCUP policy, and it supplies no official LCUP definition. The faculty panel should review it, and the office the institution designates should approve or amend it, before it is treated as an institutional standard. It builds on the project\'s existing reviewer guide and on the seven academic relationships of the evaluation policy (academic-evaluation-v2-preview-1), and changes neither.',
  labels: [
    ['ALIGNED', 'The supplied evidence supports this particular academic relationship.'],
    ['PARTIALLY_ALIGNED', 'There is meaningful support, but a material gap or ambiguity remains.'],
    ['NOT_ALIGNED', 'There is a substantiated mismatch in this particular relationship.'],
    ['INSUFFICIENT_EVIDENCE', 'The supplied information cannot support a defensible judgment.'],
  ],
  steps: [
    'Read the two statements in full, then the context: the whole week as printed, the course description and the CLOs.',
    'Note what each statement is about (its subject matter) and, where it says so, what students are to do.',
    'Ask the question of the relationship (Part 4) about this pair only.',
    'Choose ALIGNED if the evidence supports the relationship and you see no material gap; PARTIALLY_ALIGNED if there is meaningful support but you can name a material gap or ambiguity; NOT_ALIGNED if you can point to the mismatch in the text; INSUFFICIENT_EVIDENCE if the statements, as written, cannot support a defensible judgment either way.',
    'A gap is material if, in your professional judgment, it would change what is taught, practised or assessed. Say which gap you mean.',
    'Write your justification and, if needed, a recommended correction (Part 5).',
  ],
  compliance: {
    intro: 'This review concerns academic alignment: whether the meaning of two statements fits together. It does not concern structural compliance: whether the syllabus has the required parts in the required form. Structural compliance is checked separately, by rule-based checks that this review does not change.',
    rows: [
      ['Whether a field is present: an ILO carries a CLO tag, a lesson week has an ILO, a lesson names a core value', 'Whether the content of the two statements fits together'],
      ['Format and numbering: codes, labels, week numbers, tags written in different styles', 'Whether what one statement requires is supported by the other'],
      ['Counts and totals: number of CLOs, references, grading weights', 'Whether the scope and level of the two statements are consistent'],
      ['Approval and sign-off of the document', ''],
    ],
    note: 'A structural problem does not by itself make a relationship misaligned, and a well-formed statement can still be misaligned. If you notice a structural problem, record it under Notes and base your judgment on meaning.',
  },
  relationships: [
    { key: 'Content-course', question: 'Does this week\'s course content fall within the subject that the course title names, read together with the course description?',
      consider: ['the subject the title names, and the scope and level the course description gives it', 'every topic the week lists, not only its first line', 'the lesson outline, which shows where the week sits in the course'],
      indicators: ['The week\'s topics belong to the subject, scope and level that the title and description indicate.', 'Some topics belong; others fall outside that scope or level, or the connection is indirect.', 'The week\'s topics belong to a different subject.', 'The content, as written, cannot be compared with the title.'],
      institutional: [`How an orientation week (course requirements, objectives, grading and policies) should be judged against the course title is not defined by LCUP. Choose the judgment you can defend and explain your reading. ${INSTITUTION}`] },
    { key: 'Content-ILO', question: 'Does this week\'s course content provide the subject matter that the ILO expects students to learn or demonstrate?',
      consider: ['what the ILO names, against the topics the week lists', 'the ILO\'s scope: if it names topics taught in other weeks, whether this week still supplies a meaningful part of it', 'whether the content lets students do what the ILO\'s verb asks (for example, apply, design or analyse what is listed)'],
      indicators: ['The content covers what the ILO names.', 'The content covers part of what the ILO names, or the ILO reaches beyond this content in a way that matters.', 'The ILO names subject matter that this content does not include.', 'The content or the ILO is too general or too incomplete to compare.'],
      institutional: [`Some ILOs concern values formation (for example, "Demonstrate the Filipino-Catholic Augustinian Spirituality through value webbing") and appear in lessons on technical topics. How LCUP expects such an ILO to relate to the week's technical content is not defined. Explain your reading. ${INSTITUTION}`] },
    { key: 'ILO-CLO', question: 'Does achieving this ILO contribute to the CLO it is mapped to?',
      consider: ['whether the ILO develops part of what the CLO states (its competency and subject). An ILO need not cover the whole CLO; several ILOs usually build one CLO', 'the CLO\'s required LCUP classification, which follows from its number: CLO 1 Introductory, CLO 2 Enabling, CLO 3 Demonstrating, CLO 4 Integration of Values. Consider whether the ILO\'s purpose and level suit that classification as you understand it. The classification belongs to the CLO, not to the week', 'each mapping on its own: an ILO mapped to two CLOs forms two relationships, and each is judged separately', 'the week\'s content, which shows what the ILO concerns in that lesson'],
      indicators: ['The ILO develops a recognisable part of the CLO, in a way consistent with the CLO\'s classification as you understand it.', 'The ILO develops part of the CLO, but an element that matters (for example the CLO\'s distinctive competency, or the fit with its classification) is missing or doubtful.', 'The ILO develops nothing that the CLO states.', 'The statements are too general or too incomplete to decide.'],
      institutional: [`The official definitions of the four classifications are not available to this project, and this rubric does not supply them. Do not assume one. If your judgment depends on what a classification means, write the meaning you applied in your justification. ${INSTITUTION}`, 'Whether technical ILOs may also be mapped to the values CLO (CLO 4, Integration of Values) is not defined.', 'ILOs that are mapped to no CLO are listed separately by the research team and are not part of this review.'] },
    { key: 'Content-activity', question: 'Do this week\'s learning activities engage students with the week\'s course content?',
      consider: ['whether the activities name, or clearly address, the topics the week lists', 'coverage: whether the activities reach the main topics or only some of them'],
      indicators: ['The activities address the content\'s topics.', 'The activities address some of the topics, or address them only indirectly.', 'The activities address a different subject.', 'The activities, as written, cannot be compared with the content.'],
      institutional: [GENERIC] },
    { key: 'ILO-activity', question: 'Do the learning activities give students the opportunity to do what the ILO states?',
      consider: ['the ILO\'s verb (what students must be able to do, for example explain, apply or design) and its object', 'whether at least one activity lets students practise that verb on that object', 'whether the kind of activity suits the kind of outcome, for example whether students practise a skill the ILO names'],
      indicators: ['At least one activity lets students do what the ILO states.', 'The activities address the ILO\'s subject but not what students must do, or only part of it.', 'No activity addresses the ILO\'s subject or what it asks students to do.', 'The statements are too general to compare.'],
      institutional: ['What activity evidence LCUP expects for a values-formation ILO (value webbing) is not defined.', GENERIC] },
    { key: 'Content-assessment', question: 'Does the assessment measure students\' learning of this week\'s course content?',
      consider: ['whether the assessment tasks name, or clearly target, the topics the week lists', 'coverage: whether the tasks assess the main topics or only some of them'],
      indicators: ['The assessment targets the content\'s topics.', 'The assessment targets some of the topics, or targets them only in part.', 'The assessment targets a different subject.', 'The assessment, as written, cannot be compared with the content.'],
      institutional: [GENERIC] },
    { key: 'Activity-assessment', question: 'Does the assessment measure what the learning activities prepare students to do?',
      consider: ['the correspondence between what students practise in the activities and what the tasks ask of them', 'whether the tasks ask for something that no activity prepares students for'],
      indicators: ['The tasks assess what the activities prepare students to do.', 'The tasks assess part of it, or also ask for something the activities do not prepare.', 'The tasks ask for something the activities do not prepare students for.', 'The activities or the tasks, as written, cannot be compared.'],
      institutional: [GENERIC, 'Whether every activity must be assessed in the same week is not defined: an assessment may come in a later week, or the activity may be formative.'] },
  ],
  writing: [
    ['Faculty judgment', 'One of the four codes, exactly as listed.'],
    ['Academic justification', 'Quote the words you relied on from both statements, in quotation marks and exactly as printed. Then explain, in one to three sentences, why they support your judgment. For ILO ↔ CLO, say how you read the CLO\'s classification if it mattered.'],
    ['Recommended correction, if necessary', 'Needed when your judgment is PARTIALLY_ALIGNED or NOT_ALIGNED; optional for INSUFFICIENT_EVIDENCE. Name the field to change (course content, ILO, CLO mapping, learning activity or assessment) and propose wording. The fix may belong to a field other than the two compared; say so. Do not propose changes to the institution\'s Vision, Mission, EGAs or Program Outcomes, and keep to what alignment needs: the institution has not yet set limits on recommended corrections. Write "None" if no correction is needed.'],
    ['Reviewer ID', 'The code the research team gave you, not your name.'],
    ['Within your expertise? (optional)', 'Answer "no" or "uncertain" if the subject is outside your field. Your judgment is still recorded.'],
    ['Requires an institutional decision? (optional)', 'Answer "yes" if your judgment depends on a definition or policy that LCUP has not provided (Part 6).'],
    ['Notes (optional)', 'Anything else, including structural problems you noticed or text you think was transcribed wrongly.'],
  ],
  institutionalPoints: [
    ['The meaning of the CLO classifications Introductory, Enabling, Demonstrating and Integration of Values', 'ILO ↔ CLO judgments may depend on it', 'Not available to the project; for Quality Assurance to provide [I7]'],
    ['Values-formation ILOs and the values CLO (CLO 4)', 'How value-webbing ILOs relate to technical lessons, and whether technical ILOs may be mapped to CLO 4', 'Not defined [F2, F5]'],
    ['Orientation weeks', 'Week 1 relationships, for example Course Title ↔ Course Content', 'Not defined'],
    ['Activities and assessments worded only in general terms', 'Relationships with learning activities or assessment', 'Not defined'],
    ['Whether "insufficient evidence" is an acceptable reference answer, and when a case may carry more than one accepted answer', 'Adjudication of your judgments', 'Open [I8, I9]'],
    ['Limits on recommended corrections', 'The Recommended correction column', 'Open [I11]'],
    ['Reading CLO tag ranges such as "CLO 1-2" as CLO 1 and CLO 2', 'Which ILO ↔ CLO relationships exist', 'Unconfirmed [F10]; this package reads a range as naming both CLOs'],
    ['Approval of this rubric', 'All judgments', 'Provisional; not yet reviewed or approved'],
  ],
  institutionalNote: 'The bracketed references (I7, F10 and so on) identify the open question in the research team\'s records. Reviewers need not look them up.',
  doNot: [
    'Do not use any AI tool, chatbot or syllabus checker while reviewing, and do not paste the case text into any online service.',
    'Do not discuss the cases with other reviewers or with the syllabus authors until you have returned your form.',
    'Do not edit the evidence. If you think a statement was transcribed wrongly, say so under Notes.',
    'Do not assume that a relationship is aligned because the syllabus was approved, or misaligned because it was chosen for review.',
    'Judge each relationship on its own. A week or an ILO that appears in two cases may receive different judgments.',
  ],
};
const PART_TITLES = ['What you are judging', 'The four judgments', 'Academic alignment and structural compliance', 'The seven relationships', 'Recording your judgment', 'Points that need an institutional definition or approval', 'What not to do'];
const PURPOSE = 'LCUP is evaluating an AI-assisted syllabus checker. Before any comparison, the checker needs a faculty reference: independent judgments by qualified faculty. You are asked to judge 21 academic relationships drawn from three actual LCUP syllabi. You will not see, and should not look for, any output of the checker or of any other AI tool.';
const JUDGING = 'One academic relationship at a time, between two statements of one syllabus, using only the evidence shown with the case. You are not judging the whole syllabus, its format, its approval or its author. The syllabi were approved for use; that approval does not establish that every relationship in them is aligned.';
const CONFIDENTIAL = 'These materials reproduce parts of approved LCUP syllabi for this review only. Keep them on a university computer. Do not upload them to any cloud service or AI tool, and return or delete them when the review ends.';
const TRANSCRIPTION = 'Statements are reproduced from the approved syllabi as transcribed for the project. Line breaks of the printed table were joined, and bullets are shown one per line; spelling, numbering and CLO tags are unchanged, including evident typing errors.';

function rubricMd() {
  const out = [`# Academic evaluation rubric (provisional)`, '', `Package ${VERSION}, built ${BUILT}. For faculty reviewers and the research team.`, '', `> ${RUBRIC.status}`, ''];
  out.push(`## Part 1. ${PART_TITLES[0]}`, '', JUDGING, '');
  out.push(`## Part 2. ${PART_TITLES[1]}`, '', 'Definitions as worded in the project\'s reviewer guide.', '', '| Judgment | Meaning |', '|---|---|', ...RUBRIC.labels.map(([l, d]) => `| \`${l}\` | ${d} |`), '', 'How to choose:', '', ...RUBRIC.steps.map((s, i) => `${i + 1}. ${s}`), '');
  out.push(`## Part 3. ${PART_TITLES[2]}`, '', RUBRIC.compliance.intro, '', '| Structural compliance: not judged in this review | Academic alignment: judged in this review |', '|---|---|', ...RUBRIC.compliance.rows.map(([a, b]) => `| ${a} | ${b} |`), '', RUBRIC.compliance.note, '');
  out.push(`## Part 4. ${PART_TITLES[3]}`, '');
  RUBRIC.relationships.forEach((r, i) => {
    out.push(`### 4.${i + 1} ${REL[r.key]}`, '', `**Question.** ${r.question}`, '', '**Consider**', '', ...r.consider.map(c => `- ${c}.`), '', '| Judgment | When |', '|---|---|', ...LABELS.map((l, k) => `| \`${l}\` | ${r.indicators[k]} |`), '', '**Needs an institutional definition**', '', ...r.institutional.map(x => `- ${x}`), '');
  });
  out.push(`## Part 5. ${PART_TITLES[4]}`, '', '| Column | What to write |', '|---|---|', ...RUBRIC.writing.map(([c, w]) => `| ${c} | ${w} |`), '');
  out.push(`## Part 6. ${PART_TITLES[5]}`, '', '| Point | Why it matters here | Status |', '|---|---|---|', ...RUBRIC.institutionalPoints.map(p => `| ${p.join(' | ')} |`), '', RUBRIC.institutionalNote, '');
  out.push(`## Part 7. ${PART_TITLES[6]}`, '', ...RUBRIC.doNot.map(x => `- ${x}`), '');
  return out.join('\n');
}

// ---- the case booklet (HTML, offline, no script) ----
// U+F0B7 is the bullet of the Symbol font, carried over from Word into one CLO statement; shown as the bullet it prints as
const escHtml = s => String(s ?? '').replace(//g, '•').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const block = text => lines(text).map(l => `<span class="ln">${escHtml(l)}</span>`).join('');
const cloList = ns => (ns.length ? ns.map(n => `CLO ${n}`).join(', ') : 'none');
function rubricHtml() {
  const rel = RUBRIC.relationships.map((r, i) => `<section class="rel"><h4>4.${i + 1} ${escHtml(REL[r.key])}</h4><p><strong>Question.</strong> ${escHtml(r.question)}</p><p class="sub">Consider</p><ul>${r.consider.map(c => `<li>${escHtml(c)}.</li>`).join('')}</ul><table class="ind"><tbody>${LABELS.map((l, k) => `<tr><th><code>${l}</code></th><td>${escHtml(r.indicators[k])}</td></tr>`).join('')}</tbody></table><p class="sub">Needs an institutional definition</p><ul>${r.institutional.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul></section>`).join('');
  return `<section id="rubric" class="page"><h2>The rubric (provisional)</h2><p class="note">${escHtml(RUBRIC.status)}</p>`
    + `<h3>Part 1. ${PART_TITLES[0]}</h3><p>${escHtml(JUDGING)}</p>`
    + `<h3>Part 2. ${PART_TITLES[1]}</h3><table class="ind"><tbody>${RUBRIC.labels.map(([l, d]) => `<tr><th><code>${l}</code></th><td>${escHtml(d)}</td></tr>`).join('')}</tbody></table><p class="sub">How to choose</p><ol>${RUBRIC.steps.map(s => `<li>${escHtml(s)}</li>`).join('')}</ol>`
    + `<h3>Part 3. ${PART_TITLES[2]}</h3><p>${escHtml(RUBRIC.compliance.intro)}</p><table><thead><tr><th>Structural compliance: not judged here</th><th>Academic alignment: judged here</th></tr></thead><tbody>${RUBRIC.compliance.rows.map(([a, b]) => `<tr><td>${escHtml(a)}</td><td>${escHtml(b)}</td></tr>`).join('')}</tbody></table><p>${escHtml(RUBRIC.compliance.note)}</p>`
    + `<h3>Part 4. ${PART_TITLES[3]}</h3>${rel}`
    + `<h3>Part 5. ${PART_TITLES[4]}</h3><table><tbody>${RUBRIC.writing.map(([c, w]) => `<tr><th>${escHtml(c)}</th><td>${escHtml(w)}</td></tr>`).join('')}</tbody></table>`
    + `<h3>Part 6. ${PART_TITLES[5]}</h3><table><thead><tr><th>Point</th><th>Why it matters here</th><th>Status</th></tr></thead><tbody>${RUBRIC.institutionalPoints.map(p => `<tr>${p.map(x => `<td>${escHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="note">${escHtml(RUBRIC.institutionalNote)}</p>`
    + `<h3>Part 7. ${PART_TITLES[6]}</h3><ul>${RUBRIC.doNot.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul></section>`;
}
function caseHtml(c) {
  const [a, b] = c.statements, m = c.iloCloMapping;
  const mapping = m ? `<div class="mapping"><p class="sub">ILO ↔ CLO details</p><table><tbody><tr><th>Faculty-assigned CLO mapping</th><td>CLO ${m.cloInThisRelationship} (as printed in the ILO: “${escHtml(m.mappingAsPrinted)}”)</td></tr><tr><th>Required LCUP classification of CLO ${m.cloInThisRelationship}</th><td>${escHtml(m.requiredClassification)}</td></tr><tr><th>Other CLO mappings of this ILO</th><td>${m.otherMappingsOfThisIlo.length ? `${escHtml(cloList(m.otherMappingsOfThisIlo.map(x => x.clo)))}: each is a separate relationship and is not part of this case` : 'None: this ILO is mapped to one CLO only'}</td></tr></tbody></table></div>` : '';
  const row = c.weekRow;
  const ilos = row.ilos.length ? row.ilos.map(x => `<li${x.inThisCase ? ' class="this"' : ''}>${escHtml(x.text)}${x.inThisCase ? ' <em>(the ILO in this case)</em>' : ''}</li>`).join('') : '<li>(no ILO is printed for this week)</li>';
  return `<article id="${c.caseId}"><h3>${c.caseId} · ${escHtml(c.relationship.name)}</h3><p class="meta">${escHtml(c.course.code)} ${escHtml(c.course.title)} · ${escHtml(c.week)} · lesson “${escHtml(c.lesson)}”</p>`
    + `<div class="pair"><div class="stmt"><p class="role">Statement 1: ${escHtml(a.role)}</p><p class="text">${block(a.text)}</p></div><div class="stmt"><p class="role">Statement 2: ${escHtml(b.role)}</p><p class="text">${block(b.text)}</p></div></div>${mapping}`
    + `<details open><summary>Context: the whole ${escHtml(row.week)} row as printed</summary><dl><dt>Course content</dt><dd>${block(row.content)}</dd><dt>Intended learning outcomes (CLO tags as printed)</dt><dd><ul>${ilos}</ul></dd><dt>Learning activities</dt><dd>${block(row.activities)}</dd><dt>Assessment</dt><dd>${block(row.assessment)}</dd></dl></details>`
    + `<p class="record">Record your judgment for ${c.caseId} in the evaluation form.</p></article>`;
}
function courseHtml(key) {
  const k = courses[key], own = cases.filter(c => c.course.code === key);
  return `<section class="course page" id="course-${escHtml(key.replace(/\W/g, ''))}"><h2>${escHtml(k.code)} ${escHtml(k.title)}</h2><p class="meta">${escHtml(k.program)} · ${own.length} cases (${own.map(c => c.caseId).join(', ')}) · units: ${k.units.lecture || k.units.laboratory ? `lecture ${escHtml(k.units.lecture || '0')}, laboratory ${escHtml(k.units.laboratory || '0')}` : 'not recorded in the transcription'} · prerequisite: ${escHtml(k.prerequisite || 'none printed')}</p>`
    + `<h3>Course description</h3><p>${escHtml(k.description)}</p>`
    + `<h3>Course learning outcomes</h3><table><thead><tr><th>CLO</th><th>Statement (as printed)</th><th>Required LCUP classification</th></tr></thead><tbody>${k.clos.map(x => `<tr><td class="nw">CLO ${x.clo}</td><td>${escHtml(x.statement)}</td><td>${escHtml(x.requiredClassification || 'none (no fixed classification)')}</td></tr>`).join('')}</tbody></table><p class="note">The classification follows from the CLO's number, as LCUP requires. Its official definitions are not available to this project; see the rubric, Part 6.</p>`
    + `<h3>Lesson outline</h3><table class="outline"><tbody>${k.lessonOutline.map(x => `<tr><td class="nw">${escHtml(x.week)}</td><td>${x.kind === 'examination' ? '<em>examination</em>' : escHtml(x.heading)}</td></tr>`).join('')}</tbody></table>`
    + own.map(caseHtml).join('') + '</section>';
}
function bookletHtml() {
  const css = ':root{--ink:#17202c;--muted:#4b5868;--line:#c9d1dc;--soft:#f3f5f8;--accent:#1f3864;--hl:#fff7d6}*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:15px/1.5 "Segoe UI",Arial,sans-serif}main{max-width:980px;margin:0 auto;padding:24px 16px 48px}h1{font-size:1.6rem;color:var(--accent);margin:.2em 0}h2{font-size:1.3rem;color:var(--accent);border-bottom:2px solid var(--accent);padding-bottom:.2em;margin-top:1.6em}h3{font-size:1.05rem;color:var(--accent);margin:1.2em 0 .4em}h4{font-size:1rem;margin:1em 0 .3em}.meta,.note,.record{color:var(--muted);font-size:.9rem}.note{border-left:3px solid var(--line);padding-left:.7em}.notice{background:var(--hl);border:1px solid #e6d48a;border-radius:6px;padding:.7em 1em}table{border-collapse:collapse;width:100%;margin:.5em 0 1em;font-size:.92rem}th,td{border:1px solid var(--line);padding:.35em .55em;text-align:left;vertical-align:top}td.nw{white-space:nowrap}thead th,table.ind th{background:var(--soft)}table.ind th{width:13em;white-space:nowrap}code{font-family:Consolas,monospace;font-size:.88rem}article{border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:18px 0;break-inside:avoid-page}article h3{margin-top:.2em}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.stmt{background:var(--soft);border-left:4px solid var(--accent);border-radius:4px;padding:8px 12px}.role{font-weight:600;margin:0 0 .3em;font-size:.9rem}.text{margin:0}.ln{display:block}.mapping{margin-top:10px}.sub{font-weight:600;margin:.6em 0 .2em}details{margin-top:10px}summary{cursor:pointer;color:var(--accent);font-weight:600}dl{margin:.4em 0}dt{font-weight:600;font-size:.9rem;margin-top:.5em}dd{margin:.1em 0 0 1em}li.this{background:var(--hl)}nav ol{columns:2}@media (max-width:700px){.pair{grid-template-columns:1fr}nav ol{columns:1}table.ind th{white-space:normal;width:auto}}@media print{body{font-size:11pt}main{max-width:none;padding:0}.page{break-before:page}details>summary{list-style:none}article{break-inside:auto}.stmt,.mapping table{break-inside:avoid}}';
  const toc = `<nav><h3>Contents</h3><ol><li><a href="#how">How to use this booklet</a></li><li><a href="#rubric">The rubric (provisional)</a></li>${Object.keys(courses).map(k => `<li><a href="#course-${escHtml(k.replace(/\W/g, ''))}">${escHtml(k)} ${escHtml(courses[k].title)}: ${cases.filter(c => c.course.code === k).map(c => c.caseId).join(', ')}</a></li>`).join('')}</ol></nav>`;
  const how = `<section id="how"><h2>How to use this booklet</h2><p>${escHtml(PURPOSE)}</p><ol><li>Read the rubric that follows. It is provisional, and Part 6 lists the points that LCUP has not yet defined.</li><li>Your form lists your cases. For each one, read its two statements and its context here: the course description, the CLOs, the lesson outline and the whole week as printed.</li><li>Record your judgment in the evaluation form (Excel), one row per case, in the yellow cells: the judgment, its justification, any recommended correction and your reviewer ID.</li><li>Work alone, and return the form to the research coordinator.</li></ol><p class="notice">${escHtml(CONFIDENTIAL)}</p><p class="note">${escHtml(TRANSCRIPTION)}</p></section>`;
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Faculty validation case booklet</title><style>${css}</style></head><body><main><header><h1>Faculty academic validation: case booklet</h1><p class="meta">Package ${VERSION} · built ${BUILT} · 21 cases from IT 202, IE-402 and CpE 304 · three for each of the seven academic relationships</p></header>${toc}${how}${rubricHtml()}${Object.keys(courses).map(courseHtml).join('')}</main></body></html>\n`;
}

// ---- a deterministic .xlsx writer: a stored (uncompressed) zip with one fixed date, inline strings, Arial throughout ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const zipStore = entries => {
  const [y, m, d] = BUILT.split('-').map(Number), dosDate = ((y - 1980) << 9) | (m << 5) | d;
  const locals = [], centrals = []; let offset = 0;
  for (const [name, data] of entries) {
    const n = Buffer.from(name, 'utf8'), crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(n.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, n, data); centrals.push(ch, n); offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
};
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const esc = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = i => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
// cellXfs: plain, header, evidence (locked), input (yellow, unlocked), title, paragraph, bold paragraph, computed (grey), percent, decimal
const X = { plain: 0, head: 1, text: 2, input: 3, title: 4, para: 5, bold: 6, computed: 7, percent: 8, decimal: 9 };
const STYLES = XML + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00"/></numFmts>'
  + '<fonts count="3"><font><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="14"/><color rgb="FF1F3864"/><name val="Arial"/><family val="2"/></font></fonts>'
  + '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/><bgColor indexed="64"/></patternFill></fill></fills>'
  + '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFA6A6A6"/></left><right style="thin"><color rgb="FFA6A6A6"/></right><top style="thin"><color rgb="FFA6A6A6"/></top><bottom style="thin"><color rgb="FFA6A6A6"/></bottom><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="0"/></xf>'
  + '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="9" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>'
  + '<xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>'
  + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0"/></styleSheet>';
// A cell is null, a string, or { v } (text), { f } (formula) or { n } (number), each with an optional style s.
const cellXml = (cell, ref) => {
  if (cell == null) return '';
  const o = typeof cell === 'string' ? { v: cell } : cell, s = o.s ?? X.text;
  if (o.f !== undefined) return `<c r="${ref}" s="${s}"><f>${esc(o.f)}</f></c>`;
  if (o.n !== undefined) return `<c r="${ref}" s="${s}"><v>${o.n}</v></c>`;
  if (o.v === '' || o.v == null) return `<c r="${ref}" s="${s}"/>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`;
};
// An estimate of the height a wrapped row needs (Arial 10, about 12.75 points a line), generous so that nothing is hidden. It is not a
// custom height: Excel fits the row again when a cell in it is edited.
const heightOf = (row, widths) => {
  const linesOf = (cell, w) => { const t = cell == null ? '' : typeof cell === 'string' ? cell : cell.v ?? ''; const per = Math.max(8, Math.floor(w * 1.05)); return String(t).split('\n').reduce((s, p) => s + Math.max(1, Math.ceil(p.length / per)), 0); };
  return Math.min(409, Math.max(1, ...row.map((c, i) => linesOf(c, widths[i] || 10))) * 12.75 + 4);
};
// A sheet is { name, cols, rows, freeze, active, selected, protect, validations: [{ sqref, list, title, prompt }], printTitles, landscape, footer }.
function sheetXml(sh) {
  const rows = sh.rows.map((r, i) => `<row r="${i + 1}" ht="${heightOf(r, sh.cols)}">${r.map((c, j) => cellXml(c, colName(j) + (i + 1))).join('')}</row>`).join('');
  const last = colName(Math.max(...sh.rows.map(r => r.length)) - 1) + sh.rows.length;
  const pane = sh.freeze ? `<pane ySplit="${sh.freeze}" topLeftCell="A${sh.freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${sh.active}" sqref="${sh.active}"/>` : `<selection activeCell="${sh.active || 'A1'}" sqref="${sh.active || 'A1'}"/>`;
  return XML + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}"/>`
    + `<sheetViews><sheetView workbookViewId="0"${sh.selected ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="12.75"/>`
    + `<cols>${sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>`
    + (sh.protect ? '<sheetProtection sheet="1" objects="1" scenarios="1" formatCells="0" formatColumns="0" formatRows="0"/>' : '')
    + (sh.validations?.length ? `<dataValidations count="${sh.validations.length}">${sh.validations.map(v => `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="${esc(v.title)}" error="${esc(`Choose one of: ${v.list.join(', ')}.`)}" promptTitle="${esc(v.title)}" prompt="${esc(v.prompt)}" sqref="${v.sqref}"><formula1>"${esc(v.list.join(','))}"</formula1></dataValidation>`).join('')}</dataValidations>` : '')
    + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>'
    + `<pageSetup paperSize="1" orientation="${sh.landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>`
    + `<headerFooter><oddFooter>${esc(`&L${sh.footer}&RPage &P of &N`)}</oddFooter></headerFooter></worksheet>`;
}
function xlsx(title, sheets) {
  const active = Math.max(0, sheets.findIndex(s => s.selected));
  const names = sheets.map((s, i) => (s.printTitles ? `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${esc(s.name)}'!$1:$1</definedName>` : '')).join('');
  const parts = [
    ['[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`],
    ['_rels/.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`],
    ['docProps/core.xml', `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>LCUP faculty validation package</dc:creator><cp:lastModifiedBy>LCUP faculty validation package</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${BUILT}T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${BUILT}T00:00:00Z</dcterms:modified></cp:coreProperties>`],
    ['docProps/app.xml', `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>LCUP faculty validation package generator</Application></Properties>`],
    ['xl/workbook.xml', `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView activeTab="${active}"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${names ? `<definedNames>${names}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return zipStore(parts.map(([name, text]) => [name, Buffer.from(text, 'utf8')]));
}

// ---- the faculty evaluation form ----
const FORM_COLUMNS = ['Case ID', 'Academic relationship', 'Syllabus evidence', 'Faculty judgment', 'Academic justification', 'Recommended correction, if necessary', 'Reviewer ID', 'Within your expertise? (optional)', 'Requires an institutional decision? (optional)', 'Notes (optional)'];
const FORM_WIDTHS = [9, 18, 78, 22, 48, 38, 12, 14, 16, 26];
const evidenceOf = c => {
  const [a, b] = c.statements, m = c.iloCloMapping;
  return [`${c.course.code} ${c.course.title}, ${c.week}`, '', `Statement 1: ${a.role}`, ...lines(a.text), '', `Statement 2: ${b.role}`, ...lines(b.text),
    ...(m ? ['', `Faculty-assigned CLO mapping: CLO ${m.cloInThisRelationship} (as printed: "${m.mappingAsPrinted}")`, `Required LCUP classification of CLO ${m.cloInThisRelationship}: ${m.requiredClassification}`] : []),
    '', `Full context: case booklet, ${c.caseId}.`].join('\n');
};
const YESNO = ['yes', 'no', 'uncertain'];
function formWorkbook(scope, own) {
  const n = own.length, footer = `${VERSION} · faculty evaluation form · ${scope}`;
  const instructions = {
    name: 'Instructions', cols: [30, 110], footer, selected: true, active: 'B4',
    rows: [
      [{ v: 'Faculty academic validation: evaluation form', s: X.title }],
      [{ v: 'Form', s: X.bold }, { v: `${scope}: ${n} cases (${own.map(c => c.caseId).join(', ')}). Package ${VERSION}, built ${BUILT}.`, s: X.para }],
      [null, null],
      [{ v: 'Date you completed the form', s: X.bold }, { v: '', s: X.input }],
      [null, null],
      [{ v: 'Purpose', s: X.bold }, { v: PURPOSE, s: X.para }],
      [{ v: 'Steps', s: X.bold }, { v: ['1. Read the rubric (the "Rubric" sheet, or the case booklet in full).', '2. For each case, read the case in the booklet: its two statements and its context.', '3. On the "Evaluation" sheet, fill in the yellow cells of that case\'s row: Faculty judgment (choose from the list), Academic justification, Recommended correction (or "None") and Reviewer ID. The last three columns are optional.', '4. Work alone and do not use any AI tool. Keep the file on a university computer.', '5. When you have finished, enter the date above, save the file and return it to the research coordinator.'].join('\n'), s: X.para }],
      [{ v: 'Which cells to edit', s: X.bold }, { v: 'Only the yellow cells: the date above, and columns D to J of the "Evaluation" sheet. The white cells hold the case and its evidence; they are protected so that they are not changed by accident (no password: Review > Unprotect Sheet).', s: X.para }],
      [null, null],
      [{ v: 'The four judgments', s: X.bold }, null],
      ...RUBRIC.labels.map(([l, d]) => [{ v: l, s: X.text }, { v: d, s: X.text }]),
      [null, null],
      [{ v: 'Format example only', s: X.bold }, { v: 'Fictional statements, not one of the cases; it shows the expected format, not an answer to copy.', s: X.para }],
      ...[['Case ID', 'EXAMPLE'], ['Academic relationship', 'Course Content ↔ ILO'], ['Syllabus evidence', 'Statement 1: Course content (fictional): • Spreadsheet formulas • Charts\nStatement 2: ILO (fictional): Create a chart from spreadsheet data.'], ['Faculty judgment', 'ALIGNED'], ['Academic justification', 'The ILO\'s "Create a chart" is supported by the content\'s "Charts": the content lists the topic the ILO names, and the ILO asks students to make one.'], ['Recommended correction, if necessary', 'None'], ['Reviewer ID', 'R-IT-01']].map(([k, v]) => [{ v: k, s: X.text }, { v, s: X.computed }]),
      [null, null],
      [{ v: 'Confidentiality', s: X.bold }, { v: CONFIDENTIAL, s: X.para }],
      [{ v: 'Transcription', s: X.bold }, { v: TRANSCRIPTION, s: X.para }],
    ],
  };
  const evaluation = {
    name: 'Evaluation', cols: FORM_WIDTHS, freeze: 1, active: 'D2', protect: true, printTitles: true, landscape: true, footer,
    rows: [FORM_COLUMNS.map(h => ({ v: h, s: X.head })), ...own.map(c => [c.caseId, c.relationship.name, evidenceOf(c), ...FORM_COLUMNS.slice(3).map(() => ({ v: '', s: X.input }))])],
    validations: [
      { sqref: `D2:D${n + 1}`, list: LABELS, title: 'Faculty judgment', prompt: 'Choose one of the four judgments (see the Instructions sheet).' },
      { sqref: `H2:I${n + 1}`, list: YESNO, title: 'Optional', prompt: 'yes, no or uncertain' },
    ],
  };
  const rubric = {
    name: 'Rubric', cols: [22, 34, 30, 30, 30, 30, 40, 48], freeze: 1, active: 'A2', printTitles: true, landscape: true, footer,
    rows: [
      ['Relationship', 'Question', ...LABELS.map(l => `${l} when`), 'Consider', 'Needs an institutional definition'].map(h => ({ v: h, s: X.head })),
      ...RUBRIC.relationships.map(r => [REL[r.key], r.question, ...r.indicators, r.consider.map(x => `• ${x}`).join('\n'), r.institutional.map(x => `• ${x}`).join('\n')]),
      [null], [{ v: RUBRIC.status, s: X.para }], [{ v: 'The full rubric (Parts 1 to 7) is in the case booklet and in academic-evaluation-rubric.md.', s: X.para }],
    ],
  };
  return xlsx(`Faculty evaluation form: ${scope}`, [instructions, evaluation, rubric]);
}

// ---- the faculty-Claude comparison workbook (coordinator only) ----
const CMP = ['Case ID', 'Benchmark case ID', 'Course', 'Week', 'Academic relationship', 'Reviewer 1 ID', 'Reviewer 1 judgment', 'Reviewer 2 ID', 'Reviewer 2 judgment', 'Reviewers agree?',
  'Faculty reference judgment (adjudicated)', 'Other defensible judgments (codes, comma-separated, only if ambiguous)', 'Ambiguous? (yes/no)', 'Adjudicator ID', 'Adjudication date (YYYY-MM-DD)', 'Adjudication reason', 'Institutional decision needed? (yes/no)',
  'Source side is', 'Quote from the source side', 'Target side is', 'Quote from the target side',
  'Claude run ID', 'Claude model', 'Claude prompt version', 'Claude status', 'Claude judgment', 'Agreement with faculty reference', 'Potential false approval', 'Potential false rejection', 'Claude recommended correction (verbatim)', 'Faculty rating of the Claude correction', 'Notes'];
const CMP_WIDTHS = [8, 15, 9, 10, 20, 11, 20, 11, 20, 10, 22, 22, 11, 12, 13, 36, 13, 18, 30, 18, 30, 16, 16, 22, 22, 20, 14, 12, 12, 36, 16, 26];
const CLAUDE_STATUS = ['REVIEWABLE_MODEL_JUDGMENT', 'INSUFFICIENT_EVIDENCE', 'NOT_CHECKED', 'INVALID_RESPONSE', 'NOT_ATTEMPTED'];
const RATING = ['yes', 'partly', 'no', 'cannot_judge'];
const cmpCol = name => colName(CMP.indexOf(name));
function comparisonWorkbook() {
  const [G, I, K, L, M, Z] = ['Reviewer 1 judgment', 'Reviewer 2 judgment', 'Faculty reference judgment (adjudicated)', 'Other defensible judgments (codes, comma-separated, only if ambiguous)', 'Ambiguous? (yes/no)', 'Claude judgment'].map(cmpCol);
  const accepted = (r, code) => `ISNUMBER(SEARCH(",${code},",","&SUBSTITUTE(${L}${r}," ","")&","))`;
  const rows = cases.map((c, i) => {
    const r = i + 2, side = s => c.statements.find(x => x.benchmarkSide === s).role;
    const input = () => ({ v: '', s: X.input });
    return [c.caseId, c.benchmark.id, c.course.code, c.week, c.relationship.name, input(), input(), input(), input(),
      { f: `IF(OR(${G}${r}="",${I}${r}=""),"",IF(${G}${r}=${I}${r},"agree","disagree"))`, s: X.computed },
      input(), input(), input(), input(), input(), input(), input(),
      { v: side('source'), s: X.computed }, input(), { v: side('target'), s: X.computed }, input(),
      input(), input(), input(), input(), input(),
      { f: `IF(OR(${K}${r}="",${Z}${r}=""),"",IF(OR(${Z}${r}=${K}${r},${accepted(r, `"&${Z}${r}&"`)}),"agrees","differs"))`, s: X.computed },
      { f: `IF(OR(${K}${r}="",${Z}${r}=""),"",IF(AND(${Z}${r}="ALIGNED",${K}${r}<>"ALIGNED",NOT(${accepted(r, 'ALIGNED')}),${M}${r}<>"yes"),"yes","no"))`, s: X.computed },
      { f: `IF(OR(${K}${r}="",${Z}${r}=""),"",IF(AND(${K}${r}="ALIGNED",SUBSTITUTE(${L}${r}," ","")="",${Z}${r}<>"ALIGNED"),"yes","no"))`, s: X.computed },
      input(), input(), input()];
  });
  const n = cases.length, last = n + 1, range = name => `Comparison!$${cmpCol(name)}$2:$${cmpCol(name)}$${last}`;
  const REL_RANGE = range('Academic relationship');
  const sumRows = [...POLICY.weeklyTypes.map(t => REL[t]), 'All relationships'];
  const summaryRow = (label, r) => {
    const by = label === 'All relationships' ? null : `${REL_RANGE},$A${r}`;
    const count = (...criteria) => ({ f: by ? `COUNTIFS(${by},${criteria.join(',')})` : `COUNTIFS(${criteria.join(',')})`, s: X.computed });
    return [{ v: label, s: X.text }, { f: by ? `COUNTIF(${REL_RANGE},$A${r})` : `COUNTA(Comparison!$A$2:$A$${last})`, s: X.computed },
      count(`${range('Faculty reference judgment (adjudicated)')},"<>"`),
      { f: by ? `COUNTIFS(${by},${range('Reviewers agree?')},"agree")+COUNTIFS(${by},${range('Reviewers agree?')},"disagree")` : `COUNTIF(${range('Reviewers agree?')},"agree")+COUNTIF(${range('Reviewers agree?')},"disagree")`, s: X.computed },
      count(`${range('Reviewers agree?')},"agree"`), count(`${range('Claude judgment')},"<>"`), count(`${range('Agreement with faculty reference')},"agrees"`),
      count(`${range('Potential false approval')},"yes"`), count(`${range('Potential false rejection')},"yes"`), count(`${range('Claude judgment')},"INSUFFICIENT_EVIDENCE"`)];
  };
  const SUMMARY_HEAD = ['Relationship', 'Cases', 'Faculty references recorded', 'Reviewer pairs complete', 'Reviewers agree', 'Claude judgments recorded', 'Claude agrees with faculty reference', 'Potential false approvals', 'Potential false rejections', 'Claude INSUFFICIENT_EVIDENCE'];
  const all = sumRows.length + 1, R1 = range('Reviewer 1 judgment'), R2 = range('Reviewer 2 judgment');
  const kappaStart = all + 5; // the kappa table's header row: after a blank row, the two agreement shares and the note
  const kappaRows = LABELS.map((l, i) => { const r = kappaStart + 1 + i; return [{ v: l, s: X.text }, { f: `COUNTIFS(${R1},$A${r},${R2},$A${r})`, s: X.computed }, { f: `COUNTIFS(${R1},$A${r},${R2},"<>")`, s: X.computed }, { f: `COUNTIFS(${R2},$A${r},${R1},"<>")`, s: X.computed }]; });
  const kFirst = kappaStart + 1, kLast = kappaStart + LABELS.length, kN = kLast + 1;
  const COURSE_RANGE = range('Course'), courseStart = kN + 6; // the by-course header row: after kappa, its note and a blank row
  const courseRows = Object.keys(courses).map((k, i) => {
    const r = courseStart + 1 + i, by = `${COURSE_RANGE},$A${r}`, agree = range('Reviewers agree?');
    return [{ v: k, s: X.text }, { f: `COUNTIF(${COURSE_RANGE},$A${r})`, s: X.computed }, { f: `COUNTIFS(${by},${range('Faculty reference judgment (adjudicated)')},"<>")`, s: X.computed },
      { f: `COUNTIFS(${by},${agree},"agree")+COUNTIFS(${by},${agree},"disagree")`, s: X.computed }, { f: `COUNTIFS(${by},${agree},"agree")`, s: X.computed },
      { f: `COUNTIFS(${by},${range('Claude judgment')},"<>")`, s: X.computed }, { f: `COUNTIFS(${by},${range('Agreement with faculty reference')},"agrees")`, s: X.computed }];
  });
  const summary = {
    name: 'Summary', cols: [40, 10, 14, 14, 12, 14, 16, 14, 14, 16], freeze: 1, active: 'A2', landscape: true, footer: `${VERSION} · comparison summary · coordinator only`,
    rows: [
      SUMMARY_HEAD.map(h => ({ v: h, s: X.head })),
      ...sumRows.map((label, i) => summaryRow(label, i + 2)),
      [null],
      [{ v: 'Reviewer agreement (share of complete pairs)', s: X.bold }, { f: `IF(D${all}=0,"",E${all}/D${all})`, s: X.percent }],
      [{ v: 'Claude agreement with the faculty reference (share of cases with both)', s: X.bold }, { f: `IF(COUNTIFS(${range('Faculty reference judgment (adjudicated)')},"<>",${range('Claude judgment')},"<>")=0,"",G${all}/COUNTIFS(${range('Faculty reference judgment (adjudicated)')},"<>",${range('Claude judgment')},"<>"))`, s: X.percent }],
      [{ v: 'Use counts, not percentages, per relationship: each holds three cases.', s: X.para }],
      [{ v: 'Cohen\'s kappa between the two review slots (descriptive)', s: X.head }, { v: 'Both chose', s: X.head }, { v: 'Reviewer 1 chose', s: X.head }, { v: 'Reviewer 2 chose', s: X.head }],
      ...kappaRows,
      [{ v: 'Complete pairs', s: X.bold }, { f: `COUNTIFS(${R1},"<>",${R2},"<>")`, s: X.computed }],
      [{ v: 'Observed agreement', s: X.bold }, { f: `IF(B${kN}=0,"",SUM(B${kFirst}:B${kLast})/B${kN})`, s: X.decimal }],
      [{ v: 'Agreement expected by chance', s: X.bold }, { f: `IF(B${kN}=0,"",SUMPRODUCT(C${kFirst}:C${kLast},D${kFirst}:D${kLast})/B${kN}^2)`, s: X.decimal }],
      [{ v: 'Cohen\'s kappa', s: X.bold }, { f: `IF(OR(B${kN}=0,B${kN + 2}=1),"",(B${kN + 1}-B${kN + 2})/(1-B${kN + 2}))`, s: X.decimal }],
      [{ v: 'Kappa treats "Reviewer 1" and "Reviewer 2" as two raters. Different people fill those slots for different courses, so also report agreement per course (below), and do not read much into kappa with 21 cases.', s: X.para }],
      [null],
      ['Course', 'Cases', 'Faculty references recorded', 'Reviewer pairs complete', 'Reviewers agree', 'Claude judgments recorded', 'Claude agrees with faculty reference'].map(h => ({ v: h, s: X.head })),
      ...courseRows,
    ],
  };
  const readme = {
    name: 'Read me', cols: [30, 110], selected: true, active: 'A1', footer: `${VERSION} · comparison template · coordinator only`,
    rows: [
      [{ v: 'Faculty–Claude comparison template (coordinator only)', s: X.title }],
      [{ v: 'Never give this file to reviewers', s: X.bold }, { v: 'It names the benchmark cases and will hold Claude\'s results. Reviewers work only from the for-reviewers folder.', s: X.para }],
      [{ v: 'Status', s: X.bold }, { v: `Empty template, package ${VERSION}, built ${BUILT}. No faculty judgment and no Claude result is entered. Claude has not been run on these 21 cases.`, s: X.para }],
      [{ v: 'Order of work', s: X.bold }, { v: ['1. Enter both reviewers\' returned judgments (columns F to I).', '2. The adjudicator records the faculty reference judgment and its evidence (columns K to U). Freeze the faculty references before any Claude result is seen.', '3. Only after a separately approved, pre-registered run: enter Claude\'s results from its review report (columns V to AD).', '4. Faculty rate Claude\'s recommended corrections (column AE) without changing their earlier judgments.', '5. Copy the adjudications into adjudication.template.json and the run into model-results.template.json, and run measure.cjs (README.md). measure.cjs is the authoritative computation; this workbook is a working view.'].join('\n'), s: X.para }],
      [{ v: 'Which cells to edit', s: X.bold }, { v: 'Yellow cells only. Grey cells are filled in by the package (case details and the side each quote must come from) or computed by formulas.', s: X.para }],
      [{ v: 'Faculty reference judgment', s: X.bold }, { v: 'The adjudicated judgment. List other defensible judgments only when the case is genuinely open to more than one reading, and then mark it ambiguous. Never average the reviewers or take an automatic majority.', s: X.para }],
      [{ v: 'Quotes', s: X.bold }, { v: 'Quote the evidence exactly from the statement named in "Source side is" and "Target side is". measure.cjs accepts an adjudication only if each quote is found, apart from spacing, in that statement.', s: X.para }],
      [{ v: 'Reviewers agree?', s: X.bold }, { v: '"agree" when both reviewers chose the same judgment.', s: X.para }],
      [{ v: 'Agreement with faculty reference', s: X.bold }, { v: '"agrees" when Claude\'s judgment is the faculty reference judgment or one of the other defensible judgments.', s: X.para }],
      [{ v: 'Potential false approval', s: X.bold }, { v: '"yes" when Claude judged ALIGNED, ALIGNED is not an accepted judgment, and the case is not marked ambiguous (the definition used by the project\'s metrics).', s: X.para }],
      [{ v: 'Potential false rejection', s: X.bold }, { v: '"yes" when ALIGNED is the only accepted judgment and Claude judged otherwise.', s: X.para }],
      [{ v: 'Limits', s: X.bold }, { v: 'Three cases per relationship support counts, not rates. The three syllabi informed the design of the evaluation prompts, so these results are a development-stage check, not an independent accuracy estimate. No institutional acceptance threshold exists.', s: X.para }],
    ],
  };
  const comparison = {
    name: 'Comparison', cols: CMP_WIDTHS, freeze: 1, active: 'F2', printTitles: true, landscape: true, footer: `${VERSION} · comparison · coordinator only`,
    rows: [CMP.map(h => ({ v: h, s: X.head })), ...rows],
    validations: [
      { sqref: `${G}2:${G}${last} ${I}2:${I}${last} ${K}2:${K}${last} ${Z}2:${Z}${last}`, list: LABELS, title: 'Judgment', prompt: 'One of the four judgments.' },
      { sqref: `${M}2:${M}${last} ${cmpCol('Institutional decision needed? (yes/no)')}2:${cmpCol('Institutional decision needed? (yes/no)')}${last}`, list: ['yes', 'no'], title: 'yes or no', prompt: 'yes or no' },
      { sqref: `${cmpCol('Claude status')}2:${cmpCol('Claude status')}${last}`, list: CLAUDE_STATUS, title: 'Claude status', prompt: 'The status in the run\'s review report.' },
      { sqref: `${cmpCol('Faculty rating of the Claude correction')}2:${cmpCol('Faculty rating of the Claude correction')}${last}`, list: RATING, title: 'Rating', prompt: 'Is the recommended correction appropriate?' },
    ],
  };
  const at = r => summary.rows[r - 1][0]?.v;
  if (at(all) !== 'All relationships' || !String(at(kappaStart)).startsWith('Cohen') || at(kFirst) !== LABELS[0] || at(kLast) !== LABELS.at(-1) || at(kN) !== 'Complete pairs' || at(kN + 3) !== 'Cohen\'s kappa' || at(courseStart) !== 'Course' || at(courseStart + 1) !== Object.keys(courses)[0] || summary.rows.length !== courseStart + courseRows.length) throw new Error('the summary formulas point at the wrong rows');
  return xlsx('Faculty–Claude comparison template', [readme, comparison, summary]);
}

// ---- the coordinator's records ----
const signalRows = drawn.map(d => ({ caseId: d.record.caseId, benchmarkId: d.record.benchmark.id, course: d.record.course.code, week: d.record.week, relationship: d.record.relationship.name, signal: d.signal, observation: d.observation }));
const coverage = {
  byRelationship: Object.fromEntries(POLICY.weeklyTypes.map(t => [REL[t], signalRows.filter(s => s.relationship === REL[t]).map(s => `${s.caseId} ${s.course}: ${s.signal}`)])),
  byCourse: Object.fromEntries(Object.keys(courses).map(k => [k, signalRows.filter(s => s.course === k).length])),
  bySignal: Object.fromEntries(SIGNALS.map(s => [s, signalRows.filter(x => x.signal === s).length])),
  cloClassificationsInSample: cases.filter(c => c.iloCloMapping).map(c => `${c.caseId}: CLO ${c.iloCloMapping.cloInThisRelationship} ${c.iloCloMapping.requiredClassification}`),
};
const GAPS = [
  'Course Title ↔ Course Content: none of the eight CpE 304 cases can be used, because all are reference-held (the course code is written "CpE 304" in the syllabus and "CpE-304" in the curriculum transcription). No authentic apparent misalignment was found in the three syllabi; the third case is the IE-402 orientation week, whose content names no subject-matter topic.',
  'Course Content ↔ Learning Activities: no authentic apparent misalignment was found; the third case is CpE 304, whose activities name a teaching method only.',
  'Course Content ↔ Assessment: the sample has no apparent partial alignment for this relationship. An authentic candidate exists (reserve 1), but it would add a tenth IE-402 case; the CpE 304 case was kept so that the syllabus stays represented.',
  'CpE 304 uses the same general wording for the activities and the assessment of every lesson, so its cases for those relationships can only show how faculty treat general wording.',
  'ILO ↔ CLO: three cases cover CLO 1 (Introductory), CLO 3 (Demonstrating) and CLO 4 (Integration of Values); CLO 2 (Enabling) is not covered (reserve 2). IT 202 has no ILO mapped to CLO 4, and CpE 304 none mapped to CLO 3 or CLO 4.',
];
const selection = {
  version: VERSION, built: BUILT, coordinatorOnly: true,
  warning: 'Never give this record to reviewers, and never include it in any prompt or model input. The signals are not judgments, not expected answers and not ground truth; do not score faculty or Claude against them.',
  author: 'The selection signals and observations were written by Claude Code (an AI assistant) on 2026-10-29 from the wording of the cases alone, when the sample was drawn. No faculty member has reviewed them.',
  rule: [
    'Pool: the relationships of the three verified syllabi (IT 202, IE-402, CpE 304) in lcup-academic-benchmark-1, for the seven weekly relationship types of academic-evaluation-v2-preview-1.',
    'Eligible: academic-semantic, required weekly, not optional, no reference hold, no missing evidence, Claude eligibility "candidate_pending_authorization".',
    `Left out: the ${EARLIER_OUTPUT.length} cases with an earlier Claude output (${EARLIER_OUTPUT.join(', ')}), so that no earlier output can reach the blind materials or shape the sample.`,
    'Three cases per relationship, one from each syllabus where it offers a suitable case.',
    'Within each relationship, cases chosen from their wording to include an apparent alignment, an apparent partial alignment and an apparent misalignment; where no authentic apparent misalignment exists, a case whose evidence is general or administrative instead, and the gap is reported. No academic content was written or changed.',
    'Weeks spread over the term; one week may serve two relationships. Case IDs follow course, week and relationship order, so they reveal no signal.',
  ],
  signals: signalRows, coverage, gaps: GAPS, reserves,
  excluded: { earlierModelOutput: EARLIER_OUTPUT, referenceHeld: held.map(c => c.id), missingEvidence: missing.map(c => c.id) },
};
function selectionMd() {
  const out = ['# Selection record (coordinator only)', '', `Package ${VERSION}, built ${BUILT}.`, '', `> **${selection.warning}**`, '', selection.author, '', '## Rule', '', ...selection.rule.map((r, i) => `${i + 1}. ${r}`), ''];
  out.push('## The 21 cases and the reason each was chosen', '', '| Case | Benchmark case | Course | Week | Relationship | Signal (not a judgment) | Observation from the wording |', '|---|---|---|---|---|---|---|', ...signalRows.map(s => `| ${s.caseId} | ${s.benchmarkId} | ${s.course} | ${s.week} | ${s.relationship} | ${s.signal} | ${s.observation} |`), '');
  out.push('## Coverage', '', '| Relationship | Cases |', '|---|---|', ...Object.entries(coverage.byRelationship).map(([k, v]) => `| ${k} | ${v.join('; ')} |`), '', `By course: ${Object.entries(coverage.byCourse).map(([k, v]) => `${k} ${v}`).join(', ')}. By signal: ${Object.entries(coverage.bySignal).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '', `CLO classifications in the ILO ↔ CLO cases: ${coverage.cloClassificationsInSample.join('; ')}.`, '');
  out.push('## Gaps', '', ...GAPS.map(g => `- ${g}`), '');
  out.push('## Reserves (not in the sample)', '', '| # | Benchmark case | Course | Week | Relationship | Signal | Observation |', '|---|---|---|---|---|---|---|', ...reserves.map((r, i) => `| ${i + 1} | ${r.benchmarkId} | ${r.course} | ${r.week} | ${r.relationship} | ${r.signal} | ${r.observation} |`), '', 'A reserve replaces a case only before any reviewer has seen the package, for example when a reviewer turns out to be the author. Record the change and rebuild.', '');
  out.push('## Left out', '', `- Earlier Claude output: ${EARLIER_OUTPUT.join(', ')}.`, `- Reference-held: ${held.length} (${held.map(c => c.id).join(', ')}).`, `- Missing evidence: ${missing.length} (see missing-mappings-and-non-evaluable.md).`, '');
  return out.join('\n');
}
function missingMd() {
  const ne = notEvaluable, out = ['# Missing mappings and relationships that cannot be evaluated', '', `Package ${VERSION}, built ${BUILT}. For the research team; kept apart from the 21 cases and from the evaluation form.`, '', ne.note, ''];
  const untaggedInSample = cases.filter(c => c.relationship.key !== 'ILO-CLO' && c.weekRow.ilos.some(x => x.inThisCase && !x.facultyAssignedClos.length)).map(c => c.caseId);
  out.push(`## 1. ILOs mapped to no CLO (${ne.ilosWithoutClo.length})`, '', 'Each has no ILO ↔ CLO relationship to judge. The intended CLO is a question for the course faculty (questions F2 and F8 of the decisions document), and whether every ILO must name a CLO is Decision 8a.', '', `Such an ILO can still be judged against its week's content, activities and assessment, which do not depend on a CLO mapping: ${untaggedInSample.join(', ')} of the sample are such cases.`, '', '| Course | Week | ILO as printed | Benchmark case |', '|---|---|---|---|', ...ne.ilosWithoutClo.map(x => `| ${x.course} | ${x.week} | ${x.ilo} | ${x.benchmarkId} |`), '');
  out.push(`## 2. Lessons with no ILO (${ne.lessonsWithoutIlo.length})`, '', 'Decision 8b asks whether every lesson week must have an ILO.', '', '| Course | Week | Lesson | Relationships that cannot exist |', '|---|---|---|---|', ...ne.lessonsWithoutIlo.map(x => `| ${x.course} | ${x.week} | ${x.lesson} | ${x.relationshipsNotEvaluable.map(r => `${r.relationship} (${r.benchmarkId})`).join('; ')} |`), '');
  out.push(`## 3. CLOs that no ILO is mapped to (${ne.closWithoutIlo.length})`, '', 'No ILO ↔ CLO relationship exists for these CLOs, so none can be validated. Decision 8c asks whether every CLO must be built by an ILO.', '', '| Course | CLO | Required classification | Statement |', '|---|---|---|---|', ...ne.closWithoutIlo.map(x => `| ${x.course} | CLO ${x.clo} | ${x.requiredClassification} | ${x.statement} |`), '');
  out.push(`## 4. Reference-held relationships (${ne.referenceHeld.length})`, '', 'The course code is written "CpE 304" in the syllabus and "CpE-304" in the curriculum transcription, and the benchmark does not certify the course identity against an assumed match. An answer to Decision 10 (which form of the code is official, and whether a syllabus may print an equivalent) would allow them to be released.', '', '| Course | Week | Relationship | Hold | Benchmark case |', '|---|---|---|---|---|', ...ne.referenceHeld.map(x => `| ${x.course} | ${x.week} | ${x.relationship} | ${x.holds.map(h => `${h.code} (${h.owner})`).join(', ')} | ${x.benchmarkId} |`), '');
  out.push('## Counts', '', `ILOs mapped to no CLO: ${ne.counts.ilosWithoutClo}. Relationships of lessons with no ILO: ${ne.counts.relationshipsOfLessonsWithoutIlo}. Reference-held: ${ne.counts.referenceHeld}. Total relationships that cannot be evaluated: ${ne.counts.total}. CLOs built by no ILO: ${ne.counts.closWithoutIlo}.`, '', `Of the ${iloCloRelationships.length} ILO ↔ CLO relationships of the three syllabi, ${evaluable} can be evaluated. validation-dataset.json lists all ${iloCloRelationships.length} under iloCloRelationships, one entry for each ILO and CLO pair, so that a later, larger review can judge each mapping separately; ${cases.filter(c => c.iloCloMapping).map(c => c.caseId).join(', ')} are the ones in this sample.`, '');
  return out.join('\n');
}

const datasetOut = {
  version: VERSION, built: BUILT,
  status: 'Prepared offline. No faculty judgment, no adjudication and no model result is included.',
  purpose: 'Faculty academic validation of the seven academic relationships: 21 genuine relationships from the three verified LCUP syllabi, three per relationship, for blind faculty judgment and a later, separately approved comparison with Claude.',
  benchmark: { version: dataset.version, benchmarkHash: dataset.benchmarkHash, policyVersion: POLICY.id, file: 'docs/lcup-academic-benchmark/package/cases.json', sha256: CASES.sha256 },
  labels: LABELS,
  relationships: POLICY.weeklyTypes.map(k => ({ key: k, name: REL[k] })),
  cloClassification: { mapping: CLASSIFICATION.map((c, i) => ({ clo: i + 1, classification: c })), basis: 'LCUP\'s fixed classification by CLO number, confirmed by the project owner on 2026-10-29.', officialDefinitions: null, note: 'The official definitions of the four classifications are not in the repository, and none is supplied here.' },
  dataMinimisation: 'Reproduced: course identity, units and prerequisite, the course description, the CLOs, a one-line lesson outline and the selected lesson rows (content, ILOs, activities, assessment). Not reproduced: names, signatures, contact details, the core-values column, requirements, references and the grading system.',
  courses,
  cases,
  notEvaluable,
  iloCloRelationships,
};

// ---- the measurement templates, in the benchmark's own formats ----
const ids = cases.map(c => c.benchmark.id);
const adjudication = {
  ...Object.fromEntries(Object.entries(ADJ.data).filter(([k]) => k !== 'adjudications')),
  provenance: 'awaiting-faculty-adjudication',
  package: VERSION,
  instructions: 'Fill one entry per case from the comparison workbook. reviewStatus "adjudicated" needs adjudicatorId, at least two distinct reviewerIds, reviewedAt (ISO date), a non-empty reason, recordRef, acceptedJudgments (the reference first) and ambiguous (true or false); sourceEvidence and targetEvidence must be quotes from the case\'s source and target text. Set provenance to "faculty-adjudication" only when every entry is final.',
  adjudications: cases.map(c => { const t = ADJ.data.adjudications.find(a => a.id === c.benchmark.id); if (!t || t.caseHash !== c.benchmark.caseHash) throw new Error(`no adjudication template entry for ${c.benchmark.id}`); return { ...t, validationCaseId: c.caseId }; }),
};
const modelResults = { ...MODEL.data, package: VERSION, plannedCaseIds: ids, note: 'Not run. Fill only from a separately approved, pre-registered run whose bundle names these 21 cases, after the faculty references are frozen.' };

// ---- write, refusing to replace a changed file ----
const files = new Map();
const put = (rel, data) => files.set(rel, Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'));
put('for-reviewers/case-booklet.html', bookletHtml());
put('for-reviewers/academic-evaluation-rubric.md', rubricMd());
put('for-reviewers/faculty-evaluation-form.xlsx', formWorkbook('All 21 cases', cases));
for (const key of Object.keys(courses)) put(`for-reviewers/faculty-evaluation-form-${key.replace(/\W/g, '')}.xlsx`, formWorkbook(`${key} cases`, cases.filter(c => c.course.code === key)));
put('coordinator-only/validation-dataset.json', json(datasetOut));
put('coordinator-only/missing-mappings-and-non-evaluable.md', missingMd());
put('coordinator-only/selection-record.json', json(selection));
put('coordinator-only/selection-record.md', selectionMd());
put('coordinator-only/faculty-claude-comparison-template.xlsx', comparisonWorkbook());
put('coordinator-only/adjudication.template.json', json(adjudication));
put('coordinator-only/model-results.template.json', json(modelResults));

const listFiles = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? listFiles(path.join(dir, e.name)).map(f => `${e.name}/${f}`) : [e.name])) : []);
const manifestFile = path.join(OUT, 'package-manifest.json');
const previous = fs.existsSync(manifestFile) ? readJson(manifestFile) : { files: [] };
const blocked = listFiles(OUT).filter(f => f !== 'package-manifest.json' && !AUTHORED.includes(f)).filter(f => {
  const rec = previous.files.find(x => x.file === f && x.origin === 'generated');
  return !rec || rec.sha256 !== sha(fs.readFileSync(path.join(OUT, f)));
});
if (blocked.length) { console.log(`REFUSED: these files were changed since the last build or were not written by it, so nothing was written:\n  ${blocked.join('\n  ')}`); process.exit(2); }
for (const [rel, buf] of files) { fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true }); fs.writeFileSync(path.join(OUT, rel), buf); }
const audience = rel => (rel.startsWith('for-reviewers/') ? 'faculty reviewers' : rel.startsWith('coordinator-only/') ? 'research coordinator only' : 'research team');
const manifest = {
  version: VERSION, built: BUILT,
  inputs: [CASES, ADJ, MODEL].map(f => ({ file: `docs/lcup-academic-benchmark/package/${f.name}`, sha256: f.sha256 })),
  benchmarkHash: dataset.benchmarkHash,
  files: [...[...files].map(([rel, buf]) => ({ file: rel, sha256: sha(buf), bytes: buf.length, origin: 'generated', audience: audience(rel) })),
    ...AUTHORED.filter(f => fs.existsSync(path.join(OUT, f))).map(f => { const buf = fs.readFileSync(path.join(OUT, f)); return { file: f, sha256: sha(buf), bytes: buf.length, origin: 'authored', audience: audience(f) }; })]
    .sort((a, b) => a.file.localeCompare(b.file)),
};
fs.writeFileSync(manifestFile, json(manifest));
console.log(`Wrote ${files.size} files to ${path.relative(ROOT, OUT)} (${cases.length} cases; ${notEvaluable.counts.total} relationships that cannot be evaluated listed apart). No provider was called.`);
