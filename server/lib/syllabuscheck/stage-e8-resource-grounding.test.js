'use strict';
// Saved responses and injected transports only: no network, provider key or production DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const gemini = require('./gemini');
const { reviewDraft } = require('./answerReview');
const { resourceNotes, RESOURCE_REVIEW_VERSION } = require('./recommendationReview');
const { run } = require('./engine');
const { sample } = require('./fixtures');
const { stageFlags } = require('./stages');
const { aiGate } = require('./policy');
const { withholdReviewedDrafts } = require('./reportSafety');
const repo = require('./repository');
const { replay } = require('../../../scripts/replay-stage-e8-resources.cjs');
const dataset = require('./eval/stage-c-dataset.json');
const remaining = require('../../../docs/ai-eval-stage-e8-c-r8-remaining.json');
const C = { SYLLABUS_CHECK_STAGE_C1: 'on', SYLLABUS_CHECK_STAGE_C2: 'on' };
const own = { ...dataset.items.find(p => p.id === 'af-prog1-single-format'), path: 'eval', targetPath: 'eval' };
const sibling = { ...own, id: 'sibling', target: 'Students use syntax notes and starter files that are available for this lesson.' };
const notes = (draft, pair = own) => resourceNotes(draft, pair);
const hard = ns => ns.filter(n => !n.advisory);
const codes = ns => ns.map(n => n.code);

test('E.8 resources: the exact saved single-format bypass is withheld without changing the judgment or field disagreement', () => {
  const raw = remaining.requests.flatMap(r => JSON.parse(r.content).judgements).find(j => j.id === own.id);
  const before = structuredClone(raw), saved = remaining.answers[0][own.id];
  assert.match(raw.draft, /with the notes available/);
  assert.equal(saved.draftReview, undefined);
  const checked = gemini.salvage({ judgements: [raw] }, [own, sibling], gemini.contractOf(C, dataset.courses.prog1))[0];
  assert.ok(checked.draftReview.includes('assumes_resource'));
  assert.ok(checked.reviewEvidence.draft.some(n => /syntax notes/i.test(n.evidence)));
  for (const key of ['label', 'explanation', 'sourceQuote', 'targetQuote', 'draft']) assert.equal(checked[key], saved[key], key);
  for (const key of ['sourceBloom', 'targetBloom']) assert.equal(checked[key], raw[key], key);
  assert.deepEqual(checked.aspects, saved.aspects);
  assert.equal(checked.aspects.values.teaching, 'weak'); assert.equal(own.expectedAspects.teaching, 'sound');
  assert.deepEqual(raw, before);
});

test('E.8 resources: unknown existing notes, materials and files require withholding; ordinary syntax does not', () => {
  for (const material of ['syntax notes', 'lecture notes', 'worksheets', 'starter files', 'handouts', 'sample code', 'reference materials']) {
    const result = notes(`Use the supplied ${material} for the task.`);
    assert.ok(hard(result).some(n => n.code === 'assumes_resource'), material);
  }
  assert.ok(hard(notes('Students write Java programs from syntax notes.')).length, 'writing programs is not preparing the notes they depend on');
  for (const draft of ['Explain Java conditional syntax.', 'Discuss what lecture notes should contain.', 'Analyze sample code to explain a branch.', 'Students take notes while discussing Java syntax.']) {
    assert.deepEqual(hard(notes(draft)), [], draft);
  }
  assert.deepEqual(notes('The instructor notes a syntax error.'), [], 'the verb notes is not an instructional material');
});

test('E.8 resources: explicitly stated own-lesson notes are supported and availability is specific to the resource', () => {
  const stated = { ...own, source: own.source + '\nResources: Syntax notes are available for this lesson.' };
  assert.deepEqual(notes('Use the syntax notes.', stated), []);
  assert.ok(hard(notes('Use lecture notes.', stated)).length);
  const listed = { ...own, source: own.source + '\nInstructional resources:\n- Syntax notes\n- Reference materials' };
  assert.deepEqual(notes('Use syntax notes and reference materials.', listed), []);
  const activity = { ...own, target: 'Students consult syntax notes during guided coding.' };
  assert.deepEqual(notes('Use syntax notes.', activity), []);
});

