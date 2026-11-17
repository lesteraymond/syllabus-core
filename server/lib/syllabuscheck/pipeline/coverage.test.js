'use strict';
// The coverage reports (semanticCoverage.js, ruleCoverage.js) on a report the re-planned checker made in official mode. Before, both read only the old
// checker's relationship names: the VPAA pill said 0 of 7 ("Policy V2 is off") and every old AI rule read NOT_CHECKED although the new checker had
// answered every question. Offline: the real old engine with AI off, the new checker on a scripted model.
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('../fixtures');
const engine = require('../engine');
const T = require('./testSyllabus');
const O = require('./official');
const { semanticCoverageOf, TYPES } = require('../semanticCoverage');
const { coverageOf } = require('../ruleCoverage');

const links = { linkChecker: async url => ({ url, status: 'ok' }) };
async function official(ask = T.scriptedJudge()) {
  const { content, masters } = sample();
  delete masters.synthetic;
  const noAi = await engine.run(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'off' }, ...links });
  const report = await O.officialize({ noAi, content, masters, provider: { ask, rewrite: T.scriptedRewriter(), model: 'scripted' }, store: new Map(), year: 2026 });
  return { report, content, masters };
}

test('the VPAA coverage of a new-checker report counts its own questions: all seven evaluated', async () => {
  const { report } = await official();
  const cov = semanticCoverageOf(report, { v2On: false });
  assert.equal(cov.primaryPath, 're-planned');
  assert.equal(cov.total, TYPES.length);
  assert.equal(cov.evaluated, 7, JSON.stringify(cov.relationships.map(r => [r.type, r.status, r.expected])));
  assert.equal(cov.complete, true);
  assert.equal(cov.reason, null);
  assert.ok(cov.relationships.every(r => r.source === 're-planned' && r.expected > 0));
});

test('questions without an answer make it partial, with a reason the app can show', async () => {
  // every Week-3 question goes unanswered ("unclear" on every item)
  const R = require('./rules');
  const ask = T.scriptedJudge({ override: q => (q.field.label || '').startsWith('Week 3') ? { q: q.id, items: R.CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: 'unclear' })), quote: '', explanation: 'The text is cut short.' } : undefined });
  const { report } = await official(ask);
  const cov = semanticCoverageOf(report, { v2On: false });
  assert.equal(cov.complete, false);
  assert.ok(cov.relationships.some(r => r.status === 'partial'));
  assert.equal(cov.reason, 'replan_partial');
  const i18n = require('fs').readFileSync(require.resolve('../../../../src/i18n/hybrid.js'), 'utf8');
  assert.equal((i18n.match(/'hybrid\.vpaaCoverageNote\.replan_partial'/g) || []).length, 2, 'English and Filipino');
});

test('an old-checker report is read exactly as before', () => {
  const old = { hybrid: { alignment: { status: 'completed', judgements: [{ id: 'a', type: 'ILO-CLO', label: 'ALIGNED' }] } } };
  const cov = semanticCoverageOf(old, { v2On: false });
  assert.equal(cov.primaryPath, 'legacy');
  assert.equal(cov.reason, 'policy_v2_off');
  assert.equal(cov.relationships.find(r => r.type === 'ILO-CLO').status, 'evaluated');
});

test('rule coverage: the old AI rules are superseded, not NOT_CHECKED, and the instances are the new checker\'s questions', async () => {
  const { report, content, masters } = await official();
  const cov = coverageOf(report, content, masters, {});
  assert.ok(!cov.unavailable);
  const semantic = cov.rules.filter(r => r.namespace === 'semantic_type');
  assert.ok(semantic.length > 0);
  assert.ok(semantic.every(r => r.status === 'NOT_APPLICABLE' && r.reasonCode === 'replaced_by_replan'), JSON.stringify(semantic.filter(r => r.reasonCode !== 'replaced_by_replan').map(r => [r.ruleId, r.status])));
  const rows = cov.relationshipInstances.rows;
  const asked = report.hybrid.alignment.judgements.filter(j => j.status !== 'rule' && j.status !== 'rule_review');
  assert.equal(rows.length, asked.length);
  assert.ok(rows.every(r => r.scope === 're-planned' && r.attempted && r.verified));
  assert.equal(cov.relationshipInstances.notChecked, 0);
  assert.equal(cov.rules.find(r => r.ruleId === 'AI-REQUIRED')?.status, 'PASS');
});
