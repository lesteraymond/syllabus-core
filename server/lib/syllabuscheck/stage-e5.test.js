// Stage E.5 regression cases 1-10: the Ref-relevance wording (courseContext / bibliographicEntry, courseContextQuote / referenceEntryQuote, basis
// title_and_venue), the corrective retry of a staged check (a relationship is asked again only WITH a correction, and a problem that comes back after its
// correction stops it), empty and partial answers (detected, never made up, corrected once), and failures that are not answers (a timeout, an exhausted
// budget). Then the invariants: with every stage off the prompt, the requests and the cache are as they were, and the official result (score, pass,
// readiness, deductions, gate) is the same with the stages on and off. Every model here is a scripted fake: no test reaches a provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { run } = require('./engine');
const gemini = require('./gemini');
const { verifyAnswer, contractOf, judgeBatch, rejections, salvage, errorClassOf, failureClassOf, classifyFailure, correctionOf, userMessageOf, requestOpenRouter, promptVersionOf, systemPromptOf, pairKey, courseKeyOf, courseOf,
  pairsOf, aspectKeysFor, isNoRewrite, resetProviderBlock, verifiedAlignment, ASPECTS, MAX_ATTEMPTS, CONTRACT_CODES, EVIDENCE_CODES, COVERAGE_CODES, OUTPUT_CODES } = gemini;
const { stageFlags, recommendOn, STAGE_REVISION, D2, RETRY } = require('./stages');
const { createGuard } = require('./eval/providerGuard');
const { programSyllabus } = require('./eval/programSyllabi');
const { POLICY, aiGate } = require('./policy');
const standard = require('../compliance/standard-v4.json');

test.afterEach(() => resetProviderBlock());
const STAGES = ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'];
const flagsOf = on => Object.fromEntries(on.map(k => ['SYLLABUS_CHECK_STAGE_' + k, 'on']));
const MODEL = 'minimax/minimax-m3.1-flash', KEY = 'sk-or-v1-test-only-0123456789abcdef';
// The live evaluation's configuration: OpenRouter, the paid MiniMax model, every advisory stage on.
const OR = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: KEY, OPENROUTER_MODEL: MODEL, SYLLABUS_CHECK_VALUES_FILE: 'no-such-file.json', ...flagsOf(STAGES) };
const ALL = { ...OR }, NONE = { ...OR, ...Object.fromEntries(STAGES.map(k => ['SYLLABUS_CHECK_STAGE_' + k, 'off'])) };

// ---- the evaluation items (server/lib/syllabuscheck/eval), as scripts/live-smoke-eval.cjs sends them ----
const DATASETS = ['stage-a', 'stage-b', 'stage-b3', 'stage-c', 'stage-d1', 'stage-d2'].map(name => require(`./eval/${name}-dataset.json`));
const itemOf = id => DATASETS.flatMap(d => d.items).find(item => item.id === id);
const pairOf = id => { const item = itemOf(id); return { id: item.id, type: item.type, source: item.source, target: item.target, path: 'eval', targetPath: isNoRewrite(item.type) ? null : 'eval' }; };
const courseFor = key => { const { code, title, program, yearLevel, description } = DATASETS.find(d => d.courses?.[key]).courses[key]; return { code, title, program, yearLevel, description }; };
const BSIE = courseFor('syseng'), PROG1 = courseFor('prog1');
const SYSENG1 = ['cc-syseng-aligned', 'cp-bsie-real2', 'wi-syseng-unrelated', 'ic-syseng-ok'].map(pairOf);
const SYSENG2 = ['af-syseng-irrelevant', 'as-syseng-good', 'vu-syseng-community', 'rr-syseng-unrelated'].map(pairOf);
const RR_BSIE = pairOf('rr-syseng-unrelated'), RR_PROG1 = pairOf('rr-prog1-relevant');

