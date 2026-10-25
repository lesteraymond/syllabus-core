// Run: npm test. The server and the browser each have a copy of the compliance rules; they must never disagree.
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { evaluate as clientEvaluate, CHECKS as clientChecks } from './complianceRules.js';
import { weekNums as clientWeekNums, parseTag as clientParseTag, lines as clientLines, stripMarkup as clientStrip, abbr as clientAbbr, examName as clientExamName } from './syllabusModel.js';

const require = createRequire(import.meta.url);
const server = require('../../server/lib/compliance/rules.js');
const standard = require('../../server/lib/compliance/standard-v4.json');
const F = require('../../server/lib/compliance/fixtures.js');

const both = (content, ctx = F.ctx()) => {
  const copy = () => JSON.parse(JSON.stringify(content === undefined ? null : content));
  const a = server.evaluate(copy(), standard, JSON.parse(JSON.stringify(ctx)));
  const b = clientEvaluate(copy(), standard, JSON.parse(JSON.stringify(ctx)));
  assert.deepStrictEqual(b, a);
  return b;
};

test('the browser and the server rules give the same result for the fixtures', () => {
  assert.strictEqual(both(F.good()).overall, 100);
  assert.strictEqual(both(F.bad()).conformance.ok, false);
  assert.strictEqual(both(F.empty()).status, 'insufficient');
});

test('they implement the same checks', () => {
  assert.deepStrictEqual(Object.keys(clientChecks).sort(), Object.keys(server.CHECKS).sort());
});

test('they agree on the three named failures', () => {
  const noTag = F.good();
  noTag.plan[0].ilos[0].tags = [];
  assert.strictEqual(both(noTag).conformance.failed[0].ruleId, 'T-13');
  const g = F.good();
  g.grading.rows[0].pct = 50;
  assert.strictEqual(both(g).conformance.failed[0].ruleId, 'T-24');
  const noExam = F.good();
  noExam.plan = noExam.plan.filter((r) => !/FINAL/.test(r.contents));
  assert.ok(both(noExam).findings.some((f) => f.ruleId === 'A-03'));
});

test('they agree on odd and partial content', () => {
  [null, undefined, {}, { meta: 5, plan: 'x', clos: {}, refs: [] }, { plan: [null, 3, { kind: 'lesson' }] }, { grading: { rows: 'x' }, reqs: [null, 7] }].forEach((c) => both(c));
  const noTags = F.good();
  delete noTags.plan[0].ilos[0].tags;
  both(noTags);
  const weird = F.good();
  weird.plan[1].week = 'Week 2, 4-5, x, 99';
  weird.plan[2].ilos[0].tags = ['clo:c1', 'ega:9', 'po:', 'nonsense', 7];
  weird.meta.lecture = '2.5';
  weird.grading.rows[0].pct = '60';
  weird.grading.override = { on: true, term: 'CS (60%) + Examination (40%)', final: 'Prelim Grade + Midterm' };
  weird.clos[0].egas = [4, 1];
  weird.signoff = { preparedBy: 'x' };
  weird.reqs.push({ id: 'z', t: '3) numbered by hand' });
  both(weird, { ...F.ctx(), preparedBy: '' });
});

test('they agree with and without a school year, a live catalog and a stored copy', () => {
  const c = F.good();
  c.refs.books.items.push({ id: 'old', t: 'Old (2001).' });
  both(c, {});
  both(c, { year: 2026 });
  both(c, { year: 2015, catalog: F.catalog() });
  delete c.catalog;
  both(c, F.ctx());
  both(c, { year: 2026 });
});

test('the helpers the rules rely on match the builder model', () => {
  ['3', '9-10', '1, 3-4', 'Week 2', '', ' ', 'x', '2-x', '5-3', '58-62', undefined, null].forEach((w) => assert.deepStrictEqual(server.helpers.weekNums(w), clientWeekNums(w === undefined || w === null ? '' : w), String(w)));
  ['clo:c1', 'ega:2', 'po:10', 'x', 'clo:'].forEach((t) => assert.deepStrictEqual(server.helpers.parseTag(t), clientParseTag(t), t));
  ['Class Standing', 'Examination', '  ', 'a b c', 'Lab'].forEach((l) => assert.strictEqual(server.helpers.abbr(l), clientAbbr(l), l));
  ['PRELIM EXAMINATION', '- **Midterm** exam', 'Final', 'Quiz week', '', 'x\ny'].forEach((t) => assert.strictEqual(server.helpers.examName({ contents: t }), clientExamName({ contents: t }), t));
  assert.deepStrictEqual(server.helpers.lines(' a\n\n b '), clientLines(' a\n\n b '));
  assert.strictEqual(server.helpers.stripMarkup('- **bold** text'), clientStrip('- **bold** text'));
});
