const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { sample } = require('./fixtures');
const { variantOf } = require('./variants');
const { align, pairsOf, pairKey, systemPromptOf, userMessageOf, courseOf, courseKeyOf, promptVersionOf, resetProviderBlock, PROMPT, CLASSIFICATION_PROMPT, NEMOTRON_FREE } = require('./gemini');
const C = require('./cloClassification');

// LCUP's fixed CLO classification (CLO 1 Introductory, CLO 2 Enabling, CLO 3 Demonstrating, CLO 4 Integration of Values) reaches an ILO-CLO evaluation
// only under the evaluation-only contract; the label saved with a CLO is compared with it and never trusted. Every model answer here is mocked: these
// tests show software behaviour, never academic accuracy.
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: NEMOTRON_FREE };
const CONTRACT = { evaluationOnly: true, cloClassification: C.VERSION };
const KEYS = ['id', 'path', 'source', 'target', 'targetPath', 'type'];
const fieldsOf = pair => Object.keys(pair).sort();
// The cache key exactly as it was computed before the contract existed.
const keyBefore = (pair, version, course) => crypto.createHash('sha256').update(JSON.stringify([version, 'openrouter', NEMOTRON_FREE, pair.type, pair.source, pair.target, ...(course ? [course] : [])])).digest('hex');
const placeholders = content => { for (const clo of content.clos) clo.level = 'Introductory'; return content; }; // what the PDF importer saves
const recorder = (explain = () => 'Synthetic answer.') => {
  const sent = [];
  const transport = async (url, request) => {
    const body = JSON.parse(request.body), pairs = JSON.parse(body.messages[1].content).document_data;
    sent.push(body);
    const answer = p => ({ id: p.id, label: p.type === 'ILO-CLO' ? 'PARTIALLY_ALIGNED' : 'ALIGNED', explanation: p.type === 'ILO-CLO' ? explain(p) : 'Synthetic answer.', sourceQuote: p.source.slice(0, 9), targetQuote: p.target.slice(0, 9), sourceBloom: 'Apply', targetBloom: 'Apply', draft: p.type === 'ILO-CLO' ? 'Revised ILO.' : '' });
    return { ok: true, json: async () => ({ model: NEMOTRON_FREE, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(answer) }) } }] }) };
  };
  return { sent, transport };
};
const pairsSent = body => JSON.parse(body.messages[1].content).document_data;
const contexted = (content, masters) => C.prepare(pairsOf(content, masters, []), content, C.VERSION).filter(p => p.type === 'ILO-CLO');
test.afterEach(() => resetProviderBlock());

test('CLO 1-4 resolve to LCUP\'s required classifications by number; a fifth CLO has none', () => {
  const { content } = sample();
  content.clos.push({ ...content.clos[0], id: 'c5', statement: 'Statement 5' });
  assert.deepEqual(C.summaryOf(content).map(c => [c.clo, c.level ?? null, c.status]),
    [['CLO 1', 'Introductory', 'required'], ['CLO 2', 'Enabling', 'required'], ['CLO 3', 'Demonstrating', 'required'], ['CLO 4', 'Integration of Values', 'required'], ['CLO 5', null, 'unavailable']]);
  assert.equal(C.summaryOf(content)[4].reason, 'no_fixed_classification');
  assert.deepEqual(C.classificationOf(content, { id: 'elsewhere' }), { status: 'unavailable', reason: 'clo_not_found' });
});

test('an imported placeholder label is reported as a conflict, never trusted, sent or changed', () => {
  const { content, masters } = sample();
  placeholders(content);
  const before = structuredClone(content);
  assert.deepEqual(C.summaryOf(content).map(c => c.stored), [{ level: 'Introductory', status: 'matches' }, { level: 'Introductory', status: 'conflicts' }, { level: 'Introductory', status: 'conflicts' }, { level: 'Introductory', status: 'conflicts' }]);
  content.clos[1].level = '';
  assert.deepEqual(C.classificationOf(content, content.clos[1]).stored, { level: null, status: 'missing' });
  content.clos[1].level = 'Introductory';
  for (const p of contexted(content, masters)) {
    const k = content.clos.findIndex(clo => p.id.endsWith(`-clo:${clo.id}`));
    assert.equal(p.classificationContext.classification, C.LEVELS[k], p.id);
    assert.ok(!JSON.stringify(p.classificationContext).includes('"level"'), 'the saved label is not part of the context');
  }
  assert.deepEqual(content, before, 'the syllabus, its labels, statements and mappings are untouched');
});

