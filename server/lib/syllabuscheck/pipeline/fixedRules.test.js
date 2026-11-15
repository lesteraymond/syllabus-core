'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../../compliance/fixtures');
const { extract } = require('./extract');
const { check } = require('./fixedRules');

const YEAR = 2026;
const LEVELS = ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values'];
// F.good() made to follow every re-plan rule: fixed CLO levels, Week 1 orientation, two activity options per topic week, a value every week, APA references.
function conforming() {
  const c = F.good();
  c.clos.forEach((clo, i) => { clo.level = LEVELS[i]; });
  c.plan[0].contents = 'Course orientation: vision, mission, course outcomes, requirements and grading system';
  c.plan[0].ilos[0].text = 'Explain the course outcomes, requirements and grading policies';
  c.plan.forEach(row => {
    if (row.kind === 'lesson') row.activities = `- Lecture-discussion on week ${row.week}\n- Option: guided lab exercise or video walkthrough`;
    row.values = row.values || 'Humility';
  });
  c.refs = {
    books: { na: false, items: [{ id: 'b1', t: 'Balti, H., & Galloway, A. (2021). Job ready Java. John Wiley & Sons.' }] },
    program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] },
  };
  return c;
}
const rulesOf = result => result.findings.map(f => f.rule);
const run = content => check(extract(content), { year: YEAR });

test('a syllabus that follows every rule has no findings', () => {
  const result = run(conforming());
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.summary, { finding: 0, review: 0 });
});

test('CLOs: exactly 4, fixed level by number (with the mechanical fix), at least one PO and one EGA, no unknown tags, each reached by an ILO', () => {
  const c = conforming();
  c.clos[1].level = 'Introductory';
  c.clos[2].pos = [];
  c.clos[3].egas = [9];
  c.plan.forEach(row => row.ilos.forEach(ilo => { ilo.tags = ilo.tags.filter(t => t !== 'clo:c4'); if (row.kind === 'lesson' && !ilo.tags.length) ilo.tags = ['clo:c1']; }));
  const result = run(c);
  const label = result.findings.find(f => f.rule === 'CLO-LEVEL-LABEL');
  assert.equal(label.where.clo, 2);
  assert.deepEqual(label.fix, { level: 'Enabling' });
  assert.equal(result.findings.find(f => f.rule === 'CLO-PO-TAG').where.clo, 3);
  assert.equal(result.findings.find(f => f.rule === 'CLO-EGA-TAG').where.clo, 4);
  assert.match(result.findings.find(f => f.rule === 'CLO-UNKNOWN-TAG').message, /EGA 9/);
  assert.equal(result.findings.find(f => f.rule === 'CLO-COVERAGE').where.clo, 4);

  const five = conforming();
  five.clos.push({ ...five.clos[0], id: 'c5' });
  assert.ok(rulesOf(run(five)).includes('CLO-COUNT'));
});

test('Week 1 must be orientation; Week 2 must start the first topic on its own row', () => {
  const c = conforming();
  c.plan[0].contents = 'Introduction to Java syntax';
  c.plan[0].ilos[0].text = 'Write a Java statement';
  assert.ok(rulesOf(run(c)).includes('WEEK1-ORIENTATION'));

  const merged = conforming();
  merged.plan[0].week = '1-2';
  merged.plan.splice(1, 1);
  const rules = rulesOf(run(merged));
  assert.ok(rules.includes('WEEK2-FIRST-TOPIC'));
  assert.ok(!rules.includes('WEEK1-ORIENTATION'));

  const missing = conforming();
  missing.plan.splice(1, 1);
  assert.ok(rulesOf(run(missing)).includes('WEEK2-FIRST-TOPIC'));
});

