'use strict';
// Offline tests of the evaluation-only recommendation contract lcup-v2-recommendation-2 (server/lib/syllabuscheck/academicV2Recommendation.js) on the
// three Policy V2 smoke cases and the non-protected pilot cases of the frozen bundle. Every model answer here is either the recorded smoke answer
// (docs/lcup-v2-evaluation/live-smoke-REVIEWED/raw, read only) or a mocked one; fetch is blocked for the whole file. These tests show software
// behaviour only: a mocked answer is never evidence of academic accuracy.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new TypeError('fetch failed (network blocked in recommendation.test.cjs)'); };
test.after(() => { globalThis.fetch = realFetch; });
const P = require('./pipeline.cjs');
const G = require('../../server/lib/syllabuscheck/gemini');
const R2 = require('../../server/lib/syllabuscheck/academicV2Recommendation');
const { POLICY } = require('../../server/lib/syllabuscheck/academicV2Plan');
const { stageFlags, recommendOn } = require('../../server/lib/syllabuscheck/stages');
const { schemaProblems } = require('../../server/lib/syllabuscheck/anthropicSchema');

const MODEL = 'claude-sonnet-5-5', KEY = 'sk-ant-unit-test-only-not-a-real-key';
const env = { ...P.envFor(MODEL, KEY), ANTHROPIC_MAX_TOKENS: '4096' };
const read = file => fs.readFileSync(path.join(P.root, file), 'utf8');
const bundle = JSON.parse(read('docs/lcup-v2-evaluation/prepared-final/bundle.json'));
const SMOKE = 'docs/lcup-v2-evaluation/live-smoke-REVIEWED';
const recorded = JSON.parse(read(`${SMOKE}/results.json`));
const caseOf = id => {
  const c = bundle.cases.find(x => x.id === id), ctx = bundle.contexts[c.contextId], pair = P.pairOf(c, ctx), course = G.courseOf(ctx.content);
  return { c, ctx, pair, course, rec: R2.prepare(ctx.content, ctx.masters, { version: R2.VERSION, academicPolicy: POLICY.id, evaluationOnly: true, env, provider: 'anthropic', recommend: recommendOn(stageFlags(env)) }) };
};
const SMOKE_IDS = bundle.scopes.smoke, [IT202, IE402, CPE304] = SMOKE_IDS.map(caseOf);
const smokeAnswer = n => JSON.parse(JSON.parse(read(`${SMOKE}/raw/00${n + 1}.json`)).content.filter(b => b.type === 'text').map(b => b.text).join('')).judgements[0];
const [A_IT202, A_IE402, A_CPE304] = [0, 1, 2].map(smokeAnswer);
const one = (k, answer, rec) => G.verifyAnswer(JSON.stringify({ judgements: [answer] }), [k.pair], G.contractOf(env, k.course, rec))[0];
const baseline = (k, answer) => one(k, answer, null), improved = (k, answer) => one(k, answer, k.rec);
const CORE = ['id', 'type', 'path', 'targetPath', 'label', 'explanation', 'sourceQuote', 'targetQuote', 'evidenceMatching', 'sourceBloom', 'targetBloom', 'aspects', 'explanationReview'];
const core = j => Object.fromEntries(CORE.map(key => [key, j[key]]));
const refusedCodes = fn => { try { fn(); } catch (e) { return e.codes || [e.code]; } return []; };
// The request a check would send, captured before anything leaves the process.
async function captured(k, recommendation) {
  let body = null;
  await assert.rejects(G.requestAnthropic([k.pair], { env, course: k.course, academicPolicy: POLICY.id, ...(recommendation ? { recommendation } : {}), transport: async (_url, init) => { body = init.body; throw Object.assign(Error('captured offline'), { refused: true }); } }));
  return body;
}
const contextOf = async k => JSON.parse(JSON.parse(await captured(k, k.rec)).messages[0].content).recommendation_context;

test('Policy V2 without r2 has no recommendation contract and keeps the CLO description exclusion', async () => {
  for (const [n, k] of [IT202, IE402, CPE304].entries()) {
    const body = JSON.parse(await captured(k, null));
    const user = JSON.parse(body.messages[0].content);
    assert.equal('recommendation_context' in user, false, `${k.c.id}: r2 context is opt-in`);
    assert.equal('correctionField' in body.output_config.format.schema.properties.judgements.items.properties, false, `${k.c.id}: baseline schema is unchanged by r2`);
    assert.match(body.system[0].text, /course description is not part of this relationship/i);
    const { key, ...stored } = recorded.observations.find(o => o.id === k.c.id).judgment;
    assert.deepEqual(baseline(k, smokeAnswer(n)), stored, `${k.c.id}: the baseline processing changed`);
  }
  assert.deepEqual(Object.keys(G.contractOf(env)).sort(), ['aspectKeys', 'course', 'recommend', 'retagTypes', 'strict']);
});

