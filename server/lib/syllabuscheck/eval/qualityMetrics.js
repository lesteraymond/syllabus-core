'use strict';
// P2 preparation: the quality measures an evaluation reports beside the agreement of metrics.js, so that the two modes P2 compares are reported apart
// and on the same measures:
//   A  legacy academic alignment benchmark   no stage on: the alignment-10 wording the application uses today. The answer has no recommendation
//                                            field, and a failing relationship that has a text to rewrite must carry a draft (missing_draft)
//   B  enhanced staged semantic evaluation   a stage on: the staged wording; under Stage A or B3 the answer also says what kind of change it
//                                            recommends, and a sound text with a wrong tag can be re-tagged with an empty draft (RETAG_OUTCOME)
// The mode follows the wording the run used (its stage flags), not the flags typed. Every expectation here is provisional (developer-written, not
// reviewed by faculty): a measure counts what the answers did against those expectations and against the prompt's own rules, never faculty accuracy.
// Pure: no I/O and no provider call; nothing here changes a label, a validation, a retry, an official score or a gate.
//
// An answer is the final answer of one relationship in one run; a relationship a run never sent is left out, as metrics.js leaves it out.
//   agreement.strict      items with exactly one accepted verdict, not ambiguous: answers giving that verdict
//   agreement.permissive  answers giving any accepted verdict (metrics.js agreement: every scored item, ambiguous ones included)
//   falseApprovals        clear not-aligned items (ALIGNED not accepted, not ambiguous) judged ALIGNED (metrics.js falseNegative)
//   falseRejections       clear ALIGNED items (accept is exactly ALIGNED) judged otherwise, by the label given (metrics.js falsePositive)
//   insufficientEvidence  INSUFFICIENT_EVIDENCE answers, on items that accept it or not (the prompt allows it only for a missing or unreadable text)
//   bloom                 no dataset states a Bloom level, so this counts where the answers' own levels disagree: with the level rule of the current
//                         wording (variants.js CLO_BULLET and ILO_BULLET: an ALIGNED CLO-PO or CLO-EGA whose CLO is below the PO/EGA, an ALIGNED
//                         ILO-CLO whose ILO is above the CLO), with the gap a level-gap item is built on, with another answer on the same statement in
//                         the same run, and with the same relationship in another run; and the answers refused for a level outside the list
//   recommendations       what the verified answers propose (under mode A it follows from the label and the type, as gemini.js checkOne derives it);
//                         how often that matches the provisional expectation (the rule of scripts/live-smoke-eval.cjs: a sound text with a wrong tag is
//                         a re-tag); and the unsupported ones: a rewrite for an item that needs no change, a rewrite where a re-tag is expected, a
//                         draft the static review held back, and the refusals of the recommendation contract across attempts
//   mappingRemedy         whether an answer rewrites a sound outcome where changing its mapping would suit better: the items where a re-tag is expected,
//                         the remap candidates (CLO-PO or CLO-EGA, clear-negative or wrong-program: the CLO may be sound and the PO/EGA the wrong one;
//                         faculty to confirm, never scored), and every rewrite counted by whether it brings in at least two content words of the
//                         source (the PO/EGA, or the CLO of an ILO-CLO) that the text it rewrites did not have (a heuristic, English only)
//   evidence              how the verified answers' quotes matched the texts (exactly, or once whitespace is evened out), and the judgements refused
//                         for their quotes across attempts
//   operations            requests, latency, tokens and the cost from the guard's summary, and the estimated cost per verified relationship
// Item ids and statements are listed only with withIds (never for a held-out run that is not revealed).
const { anyStage, recommendOn } = require('../stages');
const { isNoRewrite } = require('../gemini');
const { stems } = require('../answerReview');

const BLOOM = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']; // gemini.js's levels, lowest first (tested against its prompt and validate)
const MODES = Object.freeze({ A: 'legacy academic alignment benchmark', B: 'enhanced staged semantic evaluation' });
const FAILING = new Set(['PARTIALLY_ALIGNED', 'NOT_ALIGNED']);
// The level rule of each type (variants.js): the CLO (target) must not be below its PO/EGA (source); the ILO (target) must not be above its CLO (source).
const LEVEL_RULE = { 'CLO-PO': 'not_below', 'CLO-EGA': 'not_below', 'ILO-CLO': 'not_above' };
const RETAG_CATEGORIES = new Set(['wrong-po-mapping', 'wrong-clo']);
const REMAP_CATEGORIES = new Set(['clear-negative', 'wrong-program']);
const TOWARD_SOURCE = 2; // content words of the source a rewrite brings in before it counts as rewritten toward the source
const EVIDENCE_CODES = ['quote_missing', 'quote_not_found', 'quote_wrong_side', 'quotes_swapped', 'quote_from_other_pair'];
const RECOMMENDATION_CODES = ['invalid_recommendation', 'recommendation_conflicts_label', 'recommendation_not_allowed', 'retag_not_applicable', 'retag_with_rewrite', 'missing_draft', 'draft_too_long'];
const NOT_A_JUDGEMENT = new Set(['not_answered', 'empty_answer', 'invalid_answer', 'invalid_json']); // a refusal that names no judgement the model gave

