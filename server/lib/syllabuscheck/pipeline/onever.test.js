'use strict';
// One observable verb per outcome (owner, 2026-11-17; CHED Implementation Handbook for OBE and ISA, rule 7 of writing learning outcomes: "Choose only
// one observable verb/behavior in a statement of outcome; choose the behavior that is of a higher dimension of complexity"). A no-AI rule on CLOs and
// ILOs: advisory (no points in official mode), and the repair plan drafts a one-verb rewrite.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./testSyllabus');
const P = require('./prompt');
const fixedRules = require('./fixedRules');
const { extract, leadingVerbs } = require('./extract');
const { fieldKeyOfFinding } = require('./judge');
const { buildPlan } = require('./plan');

test('the verbs an outcome opens with: joined verbs count, a verb later in the sentence does not', () => {
  const cases = [
    ['Define and explain the basic concepts of logic.', ['define', 'explain']],
    ['Design, implement, and test robust Java programs', ['design', 'implement', 'test']],
    ['Analyze/evaluate network designs', ['analyze', 'evaluate']],
    ['Students will be able to identify and correct syntax errors', ['identify', 'correct']],
    ['At the end of the course, the student will be able to analyze and evaluate data', ['analyze', 'evaluate']],
    ['Apply De Morgan\'s laws and quantifier negation to simplify expressions', ['apply']],
    ['Explain the role of loops and arrays in programs', ['explain']],
    ['Write a simple Python program and run it with the interpreter', ['write']],
    ['The instructor will discuss loops', []],
    ['', []],
  ];
  for (const [text, verbs] of cases) assert.deepEqual(leadingVerbs(text), verbs, text);
});

test('a CLO or ILO that opens with two verbs is a finding on its own field, naming the higher verb to keep', () => {
  const c = T.conforming();
  c.clos[0].statement = 'Define and explain the concepts of Java programming';
  c.plan[2].ilos[0].text = 'Write and run a Java program for topic number 3';
  c.plan[3].ilos[0].text = 'Analyze and evaluate the design of topic number 4';
  const found = fixedRules.check(extract(c), { year: 2026 }).findings.filter(f => f.rule === 'OUTCOME-ONE-VERB');
  assert.equal(found.length, 3);
  const clo = found.find(f => f.field === 'clo');
  assert.equal(clo.severity, 'finding');
  assert.equal(fieldKeyOfFinding(clo), `clo:${c.clos[0].id}`);
  assert.match(clo.message, /CLO 1: It uses 2 verbs \("define" and "explain"\); CHED advises one observable verb per outcome, the one of higher complexity \(here "explain"\)\./);
  const ilo = found.find(f => f.where.ilo === c.plan[3].ilos[0].id);
  assert.equal(fieldKeyOfFinding(ilo), `ilo:${c.plan[3].ilos[0].id}`);
  assert.match(ilo.message, /\(here "evaluate"\)/);
  // "run" has no Bloom level of its own here, so no verb is named; the faculty or the rewrite chooses
  assert.doesNotMatch(found.find(f => f.where.ilo === c.plan[2].ilos[0].id).message, /here "/);
  // the conforming syllabus has none
  assert.ok(!fixedRules.check(extract(T.conforming()), { year: 2026 }).findings.some(f => f.rule === 'OUTCOME-ONE-VERB'));
});

test('a rewrite that still opens with two verbs is refused; the rewrite format asks for one verb', () => {
  const job = { field: 'ilo', text: 'Write and run a program', parents: [], siblings: [] };
  assert.match(P.validateRewrite(job, JSON.stringify({ text: 'Write and test a Java program for topic 3', explanation: 'x' })).rejected, /opens with 2 verbs \(write, test\); one observable verb per outcome/);
  assert.equal(P.validateRewrite(job, JSON.stringify({ text: 'Write a Java program for topic 3', explanation: 'x' })).text, 'Write a Java program for topic 3');
  assert.equal(P.validateRewrite({ ...job, field: 'clo' }, JSON.stringify({ text: 'Design and implement Java programs', explanation: 'x' })).rejected.startsWith('opens with 2 verbs'), true);
  assert.match(P.REWRITE_SYSTEM, /clo: One sentence for one CLO\. Start with ONE measurable verb/);
  assert.match(P.REWRITE_SYSTEM, /ilo: One sentence in English, starting with ONE measurable verb/);
  assert.doesNotMatch(P.JUDGE_SYSTEM, /"Design and implement Python programs/, 'the worked examples follow the rule too');
});

test('the repair plan drafts a one-verb rewrite of the outcome', async () => {
  const c = T.conforming();
  c.plan[3].ilos[0].text = 'Analyze and evaluate the design of topic number 4';
  const log = [];
  const rewrite = T.scriptedRewriter({ log, replace: job => (job.field.kind === 'ilo' ? JSON.stringify({ text: 'Evaluate the design of topic number 4', explanation: 'One verb, the higher one.' }) : undefined) });
  const plan = await buildPlan(c, undefined, { ask: T.scriptedJudge(), rewrite, store: new Map(), model: 'scripted', year: 2026 });
  const job = log.find(j => j.field.kind === 'ilo');
  assert.ok(job.rules.some(r => /CHED advises one observable verb/.test(r)), 'the rewrite is told why');
  const change = plan.changes.find(ch => ch.key === `ilo:${c.plan[3].ilos[0].id}`);
  assert.equal(change.after, 'Evaluate the design of topic number 4');
  assert.equal(change.status, 'VERIFIED');
});