test('versioned: the contract appends its own prompt, adds only recommendation_context and two schema fields, and names its version', async () => {
  const before = JSON.parse(await captured(IE402, null)), after = JSON.parse(await captured(IE402, IE402.rec));
  assert.equal(after.system[0].text, before.system[0].text + R2.PROMPT);
  const userBefore = JSON.parse(before.messages[0].content), userAfter = JSON.parse(after.messages[0].content);
  assert.deepEqual(Object.keys(userAfter), ['course', 'document_data', 'recommendation_context']);
  assert.deepEqual(userAfter.course, userBefore.course);
  assert.deepEqual(userAfter.document_data, userBefore.document_data);
  const fieldsBefore = Object.keys(before.output_config.format.schema.properties.judgements.items.properties), fieldsAfter = Object.keys(after.output_config.format.schema.properties.judgements.items.properties);
  assert.deepEqual(fieldsAfter.filter(f => !fieldsBefore.includes(f)), ['correctionField', 'correctionReason']);
  assert.deepEqual(fieldsAfter.slice(fieldsAfter.indexOf('correctionField'), fieldsAfter.indexOf('draft') + 1), ['correctionField', 'correctionReason', 'recommendation', 'draft']);
  assert.deepEqual(after.output_config.format.schema.properties.judgements.items.properties.correctionField.enum, R2.FIELDS);
  assert.deepEqual(schemaProblems(after.output_config.format.schema), [], 'the schema passes the Anthropic structured-output lint');
  for (const key of ['model', 'max_tokens', 'thinking']) assert.deepEqual(after[key], before[key]);
  assert.match(R2.PROMPT, /^\nRecommendation contract lcup-v2-recommendation-2 \(faculty-review advisory; never automatically applied\)/);
  assert.deepEqual(Object.keys(R2.SCOPE).sort(), [...POLICY.weeklyTypes].sort(), 'exactly the seven weekly relationships; no new relationship');
});

test('IT 202: the valid CLO1 mapping is preserved; a draft that drops the printed label is withheld, and one that keeps it is offered', async () => {
  const context = await contextOf(IT202), entry = context.pairs[IT202.pair.id];
  assert.deepEqual(entry.printed, { number: 'ILO 1:', labels: ['[CLO1]'] });
  assert.deepEqual(entry.clos, ['CLO 1']);
  assert.equal(context.clos['CLO 1'].statement, IT202.ctx.content.clos[0].statement);
  assert.equal(context.clos['CLO 1'].poReference, 'held', 'the PO reference is held for this course, so no PO wording is sent');
  assert.equal(context.clos['CLO 1'].poTexts, undefined);
  assert.deepEqual(context.clos['CLO 1'].egas.map(e => e.ega), [1, 3, 4]);
  const before = structuredClone(IT202.ctx.content);
  // The recorded smoke draft, offered by the baseline although it drops [CLO1]:
  assert.equal(baseline(IT202, A_IT202).draftReview, undefined, 'the baseline offered the draft');
  const dropped = improved(IT202, { ...A_IT202, correctionField: 'ilo', correctionReason: 'The ILO asks for more than the orientation content teaches.' });
  assert.deepEqual(core(dropped), core(baseline(IT202, A_IT202)), 'the judgement is unchanged');
  assert.deepEqual(dropped.correction.withheld, ['changes_printed_label']);
  assert.equal(dropped.correction.checks[0].evidence, '[CLO1]');
  assert.equal(dropped.correction.decision, 'REVIEW_REQUIRED');
  assert.equal(dropped.correction.draftOffered, false);
  assert.ok(dropped.draftReview.includes('changes_printed_label'), 'the existing withholding pathway receives the code');
  // The same correction keeping the number and the label is offered.
  const kept = improved(IT202, { ...A_IT202, draft: `${A_IT202.draft} [CLO1]`, correctionField: 'ilo', correctionReason: 'The ILO asks for more than the orientation content teaches.' });
  assert.equal(kept.correction.decision, 'REWRITE_TEXT');
  assert.equal(kept.correction.draftOffered, true);
  assert.equal(kept.correction.path, 'plan[0].ilos[0].text');
  assert.equal(kept.correction.canAutoApply, false);
  assert.ok(kept.draft.startsWith('ILO 1:') && kept.draft.endsWith('[CLO1]'));
  assert.deepEqual(IT202.ctx.content, before, 'no syllabus text, tag or mapping is modified');
});

