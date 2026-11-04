const test = require('node:test');
const assert = require('node:assert/strict');
const { align, pairsOf, pairKey, promptVersionOf, courseOf, courseKeyOf, NEMOTRON_FREE } = require('./gemini');
const { reusableJudgements } = require('./repository');
const { sample } = require('./fixtures');

const env = (model = NEMOTRON_FREE) => ({ SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: model });
const verdict = pair => ({ id: pair.id, label: 'PARTIALLY_ALIGNED', explanation: 'Partly supports it.', sourceQuote: pair.source.slice(0, 10), targetQuote: pair.target.slice(0, 10), sourceBloom: 'Apply', targetBloom: 'Apply', draft: 'A better version.' });
// A transport that answers every pair it is given and records which pairs were actually sent.
const recorder = () => {
  const sent = [];
  const transport = async (url, request) => {
    const pairs = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
    sent.push(...pairs.map(p => p.id));
    return { ok: true, json: async () => ({ model: JSON.parse(request.body).model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(verdict) }) } }] }) };
  };
  return { sent, transport };
};
const earlierOf = result => new Map(result.judgements.map(j => [j.key, j]));

test('a second check with nothing changed asks the AI nothing and gives the same result', async () => {
  const { content, masters } = sample();
  const first = recorder();
  const one = await align(content, masters, { env: env(), transport: first.transport });
  assert.ok(first.sent.length > 0);
  assert.ok(one.judgements.every(j => typeof j.key === 'string' && j.key.length === 64), 'every judgement carries its fingerprint');
  const second = recorder();
  const two = await align(content, masters, { env: env(), transport: second.transport, reuse: earlierOf(one) });
  assert.equal(second.sent.length, 0, 'no call was made');
  assert.deepEqual(two.reuse, { reused: one.judgements.length, asked: 0, requests: 0 });
  assert.equal(two.status, one.status);
  assert.deepEqual(two.judgements.map(j => [j.id, j.label, j.draft]), one.judgements.map(j => [j.id, j.label, j.draft]));
});

test('after an edit, only the relationships whose text changed are asked again', async () => {
  const { content, masters } = sample();
  const all = recorder();
  const one = await align(content, masters, { env: env(), transport: all.transport });
  const row = content.plan.findIndex(r => r.kind !== 'exam');
  content.plan[row].activities = 'Students build and demonstrate a tested program in pairs.'; // what applying a recommendation does
  const next = recorder();
  const two = await align(content, masters, { env: env(), transport: next.transport, reuse: earlierOf(one) });
  assert.ok(next.sent.length > 0 && next.sent.length < all.sent.length, `asked ${next.sent.length} of ${all.sent.length}`);
  assert.ok(next.sent.every(id => id.startsWith(`row${row}-`)), 'only relationships that involve the edited lesson were asked: ' + next.sent.join(', '));
  assert.equal(two.reuse.reused + two.reuse.asked, one.judgements.length);
  assert.equal(two.judgements.length, one.judgements.length, 'every relationship still has a judgement');
});

test('a different model, provider or prompt version is a different question and is never reused', async () => {
  const { content, masters } = sample();
  const one = await align(content, masters, { env: env(), transport: recorder().transport });
  const other = recorder();
  const two = await align(content, masters, { env: env('google/gemini-2.5-flash'), transport: other.transport, reuse: earlierOf(one) });
  assert.equal(two.reuse.reused, 0);
  assert.equal(other.sent.length, one.judgements.length);
  const pair = pairsOf(content, masters)[0];
  assert.notEqual(pairKey(pair, 'openrouter', 'm', 'v1'), pairKey(pair, 'openrouter', 'm', 'v2'));
  assert.notEqual(pairKey(pair, 'openrouter', 'm', 'v1'), pairKey(pair, 'gemini', 'm', 'v1'));
  assert.notEqual(pairKey(pair, 'openrouter', 'm', 'v1'), pairKey({ ...pair, target: pair.target + '!' }, 'openrouter', 'm', 'v1'));
  assert.notEqual(pairKey(pair, 'openrouter', 'm', 'v1'), pairKey({ ...pair, source: pair.source + '!' }, 'openrouter', 'm', 'v1'));
  assert.equal(promptVersionOf(NEMOTRON_FREE), 'alignment-nemotron-10');
});

