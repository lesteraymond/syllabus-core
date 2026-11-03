// The provider guard (eval/providerGuard.js) that every paid evaluation sends its requests through. Every fetch here is a fake: no test reaches a provider.
// Stage E.4 regression cases 12-14 (request cap, cost ceiling, HTTP 401/402/403) and the rest of the guard's contract: retries count against the cap,
// the validation and timeout thresholds stop a run, the API key reaches no log or file, completed work is kept, and nothing reaches application data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGuard, closeLedger, OPENROUTER_CHAT, OPENROUTER_KEY, DATA_MODULES, loadedDataModules } = require('./eval/providerGuard');
const gemini = require('./gemini');
const { sample } = require('./fixtures');

test.afterEach(() => gemini.resetProviderBlock());
const MODEL = 'minimax/minimax-m3.1-flash', KEY = 'sk-or-v1-test-only-0123456789abcdef';
const PRICES = { prompt: 3e-7, completion: 1.2e-6, reasoning: 0, request: 0, cacheWrite: 0 };
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: KEY, OPENROUTER_MODEL: MODEL };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const answer = (content, usage = { prompt_tokens: 120, completion_tokens: 40, cost: 0.00008 }) => json(200, { id: 'gen-test', model: MODEL, provider: 'Fake', choices: [{ finish_reason: 'stop', message: { content } }], ...(usage ? { usage } : {}) });
// A chat request as requestOpenRouter makes it, small enough that its worst case is easy to state.
const chat = (ids = ['p1']) => ({ method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: 'system', content: 'test' }, { role: 'user', content: JSON.stringify({ course: null, document_data: ids.map(id => ({ id })) }) }] }) });
// A fake fetch that records every call and answers with reply(n, url, init).
function fakeFetch(reply = () => answer('{"judgements":[]}')) {
  const calls = [];
  return { calls, send: async (url, init) => { calls.push({ url, init }); return reply(calls.length, url, init); } };
}
const guardOf = (send, { prices = PRICES, ...options } = {}) => { const guard = createGuard({ fetch: send, maxRequests: 10, maxCost: 1, secrets: [KEY], ...options }); if (prices) guard.setPrices(prices); return guard; };
const worstOf = body => guardOf(async () => null).worstCase(body).dollars;
const tempFile = name => path.join(os.tmpdir(), `provider-guard-${name}-${process.pid}-${Date.now()}.json`);

// Four real relationships, and a model whose reply is never readable JSON: it names no relationship (invalid_json), so both retry policies keep
// asking, in smaller groups, until the guard stops them. (Since Stage E.5 an empty list of judgements is corrected once and then stops by itself, with
// no guard needed: stage-e5.test.js.)
const { content, masters } = sample();
const pairs = gemini.pairsOf(content, masters).slice(0, 4);
const requestThrough = guard => (batch, options) => gemini.requestOpenRouter(batch, { ...options, env, transport: guard.fetch });

test('regression 12: the request cap is checked before every HTTP call, retries included, under both retry policies', async () => {
  for (const halve of [true, false]) {
    const { send, calls } = fakeFetch(() => answer('{"judgements": ['));
    const guard = guardOf(send, { maxRequests: 4 });
    await assert.rejects(gemini.judgeBatch(requestThrough(guard), pairs, { halve }), error => error.refused === true && !error.unverified);
    assert.equal(calls.length, 4, `${halve ? 'staged' : 'legacy'} retries: exactly the cap is sent`);
    assert.equal(guard.ledger.requests, 4);
    assert.match(guard.stopped(), /request cap reached \(4 provider requests\)/);
    await assert.rejects(guard.fetch(OPENROUTER_CHAT, chat()), error => error.refused);
    assert.equal(calls.length, 4, 'nothing is sent once the cap is reached');
  }
});