test('IE 402: the correction can name another field or ask for faculty review instead of an ILO rewrite', async () => {
  const context = await contextOf(IE402), entry = context.pairs[IE402.pair.id], row = context.rows[entry.row];
  assert.match(row.values, /Interiority/);
  assert.match(row.activities, /Vision, Mission and\nGoals of LCUP/);
  assert.deepEqual(entry.fields.map(f => [f.field, f.draft]), [['ilo', 'full'], ['course_content', 'full'], ['ilo_week', 'none']]);
  const clo4 = context.clos['CLO 4'];
  assert.equal(clo4.statement, 'Demonstrate the Filipino- Catholic Augustinian Spirituality through value webbing.');
  assert.equal(clo4.ilos.length, 11, 'every ILO mapped to CLO 4 is visible');
  assert.equal(clo4.ilos.filter(o => /spiritual/i.test(o.text)).length, 1, 'only this ILO states the spirituality competence');
  assert.ok(context.planOutline.length === IE402.ctx.content.plan.length);
  const judged = core(baseline(IE402, A_IE402));
  // Faculty review, no draft: refused by the baseline contract, a complete answer under the new one.
  const review = { ...A_IE402, recommendation: 'REVIEW_REQUIRED', draft: '', correctionField: 'undetermined', correctionReason: 'The orientation week carries a values discussion and this is the only ILO stating the CLO 4 spirituality competence, so faculty should decide between revising the content and moving the ILO.' };
  const { correctionField, correctionReason, ...reviewAsBaseline } = review;
  assert.deepEqual(refusedCodes(() => baseline(IE402, reviewAsBaseline)).sort(), ['missing_draft', 'recommendation_not_allowed'], 'the baseline contract forces a rewrite');
  const asked = improved(IE402, review);
  assert.deepEqual(core(asked), judged);
  assert.equal(asked.recommendation, 'REVIEW_REQUIRED');
  assert.equal(asked.draft, '');
  assert.deepEqual([asked.correction.decision, asked.correction.field, asked.correction.path], ['REVIEW_REQUIRED', 'undetermined', null]);
  const moved = improved(IE402, { ...review, correctionField: 'ilo_week' });
  assert.deepEqual([moved.correction.decision, moved.correction.field, moved.correction.path], ['REVIEW_REQUIRED', 'ilo_week', 'plan[0].ilos[0]']);
  // Another field: the week's course content, added to (never cut), offered for that field's own path.
  const content = IE402.ctx.content.plan[0].contents, added = `${content}\nE. Vision, Mission and Goals of LCUP and CITE: the Augustinian, Marian and missionary Christ-centered spirituality, through value webbing`;
  const revised = improved(IE402, { ...A_IE402, draft: added, correctionField: 'course_content', correctionReason: 'The week already discusses the Vision, Mission and Goals and names its values, but the course content does not state them; adding them keeps the only CLO 4 spirituality ILO.' });
  assert.deepEqual(core(revised), judged);
  assert.deepEqual([revised.correction.decision, revised.correction.field, revised.correction.path, revised.correction.target, revised.correction.draftOffered], ['REWRITE_TEXT', 'course_content', 'plan[0].contents', false, true]);
  assert.equal(revised.draftReview, undefined);
  const cut = improved(IE402, { ...A_IE402, draft: 'I. Augustinian, Marian and missionary spirituality through value webbing', correctionField: 'course_content', correctionReason: 'The content should teach the ILO.' });
  assert.deepEqual(cut.correction.withheld, ['removes_field_content'], 'a content revision that cuts the orientation is withheld');
  // The recorded smoke draft (the ILO turned into an orientation outcome) is withheld: it loses the terms ILO10 shares with CLO 4.
  const smoke = improved(IE402, { ...A_IE402, correctionField: 'ilo', correctionReason: 'The ILO is not about the orientation content.' });
  assert.deepEqual(core(smoke), judged);
  assert.deepEqual(smoke.correction.withheld, ['weakens_mapped_clo']);
  assert.equal(smoke.correction.checks[0].evidence, 'CLO 4: spirituality, web');
  assert.equal(smoke.correction.decision, 'REVIEW_REQUIRED');
  assert.equal(baseline(IE402, A_IE402).draftReview, undefined, 'the baseline offered it');
});

test('CpE 304: the cross-week use of ILO1 is in the request before any recommendation, and a narrowing rewrite becomes faculty review', async () => {
  const body = JSON.parse(await captured(CPE304, CPE304.rec)), context = JSON.parse(body.messages[0].content).recommendation_context, entry = context.pairs[CPE304.pair.id];
  assert.deepEqual(entry.sameIloOtherWeeks, [{ week: '7-8', path: 'plan[4].ilos[0].text', contents: CPE304.ctx.content.plan[4].contents }]);
  assert.match(entry.sameIloOtherWeeks[0].contents, /Analog to Digital/);
  assert.deepEqual(entry.fields[0], { field: 'ilo', path: 'plan[1].ilos[0].text', draft: 'none', because: 'shared_across_weeks', target: true });
  assert.deepEqual(context.rows['plan[1]'].ilos.map(o => o.text), CPE304.ctx.content.plan[1].ilos.map(o => o.text), 'ILO2 of the same week is visible');
  assert.match(R2.PROMPT, /"sameIloOtherWeeks"/);
  const judged = core(baseline(CPE304, A_CPE304));
  assert.equal(baseline(CPE304, A_CPE304).draftReview, undefined, 'the baseline offered the narrowing draft');
  const narrowed = improved(CPE304, { ...A_CPE304, correctionField: 'ilo', correctionReason: 'The ILO is broader than this week.' });
  assert.deepEqual(core(narrowed), judged);
  assert.deepEqual(narrowed.correction.withheld, ['shared_across_weeks']);
  assert.equal(narrowed.correction.decision, 'REVIEW_REQUIRED');
  assert.equal(narrowed.correction.draftOffered, false);
  const review = improved(CPE304, { ...A_CPE304, recommendation: 'REVIEW_REQUIRED', draft: '', correctionField: 'ilo', correctionReason: 'Weeks 7-8 state the same ILO for analog-to-digital conversion, so narrowing it here would change that week too; faculty should decide.' });
  assert.deepEqual(core(review), judged);
  assert.deepEqual([review.recommendation, review.correction.decision, review.correction.path, review.draft], ['REVIEW_REQUIRED', 'REVIEW_REQUIRED', 'plan[1].ilos[0].text', '']);
});

