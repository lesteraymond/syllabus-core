import test from 'node:test';
import assert from 'node:assert/strict';
import { groupBySeverity, linkProblems, problemsOf, scoreBreakdown, suggestionKind } from './hybridView.js';

const hybrid = {
  critical: true, baseScore: 90, score: 70,
  deductions: [{ id: 'D1', reason: 'Course code not in curriculum', points: 15 }, { id: 'D2', reason: 'Missing reference', points: 5 }],
  alignment: { judgements: [
    { id: 'a', type: 'CLO_TO_PO', label: 'PARTIALLY_ALIGNED', explanation: 'Weak link', path: 'clos[0]' },
    { id: 'b', type: 'ILO_TO_CLO', label: 'NOT_ALIGNED', explanation: 'No link', path: 'plan[1]' },
    { id: 'c', type: 'ILO_TO_CLO', label: 'ALIGNED', explanation: 'fine' },
  ] },
};
const run = { findings: [{ ruleId: 'CUR-CODE', message: 'IE 204 is not in the BSIE curriculum' }] };

test('problems list critical, deductions and non-aligned relationships, serious first', () => {
  const p = problemsOf(hybrid, run);
  assert.deepEqual(p.map((x) => x.id), ['critical', 'alignment:b', 'deduction:D1', 'deduction:D2', 'alignment:a']);
  assert.equal(p.find((x) => x.id === 'alignment:a').severity, 'medium');
});

test('an answer the server could not verify is a high-severity problem', () => {
  const h = { deductions: [], alignment: { judgements: [{ id: 'u', type: 'ILO_TO_CLO', label: 'INSUFFICIENT_EVIDENCE', explanation: 'Could not be verified', path: 'plan[3]' }] } };
  const p = problemsOf(h, {});
  assert.equal(p.length, 1);
  assert.equal(p[0].severity, 'high');
});

test('aligned relationships and a missing hybrid produce no problem', () => {
  assert.equal(problemsOf(null, run).length, 0);
  assert.ok(!problemsOf(hybrid, run).some((x) => x.id === 'alignment:c'));
});

test('a critical flag without its finding message adds nothing', () => {
  assert.ok(!problemsOf({ ...hybrid, critical: true }, { findings: [] }).some((x) => x.kind === 'critical'));
});

test('groups keep only non-empty severities', () => {
  assert.deepEqual(groupBySeverity(problemsOf(hybrid, run)).map((g) => g.key), ['high', 'medium']);
  assert.deepEqual(groupBySeverity([]).length, 0);
});

test('score breakdown sums deductions and tolerates an unscored run', () => {
  assert.deepEqual(scoreBreakdown(hybrid), { base: 90, deducted: 20, score: 70 });
  assert.deepEqual(scoreBreakdown({ deductions: [] }), { base: null, deducted: 0, score: null });
});

test('suggestion kinds follow the target path', () => {
  assert.equal(suggestionKind('clos[2].statement'), 'clo');
  assert.equal(suggestionKind('plan[0].ilos[1].text'), 'ilo');
  assert.equal(suggestionKind('plan[3].values'), 'plan');
  assert.equal(suggestionKind('outcomes.vision'), 'outcomes');
  assert.equal(suggestionKind('meta.title'), 'meta');
  assert.equal(suggestionKind('x'), 'other');
});

test('an AI relationship is one problem that carries its points, not a judgement plus a separate deduction', () => {
  const h = {
    deductions: [{ id: 'SEM:b', reason: 'NOT_ALIGNED', points: 3 }, { id: 'SEM:a', reason: 'PARTIALLY_ALIGNED', points: 1 }, { id: 'LINK:x', reason: 'broken', points: 2 }],
    alignment: { judgements: [
      { id: 'a', type: 'CLO_TO_PO', label: 'PARTIALLY_ALIGNED', explanation: 'Weak', path: 'clos[0]' },
      { id: 'b', type: 'ILO_TO_CLO', label: 'NOT_ALIGNED', explanation: 'None', path: 'plan[1]' },
    ] },
  };
  const p = problemsOf(h, {});
  assert.deepEqual(p.map((x) => x.id), ['alignment:b', 'deduction:LINK:x', 'alignment:a']);
  assert.equal(p.find((x) => x.id === 'alignment:b').points, 3);
  assert.equal(p.find((x) => x.id === 'alignment:a').severity, 'medium', 'severity comes from the AI label, not the deduction');
});

test('each problem is matched to the recommendation that fixes it; the rest have no draft', () => {
  const h = {
    deductions: [{ id: 'VALUE:plan[2].values', reason: 'Missing core value', points: 1 }, { id: 'LINK:x', reason: 'broken', points: 2 }],
    alignment: { judgements: [
      { id: 'a', type: 'CLO-PO', label: 'PARTIALLY_ALIGNED', explanation: 'x', path: 'clos[0]' },
      { id: 'b', type: 'CLO-EGA', label: 'NOT_ALIGNED', explanation: 'y', path: 'clos[0]' },
    ] },
  };
  const problems = problemsOf(h, {});
  const suggestions = [
    { id: 'SEM:b', path: 'clos[0].statement', basedOn: ['SEM:b', 'SEM:a'] }, // one draft for the field, two relationships behind it
    { id: 'VALUE:plan[2].values', path: 'plan[2].values', basedOn: ['VALUE:plan[2].values'] },
  ];
  const { forSuggestion, unlinked } = linkProblems(problems, suggestions);
  assert.deepEqual(forSuggestion['SEM:b'].map((p) => p.id).sort(), ['alignment:a', 'alignment:b']);
  assert.deepEqual(forSuggestion['VALUE:plan[2].values'].map((p) => p.id), ['deduction:VALUE:plan[2].values']);
  assert.deepEqual(unlinked.map((p) => p.id), ['deduction:LINK:x']);
  assert.deepEqual(linkProblems(problems, []).unlinked.length, problems.length);
});