test('regression 13: the cost ceiling is checked against the worst case BEFORE each paid request, and requests in flight hold their reservation', async () => {
  const w = worstOf(chat().body);
  assert.ok(Math.abs(w - ((Buffer.byteLength(chat().body) + 256) * PRICES.prompt + 1000 * PRICES.completion)) < 1e-15, 'worst case = every byte (+256) at the input price + max_tokens at the output price');
  // No usage in the answer: each request is charged its worst case, so the third would pass the ceiling and is never sent.
  const { send, calls } = fakeFetch(() => answer('{}', null));
  const guard = guardOf(send, { maxCost: 2.5 * w });
  await guard.fetch(OPENROUTER_CHAT, chat());
  await guard.fetch(OPENROUTER_CHAT, chat());
  await assert.rejects(guard.fetch(OPENROUTER_CHAT, chat()), error => error.refused && /cost cap/.test(error.message));
  assert.equal(calls.length, 2);
  assert.ok(guard.ledger.charged <= 2.5 * w);
  // Two requests at once: the first one's worst case is reserved while it is out, so the second cannot overrun the ceiling.
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const slow = fakeFetch(async () => { await gate; return answer('{}'); });
  const both = guardOf(slow.send, { maxCost: 1.5 * w });
  const first = both.fetch(OPENROUTER_CHAT, chat());
  await assert.rejects(both.fetch(OPENROUTER_CHAT, chat()), error => error.refused && /cost cap/.test(error.message));
  release();
  assert.equal((await first).status, 200);
  assert.equal(slow.calls.length, 1);
  // A charge above the worst case means the price assumption broke: the run stops.
  const dear = guardOf(fakeFetch(() => answer('{}', { prompt_tokens: 100, completion_tokens: 10, cost: 5 })).send, { maxCost: 100 });
  await dear.fetch(OPENROUTER_CHAT, chat());
  assert.match(dear.stopped(), /price assumption no longer holds/);
});

test('regression 14: HTTP 401, 402 and 403 stop the run at once; the checker does not retry and nothing more is sent', async () => {
  for (const status of [401, 402, 403]) {
    const { send, calls } = fakeFetch(() => json(status, { error: { message: `refused for ${KEY}` } }));
    const guard = guardOf(send);
    await assert.rejects(gemini.judgeBatch(requestThrough(guard), pairs, { halve: true }), error => /OpenRouter HTTP/.test(error.message) && !error.message.includes(KEY));
    assert.equal(calls.length, 1, `HTTP ${status}: one request, no retry`);
    assert.match(guard.stopped(), new RegExp(`HTTP ${status} \\(credits, key or access\\)`));
    await assert.rejects(guard.fetch(OPENROUTER_CHAT, chat()), error => error.refused);
    assert.equal(calls.length, 1, `HTTP ${status}: nothing is sent after the stop`);
  }
  // Any other refusal of a model request (the request format or routing) would repeat for every request: it stops too. 429 is a transient.
  const bad = fakeFetch(() => json(400, { error: { message: 'bad request' } }));
  const refusedFormat = guardOf(bad.send);
  await refusedFormat.fetch(OPENROUTER_CHAT, chat());
  assert.match(refusedFormat.stopped(), /HTTP 400: the provider refused the request format or routing/);
});

test('the timeout threshold: rate limits, timeouts, network and server errors count, and the configured limit stops the run', async () => {
  const w = worstOf(chat().body);
  const { send, calls } = fakeFetch(() => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); });
  const guard = guardOf(send, { maxTransient: 3 });
  for (let i = 0; i < 3; i++) await assert.rejects(guard.fetch(OPENROUTER_CHAT, chat()), error => error.name === 'TimeoutError' && !error.refused);
  await assert.rejects(guard.fetch(OPENROUTER_CHAT, chat()), error => error.refused);
  assert.equal(calls.length, 3);
  assert.match(guard.stopped(), /3 rate limit\(s\), timeout\(s\), network or server error\(s\) \(the last: timeout\)/);
  assert.ok(Math.abs(guard.ledger.charged - 3 * w) < 1e-12, 'an abandoned request may still be billed: it is charged its worst case');
  assert.equal(gemini.classifyFailure(Object.assign(new Error('x'), { name: 'TimeoutError' })).kind, 'provider_timeout');
  // Rate limits and server errors count the same way.
  const busy = fakeFetch(n => json(n === 1 ? 429 : 503, { error: { message: 'busy' } }));
  const limited = guardOf(busy.send, { maxTransient: 2 });
  await limited.fetch(OPENROUTER_CHAT, chat());
  assert.equal(limited.stopped(), null);
  await limited.fetch(OPENROUTER_CHAT, chat());
  assert.match(limited.stopped(), /the last: HTTP 503/);
});

