'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./fixtures');
const standard = require('./standard-v4.json');
const { evaluate } = require('./rules');
const ops = require('./formOps');
const { deterministic } = require('./fixes');

const check = (c) => evaluate(c, standard, { year: 2026 });
const apply = (c, list) => list.forEach((s) => { assert.ok(ops.holds(c, s.expect), s.label + ' should hold'); assert.ok(ops.applyOps(c, s.ops), s.label + ' should apply'); });
const fixOnce = (c) => { const r = check(c); const s = deterministic(c, r.findings, standard); apply(c, s); return { before: r, fixes: s }; };

test('grading that does not total 100 is scaled to 100, and the rule passes afterwards', () => {
  const c = F.good();
  c.grading.rows = [{ id: 'g1', label: 'Class Standing', pct: 60 }, { id: 'g2', label: 'Examination', pct: 50 }];
  const { before, fixes } = fixOnce(c);
  assert.ok(before.findings.some((f) => f.ruleId === 'T-24'));
  const g = fixes.find((x) => x.kind === 'grading');
  assert.match(g.changes[0].before, /= 110%/);
  assert.match(g.changes[0].after, /= 100%/);
  assert.equal(c.grading.rows.reduce((s, r) => s + r.pct, 0), 100);
  assert.ok(!check(c).findings.some((f) => f.ruleId === 'T-24'));
});

test('components with 0% total share the 100 equally', () => {
  const c = F.good();
  c.grading.rows = [{ id: 'g1', label: 'A', pct: 0 }, { id: 'g2', label: 'B', pct: 0 }, { id: 'g3', label: 'C', pct: 0 }];
  fixOnce(c);
  assert.deepEqual(c.grading.rows.map((r) => r.pct).sort(), [33, 33, 34]);
});

test('a typed requirement number is removed', () => {
  const c = F.good();
  c.reqs[0].t = '1. Class attendance';
  const { fixes } = fixOnce(c);
  assert.equal(fixes.find((x) => x.rules.includes('T-20')).changes[0].after, 'Class attendance');
  assert.equal(c.reqs[0].t, 'Class attendance');
});

test('a missing examination row is added at its week, and the rule passes afterwards', () => {
  const c = F.good();
  c.plan = c.plan.filter((r) => !(r.kind === 'exam' && /FINAL/i.test(r.contents)));
  const { before } = fixOnce(c);
  assert.ok(before.findings.some((f) => f.ruleId === 'A-03'));
  const exam = c.plan.find((r) => /FINAL/i.test(r.contents));
  assert.equal(exam.kind, 'exam');
  assert.equal(exam.week, '18');
  assert.ok(!check(c).findings.some((f) => f.ruleId === 'A-03'));
});

test('rows out of week order are sorted, and an empty ILO before a filled one is removed', () => {
  const c = F.good();
  const i = c.plan.findIndex((r) => r.kind === 'lesson');
  c.plan[i].ilos.unshift({ id: 'blank1', text: '', tags: [] });
  [c.plan[0], c.plan[1]] = [c.plan[1], c.plan[0]];
  const before = check(c);
  assert.ok(before.findings.some((f) => f.ruleId === 'T-17'));
  assert.ok(before.findings.some((f) => f.ruleId === 'T-18'));
  fixOnce(c);
  const after = check(c).findings.map((f) => f.ruleId);
  assert.ok(!after.includes('T-17') && !after.includes('T-18'));
});

test('a clean form gets no fixes', () => {
  const c = F.good();
  assert.deepEqual(deterministic(c, check(c).findings, standard), []);
});

test('every suggestion has a stable id, a label, what it covers and what it changes', () => {
  const c = F.good();
  c.grading.rows[0].pct = 70;
  const a = deterministic(c, check(c).findings, standard);
  const b = deterministic(c, check(c).findings, standard);
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
  a.forEach((x) => { assert.match(x.id, /^[0-9a-f]{12}$/); assert.ok(x.label && x.covers.length && x.changes.length && x.ops.length); });
});

