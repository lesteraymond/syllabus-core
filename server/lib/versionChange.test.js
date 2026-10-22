// Run: npm test (from the project root). What counts as a change between two versions of a form syllabus.
const test = require('node:test');
const assert = require('node:assert');
const F = require('./compliance/fixtures');
const { changedSections, describeChanges, wordDelta } = require('./versionChange');

const base = () => F.good();
const edit = (fn) => { const c = base(); fn(c); return c; };

test('the same syllabus is unchanged, whatever the system filled in around it', () => {
  assert.deepStrictEqual(changedSections(base(), base()), []);
  const b = edit((c) => { c.catalog.savedAt = '2030-01-01'; c.catalog.program.name = 'A new name'; c.clos[0].statement = 'Rewritten by an admin'; c.signoff = { prepared: 'x' }; c.meta.title = 'Renamed in the catalog'; c.meta.code = 'IT 999'; });
  assert.deepStrictEqual(changedSections(base(), b), [], 'catalog, outcomes, sign-off and the catalog-supplied code and title are not the faculty member\'s');
});

test('syllabus-owned outcome and CLO edits count as a revision while adoption alone does not', () => {
  const before = base();
  const own = { ...before, outcomes: { vision: before.catalog.institution.vision, mission: before.catalog.institution.mission, egas: before.catalog.program.egas || before.catalog.institution.egas || [], pos: before.catalog.program.pos } };
  assert.deepStrictEqual(changedSections(before, own), []);
  const edited = JSON.parse(JSON.stringify(own));
  edited.outcomes.vision = 'The faculty revised the vision';
  assert.deepStrictEqual(changedSections(own, edited).map(row => row.key), ['outcomes']);
  const cloEdit = JSON.parse(JSON.stringify(own));
  cloEdit.clos[0].statement = 'The faculty revised a CLO';
  assert.deepStrictEqual(changedSections(own, cloEdit).map(row => row.key), ['outcomes']);
});

test('spacing, blank lines and row ids are not changes', () => {
  const b = edit((c) => {
    c.description[0].t = '  ' + c.description[0].t.replace(/ /g, '   ') + '\n\n';
    c.plan.forEach((r, i) => { r.id = 'renamed-' + i; r.ilos.forEach((il) => { il.id = 'x' + Math.random(); il.text = ' ' + il.text + '  '; }); r.contents = r.contents + '\n'; });
  });
  assert.deepStrictEqual(changedSections(base(), b), []);
});

test('a single letter or word is a change, and the result says how small it is', () => {
  const typo = edit((c) => { c.description[0].t = c.description[0].t.replace('word3', 'wrod3'); });
  const r = changedSections(base(), typo);
  assert.deepStrictEqual(r.map((x) => x.key), ['description']);
  assert.strictEqual(r[0].words, 2); // one word out, one word in
  const added = edit((c) => { c.description[0].t += ' extra'; });
  assert.strictEqual(changedSections(base(), added)[0].words, 1);
  assert.strictEqual(describeChanges(changedSections(base(), added)), 'Course description (1 word)');
});

test('each section is reported on its own, with the learning plan counted in weeks', () => {
  const b = edit((c) => {
    c.plan[0].contents = 'A different topic'; c.plan[2].tasks = '- A new quiz'; c.plan.pop();
    c.grading.rows[0].pct = 55; c.grading.rows[1].pct = 45;
    c.reqs.push({ id: 'q9', t: 'A new requirement' });
    c.meta.lecture = '3';
    c.refs.books.items.pop();
  });
  const r = changedSections(base(), b);
  assert.deepStrictEqual(r.map((x) => x.key), ['meta', 'plan', 'reqs', 'refs', 'grading']);
  assert.strictEqual(r.find((x) => x.key === 'plan').rows, 3); // two rows changed in place, one removed
  assert.match(describeChanges(r), /Learning plan \(3 weeks\)/);
  assert.match(describeChanges(r), /Course information/);
});

test('choosing another course is a change; a missing section reads as empty and does not throw', () => {
  assert.deepStrictEqual(changedSections(base(), edit((c) => { c.meta.courseId = 99; })).map((x) => x.key), ['meta']);
  assert.deepStrictEqual(changedSections({}, {}), []);
  assert.deepStrictEqual(changedSections(null, undefined), []);
  assert.deepStrictEqual(changedSections({ reqs: [] }, { reqs: [{ id: 'a', t: 'x' }] }).map((x) => x.key), ['reqs']);
});

test('word counts: a moved word is not counted twice, and repeats are counted', () => {
  assert.strictEqual(wordDelta('a b c', 'c b a'), 0);
  assert.strictEqual(wordDelta('a b', 'a b b'), 1);
  assert.strictEqual(wordDelta({ x: 'one two' }, { x: 'one three' }), 2);
});

test('a changed number counts, so a new grading split shows how much changed', () => {
  assert.strictEqual(wordDelta({ pct: 60 }, { pct: 55 }), 2);
  const b = edit((c) => { c.grading.rows[0].pct = 55; c.grading.rows[1].pct = 45; });
  assert.strictEqual(describeChanges(changedSections(base(), b)), 'Grading system (4 words)');
});