test('the three approved syllabi carry the importer\'s placeholder labels, which give way to the required classifications', () => {
  for (const name of ['it202', 'ie402', 'cpe304']) {
    const { content } = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../docs/lcup-approved-offline', `${name}.fixture.json`), 'utf8'));
    assert.ok(content.clos.length > 0 && content.clos.every(clo => clo.level === 'Introductory' && /^CLO \d+$/.test(clo.title)), `${name}: importer defaults`);
    const summary = C.summaryOf(content);
    assert.deepEqual(summary.map(c => c.level ?? null), content.clos.map((_, k) => C.LEVELS[k] ?? null), name);
    assert.deepEqual(summary.filter(c => c.stored.status === 'conflicts').map(c => c.clo), summary.slice(1, 4).map(c => c.clo), `${name}: CLO 2-4 conflict`);
    const iloClo = C.prepare(pairsOf(content, { pos: [], institution: { egas: [] } }, []), content, C.VERSION).filter(p => p.type === 'ILO-CLO');
    assert.ok(iloClo.length > 0, name);
    for (const p of iloClo) {
      const k = content.clos.findIndex(clo => p.id.endsWith(`-clo:${clo.id}`));
      assert.equal(p.classificationContext?.classification ?? null, C.LEVELS[k] ?? null, `${name} ${p.id}`);
    }
  }
});

test('without the contract nothing changes: the relationship, prompt, message and cache key are the ones they always were', () => {
  const { content, masters } = sample();
  const pairs = C.prepare(pairsOf(content, masters, []), content, null);
  for (const p of pairs) assert.deepEqual(fieldsOf(p), KEYS, p.id);
  const course = courseKeyOf(courseOf(content)), version = promptVersionOf(NEMOTRON_FREE, env);
  for (const p of pairs) assert.equal(pairKey(p, 'openrouter', NEMOTRON_FREE, version, course), keyBefore(p, version, course));
  assert.ok(!systemPromptOf(variantOf(env), env, pairs).includes('classificationContext'));
  assert.ok(!userMessageOf(courseOf(content), pairs, []).includes('classificationContext'));
  // A context a caller attached itself is removed: only the contract can add one.
  const smuggled = pairs.map(p => ({ ...p, classificationContext: { classification: 'Demonstrating' } }));
  assert.deepEqual(C.prepare(smuggled, content, null), pairs);
});

test('under the contract every ILO-CLO relationship carries its mapped CLO\'s statement, classification, week and progression', () => {
  const { content, masters } = sample();
  const iloClo = contexted(content, masters);
  assert.ok(iloClo.length >= 10 && iloClo.every(p => p.classificationContext));
  for (const p of iloClo) {
    const i = Number(/^row(\d+)-/.exec(p.id)[1]), k = content.clos.findIndex(clo => p.id.endsWith(`-clo:${clo.id}`)), x = p.classificationContext;
    assert.equal(p.source, content.clos[k].statement, 'the CLO statement stays the source');
    assert.deepEqual([x.clo, x.classification, x.week, x.weekContent], [`CLO ${k + 1}`, C.LEVELS[k], content.plan[i].week, content.plan[i].contents]);
    const weeks = content.plan.filter(row => row.kind !== 'exam' && row.ilos.some(ilo => ilo.text && ilo.tags.includes(`clo:${content.clos[k].id}`))).map(row => row.week);
    assert.deepEqual(x.cloLessons.map(l => l.week), weeks, 'every lesson of the same CLO, in plan order');
    assert.deepEqual(x.cloLessons.filter(l => l.thisLesson).map(l => l.week), [content.plan[i].week]);
    assert.deepEqual(x.courseClos.map(c => [c.clo, c.classification]), content.clos.map((_, n) => [`CLO ${n + 1}`, C.LEVELS[n]]), 'the other CLOs, to name a better fit');
  }
  const course = courseOf(content), version = promptVersionOf(NEMOTRON_FREE, env), key = p => pairKey(p, 'openrouter', NEMOTRON_FREE, version, courseKeyOf(course));
  assert.ok(systemPromptOf(variantOf(env), env, iloClo).endsWith(CLASSIFICATION_PROMPT));
  for (const p of iloClo) { const { classificationContext, ...plain } = p; assert.notEqual(key(p), key(plain), 'a different question, never answered from a statement-only verdict'); }
});