// ---- answers ----
const ANSWER_FIELDS = { 'Activity-fit': { teaching: 'sound', learnerSupport: 'adequate', responsible: 'none' }, 'Assessment-fit': { measures: 'yes', evidence: 'observable', level: 'matches', responsible: 'none' }, 'Value-use': { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits', responsible: 'none' }, 'Ref-relevance': { relevance: 'relevant', basis: 'title_and_venue' } };
const answerFor = (pair, fields = {}) => ({ id: pair.id, label: 'ALIGNED', explanation: 'The scripted model judged this pair.', sourceQuote: pair.source.slice(0, 16), targetQuote: pair.target.slice(0, 16), sourceBloom: 'N/A', targetBloom: 'N/A', recommendation: 'NO_CHANGE', draft: '', ...(ANSWER_FIELDS[pair.type] || {}), ...fields });
// The Ref-relevance answers of the BSIE item: right, and with the two quotes swapped (the Stage E.4 failure, reproduced on its own text).
const RIGHT = { label: 'NOT_ALIGNED', recommendation: 'REVIEW_REQUIRED', explanation: 'The entry is about medieval architecture, not systems engineering.', sourceQuote: 'Systems Engineering', targetQuote: 'A history of medieval architecture', relevance: 'unrelated', basis: 'title_only' };
const SWAPPED = { ...RIGHT, sourceQuote: 'A history of medieval architecture', targetQuote: 'Systems Engineering' };
const json = answers => JSON.stringify({ judgements: answers });
const verify = (answers, pairs, env = ALL, course = BSIE) => verifyAnswer(json(answers), pairs, contractOf(env, course));
const refusalOf = (answers, pairs, env = ALL) => { try { verify(answers, pairs, env); } catch (error) { return error; } return assert.fail('the answer was accepted'); };

// A request as the application makes it (requestOpenRouter, the strict json_schema path), through a fake transport that records every body.
// reply(documentData, n, corrections) returns the judgements (or a raw string) for the n-th request.
function router(reply, { env = ALL, course = BSIE } = {}) {
  const bodies = [];
  const transport = async (url, init) => {
    const body = JSON.parse(init.body), user = JSON.parse(body.messages[1].content);
    bodies.push(body);
    const content = reply(user.document_data, bodies.length, user.corrections || []);
    return new Response(JSON.stringify({ model: MODEL, choices: [{ finish_reason: 'stop', message: { content: typeof content === 'string' ? content : json(content) } }] }), { status: 200 });
  };
  const userOf = n => JSON.parse(bodies[n].messages[1].content);
  return { bodies, userOf, transport, request: (batch, options = {}) => requestOpenRouter(batch, { ...options, env, course, transport }) };
}
const staged = (r, batch, history) => judgeBatch(r.request, batch, { halve: true, ...(history ? { history } : {}) });

// ---------------- 1-3: the Ref-relevance evidence contract ----------------
test('E.5 #1 correct Ref-relevance quotations: courseContextQuote from the course context, referenceEntryQuote from the bibliographic entry, basis title_and_venue', async () => {
  const [j] = verify([answerFor(RR_BSIE, RIGHT)], [RR_BSIE]);
  assert.deepEqual([j.label, j.recommendation, j.sourceQuote, j.targetQuote], ['NOT_ALIGNED', 'REVIEW_REQUIRED', 'Systems Engineering', 'A history of medieval architecture']);
  assert.deepEqual(j.evidenceMatching, { source: 'exact', target: 'exact' });
  assert.deepEqual(j.aspects.values, { relevance: 'unrelated', basis: 'title_only' });
  const [k] = verify([answerFor(RR_PROG1, { sourceQuote: 'Java programming', targetQuote: 'Fundamentals of Java programming', relevance: 'relevant', basis: 'title_and_venue' })], [RR_PROG1], ALL, PROG1);
  assert.deepEqual([k.label, k.aspects.values.basis, k.aspects.invalid], ['ALIGNED', 'title_and_venue', []]);
  // the basis no longer says "source": the earlier value is malformed (recorded, never read as a pass) and the strict schema does not offer it
  assert.deepEqual(ASPECTS.basis, ['title_and_venue', 'title_only', 'insufficient', 'not_assessed']);
  const [old] = verify([answerFor(RR_PROG1, { sourceQuote: 'Java programming', targetQuote: 'Fundamentals of Java programming', basis: 'title_and_source' })], [RR_PROG1], ALL, PROG1);
  assert.deepEqual(old.aspects.invalid, ['basis']);
  const r = router(() => []);
  await r.request([RR_BSIE]).catch(() => {});
  const schema = r.bodies[0].response_format.json_schema.schema.properties.judgements.items.properties.basis;
  assert.deepEqual(schema.enum, ['title_and_venue', 'title_only', 'insufficient', 'not_assessed']);
});

test('E.5 #2 swapped course/reference quotations are refused (quotes_swapped) and never accepted; the refused quotes are kept for debugging', () => {
  // the Stage E.4 answer to rr-prog1-relevant, exactly: the reference title as sourceQuote, the course title as targetQuote
  const e4 = answerFor(RR_PROG1, { sourceQuote: 'Fundamentals of Java programming', targetQuote: 'IT 202 - Computer Programming 1 (Fundamentals of Programming)' });
  const error = refusalOf([e4], [RR_PROG1]);
  assert.deepEqual([error.code, error.codes, error.unverified], ['quotes_swapped', ['quotes_swapped'], true]);
  assert.deepEqual(error.salvaged, [], 'a swapped answer is not kept');
  assert.deepEqual(error.rejected, [{ id: RR_PROG1.id, reason: 'AI quotes are swapped: the source quote is copied from the target text and the target quote from the source text', code: 'quotes_swapped',
    problems: [{ code: 'quotes_swapped', side: 'both' }], given: { sourceQuote: 'Fundamentals of Java programming', targetQuote: 'IT 202 - Computer Programming 1 (Fundamentals of Programming)' } }]);
  // one quote on the wrong side alone is its own code, and names its side
  const one = refusalOf([answerFor(RR_BSIE, { ...RIGHT, targetQuote: 'Systems Engineering' })], [RR_BSIE]);
  assert.deepEqual([one.code, one.rejected[0].problems], ['quote_wrong_side', [{ code: 'quote_wrong_side', side: 'target' }]]);
  // the correction for it names the two texts of a Ref-relevance pair by their roles
  const fix = correctionOf(RR_PROG1, error.rejected[0]);
  assert.deepEqual([fix.id, fix.refused], [RR_PROG1.id, ['quotes_swapped']]);
  assert.match(fix.instruction, /sourceQuote must be copied from the course context \(the pair's "source" text\) and targetQuote from the bibliographic entry \(the pair's "target" text\)/);
  assert.deepEqual(fix.previousQuotes, error.rejected[0].given);
  assert.deepEqual(correctionOf(RR_PROG1, error.rejected[0]), fix, 'the same refusal always gives the same correction');
  assert.ok(!/ALIGNED|relevant|unrelated/.test(fix.instruction), 'a correction never says what the verdict should be');
});

// Three references of one course share its course context, so a quote from another reference's entry is in the request but not in this pair.
const CONTEXT = RR_BSIE.source;
const ref = (n, target) => ({ id: `ref-books-${n}`, type: 'Ref-relevance', source: CONTEXT, target, path: `refs.books.items[${n}]`, targetPath: null });
const REFS = [ref(0, 'Lim, H. (2017). A history of medieval architecture. Example Press.'), ref(1, 'Cruz, A. (2019). Systems engineering and analysis. Example Press.'), ref(2, 'Tan, R. (2020). Requirements engineering for engineered systems. Example Press.')];
const refRight = pair => answerFor(pair, pair.id === 'ref-books-0' ? RIGHT : { sourceQuote: 'Systems Engineering', targetQuote: pair.target.slice(0, 16) });

test('E.5 #3 a quotation copied from another relationship is refused (quote_from_other_pair), never accepted, and that relationship is asked again ALONE with a correction', async () => {
  const [a, b, c] = REFS;
  const r = router((data, n, corrections) => data.map(pair => {
    if (corrections.some(x => x.id === pair.id)) return refRight(pair);
    if (pair.id === a.id) return answerFor(a, { ...RIGHT, targetQuote: 'Systems engineering and analysis' }); // the title of b's entry
    if (pair.id === c.id) return answerFor(c, { sourceQuote: 'Systems thinking and design' }); // in no text: another problem, to show the grouping
    return refRight(pair);
  }));
  const out = await staged(r, REFS);
  assert.deepEqual(r.bodies.map((_, n) => r.userOf(n).document_data.map(p => p.id)), [[a.id, b.id, c.id], [c.id], [a.id]], 'a is asked alone, never again beside b');
  assert.deepEqual(r.userOf(1).corrections.map(x => [x.id, x.refused]), [[c.id, ['quote_not_found']]]);
  const fix = r.userOf(2).corrections[0];
  assert.deepEqual([fix.id, fix.refused, fix.previousQuotes.targetQuote], [a.id, ['quote_from_other_pair'], 'Systems engineering and analysis']);
  assert.match(fix.instruction, /targetQuote must be copied from this relationship's own text \(the bibliographic entry \(the pair's "target" text\)\); the refused one was copied from another relationship \(ref-books-1\)/);
  assert.ok(out.every(j => !j.unverified), 'all three verify; b was never asked again');
  assert.deepEqual(out.find(j => j.id === a.id).targetQuote, 'A history of medieval architecture');
});