test('the same text in a new place keeps its judgement but takes the new id, path and target', async () => {
  const { content, masters } = sample();
  const pair = pairsOf(content, masters)[0];
  const key = pairKey(pair, 'openrouter', NEMOTRON_FREE, promptVersionOf(NEMOTRON_FREE), courseKeyOf(courseOf(content)));
  const stale = { id: 'old-id', type: 'OLD', path: 'old.path', targetPath: 'old.target', key, label: 'NOT_ALIGNED', explanation: 'Earlier verdict.', sourceQuote: '', targetQuote: '', sourceBloom: 'N/A', targetBloom: 'N/A', draft: 'Earlier draft.' };
  const { sent, transport } = recorder();
  const result = await align(content, masters, { env: env(), transport, reuse: new Map([[key, stale]]) });
  const mine = result.judgements.find(j => j.id === pair.id);
  assert.equal(mine.label, 'NOT_ALIGNED');
  assert.equal(mine.draft, 'Earlier draft.');
  assert.deepEqual([mine.type, mine.path, mine.targetPath], [pair.type, pair.path, pair.targetPath]);
  assert.equal(mine.reused, true);
  assert.ok(!sent.includes(pair.id), 'the reused relationship was not sent');
});

test('a failed batch keeps what was reused and what was verified, in order, and reports the right counts', async () => {
  const { content, masters } = sample();
  const one = await align(content, masters, { env: env(), transport: recorder().transport });
  const earlier = earlierOf(one);
  const row = content.plan.findIndex(r => r.kind !== 'exam');
  content.plan[row].tasks = 'A new written project with a rubric.';
  const result = await align(content, masters, { env: env(), transport: async () => ({ ok: false, status: 429 }), reuse: earlier });
  assert.equal(result.status, 'not_evaluated');
  assert.match(result.reason, /HTTP 429/);
  assert.equal(result.judgements.length, one.judgements.length, 'every requested relationship remains visible after a failed batch');
  assert.deepEqual(result.judgements.map(j => j.id), one.judgements.map(j => j.id), 'order is the pairs\' order');
  const reused = result.judgements.filter(j => j.reused);
  const missed = result.judgements.filter(j => !j.reused);
  assert.ok(reused.length > 0 && reused.every(j => !j.unverified), 'the unchanged relationships keep their verified judgments');
  assert.ok(missed.length > 0 && missed.every(j => j.unverified && j.label === 'INSUFFICIENT_EVIDENCE'), 'only changed relationships without provider responses are NOT_CHECKED');
});

test('earlier judgements come only from this syllabus, newest first, and only verified ones', async () => {
  const report = judgements => ({ report_json: JSON.stringify({ hybrid: { alignment: { judgements } } }) });
  const db = { query: async (sql, params) => {
    assert.match(sql, /WHERE r\.syllabus_id = \?/);
    assert.deepEqual(params, [101, 3]);
    return [[
      report([{ key: 'a', label: 'ALIGNED', draft: '', n: 'newest' }, { key: 'b', label: 'INSUFFICIENT_EVIDENCE' }, { key: 'c', label: 'NOT_ALIGNED', unverified: true }, { label: 'ALIGNED' }]),
      report([{ key: 'a', label: 'NOT_ALIGNED', n: 'older' }, { key: 'd', label: 'PARTIALLY_ALIGNED' }]),
      { report_json: 'not json' },
    ]];
  } };
  const found = await reusableJudgements(db, 101);
  assert.deepEqual([...found.keys()].sort(), ['a', 'd']);
  assert.equal(found.get('a').n, 'newest', 'the latest check wins');
});