test('an answer cut off while it is read (the headers came first) is abandoned like one that never came: a timeout, charged its worst case', async () => {
  // The Stage E.4 Phase 1 re-run: OpenRouter answered 200 after 8 s, and the answer had not come when the request's 90 s timeout aborted the read.
  const cutOff = reason => () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"id":"gen-test","choices":[')); controller.error(reason); } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const { send, calls } = fakeFetch(cutOff(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })));
  const guard = guardOf(send, { maxTransient: 3 });
  // Through the checker it is a provider timeout, never an invalid answer.
  await assert.rejects(gemini.requestOpenRouter(pairs.slice(0, 1), { env, transport: guard.fetch }), error => error.name === 'TimeoutError' && !error.unverified && !error.refused && gemini.classifyFailure(error).kind === 'provider_timeout');
  const [entry] = guard.httpLog;
  assert.deepEqual([entry.status, entry.error, entry.content], [200, 'timeout', undefined]);
  assert.ok(entry.worst > 0 && entry.charged === entry.worst && guard.ledger.charged === entry.worst, 'it may still be billed: it is charged its worst case');
  assert.equal(guard.stopped(), null, 'one timeout does not stop the run');
  for (let i = 0; i < 2; i++) await assert.rejects(guard.fetch(OPENROUTER_CHAT, chat()), error => error.name === 'TimeoutError' && !error.refused);
  assert.match(guard.stopped(), /3 rate limit\(s\), timeout\(s\), network or server error\(s\) \(the last: timeout\)/);
  await assert.rejects(guard.fetch(OPENROUTER_CHAT, chat()), error => error.refused);
  assert.equal(calls.length, 3);
  // A connection that drops while the answer is read counts the same way, as a network error.
  const dropped = guardOf(fakeFetch(cutOff(new TypeError('terminated'))).send);
  await assert.rejects(dropped.fetch(OPENROUTER_CHAT, chat()), error => error.message === 'terminated');
  assert.deepEqual([dropped.httpLog[0].error, dropped.state.transient], ['network: terminated', 1]);
  // An answer that arrived whole but is not JSON was not cut off: its status decides, as before.
  const notJson = guardOf(fakeFetch(() => new Response('<html>not json</html>', { status: 200 })).send);
  assert.equal((await notJson.fetch(OPENROUTER_CHAT, chat())).status, 200);
  assert.deepEqual([notJson.httpLog[0].error, notJson.state.transient], [undefined, 0]);
});

test('the validation threshold: answers that failed validation count, through the check hook or noteInvalid, and the configured limit stops the run', async () => {
  const { send, calls } = fakeFetch(() => answer('{"judgements":[]}'));
  const guard = guardOf(send, { maxInvalid: 2, check: (sent, entry) => (entry.content === '{"judgements":[]}' ? 'the answer leaves out every relationship' : null) });
  await guard.fetch(OPENROUTER_CHAT, chat());
  await guard.fetch(OPENROUTER_CHAT, chat());
  await assert.rejects(guard.fetch(OPENROUTER_CHAT, chat()), error => error.refused);
  assert.equal(calls.length, 2);
  assert.match(guard.stopped(), /2 answer\(s\) failed validation \(the last: the answer leaves out every relationship\)/);
  assert.deepEqual(guard.httpLog.map(e => e.invalid), ['the answer leaves out every relationship', 'the answer leaves out every relationship']);
  const direct = guardOf(fakeFetch().send, { maxInvalid: 3 });
  direct.noteInvalid('quote_not_found'); direct.noteInvalid('empty_explanation');
  assert.equal(direct.stopped(), null);
  direct.noteInvalid('quotes_swapped');
  assert.match(direct.stopped(), /3 answer\(s\) failed validation/);
});

test('the API key never reaches a thrown error, the request log, the ledger file, the summary or the console', async () => {
  const logged = [], ledgerFile = tempFile('redact');
  try {
    const { send } = fakeFetch(() => { throw new Error(`connect ECONNREFUSED while sending ${KEY}`); });
    const guard = guardOf(send, { maxTransient: 1, ledgerFile, log: line => logged.push(line) });
    await assert.rejects(guard.fetch(OPENROUTER_CHAT, chat()), error => !error.message.includes(KEY) && error.message.includes('[redacted]'));
    const everything = [JSON.stringify(guard.httpLog), JSON.stringify(guard.summary()), fs.readFileSync(ledgerFile, 'utf8'), logged.join('\n'), guard.stopped()].join('\n');
    assert.ok(everything.length > 100 && !everything.includes(KEY));
    assert.ok(!/Bearer|Authorization/.test(JSON.stringify(guard.httpLog)), 'request headers are never kept');
  } finally { fs.rmSync(ledgerFile, { force: true }); }
});

test('completed work is kept: the ledger is written after every request and carries the count and the charges into the next invocation', async () => {
  const ledgerFile = tempFile('ledger');
  try {
    const first = fakeFetch();
    const one = guardOf(first.send, { maxRequests: 3, ledgerFile });
    await one.fetch(OPENROUTER_CHAT, chat(['a']));
    await one.fetch(OPENROUTER_CHAT, chat(['b']));
    const saved = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
    assert.equal(saved.requests, 2);
    assert.deepEqual(saved.entries.map(e => e.status), [200, 200]);
    assert.ok(saved.charged > 0);
    assert.deepEqual(one.httpLog.map(e => e.ids), [['a'], ['b']]);
    assert.ok(one.httpLog.every(e => e.content === '{"judgements":[]}'), 'each completed request keeps its answer for the report');
    const second = fakeFetch();
    const two = guardOf(second.send, { maxRequests: 3, ledgerFile });
    assert.equal(two.ledger.requests, 2);
    assert.equal(two.ledger.charged, saved.charged);
    await two.fetch(OPENROUTER_CHAT, chat(['c']));
    await assert.rejects(two.fetch(OPENROUTER_CHAT, chat(['d'])), error => error.refused);
    assert.equal(second.calls.length, 1, 'the cap spans both invocations');
    assert.equal(two.summary().requests, 3);
  } finally { fs.rmSync(ledgerFile, { force: true }); }
});

test('a resumed run keeps the timeout and invalid-answer history: the counts and each request\'s relationships carry over, so the limits span both invocations', async () => {
  const ledgerFile = tempFile('history');
  const timeout = () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); };
  try {
    const one = guardOf(fakeFetch(timeout).send, { maxTransient: 3, maxInvalid: 4, ledgerFile });
    await assert.rejects(one.fetch(OPENROUTER_CHAT, chat(['a', 'b'])), error => error.name === 'TimeoutError');
    one.noteInvalid('empty_explanation: test');
    let saved = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
    assert.deepEqual([saved.requests, saved.transient, saved.invalid, saved.entries[0].error, saved.entries[0].ids], [1, 1, 1, 'timeout', ['a', 'b']]);
    // The next invocation starts from those counts: two more timeouts make three, and the run stops.
    const second = fakeFetch(timeout);
    const two = guardOf(second.send, { maxTransient: 3, maxInvalid: 4, ledgerFile });
    assert.deepEqual([two.state.transient, two.state.invalid], [1, 1]);
    for (let i = 0; i < 2; i++) await assert.rejects(two.fetch(OPENROUTER_CHAT, chat(['a'])), error => error.name === 'TimeoutError');
    assert.match(two.stopped(), /3 rate limit\(s\), timeout\(s\), network or server error\(s\)/);
    await assert.rejects(two.fetch(OPENROUTER_CHAT, chat(['a'])), error => error.refused);
    assert.equal(second.calls.length, 2);
    // A ledger written before the counts were kept is counted from its entries; notes in it are kept.
    fs.writeFileSync(ledgerFile, JSON.stringify({ requests: 2, charged: 0.01, notes: ['corrected by hand'], entries: [{ n: 1, kind: 'price-lookup', status: 200 }, { n: 2, kind: 'model', status: 200, error: 'timeout', charged: 0.01 }] }));
    const three = guardOf(fakeFetch().send, { ledgerFile });
    assert.deepEqual([three.state.transient, three.state.invalid], [1, 0]);
    await three.fetch(OPENROUTER_CHAT, chat(['c']));
    saved = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
    assert.deepEqual([saved.requests, saved.transient, saved.notes], [3, 1, ['corrected by hand']]);
  } finally { fs.rmSync(ledgerFile, { force: true }); }
});