test('the vision, mission and graduate attributes are set to the LCUP wording, and T-28, T-29 and T-30 pass afterwards', () => {
  const c = F.good();
  c.outcomes = {
    vision: 'A premier institution of technology-driven, values-centered education.',
    mission: { lead: 'The college commits itself to:', items: ['Teach well.'] },
    egas: standard.constants.institution.egas.map((e) => ({ no: e.no, name: e.no === 2 ? 'Professional' : e.name, short: e.name })),
  };
  const before = check(c).findings.map((f) => f.ruleId);
  ['T-28', 'T-29', 'T-30'].forEach((id) => assert.ok(before.includes(id), id + ' was found'));
  const fixes = deterministic(c, check(c).findings, standard);
  assert.deepEqual(fixes.filter((x) => x.kind === 'institution').map((x) => x.label), ['Vision', 'Mission', 'Graduate attributes']);
  apply(c, fixes);
  const after = check(c).findings.map((f) => f.ruleId);
  ['T-28', 'T-29', 'T-30'].forEach((id) => assert.ok(!after.includes(id), id + ' is fixed'));
  assert.equal(c.outcomes.vision, standard.constants.institution.vision);
  assert.match(c.outcomes.mission.lead, /^LCUP commits to generate and make available to all persons and communities/);
});

test('a repeated requirement or reference is offered for removal, keeping the first', () => {
  const F = require('./fixtures');
  const standard = require('./standard-v4.json');
  const { evaluate } = require('./rules');
  const { deterministic } = require('./fixes');
  const c = F.good();
  c.reqs.push({ id: 'dupq', t: c.reqs[0].t });
  c.refs.online.items.push({ id: 'dupo', t: c.refs.books.items[0].t });
  c.refs.online.na = false;
  const out = deterministic(c, evaluate(c, standard, F.ctx()).findings, standard);
  const ops = out.flatMap((s) => s.ops);
  assert.deepEqual(ops.filter((o) => o.op === 'remove').map((o) => o.path).sort(), ['refs.online.items[id=dupo]', 'reqs[id=dupq]']);
});

test('a grading component named twice is merged, keeping the total at 100', () => {
  const F = require('./fixtures');
  const standard = require('./standard-v4.json');
  const { evaluate } = require('./rules');
  const ops = require('./formOps');
  const { deterministic } = require('./fixes');
  const c = F.good();
  const first = c.grading.rows[0];
  c.grading.rows.push({ id: 'gdup', label: first.label, pct: 0 });
  const found = evaluate(c, standard, F.ctx()).findings;
  const out = deterministic(c, found, standard).filter((s) => s.rules.includes('D-06'));
  assert.equal(out.length, 1);
  assert.ok(ops.holds(c, out[0].expect) && ops.applyOps(c, out[0].ops));
  assert.equal(c.grading.rows.reduce((n, r) => n + Number(r.pct), 0), 100);
  assert.equal(c.grading.rows.filter((r) => r.label === first.label).length, 1);
  assert.equal(evaluate(c, standard, F.ctx()).findings.filter((f) => f.ruleId === 'D-06').length, 0);
});

test('I-01: a syllabus with no word on diverse learners only gets a warning, and no fix is suggested for it', () => {
  const F = require('./fixtures');
  const standard = require('./standard-v4.json');
  const { evaluate } = require('./rules');
  const { deterministic } = require('./fixes');
  const c = F.good();
  assert.equal(evaluate(c, standard, F.ctx()).findings.filter((f) => f.ruleId === 'I-01').length, 0);
  c.reqs.pop();
  const found = evaluate(c, standard, F.ctx());
  assert.equal(found.conformance.ok, true, 'it only warns');
  assert.equal(found.findings.filter((f) => f.ruleId === 'I-01').length, 1);
  assert.deepEqual(deterministic(c, found.findings, standard).filter((s) => s.rules.includes('I-01')), [], 'what a syllabus promises about accommodations is the author to write');
  const inPlan = F.good();
  inPlan.reqs.pop();
  inPlan.plan[0].activities = '- Lecture with captioned slides and alternative formats';
  assert.equal(evaluate(inPlan, standard, F.ctx()).findings.filter((f) => f.ruleId === 'I-01').length, 1, 'captioned slides alone is not one of the words');
  inPlan.plan[0].activities = '- Accessible lecture materials for every learner';
  assert.equal(evaluate(inPlan, standard, F.ctx()).findings.filter((f) => f.ruleId === 'I-01').length, 0);
});