test('topic weeks: content first, an ILO aligned to a CLO, at least 2 activity options, assessment tasks', () => {
  const c = conforming();
  c.plan[2].contents = '';
  c.plan[3].ilos[0].tags = [];
  c.plan[4].activities = 'Lecture only';
  c.plan[6].tasks = '';
  const found = run(c).findings;
  assert.equal(found.find(f => f.rule === 'CONTENT-MISSING').where.week, '3');
  assert.equal(found.find(f => f.rule === 'ILO-CLO-TAG').where.week, '4');
  assert.equal(found.find(f => f.rule === 'ACTIVITY-OPTIONS').where.week, '5');
  assert.equal(found.find(f => f.rule === 'TASKS-MISSING').where.week, '7');
});

test('orientation and exam weeks need no activity options or tasks, but every week needs a core value', () => {
  const c = conforming();
  c.plan[0].activities = ''; c.plan[0].tasks = '';
  assert.deepEqual(run(c).findings, []);
  c.plan[0].values = '';
  c.plan[5].values = 'Be kind';
  const values = run(c).findings.filter(f => f.rule === 'VALUES-WEEKLY');
  assert.deepEqual(values.map(f => f.where.week), ['1', '6']);
  assert.match(values[1].message, /exact name/);
});

test('references: APA 7th format is a finding, older than 5 years goes to review (never a finding), none at all is a finding', () => {
  const c = conforming();
  c.refs.books.items.push({ id: 'b2', t: 'Oracle (2023). The Java tutorials.' }, { id: 'b3', t: 'Knuth, D. E. (1997). The art of computer programming. Addison-Wesley.' });
  const refs = run(c).findings.filter(f => f.area === 'references');
  assert.deepEqual(refs.map(f => [f.rule, f.severity, f.where.ref]), [['REF-APA', 'finding', 'b2'], ['REF-RECENCY', 'review', 'b3']]);

  const boundary = conforming();
  boundary.refs.books.items[0].t = 'Balti, H., & Galloway, A. (2021). Job ready Java. John Wiley & Sons.';
  assert.deepEqual(run(boundary).findings, [], 'exactly 5 years old is still recent');

  const none = conforming();
  none.refs = { books: { na: true, items: [] } };
  assert.deepEqual(rulesOf(run(none)), ['REF-NONE']);
});

test('findings are ordered top-down by the dependency chain', () => {
  const c = conforming();
  c.plan.forEach(row => { row.values = ''; });
  c.clos[0].level = 'Enabling';
  c.plan[2].contents = '';
  const layers = run(c).findings.map(f => f.layer);
  assert.deepEqual(layers, [...layers].sort((a, b) => a - b));
  assert.equal(run(c).findings[0].rule, 'CLO-LEVEL-LABEL');
});

test('copied ILOs: a near copy within a week and the same text in a later week are findings; the first occurrence stays (DSP re-run, 2026-11-15)', () => {
  const c = conforming();
  c.plan[2].ilos.push({ id: 'i3b', text: 'Explain topic number 3 clearly with examples', tags: ['clo:c3'] }); // a near copy of "Explain topic number 3 clearly"
  c.plan[6].ilos[0].text = c.plan[3].ilos[0].text.toUpperCase() + '.'; // Week 7 repeats Week 4 (case and punctuation ignored)
  c.plan[7].ilos[0].text = c.plan[3].ilos[0].text;                     // Week 8 too: still named against Week 4, the first
  const dup = run(c).findings.filter(f => f.rule === 'ILO-DUPLICATE');
  assert.deepEqual(dup.map(f => [f.where.week, f.where.ilo]), [['3', 'i3b'], ['7', 'i7'], ['8', 'i8']]);
  assert.match(dup[0].message, /Week 3 ILO 2 repeats ILO 1 of the same week/);
  assert.match(dup[1].message, /repeats an ILO of Week 4/);
  assert.match(dup[2].message, /repeats an ILO of Week 4/);
  assert.equal(require('./judge').fieldKeyOfFinding(dup[0]), 'ilo:i3b', 'the plan rewrites the copy');
});

test('the same syllabus always gives the same findings', () => {
  const c = F.bad();
  assert.deepEqual(run(c), run(structuredClone(c)));
});
