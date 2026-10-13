// Run: npm test (from the project root)
const test = require('node:test');
const assert = require('node:assert');
const { evaluate, CHECKS } = require('./rules');
const standard = require('./standard-v4.json');
const F = require('./fixtures');

const run = (content, ctx = F.ctx()) => evaluate(content, standard, ctx);
const ids = (r) => r.findings.map((f) => f.ruleId);
const area = (r, key) => r.areas.find((a) => a.key === key);
const blocking = (r) => r.conformance.failed.map((f) => f.ruleId);

test('the standard is well formed: unique rule ids, known areas, severities and checks, weights that total 100', () => {
  const seen = new Set();
  standard.rules.forEach((r) => {
    assert.ok(!seen.has(r.id), 'duplicate ' + r.id);
    seen.add(r.id);
    assert.ok(standard.areas.some((a) => a.key === r.area), r.id + ' area');
    assert.ok(['blocking', 'major', 'minor'].includes(r.severity), r.id + ' severity');
    assert.ok(typeof CHECKS[r.check] === 'function', r.id + ' uses a check that is not implemented: ' + r.check);
    assert.ok(r.weight > 0 && r.message && r.step && r.params, r.id + ' fields');
  });
  assert.strictEqual(standard.areas.reduce((s, a) => s + a.weight, 0), 100);
  assert.deepStrictEqual(standard.areas.map((a) => a.key), ['template', 'completeness', 'co_po', 'assessment', 'contact_hours', 'reference_currency']);
  standard.areas.forEach((a) => assert.ok(standard.rules.some((r) => r.area === a.key), a.key + ' has no rules'));
  assert.ok(standard.passThreshold > 0 && standard.passThreshold <= 100);
});

test('a conforming syllabus scores 100 everywhere, has no findings, and passes', () => {
  const r = run(F.good());
  assert.strictEqual(r.status, 'scored');
  assert.strictEqual(r.overall, 100);
  assert.strictEqual(r.band, 'Excellent');
  assert.strictEqual(r.passed, true);
  assert.strictEqual(r.conformance.ok, true);
  assert.deepStrictEqual(r.findings, []);
  r.areas.forEach((a) => assert.strictEqual(a.score, 100, a.key));
  assert.deepStrictEqual(r.contact, { lecture: 2, lab: 1, hoursPerWeek: 5, termHours: 90, weeksPlanned: 18, weeksExpected: 18 });
});