test('a closed ledger is a historical record: no request is added to it, and a later evaluation starts its own ledger linked to it, keeping its final counts', async () => {
  const earlierFile = tempFile('closed'), laterFile = tempFile('linked'), openFile = tempFile('open');
  try {
    // an evaluation that reached its invalid-answer stop
    const earlier = guardOf(fakeFetch().send, { maxInvalid: 2, ledgerFile: earlierFile });
    await earlier.fetch(OPENROUTER_CHAT, chat(['a']));
    earlier.noteInvalid('empty_answer: test'); earlier.noteInvalid('quotes_swapped: test');
    const before = JSON.parse(fs.readFileSync(earlierFile, 'utf8'));
    // closing keeps every count and entry, and cannot be repeated
    const closed = closeLedger(earlierFile, { reason: 'the invalid-answer stop condition', supersededBy: laterFile, at: '2026-10-25T00:00:00.000Z' });
    const after = JSON.parse(fs.readFileSync(earlierFile, 'utf8'));
    assert.deepEqual({ ...after, closed: undefined }, { ...before, closed: undefined });
    assert.deepEqual(after.closed, { at: '2026-10-25T00:00:00.000Z', reason: 'the invalid-answer stop condition', supersededBy: laterFile });
    assert.deepEqual([closed.requests, closed.invalid], [1, 2]);
    assert.throws(() => closeLedger(earlierFile, { reason: 'again' }), /already closed/);
    assert.throws(() => closeLedger(laterFile, { reason: '' }), /needs the reason/);
    // no guard adds to it, so nothing can be sent against it
    const { send, calls } = fakeFetch();
    assert.throws(() => guardOf(send, { ledgerFile: earlierFile }), /is closed \(the invalid-answer stop condition\)/);
    assert.equal(calls.length, 0);
    // a new ledger links to it: its own counts start at zero, the earlier counts are recorded with the link, never reset or merged
    const later = guardOf(send, { ledgerFile: laterFile, previousLedger: earlierFile });
    assert.deepEqual([later.ledger.requests, later.state.invalid, later.state.transient], [0, 0, 0]);
    await later.fetch(OPENROUTER_CHAT, chat(['b']));
    let saved = JSON.parse(fs.readFileSync(laterFile, 'utf8'));
    // (conservative: what the Stage E.5 rule charged, kept beside the charge since Stage E.6)
    assert.deepEqual(saved.previous, { ledger: earlierFile, requests: 1, charged: before.charged, transient: 0, invalid: 2, conservative: before.conservative, closedAt: '2026-10-25T00:00:00.000Z', closedBecause: 'the invalid-answer stop condition' });
    assert.equal(saved.requests, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(earlierFile, 'utf8')), after, 'the closed ledger is unchanged');
    // resuming the new ledger keeps the link (named again or not); a different earlier ledger is refused
    const resumed = guardOf(send, { ledgerFile: laterFile });
    await resumed.fetch(OPENROUTER_CHAT, chat(['c']));
    saved = JSON.parse(fs.readFileSync(laterFile, 'utf8'));
    assert.deepEqual([saved.requests, saved.previous.ledger], [2, earlierFile]);
    assert.equal(guardOf(send, { ledgerFile: laterFile, previousLedger: earlierFile }).ledger.requests, 2);
    assert.throws(() => guardOf(send, { ledgerFile: laterFile, previousLedger: openFile }), /follows .* not /);
    // only a closed ledger can be followed, and a ledger that already holds requests cannot be linked afterwards
    fs.writeFileSync(openFile, JSON.stringify({ requests: 1, charged: 0, entries: [{ n: 1, kind: 'model', status: 200 }] }));
    assert.throws(() => guardOf(send, { ledgerFile: tempFile('new'), previousLedger: openFile }), /is not closed/);
    assert.throws(() => guardOf(send, { ledgerFile: openFile, previousLedger: earlierFile }), /already holds requests and links to no earlier ledger/);
  } finally { for (const file of [earlierFile, laterFile, openFile]) fs.rmSync(file, { force: true }); }
});