test('a problem reading the history never fails a check: nothing is reused', async () => {
  assert.equal((await reusableJudgements({ query: async () => { throw Object.assign(Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); } }, 1)).size, 0);
  assert.equal((await reusableJudgements({ query: async () => { throw Error('connection lost'); } }, 1)).size, 0);
});

test('batches are larger and run a few at a time, in the order of the pairs, and the settings are bounded', async () => {
  const { batchSizeOf, concurrencyOf } = require('./gemini');
  assert.equal(batchSizeOf(NEMOTRON_FREE, {}), 8);
  assert.equal(batchSizeOf('google/gemini-2.5-flash', {}), 12);
  assert.equal(batchSizeOf(NEMOTRON_FREE, { SYLLABUS_CHECK_AI_BATCH: '4' }), 4);
  for (const bad of ['0', '99', 'abc', '']) assert.equal(batchSizeOf(NEMOTRON_FREE, { SYLLABUS_CHECK_AI_BATCH: bad }), 8, bad);
  assert.equal(concurrencyOf({}), 3);
  assert.equal(concurrencyOf({ SYLLABUS_CHECK_AI_CONCURRENCY: '1' }), 1);
  assert.equal(concurrencyOf({ SYLLABUS_CHECK_AI_CONCURRENCY: '50' }), 3);

  const { content, masters } = sample();
  let inFlight = 0, peak = 0, calls = 0;
  const transport = async (url, request) => {
    const pairs = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
    calls++; inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(resolve => setTimeout(resolve, 5 * (calls % 3 + 1))); // answers come back out of order
    inFlight--;
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(verdict) }) } }] }) };
  };
  const result = await align(content, masters, { env: env(), transport });
  const total = pairsOf(content, masters).length;
  assert.equal(calls, Math.ceil(total / 8), 'one call per eight relationships instead of per four');
  assert.ok(peak > 1 && peak <= 3, `up to three calls in flight at once (saw ${peak})`);
  assert.deepEqual(result.judgements.map(j => j.id), pairsOf(content, masters).map(p => p.id), 'judgements stay in the order of the pairs');
  assert.equal(result.status, 'completed');
});

test('the prompt asks for short answers on aligned items, and a draft is only kept for a problem', () => {
  const { PROMPT, validate } = require('./gemini');
  assert.match(PROMPT, /Keep ALIGNED answers short[^]*one short sentence/);
  assert.match(PROMPT, /empty draft/);
  assert.match(PROMPT, /lists EVERY gap/);
  const { content, masters } = sample();
  const pairs = pairsOf(content, masters).slice(0, 3);
  const reply = (pair, label) => ({ id: pair.id, label, explanation: 'Because.', sourceQuote: pair.source.slice(0, 8), targetQuote: pair.target.slice(0, 8), sourceBloom: 'Apply', targetBloom: 'Apply', draft: 'A stray draft.' });
  const out = validate({ judgements: [reply(pairs[0], 'ALIGNED'), reply(pairs[1], 'INSUFFICIENT_EVIDENCE'), reply(pairs[2], 'PARTIALLY_ALIGNED')] }, pairs);
  assert.deepEqual(out.map(j => j.draft), ['', '', 'A stray draft.']);
});

test('a lone relationship whose answer fails twice is accepted on the third attempt; after that it is reported with the reason', async () => {
  const { content, masters } = sample();
  const target = pairsOf(content, masters).find(p => p.type === 'CLO-PO').id; // a scored relationship: an advisory one never holds a check open
  const run = async failures => {
    let seen = 0;
    const transport = async (url, request) => {
      const pairs = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
      const mine = pairs.length === 1 && pairs[0].id === target;
      const broken = pairs.some(p => p.id === target) && (pairs.length > 1 || seen++ < failures); // the batch always fails once; then the lone pair fails `failures` times
      return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: broken ? 'not json' : JSON.stringify({ judgements: pairs.map(verdict) }) } }] }) };
    };
    return align(content, masters, { env: env(), transport });
  };
  const recovered = await run(2); // batch fails, then the first attempt alone fails, the second fails, the third passes
  assert.equal(recovered.judgements.find(j => j.id === target).unverified, undefined);
  assert.equal(recovered.status, 'completed');
  const lost = await run(10);
  const bad = lost.judgements.find(j => j.id === target);
  assert.equal(bad.unverified, true);
  assert.equal(bad.label, 'INSUFFICIENT_EVIDENCE');
  assert.match(bad.failure, /JSON|Unexpected|token/i, 'the reason is kept');
  assert.equal(lost.status, 'not_evaluated');
});

