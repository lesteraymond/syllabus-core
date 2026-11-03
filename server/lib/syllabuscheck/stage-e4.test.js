// Stage E.4 regression cases 1-11, 15 and 16: the response contract of a staged check (NO_CHANGE, REWRITE_TEXT, RETAG_OUTCOME, REVIEW_REQUIRED), one
// refusal code for each problem, the bounded retry policy, and what the author is offered for a wrong tag. Cases 12-14 (the request cap, the cost
// ceiling, HTTP 401/402/403) are in provider-guard.test.js. A whole check is run with the stages on and off, and the official result (score, pass,
// readiness, deductions, blocking findings, what the submission gate reads) must be the same. Every model here is a scripted fake: no test reaches a provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { run } = require('./engine');
const gemini = require('./gemini');
const { resetProviderBlock, aspectKeysFor, isNoRewrite, pairsOf, courseOf, verifyAnswer, contractOf, judgeBatch, verifiedAlignment, promptVersionOf, batchSizeOf, systemPromptOf, CONTRACT_CODES, MAX_ATTEMPTS, STAGED_BATCH, RECOMMENDATIONS } = gemini;
const { stageFlags, recommendOn, STAGE_REVISION, C_PROMPT_REVISION } = require('./stages');
const { anyCloPairs } = require('./mapping');
const { POLICY, aiGate } = require('./policy');
const standard = require('../compliance/standard-v4.json');
const { contradictionsOf } = require('./eval/contradictions');
const { programSyllabus, PROGRAMS } = require('./eval/programSyllabi');

test.afterEach(() => resetProviderBlock());
const STAGES = ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'];
const envOf = on => ({ SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_VALUES_FILE: 'no-such-file.json', ...Object.fromEntries(on.map(k => ['SYLLABUS_CHECK_STAGE_' + k, 'on'])) });
const ALL = envOf(STAGES), NONE = envOf([]), A = envOf(['A']), AB3 = envOf(['A', 'B3']);
const MODEL = 'gemini-3.8-flash';
const base = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };

// ---- the scripted model ----
const GOOD = { 'Activity-fit': { teaching: 'sound', learnerSupport: 'adequate' }, 'Assessment-fit': { measures: 'yes', evidence: 'observable', level: 'matches' }, 'Value-use': { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits' }, 'Ref-relevance': { relevance: 'relevant', basis: 'title_and_venue' }, 'Value-map': { coreValue: 'Community-orientedness', integration: 'demonstrated' } };
const BAD = { 'Activity-fit': { teaching: 'weak', learnerSupport: 'limited' }, 'Assessment-fit': { measures: 'no', evidence: 'vague', level: 'too_low' }, 'Value-use': { valueUse: 'name_only', carriedBy: 'none', valueFit: 'partly' }, 'Ref-relevance': { relevance: 'unrelated', basis: 'title_only' }, 'Value-map': { coreValue: 'insufficient', integration: 'stated_only' } };
// rules: [[regex over "Type:id", answer or pair => answer]]; the first match wins and every other relationship is ALIGNED. The answer is written in the
// contract in force: the recommendation field only while Stage A or B3 is on and, with it off, a draft for every failing relationship that has a field
// to rewrite (the earlier contract), so one scenario can be checked with the stages on and off. `draft: undefined` leaves the field out of the answer
// and `draft: null` sends null.
function model(rules, env, log = {}) {
  const keys = aspectKeysFor(stageFlags(env)), recommend = recommendOn(stageFlags(env));
  log.asked = []; log.requests = 0;
  return async (url, req) => {
    const body = JSON.parse(req.body), batch = JSON.parse(body.contents[0].parts[0].text).document_data;
    log.requests += 1; log.schema = body.generationConfig.responseSchema; log.asked.push(...batch.map(pair => `${pair.type}:${pair.id}`));
    const answer = pair => {
      const rule = rules.find(([re]) => re.test(`${pair.type}:${pair.id}`));
      const v = !rule ? {} : typeof rule[1] === 'function' ? rule[1](pair) : rule[1];
      const label = v.label || 'ALIGNED', rewrite = (label === 'PARTIALLY_ALIGNED' || label === 'NOT_ALIGNED') && !isNoRewrite(pair.type);
      const keepsText = recommend && (v.draft === '' || v.recommendation === 'RETAG_OUTCOME');
      return { id: pair.id, label, explanation: v.explanation ?? 'Judged by the scripted test model.', sourceQuote: v.sourceQuote ?? pair.source.slice(0, 14), targetQuote: v.targetQuote ?? pair.target.slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A',
        ...(recommend ? { recommendation: v.recommendation || (label === 'ALIGNED' ? 'NO_CHANGE' : rewrite ? 'REWRITE_TEXT' : 'REVIEW_REQUIRED') } : {}),
        draft: 'draft' in v && v.draft == null ? v.draft : v.draft || (rewrite && !keepsText ? `MODEL-DRAFT for ${pair.id}` : ''), ...Object.fromEntries(keys.map(k => [k, 'not_assessed'])), ...((label === 'ALIGNED' ? GOOD : BAD)[pair.type] || {}) };
    };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
}
async function check(s, { rules = [], env = ALL, mutate } = {}) {
  const content = structuredClone(s.content);
  if (mutate) mutate(content);
  const given = structuredClone(content), log = {};
  resetProviderBlock();
  const result = await run(given, s.masters, { ...base, env, transport: model(rules, env, log) });
  return { result, verdict: result.hybrid.verdict, log, content, given };
}
// What the official result and the submission gate read: score, pass, readiness, the points total and every deduction, the blocking findings, the
// summary, and whether the alignment counts as verified (compliance/service.js requireHybrid with SYLLABUS_CHECK_AI_GATE=required).
const official = r => JSON.stringify([r.score, r.passed, r.hybrid.ready, r.hybrid.provisionalScore, r.hybrid.deductions.map(d => [d.id, d.points, d.reason]), r.conformance.failed.map(f => f.id).sort(), r.hybrid.summary.status, verifiedAlignment(r.hybrid.alignment)]);
const at = (r, path) => r.hybrid.suggestions.filter(s => s.path === path);
const judgement = (r, id) => r.hybrid.alignment.judgements.find(j => j.id === id);
const findingOf = (v, id, legacy) => v.findings.find(f => f.relationshipId === id && (!legacy || f.legacyRuleId === legacy));

// ---- the scenarios (BSIT, eval/programSyllabi.js) ----
const S = programSyllabus('bsit');
// CLO 2 ("Apply conditional and looping statements ...") tagged to PO 5 (Filipino heritage), which it does not develop; it develops PO 7.
const wrongPo = c => { c.clos[1].pos = [5]; };
const RETAG = { label: 'NOT_ALIGNED', recommendation: 'RETAG_OUTCOME', draft: '', explanation: 'The CLO is a sound programming outcome; it develops no heritage competence, so the PO tag does not fit.' };
// A whole-list answer names an item and quotes one line of the list (that item's own line unless `line` says otherwise).
const namesPo = (no, line = no) => pair => ({ label: 'ALIGNED', explanation: `PO ${no} fits this CLO: it applies computing knowledge to real problems.`, sourceQuote: pair.source.split('\n').find(l => l.startsWith(`${line}. `)).slice(0, 40) });
// Week 9's ILO ("Apply while and do-while loops ...") is sound for its week but tagged to CLO 4 (a console application); it builds CLO 2.
const wrongClo = c => { c.plan[8].ilos[0].tags = ['clo:c4']; };
const RETAG_ILO = { label: 'NOT_ALIGNED', recommendation: 'RETAG_OUTCOME', draft: '', explanation: 'The ILO is a sound outcome for its week; it does not build a console application, so the CLO tag does not fit.' };
const namesClo = (no, line = no) => pair => ({ label: 'ALIGNED', explanation: `CLO ${no} is built by this ILO: it practises the loops that CLO asks for.`, sourceQuote: pair.source.split('\n').find(l => l.startsWith(`CLO ${line}:`)).slice(0, 40) });
// Week 8's ILO replaced by one about baking: the text itself must change.
const bread = c => { c.plan[7].ilos[0].text = 'Bake bread using the straight-dough method and evaluate its texture.'; };
const OFF_ILO = [[/^(Content-ILO|ILO-content|ILO-CLO|ILO-anyCLO|ILO-activity|ILO-assessment):row7-ilo0-/, { label: 'NOT_ALIGNED', explanation: 'The ILO is about baking, not about what this week teaches.' }]];

// ---- the answer contract, one relationship at a time ----
const contentWith = mutate => { const c = structuredClone(S.content); mutate(c); return c; };
const pairOf = (content, env, id) => { const f = stageFlags(env); return pairsOf(content, S.masters, [], { stageA: f.a, stageB: f.b, stageB4: f.b4 }).find(p => p.id === id); };
const answerTo = (pair, fields = {}) => ({ id: pair.id, label: 'NOT_ALIGNED', explanation: 'The tag does not fit this outcome.', sourceQuote: pair.source.slice(0, 20), targetQuote: pair.target.slice(0, 20), sourceBloom: 'Apply', targetBloom: 'Apply', recommendation: 'RETAG_OUTCOME', draft: '', ...fields });
const aligned = pair => answerTo(pair, { label: 'ALIGNED', recommendation: 'NO_CHANGE', explanation: 'The outcome fits.' });
const without = (answer, key) => { const copy = { ...answer }; delete copy[key]; return copy; };
const verify = (answers, pairs, env) => verifyAnswer(JSON.stringify({ judgements: answers }), pairs, contractOf(env, courseOf(S.content)));
const refusal = (answers, pairs, env) => { try { verify(answers, pairs, env); } catch (error) { return error; } return assert.fail('the answer was accepted'); };

// ---------------- 1-4: a wrong tag, a wrong text, a wrong tag with no defensible replacement (whole checks) ----------------
test('#1 a valid CLO with an incorrect PO tag: re-tag advice names the approved PO that fits, the CLO text is kept, and the wrong tag is never marked aligned', async () => {
  const rules = [[/^CLO-PO:clo1-po5$/, RETAG], [/^CLO-anyPO:clo1-anypo$/, namesPo(7)]];
  const on = await check(S, { rules, mutate: wrongPo }), off = await check(S, { rules, mutate: wrongPo, env: NONE });
  assert.equal(official(on.result), official(off.result), 'official result');
  const advice = on.result.hybrid.mappingAdvice.filter(a => a.cloIndex === 1);
  assert.deepEqual(advice.map(a => [a.recommendationType, a.type, a.path, a.current, a.suggested, a.suggestedText]), [['RETAG_OUTCOME', 'PO', 'clos[1].pos', [5], 7, S.masters.pos.find(p => p.no === 7).text]]);
  assert.deepEqual(at(on.result, 'clos[1].statement'), [], 'the CLO is not rewritten to fit a tag');
  const j = judgement(on.result, 'clo1-po5');
  assert.deepEqual([j.label, j.recommendation, j.draft], ['NOT_ALIGNED', 'RETAG_OUTCOME', ''], 'an empty rewrite: the text is kept');
  const tag = findingOf(on.verdict, 'clo1-po5', 'CLO-PO');
  assert.notEqual(tag.status, 'PASS');
  assert.deepEqual([tag.recommendationType, tag.recommendation, tag.responsible], ['RETAG_OUTCOME', null, 'po_mapping']);
  const advised = on.verdict.findings.find(f => f.legacyRuleId === 'mapping-advice' && f.path === 'clos[1].pos');
  assert.equal(advised.recommendationType, 'RETAG_OUTCOME');
  assert.match(advised.recommendation, /tagging this CLO to PO 7 .* instead of PO 5\. The CLO statement itself does not need to change\./);
  assert.deepEqual(on.given, on.content, 'nothing is applied: no tag and no text is changed');
  assert.ok(!on.result.hybrid.unresolved.some(u => u.path === 'clos[1].pos'));
  assert.deepEqual(contradictionsOf(on.result, on.content), []);
});

test('#2 a valid ILO with an incorrect CLO tag: re-tag advice names the CLO it builds, the ILO text is kept, and the wrong tag keeps its finding and points', async () => {
  const rules = [[/^ILO-CLO:row8-ilo0-clo:c4$/, RETAG_ILO], [/^ILO-anyCLO:row8-ilo0-anyclo$/, namesClo(2)]];
  const on = await check(S, { rules, mutate: wrongClo }), off = await check(S, { rules, mutate: wrongClo, env: NONE });
  assert.equal(official(on.result), official(off.result), 'official result');
  const advice = on.result.hybrid.mappingAdvice.filter(a => a.type === 'CLO');
  assert.deepEqual(advice.map(a => [a.recommendationType, a.path, a.current, a.suggested, a.contentCheck]), [['RETAG_OUTCOME', 'plan[8].ilos[0].tags', [4], 2, 'verified']]);
  assert.deepEqual(at(on.result, 'plan[8].ilos[0].text'), [], 'the ILO is not rewritten');
  const tag = findingOf(on.verdict, 'row8-ilo0-clo:c4', 'ILO-CLO');
  assert.equal(tag.status, 'FAIL');
  assert.deepEqual([tag.recommendationType, tag.recommendation, tag.responsible], ['RETAG_OUTCOME', null, 'clo_mapping']);
  assert.ok(on.result.hybrid.deductions.some(d => d.id === 'SEM:row8-ilo0-clo:c4' && d.points === POLICY.alignment), 'the scored finding and its points stand');
  const advised = on.verdict.findings.find(f => f.legacyRuleId === 'mapping-advice' && f.path === 'plan[8].ilos[0].tags');
  assert.equal(advised.recommendationType, 'RETAG_OUTCOME');
  assert.match(advised.recommendation, /tagging this ILO to CLO 2 .* The ILO text itself does not need to change\./);
  assert.deepEqual(on.given, on.content);
  assert.deepEqual(contradictionsOf(on.result, on.content), []);
});

test('#3 incorrect text that needs a rewrite: REWRITE_TEXT with a draft for the field that is wrong, and no re-tag advice for it', async () => {
  const on = await check(S, { rules: OFF_ILO, mutate: bread }), off = await check(S, { rules: OFF_ILO, mutate: bread, env: NONE });
  assert.equal(official(on.result), official(off.result), 'official result');
  const offered = at(on.result, 'plan[7].ilos[0].text');
  assert.equal(offered.length, 1, 'one rewrite of the ILO'); assert.equal(offered[0].source, 'ai'); assert.ok(offered[0].text.trim());
  const ilo = findingOf(on.verdict, 'row7-ilo0-contentilo', 'Content-ILO');
  assert.deepEqual([ilo.status, ilo.recommendationType, ilo.recommendation, ilo.responsible], ['FAIL', 'REWRITE_TEXT', offered[0].text, 'ilo']);
  assert.equal(judgement(on.result, 'row7-ilo0-contentilo').recommendation, 'REWRITE_TEXT');
  assert.deepEqual(on.result.hybrid.mappingAdvice, [], 'the text is the problem, not its tag');
  assert.ok(!on.result.hybrid.unresolved.some(u => u.reason === 'retag_needs_review'));
  for (const field of ['contents', 'activities', 'tasks', 'values']) assert.deepEqual(at(on.result, `plan[7].${field}`), [], `no rewrite of the ${field}`);
  assert.deepEqual(contradictionsOf(on.result, on.content), []);
});

test('#4 an incorrect tag with no defensible replacement: no PO is invented, nothing is rewritten, and the tag is listed for the author (NEEDS_REVIEW)', async () => {
  const rules = [[/^CLO-PO:clo1-po5$/, RETAG], [/^CLO-anyPO:clo1-anypo$/, { label: 'NOT_ALIGNED', explanation: 'No PO of the list is clearly developed by this CLO as written.' }]];
  const on = await check(S, { rules, mutate: wrongPo }), off = await check(S, { rules, mutate: wrongPo, env: NONE });
  assert.equal(official(on.result), official(off.result), 'official result');
  assert.deepEqual(on.result.hybrid.mappingAdvice, [], 'no approved PO was verified, so none is named');
  const u = on.result.hybrid.unresolved.find(x => x.path === 'clos[1].pos');
  assert.deepEqual([u.reason, u.status, u.recommendationType, u.relationships], ['retag_needs_review', 'NEEDS_REVIEW', 'REVIEW_REQUIRED', ['clo1-po5', 'clo1-anypo']]);
  assert.match(u.detail, /no approved PO was verified as the right one, so none is proposed\. The whole-list check found no approved PO that this CLO clearly supports\./);
  assert.deepEqual(u.withheldRewrite, { path: 'clos[1].statement', relationships: ['clo1-anypo'] });
  assert.deepEqual(at(on.result, 'clos[1].statement'), [], 'the tag answers say the CLO can stay as written, so it is not rewritten either');
  const any = findingOf(on.verdict, 'clo1-anypo', 'CLO-anyPO');
  assert.deepEqual([any.withheld, any.recommendation], ['retag_conflict', null]);
  const tag = findingOf(on.verdict, 'clo1-po5', 'CLO-PO');
  assert.deepEqual([tag.status, tag.recommendationType, tag.recommendation, tag.responsible], ['FAIL', 'REVIEW_REQUIRED', null, 'po_mapping'], 'a re-tag without a verified target is a review');
  assert.ok(on.result.hybrid.deductions.some(d => d.id === 'SEM:clo1-po5' && d.points === POLICY.alignment), 'the finding and its points stand');
  assert.deepEqual(on.given, on.content);
  assert.deepEqual(contradictionsOf(on.result, on.content), []);
});

test('#4 a re-tag is advised only toward another outcome in the approved list whose own line holds the quote; otherwise the tag waits for the author', async () => {
  const cases = [['names PO 99, which is not in the approved list', namesPo(99, 7)], ['names PO 7 but quotes the line of PO 6', namesPo(7, 6)], ['names PO 5, the tag already chosen', namesPo(5)]];
  for (const [what, answer] of cases) {
    const on = await check(S, { rules: [[/^CLO-PO:clo1-po5$/, RETAG], [/^CLO-anyPO:clo1-anypo$/, answer]], mutate: wrongPo });
    assert.deepEqual(on.result.hybrid.mappingAdvice, [], what);
    const u = on.result.hybrid.unresolved.find(x => x.path === 'clos[1].pos');
    assert.equal(u && u.reason, 'retag_needs_review', what);
    assert.match(u.detail, /the PO it named could not be verified as another approved PO/, what);
    assert.equal(findingOf(on.verdict, 'clo1-po5', 'CLO-PO').recommendationType, 'REVIEW_REQUIRED', what);
    assert.deepEqual(contradictionsOf(on.result, on.content), [], what);
  }
  const iloCases = [['names CLO 9, which the course does not have', namesClo(9, 2), /the CLO it named could not be verified as another approved CLO/], ['fits no CLO of the course', { label: 'NOT_ALIGNED', explanation: 'No CLO of the list is built by this ILO.' }, /found no approved CLO that this ILO clearly builds/]];
  for (const [what, answer, detail] of iloCases) {
    const on = await check(S, { rules: [[/^ILO-CLO:row8-ilo0-clo:c4$/, RETAG_ILO], [/^ILO-anyCLO:row8-ilo0-anyclo$/, answer]], mutate: wrongClo });
    assert.deepEqual(on.result.hybrid.mappingAdvice, [], what);
    const u = on.result.hybrid.unresolved.find(x => x.path === 'plan[8].ilos[0].tags');
    assert.deepEqual([u.reason, u.recommendationType], ['retag_needs_review', 'REVIEW_REQUIRED'], what);
    assert.match(u.detail, detail, what);
    assert.deepEqual(at(on.result, 'plan[8].ilos[0].text'), [], what);
    assert.deepEqual(contradictionsOf(on.result, on.content), [], what);
  }
});

// ---------------- 5-9: the answer contract ----------------
test('#5 RETAG_OUTCOME: an empty rewrite is valid and keeps the text; a re-tag that also rewrites, or where the test allows none, is refused with its own code', () => {
  const content = contentWith(wrongPo), po = pairOf(content, A, 'clo1-po5');
  const [ok] = verify([answerTo(po)], [po], A);
  assert.deepEqual([ok.label, ok.recommendation, ok.draft, ok.targetPath], ['NOT_ALIGNED', 'RETAG_OUTCOME', '', 'clos[1].statement']);
  assert.equal(verify([answerTo(po, { draft: po.target })], [po], A)[0].draft, '', 'the unchanged text is a re-tag too, and is not stored as a rewrite');
  assert.equal(refusal([answerTo(po, { draft: 'Write Java programs that preserve and promote Filipino heritage.' })], [po], A).code, 'retag_with_rewrite');
  assert.equal(refusal([answerTo(po, { label: 'ALIGNED' })], [po], A).code, 'recommendation_conflicts_label');
  assert.equal(refusal([answerTo(po)], [po], NONE).code, 'schema', 'with every stage off the answer has no recommendation field');
  // ILO-CLO allows a re-tag only under Stage B3; an activity, never
  const content2 = contentWith(wrongClo), ilo = pairOf(content2, AB3, 'row8-ilo0-clo:c4'), activity = pairOf(content2, AB3, 'row8-ilo0-activity');
  assert.equal(refusal([answerTo(ilo)], [ilo], A).code, 'retag_not_applicable');
  assert.equal(verify([answerTo(ilo)], [ilo], AB3)[0].recommendation, 'RETAG_OUTCOME');
  const notHere = refusal([answerTo(activity)], [activity], AB3);
  assert.equal(notHere.code, 'retag_not_applicable'); assert.match(notHere.message, /for a ILO-activity relationship, whose test does not allow one/);
  // A draft left out, or null, is the same as an empty one for a re-tag: no rewrite is needed, so the answer stands and the text is kept.
  for (const [what, answer] of [['no draft field', without(answerTo(po), 'draft')], ['a null draft', answerTo(po, { draft: null })]]) {
    const [kept] = verify([answer], [po], A);
    assert.deepEqual([kept.label, kept.recommendation, kept.draft, kept.explanation], ['NOT_ALIGNED', 'RETAG_OUTCOME', '', 'The tag does not fit this outcome.'], what);
    assert.equal(refusal([{ ...answer, label: 'ALIGNED' }], [po], A).code, 'recommendation_conflicts_label', `${what}: still not a pass`);
    assert.equal(refusal([{ ...answer, sourceQuote: 'not in either text' }], [po], A).code, 'quote_not_found', `${what}: the evidence is still checked`);
  }
  assert.equal(refusal([without(answerTo(ilo), 'draft')], [ilo], A).code, 'retag_not_applicable', 'no draft field: still only where the test allows a re-tag');
  assert.equal(verify([without(answerTo(ilo), 'draft')], [ilo], AB3)[0].draft, '');
  assert.equal(refusal([without(without(answerTo(po), 'draft'), 'recommendation')], [po], A).code, 'schema', 'with no recommendation, a missing draft is still a schema error');
  assert.equal(refusal([without(answerTo(po), 'draft')], [po], NONE).code, 'schema', 'the earlier contract is unchanged');
});

test('#5 a re-tag answer with no draft field, or a null one, is the same valid re-tag in a whole check: advice names only a verified approved outcome, otherwise NEEDS_REVIEW', async () => {
  for (const [what, draft] of [['no draft field', undefined], ['a null draft', null]]) {
    const rules = [[/^CLO-PO:clo1-po5$/, { ...RETAG, draft }], [/^CLO-anyPO:clo1-anypo$/, namesPo(7)], [/^ILO-CLO:row8-ilo0-clo:c4$/, { ...RETAG_ILO, draft }], [/^ILO-anyCLO:row8-ilo0-anyclo$/, namesClo(2)]];
    const on = await check(S, { rules, mutate: c => { wrongPo(c); wrongClo(c); } });
    assert.equal(on.result.hybrid.alignment.status, 'completed', what);
    for (const id of ['clo1-po5', 'row8-ilo0-clo:c4']) {
      const j = judgement(on.result, id);
      assert.deepEqual([j.label, j.recommendation, j.draft, !!j.unverified], ['NOT_ALIGNED', 'RETAG_OUTCOME', '', false], `${what}: ${id}`);
    }
    assert.deepEqual(on.result.hybrid.mappingAdvice.map(a => [a.path, a.recommendationType, a.suggested]).sort(), [['clos[1].pos', 'RETAG_OUTCOME', 7], ['plan[8].ilos[0].tags', 'RETAG_OUTCOME', 2]], what);
    assert.deepEqual(at(on.result, 'clos[1].statement'), [], `${what}: the CLO is not rewritten`);
    assert.deepEqual(at(on.result, 'plan[8].ilos[0].text'), [], `${what}: the ILO is not rewritten`);
    assert.deepEqual(on.given, on.content, `${what}: nothing is applied`);
    assert.deepEqual(contradictionsOf(on.result, on.content), [], what);
    // no verified replacement: nothing is named, nothing is rewritten, and the tag waits for the author
    const none = await check(S, { rules: [[/^CLO-PO:clo1-po5$/, { ...RETAG, draft }], [/^CLO-anyPO:clo1-anypo$/, { label: 'NOT_ALIGNED', explanation: 'No PO of the list is clearly developed by this CLO as written.' }]], mutate: wrongPo });
    assert.deepEqual(none.result.hybrid.mappingAdvice, [], what);
    const u = none.result.hybrid.unresolved.find(x => x.path === 'clos[1].pos');
    assert.deepEqual([u.reason, u.status, u.recommendationType], ['retag_needs_review', 'NEEDS_REVIEW', 'REVIEW_REQUIRED'], what);
    assert.deepEqual(at(none.result, 'clos[1].statement'), [], what);
    assert.equal(findingOf(none.verdict, 'clo1-po5', 'CLO-PO').recommendationType, 'REVIEW_REQUIRED', what);
  }
});

test('#6 REWRITE_TEXT: an empty or blank rewrite is refused (missing_draft) with the stages on and off, and REVIEW_REQUIRED cannot stand in for it', () => {
  const po = pairOf(contentWith(wrongPo), A, 'clo1-po5');
  for (const draft of ['', '   ', null]) assert.equal(refusal([answerTo(po, { recommendation: 'REWRITE_TEXT', draft })], [po], A).code, 'missing_draft', JSON.stringify(draft));
  assert.equal(refusal([without(answerTo(po, { recommendation: 'REWRITE_TEXT' }), 'draft')], [po], A).code, 'missing_draft', 'a rewrite with no draft field is a missing rewrite');
  const { recommendation, ...legacy } = answerTo(po);
  assert.equal(refusal([legacy], [po], NONE).code, 'missing_draft', 'the earlier contract is unchanged');
  assert.equal(refusal([legacy], [po], A).code, 'missing_draft', 'leaving the field out never lets more through');
  assert.equal(refusal([answerTo(po, { recommendation: 'REVIEW_REQUIRED' })], [po], A).code, 'recommendation_not_allowed');
  assert.equal(refusal([answerTo(po, { recommendation: 'NO_CHANGE' })], [po], A).code, 'recommendation_conflicts_label');
  assert.equal(refusal([answerTo(po, { recommendation: 'MAYBE' })], [po], A).code, 'invalid_recommendation');
  const [rewrite] = verify([answerTo(po, { recommendation: 'REWRITE_TEXT', draft: 'Apply conditional and looping statements to write Java programs that address real-world problems.' })], [po], A);
  assert.equal(rewrite.recommendation, 'REWRITE_TEXT'); assert.match(rewrite.draft, /^Apply conditional/);
  // an advice-only relationship has no field to rewrite: REVIEW_REQUIRED with no draft is its answer
  const any = anyCloPairs(contentWith(wrongClo), [{ i: 8, j: 0 }])[0];
  assert.equal(verify([answerTo(any, { recommendation: 'REVIEW_REQUIRED' })], [any], envOf(['B3']))[0].recommendation, 'REVIEW_REQUIRED');
});

test('#7 a missing explanation is refused (empty_explanation), and a relationship whose explanation never arrives is never counted as verified', async () => {
  const po = pairOf(contentWith(wrongPo), A, 'clo1-po5');
  for (const explanation of ['', '  \n ']) assert.equal(refusal([answerTo(po, { explanation })], [po], A).code, 'empty_explanation');
  const { explanation, ...absent } = answerTo(po);
  assert.equal(refusal([absent], [po], A).code, 'schema');
  // two problems in one answer are both reported, each with its own code and message
  const two = refusal([answerTo(po, { explanation: '', sourceQuote: po.target.slice(0, 20), targetQuote: po.source.slice(0, 20) })], [po], A);
  assert.deepEqual(two.codes, ['empty_explanation', 'quotes_swapped']); assert.match(two.message, /empty explanation; AI quotes are swapped/);
  // inside a whole check: the model never explains its verdict on one tag. Since Stage E.5 the retry carries a correction (the explanation must not be
  // empty), and the same problem after it stops the relationship: asked twice, not three times.
  const on = await check(S, { rules: [[/^CLO-PO:clo1-po5$/, { ...RETAG, explanation: '' }]], mutate: wrongPo, env: A });
  const j = judgement(on.result, 'clo1-po5');
  assert.deepEqual([j.unverified, j.label, j.stoppedBecause, j.attempts, j.failureCodes], [true, 'INSUFFICIENT_EVIDENCE', 'repeated_evidence_error', 2, ['empty_explanation', 'empty_explanation']]);
  assert.deepEqual([j.type, j.path, j.targetPath], ['CLO-PO', 'clos[1].statement', 'clos[1].statement'], 'the relationship keeps its identity');
  assert.equal(on.log.asked.filter(a => a === 'CLO-PO:clo1-po5').length, 2);
  assert.notEqual(on.result.hybrid.alignment.status, 'completed', 'a scored relationship without an explanation keeps the check open');
  assert.equal(on.result.passed, false); assert.equal(on.result.hybrid.ready, false);
  assert.equal(findingOf(on.verdict, 'clo1-po5', 'CLO-PO').status, 'NOT_CHECKED');
});

test('#8 swapped quotation fields are refused as quotes_swapped; a quote taken from the wrong side alone as quote_wrong_side', () => {
  const po = pairOf(contentWith(wrongPo), A, 'clo1-po5');
  const swapped = refusal([answerTo(po, { sourceQuote: po.target.slice(0, 20), targetQuote: po.source.slice(0, 20) })], [po], A);
  assert.equal(swapped.code, 'quotes_swapped'); assert.deepEqual(swapped.codes, ['quotes_swapped']); assert.match(swapped.message, /quotes are swapped: the source quote is copied from the target text/);
  const one = refusal([answerTo(po, { sourceQuote: po.target.slice(0, 20) })], [po], A);
  assert.equal(one.code, 'quote_wrong_side'); assert.match(one.message, /source quote is copied from the target text, not from the source text/);
});

test('#9 a quotation copied from another relationship of the same request is refused (quote_from_other_pair), names that relationship, and the rest is kept', () => {
  const content = contentWith(wrongPo), f = stageFlags(A);
  const batch = pairsOf(content, S.masters, [], { stageA: f.a }).filter(p => p.type === 'CLO-PO').slice(0, 3);
  for (const side of ['sourceQuote', 'targetQuote']) {
    const answers = batch.map(aligned);
    answers[1][side] = (side === 'sourceQuote' ? batch[0].source : batch[2].target).slice(0, 20); // present in the batch, but not in this relationship
    const error = refusal(answers, batch, A), from = side === 'sourceQuote' ? batch[0].id : batch[2].id;
    assert.equal(error.code, 'quote_from_other_pair', side); assert.equal(error.problems[0].from, from);
    assert.match(error.message, new RegExp(`copied from another relationship \\(${from}\\), not from this one`));
    assert.deepEqual(error.salvaged.map(j => j.id), [batch[0].id, batch[2].id], 'the valid answers are kept');
    assert.deepEqual(error.rejected.map(r => [r.id, r.code]), [[batch[1].id, 'quote_from_other_pair']]);
  }
});

// ---------------- 10-11: retries ----------------
// A request as align() makes it, minus the provider: the scripted reply is verified exactly as a provider's answer is.
function scripted(env, reply) {
  const asked = [], contract = contractOf(env, courseOf(S.content));
  return { asked, request: async batch => { asked.push(batch.map(p => p.id)); return verifyAnswer(reply(batch, asked.length), batch, contract); } };
}
const json = answers => JSON.stringify({ judgements: answers });
const batchOf = () => { const f = stageFlags(A); return pairsOf(contentWith(wrongPo), S.masters, [], { stageA: f.a }).filter(p => p.type === 'CLO-PO').slice(0, STAGED_BATCH); };

test('#10 a partly valid batch: the answers that verified are kept and only the relationship that failed is asked again', async () => {
  const batch = batchOf(), bad = batch[2];
  for (const halve of [true, false]) { // the staged policy and the earlier cascade agree here
    const s = scripted(A, (b, call) => json(b.map(p => (p.id !== bad.id ? aligned(p) : call === 1 ? answerTo(p, { sourceQuote: 'a quote that is in no text' }) : answerTo(p)))));
    const out = await judgeBatch(s.request, batch, { halve });
    assert.deepEqual(s.asked, [batch.map(p => p.id), [bad.id]], halve ? 'staged' : 'legacy');
    assert.deepEqual(out.map(j => j.id).sort(), batch.map(p => p.id).sort());
    assert.ok(out.every(j => !j.unverified)); assert.equal(out.find(j => j.id === bad.id).recommendation, 'RETAG_OUTCOME');
  }
});

test('#11 repeated invalid answers: a repeated contract error is not asked a third time, any other error at most MAX_ATTEMPTS times, and an answer that names no relationship never sends one more often', async () => {
  const batch = batchOf(), bad = batch[2], others = p => aligned(p);
  // (a) a deterministic contract mismatch, every time: REWRITE_TEXT with no draft
  let s = scripted(A, b => json(b.map(p => (p.id === bad.id ? answerTo(p, { recommendation: 'REWRITE_TEXT', draft: '' }) : others(p)))));
  let out = await judgeBatch(s.request, batch, { halve: true }), j = out.find(x => x.id === bad.id);
  assert.ok(CONTRACT_CODES.has('missing_draft'));
  assert.deepEqual([j.unverified, j.label, j.stoppedBecause, j.attempts, j.failureCodes], [true, 'INSUFFICIENT_EVIDENCE', 'repeated_contract_error', 2, ['missing_draft', 'missing_draft']]);
  assert.deepEqual(s.asked, [batch.map(p => p.id), [bad.id]]);
  assert.equal(out.filter(x => !x.unverified).length, STAGED_BATCH - 1, 'the other answers are kept');
  // (b) evidence that is never in the text: not a contract error, but since Stage E.5 it is corrected once, and the same problem after the correction
  //     stops it (at temperature 0 a third ask would repeat the same question)
  s = scripted(A, b => json(b.map(p => (p.id === bad.id ? answerTo(p, { sourceQuote: 'not in the text' }) : others(p)))));
  out = await judgeBatch(s.request, batch, { halve: true }); j = out.find(x => x.id === bad.id);
  assert.deepEqual([j.stoppedBecause, j.attempts, j.failureCodes], ['repeated_evidence_error', 2, ['quote_not_found', 'quote_not_found']]);
  assert.deepEqual(s.asked, [batch.map(p => p.id), [bad.id]]);
  // (c) a reply that is never JSON: no relationship is blamed, the batch is split, and none is sent more than MAX_ATTEMPTS times; the same unreadable
  //     reply to a relationship asked alone stops it
  s = scripted(A, () => '{"judgements": [');
  out = await judgeBatch(s.request, batch, { halve: true });
  assert.ok(out.every(x => x.unverified && x.stoppedBecause === 'repeated_output_error' && x.failureCodes.every(c => c === 'invalid_json')));
  assert.deepEqual(s.asked.map(ids => ids.length), [4, 2, 1, 1, 2, 1, 1]);
  for (const p of batch) assert.equal(s.asked.flat().filter(id => id === p.id).length, MAX_ATTEMPTS, p.id);
  // (d) an evaluation that resumes a run passes each relationship's earlier attempts (a send that timed out counts as one): a relationship refused
  //     again is asked alone once more and then stops, so the limit holds across both runs; the application never passes them
  const earlier = new Map(batch.map(p => [p.id, { attempts: 1, codes: ['provider_timeout'] }]));
  s = scripted(A, b => json(b.map(p => (p.id === bad.id ? answerTo(p, { sourceQuote: 'not in the text' }) : others(p)))));
  out = await judgeBatch(s.request, batch, { halve: true, history: earlier }); j = out.find(x => x.id === bad.id);
  assert.deepEqual([j.stoppedBecause, j.attempts, j.failureCodes], ['repeated_evidence_error', MAX_ATTEMPTS, ['provider_timeout', 'quote_not_found', 'quote_not_found']]);
  assert.deepEqual(s.asked, [batch.map(p => p.id), [bad.id]]);
  assert.equal(out.filter(x => !x.unverified).length, STAGED_BATCH - 1, 'the other answers are kept');
  // with every stage off the earlier cascade is unchanged: the batch, then each relationship alone three times
  s = scripted(NONE, () => '{"judgements": [');
  out = await judgeBatch(s.request, batch, { halve: false });
  assert.deepEqual(s.asked.map(ids => ids.length), [4, ...Array(12).fill(1)]);
  assert.ok(out.every(x => x.unverified && !('stoppedBecause' in x)));
  // what counts as a contract error: deterministic for the same question, unlike a quote, an empty explanation or a cut-off reply
  for (const code of ['schema', 'invalid_label', 'invalid_bloom', 'missing_draft', 'draft_too_long', 'invalid_recommendation', 'recommendation_conflicts_label', 'recommendation_not_allowed', 'retag_not_applicable', 'retag_with_rewrite']) assert.ok(CONTRACT_CODES.has(code), code);
  for (const code of ['empty_explanation', 'quote_missing', 'quote_not_found', 'quote_wrong_side', 'quotes_swapped', 'quote_from_other_pair', 'role_confusion', 'not_answered', 'invalid_json', 'incomplete_output']) assert.ok(!CONTRACT_CODES.has(code), code);
});

// ---------------- recommendation quality ----------------
test('role confusion: an explanation that describes the ILO with the CLO\'s words and the CLO with the ILO\'s is refused; a hedged comparison is not', () => {
  const ilo = pairOf(contentWith(wrongClo), AB3, 'row8-ilo0-clo:c4');
  const answer = explanation => answerTo(ilo, { recommendation: 'REWRITE_TEXT', draft: 'Apply loops to test and debug a console application.', explanation });
  const confused = refusal([answer('The ILO is about designing, testing and debugging a console application. The CLO asks students to apply loops with sentinel-controlled repetition.')], [ilo], AB3);
  assert.equal(confused.code, 'role_confusion'); assert.match(confused.message, /describes the ILO with the CLO's text and the CLO with the ILO's text/);
  assert.equal(verify([answer('The ILO practises loops but does not build the console application the CLO asks for.')], [ilo], AB3).length, 1);
  const { recommendation, ...legacy } = answer('The ILO is about designing, testing and debugging a console application. The CLO asks students to apply loops with sentinel-controlled repetition.');
  assert.equal(verify([legacy], [ilo], NONE).length, 1, 'with every stage off the earlier contract does not read the explanation');
});

test('a rewrite that copies the text it is checked against, or keeps the off-subject topic, is not offered: the field is listed for the author', async () => {
  const mutate = c => { c.plan[2].contents = 'Design and evaluate costumes for a folk dance festival'; };
  const rules = [
    [/^ILO-CLO:row8-ilo0-clo:c2$/, pair => ({ label: 'PARTIALLY_ALIGNED', recommendation: 'REWRITE_TEXT', draft: pair.source, explanation: 'The ILO practises loops but does not show the decisions the CLO asks for.' })],
    [/^Content-course:row2-content$/, { label: 'NOT_ALIGNED', draft: 'Design and evaluate folk dance costumes for a Java festival program', explanation: 'The topic is folk dance, not programming.' }],
  ];
  const on = await check(S, { rules, mutate }), off = await check(S, { rules, mutate, env: NONE });
  assert.equal(official(on.result), official(off.result), 'official result');
  for (const [path, why] of [['plan[8].ilos[0].text', 'copies_reference'], ['plan[2].contents', 'keeps_off_subject']]) {
    assert.deepEqual(at(on.result, path), [], `${path}: not offered`);
    const u = on.result.hybrid.unresolved.find(x => x.path === path);
    assert.deepEqual([u.reason, u.status, u.recommendationType, u.checks], ['draft_needs_review', 'NEEDS_REVIEW', 'REVIEW_REQUIRED', [why]], path);
  }
  assert.deepEqual(judgement(on.result, 'row8-ilo0-clo:c2').draftReview, ['copies_reference']);
  const ilo = findingOf(on.verdict, 'row8-ilo0-clo:c2', 'ILO-CLO');
  assert.deepEqual([ilo.withheld, ilo.recommendation, ilo.recommendationType], ['draft_review', null, 'REVIEW_REQUIRED']);
  assert.deepEqual(contradictionsOf(on.result, on.content), []);
  // the action verbs are the competence a rewrite keeps: a draft in the course's subject that keeps them is offered
  const good = 'Design and evaluate Java programs that declare variables of the primitive data types and constants.';
  const fixed = await check(S, { rules: [[/^Content-course:row2-content$/, { label: 'NOT_ALIGNED', draft: good, explanation: 'The topic is folk dance, not programming.' }]], mutate });
  assert.deepEqual(at(fixed.result, 'plan[2].contents').map(x => x.text), [good]);
  assert.equal(judgement(fixed.result, 'row2-content').draftReview, undefined);
});

test('a CLO judged not to be about the course is rewritten for the course first: no rewrite toward a PO or EGA is offered, and the points are unchanged', async () => {
  const mutate = c => { c.clos[1].statement = 'Explain the history of Filipino folk dances and their costumes.'; };
  const course = 'Apply conditional and looping statements to write Java programs that make decisions and repeat actions.';
  const rules = [[/^Course-CLO:clo1-course$/, { label: 'NOT_ALIGNED', draft: course, explanation: 'The CLO is about folk dance history, not about programming.' }], [/^CLO-(PO|anyPO):clo1-/, { label: 'NOT_ALIGNED', explanation: 'The CLO does not apply computing knowledge.' }]];
  const on = await check(S, { rules, mutate }), off = await check(S, { rules, mutate, env: NONE });
  assert.equal(official(on.result), official(off.result), 'official result');
  // one rewrite, written for the course; the PO findings of the same field are listed with it (basedOn) and supply no wording
  assert.deepEqual(at(on.result, 'clos[1].statement').map(x => [x.text, x.basedOn[0]]), [[course, 'SEM:clo1-course']]);
  const waiting = on.verdict.findings.filter(f => /^clo1-(po\d+|anypo)$/.test(f.relationshipId || ''));
  assert.equal(waiting.length, 3);
  for (const f of waiting) assert.deepEqual([f.withheld, f.recommendation, f.recommendationType], ['clo_off_course', null, 'REVIEW_REQUIRED'], f.relationshipId);
  for (const id of ['SEM:clo1-po6', 'SEM:clo1-po7']) assert.ok(on.result.hybrid.deductions.some(d => d.id === id && d.points === POLICY.alignment), id);
  assert.deepEqual(contradictionsOf(on.result, on.content), []);
  // the contradiction check is not vacuous: a PO-fit draft offered for this CLO is reported
  const before = structuredClone(on.result);
  before.hybrid.suggestions = before.hybrid.suggestions.filter(x => x.path !== 'clos[1].statement').concat({ path: 'clos[1].statement', text: 'MODEL-DRAFT for clo1-po6', source: 'ai', basedOn: ['SEM:clo1-po6'] });
  assert.ok(contradictionsOf(before, on.content).some(x => /toward a PO or EGA although the CLO is not about the course/.test(x)));
});

// ---------------- 15: every advisory stage on; 16: every stage off ----------------
const OFF_PO = { bsit: [5], bsie: [8], bscpe: [8] };
const combined = key => ({
  mutate: c => { c.clos[1].pos = OFF_PO[key]; c.clos[2].egas = [4]; wrongClo(c); bread(c); },
  rules: [
    [/^CLO-PO:clo1-po\d+$/, RETAG], [/^CLO-anyPO:clo1-anypo$/, pair => namesPo(/Apply computing/.test(pair.source) ? 7 : 3)(pair)], // BSIT PO 7 / engineering PO 3
    [/^CLO-EGA:clo2-ega4$/, { ...RETAG, explanation: 'The CLO is a sound outcome; the EGA tag does not fit it.' }], [/^CLO-anyEGA:clo2-anyega$/, { label: 'NOT_ALIGNED', explanation: 'No EGA of the list is clearly supported by this CLO as written.' }],
    [/^ILO-CLO:row8-ilo0-clo:c4$/, RETAG_ILO], [/^ILO-anyCLO:row8-ilo0-anyclo$/, namesClo(2)], ...OFF_ILO,
  ],
});
for (const key of PROGRAMS) {
  const s = programSyllabus(key);
  test(`#15 ${s.label}: every advisory stage on, a wrong PO tag, a wrong EGA tag, a wrong CLO tag and a wrong ILO at once - each gets its own kind of recommendation, every decision keeps its identity, and the official result is unchanged`, async () => {
    const sc = combined(key);
    const on = await check(s, { rules: sc.rules, mutate: sc.mutate, env: ALL }), off = await check(s, { rules: sc.rules, mutate: sc.mutate, env: NONE });
    assert.equal(official(on.result), official(off.result), 'official result');
    assert.equal(on.result.hybrid.alignment.promptVersion, `alignment-12ab34c1c2d1d2-r${C_PROMPT_REVISION}-a8`);
    assert.ok(on.log.schema.properties.judgements.items.required.includes('recommendation'), 'the answer carries the recommendation field');
    assert.ok(on.log.requests <= Math.min(Math.ceil(on.log.asked.length / STAGED_BATCH) + 7, 64), 'requests: ' + on.log.requests);
    const h = on.result.hybrid;
    assert.deepEqual(h.mappingAdvice.map(a => [a.path, a.recommendationType]).sort(), [['clos[1].pos', 'RETAG_OUTCOME'], ['plan[8].ilos[0].tags', 'RETAG_OUTCOME']]);
    assert.deepEqual(h.unresolved.filter(u => u.reason === 'retag_needs_review').map(u => u.path), ['clos[2].egas']);
    assert.equal(at(on.result, 'plan[7].ilos[0].text').length, 1, 'the wrong ILO is rewritten');
    for (const path of ['clos[1].statement', 'clos[2].statement', 'plan[8].ilos[0].text']) assert.deepEqual(at(on.result, path), [], `${path} is not rewritten`);
    assert.deepEqual(on.given, on.content, 'nothing is applied');
    assert.deepEqual(contradictionsOf(on.result, on.content), []);
    // every answer that verified says what kind of change it asks for, and keeps its relationship, field, explanation and evidence
    for (const j of h.alignment.judgements.filter(x => !x.unverified && x.label !== 'INSUFFICIENT_EVIDENCE')) {
      assert.ok(RECOMMENDATIONS.includes(j.recommendation), `${j.id}: ${j.recommendation}`);
      assert.ok(j.id && j.type && j.path && j.explanation.trim() && j.sourceQuote && j.targetQuote, j.id);
    }
    for (const f of on.verdict.findings.filter(x => x.method === 'ai_semantic' && (x.status === 'FAIL' || x.status === 'NEEDS_REVIEW'))) {
      const name = `${f.ruleId} ${f.legacyRuleId} ${f.path}`;
      assert.ok(f.relationshipId && f.path && f.explanation, name);
      assert.ok(['REWRITE_TEXT', 'RETAG_OUTCOME', 'REVIEW_REQUIRED'].includes(f.recommendationType), `${name}: ${f.recommendationType}`);
      assert.ok(f.evidence || f.reference, `${name}: evidence`);
      if (f.recommendationType === 'REWRITE_TEXT') assert.ok(f.recommendation, `${name}: a rewrite carries its draft`);
    }
  });
}

test('#16 every stage flag off (the default): the alignment-10 prompt, batches of 12, the earlier answer contract, no new advice, and the official policy as it was', async () => {
  assert.ok(Object.values(stageFlags({})).every(flag => flag === false), 'every advisory stage is off by default');
  assert.equal(promptVersionOf(MODEL, NONE), 'alignment-10');
  assert.equal(crypto.createHash('sha256').update(systemPromptOf('current', NONE, [{ type: 'CLO-PO' }])).digest('hex'), '81d11a069d91ee47c7171bd941f05867d73e6423eebf1ea9d8fa6c06f49d7262');
  assert.equal(batchSizeOf(MODEL, NONE), 12); assert.equal(batchSizeOf(MODEL, ALL), STAGED_BATCH); assert.equal(STAGED_BATCH, 4);
  assert.deepEqual(contractOf(NONE), { aspectKeys: [], recommend: false, retagTypes: new Set(), strict: false, course: null });
  const { result, log } = await check(S, { env: NONE, rules: [[/^CLO-PO:clo1-po5$/, RETAG], [/^CLO-anyPO:clo1-anypo$/, namesPo(7)], [/^ILO-CLO:row8-ilo0-clo:c4$/, RETAG_ILO]], mutate: c => { wrongPo(c); wrongClo(c); } });
  assert.ok(!log.schema.properties.judgements.items.required.includes('recommendation'), 'the answer has no recommendation field');
  assert.ok(result.hybrid.alignment.judgements.every(j => !('recommendation' in j) && !('draftReview' in j)));
  assert.deepEqual(result.hybrid.mappingAdvice, []);
  assert.ok(!result.hybrid.unresolved.some(u => /^(retag|draft)_needs_review$/.test(u.reason)));
  assert.equal(at(result, 'plan[8].ilos[0].text').length, 1, 'as before: the failing ILO-CLO relationship supplies a rewrite');
  // the official policy: the points, the scored relationships, the pass mark and the AI gate
  assert.deepEqual({ ...POLICY, advisoryTypes: undefined }, { version: 'syllabus-policy-2', link: 2, alignment: 3, partialAlignment: 1, value: 1, minWeek: 1, maxWeek: 18, maxRewriteAttempts: 2, advisoryTypes: undefined });
  for (const scored of ['CLO-PO', 'CLO-EGA', 'ILO-CLO', 'ILO-activity', 'ILO-assessment', 'Module-value']) assert.ok(!POLICY.advisoryTypes.includes(scored), scored);
  assert.equal(standard.passThreshold, 79);
  assert.equal(aiGate({}), 'advisory'); assert.equal(aiGate(ALL), 'advisory', 'no stage flag changes the gate');
  assert.equal(result.passed, result.hybrid.ready && result.score >= standard.passThreshold);
  assert.equal(result.hybrid.provisionalScore, result.baseScore - result.hybrid.deductions.reduce((n, d) => n + d.points, 0));
});

test('cache: an all-off check still reuses its own answers (alignment-10), and a staged check never reuses an answer made under the earlier contract', async () => {
  const first = await check(S, { env: NONE });
  const reuse = new Map(first.result.hybrid.alignment.judgements.filter(j => j.key && !j.unverified).map(j => [j.key, j]));
  assert.ok(reuse.size > 0);
  const again = {}, staged = {};
  const off = await run(structuredClone(S.content), S.masters, { ...base, env: NONE, reuse, transport: model([], NONE, again) });
  assert.equal(again.requests, 0, 'nothing changed, so nothing is asked'); assert.equal(off.hybrid.alignment.status, 'completed');
  const on = await run(structuredClone(S.content), S.masters, { ...base, env: ALL, reuse, transport: model([], ALL, staged) });
  assert.equal(on.hybrid.alignment.reuse.reused, 0, 'answers without the recommendation field are asked again');
  assert.ok(staged.requests > 0);
  assert.ok(STAGE_REVISION >= 5, 'the E.4 contract raised the stage revision to 5 (answers made under -r4 are not reused either; Stage E.5 raised it to 6)');
});