test('nothing is sent without current prices, without max_tokens, or to an address other than the provider', async () => {
  const { send, calls } = fakeFetch();
  await assert.rejects(guardOf(send, { prices: null }).fetch(OPENROUTER_CHAT, chat()), error => error.refused && /no current prices/.test(error.message));
  const body = JSON.parse(chat().body);
  delete body.max_tokens;
  await assert.rejects(guardOf(send).fetch(OPENROUTER_CHAT, { body: JSON.stringify(body) }), error => error.refused && /max_tokens/.test(error.message));
  await assert.rejects(guardOf(send).fetch('https://example.com/collect', { body: '{}' }), error => error.refused && /unexpected address/.test(error.message));
  assert.equal(calls.length, 0);
  // --max-tokens replaces the production value in the request, and the worst case follows it.
  const capped = fakeFetch(), small = guardOf(capped.send, { maxTokens: 512 });
  await small.fetch(OPENROUTER_CHAT, chat());
  assert.equal(JSON.parse(capped.calls[0].init.body).max_tokens, 512);
  assert.equal(small.httpLog[0].maxTokens, 512);
  assert.throws(() => createGuard({ fetch: send, maxRequests: 0, maxCost: 1 }), /maxRequests/);
  assert.throws(() => createGuard({ fetch: send, maxRequests: 1, maxCost: 0 }), /maxCost/);
});

