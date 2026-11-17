'use strict';
// Official mode (SYLLABUS_CHECK_REPLAN=official): the real old engine with its AI step off, then the new checker on a scripted model. Offline.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sample } = require('../fixtures');
const engine = require('../engine');
const T = require('./testSyllabus');
const O = require('./official');
const R = require('./rules');

const links = { linkChecker: async url => ({ url, status: 'ok' }) };
async function official(edit = () => {}, provider = { ask: T.scriptedJudge(), rewrite: T.scriptedRewriter(), model: 'scripted' }) {
  const { content, masters } = sample();
  delete masters.synthetic; // a real check: synthetic masters never publish a score
  edit(content);
  const noAi = await engine.run(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'off' }, ...links });
  const before = structuredClone({ status: noAi.status, score: noAi.score, blocking: noAi.findings.filter(f => f.severity === 'blocking').map(f => f.ruleId) });
  await O.officialize({ noAi, content, masters, provider, store: new Map(), year: 2026 });
  return { report: noAi, before, content };
}
const weakIlo = c => { c.plan[2].ilos[0].text = 'WEAK ' + c.plan[2].ilos[0].text; };

test('official mode is used only when switched on, with the direct Anthropic provider, AI checking on and its own cost cap', () => {
  assert.equal(O.readiness({}).ok, false);
  assert.equal(O.readiness({ SYLLABUS_CHECK_REPLAN: 'shadow', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '2' }).ok, false);
  assert.match(O.readiness({ SYLLABUS_CHECK_REPLAN: 'official', SYLLABUS_CHECK_AI_PROVIDER: 'off', SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '2' }).reason, /AI checking is off/);
  assert.match(O.readiness({ SYLLABUS_CHECK_REPLAN: 'official', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic' }).reason, /MAX_COST_USD is required/);
  assert.equal(O.readiness({ SYLLABUS_CHECK_REPLAN: 'official', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '2' }).ok, true);
});

test('the new checker turns the no-AI report into a scored official report: base score minus its points', async () => {
  const { report, before } = await official(weakIlo);
  assert.deepEqual(before, { status: 'incomplete', score: null, blocking: ['AI-REQUIRED'] });
  const h = report.hybrid;
  assert.equal(h.alignment.status, 'completed');
  assert.equal(h.alignment.engine, 're-planned');
  assert.ok(!report.findings.some(f => f.ruleId === 'AI-REQUIRED'));
  assert.deepEqual(h.deductions.map(d => [d.id, d.points]), [['SEM:ILO-CONTENT|ilo:i3', 1], ['SEM:ILO-CLO|ilo:i3|clo:c3', 1]]);
  assert.equal(report.score, h.baseScore - 2);
  assert.equal(report.status, 'scored');
  assert.equal(h.ready, true);
  assert.equal(h.scoring.official.deducted, 2);
  assert.equal(h.replan.mode, 'official');
});

test('each area loses at most 5 points', async () => {
  const { report } = await official(c => { for (const row of c.plan) for (const ilo of row.ilos || []) if (ilo.text) ilo.text = 'WEAK ' + ilo.text; });
  const h = report.hybrid;
  const ilo = h.deductions.filter(d => d.area === 'ilo');
  assert.ok(ilo.length > 5);
  assert.equal(ilo.reduce((s, d) => s + d.points, 0), R.AREA_CAPS.ilo);
  assert.ok(ilo.some(d => d.capped && d.points === 0));
  assert.equal(report.score, h.baseScore - h.deductions.reduce((s, d) => s + d.points, 0));
});

test('the app shows its problems, links each draft to them, and can apply every draft (src/lib/hybridView.js)', async () => {
  const view = await import('../../../../src/lib/hybridView.js');
  const { report, content } = await official(weakIlo);
  const h = report.hybrid;
  const problems = view.problemsOf(h, report);
  const ilo = problems.filter(p => p.key.startsWith('SEM:ILO-'));
  assert.ok(ilo.length === 2 && ilo.every(p => p.points === 1 && p.severity === 'medium'));
  const draft = h.suggestions.find(s => s.id === 'RP:ilo:i3');
  assert.equal(draft.path, 'plan[2].ilos[0].text');
  assert.equal(draft.originalValue, content.plan[2].ilos[0].text);
  assert.ok(view.canRefine(draft));
  const { forSuggestion } = view.linkProblems(problems, h.suggestions);
  assert.deepEqual(forSuggestion['RP:ilo:i3'].map(p => p.key).sort(), ['SEM:ILO-CLO|ilo:i3|clo:c3', 'SEM:ILO-CONTENT|ilo:i3']);
  assert.ok(h.suggestions.every(s => view.canRefine(s) || s.source !== 'ai'), 'every AI draft is on a field the builder can apply');
  // a draft that fixes a no-AI rule (one activity only) is linked to that rule's problem, which costs no points
  const act = h.suggestions.find(s => /activities$/.test(s.path));
  assert.ok(forSuggestion[act.id].some(p => p.key.startsWith('SEM:RULE:ACTIVITY-OPTIONS') && p.advisory && !p.points));
});

test('an extra tag that does not fit beside one that does is advisory: shown, no points', async () => {
  const view = await import('../../../../src/lib/hybridView.js');
  const { report } = await official(c => { c.plan[2].ilos[0].tags = [...c.plan[2].ilos[0].tags, 'clo:' + c.clos[3].id]; c.clos[3].statement = 'OFFTOPIC ' + c.clos[3].statement; });
  const extra = view.problemsOf(report.hybrid, report).find(p => /\(extra tag\)$/.test(p.type));
  assert.ok(extra && extra.advisory && !extra.points);
  assert.ok(!report.hybrid.deductions.some(d => d.id === 'SEM:' + extra.key.slice(4)));
});

test('an "unclear" answer is shown as an advisory "not checked" note, never as a problem to fix first (UI check of #446, 2026-11-15)', async () => {
  const view = await import('../../../../src/lib/hybridView.js');
  const unclear = q => (q.id === 'CONTENT-TITLE|content:r3' ? { q: q.id, items: [{ id: 'subject', answer: 'unclear' }], quote: '', explanation: 'Cannot tell.' } : undefined);
  const { report } = await official(() => {}, { ask: T.scriptedJudge({ override: unclear }), rewrite: T.scriptedRewriter(), model: 'scripted' });
  const p = view.problemsOf(report.hybrid, report).find(x => x.key === 'SEM:CONTENT-TITLE|content:r3');
  assert.equal(p.type, 'CONTENT-TITLE (not checked)');
  assert.equal(p.advisory, true);
  assert.equal(p.severity, 'medium');
  assert.ok(!p.points);
});

test('a provider failure never makes a score: the report stays incomplete and says why', async () => {
  const failing = { ask: async () => { throw Error('HTTP 529 overloaded'); }, rewrite: async () => { throw Error('x'); }, model: 'scripted' };
  const { report } = await official(() => {}, failing);
  assert.equal(report.score, null);
  assert.equal(report.status, 'incomplete');
  assert.equal(report.hybrid.alignment.status, 'not_evaluated');
  assert.ok(report.findings.some(f => f.ruleId === 'AI-REQUIRED'));
  assert.equal(report.hybrid.suggestions.filter(s => s.source === 'ai').length, 0);
});

test('officialize hands back the check and plan it made, so a caller never builds the plan twice (DSP test, 2026-11-15)', async () => {
  const { content, masters } = sample();
  delete masters.synthetic;
  weakIlo(content);
  const noAi = await engine.run(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'off' }, ...links });
  let rewrites = 0;
  const provider = { ask: T.scriptedJudge(), rewrite: async m => { rewrites++; return T.scriptedRewriter()(m); }, model: 'scripted' };
  const out = {};
  await O.officialize({ noAi, content, masters, provider, store: new Map(), year: 2026, out });
  assert.ok(out.plan && out.result);
  assert.equal(rewrites, out.plan.usage.rewriteRequests);
  const script = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'scripts', 'replan-syllabus-run.cjs'), 'utf8');
  assert.match(script, /out: made/);
  assert.doesNotMatch(script, /pipeline\.buildPlan\(/, 'the test script re-checks with the plan officialize made');
});

