// When CLO relationships are sent without the course description (SYLLABUS_CHECK_CLO_DESCRIPTION=off, set by the shared service for the legacy run while
// Policy V2 is on, or by an operator; rule M14), a request must never mix a CLO relationship with a relationship that reads the description. Before, such a
// mixed request had the description stripped for all of its relationships, so Content-course or Description-plan was judged without the text it is about,
// and its answer was stored under a reuse key that said the description had been sent. The default (switch unset: the description travels with every
// request, VPAA-DESCRIPTION-EXCLUSION-DEFAULT) is unchanged. Scripted transport only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');

// Large batches, so a CLO relationship and a description relationship would fall into the same request unless they are kept apart.
const BASE_ENV = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_AI_BATCH: '24' };
const base = { useAi: true, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) };
const CLO = /^(Course-CLO|CLO-set|CLO-PO|CLO-EGA|CLO-anyPO|CLO-anyEGA|ILO-CLO|ILO-anyCLO|CLO-coverage|CLO-classification)$/;
const READS_DESCRIPTION = /^(Content-course|Ref-relevance|Title-description|Description-plan)$/;

async function requestsOf(env) {
  const { content, masters } = sample();
  const requests = [];
  const transport = async (url, req) => {
    const message = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text);
    requests.push({ description: message.course.description, types: message.document_data.map((p) => p.type) });
    const answer = (p) => ({ id: p.id, label: 'ALIGNED', explanation: 'ok', sourceQuote: p.source.slice(0, 10), targetQuote: p.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '' });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: message.document_data.map(answer) }) }] } }] }) };
  };
  const result = await run(content, masters, { ...base, env: { ...BASE_ENV, ...env }, transport });
  return { requests, result };
}

for (const [name, env] of [['Stage B off', {}], ['Stage A and B on', { SYLLABUS_CHECK_STAGE_A: 'on', SYLLABUS_CHECK_STAGE_B: 'on' }]]) {
  test(`switch off, ${name}: no CLO request carries the description, the description relationships get it, and the two never share a request`, async () => {
    const { requests, result } = await requestsOf({ SYLLABUS_CHECK_CLO_DESCRIPTION: 'off', ...env });
    assert.equal(result.hybrid.alignment.status, 'completed');
    assert.ok(requests.some((r) => r.types.some((t) => CLO.test(t))), 'CLO relationships were asked');
    assert.ok(requests.some((r) => r.types.some((t) => READS_DESCRIPTION.test(t))), 'description relationships were asked');
    for (const r of requests) {
      assert.ok(!(r.types.some((t) => CLO.test(t)) && r.types.some((t) => READS_DESCRIPTION.test(t))), `mixed request: ${r.types.join(', ')}`);
      if (r.types.some((t) => CLO.test(t))) assert.equal(r.description, '', `a CLO request carried the description: ${r.types.join(', ')}`);
      if (r.types.some((t) => READS_DESCRIPTION.test(t))) assert.ok(r.description.length > 0, `a description request was sent without it: ${r.types.join(', ')}`);
    }
  });
}

test('switch unset (the default): unchanged, the description travels with the CLO relationships', async () => {
  const { requests } = await requestsOf({});
  assert.ok(requests.some((r) => r.types.some((t) => CLO.test(t)) && r.description.length > 0));
});

test('the score, the findings and the relationships asked do not depend on how the requests are cut', async () => {
  const off = await requestsOf({ SYLLABUS_CHECK_CLO_DESCRIPTION: 'off', SYLLABUS_CHECK_STAGE_B: 'on' });
  const unset = await requestsOf({ SYLLABUS_CHECK_STAGE_B: 'on' });
  assert.deepEqual(off.result.hybrid.deductions, unset.result.hybrid.deductions);
  assert.equal(off.result.overall, unset.result.overall);
  const ids = (r) => r.result.hybrid.alignment.judgements.map((j) => j.id).sort();
  assert.deepEqual(ids(off), ids(unset));
});