test('the price lookup takes the highest price any endpoint lists, records endpoint structured-output support with redaction, and is itself a counted request', async () => {
  const endpoints = { data: { endpoints: [
    { provider_name: 'ModelRun', tag: `modelrun-${KEY}`, status: 0, uptime_last_30m: 100, pricing: { prompt: '0.00000015', completion: '0.0000006' }, supported_parameters: ['structured_outputs'] },
    { provider_name: 'B', pricing: { prompt: '0.0000003', completion: '0.0000012', request: '0', input_cache_read: '0.00000003' } },
  ] } };
  const { send, calls } = fakeFetch(() => json(200, endpoints));
  const guard = guardOf(send, { prices: null });
  const prices = await guard.readPrices(MODEL, KEY);
  assert.equal(prices.prompt, 3e-7);
  assert.equal(prices.completion, 1.2e-6);
  assert.equal(guard.state.prices, prices, 'the cost ceiling uses the prices just read');
  assert.deepEqual(prices.endpoints.map(e => [e.provider, e.structuredOutputs]), [['ModelRun', true], ['B', false]]);
  assert.ok(!JSON.stringify(prices).includes(KEY), 'secrets never leak through endpoint diagnostics');
  assert.equal(guard.ledger.requests, 1);
  assert.match(calls[0].url, /\/models\/minimax\/minimax-m3\.1-flash\/endpoints$/);
  const free = guardOf(fakeFetch(() => json(200, { data: { endpoints: [{ provider_name: 'C', pricing: { prompt: '0', completion: '0' } }] } })).send, { prices: null });
  await assert.rejects(free.readPrices(MODEL, KEY), /zero/);
});