test('E.8 resources: a faculty-created resource is a proposal, not an existing-resource fact', () => {
  for (const draft of ['Faculty could prepare syntax notes for the exercise.', 'Prepare lecture notes and a worksheet for this activity.', 'The instructor will provide sample code for review.', 'Use syntax notes that faculty will prepare.', 'Use lecture notes to be prepared by the instructor.', 'Use a worksheet that will be prepared by faculty.']) {
    const ns = notes(draft);
    assert.deepEqual(hard(ns), [], draft);
    assert.ok(codes(ns).includes('proposed_resource'), draft);
  }
  const separate = notes('Faculty could prepare syntax notes, then use the existing handout.');
  assert.ok(separate.some(n => n.code === 'proposed_resource' && /syntax/.test(n.evidence)));
  assert.ok(separate.some(n => n.code === 'assumes_resource' && /handout/.test(n.evidence)));
});

test('E.8 resources: conditional and uncertain materials remain advisory without authorizing another resource', () => {
  for (const draft of ['If syntax notes are available, use syntax notes.', 'Use syntax notes if available.', 'Subject to faculty confirmation, use lecture notes.', 'Consider reference materials for review.', 'Confirm whether syntax notes are available before selecting this option.', 'Faculty could use lecture notes for review.']) {
    const ns = notes(draft);
    assert.equal(hard(ns).length, 0, draft);
    assert.ok(ns.some(n => n.advisory), draft);
  }
  assert.ok(hard(notes('If syntax notes are available, use syntax notes, then use the supplied handout.')).some(n => n.evidence === 'handout'));
  assert.ok(hard(notes('If no syntax notes are available, use syntax notes.')).length);
});

test('E.8 resources: explicit unavailability withholds use, while creating a new material is a separate proposal', () => {
  const unavailable = { ...own, source: own.source + '\nResources: Syntax notes are unavailable.' };
  assert.ok(hard(notes('Use syntax notes.', unavailable)).length);
  assert.ok(hard(notes('If syntax notes are available, use syntax notes.', unavailable)).length);
  assert.deepEqual(hard(notes('Faculty could prepare syntax notes for a future exercise.', unavailable)), []);
  assert.deepEqual(notes('Explain the procedure without syntax notes.'), []);
});

test('E.8 resources: sibling text, course topics and ILO nouns never establish availability for this lesson', () => {
  const contextOnly = { ...own, source: 'Week 3 course content: syntax notes\nILOs:\n- Explain the syntax notes.\nContact units stated by the syllabus: lecture 2, laboratory 1' };
  const draft = 'Use the syntax notes and starter files that are available for this lesson.';
  const result = reviewDraft({ draft }, contextOnly, null, { pairs: [contextOnly, sibling] });
  assert.ok(result.some(n => n.code === 'assumes_resource'));
  assert.ok(result.some(n => n.code === 'copies_other_relationship'));
  assert.ok(reviewDraft({ draft }, contextOnly, { description: sibling.target }, { pairs: [contextOnly, sibling] }).some(n => n.code === 'assumes_resource'), 'course description is not a resource inventory');
  assert.ok(hard(notes('Use syntax notes.', contextOnly)).length);
  const tentative = { ...own, source: own.source + '\nResources: Check whether syntax notes are available.' };
  assert.ok(hard(notes('Use syntax notes.', tentative)).length, 'a confirmation question in a resource field is not availability evidence');
});

test('E.8 resources: prior laboratory and simulator checks remain active', () => {
  for (const draft of ['Use the laboratory for testing.', 'Use a circuit simulator.', 'The provided handout guides the simulation.']) assert.ok(hard(notes(draft)).length, draft);
  assert.ok(notes('If a circuit simulator is available, use it.').every(n => n.advisory));
});

test('E.8 resources: shared teaching terminology alone does not withhold a useful same-competency proposal', () => {
  const other = { ...own, id: 'other', target: 'Students write and test small Java programs for several inputs.' };
  const result = reviewDraft({ draft: other.target }, own, null, { pairs: [own, other] });
  assert.equal(hard(result).length, 0);
  assert.ok(!codes(result).includes('copies_other_relationship'));
});

