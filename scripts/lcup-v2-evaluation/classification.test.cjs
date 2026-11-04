'use strict';
// Offline tests of the runner (pipeline.cjs, prepare.cjs, report.cjs, run.cjs) with a CLO classification bundle: the opt-in, evaluation-only contract of
// server/lib/syllabuscheck/cloClassification.js, applied to every ILO-CLO relationship of the three verified syllabi. fetch is blocked for the whole file
// and every model answer is mocked, so these tests show software behaviour only, never academic accuracy. The fixture receipts authorize nothing outside
// this file; no live receipt is written.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new TypeError('fetch failed (network blocked in classification.test.cjs)'); };
test.after(() => { globalThis.fetch = realFetch; });
const P = require('./pipeline.cjs');
const G = require('../../server/lib/syllabuscheck/gemini');
const C = require('../../server/lib/syllabuscheck/cloClassification');
const R2 = require('../../server/lib/syllabuscheck/academicV2Recommendation');
const { plan, POLICY } = require('../../server/lib/syllabuscheck/academicV2Plan');
const { report } = require('./report.cjs');

const MODEL = 'claude-sonnet-5-5', KEY = 'sk-ant-unit-test-only-not-a-real-key';
const BASE = P.select(MODEL), CB = P.select(MODEL, { cloClassification: C.VERSION });
const frozen = JSON.parse(fs.readFileSync(path.join(P.root, 'docs/lcup-v2-evaluation/prepared-final/bundle.json'), 'utf8'));
const temp = path.join(P.root, `tmp/lcup-v2-evaluation-clo-tests-${Date.now()}-${process.pid}`);
fs.mkdirSync(temp, { recursive: true });
test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
test.afterEach(() => G.resetProviderBlock());
const rehash = b => { const { preparedHash, ...body } = b; b.preparedHash = P.hash(body); return b; };
const caseOf = id => CB.cases.find(c => c.id === id);
// The CLO number (0-based) of an ILO-CLO relationship, from its pair id.
const cloIndex = (content, pairId) => content.clos.findIndex(clo => pairId.endsWith(`-clo:${clo.id}`));
const receiptFor = (b, scope, extra = {}) => ({ version: P.VERSION, approved: true, approvedBy: 'Unit test fixture, not an actual authorization', receiptId: 'synthetic-unit-test', approvedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), preparedHash: b.preparedHash, policyVersion: b.policyVersion, ...(b.cloClassification ? { cloClassification: b.cloClassification.version } : {}), scope, model: MODEL, limits: P.limitsFor(scope), ...extra });
// A mocked provider answering ALIGNED for every relationship of a request, with quotes taken from its own text.
function mockSend() {
  const send = async (_url, init) => {
    send.bodies.push(init.body);
    const body = JSON.parse(init.body), pairs = JSON.parse(body.messages[0].content).document_data, properties = body.output_config.format.schema.properties.judgements.items.properties;
    const judgements = pairs.map(p => ({ ...Object.fromEntries(Object.entries(properties).map(([k, s]) => [k, s.enum?.includes('not_assessed') ? 'not_assessed' : s.enum?.[0] || ''])), id: p.id, label: 'ALIGNED', explanation: 'Synthetic response used only to verify the runner.', sourceQuote: p.source.slice(0, 18), targetQuote: p.target.slice(0, 18), sourceBloom: 'N/A', targetBloom: 'N/A', draft: '' }));
    return new Response(JSON.stringify({ id: 'msg_mock_only', type: 'message', role: 'assistant', model: MODEL, content: [{ type: 'text', text: JSON.stringify({ judgements }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  send.bodies = [];
  return send;
}

test('opt-in: without the option the bundle is the baseline; with it a separate, versioned, nonofficial bundle of ILO-CLO relationships only', () => {
  assert.equal('cloClassification' in BASE, false);
  const { preparedHash: _base, promptSources: now, ...base } = BASE, { preparedHash: _frozen, promptSources: _then, ...was } = frozen;
  assert.deepEqual(base, was, 'the baseline selection is the frozen one but for the prompt fingerprints');
  assert.deepEqual(Object.keys(now), P.PROMPT_FILES, 'and those cover the same files as before');
  const { notEvaluable, ...contract } = CB.cloClassification;
  assert.deepEqual(contract, { version: C.VERSION, source: C.SOURCE, official: false, productionActive: false });
  assert.deepEqual(Object.keys(CB.promptSources), [...P.PROMPT_FILES, ...P.CLASSIFICATION_FILES]);
  for (const file of P.PROMPT_FILES) assert.equal(CB.promptSources[file], BASE.promptSources[file]);
  assert.deepEqual(Object.keys(CB.contexts), ['ctx-it202', 'ctx-ie402', 'ctx-cpe304']);
  assert.ok(CB.cases.every(c => c.relationshipType === 'ILO-CLO' && c.sourceKind === 'verified-syllabus' && c.expectedJudgment === null && !c.holds.length));
  assert.deepEqual([CB.scopes.pilot.length, notEvaluable.length, CB.scopes.smoke.length], [65, 16, 12]);
  assert.deepEqual(CB.scopes.smoke, P.CLASSIFICATION_SMOKE);
  assert.equal(P.verifyBundle(CB, MODEL), CB);
  for (const version of ['lcup-ilo-clo-classification-2', '', 'Introductory']) assert.throws(() => P.select(MODEL, { cloClassification: version }), /Unknown CLO classification contract/, version);
  const combined = P.select(MODEL, { cloClassification: C.VERSION, recommendation: R2.VERSION });
  assert.deepEqual(combined.cloClassification, CB.cloClassification);
  assert.deepEqual(combined.recommendation, { version: R2.VERSION, official: false, productionActive: false });
  assert.deepEqual(combined.scopes, CB.scopes, 'adding r2 must preserve the classification scope');
});

test('every ILO of every instructional lesson: one relationship per assigned CLO, judged separately; an ILO mapped to no CLO (or a lesson with no ILO) is reported, never sent', () => {
  const counts = {};
  for (const [id, ctx] of Object.entries(CB.contexts)) {
    const tagged = [], untagged = [];
    ctx.content.plan.forEach((row, i) => {
      if (row.kind === 'exam') return;
      // A lesson with no ILO is one empty ILO with no CLO, as the V2 plan reports it (CpE 304 Week 1).
      (row.ilos?.length ? row.ilos : [{}]).forEach((ilo, j) => {
        const tags = (ilo.tags || []).filter(t => String(t).startsWith('clo:'));
        if (tags.length) for (const tag of tags) tagged.push(`row${i}-ilo${j}-${tag}`);
        else untagged.push(`row${i}-ilo${j}-unassigned-clo`);
      });
    });
    const sent = CB.scopes.pilot.map(caseOf).filter(c => c.contextId === id).map(c => c.pairId), skipped = CB.cloClassification.notEvaluable.filter(n => n.contextId === id);
    assert.deepEqual(sent, tagged, `${id}: every ILO and each CLO assigned to it, in plan order`);
    assert.deepEqual(skipped.map(n => n.pairId), untagged, `${id}: every ILO mapped to no CLO, and every lesson with no ILO`);
    assert.ok(skipped.every(n => n.reason === 'missing_evidence'));
    const p = plan(ctx.content, ctx.masters);
    assert.deepEqual([...sent, ...skipped.map(n => n.pairId)].sort(), p.pairs.filter(x => x.type === 'ILO-CLO').map(x => x.id).sort(), `${id}: and nothing else`);
    const perIlo = new Map();
    for (const pairId of sent) { const ilo = pairId.replace(/-clo:.+$/, ''); perIlo.set(ilo, (perIlo.get(ilo) || 0) + 1); }
    counts[id] = [sent.length, skipped.length, [...perIlo.values()].filter(n => n > 1).length];
  }
  assert.deepEqual(counts, { 'ctx-it202': [30, 4, 13], 'ctx-ie402': [29, 0, 14], 'ctx-cpe304': [6, 12, 2] }, '[relationships sent, not evaluable, ILOs mapped to two or more CLOs]');
});

test('a classification bundle rejects invalid contracts and incomplete or mixed scope while accepting r2', () => {
  const ie402 = frozen.cases.find(c => c.id === 'BM1-IE402-074');
  // A relationship of the pilot scope outside the smoke scope, taken out of the bundle.
  const drop = b => { const id = b.scopes.pilot.find(x => !b.scopes.smoke.includes(x)); b.scopes.pilot = b.scopes.pilot.filter(x => x !== id); const c = b.cases.find(x => x.id === id); b.cases = b.cases.filter(x => x !== c); return c; };
  const contract = /Unknown or official CLO classification contract/, recommendation = /Unknown or official recommendation contract/, mixed = /Mixed or duplicate CLO classification scope/, incomplete = /Incomplete CLO classification scope/, listed = /listed as not evaluable/;
  const mutations = [
    ['official', b => { b.cloClassification.official = true; }, contract],
    ['production', b => { b.cloClassification.productionActive = true; }, contract],
    ['version', b => { b.cloClassification.version = 'lcup-ilo-clo-classification-2'; }, contract],
    ['source', b => { b.cloClassification.source = 'stored_level'; }, contract],
    ['unknown recommendation', b => { b.recommendation = { version: 'unknown', official: false, productionActive: false }; }, recommendation],
    ['production-active recommendation', b => { b.recommendation = { version: R2.VERSION, official: false, productionActive: true }; }, recommendation],
    ['dropped relationship', b => { drop(b); }, incomplete],
    ['dropped not-evaluable', b => { b.cloClassification.notEvaluable.pop(); }, incomplete],
    ['not-evaluable reason', b => { b.cloClassification.notEvaluable[0].reason = 'context_limit'; }, listed],
    ['evaluable listed as not evaluable', b => { const c = drop(b); b.cloClassification.notEvaluable.push({ caseId: c.id, contextId: c.contextId, pairId: c.pairId, reason: 'missing_evidence' }); }, listed],
    ['smoke outside pilot', b => { b.scopes.smoke = [...b.scopes.smoke, ie402.id]; b.cases.push(ie402); }, mixed],
    ['other relationship type', b => { b.cases.push(ie402); b.scopes.pilot.push(ie402.id); }, mixed],
    ['classification code changed', b => { b.promptSources['server/lib/syllabuscheck/cloClassification.js'] = 'changed'; }, /Prompt source changed/],
  ];
  for (const [name, mutate, refusal] of mutations) {
    const b = structuredClone(CB);
    mutate(b);
    assert.throws(() => P.verifyBundle(rehash(b), MODEL), refusal, name);
  }
  const compatible = structuredClone(CB);
  compatible.recommendation = { version: R2.VERSION, official: false, productionActive: false };
  rehash(compatible);
  assert.equal(P.verifyBundle(compatible, MODEL), compatible, 'a valid evaluation-only r2 contract is compatible with classification-3');
});

test('dry run: every relationship planned once, at most four per request, each with its CLO\'s fixed classification and lesson, no network', async () => {
  const env = P.envFor(MODEL);
  for (const [scope, initial] of [['smoke', 3], ['pilot', 18]]) {
    const p = await P.dryPlan(CB, scope, MODEL);
    assert.deepEqual([p.networkRequests, p.liveModelCalls, p.initialRequests, p.selectedCases, p.cloClassification, p.budgetFitsInitial], [0, 0, initial, CB.scopes[scope].length, C.VERSION, true], scope);
    assert.equal(p.promptVersion, `${G.promptVersionOf(MODEL, env)}-${POLICY.id}-${C.VERSION}`);
    assert.deepEqual(p.requests.flatMap(r => r.caseIds), CB.scopes[scope], `${scope}: each relationship once, in scope order`);
    assert.ok(p.cost.worst <= p.limits.maxCost);
    for (const r of p.requests) {
      const ctx = CB.contexts[r.contextId], pairs = P.classifiedPairs(CB, ctx, r.caseIds.map(id => P.pairOf(caseOf(id), ctx)), env);
      assert.ok(r.caseIds.length <= G.batchSizeOf(MODEL, env) && G.batchSizeOf(MODEL, env) === 4);
      assert.equal(r.body.system[0].text, G.systemPromptOf('rubric', env, pairs, POLICY.id));
      assert.ok(r.body.system[0].text.endsWith(G.CLASSIFICATION_PROMPT));
      assert.equal(r.body.messages[0].content, G.userMessageOf(G.courseOf(ctx.content), pairs));
      assert.ok(r.conservativeBound.inputTokens <= p.limits.maxInputTokensPerRequest);
      for (const sent of JSON.parse(r.body.messages[0].content).document_data) {
        const k = cloIndex(ctx.content, sent.id), row = ctx.content.plan[Number(/^row(\d+)-/.exec(sent.id)[1])];
        assert.deepEqual([sent.classificationContext.clo, sent.classificationContext.classification, sent.classificationContext.week], [`CLO ${k + 1}`, C.LEVELS[k], String(row.week)], sent.id);
        assert.equal(sent.classificationContext.cloLessons.filter(l => l.thisLesson).length, 1);
        assert.deepEqual(sent.classificationContext.courseClos.map(c => c.classification), C.LEVELS, 'the course CLOs with their fixed classifications, never the saved labels');
      }
    }
    if (scope === 'smoke') {
      // Each smoke request is one whole lesson: two ILOs, each mapped to two CLOs; together the four CLOs.
      const numbers = new Set();
      for (const r of p.requests) {
        const ctx = CB.contexts[r.contextId], ids = r.caseIds.map(id => caseOf(id).pairId), rows = new Set(ids.map(id => /^row(\d+)-/.exec(id)[1]));
        assert.equal(rows.size, 1);
        assert.deepEqual(CB.scopes.pilot.map(caseOf).filter(c => c.contextId === r.contextId && c.pairId.startsWith(`row${[...rows][0]}-`)).map(c => c.id), r.caseIds);
        assert.deepEqual([...new Set(ids.map(id => id.replace(/-clo:.+$/, '')))].length, 2);
        for (const id of ids) numbers.add(cloIndex(ctx.content, id) + 1);
      }
      assert.deepEqual([...numbers].sort(), [1, 2, 3, 4]);
    }
  }
  // The runner sends a context's relationships in its own small groups: no align call comes near the 240-relationship limit, which is unchanged.
  assert.ok(Math.max(...P.groupsOf(CB, 'pilot').map(g => g.cases.length)) <= 30);
});

test('mocked execution sends exactly the planned requests; every ILO-CLO judgement is marked with its classification and the saved label, its label unchanged', async () => {
  const planned = await P.dryPlan(CB, 'pilot', MODEL), send = mockSend(), out = path.join(temp, 'mock-pilot');
  const r = await P.execute(CB, 'pilot', MODEL, P.limitsFor('pilot'), { receipt: receiptFor(CB, 'pilot'), key: KEY, out, send, testOnly: true });
  assert.deepEqual(send.bodies.map(b => P.hash(b)), planned.requests.map(x => x.bodyHash));
  assert.deepEqual([r.stopReason, r.cloClassification, r.promptVersion, r.official, r.productionActive, r.provenance], [null, C.VERSION, planned.promptVersion, false, false, 'synthetic-test-only']);
  assert.equal(r.observations.length, 65);
  for (const o of r.observations) {
    const c = caseOf(o.id), k = cloIndex(CB.contexts[c.contextId].content, c.pairId);
    assert.equal(o.judgment?.label, 'ALIGNED', o.id);
    assert.deepEqual(o.judgment.cloClassification, { status: 'evaluated', contract: C.VERSION, clo: `CLO ${k + 1}`, classification: C.LEVELS[k], source: C.SOURCE, stored: { level: 'Introductory', status: k === 0 ? 'matches' : 'conflicts' }, basis: 'statement_and_classification' }, o.id);
  }
  const q = report(CB, out);
  assert.deepEqual([q.cloClassification, q.measurementInput.cloClassification, q.accuracy, q.official], [C.VERSION, C.VERSION, null, false]);
  assert.ok(q.rows.every(x => x.status === 'REVIEWABLE_MODEL_JUDGMENT' && x.cloClassification?.status === 'evaluated' && x.facultyReviewRequired));
  assert.ok(q.limitations.some(l => /official definitions .* not in the repository/.test(l)));
  // The report CLI states each relationship's classification and saved label for faculty.
  const file = path.join(temp, 'cc-bundle.json');
  fs.writeFileSync(file, JSON.stringify(CB));
  const cli = spawnSync(process.execPath, [path.join(__dirname, 'report.cjs'), out, file], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const md = fs.readFileSync(path.join(out, 'review-report.md'), 'utf8');
  assert.match(md, /CLO classification: CLO 2, Enabling \(LCUP fixed mapping\); saved label Introductory \(conflicts\)/);
  assert.match(md, /CLO classification: CLO 4, Integration of Values \(LCUP fixed mapping\)/);
});

test('the receipt must name the classification contract; a mismatched receipt is refused before any request', async () => {
  const { cloClassification: _named, ...unnamed } = receiptFor(CB, 'smoke');
  for (const [b, receipt, name] of [[CB, unnamed, 'refuse-unnamed'], [BASE, receiptFor(BASE, 'smoke', { cloClassification: C.VERSION }), 'refuse-named-baseline']]) {
    const send = mockSend(), out = path.join(temp, name);
    await assert.rejects(P.execute(b, 'smoke', MODEL, P.limitsFor('smoke'), { receipt, key: KEY, out, send, testOnly: true }), /Explicit matching live authorization receipt/, name);
    assert.equal(send.bodies.length, 0);
    assert.equal(fs.existsSync(out), false);
  }
});

test('prepare and CLI: written once with both plans, the saved-label comparison and an unapproved template naming the contract; the CLI dry-runs it', async () => {
  const { prepare } = require('./prepare.cjs'), out = path.join(temp, 'prepared'), result = await prepare(MODEL, out, { cloClassification: C.VERSION });
  assert.deepEqual(Object.keys(result.scopes), ['smoke', 'pilot']);
  assert.deepEqual(fs.readdirSync(out).sort(), ['authorization.template.json', 'bundle.json', 'case-manifest.json', 'pilot-plan.json', 'smoke-plan.json']);
  const read = name => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8')), template = read('authorization.template.json'), manifest = read('case-manifest.json');
  assert.deepEqual(read('bundle.json'), CB);
  assert.deepEqual([template.approved, template.cloClassification, template.preparedHash, template.scope], [false, C.VERSION, CB.preparedHash, 'smoke']);
  assert.throws(() => P.authorize(template, CB, 'smoke', MODEL, P.limitsFor('smoke')), /Explicit matching/);
  for (const [id, ctx] of Object.entries(CB.contexts)) assert.deepEqual(manifest.cloClassifications[id], C.summaryOf(ctx.content));
  assert.deepEqual(manifest.cloClassifications['ctx-ie402'].map(s => [s.clo, s.level, s.stored.status]), [['CLO 1', 'Introductory', 'matches'], ['CLO 2', 'Enabling', 'conflicts'], ['CLO 3', 'Demonstrating', 'conflicts'], ['CLO 4', 'Integration of Values', 'conflicts']]);
  await assert.rejects(prepare(MODEL, out, { cloClassification: C.VERSION }), /already exists/);
  const node = (script, args) => spawnSync(process.execPath, [path.join(__dirname, script), ...args], { encoding: 'utf8' });
  const dry = node('run.cjs', ['--bundle', path.join(out, 'bundle.json'), '--scope', 'pilot', '--model', MODEL, '--out', path.join(temp, 'cli-dry')]);
  assert.equal(dry.status, 0, dry.stderr);
  const p = JSON.parse(fs.readFileSync(path.join(temp, 'cli-dry', 'plan.json'), 'utf8'));
  assert.deepEqual([p.networkRequests, p.liveModelCalls, p.initialRequests, p.cloClassification, p.budgetFitsInitial], [0, 0, 18, C.VERSION, true]);
  assert.deepEqual(p.requests.map(x => x.bodyHash), read('pilot-plan.json').requests.map(x => x.bodyHash));
  const live = node('run.cjs', ['--bundle', path.join(out, 'bundle.json'), '--scope', 'pilot', '--model', MODEL, '--out', path.join(temp, 'cli-no-auth'), '--live']);
  assert.notEqual(live.status, 0);
  assert.match(live.stderr, /explicit matching/);
  assert.equal(fs.existsSync(path.join(temp, 'cli-no-auth')), false);
  const unnamed = node('prepare.cjs', ['--model', MODEL, '--out', path.join(temp, 'cli-unnamed'), '--clo-classification']);
  assert.notEqual(unnamed.status, 0);
  assert.match(unnamed.stderr, /Unknown CLO classification contract/);
  assert.equal(fs.existsSync(path.join(temp, 'cli-unnamed')), false);
});
