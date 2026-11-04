'use strict';
// P2 preparation: the quality measures of eval/qualityMetrics.js, offline. No provider call; the answers are written here in the shape eval-alignment.cjs
// records (answerReviews.js answerOf for a verified answer, unverifiedAnswerOf for one that never verified).
const test = require('node:test');
const assert = require('node:assert/strict');
const gemini = require('./gemini');
const { scoreEval } = require('./eval/metrics');
const { answerOf } = require('./eval/answerReviews');
const { qualityOf, describeQuality, modeOf, breaksLevelRule, expectedRecommendationOf, remapCandidate, proposalOf, sourceWordsIn, BLOOM, TOWARD_SOURCE } = require('./eval/qualityMetrics');
const alignment = require('./eval/alignment-dataset.json');
const stageA = require('./eval/stage-a-dataset.json');

const OFF = { a: false, b: false, b3: false, b4: false, c1: false, c2: false, d1: false, d2: false };
const ok = (label, extra = {}) => ({ label, sourceQuote: 'q', targetQuote: 'q', evidenceMatching: { source: 'exact', target: 'exact' }, explanation: 'e', recommendation: null, draft: '', sourceBloom: 'Apply', targetBloom: 'Apply', aspects: null, ...extra });
const never = codes => ({ label: null, unverified: true, failureCodes: codes, attempts: 3, stoppedBecause: 'attempt_limit', refusals: [] });

test('P2 quality: the Bloom levels are the ones the validator accepts, in the order the prompt lists them, and answerOf keeps the levels an answer gave', () => {
  assert.ok(gemini.PROMPT.includes(`State sourceBloom and targetBloom using ${BLOOM.join(', ')} or N/A.`));
  const pair = { id: 'p', type: 'CLO-PO', source: 'Design solutions for engineering problems.', target: 'Define the derivative.', path: 'eval', targetPath: 'eval' };
  for (const level of [...BLOOM, 'N/A']) {
    const [j] = gemini.validate({ judgements: [{ id: 'p', label: 'ALIGNED', explanation: 'e', sourceQuote: 'Design solutions', targetQuote: 'Define the derivative', sourceBloom: level, targetBloom: level, draft: '' }] }, [pair]);
    assert.deepEqual([answerOf(j).sourceBloom, answerOf(j).targetBloom], [level, level]);
  }
  assert.throws(() => gemini.validate({ judgements: [{ id: 'p', label: 'ALIGNED', explanation: 'e', sourceQuote: 'Design solutions', targetQuote: 'Define the derivative', sourceBloom: 'Synthesis', targetBloom: 'Apply', draft: '' }] }, [pair]), /Invalid Bloom level/);
  assert.deepEqual([answerOf({ label: 'ALIGNED' }).sourceBloom, answerOf({ label: 'ALIGNED' }).targetBloom], [null, null], 'an answer recorded before the levels were kept');
});

test('P2 quality: the mode follows the wording the run used, never the flags typed', () => {
  assert.deepEqual(modeOf(OFF), { id: 'A', name: 'legacy academic alignment benchmark', stagesOn: [], recommendationField: false });
  assert.deepEqual(modeOf({ ...OFF, a: true }), { id: 'B', name: 'enhanced staged semantic evaluation', stagesOn: ['a'], recommendationField: true });
  assert.deepEqual(modeOf({ ...OFF, a: true, b3: true }).stagesOn, ['a', 'b3']);
  assert.deepEqual([modeOf({ ...OFF, c1: true }).id, modeOf({ ...OFF, c1: true }).recommendationField], ['B', false], 'a stage without the recommendation field is still the staged wording');
});