// ---------------- 4-5: corrective retries ----------------
test('E.5 #4 repeated identical quotation errors: corrected once, and the same error after the correction stops it; no identical request is sent again', async () => {
  const r = router(data => data.map(pair => (pair.id === RR_BSIE.id ? answerFor(pair, SWAPPED) : answerFor(pair))));
  const out = await staged(r, SYSENG2);
  assert.equal(r.bodies.length, 2, 'the batch, then the one relationship with its correction; no third send');
  assert.deepEqual(r.userOf(1).document_data.map(p => p.id), [RR_BSIE.id]);
  assert.equal(r.userOf(0).corrections, undefined, 'the first request is the production request: no corrections');
  assert.notEqual(r.bodies[1].messages[1].content, r.bodies[0].messages[1].content);
  assert.equal(r.bodies[1].messages[0].content, r.bodies[0].messages[0].content, 'the system prompt is the same: only the correction is new');
  const j = out.find(x => x.id === RR_BSIE.id);
  assert.deepEqual([j.unverified, j.label, j.stoppedBecause, j.attempts, j.failureCodes], [true, 'INSUFFICIENT_EVIDENCE', 'repeated_evidence_error', 2, ['quotes_swapped', 'quotes_swapped']]);
  assert.deepEqual(j.refusals.map(x => [x.codes, x.problems, x.given]), Array(2).fill([['quotes_swapped'], [{ code: 'quotes_swapped', side: 'both' }], { sourceQuote: SWAPPED.sourceQuote, targetQuote: SWAPPED.targetQuote }]));
  assert.deepEqual(out.filter(x => !x.unverified).map(x => x.id), SYSENG2.slice(0, 3).map(p => p.id), 'the valid judgements of the first answer are kept');
  // the same holds for a contract error (E.4) and an empty explanation; each stops with the class of its error
  for (const [fields, code, because] of [[{ recommendation: 'NO_CHANGE' }, 'recommendation_conflicts_label', 'repeated_contract_error'], [{ explanation: ' ' }, 'empty_explanation', 'repeated_evidence_error']]) {
    const again = router(data => data.map(pair => answerFor(pair, pair.id === RR_BSIE.id ? { ...RIGHT, ...fields } : {})));
    const k = (await staged(again, SYSENG2)).find(x => x.id === RR_BSIE.id);
    assert.deepEqual([again.bodies.length, k.stoppedBecause, k.failureCodes], [2, because, [code, code]], code);
  }
});