test('grouped weeks and several ILOs in one lesson stay one relationship per ILO and CLO', () => {
  const { content, masters } = sample();
  const row = content.plan.find(r => r.kind !== 'exam');
  row.week = '9-10';
  row.ilos = [{ id: 'g1', text: 'Explain the first idea', tags: ['clo:c2'] }, { id: 'g2', text: 'Apply the second idea', tags: ['clo:c2', 'clo:c3'] }];
  const i = content.plan.indexOf(row);
  const mine = contexted(content, masters).filter(p => p.id.startsWith(`row${i}-`));
  assert.deepEqual(mine.map(p => [p.id, p.classificationContext.classification, p.classificationContext.week]),
    [[`row${i}-ilo0-clo:c2`, 'Enabling', '9-10'], [`row${i}-ilo1-clo:c2`, 'Enabling', '9-10'], [`row${i}-ilo1-clo:c3`, 'Demonstrating', '9-10']]);
  const lesson = mine[0].classificationContext.cloLessons.find(l => l.thisLesson);
  assert.deepEqual(lesson, { week: '9-10', ilo: 'Explain the first idea / Apply the second idea', thisLesson: true }, 'both ILOs of the lesson that serve CLO 2');
});

test('the classification is the CLO\'s, never the week\'s: a first-week ILO of CLO 3 is read as Demonstrating, a late ILO of CLO 1 as Introductory', () => {
  const { content, masters } = sample();
  const lessons = content.plan.filter(r => r.kind !== 'exam');
  lessons[0].ilos[0].tags = ['clo:c3'];
  lessons.at(-1).ilos[0].tags = ['clo:c1'];
  const byRow = new Map(contexted(content, masters).map(p => [Number(/^row(\d+)-/.exec(p.id)[1]), p.classificationContext.classification]));
  assert.equal(byRow.get(content.plan.indexOf(lessons[0])), 'Demonstrating');
  assert.equal(byRow.get(content.plan.indexOf(lessons.at(-1))), 'Introductory');
  assert.match(CLASSIFICATION_PROMPT, /belongs to the CLO, never to the week/);
  assert.match(CLASSIFICATION_PROMPT, /need not show the whole CLO competency in a single week/);
  assert.match(CLASSIFICATION_PROMPT, /never makes the pair ALIGNED when the ILO is not a step of this CLO's statement/);
  assert.match(CLASSIFICATION_PROMPT, /CLO1 Introductory \(Foundational Knowledge\)/);
  assert.match(CLASSIFICATION_PROMPT, /CLO4 Integration of Values \(Ethics & Responsibility \/ Evaluate & Create\)/);
  assert.ok(!PROMPT.includes('classificationContext'), 'the base prompt is unchanged');
});

test('align: the contract is evaluation-only and versioned, and every ILO-CLO judgement says what it was judged on', async () => {
  const { content, masters } = sample();
  placeholders(content);
  for (const bad of [{ cloClassification: C.VERSION }, { ...CONTRACT, cloClassification: 'ilo-clo-classification-1' }]) {
    await assert.rejects(align(content, masters, { env, transport: recorder().transport, ...bad }), /Unknown or non-evaluation CLO classification contract/);
  }
  const plain = recorder(), statementOnly = await align(content, masters, { env, transport: plain.transport });
  assert.ok(plain.sent.every(body => !JSON.stringify(body).includes('classificationContext')));
  for (const j of statementOnly.judgements.filter(x => x.type === 'ILO-CLO')) {
    assert.equal(j.cloClassification.status, 'not_evaluated');
    assert.equal(j.cloClassification.reason, 'contract_not_selected');
    assert.equal(j.label, 'PARTIALLY_ALIGNED', 'the statement-based verdict is unchanged');
  }
  assert.ok(statementOnly.judgements.filter(j => j.type !== 'ILO-CLO').every(j => !('cloClassification' in j)));

  const r = recorder(p => `The ILO does not build this CLO; CLO 3 fits it better, and CLO 9 is named here only to test.`);
  const result = await align(content, masters, { env, transport: r.transport, ...CONTRACT });
  for (const j of result.judgements.filter(x => x.type === 'ILO-CLO')) {
    const k = content.clos.findIndex(clo => j.id.endsWith(`-clo:${clo.id}`)), m = j.cloClassification;
    assert.deepEqual([m.status, m.contract, m.clo, m.classification, m.source, m.basis], ['evaluated', C.VERSION, `CLO ${k + 1}`, C.LEVELS[k], 'lcup_fixed_mapping', 'statement_and_classification']);
    assert.equal(m.stored.status, k === 0 ? 'matches' : 'conflicts');
    assert.deepEqual(m.otherClos, k === 2 ? undefined : ['CLO 3'], 'another existing CLO the explanation names');
    assert.deepEqual(m.unknownClos, ['CLO 9'], 'a CLO the course does not have: an unsupported reference');
    assert.equal(j.label, 'PARTIALLY_ALIGNED', 'never changed by the mark');
  }
  const carrying = r.sent.filter(body => pairsSent(body).some(p => p.classificationContext));
  assert.ok(carrying.length > 0 && carrying.every(body => body.messages[0].content.includes(CLASSIFICATION_PROMPT)));
  assert.ok(r.sent.filter(body => !carrying.includes(body)).every(body => !body.messages[0].content.includes('classificationContext')), 'other requests keep their prompt');
});

test('a statement-only verdict is never reused for the classification-aware question, and other relationships are reused', async () => {
  const { content, masters } = sample();
  const first = await align(content, masters, { env, transport: recorder().transport });
  const r = recorder(), second = await align(content, masters, { env, transport: r.transport, ...CONTRACT, reuse: new Map(first.judgements.map(j => [j.key, j])) });
  assert.deepEqual(r.sent.flatMap(body => pairsSent(body).map(p => p.id)).sort(), first.judgements.filter(j => j.type === 'ILO-CLO').map(j => j.id).sort());
  assert.ok(second.judgements.filter(j => j.type !== 'ILO-CLO').every(j => j.reused));
});

test('the evaluation-only recommendation contract and its safeguards still work beside the classification contract', async () => {
  const P = require('../../../scripts/lcup-v2-evaluation/pipeline.cjs'), R2 = require('./academicV2Recommendation'), { POLICY } = require('./academicV2Plan');
  const MODEL = 'claude-sonnet-5-5', claudeEnv = { ...P.envFor(MODEL, 'sk-ant-unit-test-only-not-a-real-key'), ANTHROPIC_MAX_TOKENS: '4096' };
  const read = file => fs.readFileSync(path.join(P.root, file), 'utf8'), bundle = JSON.parse(read('docs/lcup-v2-evaluation/prepared-final/bundle.json'));
  const c = bundle.cases.find(x => x.id === 'BM1-S13-001'), ctx = bundle.contexts[c.contextId], pair = P.pairOf(c, ctx); // a frozen ILO-CLO case
  assert.equal(pair.type, 'ILO-CLO');
  const answer = { id: pair.id, label: 'PARTIALLY_ALIGNED', explanation: 'Mocked: the ILO covers only part of the CLO.', sourceQuote: pair.source.trim().slice(0, 12), targetQuote: pair.target.trim().slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Understand', recommendation: 'REVIEW_REQUIRED', draft: '', correctionField: 'undetermined', correctionReason: 'Faculty should decide between the week content and the ILO week.' };
  const sent = [];
  const transport = async (_url, init) => { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'msg_offline', type: 'message', role: 'assistant', model: MODEL, content: [{ type: 'text', text: JSON.stringify({ judgements: [answer] }) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  const options = { env: claudeEnv, pairs: [pair], academicPolicy: POLICY.id, evaluationOnly: true, transport, skipEmpty: false, recommendation: R2.VERSION };
  const both = await align(ctx.content, ctx.masters, { ...options, cloClassification: C.VERSION });
  assert.equal(sent.length, 1);
  const message = JSON.parse(sent[0].messages[0].content), k = ctx.content.clos.findIndex(clo => pair.id.endsWith(`-clo:${clo.id}`));
  assert.ok(message.recommendation_context.pairs[pair.id], 'the recommendation context still travels');
  assert.equal(message.document_data[0].classificationContext.classification, C.LEVELS[k]);
  const system = typeof sent[0].system === 'string' ? sent[0].system : sent[0].system.map(b => b.text).join('');
  assert.ok(system.endsWith(CLASSIFICATION_PROMPT) && system.indexOf('recommendation_context') >= 0 && system.indexOf('recommendation_context') < system.indexOf(CLASSIFICATION_PROMPT), 'the classification wording comes after the recommendation wording');
  assert.equal(both.status, 'completed');
  const [j] = both.judgements;
  assert.deepEqual([j.recommendation, j.correction?.decision, j.draft], ['REVIEW_REQUIRED', 'REVIEW_REQUIRED', ''], 'the REVIEW_REQUIRED safeguard still withholds the draft');
  assert.equal(j.cloClassification.status, 'evaluated');
  resetProviderBlock(); sent.length = 0;
  const r2only = await align(ctx.content, ctx.masters, options);
  assert.ok(!JSON.stringify(sent[0]).includes('classificationContext'), 'the r2 request alone is unchanged');
  assert.equal(r2only.judgements[0].label, j.label);
});

test('one classification per CLO across the evaluation path: ILO-CLO context, Policy V2 classification and coverage questions, recommendation context', async () => {
  const P = require('../../../scripts/lcup-v2-evaluation/pipeline.cjs'), R2 = require('./academicV2Recommendation'), V2 = require('./academicV2Plan');
  const bundle = JSON.parse(fs.readFileSync(path.join(P.root, 'docs/lcup-v2-evaluation/prepared-final/bundle.json'), 'utf8'));
  for (const id of ['ctx-it202', 'ctx-ie402', 'ctx-S13']) {
    const ctx = structuredClone(bundle.contexts[id]), before = structuredClone(ctx.content), planned = V2.plan(ctx.content, ctx.masters).pairs;
    const sent = C.prepare(planned, ctx.content, C.VERSION, ctx.masters), n = ctx.content.clos.length;
    const levelOf = text => /Assigned classification: (.*)$/.exec(text)?.[1] ?? /\[course level tag: ([^\]]*)\]/.exec(text)?.[1];
    for (const p of sent.filter(x => x.type === 'CLO-classification' || x.type === 'CLO-coverage')) {
      const k = Number(/(\d+)/.exec(p.id)[1]);
      assert.equal(p.classificationSource, 'lcup_fixed_mapping', p.id);
      if (k < 4) assert.equal(levelOf(p.source), C.LEVELS[k], `${id} ${p.id}: the required classification, not the saved label`);
      const tagged = p.target.split('Other weeks')[0];
      if (p.type === 'CLO-coverage' && k === 3 && tagged.includes('- Week')) assert.match(tagged, /\| Values: /, 'the Integration of Values CLO is asked with its weeks\' values');
    }
    assert.equal(sent.filter(x => x.type === 'CLO-classification').length, planned.filter(x => x.type === 'CLO-classification').length, 'no relationship added or dropped');
    for (const p of sent.filter(x => x.type === 'ILO-CLO' && x.classificationContext)) {
      const k = ctx.content.clos.findIndex(c => p.id.endsWith(`-clo:${c.id}`));
      assert.equal(p.classificationContext.classification, C.LEVELS[k]);
    }
    const card = R2.prepare(C.viewOf(ctx.content), ctx.masters, { version: R2.VERSION, academicPolicy: V2.POLICY.id, evaluationOnly: true, env: P.envFor('claude-sonnet-5-5', 'sk-ant-unit-test-only-not-a-real-key'), provider: 'anthropic', recommend: true });
    const context = card.contextFor(sent.filter(x => x.type === 'ILO-CLO').slice(0, 4));
    for (const c of Object.values(context.clos || {})) {
      const k = ctx.content.clos.findIndex(x => x.statement === c.statement);
      assert.equal(c.level, C.LEVELS[k] ?? null, `${id}: the recommendation context agrees`);
    }
    assert.deepEqual(ctx.content, before, 'the syllabus is never changed');
    // Without the contract the Policy V2 questions are exactly the planned ones.
    assert.deepEqual(C.prepare(planned, ctx.content, null, ctx.masters), planned);
    assert.ok(n > 0);
  }
});

test('every ILO with text in every lesson is one ILO-CLO relationship per mapped CLO, each with its own context', () => {
  for (const name of ['it202', 'ie402', 'cpe304']) {
    const { content } = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../docs/lcup-approved-offline', `${name}.fixture.json`), 'utf8'));
    const expected = [];
    content.plan.forEach((row, i) => { if (row.kind === 'exam') return; (row.ilos || []).forEach((ilo, j) => (ilo.tags || []).filter(t => t.startsWith('clo:')).forEach(t => expected.push(`row${i}-ilo${j}-${t}`))); });
    const sent = C.prepare(pairsOf(content, { pos: [], institution: { egas: [] } }, []), content, C.VERSION).filter(p => p.type === 'ILO-CLO');
    assert.deepEqual(sent.map(p => p.id).sort(), expected.sort(), name);
    assert.ok(sent.every(p => p.classificationContext || content.clos.findIndex(c => p.id.endsWith(`-clo:${c.id}`)) >= 4), `${name}: CLO 1-4 always carry it`);
  }
});
