'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./testSyllabus');
const { runShadow } = require('./shadow');
const { summarize, renderList, renderDetail } = require('./shadowReport');
const script = require('../../../../scripts/replan-shadow-report.cjs');

// A stored check as the database returns it, with a shadow result made by the real shadow code and the scripted model.
async function storedRow(mode = 'shadow', edit = c => c) {
  const content = edit(T.conforming());
  const official = { score: 81, hybrid: { deductions: [{}, {}, {}], suggestions: [{}, {}] } };
  const provider = { ask: T.scriptedJudge(), rewrite: T.scriptedRewriter(), model: 'scripted', usage: () => ({ estimatedUsd: 0.4321, budget: { stopReason: null } }) };
  official.hybrid.replanShadow = await runShadow({ content, officialResult: official, env: { SYLLABUS_CHECK_REPLAN: mode }, provider, store: new Map() });
  return { run_id: 345, syllabus_id: 12, created_at: new Date('2026-11-15T03:04:00Z'), overall: 81, course_code: 'IT 204', title: 'Computer Programming 2', report_json: JSON.stringify(official) };
}
const weakWeek = c => { c.plan[3].activities = 'Lecture only'; c.plan[4].values = ''; return c; };

test('summarize puts the new checker beside the official numbers of the same check', async () => {
  const item = summarize(await storedRow('shadow', weakWeek));
  assert.equal(item.course, 'IT 204 Computer Programming 2');
  assert.deepEqual(item.official, { score: 81, deductions: 3, suggestions: 2 });
  assert.equal(item.state, 'complete');
  assert.equal(item.shadow.misalignments, 2);
  assert.deepEqual(item.shadow.byRule, { 'ACTIVITY-OPTIONS': 1, 'VALUES-WEEKLY': 1 });
  assert.equal(item.shadow.estimatedUsd, 0.4321);
  assert.equal(item.at, '2026-11-15 03:04');
});

test('the list shows one line per check; skipped, failed, missing and unreadable shadows say why', async () => {
  const ok = summarize(await storedRow('shadow', weakWeek));
  const skipped = summarize({ run_id: 2, report_json: JSON.stringify({ hybrid: { replanShadow: { mode: 'shadow', skipped: 'SYLLABUS_CHECK_REPLAN_MAX_COST_USD is required' } } }) });
  const failed = summarize({ run_id: 3, report_json: JSON.stringify({ hybrid: { replanShadow: { mode: 'shadow', error: 'Anthropic HTTP 400: credit balance is too low' } } }) });
  const none = summarize({ run_id: 4, report_json: JSON.stringify({ hybrid: {} }) });
  const broken = summarize({ run_id: 5, report_json: '{not json' });
  assert.deepEqual([skipped.state, failed.state, none.state, broken.state], ['skipped', 'error', 'none', 'unreadable']);
  const list = renderList([ok, skipped, failed]);
  assert.match(list, /345 .*IT 204 Computer Programming 2.*score 81 \/ 3 ded.*2 mis, -0 pts, complete.*\$0\.4321.*ACTIVITY-OPTIONS×1/);
  assert.match(list, /skipped[ -]*\n {7}-> SYLLABUS_CHECK_REPLAN_MAX_COST_USD is required/);
  assert.match(list, /error[ -]*\n {7}-> Anthropic HTTP 400: credit balance is too low/);
  assert.match(renderList([]), /No stored checks with a shadow result yet/);
});

test('the detail view lists every misalignment the new checker found, and its plan in plan mode', async () => {
  const detail = renderDetail(summarize(await storedRow('plan', weakWeek)));
  assert.match(detail, /Official \(old checker\): score 81, 3 deductions, 2 suggestions/);
  assert.match(detail, /\[rule\] ACTIVITY-OPTIONS · Week 4/);
  assert.match(detail, /\[rule\] VALUES-WEEKLY · Week 5/);
  assert.match(detail, /Repair plan: clean after the plan, 2 changes/);
  assert.match(detail, /VERIFIED Week 4 activities: "Lecture only" -> "- Lecture-discussion/);
  assert.match(detail, /Comparison only/);
});

test('the detail view shows what went to review, what was not checked, and advice; an older shadow says these were not stored', async () => {
  const unclear = q => (q.id === 'CONTENT-TITLE|content:r3' ? { q: q.id, items: [{ id: 'subject', answer: 'unclear' }], quote: '', explanation: 'The topic name alone is ambiguous.' } : undefined);
  const content = T.conforming();
  content.plan[2].ilos[0].tags = ['clo:c3', 'clo:c2'];
  content.clos[1].statement = 'OFFTOPIC Explain folk dance outcome 2';
  const official = { score: 70, hybrid: { deductions: [], suggestions: [] } };
  const provider = { ask: T.scriptedJudge({ override: unclear }), rewrite: T.scriptedRewriter(), model: 'scripted' };
  official.hybrid.replanShadow = await runShadow({ content, officialResult: official, env: { SYLLABUS_CHECK_REPLAN: 'shadow' }, provider, store: new Map() });
  const item = summarize({ run_id: 9, report_json: JSON.stringify(official) });
  assert.ok(item.review.some(r => r.rule === 'ILO-CLO' && r.label === 'Week 3 ILO 1' && r.against === 'CLO 2 (Enabling)'));
  assert.deepEqual(item.notChecked.map(r => [r.rule, r.label, r.message]), [['CONTENT-TITLE', 'Week 3 content', 'The topic name alone is ambiguous.']]);
  const detail = renderDetail(item);
  assert.match(detail, /For faculty review \(no penalty\):\n[\s\S]*\[NOT_ALIGNED\] ILO-CLO · Week 3 ILO 1 vs CLO 2 \(Enabling\)/);
  assert.match(detail, /Not checked .*:\n {2}\[INSUFFICIENT_EVIDENCE\] CONTENT-TITLE · Week 3 content vs Course title: The topic name alone is ambiguous\./);
  const old = structuredClone(official);
  delete old.hybrid.replanShadow.review; delete old.hybrid.replanShadow.notChecked; delete old.hybrid.replanShadow.advice;
  assert.match(renderDetail(summarize({ run_id: 10, report_json: JSON.stringify(old) })), /not stored for this check/);
});

test('the script only reads: one SELECT shape, run inside a read-only transaction', () => {
  assert.match(script.BASE, /^SELECT /);
  assert.doesNotMatch(script.BASE, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE)\b/i);
  const source = require('node:fs').readFileSync(require.resolve('../../../../scripts/replan-shadow-report.cjs'), 'utf8');
  assert.match(source, /START TRANSACTION READ ONLY/);
  assert.doesNotMatch(source, /\b(INSERT INTO|UPDATE \w+ SET|DELETE FROM)\b/);
  assert.doesNotMatch(source, /console\.log\([^)]*env\./, 'no setting from server/.env is printed');
});