test('E.8 resources: all sixteen saved r8 judgments replay with only the known draft newly withheld', () => {
  const replayed = replay();
  assert.equal(replayed.summary.replayed, 16); assert.equal(replayed.summary.exactQuotes, 32);
  assert.equal(replayed.summary.unchangedAcademicJudgments, 16); assert.equal(replayed.summary.provisionalLabelAgreement, 16);
  assert.equal(replayed.summary.withheldBefore, 3); assert.equal(replayed.summary.withheldAfter, 4);
  assert.deepEqual(replayed.summary.newlyWithheld, ['af-prog1-single-format']); assert.deepEqual(replayed.summary.noLongerWithheld, []);
  assert.deepEqual(replayed.summary.changedReviewRecords, ['af-prog1-passive', 'af-prog1-single-format']);
  assert.equal(replayed.summary.providerRequests, 0); assert.equal(replayed.historicalLedger.requests, 16);
});

test('E.8 resources: compatible cached Stage C judgments are re-reviewed without provider calls, mutation or prompt change', async () => {
  const { content, masters } = sample();
  const env = { ...C, SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'offline-fixture-only' };
  const version = gemini.promptVersionOf(gemini.providerConfig(env).model, env);
  assert.equal(version, 'alignment-12c1c2-r8');
  const key = gemini.pairKey(own, 'gemini', gemini.providerConfig(env).model, version, gemini.courseKeyOf(gemini.courseOf(content)));
  const previous = { ...remaining.answers[0][own.id], id: 'old-location', key, type: own.type, sourceBloom: 'Create', targetBloom: 'Apply' };
  const before = structuredClone(previous);
  const result = await gemini.align(content, masters, { env, pairs: [own], reuse: new Map([[key, previous]]), transport: async () => { assert.fail('No provider call is permitted'); } });
  const checked = result.judgements[0];
  assert.deepEqual(result.reuse, { reused: 1, asked: 0, requests: 0 });
  assert.equal(checked.label, previous.label); assert.deepEqual(checked.aspects, previous.aspects);
  assert.equal(checked.sourceQuote, previous.sourceQuote); assert.equal(checked.targetQuote, previous.targetQuote); assert.equal(checked.draft, previous.draft);
  assert.ok(checked.draftReview.includes('assumes_resource')); assert.equal(checked.resourceReviewVersion, RESOURCE_REVIEW_VERSION);
  assert.deepEqual(previous, before);
});