test('E.5 #5 corrected output on a bounded retry: the corrected answer verifies, and a NEW problem may be corrected once more within MAX_ATTEMPTS', async () => {
  const r = router((data, n, corrections) => data.map(pair => (pair.id !== RR_BSIE.id ? answerFor(pair) : corrections.length ? answerFor(pair, RIGHT) : answerFor(pair, SWAPPED))));
  const out = await staged(r, SYSENG2);
  assert.equal(r.bodies.length, 2);
  const fix = r.userOf(1).corrections;
  assert.deepEqual(fix.map(x => [x.id, x.refused, x.previousQuotes]), [[RR_BSIE.id, ['quotes_swapped'], { sourceQuote: SWAPPED.sourceQuote, targetQuote: SWAPPED.targetQuote }]]);
  assert.ok(out.every(j => !j.unverified));
  const j = out.find(x => x.id === RR_BSIE.id);
  assert.deepEqual([j.label, j.sourceQuote, j.targetQuote, j.aspects.values.relevance], ['NOT_ALIGNED', 'Systems Engineering', 'A history of medieval architecture', 'unrelated']);
  // swapped, then a target quote that is in no text (a new problem: corrected again), then right: three sends, each with a different correction
  const three = router((data, n) => data.map(pair => (pair.id !== RR_BSIE.id ? answerFor(pair) : n === 1 ? answerFor(pair, SWAPPED) : n === 2 ? answerFor(pair, { ...RIGHT, targetQuote: 'A History of Medieval Architecture' }) : answerFor(pair, RIGHT))));
  const k = (await staged(three, SYSENG2)).find(x => x.id === RR_BSIE.id);
  assert.equal(three.bodies.length, MAX_ATTEMPTS); assert.ok(!k.unverified);
  assert.deepEqual([three.userOf(1).corrections[0].refused, three.userOf(2).corrections[0].refused], [['quotes_swapped'], ['quote_not_found']]);
  assert.match(three.userOf(2).corrections[0].instruction, /targetQuote must be copied exactly, character for character \(the same capitals, spelling and punctuation\), from the bibliographic entry/);
  // and never beyond MAX_ATTEMPTS: three different problems end at the attempt limit
  const four = router((data, n) => data.map(pair => (pair.id !== RR_BSIE.id ? answerFor(pair) : n === 1 ? answerFor(pair, SWAPPED) : n === 2 ? answerFor(pair, { ...RIGHT, targetQuote: 'not in the entry' }) : answerFor(pair, { ...RIGHT, explanation: '' }))));
  const l = (await staged(four, SYSENG2)).find(x => x.id === RR_BSIE.id);
  assert.deepEqual([four.bodies.length, l.stoppedBecause, l.failureCodes], [MAX_ATTEMPTS, 'attempt_limit', ['quotes_swapped', 'quote_not_found', 'empty_explanation']]);
});

// ---------------- 6-7: empty and partial answers ----------------
test('E.5 #6 an empty judgements array is refused (empty_answer) for every relationship, nothing is made up, and it is corrected once, then stopped', async () => {
  const error = (() => { try { verifyAnswer('{"judgements":[]}', SYSENG1, contractOf(ALL, BSIE)); } catch (e) { return e; } return null; })();
  assert.deepEqual([error.code, error.unverified, error.salvaged], ['empty_answer', true, []]);
  assert.deepEqual(error.rejected.map(x => [x.id, x.code]), SYSENG1.map(p => [p.id, 'empty_answer']), 'every requested id is named as unanswered');
  assert.deepEqual(rejections({ judgements: [] }, SYSENG1).length, 4);
  assert.deepEqual(verifyAnswer('{"judgements":[]}', [], contractOf(ALL, BSIE)), [], 'an empty list answers a request that asked for nothing');
  // always empty: the batch, then the same four with a correction each (an empty list is short, so a smaller batch would add nothing), then stop
  const r = router(() => []);
  const out = await staged(r, SYSENG1);
  assert.deepEqual(r.bodies.map((_, n) => r.userOf(n).document_data.length), [4, 4]);
  assert.deepEqual(r.userOf(1).corrections.map(x => [x.id, x.refused]), SYSENG1.map(p => [p.id, ['empty_answer']]));
  assert.match(r.userOf(1).corrections[0].instruction, /empty judgements list: return exactly one judgement for this id/);
  assert.equal(out.length, 4);
  for (const j of out) {
    assert.deepEqual([j.unverified, j.label, j.stoppedBecause, j.attempts, j.failureCodes, j.recommendation], [true, 'INSUFFICIENT_EVIDENCE', 'repeated_coverage_error', 2, ['empty_answer', 'empty_answer'], undefined], j.id);
    assert.deepEqual([j.sourceQuote, j.targetQuote, j.draft], ['', '', ''], 'no evidence and no draft is invented');
  }
  // empty, then answered once corrected: all four verify after one corrective retry
  const fixed = router((data, n, corrections) => (corrections.length ? data.map(p => answerFor(p)) : []));
  const done = await staged(fixed, SYSENG1);
  assert.equal(fixed.bodies.length, 2); assert.ok(done.every(j => !j.unverified));
});

