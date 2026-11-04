// Stage E.6 regression cases: evaluation reliability and academic evidence. What a paid evaluation completed is counted by DISTINCT relationship
// (eval/evalMetrics.js): an answer refused for one relationship and verified by the next, corrected request is a recoverable error, not a failure; a
// relationship never sent is not evaluated; the academic stop rests on the final unresolved rate. The guard keeps its hard stops, stops on answers that
// verify nothing, and settles a reservation at a reliable reported cost (eval/providerGuard.js). The optional minItems keyword (off by default), the
// Value-use evidence kinds and a staged prompt without leading examples, and the field-coverage rule (aspects.js, verdict.js): a base judgement stands
// on its own assessed field and an unassessed field is NOT_CHECKED, never passed. Then the invariants: every stage off is alignment-10 byte for byte,
// and the official result (score, pass, readiness, deductions, gate) is the same with the stages on and off. Every model and every fetch here is a
// scripted fake: no test reaches a provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./engine');
const gemini = require('./gemini');
const { verifyAnswer, contractOf, judgeBatch, requestOpenRouter, promptVersionOf, systemPromptOf, alignmentSchema, minItemsOn, batchSizeOf, pairKey, courseKeyOf, courseOf, pairsOf,
  aspectKeysFor, isNoRewrite, resetProviderBlock, verifiedAlignment, userMessageOf, ASPECTS, MAX_ATTEMPTS, NEMOTRON_FREE } = gemini;
const stages = require('./stages');
const { stageFlags, recommendOn, STAGE_REVISION, C_PROMPT_REVISION, D1, Q } = stages;
const { coverageOf, coverageSummaryOf, REQUIRED, DECISIVE } = require('./aspects');
const { buildVerdict } = require('./verdict');
const { createGuard, reliableCost, OPENROUTER_CHAT } = require('./eval/providerGuard');
const { createTracker, academicStopOf, completionOf, describe, DEFAULTS } = require('./eval/evalMetrics');
const { scoreEval } = require('./eval/metrics');
const { programSyllabus, PROGRAMS } = require('./eval/programSyllabi');
const { VALUE_NAMES } = require('./values');
const { POLICY, aiGate } = require('./policy');
const standard = require('../compliance/standard-v4.json');
const lexicon = require('../../config/values-lexicon.json');

test.afterEach(() => resetProviderBlock());
const STAGES = ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'];
const flagsOf = on => Object.fromEntries(on.map(k => ['SYLLABUS_CHECK_STAGE_' + k, 'on']));
const MODEL = 'minimax/minimax-m3.1-flash', KEY = 'sk-or-v1-test-only-0123456789abcdef';
// The live evaluation's configuration: OpenRouter, the paid MiniMax model, every advisory stage on; MI adds the optional minItems keyword.
const OR = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: KEY, OPENROUTER_MODEL: MODEL, SYLLABUS_CHECK_VALUES_FILE: 'no-such-file.json' };
const ALL = { ...OR, ...flagsOf(STAGES) }, NONE = { ...OR }, MI = { SYLLABUS_CHECK_SCHEMA_MIN_ITEMS: 'on' };
const ALPHA_10 = '81d11a069d91ee47c7171bd941f05867d73e6423eebf1ea9d8fa6c06f49d7262';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');

// ---- the evaluation items (server/lib/syllabuscheck/eval), as the evaluation scripts send them ----
const EVAL = path.join(__dirname, 'eval');
const DATASET_FILES = fs.readdirSync(EVAL).filter(f => /dataset\.json$/.test(f));
const ITEMS = DATASET_FILES.flatMap(f => JSON.parse(fs.readFileSync(path.join(EVAL, f), 'utf8')).items || []);
const STAGED = ['stage-a', 'stage-b', 'stage-b3', 'stage-c', 'stage-d1', 'stage-d2'].map(name => require(`./eval/${name}-dataset.json`));
const itemOf = id => ITEMS.find(item => item.id === id);
const pairOf = id => { const item = itemOf(id); return { id: item.id, type: item.type, source: item.source, target: item.target, path: 'eval', targetPath: isNoRewrite(item.type) ? null : 'eval' }; };
const courseFor = key => { const { code, title, program, yearLevel, description } = STAGED.find(d => d.courses?.[key]).courses[key]; return { code, title, program, yearLevel, description }; };
const BSIE = courseFor('syseng');
const SYSENG1 = ['cc-syseng-aligned', 'cp-bsie-real2', 'wi-syseng-unrelated', 'ic-syseng-ok'].map(pairOf);
const RR_BSIE = pairOf('rr-syseng-unrelated');

// ---- answers and a scripted OpenRouter model (the strict json_schema path), as stage-e5.test.js ----
const ANSWER_FIELDS = { 'Activity-fit': { teaching: 'sound', learnerSupport: 'adequate', responsible: 'none' }, 'Assessment-fit': { measures: 'yes', evidence: 'observable', level: 'matches', responsible: 'none' }, 'Value-use': { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits', responsible: 'none' }, 'Ref-relevance': { relevance: 'relevant', basis: 'title_and_venue' } };
const answerFor = (pair, fields = {}) => ({ id: pair.id, label: 'ALIGNED', explanation: 'The scripted model judged this pair.', sourceQuote: pair.source.slice(0, 16), targetQuote: pair.target.slice(0, 16), sourceBloom: 'N/A', targetBloom: 'N/A', recommendation: 'NO_CHANGE', draft: '', ...(ANSWER_FIELDS[pair.type] || {}), ...fields });
const json = answers => JSON.stringify({ judgements: answers });
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
const staged = (r, batch) => judgeBatch(r.request, batch, { halve: true });

// ---- a scripted Gemini model for whole checks through the engine: decide(pair) gives { label, fields } (default ALIGNED, every field not_assessed) ----
const G = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_VALUES_FILE: path.join(os.tmpdir(), 'no-such-values-file.json') };
const G_ALL = { ...G, ...flagsOf(STAGES) };
function scripted(env, decide = () => null) {
  const keys = aspectKeysFor(stageFlags(env)), recommend = recommendOn(stageFlags(env)), log = { requests: 0 };
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    log.requests += 1;
    const answer = pair => {
      const d = decide(pair) || {}, label = d.label || 'ALIGNED', rewrite = !['ALIGNED', 'INSUFFICIENT_EVIDENCE'].includes(label) && !isNoRewrite(pair.type);
      return { id: pair.id, label, explanation: 'Judged by the scripted test model.', sourceQuote: pair.source.slice(0, 14), targetQuote: pair.target.slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A',
        ...(recommend ? { recommendation: label === 'ALIGNED' ? 'NO_CHANGE' : rewrite ? 'REWRITE_TEXT' : 'REVIEW_REQUIRED' } : {}), draft: rewrite ? `- A scripted draft for ${pair.id}.` : '',
        ...Object.fromEntries(keys.map(k => [k, 'not_assessed'])), ...(d.fields || {}) };
    };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return { transport, log };
}
const base = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
const S = programSyllabus('bsit');
const check = async (env, decide, extra = {}) => { const m = scripted(env, decide); resetProviderBlock(); const result = await run(structuredClone(S.content), S.masters, { ...base, env, transport: m.transport, ...extra }); return { result, log: m.log }; };
const findingsOf = (result, id) => buildVerdict(result, S.content, { all: true }).all.filter(f => f.relationshipId === id).map(f => [f.ruleId, f.status, f.verification || null]);
// What the official result and the submission gate read (stage-e4.test.js, stage-e5.test.js).
const official = r => JSON.stringify([r.score, r.passed, r.hybrid.ready, r.hybrid.provisionalScore, r.hybrid.deductions.map(d => [d.id, d.points, d.reason]), r.conformance.failed.map(f => f.id).sort(), r.hybrid.summary.status, verifiedAlignment(r.hybrid.alignment)]);

// ---- the guard: two endpoints with different prices, and a chat request small enough that its worst case is easy to state (provider-guard.test.js) ----
const ENDPOINTS = [{ provider: 'Cheap', prompt: 1e-7, completion: 5e-7, reasoning: 0, request: 0, cacheRead: 1e-8, cacheWrite: 0 }, { provider: 'Dear', prompt: 3e-7, completion: 1.2e-6, reasoning: 0, request: 0, cacheRead: 3e-8, cacheWrite: 0 }];
const PRICES = { prompt: 3e-7, completion: 1.2e-6, reasoning: 0, request: 0, cacheWrite: 0, endpoints: ENDPOINTS };
const chat = (ids = ['p1']) => ({ method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: 'system', content: 'test' }, { role: 'user', content: JSON.stringify({ course: null, document_data: ids.map(id => ({ id })) }) }] }) });
const reply = (usage, status = 200) => new Response(JSON.stringify({ id: 'gen-test', model: MODEL, provider: 'Fake', choices: [{ finish_reason: 'stop', message: { content: '{"judgements":[]}' } }], ...(usage ? { usage } : {}) }), { status, headers: { 'Content-Type': 'application/json' } });
const guardWith = (send, options = {}) => { const guard = createGuard({ fetch: send, maxRequests: 20, maxCost: 1, secrets: [KEY], ...options }); guard.setPrices(PRICES); return guard; };
// 120 tokens in and 40 out: 8.4e-5 at the highest prices (the conservative charge), 3.2e-5 at the lowest (the cheaper endpoint's bill).
const USAGE = { prompt_tokens: 120, completion_tokens: 40 }, CEILING = 120 * 3e-7 + 40 * 1.2e-6, FLOOR = 120 * 1e-7 + 40 * 5e-7;