test('P2 quality: strict and permissive agreement, false approvals and rejections, and insufficient evidence; permissive agreement and the error rates are metrics.js\'s', () => {
  const items = [
    { id: 'a', type: 'CLO-PO', accept: ['ALIGNED'] },
    { id: 'b', type: 'CLO-PO', accept: ['NOT_ALIGNED'] },
    { id: 'c', type: 'ILO-CLO', accept: ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'] },
    { id: 'd', type: 'ILO-CLO', accept: ['ALIGNED', 'PARTIALLY_ALIGNED'], ambiguous: true },
    { id: 'e', type: 'CLO-EGA', accept: ['PARTIALLY_ALIGNED'] },
    { id: 'x', type: 'CLO-PO', accept: ['ALIGNED'], excludeFromAgreement: true },
  ];
  const runs = [
    new Map([['a', ok('ALIGNED')], ['b', ok('ALIGNED')], ['c', ok('NOT_ALIGNED')], ['d', ok('NOT_ALIGNED')], ['e', ok('PARTIALLY_ALIGNED')], ['x', ok('NOT_ALIGNED')]]),
    new Map([['a', ok('INSUFFICIENT_EVIDENCE')], ['b', ok('NOT_ALIGNED')], ['c', never(['quote_not_found'])], ['d', ok('PARTIALLY_ALIGNED')], ['e', ok('NOT_ALIGNED')]]),
  ];
  const q = qualityOf(items, runs, { flags: OFF });
  assert.deepEqual(q.answers, { attempted: 12, verified: 10, unverified: 2, scored: 9 }, 'c never verified in run 2 and x has no answer there; x has no expectation, so it is not scored');
  assert.deepEqual(q.agreement.strict, { answers: 6, agree: 3, rate: 0.5 }, 'a, b and e (single verdict, not ambiguous) in two runs: a#1, b#2, e#1');
  assert.deepEqual(q.agreement.permissive, { answers: 9, agree: 5, rate: 0.556 });
  const labels = runs.map(run => new Map([...run].map(([id, ans]) => [id, ans.label])));
  const m = scoreEval(items, labels);
  assert.equal(q.agreement.permissive.rate, m.agreement);
  assert.deepEqual([q.falseApprovals.judgedAligned, q.falseApprovals.clearNotAligned, q.falseApprovals.rate], [m.counts.falseNegative, m.counts.clearNot, m.falseNegativeRate]);
  assert.deepEqual([q.falseRejections.judgedOtherwise, q.falseRejections.clearAligned, q.falseRejections.rate], [m.counts.falsePositive, m.counts.clearAligned, m.falsePositiveRate]);
  assert.deepEqual(q.falseApprovals.ids, ['b#1']);
  assert.deepEqual([q.falseRejections.byLabel, q.falseRejections.ids], [{ INSUFFICIENT_EVIDENCE: 1 }, ['a#2']]);
  assert.deepEqual([q.insufficientEvidence.answers, q.insufficientEvidence.accepted, q.insufficientEvidence.notAccepted, q.insufficientEvidence.ids], [1, 0, 1, ['a#2']]);
  // A relationship a run never sent is left out, as metrics.js leaves it out; an answer that never verified is not an answer.
  const sent = qualityOf(items, runs, { flags: OFF, attempted: (r, id) => !(r === 1 && id === 'e') });
  assert.equal(sent.answers.attempted, 11);
  assert.deepEqual(sent.agreement.strict, { answers: 5, agree: 3, rate: 0.6 });
  // Nothing answered is null, never a perfect score.
  const none = qualityOf(items, [new Map()], { flags: OFF });
  assert.deepEqual([none.agreement.strict.rate, none.agreement.permissive.rate, none.falseApprovals.rate, none.evidence.exactRate], [null, null, null, null]);
});

test('P2 quality: Bloom disagreements are counted from the answers\' own levels against the level rule of the current wording', () => {
  assert.equal(breaksLevelRule('CLO-PO', { sourceBloom: 'Create', targetBloom: 'Remember' }), true, 'a CLO below its PO');
  assert.equal(breaksLevelRule('CLO-EGA', { sourceBloom: 'Apply', targetBloom: 'Analyze' }), false, 'a CLO above its EGA is allowed');
  assert.equal(breaksLevelRule('ILO-CLO', { sourceBloom: 'Remember', targetBloom: 'Create' }), true, 'an ILO above its CLO');
  assert.equal(breaksLevelRule('ILO-CLO', { sourceBloom: 'Create', targetBloom: 'Apply' }), false, 'an ILO building toward its CLO');
  assert.equal(breaksLevelRule('CLO-PO', { sourceBloom: 'N/A', targetBloom: 'Apply' }), null);
  assert.equal(breaksLevelRule('Course-CLO', { sourceBloom: 'Create', targetBloom: 'Remember' }), null, 'no level rule for this type');
  const PO = 'Design solutions for complex engineering problems.';
  const items = [
    { id: 'g1', type: 'CLO-PO', category: 'level-gap', accept: ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'], source: PO, target: 'Define the derivative.' },
    { id: 'g2', type: 'ILO-CLO', category: 'level-gap', accept: ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'], source: 'Define limits.', target: 'Design a numerical solver for limits.' },
    { id: 'p1', type: 'CLO-PO', category: 'clear-positive', accept: ['ALIGNED'], source: PO, target: 'Design a bridge truss for given loads.' },
    { id: 'p2', type: 'CLO-PO', category: 'clear-positive', accept: ['ALIGNED'], source: `  ${PO.toUpperCase()} `, target: 'Design a water network.' },
  ];
  const run1 = new Map([
    ['g1', ok('NOT_ALIGNED', { sourceBloom: 'Create', targetBloom: 'Remember' })], // the gap shown
    ['g2', ok('PARTIALLY_ALIGNED', { sourceBloom: 'Apply', targetBloom: 'Apply' })], // the gap not shown
    ['p1', ok('ALIGNED', { sourceBloom: 'Create', targetBloom: 'Create' })],
    ['p2', ok('ALIGNED', { sourceBloom: 'Evaluate', targetBloom: 'Apply' })], // ALIGNED although its CLO is below the PO; the same PO at another level
  ]);
  const run2 = new Map([['g1', ok('NOT_ALIGNED', { sourceBloom: 'Create', targetBloom: 'Remember' })], ['g2', ok('NOT_ALIGNED', { sourceBloom: 'N/A', targetBloom: 'Create' })], ['p1', ok('ALIGNED', { sourceBloom: 'Create', targetBloom: 'Create' })], ['p2', ok('INSUFFICIENT_EVIDENCE', { sourceBloom: 'N/A', targetBloom: 'N/A' })]]);
  const q = qualityOf(items, [run1, run2], { flags: OFF, refused: [{ run: 1, id: 'g2', code: 'invalid_bloom' }, { run: 2, id: 'p1', code: 'invalid_bloom', codes: ['invalid_bloom', 'quote_not_found'] }] });
  assert.deepEqual(q.bloom.levelRuleConflicts, { aligned: 3, breakingTheRule: 1, ids: ['p2#1'] });
  assert.deepEqual(q.bloom.levelGapItems, { answers: 4, gapShown: 2, gapNotShown: 1, notApplicable: 1 });
  assert.equal(q.bloom.notApplicable, 1, 'INSUFFICIENT_EVIDENCE answers judged nothing and are left out');
  assert.deepEqual([q.bloom.sameStatement.repeated, q.bloom.sameStatement.differentLevels], [2, 1], 'the PO given Create and Evaluate in run 1 (case and spacing do not make another statement), and Create twice in run 2');
  assert.deepEqual(q.bloom.sameStatement.examples, [{ statement: PO, levels: { Create: 2, Evaluate: 1 } }]);
  assert.deepEqual(q.bloom.acrossRuns, { compared: 3, changed: 1 }, 'g2 changed; p2 judged nothing in run 2');
  assert.equal(q.bloom.refusedInvalidLevel, 2);
});

test('P2 quality: recommendations against the provisional expectation, and the unsupported ones, in both modes', () => {
  const wrongPo = stageA.items.find(i => i.id === 'cp-bsit-wrongpo'), aligned = { id: 'al', type: 'CLO-PO', accept: ['ALIGNED'], source: 'Apply computing knowledge.', target: 'Apply sorting algorithms.' };
  const gapItem = { id: 'gap', type: 'CLO-PO', category: 'level-gap', accept: ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'], source: 'Design computing solutions.', target: 'List keywords.' };
  const setItem = { id: 'set', type: 'CLO-set', accept: ['PARTIALLY_ALIGNED'], source: 'Course', target: 'CLO 1 ... CLO 2 ...' };
  assert.deepEqual([wrongPo, aligned, gapItem, setItem, { ...gapItem, ambiguous: true }].map(expectedRecommendationOf), ['RETAG_OUTCOME', 'NO_CHANGE', 'REWRITE_TEXT', 'REVIEW_REQUIRED', null]);
  // Mode A: no recommendation field; a failing answer with a text to rewrite carries a draft, so it is a rewrite, and a re-tag cannot be said.
  assert.equal(proposalOf(gapItem, ok('NOT_ALIGNED', { draft: 'Design a solution.' })), 'REWRITE_TEXT');
  assert.equal(proposalOf(setItem, ok('PARTIALLY_ALIGNED')), 'REVIEW_REQUIRED');
  assert.equal(proposalOf(aligned, ok('INSUFFICIENT_EVIDENCE')), 'REVIEW_REQUIRED');
  const legacy = qualityOf([wrongPo, aligned, gapItem], [new Map([['cp-bsit-wrongpo', ok('NOT_ALIGNED', { draft: 'Preserve Filipino heritage by documenting local history in Java programs.' })], ['al', ok('PARTIALLY_ALIGNED', { draft: 'Apply computing knowledge to sort data.' })], ['gap', ok('NOT_ALIGNED', { draft: 'Design computing solutions using keywords.', draftReview: ['copies_reference'] })]])],
    { flags: OFF, refused: [{ run: 1, id: 'gap', code: 'missing_draft' }, { run: 1, id: '*', code: 'invalid_answer' }] });
  assert.deepEqual(legacy.recommendations.proposals, { REWRITE_TEXT: 3 });
  assert.deepEqual(legacy.recommendations.asExpected, { withAnExpectation: 3, matches: 1, byExpected: { RETAG_OUTCOME: { REWRITE_TEXT: 1 }, NO_CHANGE: { REWRITE_TEXT: 1 }, REWRITE_TEXT: { REWRITE_TEXT: 1 } } });
  assert.deepEqual(legacy.recommendations.unsupported, { rewriteForClearAligned: 1, rewriteWhereRetagExpected: 1, draftHeldBackByReview: 1, refusals: { missing_draft: 1 }, total: 4,
    ids: { rewriteForClearAligned: ['al#1'], rewriteWhereRetagExpected: ['cp-bsit-wrongpo#1'], draftHeldBackByReview: ['gap#1'] } });
  // Mode B (Stage A): the answer says what it recommends; a re-tag keeps the text with an empty draft.
  const staged = qualityOf([wrongPo, aligned], [new Map([['cp-bsit-wrongpo', ok('NOT_ALIGNED', { recommendation: 'RETAG_OUTCOME' })], ['al', ok('ALIGNED', { recommendation: 'NO_CHANGE' })]])], { flags: { ...OFF, a: true } });
  assert.deepEqual([staged.mode.id, staged.recommendations.proposals, staged.recommendations.asExpected.matches, staged.recommendations.unsupported.total], ['B', { RETAG_OUTCOME: 1, NO_CHANGE: 1 }, 2, 0]);
});

test('P2 quality: the mapping remedy separates a rewrite of a sound CLO toward the wrong PO from a re-tag, and the remap candidates are reported apart', () => {
  // The P1 answer (docs/ai-eval-anthropic/p1-smoke-result.json, read here as text, not changed): a calculus CLO mapped to the communication PO was
  // rewritten into a communication outcome, the only remedy the legacy contract lets a failing CLO-PO answer give.
  const unrelated = alignment.items.find(i => i.id === 'clo-po-calc-unrelated');
  const p1Draft = 'Communicate the results of limit and derivative analyses of engineering problems clearly to technical and non-technical audiences through written reports and oral explanations.';
  assert.ok(sourceWordsIn(unrelated, p1Draft) >= TOWARD_SOURCE, 'it brings in the PO\'s communicate and audiences');
  assert.equal(sourceWordsIn(unrelated, 'Evaluate limits of rational functions using algebraic simplification.'), 0, 'a rewrite that stays in its own subject brings in none');
  const candidates = alignment.items.filter(i => i.split === 'dev' && remapCandidate(i)).map(i => i.id);
  assert.ok(['clo-po-calc-unrelated', 'clo-po-nurs-unrelated', 'd-po-06', 'd-po-12'].every(id => candidates.includes(id)), JSON.stringify(candidates));
  assert.equal(remapCandidate(stageA.items.find(i => i.id === 'cp-bsit-wrongpo')), false, 'a wrong-po-mapping item has its own expectation: a re-tag');
  const wrongPo = stageA.items.find(i => i.id === 'cp-bsie-wrongpo');
  const legacy = qualityOf([unrelated, wrongPo], [new Map([['clo-po-calc-unrelated', ok('NOT_ALIGNED', { draft: p1Draft })], ['cp-bsie-wrongpo', ok('PARTIALLY_ALIGNED', { draft: 'Develop a system requirements specification as a member of a multidisciplinary team.' })]])], { flags: OFF });
  assert.deepEqual([legacy.mappingRemedy.remapCandidates.failing, legacy.mappingRemedy.remapCandidates.proposals, legacy.mappingRemedy.remapCandidates.rewritesTowardSource], [1, { REWRITE_TEXT: 1 }, 1]);
  assert.deepEqual([legacy.mappingRemedy.retagExpected.proposals, legacy.mappingRemedy.retagExpected.rewritesTowardSource], [{ REWRITE_TEXT: 1 }, 1]);
  assert.deepEqual(legacy.mappingRemedy.rewrites, { drafts: 2, towardSource: 2, threshold: TOWARD_SOURCE });
  assert.deepEqual(legacy.mappingRemedy.remapCandidates.answersById[0], { id: 'clo-po-calc-unrelated', run: 1, label: 'NOT_ALIGNED', proposal: 'REWRITE_TEXT', sourceWords: sourceWordsIn(unrelated, p1Draft), draft: p1Draft });
  const staged = qualityOf([unrelated, wrongPo], [new Map([['clo-po-calc-unrelated', ok('NOT_ALIGNED', { recommendation: 'RETAG_OUTCOME' })], ['cp-bsie-wrongpo', ok('NOT_ALIGNED', { recommendation: 'RETAG_OUTCOME' })]])], { flags: { ...OFF, a: true } });
  assert.deepEqual([staged.mappingRemedy.remapCandidates.proposals, staged.mappingRemedy.retagExpected.proposals, staged.mappingRemedy.rewrites.drafts], [{ RETAG_OUTCOME: 1 }, { RETAG_OUTCOME: 1 }, 0]);
});

test('P2 quality: evidence accuracy counts each quote side of the verified answers and every judgement refused for its quotes', () => {
  const items = ['a', 'b', 'c'].map(id => ({ id, type: 'CLO-PO', accept: ['ALIGNED'], source: 's', target: 't' }));
  const runs = [new Map([['a', ok('ALIGNED')], ['b', ok('ALIGNED', { evidenceMatching: { source: 'whitespace', target: 'exact' } })], ['c', ok('INSUFFICIENT_EVIDENCE', { evidenceMatching: { source: 'not_evaluated', target: 'not_evaluated' } })]])];
  const refused = [{ run: 1, id: 'a', code: 'quote_not_found' }, { run: 1, id: 'b', code: 'quote_wrong_side', codes: ['quote_wrong_side', 'missing_draft'] }, { run: 1, id: 'c', code: 'not_answered' }, { run: 1, id: '*', code: 'invalid_answer' }];
  const q = qualityOf(items, runs, { flags: OFF, refused });
  assert.deepEqual(q.evidence, { sides: { exact: 3, whitespace: 1, not_evaluated: 2 }, exactRate: 0.75, judgementsReturned: 5, refusedForQuotes: 2, refusedRate: 0.4, byCode: { quote_not_found: 1, quote_wrong_side: 1 } });
  assert.deepEqual(q.refusalCodes, { quote_not_found: 1, quote_wrong_side: 1, missing_draft: 1, not_answered: 1, invalid_answer: 1 });
});

test('P2 quality: operations come from the guard\'s summary, and a held-out run lists no item id or statement', () => {
  const item = alignment.items.find(i => i.split === 'dev' && i.category === 'level-gap');
  const usage = { model: 2, promptTokens: 10, completionTokens: 5, cachedTokens: 0, reportedCost: 0, charged: 0.02,
    anthropic: { latencyMs: { answers: 2, median: 100, p90: 200, max: 200 }, inputTokens: 900, cacheCreationInputTokens: 3000, cacheReadInputTokens: 3000, outputTokens: 800, thinkingTokens: 0, thinkingReports: { nonzero: 0, zero: 2, unavailable: 0 }, estimatedCost: 0.0164, notEstimated: 0, chargedThisRun: 0.0198 } };
  const runs = [new Map([[item.id, ok('NOT_ALIGNED', { draft: 'x', sourceBloom: 'Create', targetBloom: 'Remember' })]]), new Map([[item.id, ok('ALIGNED', { sourceBloom: 'Create', targetBloom: 'Apply' })]])];
  const q = qualityOf([item], runs, { flags: OFF, usage });
  assert.deepEqual(q.operations, { requests: 2, latencyMs: usage.anthropic.latencyMs, tokens: { input: 900, cacheWrite: 3000, cacheRead: 3000, output: 800, thinking: 0, thinkingReports: { nonzero: 0, zero: 2, unavailable: 0 } }, estimatedCost: 0.0164, notEstimated: 0, chargedByGuard: 0.0198, estimatedPerVerifiedRelationship: 0.0082 });
  const openrouter = qualityOf([item], runs, { flags: OFF, usage: { ...usage, anthropic: undefined } });
  assert.deepEqual(openrouter.operations, { requests: 2, latencyMs: null, tokens: { prompt: 10, completion: 5, cached: 0 }, reportedCost: 0, chargedByGuard: 0.02 });
  const hidden = qualityOf([item], runs, { flags: OFF, usage, withIds: false }), text = JSON.stringify(hidden);
  assert.ok(!text.includes(item.id) && !text.includes(item.source.slice(0, 20)) && !text.includes(item.target.slice(0, 20)), text);
  assert.deepEqual(hidden.bloom.levelRuleConflicts, { aligned: 1, breakingTheRule: 1 }, 'the counts stay');
  const lines = describeQuality(q);
  assert.match(lines[0], /^Evaluation mode A: legacy academic alignment benchmark \(stages on: none; recommendation field no\)$/);
  assert.match(lines[1], /^strict agreement n\/a \[0\/0 answers on single-verdict items\]; permissive 50% \[1\/2\]$/, 'a level-gap item accepts two verdicts');
  assert.match(lines.at(-1), /^operations: 2 request\(s\); latency median 100 ms, p90 200 ms, max 200 ms; tokens .*estimated \$0\.0164 at the published prices, \$0\.0082 per verified relationship; charged by the guard \$0\.0198$/);
  assert.ok(!describeQuality(hidden).join('\n').includes(item.id));
});
