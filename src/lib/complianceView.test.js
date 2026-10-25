// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { runState, tone, ringAngle, basis, blockersOf, warningsOf, warningCount, headline, areaNames, groupFindings, scoreText, when, stepLabel, listBasis, STEP_INFO, rowState, actionLabel, timeOf, stamp, isLocked, needsCheck, canCheckNow, rangeToInstants, rangeLabel, bulkTargets, filterRows, groupByFacultyProgram } from './complianceView.js';
import { STEPS } from './syllabusModel.js';

const area = (key, score) => ({ key, name: key.toUpperCase(), weight: 10, score });
const scored = (over = {}) => ({ id: 1, status: 'scored', overall: 92, passThreshold: 79, passed: true, conformant: true, stale: false, aiStatus: 'none', areas: [area('template', 100), area('contact_hours', 80)], findings: [], recommendations: [], ...over });
const f = (id, severity, extra = {}) => ({ id, severity, area: 'template', step: 'plan', ...extra });

test('a run is none, insufficient or scored', () => {
  assert.strictEqual(runState(null), 'none');
  assert.strictEqual(runState(undefined), 'none');
  assert.strictEqual(runState(scored()), 'scored');
  assert.strictEqual(runState(scored({ status: 'insufficient', overall: null })), 'insufficient');
  assert.strictEqual(runState(scored({ overall: null })), 'insufficient'); // never shows a null as a 0%
  assert.strictEqual(runState(scored({ overall: 0 })), 'scored'); // a real zero is still a score
});

test('tone follows the pass line, and no score has no tone', () => {
  assert.strictEqual(tone(79, 79), 'good');
  assert.strictEqual(tone(78, 79), 'warn');
  assert.strictEqual(tone(null, 79), 'none');
  assert.strictEqual(tone(undefined, 79), 'none');
});

test('ring angle is clamped to 0 to 360 degrees', () => {
  assert.strictEqual(ringAngle(50), '180deg');
  assert.strictEqual(ringAngle(150), '360deg');
  assert.strictEqual(ringAngle(-5), '0deg');
  assert.strictEqual(ringAngle(null), '0deg');
});

test('the basis of a check is "Rule-based check" until a model has run', () => {
  assert.strictEqual(basis(scored()).label, 'Rule-based check');
  assert.strictEqual(basis(scored()).kind, 'rule');
  assert.strictEqual(basis(scored({ aiStatus: 'pending' })).kind, 'pending');
  assert.strictEqual(basis(scored({ aiStatus: 'pending' })).label, 'Provisional score');
  const bad = basis(scored({ aiStatus: 'failed' }));
  assert.deepStrictEqual([bad.kind, bad.label], ['unavailable', 'AI unavailable']);
  assert.match(bad.note, /come from the rules/);
  assert.deepStrictEqual([basis(scored({ aiStatus: 'ok' })).kind, basis(scored({ aiStatus: 'ok' })).label], ['ai', 'AI-assisted check']);
  assert.strictEqual(basis(null).kind, 'none');
  assert.strictEqual(listBasis([scored(), null, scored()]), 'Rule-based check');
  assert.strictEqual(listBasis([scored(), scored({ aiStatus: 'ok' })]), 'AI-assisted check');
});

test('blockers stop a submit and warnings do not; only a current run counts warnings', () => {
  const run = scored({ findings: [f('a', 'blocking'), f('b', 'major'), f('c', 'minor'), f('d', 'blocking')] });
  assert.deepStrictEqual(blockersOf(run).map((x) => x.id), ['a', 'd']);
  assert.deepStrictEqual(warningsOf(run).map((x) => x.id), ['b', 'c']);
  assert.strictEqual(warningCount(run), 2);
  assert.strictEqual(warningCount({ ...run, stale: true }), 0);
  assert.strictEqual(warningCount(null), 0);
  assert.deepStrictEqual(blockersOf(null), []);
});

test('the headline matches the state of the run', () => {
  assert.match(headline(null), /Not checked yet/);
  assert.match(headline(scored({ status: 'insufficient', overall: null })), /Not enough written yet/);
  assert.match(headline(scored({ findings: [f('a', 'blocking')] })), /^1 problem stops/);
  assert.match(headline(scored({ findings: [f('a', 'blocking'), f('b', 'blocking')] })), /^2 problems stop/);
  assert.match(headline(scored()), /Meets the standard \(pass line 79%\)/);
  assert.match(headline(scored({ overall: 60 })), /Below the pass line of 79%.*You can still submit/);
});