test('Stage E.7: the key check is a counted request that bills nothing, returns no part of the key, and a refused key stops the run before anything is paid', async () => {
  const status = { data: { label: 'sk-or-v1-012...def', limit: null, limit_remaining: null, usage: 0.0123, is_free_tier: false, expires_at: '2027-01-01T00:00:00Z', rate_limit: { requests: 10 } } };
  const { send, calls } = fakeFetch(() => json(200, status));
  const guard = guardOf(send, { prices: null });
  const key = await guard.checkKey(KEY);
  assert.deepEqual(key, { status: 200, ok: true, freeTier: false, limit: null, limitRemaining: null, usage: 0.0123, expiresAt: '2027-01-01T00:00:00Z' });
  assert.ok(!/sk-or-v1/.test(JSON.stringify([key, guard.httpLog, guard.summary()])), 'the label, which shows part of the key, is never returned or kept');
  assert.deepEqual([calls[0].url, calls[0].init.method], [OPENROUTER_KEY, 'GET']);
  assert.deepEqual([guard.ledger.requests, guard.httpLog[0].kind, guard.ledger.charged, guard.stopped()], [1, 'key-check', 0, null]);
  assert.deepEqual([guard.summary().keyChecks, guard.summary().priceLookups, guard.summary().model], [1, 0, 0]);
  // an expired, revoked or unpaid key: the guard stops at once, and nothing more is sent
  for (const code of [401, 402, 403]) {
    const refused = fakeFetch(() => json(code, { error: { message: 'API key expired.' } }));
    const stopped = guardOf(refused.send);
    assert.deepEqual(await stopped.checkKey(KEY), { status: code, ok: false, freeTier: null, limit: null, limitRemaining: null, usage: null, expiresAt: null });
    assert.match(stopped.stopped(), new RegExp(`HTTP ${code} \\(credits, key or access\\)`));
    await assert.rejects(stopped.readPrices(MODEL, KEY), error => error.refused);
    await assert.rejects(stopped.fetch(OPENROUTER_CHAT, chat()), error => error.refused);
    assert.equal(refused.calls.length, 1);
  }
  // it counts against the request cap like any other request, and the key-status address is the only new one: other account addresses stay refused
  const capped = fakeFetch(() => json(200, status)), one = guardOf(capped.send, { maxRequests: 1 });
  await one.checkKey(KEY);
  await assert.rejects(one.fetch(OPENROUTER_CHAT, chat()), error => error.refused && /request cap/.test(error.message));
  for (const url of ['https://openrouter.ai/api/v1/keys', 'https://openrouter.ai/api/v1/credits', `${OPENROUTER_KEY}?x=1`]) {
    const other = fakeFetch(), g = guardOf(other.send);
    await assert.rejects(g.fetch(url, { method: 'GET' }), error => error.refused && /unexpected address/.test(error.message));
    assert.equal(other.calls.length, 0);
  }
});

test('an evaluation is isolated from application data: the checker and its fixtures load no database, route, repository or service module', () => {
  require('./engine');
  require('./eval/programSyllabi');
  require('./eval/realSyllabi');
  assert.deepEqual(loadedDataModules(), []);
  for (const file of ['/repo/server/db/pool.js', '/repo/server/db/init.js', 'C:\\repo\\server\\db\\migrate-compliance.js', 'C:\\repo\\server\\routes\\syllabi.js', '/repo/server/lib/syllabuscheck/repository.js', '/repo/server/lib/compliance/service.js', '/repo/node_modules/mysql2/index.js']) assert.ok(DATA_MODULES.test(file), file);
  // The constant curriculum transcriptions the evaluation fixtures read are allowed; nothing else in server/db is.
  for (const file of ['/repo/server/lib/syllabuscheck/gemini.js', '/repo/server/lib/compliance/rules.js', '/repo/server/lib/syllabuscheck/eval/providerGuard.js', 'C:\\repo\\server\\db\\local-curriculum-data.cjs', '/repo/server/db/local-outcome-data.cjs']) assert.ok(!DATA_MODULES.test(file), file);
  for (const file of ['local-curriculum-data.cjs', 'local-outcome-data.cjs']) assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', '..', 'db', file), 'utf8'), /require\(|process\.|fs\./, `${file} is constant data`);
});

test('the paid evaluation scripts send every request through the guard, block the global fetch, and need --confirm-paid', () => {
  const scripts = path.join(__dirname, '..', '..', '..', 'scripts');
  for (const name of ['eval-alignment.cjs', 'live-pipeline-eval.cjs', 'live-smoke-eval.cjs']) {
    const source = fs.readFileSync(path.join(scripts, name), 'utf8');
    assert.match(source, /createGuard\(/, `${name} uses the shared guard`);
    assert.match(source, /globalThis\.fetch = \(\) => \{ throw/, `${name} blocks the global fetch`);
    assert.match(source, /confirm-paid/, `${name} needs --confirm-paid for a paid run`);
    assert.doesNotMatch(source, /await fetch\(|[^.\w]fetch\(url/, `${name} never calls fetch around the guard`);
    assert.match(source, /loadedDataModules\(/, `${name} checks that no application data module is loaded`);
  }
  const evalSource = fs.readFileSync(path.join(scripts, 'eval-alignment.cjs'), 'utf8');
  assert.match(evalSource, /if \(guard\.state\.prices\) result\.prices = guard\.state\.prices;/, 'eval-alignment.cjs records the fetched endpoint diagnostics');
  assert.doesNotMatch(evalSource, /ModelRun|provider\.only|provider\.ignore/, 'eval-alignment.cjs does not alter production routing or exclude ModelRun');
});