test('compliance/service.js runs the old engine with AI off only in official mode, and keeps the old path otherwise', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'compliance', 'service.js'), 'utf8');
  assert.match(source, /const replanOfficial = !v2On && options\.useAi !== false && officialReplan\.readiness\(env\)\.ok;/);
  assert.match(source, /\.\.\.\(replanOfficial \? \{ env: \{ \.\.\.env, SYLLABUS_CHECK_AI_PROVIDER: 'off' \} \} : \{\}\)/);
  assert.match(source, /if \(replanOfficial\) \{\s*try \{\s*await officialReplan\.officialize/);
  assert.match(source, /if \(!v2On && !replanOfficial && options\.useAi !== false && wholePlan\.enabled\(env\)\)/);
});

test('the request limit is 1-300 (default 80) and the cost cap at most 1000: a bad value never refuses every request or lifts the limit', () => {
  assert.equal(O.maxRequestsOf({}), 80);
  assert.equal(O.maxRequestsOf({ SYLLABUS_CHECK_REPLAN_MAX_REQUESTS: '120' }), 120);
  for (const bad of ['-5', '0', 'abc', '12.5', '301', ' ']) assert.equal(O.maxRequestsOf({ SYLLABUS_CHECK_REPLAN_MAX_REQUESTS: bad }), 80, bad);
  const on = { SYLLABUS_CHECK_REPLAN: 'official', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic' };
  assert.equal(O.readiness({ ...on, SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '1000' }).ok, true);
  assert.match(O.readiness({ ...on, SYLLABUS_CHECK_REPLAN_MAX_COST_USD: '2000' }).reason, /at most 1000/);
});

test('keyOfPath is the reverse of pathOf for every field a draft can target', () => {
  const { content } = sample();
  const keys = [`clo:${content.clos[1].id}`, `ilo:${content.plan[2].ilos[0].id}`, ...['content', 'activities', 'tasks', 'values'].map(k => `${k}:${content.plan[4].id}`)];
  for (const key of keys) {
    const p = O.pathOf(content, key);
    assert.ok(O.APPLYABLE.test(p), p);
    assert.equal(O.keyOfPath(content, p), key);
  }
  assert.equal(O.keyOfPath(content, 'plan[99].contents'), null);
  assert.equal(O.keyOfPath(content, 'meta.title'), null);
});

test('fields the plan could not fix reach the list the app shows: a child waits for its failing parent, the parent needs review', async () => {
  const refuse = { ask: T.scriptedJudge(), rewrite: async () => JSON.stringify({ text: '', explanation: 'none' }), model: 'scripted' };
  const { report, content } = await official(c => { c.clos[2].statement = 'OFFTOPIC ' + c.clos[2].statement; }, refuse);
  const h = report.hybrid;
  const clo = h.unresolved.find(u => u.path === 'clos[2].statement');
  assert.ok(clo && clo.reason === 'draft_needs_review' && clo.source === 're-planned');
  const waiting = h.unresolved.filter(u => u.reason === 'waits_for_upstream');
  assert.ok(waiting.length > 0);
  assert.ok(waiting.every(u => Array.isArray(u.waitsFor) && u.waitsFor.includes('clos[2].statement')), 'each names the CLO it waits for');
  assert.ok(waiting.every(u => O.APPLYABLE.test(u.path) || /^plan\[\d+\]\./.test(u.path)));
  assert.equal(h.summary.counts.unresolved, h.unresolved.length, 'the summary counts what the list shows');
  assert.ok(!h.suggestions.some(s => s.path === 'clos[2].statement'), 'no draft for a field whose rewrite was refused');
  assert.equal(content.clos[2].statement.startsWith('OFFTOPIC'), true);
});

test('each AI judgement says whether it was answered, for the coverage reports', async () => {
  const { report } = await official(weakIlo);
  const ai = report.hybrid.alignment.judgements.filter(j => j.status !== 'rule' && j.status !== 'rule_review');
  assert.ok(ai.length > 0 && ai.every(j => j.attempted === true && typeof j.reused === 'boolean'));
});