test('recommendation areas read as names; findings group by area in run order', () => {
  const run = scored({ findings: [f('1', 'minor', { area: 'contact_hours' }), f('2', 'major'), f('3', 'major', { area: 'contact_hours' })] });
  assert.deepStrictEqual(areaNames(run, { areas: ['contact_hours', 'zzz'] }), ['CONTACT_HOURS', 'zzz']);
  assert.deepStrictEqual(groupFindings(run).map((g) => [g.key, g.findings.length]), [['template', 1], ['contact_hours', 2]]);
  assert.deepStrictEqual(groupFindings(scored()), []);
});

test('step labels agree with the builder: the same numbers and titles as the stepper', () => {
  assert.deepStrictEqual(Object.keys(STEP_INFO), STEPS.map((s) => s.key));
  STEPS.forEach((s, i) => { assert.strictEqual(STEP_INFO[s.key].n, i + 1); assert.strictEqual(STEP_INFO[s.key].title, s.title, s.key); });
  assert.strictEqual(stepLabel('plan'), 'Step 3: Learning Plan');
  assert.strictEqual(stepLabel('review'), 'Step 7: Review & Check');
  assert.strictEqual(stepLabel('nope'), '');
});

test('score text and dates are safe on odd input', () => {
  assert.strictEqual(scoreText(scored()), '92%');
  assert.strictEqual(scoreText(scored({ overall: null, status: 'insufficient' })), '—');
  assert.strictEqual(scoreText(null), '—');
  assert.match(when('2026-01-05 10:30:00'), /Jan 5, 2026/);
  assert.strictEqual(when(''), '');
  assert.strictEqual(when('not a date'), '');
});

// ---- the admin's list ----
const run = (overall, extra = {}) => scored({ overall, ...extra });
const row = (id, over = {}) => ({ syllabusId: id, userId: 1, facultyName: 'Ana Cruz', programCode: 'BSIT', programName: 'BS IT', courseCode: 'IT 101', courseTitle: 'Intro', title: 'Intro', status: 'submitted', version: 'v1.0', checkable: true, run: null, ...over });

test('a row is uploaded, unchecked, insufficient or scored, and its button says Check or Re-check', () => {
  assert.strictEqual(rowState(row(1, { checkable: false })), 'uploaded');
  assert.strictEqual(rowState(row(1)), 'unchecked');
  assert.strictEqual(rowState(row(1, { run: run(90) })), 'scored');
  assert.strictEqual(rowState(row(1, { run: run(null, { status: 'insufficient' }) })), 'insufficient');
  assert.strictEqual(actionLabel(row(1)), 'Check');
  assert.strictEqual(actionLabel(row(1, { run: run(90) })), 'Re-check');
  assert.strictEqual(actionLabel(row(1, { checkable: false })), null);
  assert.strictEqual(actionLabel(null), null);
});

test('"Check unchecked" targets only syllabi that have a form and no run', () => {
  const rows = [row(1), row(2, { run: run(90) }), row(3, { checkable: false }), row(4)];
  assert.deepStrictEqual(bulkTargets(rows).map((r) => r.syllabusId), [1, 4]);
  assert.deepStrictEqual(bulkTargets([]), []);
});