test('E.5 #7 a partial batch: the valid answers are kept as they are, only the missing relationship is asked again (with a correction), and none is invented', async () => {
  const missing = SYSENG1[2];
  const partial = router((data, n, corrections) => data.filter(p => p.id !== missing.id || corrections.length).map(p => answerFor(p)));
  const out = await staged(partial, SYSENG1);
  assert.deepEqual(partial.bodies.map((_, n) => partial.userOf(n).document_data.map(p => p.id)), [SYSENG1.map(p => p.id), [missing.id]]);
  assert.deepEqual(partial.userOf(1).corrections.map(x => [x.id, x.refused]), [[missing.id, ['not_answered']]]);
  assert.match(partial.userOf(1).corrections[0].instruction, /no judgement for this id: return exactly one judgement with this id/);
  assert.ok(out.every(j => !j.unverified)); assert.deepEqual(out.map(j => j.id).sort(), SYSENG1.map(p => p.id).sort());
  // never answered: the three valid answers are kept exactly as first verified; the missing one stops after its correction, with no verdict (asked
  // alone, it is left out of an empty list: the same problem, so no third send)
  const first = salvage({ judgements: SYSENG1.filter(p => p.id !== missing.id).map(p => answerFor(p)) }, SYSENG1, contractOf(ALL, BSIE));
  const never = router(data => data.filter(p => p.id !== missing.id).map(p => answerFor(p)));
  const kept = await staged(never, SYSENG1);
  assert.equal(never.bodies.length, 2);
  assert.deepEqual(kept.filter(j => !j.unverified), first);
  const j = kept.find(x => x.id === missing.id);
  assert.deepEqual([j.unverified, j.label, j.stoppedBecause, j.failureCodes], [true, 'INSUFFICIENT_EVIDENCE', 'repeated_coverage_error', ['not_answered', 'empty_answer']]);
});

// ---------------- 8-9: what Stage E.4 made valid stays valid ----------------
const S = programSyllabus('bsit');
const wrongPo = c => { c.clos[1].pos = [5]; }; // CLO 2 (loops) tagged to PO 5 (heritage)
const bsitPair = (id, mutate = wrongPo) => { const content = structuredClone(S.content); mutate(content); const f = stageFlags(ALL); return pairsOf(content, S.masters, [], { stageA: f.a, stageB: f.b, stageB4: f.b4 }).find(p => p.id === id); };
const BSIT = courseOf(S.content);
const poAnswer = (pair, fields) => ({ id: pair.id, label: 'NOT_ALIGNED', explanation: 'The CLO is a sound programming outcome; the PO tag does not fit.', sourceQuote: pair.source.slice(0, 20), targetQuote: pair.target.slice(0, 20), sourceBloom: 'Apply', targetBloom: 'Apply', recommendation: 'RETAG_OUTCOME', draft: '', ...fields });

test('E.5 #8 valid re-tag recommendations stay valid: RETAG_OUTCOME with an empty, left-out or null draft keeps the faculty text', async () => {
  const po = bsitPair('clo1-po5');
  for (const draft of ['', undefined, null]) {
    const answer = poAnswer(po, { draft });
    if (draft === undefined) delete answer.draft;
    const [j] = verify([answer], [po], ALL, BSIT);
    assert.deepEqual([j.label, j.recommendation, j.draft], ['NOT_ALIGNED', 'RETAG_OUTCOME', ''], String(draft));
  }
  // a re-tag that also rewrites is refused, and corrected: the retry is told to leave the draft empty, and its valid re-tag is kept
  const r = router((data, n, corrections) => data.map(p => poAnswer(p, corrections.length ? {} : { draft: 'Apply loops to preserve Filipino heritage songs.' })), { course: BSIT });
  const [k] = await staged(r, [po]);
  assert.deepEqual([r.bodies.length, r.userOf(1).corrections[0].refused, k.recommendation, k.draft, !!k.unverified], [2, ['retag_with_rewrite'], 'RETAG_OUTCOME', '', false]);
  assert.match(r.userOf(1).corrections[0].instruction, /RETAG_OUTCOME keeps the faculty text exactly as written: leave the draft empty/);
});