test('a reference that does not fit the plan is an advisory "improve" item titled with its link, never a "fix"', () => {
  const h = { deductions: [], alignment: { judgements: [
    { id: 'ref0', type: 'REF-plan', label: 'NOT_ALIGNED', explanation: 'Unrelated topic', path: 'refs:https://example.org/x', sourceQuote: 'Cooking', targetQuote: 'Calculus' },
    { id: 'ref1', type: 'REF-plan', label: 'INSUFFICIENT_EVIDENCE', explanation: 'Unreadable', path: 'refs:https://example.org/y' },
    { id: 'ref2', type: 'REF-plan', label: 'ALIGNED', explanation: 'Fits', path: 'refs:https://example.org/z' },
  ] } };
  const p = problemsOf(h, {});
  assert.deepEqual(p.map((x) => x.id), ['alignment:ref0', 'alignment:ref1']);
  assert.ok(p.every((x) => x.severity === 'medium' && x.advisory && !x.points));
  assert.equal(p[0].title, 'https://example.org/x');
  assert.equal(p[0].where, undefined);
});

test('only an AI rewrite of a text field can be checked and improved', async () => {
  const { canRefine } = await import('./hybridView.js');
  const ai = (path, replacement = 'new text') => ({ source: 'ai', path, replacement });
  for (const ok of ['clos[0].statement', 'plan[3].contents', 'plan[3].activities', 'plan[3].tasks', 'plan[3].values', 'plan[2].ilos[1].text']) assert.equal(canRefine(ai(ok)), true, ok);
  for (const no of ['meta.title', 'outcomes.vision', 'plan[0].ilos', 'clos[0].pos', 'plan[x].tasks', 'clos[0].statement.extra']) assert.equal(canRefine(ai(no)), false, no);
  assert.equal(canRefine({ ...ai('clos[0].statement'), source: 'rule' }), false, 'a rule suggestion is the exact official text; there is nothing to improve');
  assert.equal(canRefine(ai('clos[0].statement', ['not', 'text'])), false);
  assert.equal(canRefine(null), false);
});

test('every relationship the server calls advisory is an "improve" item, not a "fix first"; scored ones are unchanged; old reports still work', () => {
  const judgements = [
    { id: 'c1', type: 'ILO-content', label: 'NOT_ALIGNED', explanation: 'Unrelated contents', path: 'plan[0].ilos[0].text' },
    { id: 'd1', type: 'Description-plan', label: 'PARTIALLY_ALIGNED', explanation: 'Generic', path: 'description' },
    { id: 'a1', type: 'CLO-anyPO', label: 'INSUFFICIENT_EVIDENCE', explanation: 'Unreadable', path: 'clos[0].statement' },
    { id: 's1', type: 'ILO-assessment', label: 'NOT_ALIGNED', explanation: 'Recall only', path: 'plan[0].ilos[0].text' },
  ];
  const withPolicy = problemsOf({ deductions: [{ id: 'SEM:s1', points: 3, reason: 'NOT_ALIGNED' }], policy: { advisoryTypes: ['ILO-content', 'Description-plan', 'CLO-anyPO', 'CLO-anyEGA'] }, alignment: { judgements } }, {});
  const by = id => withPolicy.find(x => x.id === 'alignment:' + id);
  for (const id of ['c1', 'd1', 'a1']) assert.deepEqual([by(id).severity, by(id).advisory, by(id).points], ['medium', true, undefined], id);
  assert.deepEqual([by('s1').severity, by('s1').advisory, by('s1').points], ['high', false, 3], 'a scored relationship is still a "fix first" with its points');
  assert.equal(by('c1').title, 'ILO-content', 'an advisory outcome relationship is titled by its type, not treated as a link');
  assert.equal(by('c1').where, 'plan[0].ilos[0].text');
  const old = problemsOf({ deductions: [], alignment: { judgements } }, {});
  assert.equal(old.find(x => x.id === 'alignment:c1').severity, 'high', 'a report that predates the policy list is shown as it always was');
});

test('a relationship the provider failed on is not a problem in the syllabus: it is left out of the problem list, while an invalid answer still is', () => {
  const judgements = [
    { id: 'a', type: 'ILO-activity', label: 'INSUFFICIENT_EVIDENCE', unverified: true, failureKind: 'provider_timeout', explanation: 'Not answered', path: 'plan[0].ilos[0].text' },
    { id: 'b', type: 'ILO-activity', label: 'INSUFFICIENT_EVIDENCE', unverified: true, failureKind: 'invalid_output', explanation: 'Could not verify', path: 'plan[1].ilos[0].text' },
    { id: 'c', type: 'ILO-activity', label: 'PARTIALLY_ALIGNED', explanation: 'Partly', path: 'plan[2].ilos[0].text' },
  ];
  assert.deepEqual(problemsOf({ deductions: [], alignment: { judgements } }, {}).map(x => x.id).sort(), ['alignment:b', 'alignment:c']);
});
