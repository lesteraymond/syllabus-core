// Round 2 Stage A, Fix 1: a sound CLO tagged to a PO / EGA it does not develop gets MAPPING advice, never a rewrite toward the wrong tag.
process.env.SYLLABUS_CHECK_STAGE_A = 'on';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { mappingAdviceOf } = require('./mapping');

const base = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_STAGE_A: 'on' } };
// CLO 1 is tagged to PO 1 and 2 (fixture) and every tag fails; the whole-list check says it fits PO 3 (or whatever `anyText` says).
function scenario({ anyText = 'PO 3 fits: the CLO develops what Program outcome 3 asks.', quote = 'Program outcome 3', tagLabel = 'NOT_ALIGNED', anyLabel = 'ALIGNED' } = {}) {
  const { content, masters } = sample();
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const answer = pair => {
      const own = /^clo0-/.test(pair.id);
      const label = !own ? 'ALIGNED' : /^clo0-anypo$/.test(pair.id) ? anyLabel : /^clo0-po\d/.test(pair.id) ? tagLabel : 'ALIGNED';
      const isAny = /^clo0-anypo$/.test(pair.id);
      return { id: pair.id, label, explanation: isAny ? anyText : 'The tag does not fit; the CLO is a sound outcome.', sourceQuote: isAny ? quote : pair.source.slice(0, 12), targetQuote: pair.target.slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Apply', draft: label === 'ALIGNED' ? '' : pair.target };
    };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return run(content, masters, { ...base, transport }).then(result => ({ result, content, masters }));
}

test('a sound CLO whose PO tags all fail but which fits another approved PO: the advice names that PO, the CLO is not rewritten and no tag is changed', async () => {
  const { result, content } = await scenario();
  const advice = result.hybrid.mappingAdvice;
  assert.equal(advice.length, 1);
  assert.deepEqual({ type: advice[0].type, path: advice[0].path, current: advice[0].current, suggested: advice[0].suggested, text: advice[0].suggestedText }, { type: 'PO', path: 'clos[0].pos', current: [1, 2], suggested: 3, text: 'Program outcome 3' });
  assert.ok(!result.hybrid.suggestions.some(s => s.path === 'clos[0].statement'), 'the CLO text is not rewritten to fit the wrong tag');
  assert.ok(!result.hybrid.unresolved.some(u => u.path === 'clos[0].statement'));
  assert.deepEqual(content.clos[0].pos, [1, 2], 'the faculty mapping is untouched');
  const f = result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'mapping-advice');
  assert.equal(f.ruleId, 'CLO-06'); assert.equal(f.path, 'clos[0].pos'); assert.equal(f.status, 'NEEDS_REVIEW'); assert.equal(f.responsible, 'po_mapping'); assert.equal(f.requiresFacultyApproval, true);
  assert.match(f.recommendation, /tagging this CLO to PO 3 \(approved wording: "Program outcome 3"\) instead of PO 1, PO 2\. The CLO statement itself does not need to change/);
  assert.equal(f.verification, 'quotes_verified'); assert.equal(f.reference, 'Program outcome 3');
});
test('nothing is invented: a PO that is not in the approved list, a quote from another item, an already-tagged PO or an aligned tag give no advice', async () => {
  for (const options of [{ anyText: 'PO 99 fits.', quote: 'Program outcome 3' }, { anyText: 'PO 3 fits.', quote: 'Program outcome 4' }, { anyText: 'PO 2 fits.', quote: 'Program outcome 2' }, { tagLabel: 'ALIGNED' }, { anyLabel: 'NOT_ALIGNED' }]) {
    const { result } = await scenario(options);
    assert.deepEqual(result.hybrid.mappingAdvice, [], JSON.stringify(options));
  }
  assert.deepEqual(mappingAdviceOf({ clos: [] }, { pos: [] }, []), []);
});
test('the advice changes no score, deduction or gate, and does not exist while Stage A is off', async () => {
  const { result: on } = await scenario();
  const { content, masters } = sample();
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(p => ({ id: p.id, label: 'ALIGNED', explanation: 'Judged.', sourceQuote: p.source.slice(0, 12), targetQuote: p.target.slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' })) }) }] } }] }) };
  };
  const off = await run(content, masters, { ...base, env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' }, transport });
  assert.deepEqual(off.hybrid.mappingAdvice, []); assert.deepEqual(off.hybrid.stages, { a: false, b: false, b3: false, b4: false, c1: false, c2: false, d1: false, d2: false });
  assert.deepEqual(on.hybrid.deductions.filter(d => /clo0-po/.test(d.id)), [], 'tags that lose to a fitting PO cost nothing (existing group rule)');
});