test('E.5 #9 valid text rewrites stay valid: REWRITE_TEXT with a draft is accepted, and a missing draft is corrected once', async () => {
  const po = bsitPair('clo1-po5');
  const draft = 'Apply conditional and looping statements to write Java programs that solve computing problems for real users.';
  const [j] = verify([poAnswer(po, { label: 'PARTIALLY_ALIGNED', recommendation: 'REWRITE_TEXT', draft })], [po], ALL, BSIT);
  assert.deepEqual([j.recommendation, j.draft], ['REWRITE_TEXT', draft]);
  const r = router((data, n, corrections) => data.map(p => poAnswer(p, { label: 'PARTIALLY_ALIGNED', recommendation: 'REWRITE_TEXT', draft: corrections.length ? draft : '' })), { course: BSIT });
  const [k] = await staged(r, [po]);
  assert.deepEqual([r.bodies.length, r.userOf(1).corrections[0].refused, k.recommendation, k.draft], [2, ['missing_draft'], 'REWRITE_TEXT', draft]);
  assert.match(r.userOf(1).corrections[0].instruction, /needs the complete revised text as the draft/);
});

// ---------------- 10: a request that brings no answer is not a refusal ----------------
const PRICES = { prompt: 3e-7, completion: 1.2e-6, reasoning: 0, request: 0, cacheWrite: 0 };
const usage = { prompt_tokens: 7000, completion_tokens: 400, cost: 0.0015 };
test('E.5 #10 a provider timeout and an exhausted budget are not refusals: never retried by the checker, told apart from contract errors, and the valid answers already given are kept', async () => {
  // the kinds of failure
  assert.deepEqual(['missing_draft', 'quotes_swapped', 'empty_answer', 'not_answered', 'invalid_json', 'provider_timeout', 'provider_quota', 'provider_error', 'provider_access'].map(errorClassOf), ['contract', 'evidence', 'coverage', 'coverage', 'output', 'transient', 'transient', 'transient', 'access']);
  for (const code of CONTRACT_CODES) assert.equal(errorClassOf(code), 'contract', code);
  for (const set of [EVIDENCE_CODES, COVERAGE_CODES, OUTPUT_CODES]) for (const code of set) assert.ok(!CONTRACT_CODES.has(code), code);
  const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  assert.deepEqual([classifyFailure(timeout).kind, failureClassOf(timeout)], ['provider_timeout', 'transient']);
  assert.equal(failureClassOf(new Error('OpenRouter HTTP 402: no credits; alignment not evaluated')), 'access');
  assert.equal(failureClassOf(new Error('OpenRouter HTTP 429; alignment not evaluated')), 'transient');
  assert.equal(failureClassOf(Object.assign(new Error('x'), { unverified: true, code: 'quotes_swapped' })), 'evidence');
  // a timeout: thrown at once, the batch is not asked again by the checker (the caller marks it not checked and counts it)
  let sent = 0;
  await assert.rejects(judgeBatch(async () => { sent += 1; throw timeout; }, SYSENG2, { halve: true }), e => e.name === 'TimeoutError');
  assert.equal(sent, 1);
  // a timeout on the corrective retry: the first answer's valid judgements were already handed to the caller (align keeps error.salvaged)
  const handed = [];
  let n = 0;
  const transport = async () => { n += 1; if (n === 2) throw timeout; return new Response(JSON.stringify({ model: MODEL, choices: [{ finish_reason: 'stop', message: { content: json(SYSENG2.map(p => answerFor(p, p.id === RR_BSIE.id ? SWAPPED : {}))) } }], usage }), { status: 200 }); };
  const request = async (batch, options) => { try { return await requestOpenRouter(batch, { ...options, env: ALL, course: BSIE, transport }); } catch (e) { handed.push(...(e.salvaged || [])); throw e; } };
  await assert.rejects(judgeBatch(request, SYSENG2, { halve: true }), e => e.name === 'TimeoutError');
  assert.deepEqual(handed.map(j => j.id), SYSENG2.slice(0, 3).map(p => p.id));
  // the budget: a request whose worst case does not fit is refused before it is sent, so the corrective retry costs nothing it cannot afford
  let body = null;
  await requestOpenRouter(SYSENG2, { env: ALL, course: BSIE, transport: async (url, init) => { body = init.body; throw Object.assign(new Error('planned only'), { planned: true }); } }).catch(() => {});
  const fetched = [];
  const send = async (url, init) => { fetched.push(JSON.parse(JSON.parse(init.body).messages[1].content)); return new Response(JSON.stringify({ model: MODEL, choices: [{ finish_reason: 'stop', message: { content: json(SYSENG2.map(p => answerFor(p, p.id === RR_BSIE.id ? SWAPPED : {}))) } }], usage }), { status: 200 }); };
  const guardOf = maxCost => { const guard = createGuard({ fetch: send, maxRequests: 5, maxCost, secrets: [KEY] }); guard.setPrices(PRICES); return guard; };
  const worst = guardOf(1).worstCase(body).dollars;
  // room for the batch's worst case, but not for its charge plus the worst case of the corrective retry
  const tight = guardOf(worst * 1.02);
  await assert.rejects(judgeBatch((batch, options) => requestOpenRouter(batch, { ...options, env: ALL, course: BSIE, transport: tight.fetch }), SYSENG2, { halve: true }), e => e.refused === true && /cost cap/.test(e.message));
  assert.equal(fetched.length, 1, 'the batch was sent; its corrective retry did not fit under the cap and was never sent');
  assert.match(tight.stopped(), /cost cap/);
  assert.equal(tight.ledger.requests, 1);
  const none = guardOf(worst * 0.5);
  await assert.rejects(judgeBatch((batch, options) => requestOpenRouter(batch, { ...options, env: ALL, course: BSIE, transport: none.fetch }), SYSENG2, { halve: true }), e => e.refused === true);
  assert.equal(fetched.length, 1, 'a request whose worst case exceeds the budget is never sent');
});