test('a changed vision blocks: the stored copy no longer equals the catalog', () => {
  const ctx = F.ctx();
  ctx.catalog.institution.vision = 'A different vision.';
  const r = run(F.good(), ctx);
  assert.deepStrictEqual(blocking(r), ['T-09']);
  assert.strictEqual(r.passed, false);
  assert.match(r.findings[0].message, /not the school's current vision/);
  assert.strictEqual(r.findings[0].evidence.field, 'vision');
  const mission = F.ctx();
  mission.catalog.institution.mission.items.push('a new line');
  assert.deepStrictEqual(blocking(run(F.good(), mission)), ['T-10']);
  const eg = F.ctx();
  eg.catalog.program.egas[0].name = 'Renamed';
  assert.deepStrictEqual(blocking(run(F.good(), eg)), ['T-11']);
  const po = F.ctx();
  po.catalog.program.pos[0].text = 'Edited outcome';
  assert.deepStrictEqual(blocking(run(F.good(), po)), ['T-12']);
});

test('a draft (no stored catalog copy), or no live catalog, skips the catalog rules instead of failing them', () => {
  const draft = F.good();
  delete draft.catalog;
  assert.ok(!ids(run(draft)).some((id) => /^T-(09|10|11|12)$/.test(id)));
  assert.ok(!ids(run(F.good(), { year: F.YEAR })).some((id) => /^T-(09|10|11|12)$/.test(id)));
});

test('a deleted CLO tag blocks, and so does a tag whose CLO was removed', () => {
  const c = F.good();
  c.plan[0].ilos[0].tags = [];
  const r = run(c);
  assert.deepStrictEqual(blocking(r), ['T-13']);
  assert.strictEqual(r.conformance.failed[0].path, 'plan[0].ilos[0]');
  assert.match(r.conformance.failed[0].message, /Week 1, ILO1 has no CLO tag/);
  assert.strictEqual(r.conformance.failed[0].step, 'plan');

  const gone = F.good();
  gone.clos = gone.clos.filter((k) => k.id !== 'c1');
  const r2 = run(gone);
  assert.ok(blocking(r2).includes('T-14'));
  assert.ok(r2.findings.some((f) => f.ruleId === 'P-02' || f.ruleId === 'T-14'));
  assert.ok(r2.conformance.failed.every((f) => f.severity === 'blocking'));
});

test('grading that totals 90 blocks', () => {
  const c = F.good();
  c.grading.rows[0].pct = 50;
  const r = run(c);
  assert.deepStrictEqual(blocking(r), ['T-24']);
  assert.match(r.conformance.failed[0].message, /total 90%, not 100%/);
  assert.deepStrictEqual([r.conformance.failed[0].evidence.total, r.conformance.failed[0].evidence.need], [90, 100]);
  assert.ok(area(r, 'template').score < 100);
});

test('a missing exam row only warns, and names the term', () => {
  const c = F.good();
  c.plan = c.plan.filter((r) => !/MIDTERM/.test(r.contents));
  const r = run(c);
  assert.strictEqual(r.conformance.ok, true);
  assert.strictEqual(r.passed, true === (r.overall >= 79));
  const f = r.findings.find((x) => x.ruleId === 'A-03');
  assert.strictEqual(f.severity, 'major');
  assert.strictEqual(f.message, 'There is no Midterm examination row in the Learning Plan.');
  assert.ok(area(r, 'assessment').score < 100);
  assert.ok(r.findings.some((x) => x.ruleId === 'H-02')); // and a week is missing too
});

test('a non-conforming syllabus fails conformance and scores below the pass line, with a finding per problem', () => {
  const r = run(F.bad());
  assert.strictEqual(r.status, 'scored');
  assert.strictEqual(r.conformance.ok, false);
  assert.strictEqual(r.passed, false);
  assert.ok(r.overall < standard.passThreshold);
  const got = new Set(ids(r));
  ['T-13', 'T-14', 'T-16', 'T-18', 'T-19', 'T-20', 'T-21', 'T-22', 'T-24', 'C-01', 'C-02', 'P-01', 'P-02', 'P-05', 'A-01', 'A-02', 'A-03', 'A-04', 'H-02', 'H-03', 'H-04', 'R-02', 'R-03'].forEach((id) => assert.ok(got.has(id), 'missing ' + id));
  assert.deepStrictEqual(r.conformance.failed.map((f) => f.id), r.findings.filter((f) => f.severity === 'blocking').map((f) => f.id));
  assert.ok(r.findings.every((f) => !/[{}]/.test(f.message)), 'every message placeholder is filled in');
});

test('every finding has the documented shape, a rule that exists, and a unique id', () => {
  const r = run(F.bad());
  const seen = new Set();
  r.findings.forEach((f) => {
    assert.deepStrictEqual(Object.keys(f).sort(), ['area', 'evidence', 'id', 'message', 'path', 'ruleId', 'severity', 'source', 'step']);
    const rule = standard.rules.find((x) => x.id === f.ruleId);
    assert.ok(rule);
    assert.strictEqual(f.severity, rule.severity);
    assert.strictEqual(f.area, rule.area);
    assert.strictEqual(f.step, rule.step);
    assert.strictEqual(f.source, 'rule');
    assert.strictEqual(typeof f.evidence, 'object');
    assert.ok(!seen.has(f.id), 'duplicate ' + f.id);
    seen.add(f.id);
  });
});

test('a nearly empty syllabus is "not enough content", never a row of zeros', () => {
  const r = run(F.empty());
  assert.strictEqual(r.status, 'insufficient');
  assert.strictEqual(r.overall, null);
  assert.strictEqual(r.band, null);
  assert.strictEqual(r.passed, false);
  r.areas.forEach((a) => assert.strictEqual(a.score, null, a.key));
  assert.strictEqual(r.conformance.ok, false); // the required fields are still reported
  const two = F.empty();
  two.reqs = [{ id: 'q', t: 'Attendance' }];
  two.grading.rows = [{ label: 'Examination', pct: 100 }];
  assert.strictEqual(run(two).status, 'insufficient');
  two.refs.books.items = [{ id: 'b', t: 'A book (2024).' }];
  assert.strictEqual(run(two).status, 'scored');
});

test('the same content always gives the same result, and the input is never changed', () => {
  const content = F.bad();
  const before = JSON.stringify(content);
  const a = run(content);
  const b = run(JSON.parse(before));
  assert.deepStrictEqual(a, b);
  assert.strictEqual(JSON.stringify(content), before);
});

test('scores follow the rule weights: a heavy failure costs more than a light one', () => {
  const heavy = F.good();
  heavy.grading.rows[0].pct = 50; // T-24, weight 4, blocking
  const light = F.good();
  light.plan.reverse(); // T-18, weight 1, minor
  assert.ok(area(run(heavy), 'template').score < area(run(light), 'template').score);
  assert.strictEqual(run(light).conformance.ok, true);
});

test('editing the content changes the score', () => {
  const c = F.good();
  c.plan = c.plan.filter((r) => r.week !== '4' && r.week !== '5');
  const r = run(c);
  assert.ok(area(r, 'contact_hours').score < 100);
  assert.strictEqual(r.contact.weeksPlanned, 16);
  assert.strictEqual(r.conformance.ok, true);
  const w = r.findings.find((f) => f.ruleId === 'H-02');
  assert.strictEqual(w.severity, 'major');
  assert.deepStrictEqual([w.evidence.planned, w.evidence.expected, w.evidence.termHours], [16, 18, 90]);
  const worse = F.good();
  worse.plan.filter((x) => x.kind === 'lesson').slice(0, 8).forEach((x) => { x.tasks = ''; x.activities = ''; });
  assert.ok(run(worse).overall < 100);
});

test('CLO conventions: a PO whose EGA is not tagged, and tags out of order, are reported', () => {
  const c = F.good();
  c.clos[0].egas = [1]; // PO 2 maps to EGA 2, which is no longer tagged
  const r = run(c);
  const f = r.findings.find((x) => x.ruleId === 'P-03');
  assert.strictEqual(f.message, 'CLO 1 is tagged PO 2, which maps to EGA 2, but EGA 2 is not tagged.');
  assert.strictEqual(r.conformance.ok, true);
  const o = F.good();
  o.clos[1].pos = [2, 1];
  assert.ok(ids(run(o)).includes('P-04'));
  const u = F.good();
  u.clos[2].egas = [1, 2, 9];
  assert.ok(blocking(run(u)).includes('P-01')); // EGA 9 is not in the program
});

test('requirements, reference groups and the grading formula', () => {
  const c = F.good();
  c.reqs[0].t = '1. Class attendance';
  c.refs.electronics = { na: false, items: [] };
  const r = run(c);
  assert.ok(ids(r).includes('T-20'));
  assert.deepStrictEqual(blocking(r), ['T-21']);
  const g = F.good();
  g.grading.override = { on: true, term: 'Term Grade = CS (60%)', final: 'Final Rating = Prelim Grade + Final Grade' };
  const rg = run(g);
  const wording = rg.findings.filter((x) => x.ruleId === 'T-26');
  assert.deepStrictEqual(wording.map((x) => x.message), ['The Term Grade formula does not mention Examination.', 'The Final Rating formula does not mention Midterm Grade.']);
  g.grading.override = { on: true, term: '', final: ' ' };
  assert.deepStrictEqual(blocking(run(g)), ['T-25']);
});

test('weeks: a gap, an out-of-range week and an overlap are each reported', () => {
  const c = F.good();
  c.plan[0].week = '1, 30';
  c.plan[1].week = '1';
  const ruleIds = ids(run(c));
  assert.ok(ruleIds.includes('H-03') && ruleIds.includes('H-04'));
  assert.ok(ruleIds.includes('H-02')); // week 2 is no longer planned
});

test('reference age is measured from the school year; without a year it is not judged', () => {
  const c = F.good();
  c.refs.books.items.push({ id: 'old', t: 'Old Book (2012). Publisher.' });
  const r = run(c);
  const old = r.findings.find((f) => f.ruleId === 'R-03');
  assert.deepStrictEqual([old.evidence.year, old.evidence.age, old.evidence.limit], [2012, 14, 10]);
  assert.strictEqual(r.conformance.ok, true);
  assert.ok(!ids(run(c, { catalog: F.catalog() })).includes('R-03'));
  assert.ok(!ids(run(c, { ...F.ctx(), year: 2022 })).includes('R-03')); // 2012 is 10 years before 2022
});

test('the sign-off check only fails on a missing preparer or names entered by hand', () => {
  assert.ok(!ids(run(F.good())).includes('T-27'));
  assert.ok(!ids(run(F.good(), { ...F.ctx(), preparedBy: 'Fay F' })).includes('T-27'));
  assert.ok(ids(run(F.good(), { ...F.ctx(), preparedBy: ' ' })).includes('T-27'));
  const c = F.good();
  c.signoff = { checkedBy: 'Someone' };
  assert.match(run(c).findings.find((f) => f.ruleId === 'T-27').message, /names were entered by hand/);
});

test('a missing section or plan column is named; odd input never throws', () => {
  const c = F.good();
  delete c.refs;
  delete c.grading;
  delete c.plan[2].tasks;
  const r = run(c);
  assert.ok(r.conformance.failed.some((f) => f.ruleId === 'T-15' && f.path === 'plan[2]' && /Suggested Assessment Tasks/.test(f.message)));
  assert.ok(r.conformance.failed.some((f) => f.ruleId === 'T-21'));
  assert.ok(r.conformance.failed.some((f) => f.ruleId === 'T-23'));
  [null, undefined, {}, { meta: 5, plan: 'x', clos: {}, refs: [] }, { plan: [null, 3, { kind: 'lesson' }] }].forEach((x) => assert.doesNotThrow(() => run(x)));
});

test('an unusable unit count is flagged and no hours are computed', () => {
  const c = F.good();
  c.meta.lecture = '0';
  c.meta.lab = '0';
  const r = run(c);
  assert.ok(ids(r).includes('H-01'));
  assert.strictEqual(r.contact.termHours, null);
});