// ---------------- 1-3: the stop metrics, by distinct relationship ----------------
test('E.6 #1 recoverable intermediate errors: the Stage E.5 run (three of four answers refused in part, seven of eight relationships verified) completes; the raw errors are kept apart', () => {
  const t = createTracker();
  t.plan(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  t.sent({ keys: ['a', 'b', 'c', 'd'], answered: true, verified: ['a', 'b', 'c'] }); // d refused
  t.sent({ keys: ['d'], answered: true, verified: ['d'] }); //                        d recovered by its corrected request
  t.sent({ keys: ['e', 'f', 'g', 'h'], answered: true, verified: ['e', 'f'] }); //    g and h refused
  t.sent({ keys: ['g', 'h'], answered: true, verified: ['g'] }); //                   g recovered, h refused again
  const m = t.metrics();
  assert.deepEqual([m.planned, m.attempted, m.neverAttempted, m.verified, m.recovered, m.unresolved, m.unresolvedRate, m.coverage], [8, 8, 0, 7, 2, 1, 0.125, 0.875]);
  assert.deepEqual(m.firstAttempt, { answered: 8, refused: 3, validationFailureRate: 0.375, noAnswerFirst: 0 }, 'the first-attempt validation failure rate, per relationship');
  assert.deepEqual(m.rawResponseErrors, { answers: 4, invalidAnswers: 3, refusedJudgements: 4, requestsWithoutAnswer: 0 }, 'h refused twice: two refused judgements, one relationship');
  assert.equal(academicStopOf(m), null);
  assert.deepEqual([completionOf(m).state, completionOf(m).usableForAgreement], ['complete', true]);
  // The guard no longer stops on invalid answers by default: they warn once, as an operational signal.
  const guard = createGuard({ fetch: async () => null, maxRequests: 10, maxCost: 1, warnInvalid: 3 });
  for (const [verified, invalid] of [[3, 'd refused'], [1, null], [2, 'g, h refused'], [1, 'h refused']]) guard.noteAnswer({ verified, invalid });
  assert.equal(guard.stopped(), null, 'the E.5 run would not stop');
  assert.equal(guard.summary().warnings.length, 1);
  assert.match(guard.summary().warnings[0], /3 answer\(s\) have failed validation in whole or in part .*this is not a stop/);
  assert.equal(guard.summary().limits.maxInvalid, null, 'no invalid-answer stop unless an evaluation sets one');
  // ... and an evaluation that sets one still stops on it (the protection is kept, not removed)
  const strict = createGuard({ fetch: async () => null, maxRequests: 10, maxCost: 1, maxInvalid: 3 });
  for (const [verified, invalid] of [[3, 'd refused'], [1, null], [2, 'g, h refused'], [1, 'h refused']]) strict.noteAnswer({ verified, invalid });
  assert.match(strict.stopped(), /3 answer\(s\) failed validation/);
});

test('E.6 #2 final unresolved: a relationship refused at every attempt counts once; the academic stop waits for the minimum sample, then stops above the limit', () => {
  const t = createTracker(), ids = Array.from({ length: 10 }, (_, i) => `r${i}`);
  t.plan(ids);
  t.sent({ keys: ['r0', 'r1', 'r2', 'r3'], answered: true, verified: ['r0', 'r1'] });
  t.sent({ keys: ['r2', 'r3'], answered: true, verified: [] });
  t.sent({ keys: ['r2'], answered: true, verified: [] });
  let m = t.metrics();
  assert.deepEqual([m.attempted, m.unresolved, m.unresolvedRate], [4, 2, 0.5]);
  assert.equal(academicStopOf(m), null, `fewer than ${DEFAULTS.minSample} relationships attempted: no academic decision yet`);
  assert.deepEqual(m.rawResponseErrors, { answers: 3, invalidAnswers: 3, refusedJudgements: 5, requestsWithoutAnswer: 0 });
  t.sent({ keys: ['r4', 'r5', 'r6', 'r7'], answered: true, verified: ['r4', 'r5', 'r6', 'r7'] });
  m = t.metrics();
  assert.deepEqual([m.attempted, m.unresolved, m.unresolvedRate, m.neverAttempted], [8, 2, 0.25, 2]);
  const stop = academicStopOf(m);
  assert.equal(stop, 'the final unresolved rate is 25% (2 of 8 distinct relationships attempted), above the 20% limit');
  const done = completionOf(m, { stopped: `academic stop: ${stop}` });
  assert.deepEqual([done.state, done.usableForAgreement], ['incomplete', false], 'stopped with relationships never attempted: incomplete');
  assert.match(done.reason, /^2 of 10 planned relationships were never attempted \(stopped: academic stop: .*\); they are not evaluated$/);
  // every planned relationship attempted: the final unresolved rate decides; at the limit is within it
  const full = createTracker();
  full.plan(ids);
  full.sent({ keys: ids, answered: true, verified: ids.slice(0, 8) });
  assert.equal(completionOf(full.metrics()).state, 'complete', '2 of 10 (20%) is within the 20% limit');
  full.plan(['r10']); full.sent({ keys: ['r10'], answered: true, verified: [] });
  assert.deepEqual([completionOf(full.metrics()).state, completionOf(full.metrics()).usableForAgreement], ['unresolved_above_limit', false]);
  assert.equal(completionOf(createTracker().metrics()).state, 'not_started');
  // a settled judgement is its final state: an unverified one stays unresolved, a verified one counts
  const s = createTracker();
  s.plan(['x', 'y']); s.sent({ keys: ['x', 'y'], answered: true, verified: [] });
  s.settle('x', { id: 'x', label: 'INSUFFICIENT_EVIDENCE', unverified: true }); s.settle('y', { id: 'y', label: 'ALIGNED' });
  assert.deepEqual([s.metrics().verified, s.metrics().unresolved], [1, 1]);
});

test('E.6 #3 unattempted planned relationships: never counted as evaluated, as verified, as unresolved or as an invalid answer in the agreement score', () => {
  const t = createTracker();
  t.plan(['a', 'b', 'c', 'd']);
  t.sent({ keys: ['a', 'b'], answered: false }); // a timeout: sent, no answer
  t.sent({ keys: ['a', 'b'], answered: true, verified: ['a'] });
  const m = t.metrics();
  assert.deepEqual([m.planned, m.attempted, m.neverAttempted, m.verified, m.unresolved, m.unresolvedRate, m.coverage, m.attemptedShare], [4, 2, 2, 1, 1, 0.5, 0.25, 0.5]);
  assert.deepEqual(m.firstAttempt, { answered: 2, refused: 1, validationFailureRate: 0.5, noAnswerFirst: 2 }, 'a first send without an answer is counted apart, not as a validation failure');
  assert.equal(m.rawResponseErrors.requestsWithoutAnswer, 1);
  assert.deepEqual([t.attempted('a'), t.attempted('c'), t.attempted('never-planned')], [true, false, false]);
  assert.equal(completionOf(m).state, 'incomplete');
  assert.match(describe(m), /^relationships: 1 of 4 planned verified \(coverage 25%\); 2 attempted, 2 never attempted; 0 recovered after a refused first answer; 1 unresolved \(final unresolved rate 50%\); first answers refused 1 of 2 \(50%\); raw: 1 of 1 answers failed validation in whole or part \(1 refused judgements\), 1 request\(s\) without an answer$/);
  // the agreement score (eval/metrics.js) leaves a never-sent item out instead of counting it as an invalid answer (the Stage E.5 reading)
  const items = [{ id: 'i1', type: 'Value-use', accept: ['ALIGNED'] }, { id: 'i2', type: 'Value-use', accept: ['NOT_ALIGNED'] }, { id: 'i3', type: 'Value-use', accept: ['PARTIALLY_ALIGNED'] }];
  const runs = [new Map([['i1', 'ALIGNED']])], sent = new Set(['0:i1', '0:i2']);
  const scored = scoreEval(items, runs, { attempted: (r, id) => sent.has(`${r}:${id}`) });
  assert.deepEqual([scored.answered, scored.invalid, scored.notAttempted], [1, 1, 1], 'i2 was asked and never verified (invalid); i3 was never sent');
  const before = scoreEval(items, runs);
  assert.deepEqual([before.invalid, 'notAttempted' in before], [2, false], 'without the option the score reads as it always did');
});

// ---------------- 4: the guard's stops ----------------
test('E.6 #4 the unproductive-answer stop: the default is the most answers one batch can bring (1 + 2 x 4 = 9), a batch reaches it only when nothing verifies, and one productive answer resets it', async () => {
  assert.equal(batchSizeOf(MODEL, ALL), 4);
  const bound = 1 + (MAX_ATTEMPTS - 1) * batchSizeOf(MODEL, ALL);
  assert.equal(bound, 9);
  // Four references of one course: on the first ask each quotes another reference's entry (quote_from_other_pair: asked again ALONE), then a quote in
  // no text (a new problem: corrected once more), then an empty explanation (the attempt limit). Nothing ever verifies: 1 + 4 + 4 requests.
  const CONTEXT = RR_BSIE.source, TITLES = ['A history of medieval architecture', 'Systems engineering and analysis', 'Requirements engineering for engineered systems', 'Modelling and simulation of engineered systems'];
  const REFS = TITLES.map((title, n) => ({ id: `ref-books-${n}`, type: 'Ref-relevance', source: CONTEXT, target: `Author, A. (20${10 + n}). ${title}. Example Press.`, path: `refs.books.items[${n}]`, targetPath: null }));
  const asked = new Map();
  const r = router(data => data.map(pair => {
    const n = (asked.get(pair.id) || 0) + 1, i = Number(pair.id.slice(-1));
    asked.set(pair.id, n);
    return answerFor(pair, { sourceQuote: 'Systems Engineering', ...(n === 1 ? { targetQuote: TITLES[(i + 1) % 4] } : n === 2 ? { targetQuote: 'text that is in neither side' } : { targetQuote: TITLES[i], explanation: ' ' }) });
  }));
  const out = await staged(r, REFS);
  assert.equal(r.bodies.length, bound, 'the batch, each relationship alone with its correction, and alone once more');
  assert.deepEqual(r.bodies.map((_, n) => r.userOf(n).document_data.length), [4, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.ok(out.every(j => j.unverified && j.stoppedBecause === 'attempt_limit' && j.attempts === MAX_ATTEMPTS));
  // The scripts' default: the 9 answers of such a batch stop the run at the last of them, and no sooner; an answer that verifies anything resets it.
  const guard = createGuard({ fetch: async () => null, maxRequests: 50, maxCost: 1, maxUnproductive: bound });
  for (let n = 1; n < bound; n += 1) guard.noteAnswer({ verified: 0, invalid: 'quote_not_found' });
  assert.equal(guard.stopped(), null);
  guard.noteAnswer({ verified: 1 });
  for (let n = 1; n < bound; n += 1) guard.noteAnswer({ verified: 0, invalid: 'quote_not_found' });
  assert.equal(guard.stopped(), null, 'reset by the productive answer');
  guard.noteAnswer({ verified: 0, invalid: 'empty_answer' });
  assert.match(guard.stopped(), /^9 answer\(s\) in a row verified no relationship \(the last: empty_answer\)$/);
  await assert.rejects(guard.fetch(OPENROUTER_CHAT, { body: '{}' }), e => e.refused === true, 'after a stop nothing is sent');
  // the guard's own check hook feeds the same count: { invalid, verified } from the answer it saw
  const hooked = createGuard({ fetch: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"judgements":[]}' } }], usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.00001 } }), { status: 200 }), maxRequests: 5, maxCost: 1, maxUnproductive: 2, check: () => ({ invalid: 'empty_answer: AI omitted alignment judgements', verified: [] }) });
  hooked.setPrices({ prompt: 3e-7, completion: 1.2e-6, reasoning: 0, request: 0, cacheWrite: 0 });
  await hooked.fetch(OPENROUTER_CHAT, chat()); await hooked.fetch(OPENROUTER_CHAT, chat());
  assert.deepEqual([hooked.httpLog[0].verifiedIds, hooked.httpLog[0].invalid], [[], 'empty_answer: AI omitted alignment judgements']);
  assert.match(hooked.stopped(), /2 answer\(s\) in a row verified no relationship/);
});

// ---------------- 5-7: cost reservation and reconciliation ----------------
test('E.6 #5 a reported cost is trusted only within its bounds: between the tokens at the lowest and at the highest listed prices, with the tokens reported and within the worst case', () => {
  const worst = { inputTokens: 5000, outputTokens: 8192 };
  assert.ok(reliableCost(USAGE, FLOOR, CEILING, worst, ENDPOINTS), 'the cheaper endpoint\'s bill');
  assert.ok(reliableCost(USAGE, CEILING, CEILING, worst, ENDPOINTS), 'the dearer endpoint\'s bill');
  for (const [why, usage, reported, ceiling, w, endpoints] of [
    ['below any endpoint\'s bill', USAGE, 1e-9, CEILING, worst, ENDPOINTS], ['above the highest prices', USAGE, CEILING * 1.5, CEILING, worst, ENDPOINTS],
    ['not a number', USAGE, Number.NaN, CEILING, worst, ENDPOINTS], ['negative', USAGE, -0.001, CEILING, worst, ENDPOINTS],
    ['no completion tokens reported', { prompt_tokens: 120 }, FLOOR, CEILING, worst, ENDPOINTS], ['no usage at all', null, FLOOR, CEILING, worst, ENDPOINTS],
    ['more tokens than the worst case', USAGE, FLOOR, CEILING, { inputTokens: 100, outputTokens: 8192 }, ENDPOINTS], ['no listed endpoint', USAGE, FLOOR, CEILING, worst, []],
  ]) assert.equal(reliableCost(usage, reported, ceiling, w, endpoints), false, why);
  // cached input is billed at the cache-read price, so the floor is lower for it
  const cached = { ...USAGE, prompt_tokens_details: { cached_tokens: 120 } }, cachedBill = 120 * 1e-8 + 40 * 5e-7;
  assert.equal(reliableCost(USAGE, cachedBill, CEILING, worst, ENDPOINTS), false);
  assert.equal(reliableCost(cached, cachedBill, CEILING, worst, ENDPOINTS), true);
});

test('E.6 #6 reconcile vs conservative: a complete answer with a reliable cost settles at it; an unreliable or missing cost, a timeout and an abandoned answer stay conservative or at the worst case', async () => {
  const usage = cost => ({ ...USAGE, cost });
  const round8 = v => Math.round(v * 1e8) / 1e8;
  const reconcile = guardWith(async () => reply(usage(FLOOR))), conservative = guardWith(async () => reply(usage(FLOOR)), { accounting: 'conservative' });
  await reconcile.fetch(OPENROUTER_CHAT, chat()); await conservative.fetch(OPENROUTER_CHAT, chat());
  assert.deepEqual([reconcile.httpLog[0].accounting, reconcile.httpLog[0].charged, reconcile.httpLog[0].conservativeCharge], ['reconciled', round8(FLOOR), round8(CEILING)]);
  assert.deepEqual([conservative.httpLog[0].accounting, conservative.httpLog[0].charged, conservative.httpLog[0].conservativeCharge], ['conservative', round8(CEILING), round8(CEILING)]);
  assert.equal(round8(reconcile.ledger.conservative), round8(conservative.ledger.charged), 'the conservative total is kept beside the reconciled one');
  assert.deepEqual(reconcile.summary().accounting, { rule: 'reconcile', requests: { reconciled: 1, conservative: 0, worst_case: 0, refused: 0 }, chargedConservatively: round8(CEILING) });
  // a reported cost too low to be any endpoint's bill is not trusted
  const low = guardWith(async () => reply(usage(1e-9)));
  await low.fetch(OPENROUTER_CHAT, chat());
  assert.deepEqual([low.httpLog[0].accounting, low.httpLog[0].charged], ['conservative', round8(CEILING)]);
  // no usage: the worst case (the cost is unknown)
  const none = guardWith(async () => reply(null));
  const worst = none.worstCase(none.withMaxTokens(chat().body)).dollars;
  await none.fetch(OPENROUTER_CHAT, chat());
  assert.deepEqual([none.httpLog[0].accounting, none.httpLog[0].charged], ['worst_case', round8(worst)]);
  // a timeout before an answer: the worst case, counted as a transient error, and thrown as a timeout
  const timeout = guardWith(async () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); });
  await assert.rejects(timeout.fetch(OPENROUTER_CHAT, chat()), e => e.name === 'TimeoutError');
  assert.deepEqual([timeout.httpLog[0].accounting, timeout.httpLog[0].charged, timeout.state.transient], ['worst_case', round8(worst), 1]);
  // a timeout while the answer is read (the headers came, the answer never did): its reported cost is unknown, so the worst case
  const cut = guardWith(async () => ({ status: 200, headers: new Headers(), clone: () => ({ json: async () => { throw Object.assign(new Error('aborted while reading'), { name: 'TimeoutError' }); } }) }));
  await assert.rejects(cut.fetch(OPENROUTER_CHAT, chat()), e => e.name === 'TimeoutError');
  assert.deepEqual([cut.httpLog[0].accounting, cut.httpLog[0].charged, cut.httpLog[0].error], ['worst_case', round8(worst), 'timeout']);
  // an error inside a 200 answer is not settled at its reported cost either
  const inner = guardWith(async () => new Response(JSON.stringify({ error: { message: 'upstream failed' }, usage: usage(FLOOR) }), { status: 200 }));
  await inner.fetch(OPENROUTER_CHAT, chat());
  assert.equal(inner.httpLog[0].accounting, 'conservative');
  // a refused request (4xx) is charged what is reported, and stops the run as before
  const refused = guardWith(async () => reply(usage(0.000001), 400));
  await refused.fetch(OPENROUTER_CHAT, chat());
  assert.deepEqual([refused.httpLog[0].accounting, refused.httpLog[0].charged], ['refused', 0.000001]);
  assert.match(refused.stopped(), /HTTP 400: the provider refused the request format or routing/);
  // the hard stops are unchanged under either rule
  for (const accounting of ['reconcile', 'conservative']) for (const status of [401, 402, 403]) {
    const g = guardWith(async () => reply(null, status), { accounting });
    await g.fetch(OPENROUTER_CHAT, chat());
    assert.match(g.stopped(), new RegExp(`HTTP ${status} \\(credits, key or access\\)`));
    await assert.rejects(g.fetch(OPENROUTER_CHAT, chat()), e => e.refused, 'nothing more is sent');
  }
  assert.throws(() => createGuard({ fetch: async () => null, maxRequests: 1, maxCost: 1, accounting: 'optimistic' }), /accounting must be reconcile or conservative/);
});

test('E.6 #7 never sent unless the worst case fits: reconciliation lowers the charge only after an answer, never the reservation of a request in flight; a ledger from before Stage E.6 is read conservatively', async () => {
  const w = guardWith(async () => null).worstCase(chat().body).dollars;
  // in flight: the first request holds its worst case, so a second cannot start, though the first will settle at a fraction of it
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = [];
  const slow = guardWith(async (url, init) => { calls.push(init); await gate; return reply({ ...USAGE, cost: FLOOR }); }, { maxCost: 1.5 * w });
  const first = slow.fetch(OPENROUTER_CHAT, chat());
  await assert.rejects(slow.fetch(OPENROUTER_CHAT, chat()), e => e.refused && /cost cap/.test(e.message));
  release();
  assert.equal((await first).status, 200);
  assert.equal(calls.length, 1);
  assert.equal(slow.httpLog[0].accounting, 'reconciled');
  // (a stopped guard sends nothing more, whatever was reconciled: a fresh guard with the same cap shows the reconciled room)
  const roomy = guardWith(async () => reply({ ...USAGE, cost: FLOOR }), { maxCost: 1.5 * w });
  await roomy.fetch(OPENROUTER_CHAT, chat());
  await roomy.fetch(OPENROUTER_CHAT, chat());
  assert.equal(roomy.httpLog.length, 2, 'settled at the reported cost, the next worst case fits again');
  const strict = guardWith(async () => reply(null), { maxCost: 1.5 * w });
  await strict.fetch(OPENROUTER_CHAT, chat());
  await assert.rejects(strict.fetch(OPENROUTER_CHAT, chat()), e => e.refused && /cost cap/.test(e.message), 'an unknown cost keeps the worst case, so the next does not fit');
  // a ledger written before Stage E.6 has no conservative total: it starts at what was charged (every earlier request was charged conservatively)
  const file = path.join(os.tmpdir(), `stage-e6-ledger-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ requests: 2, charged: 0.01, entries: [{ n: 1, kind: 'price-lookup' }, { n: 2, kind: 'model', charged: 0.01 }] }));
  try {
    const resumed = guardWith(async () => reply({ ...USAGE, cost: FLOOR }), { ledgerFile: file });
    assert.equal(resumed.ledger.conservative, 0.01);
    await resumed.fetch(OPENROUTER_CHAT, chat(['row2-valueuse']));
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual([saved.requests, saved.accounting, saved.charged, saved.conservative], [3, 'reconcile', Math.round((0.01 + FLOOR) * 1e8) / 1e8, Math.round((0.01 + CEILING) * 1e8) / 1e8]);
    assert.deepEqual([saved.entries[2].accounting, saved.entries[2].ids], ['reconciled', ['row2-valueuse']]);
    assert.ok(!fs.readFileSync(file, 'utf8').includes(KEY), 'the key reaches no ledger');
  } finally { fs.rmSync(file, { force: true }); }
});

// ---------------- 8-9: the optional minItems keyword; empty and partial answers ----------------
test('E.6 #8 minItems: off by default; on only with its flag, a stage, OpenRouter and a paid model; recorded in the prompt version (-mi1); the strict schema is otherwise unchanged', async () => {
  assert.equal(minItemsOn(ALL), false, 'off by default');
  assert.equal(minItemsOn({ ...ALL, ...MI }), true);
  assert.equal(minItemsOn({ ...NONE, ...MI }), false, 'every stage off: the scored check never changes');
  assert.equal(minItemsOn({ ...ALL, ...MI, SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' }), false, 'not the native Gemini schema');
  assert.equal(minItemsOn({ ...ALL, ...MI, OPENROUTER_MODEL: NEMOTRON_FREE }), false, 'not a free model in JSON mode (no strict schema)');
  assert.equal(promptVersionOf(MODEL, ALL), `alignment-12ab34c1c2d1d2-r${C_PROMPT_REVISION}-a8`);
  assert.equal(promptVersionOf(MODEL, { ...ALL, ...MI }), `alignment-12ab34c1c2d1d2-r${C_PROMPT_REVISION}-a8-mi1`);
  assert.equal(promptVersionOf(MODEL, { ...NONE, ...MI }), 'alignment-10');
  // The schema: minItems sits on the judgements array alone; every object stays strict (additionalProperties false, every property required).
  const keys = aspectKeysFor(stageFlags(ALL)), off = alignmentSchema(false, false, keys, true, 0), on = alignmentSchema(false, false, keys, true, 1);
  const { minItems, ...rest } = on.properties.judgements;
  assert.equal(minItems, 1);
  assert.deepEqual(rest, off.properties.judgements);
  assert.deepEqual({ ...on, properties: {} }, { ...off, properties: {} });
  for (const object of [on, on.properties.judgements.items]) {
    assert.equal(object.additionalProperties, false);
    assert.deepEqual([...object.required].sort(), Object.keys(object.properties).sort());
  }
  assert.ok(Object.values(on.properties.judgements.items.properties).every(p => p.type === 'string' && Object.keys(p).every(k => ['type', 'enum'].includes(k))), 'only string and enum fields');
  // The request: strict json_schema either way; the keyword only with the flag.
  for (const [env, expected] of [[ALL, undefined], [{ ...ALL, ...MI }, 1], [{ ...NONE, ...MI }, undefined]]) {
    const r = router(data => data.map(p => answerFor(p)), { env });
    await r.request(SYSENG1).catch(() => {});
    const format = r.bodies[0].response_format;
    assert.deepEqual([format.type, format.json_schema.strict, format.json_schema.schema.properties.judgements.minItems], ['json_schema', true, expected]);
  }
});

test('E.6 #9 empty and partial answers with minItems on: the server never trusts the keyword; an empty list is refused and corrected once, and only a missing relationship is asked again', async () => {
  const env = { ...ALL, ...MI };
  assert.throws(() => verifyAnswer('{"judgements":[]}', SYSENG1, contractOf(env, BSIE)), e => e.code === 'empty_answer' && e.unverified && e.salvaged.length === 0);
  const empty = router(() => [], { env });
  const out = await staged(empty, SYSENG1);
  assert.deepEqual(empty.bodies.map(b => b.response_format.json_schema.schema.properties.judgements.minItems), [1, 1], 'every request carries the keyword');
  assert.deepEqual(empty.bodies.map((_, n) => empty.userOf(n).document_data.length), [4, 4]);
  assert.ok(out.every(j => j.unverified && j.stoppedBecause === 'repeated_coverage_error' && j.sourceQuote === '' && j.draft === ''), 'nothing is made up');
  // partial: three answered, one left out; the three are kept as they are and only the fourth is asked again, with its correction
  const missing = SYSENG1[2];
  const partial = router((data, n, corrections) => data.filter(p => p.id !== missing.id || corrections.length).map(p => answerFor(p)), { env });
  const done = await staged(partial, SYSENG1);
  assert.deepEqual(partial.bodies.map((_, n) => partial.userOf(n).document_data.map(p => p.id)), [SYSENG1.map(p => p.id), [missing.id]]);
  assert.deepEqual(partial.userOf(1).corrections.map(x => [x.id, x.refused]), [[missing.id, ['not_answered']]]);
  assert.ok(done.every(j => !j.unverified));
});

// ---------------- 10-12: values: evidence kinds, no leading example, integration with and without evidence ----------------
test('E.6 #10 Value-use evidence kinds: integrated, opportunity, name_only and insufficient (with generic and unrelated) are defined, and "could" is never read as "does"', () => {
  const t = D1.tests;
  for (const [kind, meaning] of [['integrated', 'a meaningful demonstrated integration'], ['opportunity', 'a potential opportunity for integration'], ['name_only', 'the value merely named'], ['insufficient', 'insufficient evidence']]) assert.ok(t.includes(`${kind}, ${meaning}`), kind);
  for (const kind of ['generic', 'unrelated']) assert.match(t, new RegExp(`\\b${kind} \\(`));
  assert.match(t, /That students could express a value in an activity does not show that they do: never count an activity as integrating a value merely because it could, never state that students do something the syllabus does not describe/);
  assert.match(t, /ALIGNED only when valueUse is integrated and valueFit is fits or partly/);
  assert.match(t, /carriedBy is where in the lesson the value is lived \(activity, assessment, content, ilo or several\), and none unless valueUse is integrated/);
  assert.match(t, /it never presents what the lesson does not describe as already happening/);
  assert.deepEqual(ASPECTS.valueUse, ['integrated', 'opportunity', 'name_only', 'generic', 'unrelated', 'insufficient', 'not_assessed']);
  // The disputed item keeps the label it was written with (no faculty verdict yet): a bare value name is not an integration.
  const nameOnly = itemOf('vu-prog1-name-only');
  assert.deepEqual([nameOnly.target, nameOnly.accept, nameOnly.expectedAspects, nameOnly.facultyVerdict], ['Humility', ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'], { valueUse: 'name_only' }, null]);
});

// Word 3-grams with at least two content words: what a copied example shares with an evaluation item.
const STOP = new Set('a an the of to in on for and or by with is are be as at it its this that these those from into each one their his her they them students student lesson course text value values when not no only what which who how than then any all'.split(' '));
const words = text => String(text).toLowerCase().replace(/[^a-z0-9'-]+/g, ' ').split(/\s+/).filter(Boolean);
const trigrams = text => { const w = words(text), out = new Set(); for (let i = 0; i + 3 <= w.length; i += 1) { const g = w.slice(i, i + 3); if (g.filter(x => !STOP.has(x)).length >= 2) out.add(g.join(' ')); } return out; };
const strings = v => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
// Each 3-gram a staged segment shares with the evaluation texts, reviewed in Stage E.6 (docs/stage-e6-evaluation-reliability.md). A new one fails the test
// until it is reviewed: a worked example that mirrors an evaluation item measures the prompt, not the model.
const REVIEWED = {
  // the engine's own framing of a Value-map pair (values.js, valueClassification.js), and the official list of the six core values
  'the six official': 'framing', 'six official core': 'framing', 'official core values': 'framing', 'expressions the faculty': 'framing', 'the faculty wrote': 'framing',
  'compassion courage community-orientedness': 'official list', 'courage community-orientedness humility': 'official list', 'community-orientedness humility interiority': 'official list',
  // rule wording: a category a rule names, which some items are written to test (a Week 1 orientation, CLO tags, an essay for a practical ILO)
  'course orientation objectives': 'rule', 'orientation objectives requirements': 'rule', 'week 1 course': 'rule', '1 course orientation': 'rule', 'week 1 orientation': 'rule',
  'weeks tagged to': 'rule', 'course level tag': 'rule', 'week under review': 'rule', 'an essay about': 'rule', 'essay about the': 'rule',
  // Stage B's worked example ("A topic such as Java conditional statements belongs in an introductory programming course"), the prog1 items' topic.
  // Flagged in Stage E.6, not changed: Stage B is not in the next evaluation, and its neutral replacement awaits approval.
  'java conditional statements': 'flagged example',
};
const SEGMENTS = Object.fromEntries(['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2', 'R', 'RETRY', 'Q'].flatMap(name => Object.entries(stages[name]).map(([part, text]) => [`${name}.${part}`, text])));

test('E.6 #11 prompt-example contamination: the value wording names no core value outside the official list and no lexicon expression, and no staged segment shares an unreviewed phrase with an evaluation item or a program syllabus', () => {
  const OFFICIAL = 'the six core values are Compassion, Courage, Community-orientedness, Humility, Interiority and Missionary Spirit.';
  const valueText = D1.directions + D1.tests;
  assert.equal(valueText.split(OFFICIAL).length, 2, 'the official list, once');
  const rest = valueText.replace(OFFICIAL, '');
  for (const name of VALUE_NAMES) assert.ok(!new RegExp(`\\b${name}\\b`, 'i').test(rest), `${name} appears only in the official list`);
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const term of [...lexicon.supportingValues, ...lexicon.competencies]) assert.ok(!new RegExp(`\\b${escape(term)}\\b`, 'i').test(valueText), `the value wording names "${term}"`);
  // the Stage E.4 example the model reused, and the Value-map examples, are gone
  assert.ok(!/peer code review|For example|Respect supports|Honesty supports|Critical Thinking is/i.test(valueText));
  // every staged segment against every evaluation item (source and target) and every program syllabus
  const corpus = [...ITEMS.flatMap(item => [item.source, item.target]), ...PROGRAMS.flatMap(kind => strings(programSyllabus(kind).content))].filter(Boolean);
  const evaluated = new Set(corpus.flatMap(text => [...trigrams(text)]));
  const shared = Object.entries(SEGMENTS).flatMap(([name, text]) => [...trigrams(text)].filter(g => evaluated.has(g)).map(g => [name, g]));
  assert.deepEqual(shared.filter(([, g]) => !REVIEWED[g]), [], 'an unreviewed phrase shared with the evaluation texts');
  assert.deepEqual(shared.filter(([name, g]) => name.startsWith('D1.') && !['framing', 'official list'].includes(REVIEWED[g])), [], 'the value wording shares only the framing and the official list');
  assert.ok(DATASET_FILES.includes('stage-d1-dataset.json') && ITEMS.length > 100, 'the check reads the evaluation items');
});

test('E.6 #12 value integration with and without evidence: only an integrated value passes; an opportunity, a bare name or thin evidence never does, and "lived in" is shown only for an integrated value', async () => {
  const D1ON = { ...G, SYLLABUS_CHECK_STAGE_D1: 'on' };
  const first = (await check(D1ON)).result;
  const id = first.hybrid.alignment.judgements.find(j => j.type === 'Value-use').id;
  const cases = [
    ['integrated, with evidence', 'ALIGNED', { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits', responsible: 'none' }, [['VAL-03', 'PASS', 'quotes_verified'], ['VAL-02', 'PASS', 'structured_field']], 'activity'],
    ['an opportunity only', 'PARTIALLY_ALIGNED', { valueUse: 'opportunity', carriedBy: 'activity', valueFit: 'fits', responsible: 'values' }, [['VAL-03', 'NEEDS_REVIEW', 'quotes_verified'], ['VAL-02', 'PASS', 'structured_field']], null],
    ['an opportunity called ALIGNED', 'ALIGNED', { valueUse: 'opportunity', carriedBy: 'activity', valueFit: 'fits', responsible: 'none' }, [['VAL-03', 'NEEDS_REVIEW', 'contradictory_response']], null],
    ['named only', 'NOT_ALIGNED', { valueUse: 'name_only', carriedBy: 'none', valueFit: 'partly', responsible: 'values' }, [['VAL-03', 'FAIL', 'quotes_verified'], ['VAL-02', 'NEEDS_REVIEW', 'structured_field']], 'none'],
    ['named only, called ALIGNED', 'ALIGNED', { valueUse: 'name_only', carriedBy: 'activity', valueFit: 'fits', responsible: 'none' }, [['VAL-03', 'NEEDS_REVIEW', 'contradictory_response']], null],
    ['insufficient evidence', 'INSUFFICIENT_EVIDENCE', { valueUse: 'insufficient', carriedBy: 'none', valueFit: 'not_assessed', responsible: 'none' }, [['VAL-03', 'NOT_CHECKED', 'not_checked']], null],
  ];
  for (const [name, label, fields, expected, carriedBy] of cases) {
    const { result } = await check(D1ON, pair => (pair.id === id ? { label, fields } : null));
    assert.deepEqual(findingsOf(result, id), expected, name);
    const base = buildVerdict(result, S.content, { all: true }).all.find(f => f.relationshipId === id && f.ruleId === 'VAL-03');
    assert.equal(base.carriedBy ?? null, carriedBy, `${name}: where the value is lived`);
    assert.equal(official(result), official(first), `${name}: the official result is unchanged`);
  }
});

// ---------------- 13-14: the field-coverage rule ----------------
test('E.6 #13 a base judgement stands on its own assessed field: accepted when it was assessed, shown for review (never a pass or a failure) when it was not; an unassessed derived field is NOT_CHECKED', async () => {
  const C1ON = { ...G, SYLLABUS_CHECK_STAGE_C1: 'on' };
  const id = (await check(C1ON)).result.hybrid.alignment.judgements.find(j => j.type === 'Activity-fit').id;
  const cases = [
    ['teaching assessed, learner support not', 'ALIGNED', { teaching: 'sound', learnerSupport: 'not_assessed', responsible: 'none' }, [['ALN-05', 'PASS', 'quotes_verified'], ['ALN-06', 'NOT_CHECKED', 'aspect_not_assessed']]],
    ['learner support assessed, teaching not', 'ALIGNED', { teaching: 'not_assessed', learnerSupport: 'adequate', responsible: 'none' }, [['ALN-05', 'NEEDS_REVIEW', 'aspects_not_assessed'], ['ALN-06', 'PASS', 'structured_field']]],
    ['a failure resting on an unassessed field', 'NOT_ALIGNED', { teaching: 'not_assessed', learnerSupport: 'limited', responsible: 'activity' }, [['ALN-05', 'NEEDS_REVIEW', 'aspects_not_assessed'], ['ALN-06', 'NEEDS_REVIEW', 'structured_field']]],
    ['a failure on an assessed field', 'NOT_ALIGNED', { teaching: 'weak', learnerSupport: 'limited', responsible: 'activity' }, [['ALN-05', 'FAIL', 'quotes_verified'], ['ALN-06', 'NEEDS_REVIEW', 'structured_field']]],
    ['nothing assessed', 'ALIGNED', {}, [['ALN-05', 'NEEDS_REVIEW', 'aspects_not_assessed'], ['ALN-06', 'NOT_CHECKED', 'aspect_not_assessed']]],
  ];
  for (const [name, label, fields, expected] of cases) {
    const { result } = await check(C1ON, pair => (pair.id === id ? { label, fields } : null));
    assert.deepEqual(findingsOf(result, id), expected, name);
  }
  const { result } = await check(C1ON, pair => (pair.id === id ? { label: 'NOT_ALIGNED', fields: { teaching: 'not_assessed', learnerSupport: 'limited', responsible: 'activity' } } : null));
  const base = buildVerdict(result, S.content, { all: true }).all.find(f => f.relationshipId === id && f.ruleId === 'ALN-05');
  assert.deepEqual([base.severity, base.aspectCoverage.unassessed], ['MINOR', ['teaching']]);
  assert.match(base.explanation, /^The verdict rests on what the AI did not assess in this answer \(the teaching method\), so it is shown for review and not counted as a failure\. /);
  // the rule's own fields: one per base rule, two for Value-map (a core value and its integration)
  assert.deepEqual(DECISIVE, { 'Activity-fit': ['teaching'], 'Assessment-fit': ['measures'], 'Value-use': ['valueUse'], 'Value-map': ['coreValue', 'integration'], 'Ref-relevance': ['relevance'] });
  for (const [type, keys] of Object.entries(DECISIVE)) assert.ok(keys.every(key => REQUIRED[type].includes(key)), type);
});

test('E.6 #14 field coverage is reported apart from verification: per type, answers verified, base judgements accepted, and each field by state; an answer without a field record is read as before', () => {
  const answer = (label, values, extra = {}) => ({ type: 'Activity-fit', label, aspects: { values, invalid: [], missing: [] }, ...extra });
  const J = [
    answer('ALIGNED', { teaching: 'sound', learnerSupport: 'not_assessed' }), //               verified, accepted
    answer('ALIGNED', { teaching: 'not_assessed', learnerSupport: 'adequate' }), //            verified, shown for review
    answer('ALIGNED', { teaching: 'weak', learnerSupport: 'adequate' }), //                    verified, self-contradictory
    answer('ALIGNED', { teaching: 'sound', learnerSupport: 'adequate' }, { unverified: true }), // not verified: its fields are not counted
    { type: 'Activity-fit', label: 'ALIGNED' }, //                                               no field record (before Stage C)
    { type: 'CLO-PO', label: 'ALIGNED' }, //                                                     not a lesson relationship
  ];
  const s = coverageSummaryOf(J);
  assert.deepEqual(s.byType['Activity-fit'], { relationships: 5, baseVerified: 4, baseAccepted: 1, notRecorded: 1, fields: {
    teaching: { assessed: 1, not_assessed: 1, missing: 0, malformed: 0, contradicted: 1 }, learnerSupport: { assessed: 1, not_assessed: 1, missing: 0, malformed: 0, contradicted: 1 } } });
  assert.deepEqual([s.fieldsRequired, s.fieldsAssessed, Math.round(s.rate * 1000) / 1000], [6, 2, 0.333]);
  assert.equal(coverageOf(J[4]), null, 'no field record: no coverage, read as it always was');
  assert.deepEqual(coverageOf(answer('ALIGNED', { teaching: 'sound' })).fields, { teaching: 'assessed', learnerSupport: 'missing' });
  assert.deepEqual(coverageOf({ ...answer('ALIGNED', { teaching: 'great', learnerSupport: 'adequate' }), aspects: { values: { learnerSupport: 'adequate' }, invalid: ['teaching'] } }).decisive, ['teaching'], 'a malformed base field is not assessed');
  assert.equal(coverageSummaryOf([{ type: 'CLO-PO', label: 'ALIGNED' }]), null, 'every stage of C and D off: nothing to report');
  // the evaluation report: the fields clause follows the relationship counts
  const t = createTracker();
  t.plan(['1:a', '1:b']); t.sent({ keys: ['1:a', '1:b'], answered: true, verified: ['1:a', '1:b'] });
  t.settle('1:a', J[0]); t.settle('1:b', J[1]);
  assert.match(describe(t.metrics()), /; fields assessed 2 of 4 \(50%\) in the verified answers, 1 of 2 base judgements on their own assessed field$/);
});

// ---------------- 15: quotes are copied exactly; the validator is unchanged ----------------
test('E.6 #15 quotes: the copy instruction is in every staged prompt and in no all-off prompt; a capitalisation-only change is still refused, a spacing-only change still accepted', () => {
  const on = systemPromptOf('current', ALL, []), off = systemPromptOf('current', NONE, []);
  assert.ok(on.includes(Q.exact) && !off.includes('character for character'));
  for (const stage of STAGES) assert.ok(systemPromptOf('current', { ...OR, ...flagsOf([stage]) }, []).includes(Q.exact), stage);
  const contract = contractOf(ALL, BSIE);
  // (the entry reads "A history of medieval architecture"; the course context has both "Systems Engineering" and "systems engineering", so either is exact)
  const recapitalised = () => verifyAnswer(json([answerFor(RR_BSIE, { label: 'NOT_ALIGNED', recommendation: 'REVIEW_REQUIRED', explanation: 'Another subject.', sourceQuote: 'systems engineering', targetQuote: 'A History of Medieval Architecture', relevance: 'unrelated', basis: 'title_only' })]), [RR_BSIE], contract);
  assert.throws(recapitalised, e => e.unverified && e.rejected[0].code === 'quote_not_found' && e.rejected[0].problems.some(p => p.side === 'target'));
  const spaced = verifyAnswer(json([answerFor(RR_BSIE, { label: 'NOT_ALIGNED', recommendation: 'REVIEW_REQUIRED', explanation: 'Another subject.', sourceQuote: 'Systems  Engineering', targetQuote: 'A history of  medieval architecture', relevance: 'unrelated', basis: 'title_only' })]), [RR_BSIE], contract);
  assert.deepEqual(spaced[0].evidenceMatching, { source: 'whitespace', target: 'whitespace' }, 'accepted, and recorded as a spacing-only match');
});

// ---------------- 16-17: cached answers ----------------
test('E.6 #16 cached-response compatibility: no -r6 answer is reused under -r7; a stored -r7 answer is read exactly as a fresh one; an answer stored without its field record is read as before', async () => {
  const course = courseOf(S.content), pairs = pairsOf(S.content, S.masters, []);
  for (const [earlier, now] of [['alignment-12ab34c1c2d1d2-r6', promptVersionOf(MODEL, ALL)], [promptVersionOf(MODEL, ALL), promptVersionOf(MODEL, { ...ALL, ...MI })]]) {
    const before = new Set(pairs.map(p => pairKey(p, 'openrouter', MODEL, earlier, courseKeyOf(course))));
    assert.ok(pairs.every(p => !before.has(pairKey(p, 'openrouter', MODEL, now, courseKeyOf(course)))), `${earlier} is not reused under ${now}`);
  }
  // A whole check with some fields left unassessed; the report stored as the repository stores it (JSON), and offered back as repository.js does.
  const unassessed = pair => (['Activity-fit', 'Assessment-fit', 'Value-use'].includes(pair.type) && /row[24]-/.test(pair.id) ? { label: 'ALIGNED' } : { label: 'ALIGNED', fields: ANSWER_FIELDS[pair.type] });
  const fresh = await check(G_ALL, unassessed);
  const stored = JSON.parse(JSON.stringify(fresh.result));
  const reusable = judgements => new Map(judgements.filter(j => typeof j.key === 'string' && !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE').map(j => [j.key, j]));
  const again = await check(G_ALL, unassessed, { reuse: reusable(stored.hybrid.alignment.judgements) });
  assert.equal(again.log.requests, 0, 'nothing changed, so nothing is asked');
  const rows = r => buildVerdict(r, S.content, { all: true }).all.map(f => [f.ruleId, f.relationshipId, f.status, f.verification || null]);
  assert.deepEqual(rows(again.result), rows(fresh.result), 'the stored answers keep their fields: the same findings');
  assert.ok(rows(fresh.result).some(([, , status, why]) => status === 'NEEDS_REVIEW' && why === 'aspects_not_assessed'), 'the coverage rule is part of what is compared');
  // the same answers without their field records (as saved before Stage C): base judgements read from the label, no derived finding
  const legacy = stored.hybrid.alignment.judgements.map(j => (j.type === 'Activity-fit' ? (({ aspects, ...rest }) => rest)(j) : j));
  const old = await check(G_ALL, unassessed, { reuse: reusable(legacy) });
  const activity = old.result.hybrid.alignment.judgements.filter(j => j.type === 'Activity-fit');
  assert.ok(activity.length > 0 && activity.every(j => j.reused && !j.aspects));
  for (const j of activity) assert.deepEqual(findingsOf(old.result, j.id), [['ALN-05', 'PASS', 'quotes_verified']], j.id);
  assert.equal(official(old.result), official(fresh.result));
});

// ---------------- 17: every stage on, every stage off ----------------
test('E.6 #17 all stages off: alignment-10 byte for byte, the earlier batch size and retries, no minItems and no copy instruction, whatever the new flag says', async () => {
  for (const env of [NONE, { ...NONE, ...MI }]) {
    assert.equal(sha(systemPromptOf('current', env, [{ type: 'CLO-PO' }])), ALPHA_10);
    assert.equal(promptVersionOf(MODEL, env), 'alignment-10');
    assert.equal(batchSizeOf(MODEL, env), 12);
    const r = router(() => '{"judgements": [', { env });
    await judgeBatch(r.request, SYSENG1, { halve: false });
    assert.deepEqual(r.bodies.map((_, n) => r.userOf(n).document_data.length), [4, ...Array(12).fill(1)], 'the earlier cascade');
    assert.ok(r.bodies.every((b, n) => !('corrections' in r.userOf(n)) && !('minItems' in b.response_format.json_schema.schema.properties.judgements) && !b.messages[0].content.includes('character for character')));
  }
  assert.equal(userMessageOf(BSIE, SYSENG1), JSON.stringify({ course: BSIE, document_data: SYSENG1 }));
  // the advisory flags stay off by default, and the new one is documented off
  assert.deepEqual(stageFlags({}), { a: false, b: false, b3: false, b4: false, c1: false, c2: false, d1: false, d2: false });
  assert.equal(minItemsOn({}), false);
  const example = fs.readFileSync(path.join(__dirname, '..', '..', '.env.example'), 'utf8');
  assert.match(example, /^#SYLLABUS_CHECK_SCHEMA_MIN_ITEMS=off\r?$/m);
  assert.ok(!/^SYLLABUS_CHECK_(STAGE_\w+|SCHEMA_MIN_ITEMS|PROMPT_TRIM)=on/m.test(example));
});

test('E.6 #18 the official result is the same with every stage on and off, whatever the advisory answers: unassessed fields, contradictions, an opportunity, a bare name', async () => {
  const off = (await check(G)).result;
  const scenarios = {
    clean: pair => ({ label: 'ALIGNED', fields: ANSWER_FIELDS[pair.type] || (pair.type === 'Value-map' ? { coreValue: 'Community-orientedness', integration: 'demonstrated' } : {}) }),
    unassessed: () => ({ label: 'ALIGNED' }),
    contradictory: pair => (pair.type === 'Value-use' ? { label: 'ALIGNED', fields: { valueUse: 'opportunity', carriedBy: 'activity', valueFit: 'fits', responsible: 'none' } } : pair.type === 'Activity-fit' ? { label: 'ALIGNED', fields: { teaching: 'weak', learnerSupport: 'limited', responsible: 'activity' } } : null),
    failing: pair => (pair.type === 'Value-use' ? { label: 'NOT_ALIGNED', fields: { valueUse: 'name_only', carriedBy: 'none', valueFit: 'partly', responsible: 'values' } } : pair.type === 'Assessment-fit' ? { label: 'NOT_ALIGNED', fields: { measures: 'not_assessed', evidence: 'vague', level: 'too_low', responsible: 'assessment' } } : null),
  };
  const seen = new Set();
  for (const [name, decide] of Object.entries(scenarios)) {
    const { result } = await check(G_ALL, decide);
    assert.equal(official(result), official(off), name);
    assert.equal(result.hybrid.alignment.promptVersion, `alignment-12ab34c1c2d1d2-r${C_PROMPT_REVISION}-a8`);
    const verdict = buildVerdict(result, S.content, { all: true });
    assert.equal(verdict.advisory, true);
    seen.add(JSON.stringify(verdict.counts));
  }
  assert.equal(seen.size, Object.keys(scenarios).length, 'the advisory verdicts differ; the official result does not');
  assert.equal(off.hybrid.alignment.promptVersion, 'alignment-10');
  assert.equal(buildVerdict(off, S.content).aspectCoverage, undefined, 'no lesson relationship with every stage off: no coverage block');
  // the official policy itself
  assert.deepEqual({ ...POLICY, advisoryTypes: undefined }, { version: 'syllabus-policy-2', link: 2, alignment: 3, partialAlignment: 1, value: 1, minWeek: 1, maxWeek: 18, maxRewriteAttempts: 2, advisoryTypes: undefined });
  assert.equal(standard.passThreshold, 79);
  assert.equal(aiGate({}), 'advisory'); assert.equal(aiGate(G_ALL), 'advisory');
});