// ---- whole checks through the engine, with a scripted Gemini model (as stage-e4.test.js): every relationship ALIGNED, and each Ref-relevance answer
// swapped never, until corrected ('once'), or every time ('always') ----
const G = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_VALUES_FILE: 'no-such-file.json' };
const G_ALL = { ...G, ...flagsOf(STAGES) }, G_NONE = { ...G };
const GOOD = { 'Activity-fit': { teaching: 'sound', learnerSupport: 'adequate' }, 'Assessment-fit': { measures: 'yes', evidence: 'observable', level: 'matches' }, 'Value-use': { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits' }, 'Ref-relevance': { relevance: 'relevant', basis: 'title_and_venue' }, 'Value-map': { coreValue: 'Community-orientedness', integration: 'demonstrated' } };
function geminiModel(env, swapRefs = 'never') {
  const keys = aspectKeysFor(stageFlags(env)), recommend = recommendOn(stageFlags(env)), log = { requests: 0, corrections: [] };
  const transport = async (url, req) => {
    const user = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text), fixes = new Set((user.corrections || []).map(c => c.id));
    log.requests += 1; log.corrections.push(...(user.corrections || []));
    const answer = pair => {
      const swap = pair.type === 'Ref-relevance' && (swapRefs === 'always' || (swapRefs === 'once' && !fixes.has(pair.id)));
      return { id: pair.id, label: 'ALIGNED', explanation: 'Judged by the scripted test model.', sourceQuote: (swap ? pair.target : pair.source).slice(0, 14), targetQuote: (swap ? pair.source : pair.target).slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A',
        ...(recommend ? { recommendation: 'NO_CHANGE' } : {}), draft: '', ...Object.fromEntries(keys.map(k => [k, 'not_assessed'])), ...(GOOD[pair.type] || {}) };
    };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: user.document_data.map(answer) }) }] } }] }) };
  };
  return { transport, log };
}
// What the official result and the submission gate read (stage-e4.test.js): score, pass, readiness, the points and every deduction, the blocking
// findings, the summary, and whether the alignment counts as verified.
const official = r => JSON.stringify([r.score, r.passed, r.hybrid.ready, r.hybrid.provisionalScore, r.hybrid.deductions.map(d => [d.id, d.points, d.reason]), r.conformance.failed.map(f => f.id).sort(), r.hybrid.summary.status, verifiedAlignment(r.hybrid.alignment)]);

// ---------------- the prompt and the cache ----------------
test('E.5 prompt: the Ref-relevance wording names its two texts and quotes, uses "source" only for the pair side, and is versioned (r6, r7 since Stage E.6); corrections are explained only while a stage is on', () => {
  const on = systemPromptOf('current', ALL, []), off = systemPromptOf('current', NONE, []);
  for (const name of ['courseContext', 'bibliographicEntry', 'courseContextQuote', 'referenceEntryQuote', 'title_and_venue']) assert.ok(on.includes(name), name);
  assert.match(on, /Unlike REF-plan, the reference here is the TARGET/);
  assert.ok(!/title_and_source|the title and source/.test(on), 'the publisher is never called a "source"');
  for (const segment of [D2.directions, D2.tests]) for (const m of segment.matchAll(/\bsource\w*/g)) assert.ok(m[0] === 'sourceQuote' || segment.slice(m.index, m.index + 9) === 'source = ', `"${segment.slice(m.index - 20, m.index + 20)}"`);
  assert.ok(on.includes(RETRY.corrections) && !off.includes('corrections'), 'the correction wording is part of a staged prompt only');
  // the scored REF-plan wording, with the opposite orientation, is untouched
  assert.ok(on.includes('- REF-plan: source = the title and opening text of a referenced page; target = the course title and weekly topics.'));
  assert.equal(STAGE_REVISION, 7);
  assert.equal(promptVersionOf(MODEL, ALL), 'alignment-12ab34c1c2d1d2-r8-a8');
  assert.equal(promptVersionOf(MODEL, flagsOf(['D2'])), 'alignment-12d2-r7');
  assert.equal(promptVersionOf(MODEL, NONE), 'alignment-10');
});

