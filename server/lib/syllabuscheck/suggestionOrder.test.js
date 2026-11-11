const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { layerOf, readsOf, orderSuggestions, enabled } = require('./suggestionOrder');

// Top-down order of AI rewrites (suggestionOrder.js): a rewrite drafted against a field that the same check also rewrites waits for it, so that
// applying every recommendation never leaves one field fitted to the old text of another (the "fix one, another breaks" cycle).
const options = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' } };
const ILO = 'plan[0].ilos[0].text', ACTIVITIES = 'plan[0].activities', CONTENTS = 'plan[0].contents';

const scripted = (script) => {
  const asked = [];
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const answer = (p) => {
      asked.push(p);
      const v = { label: 'ALIGNED', explanation: 'Fits.', draft: '', ...(script(p) || {}) };
      return { id: p.id, label: v.label, explanation: v.explanation, sourceQuote: p.source.slice(0, 12), targetQuote: p.target.slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Apply', draft: v.label === 'ALIGNED' ? '' : (v.draft ?? 'A rewrite.') };
    };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return { transport, asked };
};
const check = (content, masters, script, extra = {}) => { const ai = scripted(script); return run(content, masters, { ...options, transport: ai.transport, ...extra, env: { ...options.env, ...(extra.env || {}) } }).then(result => ({ result, ai })); };
const paths = r => r.hybrid.suggestions.filter(s => s.source === 'ai').map(s => s.path).sort();
const waits = r => r.hybrid.unresolved.filter(u => u.reason === 'waits_for_upstream');

// Week 1: the ILO does not build its CLO, and the activity does not practise the ILO. Both get a draft in the same check.
const iloAndActivity = p => (p.id === 'row0-ilo0-clo:c1' ? { label: 'NOT_ALIGNED', draft: 'Apply the topic 1 method to build the CLO 1 skill' }
  : p.id === 'row0-ilo0-activity' ? { label: 'NOT_ALIGNED', draft: 'Guided practice of the old ILO' } : null);

test('fields follow one order: CLO, ILO, contents, activities, tasks, values, description', () => {
  assert.deepEqual(['clos[1].statement', 'plan[2].ilos[0].text', 'plan[2].contents', 'plan[2].activities', 'plan[2].tasks', 'plan[2].values', 'description'].map(layerOf), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(layerOf('refs'), null);
  assert.equal(layerOf('clos[0].pos'), null);
});

test('a relationship reads the field on the source side of its pair', () => {
  const { content } = sample();
  assert.deepEqual(readsOf({ id: 'row0-ilo0-clo:c1', type: 'ILO-CLO' }, content), ['clos[0].statement']);
  assert.deepEqual(readsOf({ id: 'row0-ilo0-activity', type: 'ILO-activity', path: ILO }, content), [ILO]);
  assert.deepEqual(readsOf({ id: 'row0-value', type: 'Module-value', path: 'plan[0].values', targetPath: 'plan[0].values' }, content), [ILO, CONTENTS, ACTIVITIES, 'plan[0].tasks']);
  assert.ok(readsOf({ id: 'description-plan', type: 'Description-plan' }, content).every(p => /^plan\[\d+\]\.contents$/.test(p)));
  assert.deepEqual(readsOf({ id: 'clo0-po1', type: 'CLO-PO' }, content), [], 'the approved POs are not a syllabus field');
});

test('a rewrite waits only for an EARLIER field that has its own offered rewrite; coded and declined ones never hold anything back', () => {
  const { content } = sample();
  const judgements = [{ id: 'row0-ilo0-clo:c1', type: 'ILO-CLO', path: ILO }, { id: 'row0-ilo0-activity', type: 'ILO-activity', path: ILO }, { id: 'row0-ilo0-contentilo', type: 'Content-ILO', path: ILO }];
  const ilo = { id: 'SEM:row0-ilo0-clo:c1', path: ILO, source: 'ai' }, activity = { id: 'SEM:row0-ilo0-activity', path: ACTIVITIES, source: 'ai' };
  const out = orderSuggestions({ offered: [ilo, activity], judgements, content });
  assert.deepEqual(out.offered, [ilo]);
  assert.deepEqual(out.waiting, [{ suggestion: activity, waitsFor: [ILO] }]);
  // The author rejected the ILO rewrite last time: the ILO stays as written, so the activity is fitted to it now.
  assert.deepEqual(orderSuggestions({ offered: [ilo, activity], judgements, content, rejectedPaths: [ILO] }).waiting, []);
  // A coded (deterministic) suggestion is never held back.
  const coded = { id: 'VALUE:plan[0].values', path: 'plan[0].values', source: 'rule' };
  assert.deepEqual(orderSuggestions({ offered: [ilo, coded], judgements, content }).offered, [ilo, coded]);
  // Stage B's Content-ILO reads the week's content, a LATER field: it does not wait for a content rewrite (no cycle, nothing deadlocks).
  const iloFromContent = { id: 'SEM:row0-ilo0-contentilo', path: ILO, source: 'ai' }, contentRewrite = { id: 'SEM:x', path: CONTENTS, source: 'ai' };
  assert.deepEqual(orderSuggestions({ offered: [iloFromContent, contentRewrite], judgements, content }).waiting, []);
});

test('on by default; SYLLABUS_CHECK_SUGGESTION_ORDER=off turns it off', () => {
  assert.equal(enabled({}), true);
  assert.equal(enabled({ SYLLABUS_CHECK_SUGGESTION_ORDER: 'off' }), false);
  assert.equal(enabled({ SYLLABUS_CHECK_SUGGESTION_ORDER: 'OFF ' }), false);
});

test('an activity drafted against an ILO that is rewritten in the same check waits; findings and points are unchanged', async () => {
  const { content, masters } = sample();
  const { result: on } = await check(structuredClone(content), masters, iloAndActivity);
  const { result: off } = await check(structuredClone(content), masters, iloAndActivity, { env: { SYLLABUS_CHECK_SUGGESTION_ORDER: 'off' } });
  assert.deepEqual(paths(off), [ACTIVITIES, ILO].sort(), 'before: both rewrites at once, the activity fitted to the old ILO');
  assert.deepEqual(paths(on), [ILO], 'now: only the earlier field');
  const [w] = waits(on);
  assert.equal(w.path, ACTIVITIES); assert.deepEqual(w.waitsFor, [ILO]); assert.equal(w.status, 'WAITING');
  assert.deepEqual(w.relationships, ['row0-ilo0-activity']);
  // Display only: the same findings, the same deductions, the same score.
  assert.deepEqual(on.hybrid.deductions, off.hybrid.deductions);
  assert.deepEqual(on.findings.map(f => f.id), off.findings.map(f => f.id));
  assert.equal(on.hybrid.provisionalScore, off.hybrid.provisionalScore);
  // The verdict says why no rewrite is shown for the activity.
  const activityFinding = on.hybrid.verdict.findings.find(f => f.relationshipId === 'row0-ilo0-activity');
  assert.equal(activityFinding.withheld, 'waits_for_upstream');
  assert.equal(activityFinding.recommendation, null);
  assert.match(activityFinding.withheldNote, /waits for it/);
});

test('the author rejected the ILO rewrite last time: the activity rewrite is offered now, against the ILO as written', async () => {
  const { content, masters } = sample();
  const { result } = await check(content, masters, iloAndActivity, { history: { attempts: {}, last: {}, previous: {}, rejected: [ILO] } });
  assert.deepEqual(paths(result), [ACTIVITIES, ILO].sort());
  assert.deepEqual(waits(result), []);
});

test('the rounds converge: after the ILO is applied, the next check writes the activity against the NEW ILO', async () => {
  const { content, masters } = sample();
  const first = await check(structuredClone(content), masters, iloAndActivity);
  const iloRewrite = first.result.hybrid.suggestions.find(s => s.path === ILO);
  const revised = structuredClone(content);
  revised.plan[0].ilos[0].text = iloRewrite.replacement;
  // Second check: the revised ILO fits its CLO; the activity still does not fit the ILO, and its draft is written from the pair's source.
  const second = await check(revised, masters, p => (p.id === 'row0-ilo0-activity' ? { label: 'NOT_ALIGNED', draft: `Guided practice: ${p.source}` } : null));
  const activityPair = second.ai.asked.find(p => p.id === 'row0-ilo0-activity');
  assert.equal(activityPair.source, iloRewrite.replacement, 'the activity is judged against the revised ILO');
  assert.deepEqual(paths(second.result), [ACTIVITIES]);
  assert.match(second.result.hybrid.suggestions.find(s => s.path === ACTIVITIES).replacement, /CLO 1 skill/);
  assert.deepEqual(waits(second.result), []);
});

test('the course description waits while a week\'s contents are rewritten in the same check', async () => {
  const { content, masters } = sample();
  const script = p => (p.id === 'row0-ilo0-content' ? { label: 'NOT_ALIGNED', draft: 'Topic 1 explained with worked examples' }
    : p.id === 'description-plan' ? { label: 'PARTIALLY_ALIGNED', draft: 'A course about topics one to eighteen.' } : null);
  const { result } = await check(content, masters, script);
  assert.deepEqual(paths(result), [CONTENTS]);
  assert.deepEqual(waits(result).map(u => [u.path, u.waitsFor]), [['description', [CONTENTS]]]);
});