const rate = (n, d) => (d ? Math.round((n / d) * 1000) / 1000 : null);
const round = v => Math.round(v * 1e8) / 1e8;
const tally = values => values.reduce((out, v) => ({ ...out, [v]: (out[v] || 0) + 1 }), {});
const codesOf = r => r.codes || [r.code];

const modeOf = (flags = {}) => {
  const id = anyStage(flags) ? 'B' : 'A';
  return { id, name: MODES[id], stagesOn: Object.keys(flags).filter(k => flags[k]), recommendationField: recommendOn(flags) };
};
// Whether an answer's own levels break the level rule of its type: true or false, or null for a type without a rule or a level that is N/A.
const breaksLevelRule = (type, a) => {
  const rule = LEVEL_RULE[type], s = BLOOM.indexOf(a.sourceBloom), t = BLOOM.indexOf(a.targetBloom);
  return !rule || s < 0 || t < 0 ? null : rule === 'not_below' ? t < s : t > s;
};
// The provisional expectation of an item's recommendation (scripts/live-smoke-eval.cjs expectedRecommendationOf): none for an ambiguous item.
const expectedRecommendationOf = item => (item.ambiguous ? null : item.accept.every(label => label === 'ALIGNED') ? 'NO_CHANGE' : RETAG_CATEGORIES.has(item.category) ? 'RETAG_OUTCOME' : isNoRewrite(item.type) ? 'REVIEW_REQUIRED' : 'REWRITE_TEXT');
const remapCandidate = item => LEVEL_RULE[item.type] === 'not_below' && !item.ambiguous && !item.accept.includes('ALIGNED') && REMAP_CATEGORIES.has(item.category);
// What a verified answer proposes: its recommendation, or without the field the one gemini.js checkOne derives (a failing answer with a text to rewrite
// carries a draft: a rewrite).
const proposalOf = (item, a) => a.recommendation || (a.label === 'ALIGNED' ? 'NO_CHANGE' : !FAILING.has(a.label) || isNoRewrite(item.type) ? 'REVIEW_REQUIRED' : 'REWRITE_TEXT');
// How many content words of the source a draft brings in that the text it rewrites (the target) did not have (answerReview.js stems).
const sourceWordsIn = (item, draft) => { const source = stems(item.source), target = stems(item.target); return [...stems(draft)].filter(w => source.has(w) && !target.has(w)).length; };