test('E.5 every stage off: the alignment-10 prompt byte for byte, the earlier retry cascade, and no correction in any request', async () => {
  assert.equal(crypto.createHash('sha256').update(systemPromptOf('current', NONE, [{ type: 'CLO-PO' }])).digest('hex'), '81d11a069d91ee47c7171bd941f05867d73e6423eebf1ea9d8fa6c06f49d7262');
  assert.equal(userMessageOf(BSIE, SYSENG1), JSON.stringify({ course: BSIE, document_data: SYSENG1 }), 'without corrections the user message is the one it always was');
  assert.equal(userMessageOf(BSIE, SYSENG1, [{ id: 'not-in-this-request', instruction: 'x' }]), JSON.stringify({ course: BSIE, document_data: SYSENG1 }), 'a correction for another relationship is never sent');
  // the earlier cascade: the batch, then each relationship alone three times, never with a correction
  const r = router(() => '{"judgements": [', { env: NONE });
  const out = await judgeBatch(r.request, SYSENG1, { halve: false });
  assert.deepEqual(r.bodies.map((_, n) => r.userOf(n).document_data.length), [4, ...Array(12).fill(1)]);
  assert.ok(r.bodies.every((_, n) => !('corrections' in r.userOf(n))));
  assert.ok(out.every(j => j.unverified && !('stoppedBecause' in j) && !('refusals' in j)));
  // the user message of a first staged request is the production one too
  const s = router(data => data.map(p => answerFor(p)));
  await staged(s, SYSENG1);
  assert.equal(s.bodies[0].messages[1].content, JSON.stringify({ course: BSIE, document_data: SYSENG1 }));
});

test('E.5 cache: a staged answer made under -r5 is never reused under the current revision, and an all-off check still reuses its alignment-10 answers', async () => {
  const course = courseOf(S.content), pairs = pairsOf(S.content, S.masters, []);
  const r5 = new Map(pairs.map(p => [pairKey(p, 'openrouter', MODEL, 'alignment-12ab34c1c2d1d2-r5', courseKeyOf(course)), answerFor(p)]));
  const current = new Set(pairs.map(p => pairKey(p, 'openrouter', MODEL, promptVersionOf(MODEL, ALL), courseKeyOf(course))));
  assert.ok([...r5.keys()].every(key => !current.has(key)), 'no -r5 fingerprint matches a current one');
  const base = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
  const first = await run(structuredClone(S.content), S.masters, { ...base, env: G_NONE, transport: geminiModel(G_NONE).transport });
  const reuse = new Map(first.hybrid.alignment.judgements.filter(j => j.key && !j.unverified).map(j => [j.key, j]));
  const again = geminiModel(G_NONE);
  const off = await run(structuredClone(S.content), S.masters, { ...base, env: G_NONE, reuse, transport: again.transport });
  assert.equal(again.log.requests, 0, 'nothing changed, so nothing is asked');
  assert.equal(off.hybrid.alignment.status, 'completed');
});

// ---------------- the official result ----------------
test('E.5 official result: swapped Ref-relevance quotes, corrected or never corrected, change no score, deduction, pass mark, readiness or gate', async () => {
  const base = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
  const check = async (env, swap) => { const m = geminiModel(env, swap); resetProviderBlock(); return { result: await run(structuredClone(S.content), S.masters, { ...base, env, transport: m.transport }), log: m.log }; };
  const off = await check(G_NONE), clean = await check(G_ALL), once = await check(G_ALL, 'once'), always = await check(G_ALL, 'always');
  for (const [name, x] of [['clean', clean], ['corrected', once], ['never corrected', always]]) assert.equal(official(x.result), official(off.result), name);
  const refsOf = r => r.hybrid.alignment.judgements.filter(j => j.type === 'Ref-relevance');
  assert.ok(refsOf(clean.result).length >= 3, 'the BSIT references are asked');
  assert.ok(refsOf(once.result).every(j => !j.unverified && j.aspects.values.basis === 'title_and_venue'), 'each swapped answer verifies after its correction');
  assert.ok(once.log.corrections.length >= 3 && once.log.corrections.every(c => c.refused.join() === 'quotes_swapped' && /course context/.test(c.instruction)));
  assert.ok(refsOf(always.result).every(j => j.unverified && j.stoppedBecause === 'repeated_evidence_error' && j.attempts === 2), 'never corrected: stopped after one correction, no verdict');
  assert.equal(always.log.requests - clean.log.requests, once.log.requests - clean.log.requests, 'one corrective request either way');
  assert.equal(refsOf(off.result).length, 0, 'with every stage off there is no Ref-relevance question');
  // the official policy itself
  assert.deepEqual({ ...POLICY, advisoryTypes: undefined }, { version: 'syllabus-policy-2', link: 2, alignment: 3, partialAlignment: 1, value: 1, minWeek: 1, maxWeek: 18, maxRewriteAttempts: 2, advisoryTypes: undefined });
  assert.ok(POLICY.advisoryTypes.includes('Ref-relevance'));
  assert.equal(standard.passThreshold, 79);
  assert.equal(aiGate({}), 'advisory'); assert.equal(aiGate(G_ALL), 'advisory');
  assert.deepEqual(stageFlags({}), { a: false, b: false, b3: false, b4: false, c1: false, c2: false, d1: false, d2: false });
});