test('filters match faculty, program, subject and title in any order, and the needs filters pick the right rows', () => {
  const rows = [
    row(1, { facultyName: 'Ana Cruz', programCode: 'BSIT', courseCode: 'IT 101', courseTitle: 'Intro to Computing', run: run(60) }),
    row(2, { facultyName: 'Ben Reyes', programCode: 'BSIE', programName: 'BS IE', courseCode: 'IE 201', courseTitle: 'Work Study', status: 'approved', run: run(95, { stale: true }) }),
    row(3, { facultyName: 'Ben Reyes', programCode: 'BSIE', courseCode: 'IE 202', courseTitle: 'Ergonomics' }),
    row(4, { facultyName: 'Cy Lim', programCode: '', programName: '', courseCode: 'IT304', courseTitle: 'Data Analytics', checkable: false }),
  ];
  const ids = (f) => filterRows(rows, f).map((r) => r.syllabusId);
  assert.deepStrictEqual(ids({}), [1, 2, 3, 4]);
  assert.deepStrictEqual(ids({ q: 'ben' }), [2, 3]);
  assert.deepStrictEqual(ids({ q: 'bsie work' }), [2]);
  assert.deepStrictEqual(ids({ q: 'COMPUTING it' }), [1]);
  assert.deepStrictEqual(ids({ q: 'nobody' }), []);
  assert.deepStrictEqual(ids({ status: 'approved' }), [2]);
  assert.deepStrictEqual(ids({ needs: 'unchecked' }), [3]); // uploads are not "unchecked": there is nothing to check
  assert.deepStrictEqual(ids({ needs: 'below' }), [1]);
  assert.deepStrictEqual(ids({ needs: 'stale' }), [2]);
  assert.deepStrictEqual(ids({ q: 'ben', needs: 'unchecked' }), [3]);
});

test('rows group by faculty, then program, then subject, each sorted, with a count and an average on the faculty', () => {
  const rows = [
    row(1, { userId: 2, facultyName: 'Ben Reyes', programCode: 'BSIE', programName: 'BS IE', courseCode: 'IE 202', run: run(80) }),
    row(2, { userId: 1, facultyName: 'Ana Cruz', programCode: 'BSIT', courseCode: 'IT 205', run: run(90) }),
    row(3, { userId: 1, facultyName: 'Ana Cruz', programCode: 'BSIT', courseCode: 'IT 101' }),
    row(4, { userId: 1, facultyName: 'Ana Cruz', programCode: 'BSCS', programName: 'BS CS', courseCode: 'CS 100', run: run(70) }),
    row(5, { userId: 2, facultyName: 'Ben Reyes', programCode: '', programName: '', courseCode: 'IT304', checkable: false }),
  ];
  const before = JSON.stringify(rows);
  const g = groupByFacultyProgram(rows);
  assert.strictEqual(JSON.stringify(rows), before); // never mutates
  assert.deepStrictEqual(g.map((f) => f.facultyName), ['Ana Cruz', 'Ben Reyes']);
  const ana = g[0];
  assert.deepStrictEqual([ana.count, ana.scored, ana.average], [3, 2, 80]); // (90 + 70) / 2; the unchecked one is not counted
  assert.deepStrictEqual(ana.programs.map((p) => p.code), ['BSCS', 'BSIT']);
  assert.deepStrictEqual(ana.programs[1].rows.map((r) => r.courseCode), ['IT 101', 'IT 205']);
  const ben = g[1];
  assert.deepStrictEqual(ben.programs.map((p) => [p.code, p.name]), [['BSIE', 'BS IE'], ['', 'No program']]); // no program sorts last
  assert.deepStrictEqual([ben.count, ben.scored, ben.average], [2, 1, 80]);
  assert.deepStrictEqual(groupByFacultyProgram([]), []);
});

test('two faculty with the same name stay separate', () => {
  const g = groupByFacultyProgram([row(1, { userId: 1, facultyName: 'Sam Lee' }), row(2, { userId: 2, facultyName: 'Sam Lee' })]);
  assert.strictEqual(g.length, 2);
});

test('a run is stamped with its day and its time, and an unreadable date gives nothing', () => {
  assert.match(when('2026-01-05 15:42:00'), /Jan 5, 2026/);
  assert.match(timeOf('2026-01-05 15:42:00'), /^3:42\s?PM$/);
  assert.match(stamp('2026-01-05 15:42:00'), /^Jan 5, 2026, 3:42\s?PM$/);
  assert.strictEqual(timeOf(''), '');
  assert.strictEqual(timeOf('not a date'), '');
  assert.strictEqual(stamp(null), '');
});

test('an approved syllabus is locked: it cannot be checked again, whatever else is true of it', () => {
  assert.strictEqual(isLocked({ status: 'approved' }), true);
  ['submitted', 'under_review', 'for_revision', 'rejected', 'draft'].forEach((st) => assert.strictEqual(isLocked({ status: st }), false, st));
  assert.strictEqual(isLocked(null), false);
});