function qualityOf(items, answerRuns, { flags = {}, attempted = null, refused = [], usage = null, withIds = true } = {}) {
  const all = [];
  for (const item of items) answerRuns.forEach((run, r) => { if (!attempted || attempted(r, item.id)) all.push({ item, run: r + 1, a: run.get(item.id) || null }); });
  const verified = all.filter(x => x.a && x.a.label && !x.a.unverified), scored = verified.filter(x => x.item.excludeFromAgreement !== true);
  const ids = list => (withIds ? list.map(x => `${x.item.id}#${x.run}`) : undefined);

  const strict = scored.filter(x => !x.item.ambiguous && x.item.accept.length === 1), strictAgree = strict.filter(x => x.a.label === x.item.accept[0]);
  const permissiveAgree = scored.filter(x => x.item.accept.includes(x.a.label));
  const clearNot = scored.filter(x => !x.item.ambiguous && !x.item.accept.includes('ALIGNED')), approved = clearNot.filter(x => x.a.label === 'ALIGNED');
  const clearAligned = scored.filter(x => !x.item.ambiguous && x.item.accept.length === 1 && x.item.accept[0] === 'ALIGNED'), rejected = clearAligned.filter(x => x.a.label !== 'ALIGNED');
  const insufficient = scored.filter(x => x.a.label === 'INSUFFICIENT_EVIDENCE'), unaccepted = insufficient.filter(x => !x.item.accept.includes('INSUFFICIENT_EVIDENCE'));

  // Bloom: the answers that judged the texts (INSUFFICIENT_EVIDENCE did not), on the types with a level rule.
  const judged = verified.filter(x => x.a.label !== 'INSUFFICIENT_EVIDENCE'), ruled = judged.filter(x => LEVEL_RULE[x.item.type]);
  const conflicts = ruled.filter(x => x.a.label === 'ALIGNED' && breaksLevelRule(x.item.type, x.a) === true);
  const gap = ruled.filter(x => x.item.category === 'level-gap').map(x => breaksLevelRule(x.item.type, x.a));
  const statements = new Map(); // `${run} ${text}` -> the levels its answers gave it (N/A is a level here)
  for (const x of judged) for (const [text, level] of [[x.item.source, x.a.sourceBloom], [x.item.target, x.a.targetBloom]]) {
    if (!level) continue;
    const key = `${x.run} ${String(text).replace(/\s+/g, ' ').trim().toLowerCase()}`;
    (statements.get(key) || statements.set(key, { text, levels: [] }).get(key)).levels.push(level);
  }
  const repeated = [...statements.values()].filter(s => s.levels.length > 1), differing = repeated.filter(s => new Set(s.levels).size > 1);
  const runsOf = new Map();
  for (const x of judged) (runsOf.get(x.item.id) || runsOf.set(x.item.id, []).get(x.item.id)).push(`${x.a.sourceBloom}|${x.a.targetBloom}`);
  const compared = [...runsOf.values()].filter(v => v.length > 1);
  const refusedCodes = refused.flatMap(codesOf), judgementsRefused = refused.filter(r => r.id !== '*' && !codesOf(r).every(c => NOT_A_JUDGEMENT.has(c)));

  // Recommendations: what every verified answer proposes, against the provisional expectation where an item has one.
  const proposed = verified.map(x => ({ ...x, proposal: proposalOf(x.item, x.a) }));
  const expected = proposed.filter(x => x.item.excludeFromAgreement !== true).map(x => ({ ...x, expected: expectedRecommendationOf(x.item) })).filter(x => x.expected);
  const byExpected = {};
  for (const x of expected) (byExpected[x.expected] ||= {})[x.proposal] = (byExpected[x.expected][x.proposal] || 0) + 1;
  const rewriteForAligned = proposed.filter(x => x.proposal === 'REWRITE_TEXT' && !x.item.ambiguous && x.item.accept.length === 1 && x.item.accept[0] === 'ALIGNED');
  const rewriteForRetag = expected.filter(x => x.expected === 'RETAG_OUTCOME' && x.proposal === 'REWRITE_TEXT'), withheld = verified.filter(x => x.a.draftReview?.length);
  const recommendationRefusals = tally(refusedCodes.filter(c => RECOMMENDATION_CODES.includes(c)));

  // The mapping remedy: the answers on the items where a re-tag is expected, on the remap candidates, and every rewrite by whether it moves toward the source.
  const rewrites = proposed.filter(x => x.proposal === 'REWRITE_TEXT' && FAILING.has(x.a.label) && LEVEL_RULE[x.item.type] && String(x.a.draft || '').trim()).map(x => ({ ...x, words: sourceWordsIn(x.item, x.a.draft) }));
  const remedyOf = list => {
    const failing = list.filter(x => FAILING.has(x.a.label)), toward = failing.filter(x => x.proposal === 'REWRITE_TEXT' && sourceWordsIn(x.item, x.a.draft || '') >= TOWARD_SOURCE);
    return { answers: list.length, failing: failing.length, proposals: tally(failing.map(x => x.proposal)), rewritesTowardSource: toward.length,
      ...(withIds ? { answersById: list.map(x => ({ id: x.item.id, run: x.run, label: x.a.label, proposal: x.proposal, ...(x.proposal === 'REWRITE_TEXT' ? { sourceWords: sourceWordsIn(x.item, x.a.draft || ''), draft: x.a.draft } : {}) })) } : {}) };
  };

  // Evidence: each side of a verified answer, and every judgement refused for its quotes.
  const sides = tally(verified.flatMap(x => ['source', 'target'].map(side => x.a.evidenceMatching?.[side] || 'not_evaluated')));
  const quoteRefused = judgementsRefused.filter(r => codesOf(r).some(c => EVIDENCE_CODES.includes(c)));

  const a = usage?.anthropic;
  const operations = !usage ? null : a
    ? { requests: usage.model, latencyMs: a.latencyMs, tokens: { input: a.inputTokens, cacheWrite: a.cacheCreationInputTokens, cacheRead: a.cacheReadInputTokens, output: a.outputTokens, thinking: a.thinkingTokens, thinkingReports: a.thinkingReports },
      estimatedCost: a.estimatedCost, notEstimated: a.notEstimated, chargedByGuard: a.chargedThisRun, estimatedPerVerifiedRelationship: verified.length ? round(a.estimatedCost / verified.length) : null }
    : { requests: usage.model, latencyMs: null, tokens: { prompt: usage.promptTokens, completion: usage.completionTokens, cached: usage.cachedTokens }, reportedCost: usage.reportedCost, chargedByGuard: usage.charged };

  return {
    mode: modeOf(flags),
    note: 'Expectations are provisional (developer-written, not reviewed by faculty). These measures compare the answers with those expectations and with the prompt\'s own rules; they are not faculty accuracy, and the Bloom and mapping measures are heuristics for review.',
    answers: { attempted: all.length, verified: verified.length, unverified: all.length - verified.length, scored: scored.length },
    agreement: { strict: { answers: strict.length, agree: strictAgree.length, rate: rate(strictAgree.length, strict.length) }, permissive: { answers: scored.length, agree: permissiveAgree.length, rate: rate(permissiveAgree.length, scored.length) } },
    falseApprovals: { clearNotAligned: clearNot.length, judgedAligned: approved.length, rate: rate(approved.length, clearNot.length), ...(withIds ? { ids: ids(approved) } : {}) },
    falseRejections: { clearAligned: clearAligned.length, judgedOtherwise: rejected.length, rate: rate(rejected.length, clearAligned.length), byLabel: tally(rejected.map(x => x.a.label)), ...(withIds ? { ids: ids(rejected) } : {}) },
    insufficientEvidence: { answers: insufficient.length, accepted: insufficient.length - unaccepted.length, notAccepted: unaccepted.length, rate: rate(insufficient.length, scored.length), ...(withIds ? { ids: ids(insufficient) } : {}) },
    bloom: {
      answers: ruled.length, notApplicable: ruled.filter(x => breaksLevelRule(x.item.type, x.a) === null).length,
      levelRuleConflicts: { aligned: ruled.filter(x => x.a.label === 'ALIGNED').length, breakingTheRule: conflicts.length, ...(withIds ? { ids: ids(conflicts) } : {}) },
      levelGapItems: { answers: gap.length, gapShown: gap.filter(v => v === true).length, gapNotShown: gap.filter(v => v === false).length, notApplicable: gap.filter(v => v === null).length },
      sameStatement: { repeated: repeated.length, differentLevels: differing.length, ...(withIds ? { examples: differing.slice(0, 5).map(s => ({ statement: s.text.slice(0, 160), levels: tally(s.levels) })) } : {}) },
      acrossRuns: { compared: compared.length, changed: compared.filter(v => new Set(v).size > 1).length },
      refusedInvalidLevel: refusedCodes.filter(c => c === 'invalid_bloom').length,
    },
    recommendations: {
      proposals: tally(proposed.map(x => x.proposal)),
      asExpected: { withAnExpectation: expected.length, matches: expected.filter(x => x.proposal === x.expected).length, byExpected },
      unsupported: { rewriteForClearAligned: rewriteForAligned.length, rewriteWhereRetagExpected: rewriteForRetag.length, draftHeldBackByReview: withheld.length, refusals: recommendationRefusals,
        total: rewriteForAligned.length + rewriteForRetag.length + withheld.length + Object.values(recommendationRefusals).reduce((n, v) => n + v, 0),
        ...(withIds ? { ids: { rewriteForClearAligned: ids(rewriteForAligned), rewriteWhereRetagExpected: ids(rewriteForRetag), draftHeldBackByReview: ids(withheld) } } : {}) },
    },
    mappingRemedy: {
      retagExpected: remedyOf(proposed.filter(x => expectedRecommendationOf(x.item) === 'RETAG_OUTCOME')),
      remapCandidates: { rule: 'CLO-PO or CLO-EGA, not ambiguous, ALIGNED not accepted, category clear-negative or wrong-program: faculty to confirm whether a re-tag or a rewrite is right; never scored', ...remedyOf(proposed.filter(x => remapCandidate(x.item))) },
      rewrites: { drafts: rewrites.length, towardSource: rewrites.filter(x => x.words >= TOWARD_SOURCE).length, threshold: TOWARD_SOURCE },
    },
    evidence: { sides, exactRate: rate(sides.exact || 0, (sides.exact || 0) + (sides.whitespace || 0)), judgementsReturned: verified.length + judgementsRefused.length,
      refusedForQuotes: quoteRefused.length, refusedRate: rate(quoteRefused.length, verified.length + judgementsRefused.length), byCode: tally(quoteRefused.flatMap(codesOf).filter(c => EVIDENCE_CODES.includes(c))) },
    refusalCodes: tally(refusedCodes),
    operations,
  };
}