test('the prompt reserves INSUFFICIENT_EVIDENCE for missing text; a mismatch is partly or not aligned', () => {
  const { PROMPT } = require('./gemini');
  assert.match(PROMPT, /Use INSUFFICIENT_EVIDENCE only when the supplied source or target text is missing, empty or unreadable/);
  assert.match(PROMPT, /that is PARTIALLY_ALIGNED or NOT_ALIGNED, never INSUFFICIENT_EVIDENCE/);
  assert.doesNotMatch(PROMPT, /Missing information is INSUFFICIENT_EVIDENCE/);
});

test('a batch with one bad quote keeps its verified answers and only the bad relationship is asked again', async () => {
  const { content, masters } = sample();
  const target = pairsOf(content, masters).find(p => p.type === 'CLO-PO').id; // a scored relationship: an advisory one never holds a check open
  const sizes = [];
  let spoiled = false;
  const alone = []; // ids sent by themselves (a last, odd-sized batch can also hold one relationship)
  const transport = async (url, request) => {
    const pairs = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
    sizes.push(pairs.length);
    if (pairs.length === 1) alone.push(pairs[0].id);
    const judgements = pairs.map(verdict);
    if (!spoiled && pairs.some(p => p.id === target)) { spoiled = true; judgements.find(j => j.id === target).sourceQuote = 'text that is not in the source'; }
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements }) } }] }) };
  };
  const result = await align(content, masters, { env: env(), transport });
  assert.equal(result.status, 'completed');
  assert.ok(result.judgements.every(j => !j.unverified));
  assert.equal(alone.filter(id => id === target).length, 1, 'the bad relationship was asked alone, once');
  assert.equal(result.reuse.requests, sizes.length, 'the check reports how many provider calls it made');
  assert.equal(sizes.reduce((a, b) => a + b, 0), result.judgements.length + 1, 'every relationship was sent once, and the bad one a second time');
});

test('every request carries the course, and a changed course title or description is a different question', async () => {
  const { content, masters } = sample();
  const seen = [];
  const transport = async (url, request) => {
    const body = JSON.parse(JSON.parse(request.body).messages[1].content);
    seen.push(body.course);
    return { ok: true, json: async () => ({ model: JSON.parse(request.body).model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: body.document_data.map(verdict) }) } }] }) };
  };
  const first = await align(content, masters, { env: env(), transport });
  assert.ok(seen.length > 0);
  for (const course of seen) {
    assert.equal(course.code, content.meta.code);
    assert.equal(course.title, content.meta.title);
    assert.equal(course.program, content.meta.program);
    assert.ok(course.description.length > 0 && course.description.length <= 1500);
    assert.deepEqual(course.outcomes, content.clos.map(c => c.statement));
  }
  const renamed = structuredClone(content);
  renamed.meta.title = 'A different course';
  const again = recorder();
  await align(renamed, masters, { env: env(), transport: again.transport, reuse: earlierOf(first) });
  assert.ok(again.sent.length > 0, 'a new course title asks again');
  const edited = structuredClone(content);
  edited.clos[0].statement += ' (edited)';
  const afterEdit = recorder();
  await align(edited, masters, { env: env(), transport: afterEdit.transport, reuse: earlierOf(first) });
  assert.ok(afterEdit.sent.length > 0 && afterEdit.sent.length < pairsOf(edited, masters).length, 'editing one CLO asks only about what it touches');
});