test('the checker queue is the unchecked syllabi that are not approved, uploaded files included', () => {
  assert.strictEqual(needsCheck({ status: 'submitted', run: null, checkable: true }), true);
  assert.strictEqual(needsCheck({ status: 'for_revision', run: null, checkable: false }), true); // an uploaded file waits too
  assert.strictEqual(needsCheck({ status: 'submitted', run: { id: 1, stale: false } }), false); // checked once: it is in the history
  assert.strictEqual(needsCheck({ status: 'submitted', run: { id: 1, stale: true } }), true); // a new version was submitted since: it needs a new check
  assert.strictEqual(needsCheck({ status: 'approved', run: null }), false); // approved: in the Repository
  assert.strictEqual(needsCheck(null), false);
});

test('only a syllabus with a form can be checked now; an uploaded file waits for template matching', () => {
  assert.strictEqual(canCheckNow({ checkable: true }), true);
  assert.strictEqual(canCheckNow({ checkable: false }), false);
  assert.strictEqual(canCheckNow(null), false);
});

test('a date range becomes Philippine-day instants: the start of the first day up to the start of the day after the last', () => {
  const r = rangeToInstants('2026-03-02', '2026-03-02');
  assert.strictEqual(r.from, '2026-03-01T16:00:00.000Z'); // midnight in Manila, whatever the computer's own time zone
  assert.strictEqual(r.to, '2026-03-02T16:00:00.000Z');
  assert.strictEqual(new Date(r.to) - new Date(r.from), 24 * 3600 * 1000);
  assert.deepStrictEqual(rangeToInstants('', ''), { from: null, to: null });
  assert.strictEqual(rangeToInstants('2026-03-02', '').to, null);
  assert.strictEqual(rangeToInstants('', '2026-03-02').from, null);
  assert.strictEqual(new Date(rangeToInstants('2026-02-27', '2026-02-28').to).getDate(), 1); // the day after the 28th crosses the month
});

test('an invalid range has no instants: an impossible date, or a range that ends before it starts', () => {
  assert.strictEqual(rangeToInstants('2026-02-31', ''), null);
  assert.strictEqual(rangeToInstants('abc', ''), null);
  assert.strictEqual(rangeToInstants('2026-03-05', '2026-03-01'), null);
});

test('the range is named for the admin: a span, one day, or one open side', () => {
  assert.strictEqual(rangeLabel('2026-10-01', '2026-10-14'), 'Oct 1, 2026 – Oct 14, 2026');
  assert.strictEqual(rangeLabel('2026-10-14', '2026-10-14'), 'Oct 14, 2026');
  assert.strictEqual(rangeLabel('2026-10-01', ''), 'Since Oct 1, 2026');
  assert.strictEqual(rangeLabel('', '2026-10-14'), 'Until Oct 14, 2026');
  assert.strictEqual(rangeLabel('', ''), '');
});

import { targetOf, targetsIn, selectorOf } from './complianceView.js';

test('a finding path points at just the place it is about, so a link can highlight that', () => {
  assert.deepEqual(targetOf('plan[6].ilos[0]'), { row: 6 });
  assert.deepEqual(targetOf('plan[2].activities'), { row: 2 });
  assert.deepEqual(targetOf('reqs[4]'), { req: 4 });
  assert.deepEqual(targetOf('refs.books.items[1]'), { ref: 'books', item: 1 });
  assert.deepEqual(targetOf('refs.books'), { ref: 'books' });
  assert.deepEqual(targetOf('grading.rows[0]'), { grade: 0 });
  assert.deepEqual(targetOf('description'), { desc: true });
  assert.equal(targetOf('refs'), null);
  assert.equal(targetOf(''), null);
  // only the targets that sit in the step the link opens, once each
  assert.deepEqual(targetsIn('plan', ['plan[6].ilos[0]', 'plan[6].tasks', 'plan[10]', 'reqs[0]', 'description']), [{ row: 6 }, { row: 10 }]);
  assert.deepEqual(targetsIn('reqs', ['plan[6]', 'reqs[4]']), [{ req: 4 }]);
  assert.equal(selectorOf({ row: 6 }), '[data-plan-row="6"]');
  assert.equal(selectorOf({ ref: 'online', item: 2 }), '[data-ref-item="online:2"]');
  assert.equal(selectorOf({ ref: 'online' }), '[data-ref-group="online"]');
  assert.equal(selectorOf({ desc: true }), '[data-desc]');
});