test('judgements are unchanged by recommendation processing: every weekly type, every label, every recommendation', () => {
  const protectedContexts = new Set(['ctx-S07', 'ctx-S08', 'ctx-S09', 'ctx-S10', 'ctx-S11', 'ctx-S12']);
  const cases = bundle.scopes.pilot.map(id => bundle.cases.find(c => c.id === id)).filter(c => !protectedContexts.has(c.contextId)).map(c => caseOf(c.id));
  assert.deepEqual([...new Set(cases.map(k => k.pair.type))].sort(), [...POLICY.weeklyTypes].sort());
  const aspects = Object.fromEntries(G.ASPECT_KEYS.map(key => [key, 'not_assessed']));
  const words = text => String(text).trim().split(/\s+/).slice(0, 4).join(' ');
  let compared = 0;
  for (const k of [...cases, IT202, IE402, CPE304]) {
    const rewrite = !G.isNoRewrite(k.pair.type), own = R2.SCOPE[k.pair.type].find(([field]) => k.rec.scopeOf(k.pair).fields.find(f => f.field === field)?.target)?.[0];
    for (const label of ['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED', 'INSUFFICIENT_EVIDENCE']) {
      const failing = label === 'PARTIALLY_ALIGNED' || label === 'NOT_ALIGNED';
      const answer = { id: k.pair.id, label, explanation: 'Synthetic offline answer for software testing only.', sourceQuote: label === 'INSUFFICIENT_EVIDENCE' ? '' : words(k.pair.source), targetQuote: label === 'INSUFFICIENT_EVIDENCE' ? '' : words(k.pair.target), sourceBloom: 'Understand', targetBloom: 'Apply',
        recommendation: label === 'ALIGNED' ? 'NO_CHANGE' : failing && rewrite ? 'REWRITE_TEXT' : 'REVIEW_REQUIRED', draft: !failing ? '' : rewrite ? `${k.pair.target}\nRevised for testing.` : 'Revise the target so that it follows the source.', ...aspects };
      const reference = core(baseline(k, answer));
      const variants = [{ correctionField: 'none', correctionReason: '' }, { correctionField: own || 'undetermined', correctionReason: 'Synthetic reason.' }, { correctionField: 'not-a-field', correctionReason: '' }];
      if (failing) variants.push({ recommendation: 'REVIEW_REQUIRED', draft: rewrite ? '' : answer.draft, correctionField: 'undetermined', correctionReason: 'Synthetic reason.' });
      if (failing && k.pair.type === 'ILO-CLO') variants.push({ recommendation: 'RETAG_OUTCOME', draft: '', correctionField: 'clo_mapping', correctionReason: 'Synthetic reason.' });
      for (const variant of variants) {
        const j = improved(k, { ...answer, ...variant });
        assert.deepEqual(core(j), reference, `${k.c.id} ${label} ${JSON.stringify(variant)}`);
        assert.equal(j.correction.canAutoApply, false);
        if (!failing) assert.equal(j.correction.decision, j.recommendation);
        compared++;
      }
    }
  }
  assert.ok(compared >= 19 * 4 * 3);
});

test('end to end through align: the contract travels in the one Policy V2 request and returns a verified, nonofficial result', async () => {
  const sent = [];
  const answer = { ...A_IE402, recommendation: 'REVIEW_REQUIRED', draft: '', correctionField: 'undetermined', correctionReason: 'Faculty should decide between the week content and the ILO week.' };
  const transport = async (_url, init) => { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'msg_offline', type: 'message', role: 'assistant', model: MODEL, content: [{ type: 'text', text: JSON.stringify({ judgements: [answer] }) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } }), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_offline' } }); };
  const result = await G.align(IE402.ctx.content, IE402.ctx.masters, { env, pairs: [IE402.pair], academicPolicy: POLICY.id, evaluationOnly: true, transport, skipEmpty: false, recommendation: R2.VERSION });
  assert.equal(sent.length, 1, 'one request: no extra stage');
  assert.ok(JSON.parse(sent[0].messages[0].content).recommendation_context.pairs[IE402.pair.id]);
  assert.equal(result.status, 'completed');
  assert.equal(result.evaluationOnly, true);
  assert.equal(result.promptVersion, `${G.promptVersionOf(MODEL, env)}-${POLICY.id}-${R2.VERSION}`);
  assert.equal(G.verifiedAlignment(result, env), false, 'never counts as a verified (official) check');
  const [j] = result.judgements;
  assert.deepEqual(core(j), core(baseline(IE402, A_IE402)));
  assert.deepEqual([j.recommendation, j.correction.decision, j.draft], ['REVIEW_REQUIRED', 'REVIEW_REQUIRED', '']);
});

