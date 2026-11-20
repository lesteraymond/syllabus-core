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

test('a report the new checker has not answered (a check without AI, or an old-checker report) covers none of the seven', () => {
  const old = { hybrid: { alignment: { status: 'completed', judgements: [{ id: 'a', type: 'ILO-CLO', label: 'ALIGNED' }] } } };
  const cov = semanticCoverageOf(old);
  assert.equal(cov.primaryPath, 're-planned');
  assert.equal(cov.evaluated, 0);
  assert.equal(cov.relationships.find(r => r.type === 'ILO-CLO').status, 'not_evaluated');
  assert.equal(semanticCoverageOf({ hybrid: { alignment: { status: 'not_evaluated', judgements: [] } } }).reason, 'replan_not_evaluated');
});

test('rule coverage: the fixed (no-AI) rules, the new checker\'s own rules, and its questions as the instances', async () => {
  const { report, content, masters } = await official();
  const cov = coverageOf(report, content, masters);
  assert.ok(!cov.unavailable);
  assert.deepEqual([...new Set(cov.rules.map(r => r.namespace))].sort(), ['hybrid_validation', 'new_ai_checker', 'quality', 'registered_standard'], 'no old AI, Policy V2, staged or verdict rules');
  const rows = cov.relationshipInstances.rows;
  const asked = report.hybrid.alignment.judgements.filter(j => j.status !== 'rule' && j.status !== 'rule_review');
  assert.equal(rows.length, asked.length);
  assert.ok(rows.every(r => r.scope === 're-planned' && r.attempted && r.verified));
  assert.equal(cov.relationshipInstances.notChecked, 0);
  assert.equal(cov.rules.find(r => r.ruleId === 'AI-REQUIRED')?.status, 'PASS');
});

// Check coverage in sync with the new AI Checker (2026-11-20). Before, the list showed only the 81 fixed rules of ruleCatalog.js: 19 of the new checker's
// 20 fixed rules were missing (only ILO-MISSING shares an id), and its AI questions were in the report data but not counted anywhere a person reads.
test('every rule the new checker\'s fixedRules.js can report is listed in RULE_IDS (so the coverage list cannot silently miss one)', () => {
  const src = require('fs').readFileSync(require.resolve('./fixedRules'), 'utf8');
  const used = [...new Set([...src.matchAll(/finding\('([A-Z0-9-]+)'/g)].map(m => m[1]))].sort();
  const { RULE_IDS } = require('./fixedRules');
  assert.deepEqual([...RULE_IDS].sort(), used);
  assert.equal(new Set(RULE_IDS).size, RULE_IDS.length);
});

test('rule coverage lists each of the new checker\'s fixed rules with what it found: none is a pass, a finding needs revision, a review item needs a person', async () => {
  const { report, content, masters } = await official();
  const { RULE_IDS } = require('./fixedRules');
  assert.deepEqual(report.hybrid.replan.fixedRules.map(r => r.ruleId), RULE_IDS, 'the report records every rule it ran');
  const cov = coverageOf(report, content, masters);
  const own = cov.rules.filter(r => r.namespace === 'new_ai_checker');
  assert.deepEqual(own.map(r => r.ruleId), RULE_IDS);
  assert.ok(own.every(r => r.executed && r.verified && r.activationState === 'ACTIVE'));
  // each row agrees with the new checker's own findings on this sample
  const found = rule => report.hybrid.alignment.judgements.filter(j => j.type === 'Rule ' + rule);
  for (const r of own) {
    const f = found(r.ruleId);
    const expected = f.some(j => j.status === 'rule') ? 'FAIL' : f.length ? 'NEEDS_REVIEW' : 'PASS';
    assert.equal(r.status, expected, r.ruleId);
    assert.equal(r.instances.length, Math.max(1, f.length), r.ruleId + ': one receipt per finding, or one pass');
  }
  assert.ok(own.some(r => r.status === 'PASS') && own.some(r => r.status !== 'PASS'), 'the sample has both');
  assert.equal(cov.counts.catalogued, cov.rules.length, 'the heading counts them');
});

test('rule coverage counts the AI questions by kind, and every question is counted once', async () => {
  const { report, content, masters } = await official();
  const cov = coverageOf(report, content, masters);
  const q = cov.aiQuestions;
  assert.equal(q.asked, cov.relationshipInstances.expected);
  assert.equal(q.answered, cov.relationshipInstances.verified);
  assert.equal(q.byRelationship.reduce((n, k) => n + k.asked, 0), q.asked);
  for (const k of q.byRelationship) assert.equal(k.passed + k.failed + k.review + k.notChecked, k.asked, k.relationship);
  const R = require('./rules');
  assert.ok(q.byRelationship.every(k => R.CHECKLISTS[k.relationship]), 'only the new checker\'s relationships');
  assert.ok(q.byRelationship.some(k => k.relationship === 'ILO-CLO') && q.byRelationship.some(k => k.relationship === 'REF-RELEVANCE'));
});

test('unanswered questions are counted as not checked, never as passed', async () => {
  const R = require('./rules');
  const ask = T.scriptedJudge({ override: q => q.relationship === 'TASK-FIT' ? { q: q.id, items: R.CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: 'unclear' })), quote: '', explanation: 'Cannot tell.' } : undefined });
  const { report, content, masters } = await official(ask);
  const k = coverageOf(report, content, masters).aiQuestions.byRelationship.find(x => x.relationship === 'TASK-FIT');
  assert.ok(k.asked > 0);
  assert.equal(k.notChecked, k.asked);
  assert.equal(k.passed, 0);
});

test('a report the new checker did not make has no new-checker rows and no AI question counts (no synthetic coverage)', async () => {
  const { content, masters } = sample();
  const noAi = await engine.run(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'off' }, ...links });
  const cov = coverageOf(noAi, content, masters);
  assert.equal(cov.aiQuestions, null);
  assert.ok(!cov.rules.some(r => r.namespace === 'new_ai_checker'));
  assert.equal(cov.relationshipInstances.expected, 0);
});

test('coverage names the syllabus POs not linked to an EGA (an administrator gap; nothing is blocked), [] when all are linked, null without POs', async () => {
  const { report, content, masters } = await official();
  assert.deepEqual(coverageOf(report, content, masters).posWithoutEga, [], 'the sample links every PO');
  const unlinked = structuredClone(content);
  unlinked.outcomes = { ...(unlinked.outcomes || {}), pos: [{ no: 1, short: 'P1', text: 'T', egas: [1] }, { no: 2, short: 'P2', text: 'T', egas: [] }, { no: 3, short: 'P3', text: 'T' }] };
  assert.deepEqual(coverageOf(report, unlinked, masters).posWithoutEga, [2, 3]);
  const none = structuredClone(content);
  none.outcomes = { ...(none.outcomes || {}), pos: [] }; delete none.catalog;
  assert.equal(coverageOf(report, none, { ...masters, pos: [] }).posWithoutEga, null);
  assert.equal(report.status, 'scored', 'the gap never stops a check');
});