async function checkedReport(draft, { upstream = true, useAi = true } = {}) {
  const { content, masters } = sample();
  content.plan[2].contents = 'Java conditional statements';
  content.plan[2].ilos[0].text = 'Develop and test Java programs that use if-else and switch statements to make decisions.';
  content.plan[2].activities = own.target;
  const before = structuredClone(content);
  const env = { ...C, ...(upstream ? { SYLLABUS_CHECK_STAGE_B: 'on' } : {}), SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'offline-fixture-only' };
  let calls = 0;
  const transport = async (_url, req) => {
    calls++;
    const pairs = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const judgements = pairs.map(p => ({ id: p.id, label: p.id === 'row2-activityfit' ? 'PARTIALLY_ALIGNED' : 'ALIGNED', explanation: 'Scripted academic finding.',
      sourceQuote: p.source.slice(0, 16), targetQuote: p.target.slice(0, 16), sourceBloom: 'N/A', targetBloom: 'N/A', draft: p.id === 'row2-activityfit' ? draft : '',
      ...Object.fromEntries(gemini.aspectKeysFor(stageFlags(env)).map(k => [k, 'not_assessed'])),
      ...(p.type === 'Activity-fit' ? { teaching: p.id === 'row2-activityfit' ? 'weak' : 'sound', learnerSupport: 'adequate' } : p.type === 'Assessment-fit' ? { measures: 'yes', evidence: 'observable', level: 'matches' } : {}) }));
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements }) }] } }] }) };
  };
  const report = await run(content, masters, { env, useAi, transport, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
  assert.deepEqual(content, before);
  return { report, calls };
}

test('E.8 resources: withholding affects only the draft; official scores, 79 threshold, readiness and gates are invariant', async () => {
  const bad = await checkedReport('Use the syntax notes that are already available.'), good = await checkedReport('Faculty could prepare syntax notes for this exercise.');
  const official = r => ({ score: r.score, overall: r.overall, passed: r.passed, band: r.band, conformance: r.conformance, ready: r.hybrid.ready, deductions: r.hybrid.deductions,
    policy: r.hybrid.policy, official: r.hybrid.scoring.official, titlePolicy: r.hybrid.titlePolicy });
  assert.deepEqual(official(bad.report), official(good.report));
  assert.equal(bad.calls, good.calls); assert.equal(aiGate({}), 'advisory');
  assert.equal(require('../compliance/standard-v4.json').passThreshold, 79);
  assert.equal(bad.report.hybrid.titlePolicy.comparison, 'exact');
  assert.ok(!bad.report.hybrid.suggestions.some(s => s.path === 'plan[2].activities'));
  assert.ok(good.report.hybrid.suggestions.some(s => s.path === 'plan[2].activities'));
  const finding = bad.report.hybrid.verdict.findings.find(f => f.relationshipId === 'row2-activityfit');
  assert.equal(finding.withheld, 'draft_review'); assert.equal(finding.recommendation, null);
  assert.equal(bad.report.hybrid.alignment.judgements.find(j => j.id === 'row2-activityfit').label, 'PARTIALLY_ALIGNED');
});

test('E.8 resources: stale actionable copies cannot escape saved-report, API JSON or final finding filtering', async () => {
  const { report } = await checkedReport('Use the syntax notes that are already available.');
  const j = report.hybrid.alignment.judgements.find(j => j.id === 'row2-activityfit');
  const stale = structuredClone(report);
  stale.hybrid.suggestions.push({ id: 'SEM:' + j.id, path: j.targetPath, source: 'ai', replacement: j.draft, text: j.draft, basedOn: ['SEM:' + j.id] });
  stale.hybrid.suggestions.push({ id: 'different-judgment', path: j.targetPath, source: 'ai', replacement: 'A separately justified proposal.', text: 'A separately justified proposal.', basedOn: ['SEM:different-judgment'] });
  for (const f of [...stale.hybrid.verdict.findings, ...(stale.hybrid.verdict.all || [])]) if (f.relationshipId === j.id) {
    f.recommendation = j.draft; f.requiresFacultyApproval = true; f.recommendationType = 'REWRITE_TEXT';
    if (f.detail) f.detail.change = j.draft;
  }
  const untouched = structuredClone(stale), serialized = JSON.stringify(stale);
  const fakeDb = { query: async () => [[{ reference_hash: 'offline-fixture', report_json: serialized }]] };
  const restored = JSON.parse(JSON.stringify(await repo.readReport(fakeDb, 1)));
  const final = withholdReviewedDrafts(stale);
  for (const safe of [restored, final]) {
    assert.ok(!safe.hybrid.suggestions.some(s => s.replacement === j.draft));
    assert.ok(safe.hybrid.suggestions.some(s => s.id === 'different-judgment'));
    for (const f of [...safe.hybrid.verdict.findings, ...(safe.hybrid.verdict.all || [])].filter(f => f.relationshipId === j.id)) {
      assert.equal(f.recommendation, null); assert.equal(f.requiresFacultyApproval, false); assert.ok(!f.detail?.change);
    }
    assert.equal(safe.hybrid.alignment.judgements.find(x => x.id === j.id).draft, j.draft, 'raw evidence is retained');
    assert.equal(safe.score, stale.score); assert.equal(safe.hybrid.ready, stale.hybrid.ready);
  }
  let stored;
  await repo.saveReport({ query: async (_sql, params) => { stored = JSON.parse(params[2]); } }, 1, stale, 'offline-fixture');
  assert.ok(!stored.hybrid.suggestions.some(s => s.replacement === j.draft));
  assert.deepEqual(stale, untouched);
  const legacy = { score: 79, hybrid: { suggestions: [{ id: 'old', text: 'Legacy suggestion.' }], alignment: { judgements: [] } } };
  assert.equal(withholdReviewedDrafts(legacy), legacy);
});

test('E.8 resources: missing upstream evidence and offline fallback retain existing behavior', async () => {
  const missing = await checkedReport('Faculty could prepare syntax notes for this exercise.', { upstream: false });
  const finding = missing.report.hybrid.verdict.findings.find(f => f.relationshipId === 'row2-activityfit');
  assert.equal(finding.withheld, 'upstream_unverified'); assert.equal(finding.recommendation, null);
  assert.ok(!missing.report.hybrid.suggestions.some(s => s.path === 'plan[2].activities'));
  const offline = await checkedReport('Never requested.', { useAi: false });
  assert.equal(offline.calls, 0); assert.equal(offline.report.hybrid.alignment.status, 'not_evaluated');
  assert.ok(!offline.report.hybrid.suggestions.some(s => s.source === 'ai'));
});