test('inactive outside an evaluation: refused before any request unless explicitly requested by a Claude evaluation under Policy V2', async () => {
  let calls = 0;
  const transport = async () => { calls++; throw Error('must not be called'); };
  const base = { env, pairs: [IE402.pair], academicPolicy: POLICY.id, evaluationOnly: true, transport, skipEmpty: false, recommendation: R2.VERSION };
  const refusals = [{ evaluationOnly: false }, { env: undefined }, { academicPolicy: undefined }, { recommendation: 'lcup-v2-recommendation-1' }, { env: { ...env, SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'sk-or-unit-test-only', OPENROUTER_MODEL: 'google/gemini-3.8-flash' } }];
  for (const change of refusals) {
    const options = { ...base, ...change };
    if (change.env === undefined && 'env' in change) delete options.env;
    await assert.rejects(G.align(IE402.ctx.content, IE402.ctx.masters, options), /approved Claude request|Unknown recommendation contract/, JSON.stringify(Object.keys(change)));
  }
  assert.equal(calls, 0);
  assert.throws(() => R2.prepare(IE402.ctx.content, IE402.ctx.masters, { version: R2.VERSION, academicPolicy: POLICY.id, evaluationOnly: true, provider: 'anthropic', recommend: false }), /approved Claude request/);
  await assert.rejects(G.requestAnthropic([IE402.pair], { env, course: IE402.course, academicPolicy: POLICY.id, recommendation: R2.VERSION, transport }), /must be prepared/);
  // An answer in the new format is refused by the baseline contract, so the unchanged runner or the application can never record one.
  assert.deepEqual(refusedCodes(() => baseline(IE402, { ...A_IE402, correctionField: 'ilo', correctionReason: 'x' })), ['schema']);
  const activation = require('../../server/lib/syllabuscheck/academicV2Activation');
  assert.equal(activation.enabled({}), false);
  assert.equal(activation.integrated({ integratedAcademic: true, academicPolicy: POLICY.id }, { SYLLABUS_CHECK_ACADEMIC_V2: 'on' }), true);
  assert.equal(activation.integrated({ integratedAcademic: true, academicPolicy: POLICY.id }, { SYLLABUS_CHECK_ACADEMIC_V2: 'off' }), false);
});

test('deterministic helpers: printed labels, ILO numbers and statements', () => {
  assert.deepEqual(R2.labelsOf('ILO1: Demonstrate the skills [CLO 1,2] and (CLO 2, CLO 3) [CLO 1-2] [PO 4]'), ['[CLO 1,2]', '(CLO 2, CLO 3)', '[CLO 1-2]', '[PO 4]']);
  assert.deepEqual(R2.labelsOf('Discuss the policies (possibly two) [Note 1]'), []);
  assert.deepEqual(['ILO 1: Describe', 'ILO10: Demonstrate', 'LO1. Explain', 'Describe the course'].map(R2.numberOf), ['1', '10', '1', null]);
  assert.equal(R2.statementOf('ILO1: To develop skills in analysis [CLO1]'), R2.statementOf('ILO 3:  To develop skills in   analysis [CLO 2]'));
});

