const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run, VERSION } = require('./engine');
const { NEMOTRON_FREE } = require('./gemini');
const { buildWholePlan, enabled, STATUS } = require('./wholeSyllabusPlan');
const { applyChanges } = require('./coordinatedPlanEngine');
const { contentHash } = require('../compliance/hash');

// The whole-syllabus plan (wholeSyllabusPlan.js) against the problem it exists for: "I applied every recommendation, checked again, and a new conflict
// appeared somewhere else". The fake AI below makes the dependency real: every field carries a #tag, and a relationship is aligned only when its
// target carries the tag of its source. So rewriting an ILO really does break the content, activity and task that were fitted to the old ILO.
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: NEMOTRON_FREE };
const options = { useAi: true, env, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
const reply = (content) => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }) });
const tags = text => String(text || '').match(/#\w+/g) || [];
const untagged = text => String(text || '').replace(/\s*#\w+/g, '').trim();
const JUDGED = new Set(['ILO-CLO', 'ILO-content', 'ILO-activity', 'ILO-assessment']);

const verdict = (pair) => {
  // CLO 1 against its POs: "#partial" in the CLO is a partly aligned CLO, "#notaligned" a clearly misaligned one.
  if (/^clo0-(po|anypo)/.test(pair.id) && /#(partial|notaligned)/.test(pair.target)) {
    const label = pair.target.includes('#notaligned') ? 'NOT_ALIGNED' : 'PARTIALLY_ALIGNED';
    return { id: pair.id, label, explanation: 'The CLO does not fit the PO.', sourceQuote: pair.source.slice(0, 6), targetQuote: pair.target.slice(0, 6), sourceBloom: 'Apply', targetBloom: 'Apply', draft: pair.target.replace(/\s*#(partial|notaligned)/, ' fixed') };
  }
  const need =pair.id.startsWith('row0-') && JUDGED.has(pair.type) ? tags(pair.source)[0] : null;
  const ok = !need || tags(pair.target).includes(need);
  return { id: pair.id, label: ok ? 'ALIGNED' : 'NOT_ALIGNED', explanation: ok ? 'Fits.' : `The target does not carry ${need}.`, sourceQuote: pair.source.slice(0, 6), targetQuote: pair.target.slice(0, 6),
    sourceBloom: 'Apply', targetBloom: 'Apply', draft: ok ? '' : `${untagged(pair.target)} ${need}` }; // a draft written for THIS relationship only
};
const fakeAi = () => {
  const asked = [], rewrites = [];
  const transport = async (url, request) => {
    const payload = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
    if (Array.isArray(payload)) { asked.push(...payload.map(p => p.id)); return reply({ judgements: payload.map(verdict) }); }
    // The combined rewrite (refine.js): one text for every relationship the field takes part in as the target.
    rewrites.push(payload);
    const needed = payload.relationships.filter(r => r.thisFieldIsThe === 'target').flatMap(r => tags(r.otherSide).slice(0, 1));
    return reply({ text: [untagged(payload.current), ...new Set(needed)].join(' ') });
  };
  return { transport, asked, rewrites };
};
const check = (content, masters, ai, extra = {}) => run(content, masters, { ...options, transport: ai.transport, ...extra });
const aiPaths = r => r.hybrid.suggestions.filter(s => s.source === 'ai').map(s => s.path).sort();
const row0Problems = r => r.hybrid.alignment.judgements.filter(j => j.id.startsWith('row0-') && ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(j.label)).map(j => j.id).sort();
const applySuggestions = (content, r) => applyChanges(content, r.hybrid.suggestions.filter(s => s.source === 'ai').map(s => ({ changeId: s.id, path: s.path, proposedValue: s.replacement })));

// Week 1: the ILO does not build CLO 1; its content, activity and task are fitted to the ILO as it is now.
function cascade() {
  const { content, masters } = sample();
  content.clos[0].statement = 'Design combinational logic circuits #c1';
  Object.assign(content.plan[0], { ilos: [{ id: 'i1', text: 'Explain topic 1 #old', tags: ['clo:c1'] }], contents: 'Topic 1 #old', activities: 'Lecture #old', tasks: '- Quiz #old' });
  return { content, masters };
}
// Week 1 with two ILOs: the activity practises neither of them, so two relationships flag the same field.
function twoIlos() {
  const { content, masters } = sample();
  Object.assign(content.plan[0], { ilos: [{ id: 'i1', text: 'Explain A #alpha', tags: ['clo:c1'] }, { id: 'i1b', text: 'Explain B #beta', tags: ['clo:c1'] }], contents: 'Topic #alpha #beta', activities: 'Lecture', tasks: '- Quiz #alpha #beta' });
  return { content, masters };
}

test('off by default; SYLLABUS_CHECK_WHOLE_PLAN=on turns it on', () => {
  assert.equal(enabled({}), false);
  assert.equal(enabled({ SYLLABUS_CHECK_WHOLE_PLAN: 'on' }), true);
});

test('the problem: applying the check\'s recommendations and checking again shows new conflicts in other fields', async () => {
  const { content, masters } = cascade();
  const ai = fakeAi();
  const first = await check(content, masters, ai);
  assert.deepEqual(aiPaths(first), ['plan[0].ilos[0].text']);
  const second = await check(applySuggestions(content, first), masters, ai);
  assert.deepEqual(row0Problems(second), ['row0-ilo0-activity', 'row0-ilo0-assessment', 'row0-ilo0-content'], 'fixing the ILO broke the three fields fitted to the old ILO');
});

test('the whole-syllabus plan writes every dependent field against the revised text and verifies the package: applying it leaves no conflict', async () => {
  const { content, masters } = cascade();
  const ai = fakeAi();
  const first = await check(content, masters, ai);
  const plan = await buildWholePlan({ content, masters, result: first, syllabusId: 7, options: { ...options, transport: ai.transport } });
  assert.equal(plan.status, STATUS.VERIFIED, plan.validation.summaryText);
  assert.deepEqual(plan.changes.map(c => c.path), ['plan[0].ilos[0].text', 'plan[0].contents', 'plan[0].activities', 'plan[0].tasks'], 'in order: the ILO first, then what depends on it');
  assert.deepEqual(plan.changes.map(c => c.proposedValue), ['Explain topic 1 #c1', 'Topic 1 #c1', 'Lecture #c1', '- Quiz #c1']);
  assert.ok(plan.changes.every(c => c.verification === STATUS.VERIFIED));
  assert.deepEqual(plan.changes.map(c => c.rounds), [[1], [2], [2], [2]]);
  assert.equal(plan.changes[0].sourceSuggestionId, first.hybrid.suggestions.find(s => s.path === 'plan[0].ilos[0].text').id, 'the first-round change is the recommendation the author saw');
  assert.deepEqual(plan.validation.regressions, []);
  // The apply route compares the plan with compliance.hashOf of the stored syllabus.
  assert.equal(plan.sourceHash, contentHash(content, VERSION));
  // Applying the plan and checking again: nothing left to fix in week 1, and no new recommendation anywhere.
  const after = await check(applyChanges(content, plan.changes), masters, ai);
  assert.deepEqual(row0Problems(after), []);
  assert.deepEqual(aiPaths(after), []);
});

test('the plan only asks about what changed: unchanged relationships are reused from the check', async () => {
  const { content, masters } = cascade();
  const ai = fakeAi();
  const first = await check(content, masters, ai);
  const askedByCheck = ai.asked.length;
  await buildWholePlan({ content, masters, result: first, options: { ...options, transport: ai.transport } });
  const askedByPlan = ai.asked.slice(askedByCheck);
  assert.ok(askedByPlan.length > 0 && askedByPlan.length < askedByCheck / 4, `the plan asked ${askedByPlan.length} of ${askedByCheck}`);
  assert.ok(askedByPlan.every(id => id.startsWith('row0-') || id === 'description-plan'), 'only week 1 changed (and the description, which is judged against all the weekly contents)');
});

test('a field flagged by several relationships gets ONE rewrite for all of them (no fix-one-break-the-other)', async () => {
  const { content, masters } = twoIlos();
  const ai = fakeAi();
  const first = await check(content, masters, ai);
  assert.deepEqual(aiPaths(first), ['plan[0].activities']);
  // Without the plan: the check's draft fits one ILO, and the other relationship still fails after applying it.
  const control = await check(applySuggestions(content, first), masters, fakeAi());
  assert.equal(row0Problems(control).length, 1);
  const plan = await buildWholePlan({ content, masters, result: first, options: { ...options, transport: ai.transport } });
  assert.equal(ai.rewrites.length, 1, 'one combined rewrite was asked for');
  assert.deepEqual(plan.changes.map(c => [c.path, c.proposedValue, c.combinedRewrite, c.verification]), [['plan[0].activities', 'Lecture #alpha #beta', true, STATUS.VERIFIED]]);
  assert.match(plan.changes[0].explanation, /One rewrite was written for all 2 relationships/);
  const after = await check(applyChanges(content, plan.changes), masters, fakeAi());
  assert.deepEqual(row0Problems(after), []);
});

test('a field the author rejected last time is kept: the plan does not rewrite it', async () => {
  const { content, masters } = cascade();
  const ai = fakeAi();
  const history = { attempts: {}, last: {}, previous: {}, rejected: ['plan[0].ilos[0].text'] };
  const first = await check(content, masters, ai, { history });
  assert.equal(await buildWholePlan({ content, masters, result: first, options: { ...options, transport: ai.transport, history } }), null);
});

test('when the revised copy cannot be checked (no budget left), the plan says NOT_CHECKED and claims nothing', async () => {
  const { content, masters } = cascade();
  const ai = fakeAi();
  const first = await check(content, masters, ai);
  const plan = await buildWholePlan({ content, masters, result: first, options: { ...options, transport: ai.transport, env: { ...env, SYLLABUS_CHECK_PLAN_MAX_REQUESTS: '0' } } });
  assert.equal(plan.status, STATUS.NOT_CHECKED);
  assert.ok(plan.changes.every(c => c.verification === STATUS.NOT_CHECKED));
  assert.deepEqual(plan.unresolvedIssues.map(u => u.code), ['verification_incomplete']);
});

test('a plan cut short (one round) does not claim success: the relationships the ILO change broke are reported as UNRESOLVED', async () => {
  const { content, masters } = cascade();
  const ai = fakeAi();
  const first = await check(content, masters, ai);
  const plan = await buildWholePlan({ content, masters, result: first, options: { ...options, transport: ai.transport, env: { ...env, SYLLABUS_CHECK_PLAN_MAX_ROUNDS: '1' } } });
  assert.equal(plan.status, STATUS.UNRESOLVED);
  assert.deepEqual(plan.validation.regressions.map(r => r.id).sort(), ['row0-ilo0-activity', 'row0-ilo0-assessment', 'row0-ilo0-content']);
  assert.equal(plan.changes[0].verification, STATUS.UNRESOLVED);
  assert.ok(plan.unresolvedIssues.some(u => u.code === 'round_limit'));
});

test('the check service attaches the plan as hybrid.improvementPlan when SYLLABUS_CHECK_WHOLE_PLAN=on, and only then', async (t) => {
  const h = require('./vpaa-conformance/harness'), svc = require('../compliance/service'), repo = require('./repository');
  const { createMemoryDb } = require('./vpaa-conformance/memdb');
  h.liveGuard(t);
  const { content, masters } = cascade();
  t.mock.method(repo, 'mastersFor', async () => masters);
  const checkWith = async (over) => {
    const db = createMemoryDb({ syllabus: { content: JSON.stringify(content) } });
    return svc.checkHybrid(db, content, { syllabusId: 100, env: { ...env, ...over }, transport: fakeAi().transport, linkChecker: options.linkChecker, useAi: true });
  };
  const off = await checkWith({});
  assert.equal(off.hybrid.improvementPlan, undefined);
  const on = await checkWith({ SYLLABUS_CHECK_WHOLE_PLAN: 'on' });
  assert.equal(on.hybrid.improvementPlan?.kind, 'whole-syllabus', on.hybrid.improvementPlanError);
  assert.equal(on.hybrid.improvementPlan.status, STATUS.VERIFIED);
  assert.equal(on.hybrid.improvementPlan.sourceHash, svc.hashOf(content), 'the apply route accepts it for the syllabus as stored');
  assert.deepEqual(on.hybrid.deductions, off.hybrid.deductions, 'the official result is unchanged');
});

test('a CLO that is only partly aligned is kept as written (listed for review), and the later fields are fitted to it', async () => {
  const { content, masters } = cascade();
  content.clos[0].statement = 'Design combinational logic circuits #c1 #partial';
  const ai = fakeAi();
  const first = await check(content, masters, ai);
  assert.ok(aiPaths(first).includes('clos[0].statement'));
  assert.ok(!aiPaths(first).includes('plan[0].ilos[0].text'), 'the ILO waits behind the CLO in the check itself');
  const plan = await buildWholePlan({ content, masters, result: first, options: { ...options, transport: ai.transport } });
  assert.ok(!plan.changes.some(c => c.path === 'clos[0].statement'), 'the CLO is not rewritten');
  assert.deepEqual(plan.preservations.map(p => p.path), ['clos[0].statement']);
  assert.match(plan.preservations[0].reason, /only partly aligned/);
  assert.deepEqual(plan.changes.map(c => [c.path, c.proposedValue]).filter(([p]) => p.startsWith('plan[0]')),
    [['plan[0].ilos[0].text', 'Explain topic 1 #c1'], ['plan[0].contents', 'Topic 1 #c1'], ['plan[0].activities', 'Lecture #c1'], ['plan[0].tasks', '- Quiz #c1']]);
});

test('a CLO that is clearly NOT_ALIGNED is still rewritten by the plan', async () => {
  const { content, masters } = cascade();
  content.clos[0].statement = 'Design combinational logic circuits #c1 #notaligned';
  const ai = fakeAi();
  const first = await check(content, masters, ai);
  const plan = await buildWholePlan({ content, masters, result: first, options: { ...options, transport: ai.transport } });
  assert.ok(plan.changes.some(c => c.path === 'clos[0].statement'));
  assert.deepEqual(plan.preservations, []);
});

test('a check after applying the plan reuses the plan\'s verified answers: nothing is judged again and nothing new is recommended', async () => {
  const { reusableJudgements } = require('./repository');
  const { content, masters } = cascade();
  const ai = fakeAi();
  const first = await check(content, masters, ai);
  const plan = await buildWholePlan({ content, masters, result: first, options: { ...options, transport: ai.transport } });
  assert.ok(plan.verifiedJudgements.length > 0 && plan.verifiedJudgements.every(j => j.key));
  // The stored report of that check carries the plan, as the service saves it.
  const stored = { ...first, hybrid: { ...first.hybrid, improvementPlan: plan } };
  const db = { query: async () => [[{ report_json: JSON.stringify(stored) }]] };
  const reuse = await reusableJudgements(db, 1);
  const recheckAi = fakeAi();
  const after = await check(applyChanges(content, plan.changes), masters, recheckAi, { reuse });
  assert.deepEqual(recheckAi.asked, [], 'every relationship of the revised syllabus was already verified');
  assert.deepEqual(aiPaths(after), []);
  assert.deepEqual(row0Problems(after), []);
});

test('a syllabus with nothing to fix gets no plan, and the official result of the check is never changed by building one', async () => {
  const { content, masters } = sample();
  const ai = fakeAi();
  const clean = await check(content, masters, ai);
  assert.equal(await buildWholePlan({ content, masters, result: clean, options: { ...options, transport: ai.transport } }), null);
  const c = cascade(), first = await check(c.content, c.masters, ai);
  const snapshot = JSON.stringify([first.hybrid.deductions, first.findings, first.hybrid.suggestions, first.score]);
  await buildWholePlan({ content: c.content, masters: c.masters, result: first, options: { ...options, transport: ai.transport } });
  assert.equal(JSON.stringify([first.hybrid.deductions, first.findings, first.hybrid.suggestions, first.score]), snapshot);
});