const pct = v => (v === null || v === undefined ? 'n/a' : `${Math.round(v * 1000) / 10}%`);
const describeMode = mode => `Evaluation mode ${mode.id}: ${mode.name} (stages on: ${mode.stagesOn.join(', ') || 'none'}; recommendation field ${mode.recommendationField ? 'yes' : 'no'})`;
// The console report: one line per measure.
function describeQuality(q) {
  const b = q.bloom, r = q.recommendations, m = q.mappingRemedy, e = q.evidence, o = q.operations, u = r.unsupported;
  const remedy = (name, x) => `${name} ${x.answers} answer(s), ${x.failing} failing (${JSON.stringify(x.proposals)}; ${x.rewritesTowardSource} rewritten toward the source)`;
  return [
    describeMode(q.mode),
    `strict agreement ${pct(q.agreement.strict.rate)} [${q.agreement.strict.agree}/${q.agreement.strict.answers} answers on single-verdict items]; permissive ${pct(q.agreement.permissive.rate)} [${q.agreement.permissive.agree}/${q.agreement.permissive.answers}]`,
    `false approvals ${pct(q.falseApprovals.rate)} [${q.falseApprovals.judgedAligned}/${q.falseApprovals.clearNotAligned}]; false rejections ${pct(q.falseRejections.rate)} [${q.falseRejections.judgedOtherwise}/${q.falseRejections.clearAligned} ${JSON.stringify(q.falseRejections.byLabel)}]; insufficient evidence ${q.insufficientEvidence.answers} (${q.insufficientEvidence.notAccepted} where not accepted)`,
    `Bloom (the answers' own levels): ${b.levelRuleConflicts.breakingTheRule} of ${b.levelRuleConflicts.aligned} ALIGNED answers break the level rule; level-gap items ${b.levelGapItems.gapShown} of ${b.levelGapItems.answers} show the gap (${b.levelGapItems.notApplicable} N/A); the same statement at different levels ${b.sameStatement.differentLevels} of ${b.sameStatement.repeated}; changed between runs ${b.acrossRuns.changed} of ${b.acrossRuns.compared}; refused for an invalid level ${b.refusedInvalidLevel}`,
    `recommendations ${JSON.stringify(r.proposals)}; as provisionally expected ${r.asExpected.matches} of ${r.asExpected.withAnExpectation}; unsupported ${u.total}: a rewrite for a clear-ALIGNED item ${u.rewriteForClearAligned}, a rewrite where a re-tag is expected ${u.rewriteWhereRetagExpected}, drafts held back by the review ${u.draftHeldBackByReview}, contract refusals ${JSON.stringify(u.refusals)}`,
    `mapping remedy: ${remedy('re-tag expected', m.retagExpected)}; ${remedy('remap candidates', m.remapCandidates)}; rewrites bringing in ${m.rewrites.threshold}+ source words ${m.rewrites.towardSource} of ${m.rewrites.drafts}`,
    `evidence: ${e.sides.exact || 0} quote sides exact, ${e.sides.whitespace || 0} after whitespace, ${e.sides.not_evaluated || 0} not evaluated (exact ${pct(e.exactRate)}); judgements refused for their quotes ${e.refusedForQuotes} of ${e.judgementsReturned} returned ${JSON.stringify(e.byCode)}`,
    ...(o ? [`operations: ${o.requests} request(s); latency ${o.latencyMs ? `median ${o.latencyMs.median} ms, p90 ${o.latencyMs.p90} ms, max ${o.latencyMs.max} ms` : 'n/a'}; tokens ${JSON.stringify(o.tokens)}; ${o.estimatedCost !== undefined ? `estimated $${o.estimatedCost} at the published prices, $${o.estimatedPerVerifiedRelationship ?? 'n/a'} per verified relationship; ` : ''}charged by the guard $${o.chargedByGuard}`] : []),
  ];
}

module.exports = { qualityOf, describeQuality, describeMode, modeOf, breaksLevelRule, expectedRecommendationOf, remapCandidate, proposalOf, sourceWordsIn, BLOOM, MODES, TOWARD_SOURCE };