// ---- The isolated runner with an r2 bundle (pipeline.cjs, prepare.cjs, report.cjs, run.cjs), planned and executed against mocked transports only.
// The fixture receipts below authorize nothing outside this file; no live receipt is written.
const { spawnSync } = require('node:child_process');
const { report } = require('./report.cjs');
const BASE = P.select(MODEL), R2B = P.select(MODEL, { recommendation: R2.VERSION });
const R2_LIMITS = { maxRequests: 3, maxInputTokens: 360000, maxInputTokensPerRequest: 120000, maxOutputTokens: 12288, maxOutputTokensPerRequest: 4096, maxCost: 1 };
const temp = path.join(P.root, `tmp/lcup-v2-evaluation-r2-tests-${Date.now()}-${process.pid}`);
fs.mkdirSync(temp, { recursive: true });
test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
test.afterEach(() => G.resetProviderBlock());
const receiptFor = (b, extra = {}) => ({ version: P.VERSION, approved: true, approvedBy: 'Unit test fixture, not an actual authorization', receiptId: 'synthetic-unit-test', approvedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), preparedHash: b.preparedHash, policyVersion: b.policyVersion, ...(b.recommendation ? { recommendation: b.recommendation.version } : {}), scope: 'smoke', model: MODEL, limits: R2_LIMITS, ...extra });
// The recorded smoke answer to a relationship, found by its text: pair ids repeat across courses (IT 202 and IE 402 are both row0-ilo0-contentilo).
const answerTo = p => [[IT202, A_IT202], [IE402, A_IE402], [CPE304, A_CPE304]].find(([k]) => k.pair.source === p.source && k.pair.target === p.target)[1];
// A mocked provider answering each relationship of a request with its recorded smoke answer, reshaped by `shape`.
function mockSend(shape) {
  const send = async (_url, init) => {
    send.calls++;
    const pairs = JSON.parse(JSON.parse(init.body).messages[0].content).document_data;
    return new Response(JSON.stringify({ id: 'msg_mock_only', type: 'message', role: 'assistant', model: MODEL, content: [{ type: 'text', text: JSON.stringify({ judgements: pairs.map(p => shape(answerTo(p))) }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  send.calls = 0;
  return send;
}
const facultyReview = a => ({ ...a, recommendation: 'REVIEW_REQUIRED', draft: '', correctionField: 'undetermined', correctionReason: 'Synthetic test answer: faculty should decide which field to change.' });
const unsafeDraft = a => ({ ...a, correctionField: 'ilo', correctionReason: 'Synthetic test answer: the recorded smoke draft, offered as an ILO rewrite.' });
const runWith = (b, name, send, receipt = receiptFor(b)) => P.execute(b, 'smoke', MODEL, R2_LIMITS, { receipt, key: KEY, out: path.join(temp, name), send, testOnly: true });
const recordedCore = id => core(recorded.observations.find(o => o.id === id).judgment);

test('runner: the r2 bundle is separate and versioned: the same three smoke cases and contexts, its contract named, no pilot cases', async () => {
  assert.deepEqual(R2B.recommendation, { version: R2.VERSION, official: false, productionActive: false });
  assert.deepEqual(R2B.scopes, { smoke: bundle.scopes.smoke, pilot: [] });
  assert.deepEqual(R2B.cases, bundle.scopes.smoke.map(id => bundle.cases.find(c => c.id === id)));
  assert.deepEqual(R2B.contexts, Object.fromEntries(R2B.cases.map(c => [c.contextId, bundle.contexts[c.contextId]])));
  assert.deepEqual(R2B.scopeNotes, []);
  assert.ok(P.PROMPT_FILES.includes('server/lib/syllabuscheck/academicV2Recommendation.js'));
  assert.deepEqual(R2B.promptSources, BASE.promptSources);
  assert.equal(P.verifyBundle(R2B, MODEL), R2B);
  assert.throws(() => P.select(MODEL, { recommendation: 'lcup-v2-recommendation-1' }), /Unknown recommendation contract/);
  for (const change of [{ official: true }, { productionActive: true }, { version: 'lcup-v2-recommendation-1' }]) {
    const b = structuredClone(R2B);
    Object.assign(b.recommendation, change);
    const { preparedHash, ...body } = b;
    b.preparedHash = P.hash(body);
    assert.throws(() => P.verifyBundle(b, MODEL), /recommendation contract/, JSON.stringify(change));
  }
  await assert.rejects(P.dryPlan(R2B, 'pilot', MODEL), /Empty scope/);
  // A baseline bundle is the frozen one but for the prompt fingerprints, which now also cover the contract's module.
  const { preparedHash: _base, promptSources: now, ...base } = BASE, { preparedHash: _frozen, promptSources: then, ...frozen } = bundle;
  assert.deepEqual(base, frozen);
  assert.deepEqual(Object.keys(now).filter(f => now[f] !== then[f]), ['server/lib/syllabuscheck/gemini.js', 'server/lib/syllabuscheck/stages.js', 'server/lib/syllabuscheck/academicV2Plan.js', 'server/lib/syllabuscheck/anthropicClient.js', 'server/lib/syllabuscheck/academicV2Recommendation.js']);
});

test('runner: current baseline planning stays offline, and frozen bundle evidence stays untouched', async () => {
  const smoke = await P.dryPlan(BASE, 'smoke', MODEL), pilot = await P.dryPlan(BASE, 'pilot', MODEL);
  assert.equal(smoke.networkRequests, 0);
  assert.equal(smoke.liveModelCalls, 0);
  assert.equal(pilot.networkRequests, 0);
  assert.equal(pilot.liveModelCalls, 0);
  assert.equal('recommendation' in smoke, false);
  for (const request of smoke.requests) {
    const user = JSON.parse(request.body.messages[0].content);
    assert.equal('recommendation_context' in user, false);
  }
  assert.equal(bundle.preparedHash, recorded.preparedHash, 'the frozen bundle is the one the smoke ran');
  assert.throws(() => P.verifyBundle(bundle, MODEL), /Prompt source changed since preparation/, 'and it can no longer authorize a new live run');
});

test('runner: the r2 plan is the same three requests with the contract, and its context carries the CLOs, mappings and cross-week use', async () => {
  const plan = await P.dryPlan(R2B, 'smoke', MODEL, { ...R2_LIMITS });
  const expectedPromptVersion = `${G.promptVersionOf(MODEL, { ...P.envFor(MODEL), ANTHROPIC_MAX_TOKENS: '4096' })}-${POLICY.id}-${R2.VERSION}`;
  assert.deepEqual([plan.initialRequests, plan.recommendation, plan.promptVersion, plan.budgetFitsInitial], [3, R2.VERSION, expectedPromptVersion, true]);
  assert.ok(plan.cost.worst <= R2_LIMITS.maxCost);
  for (const [n, k] of [IT202, IE402, CPE304].entries()) {
    assert.deepEqual(plan.requests[n].caseIds, [k.c.id]);
    assert.deepEqual(plan.requests[n].body, JSON.parse(await captured(k, k.rec)), `${k.c.id}: the runner sends exactly the request the contract tests above verify`);
    assert.ok(plan.requests[n].conservativeBound.inputTokens <= R2_LIMITS.maxInputTokensPerRequest);
  }
  const [it, ie, cpe] = plan.requests.map((r, n) => { const c = JSON.parse(r.body.messages[0].content).recommendation_context; return { c, e: c.pairs[[IT202, IE402, CPE304][n].pair.id] }; });
  // IT 202: the printed number and CLO1 label, and CLO 1 with its EGA mappings (its PO reference is held, so no PO wording is sent).
  assert.deepEqual(it.e.printed, { number: 'ILO 1:', labels: ['[CLO1]'] });
  assert.deepEqual(it.e.clos, ['CLO 1']);
  assert.deepEqual(it.c.clos['CLO 1'].egas.map(e => e.ega), [1, 3, 4]);
  assert.equal(it.c.clos['CLO 1'].poReference, 'held');
  // IE 402: CLO 4 with every ILO mapped to it, the week's values and the plan outline.
  assert.deepEqual(ie.e.clos, ['CLO 4']);
  assert.equal(ie.c.clos['CLO 4'].ilos.length, 11);
  assert.match(ie.c.rows[ie.e.row].values, /Interiority/);
  assert.equal(ie.c.planOutline.length, IE402.ctx.content.plan.length);
  // CpE 304: Weeks 7-8 state the same ILO, so the ILO field allows no draft.
  assert.deepEqual(cpe.e.sameIloOtherWeeks.map(o => [o.week, o.path]), [['7-8', 'plan[4].ilos[0].text']]);
  assert.deepEqual(cpe.e.fields.find(f => f.field === 'ilo'), { field: 'ilo', path: 'plan[1].ilos[0].text', draft: 'none', because: 'shared_across_weeks', target: true });
  for (const { c, e } of [it, ie, cpe]) for (const title of e.clos) assert.ok(Array.isArray(c.clos[title].pos) && Array.isArray(c.clos[title].egas), `${title}: its PO and EGA mappings`);
});

test('runner: faculty-review answers are accepted end to end under r2 (guard, align, results, report) and refused by the baseline contract', async () => {
  const send = mockSend(facultyReview), r = await runWith(R2B, 'faculty-review', send);
  const expectedPromptVersion = `${G.promptVersionOf(MODEL, { ...P.envFor(MODEL), ANTHROPIC_MAX_TOKENS: '4096' })}-${POLICY.id}-${R2.VERSION}`;
  assert.deepEqual([send.calls, r.stopReason, r.recommendation, r.promptVersion, r.official], [3, null, R2.VERSION, expectedPromptVersion, false]);
  for (const o of r.observations) {
    assert.ok(o.judgment, `${o.id}: verified`);
    assert.deepEqual([o.judgment.recommendation, o.judgment.draft, o.judgment.correction.decision, o.judgment.correction.field, o.judgment.correction.canAutoApply], ['REVIEW_REQUIRED', '', 'REVIEW_REQUIRED', 'undetermined', false]);
    assert.deepEqual(core(o.judgment), recordedCore(o.id), `${o.id}: the academic judgement is the recorded smoke judgement`);
  }
  const q = report(R2B, path.join(temp, 'faculty-review'));
  assert.equal(q.recommendation, R2.VERSION);
  assert.ok(q.rows.every(x => x.status === 'REVIEWABLE_MODEL_JUDGMENT' && x.correction?.decision === 'REVIEW_REQUIRED' && x.recommendedCorrection === null && x.facultyReviewRequired));
  assert.equal(q.measurementInput.recommendation, R2.VERSION);
  assert.equal(q.measurementInput.observations.filter(o => o.judgment).length, 3);
  // The same faculty-review answer without the r2 fields is what the baseline contract refuses: its guard stops at the first request.
  const baseline = mockSend(a => ({ ...a, recommendation: 'REVIEW_REQUIRED', draft: '' })), b = await runWith(BASE, 'faculty-review-baseline', baseline);
  assert.equal(baseline.calls, 1);
  assert.ok(b.stopReason);
  assert.ok(b.observations.every(o => !o.judgment));
});

test('runner: unsafe drafts are withheld and never offered, while each judgement stays exactly the recorded smoke judgement', async () => {
  const send = mockSend(unsafeDraft), r = await runWith(R2B, 'unsafe-drafts', send);
  assert.equal(send.calls, 3);
  const expected = { [IT202.c.id]: 'changes_printed_label', [IE402.c.id]: 'weakens_mapped_clo', [CPE304.c.id]: 'shared_across_weeks' };
  for (const o of r.observations) {
    const c = o.judgment.correction;
    assert.ok(c.withheld.includes(expected[o.id]), `${o.id}: ${c.withheld}`);
    assert.deepEqual([c.stated, c.decision, c.draftOffered, c.canAutoApply], ['REWRITE_TEXT', 'REVIEW_REQUIRED', false, false]);
    assert.ok(o.judgment.draftReview.includes(expected[o.id]));
    assert.deepEqual(core(o.judgment), recordedCore(o.id), `${o.id}: the academic judgement is the recorded smoke judgement`);
  }
  for (const row of report(R2B, path.join(temp, 'unsafe-drafts')).rows) {
    assert.equal(row.recommendedCorrection, null, `${row.caseId}: a withheld draft never reaches the faculty report as a correction`);
    assert.ok(row.recommendationReview.includes(expected[row.caseId]));
  }
});

test('runner: the receipt must name the recommendation contract; a receipt that does not match is refused before any request', async () => {
  const { recommendation, ...unnamed } = receiptFor(R2B);
  for (const [b, receipt, name] of [[R2B, unnamed, 'refuse-unnamed'], [BASE, receiptFor(BASE, { recommendation: R2.VERSION }), 'refuse-named-baseline'], [R2B, receiptFor(R2B, { preparedHash: bundle.preparedHash }), 'refuse-frozen-hash']]) {
    const send = mockSend(facultyReview);
    await assert.rejects(runWith(b, name, send, receipt), /Explicit matching live authorization receipt/, name);
    assert.equal(send.calls, 0);
    assert.equal(fs.existsSync(path.join(temp, name)), false);
  }
});

test('prepare: the r2 bundle is written once, with its smoke plan, case manifest and an unapproved template that names the contract', async () => {
  const { prepare } = require('./prepare.cjs'), out = path.join(temp, 'prepared-r2'), result = await prepare(MODEL, out, { recommendation: R2.VERSION });
  assert.deepEqual(Object.keys(result.scopes), ['smoke']);
  assert.deepEqual(fs.readdirSync(out).sort(), ['authorization.template.json', 'bundle.json', 'case-manifest.json', 'smoke-plan.json']);
  const written = JSON.parse(fs.readFileSync(path.join(out, 'bundle.json'), 'utf8')), template = JSON.parse(fs.readFileSync(path.join(out, 'authorization.template.json'), 'utf8'));
  assert.deepEqual(written, R2B);
  assert.deepEqual([template.approved, template.recommendation, template.preparedHash, template.scope], [false, R2.VERSION, R2B.preparedHash, 'smoke']);
  assert.throws(() => P.authorize(template, R2B, 'smoke', MODEL, R2_LIMITS), /Explicit matching/);
  await assert.rejects(prepare(MODEL, out, { recommendation: R2.VERSION }), /already exists/);
});

test('runner CLI: the r2 bundle dry-runs three requests with no network; a live run without a receipt and a pilot are refused', () => {
  const file = path.join(temp, 'r2-bundle.json'), dir = path.join(temp, 'cli-dry'), cli = args => spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), '--bundle', file, '--model', MODEL, ...args], { encoding: 'utf8' });
  fs.writeFileSync(file, JSON.stringify(R2B));
  const limits = ['--max-requests', '3', '--max-input-tokens', '360000', '--max-input-tokens-per-request', '120000', '--max-output-tokens', '12288', '--max-output-tokens-per-request', '4096', '--max-cost', '1'];
  const dry = cli(['--scope', 'smoke', ...limits, '--out', dir]);
  assert.equal(dry.status, 0, dry.stderr);
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
  assert.deepEqual([plan.networkRequests, plan.liveModelCalls, plan.initialRequests, plan.recommendation, plan.budgetFitsInitial], [0, 0, 3, R2.VERSION, true]);
  const live = cli(['--scope', 'smoke', ...limits, '--out', path.join(temp, 'cli-no-auth'), '--live']);
  assert.notEqual(live.status, 0);
  assert.match(live.stderr, /explicit matching/);
  assert.equal(fs.existsSync(path.join(temp, 'cli-no-auth')), false);
  const pilot = cli(['--scope', 'pilot', '--out', path.join(temp, 'cli-pilot')]);
  assert.notEqual(pilot.status, 0);
  assert.match(pilot.stderr, /Empty scope/);
  assert.equal(fs.existsSync(path.join(temp, 'cli-pilot')), false);
});
