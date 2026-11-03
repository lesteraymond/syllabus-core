'use strict';
// The guard every PAID evaluation sends its provider requests through (scripts/live-smoke-eval.cjs, scripts/eval-alignment.cjs and
// scripts/live-pipeline-eval.cjs). It is the `transport` requestOpenRouter calls (gemini.js), so every HTTP request is checked BEFORE it leaves the
// process, retries and price lookups included:
//   - requests: at most maxRequests in all. With a ledger file the count (and the dollars charged) carries over to the next invocation.
//   - cost: a model request is sent only when the dollars already charged, plus the worst cases of the requests still in flight, plus its own worst case
//     fit under maxCost. Worst case = every request byte (+256 for the chat template) as an input token at the highest input price any endpoint of the
//     model lists, plus max_tokens at the highest output price, plus the per-request fee. Without current prices, or without max_tokens, nothing is sent.
//     The worst case is reserved before the request is sent and never lowered while it is in flight. When the answer comes (Stage E.6, accounting
//     'reconcile', the default) the reservation is settled at what the provider reports, when that report is reliable (reliableCost below: a number,
//     the tokens reported and within their bounds, and the cost between those tokens at the lowest and at the highest listed prices). Otherwise, and
//     always with accounting 'conservative' (the Stage E.5 rule), a request is charged the larger of the reported cost and its reported tokens at the
//     highest prices. A refused (4xx) request is charged what is reported; a request without usage, or abandoned (timeout, network error, also after
//     its headers came), its worst case. Each entry says which rule charged it (accounting) and what the conservative rule would have charged.
//   - stops: HTTP 401/402/403 at once (credits, key or access), and any other 4xx of a model request except 429 (the request format or routing is
//     refused, so every request would be); the maxTransient-th rate limit, timeout, network or server error; the maxUnproductive-th answer in a row
//     that verified no relationship (noteAnswer, or the `check` hook: a provider or schema that keeps failing); the maxInvalid-th answer that failed
//     validation, when an evaluation sets maxInvalid (by default it does not: an answer refused for one relationship while the others verify, and
//     corrected by the next request, is not a failure of the evaluation, Stage E.6); a charge above a worst case, or more tokens than its bound (the
//     price assumption no longer holds). warnInvalid only warns (once), as an operational signal.
//   - key check (Stage E.7, checkKey): one counted request to OpenRouter's key-status address, which bills nothing, before the first paid request: the
//     price lookup is answered even for an expired key. A refused key (401/402/403) stops the evaluation there, with nothing paid. Only fields that
//     say nothing about the key are returned (never its label, which shows part of it).
// After a stop every request is refused locally (error.refused), without network: nothing more is sent after a provider-credit failure. Every text the
// guard keeps or throws is redacted (`secrets`), and request headers are never kept, so the API key reaches no log, ledger or result file.
// A ledger that reached a stop condition and was closed (closeLedger) is a historical record: no guard adds to it. A later evaluation starts its own
// ledger linked to it (previousLedger): the new ledger names the closed one and keeps its final counts, so no counter is ever silently reset.
// No I/O of its own apart from the injected fetch and the optional ledger files.
// Stage S6, the Anthropic mode (provider 'anthropic', for one `model`): only a POST to https://api.anthropic.com/v1/messages for that model is sent,
// through the official SDK that anthropicClient.js drives (its fetch is this guard). Anthropic publishes no prices to look up, so the guard charges the
// published prices pinned in anthropicClient.js (PRICES_AS_OF) with two margins of its own: a cache read at no less than CACHE_READ_FLOOR x the input
// price, and GEO_FACTOR unless an answer reports inference_geo "global". Each entry keeps the estimate at the published prices next to that charge, and
// an evaluation prints both prices for confirmation (describeClaudePrices). The worst case (claudeWorstCaseOf) is reserved before a request is sent, as
// above. A complete answer is settled at the tokens it reports (claudeChargeOf): Anthropic reports tokens, not dollars. Each entry keeps the model that
// answered, exactly as Anthropic named it (modelReturned); an answer from any model but the guarded one or a dated snapshot of it stops the run, as the
// pinned prices are for that model only. A refused request (4xx) is charged nothing, as the API bills none; a server error (5xx, 504 being the API's own timeout), a
// timeout or a network error is charged its worst case, as it may have been billed. A spend limit or an exhausted credit balance (anthropicClient.js
// budgetRefusal: HTTP 400, or 429 enforced_spend_limit_reached) stops at once. maxOutputTokens caps the output tokens of the ledger, thinking
// included: a request is sent only while its max_tokens still fits. A spend register (openSpendRegister) keeps what every Claude ledger charged and
// caps their total (the authorized budget); its lock keeps a second evaluation from spending at the same time. A ledger records its provider and
// model, and is never continued, or followed, by an evaluation of another. All of this is the guard's own accounting, never Anthropic's invoice: the
// Console's usage page is the check afterwards.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PRICES: CLAUDE_PRICES, LONG_PROMPT, PRICES_AS_OF, US_ONLY_FACTOR, budgetRefusal, sameModel } = require('../anthropicClient');

const OPENROUTER_CHAT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY = 'https://openrouter.ai/api/v1/key'; // Stage E.7: the key's status (checkKey); it answers 401 for an expired key
const round = value => Math.round(value * 1e8) / 1e8;
// Modules that can reach the application's data or settings: an evaluation must not load them (checked by the scripts before the first request).
// The two transcriptions in server/db (local-curriculum-data.cjs, local-outcome-data.cjs) are constants with no require and no I/O: the evaluation
// fixtures read them (eval/programSyllabi.js, eval/realSyllabi.js) and nothing writes them. Every other server/db module is refused.
const DATA_MODULES = /[\\/]server[\\/]db[\\/](?!local-[a-z]+-data\.cjs$)|[\\/]server[\\/]routes[\\/]|[\\/]syllabuscheck[\\/]repository\.js$|[\\/]compliance[\\/]service\.js$|[\\/]node_modules[\\/](pg|mysql2?|knex|sequelize|better-sqlite3|mongodb)[\\/]/;
const loadedDataModules = (pattern = DATA_MODULES) => Object.keys(require.cache).filter(file => pattern.test(file));

// Stage S6: the Anthropic mode's constants.
const ANTHROPIC_MESSAGES = 'https://api.anthropic.com/v1/messages';
const GEO_FACTOR = US_ONLY_FACTOR; // data residency: inference_geo "us" (which a workspace can make its default) is published at 1.1x every token; the guard charges it unless an answer reports "global"
const CACHE_READ_FLOOR = 0.1; // the guard charges a cache read at no less than 0.1x the input price: a margin above the published 0.05x of Claude Sonnet 5.5 ($0.10) and Opus 5.5, kept on purpose
const CLAUDE_ALLOWANCE = 2048; // tokens Anthropic may add to a request beyond its body and schema (its structured-output and thinking instructions)
const CACHE_1H = /"ttl"\s*:\s*"1h"/;
// The response headers an entry keeps: the request id (Anthropic's support needs it), the wait asked for, and the rate-limit state. Never the
// organisation or workspace id.
const CLAUDE_HEADERS = /^(request-id|retry-after|x-should-retry|anthropic-ratelimit-.+)$/;
// The prices of a Claude model, in US$ per token: input, output, the 5-minute and 1-hour cache writes (1.25x and 2x input), all as published;
// listedCacheRead, the published cache read; and cacheRead, what the guard charges for one (the published price, but no less than CACHE_READ_FLOOR x
// input). longPrompt is the higher tier a model has above a prompt size (Claude Haiku 5.5 above 100,000 tokens). null: the model has no pinned price.
function claudePrices(model) {
  const id = String(model || '');
  if (!Object.hasOwn(CLAUDE_PRICES, id)) return null;
  const rates = ([input, output, cacheRead]) => ({ input: input / 1e6, output: output / 1e6, cacheRead: Math.max(cacheRead, input * CACHE_READ_FLOOR) / 1e6, listedCacheRead: cacheRead / 1e6, cacheWrite5m: (input * 1.25) / 1e6, cacheWrite1h: (input * 2) / 1e6 });
  const long = Object.hasOwn(LONG_PROMPT, id) ? LONG_PROMPT[id] : null;
  return { provider: 'anthropic', model: id, asOf: PRICES_AS_OF, geoFactor: GEO_FACTOR, ...rates(CLAUDE_PRICES[id]), ...(long ? { longPrompt: { over: long.over, ...rates(long.price) } } : {}) };
}
// The same prices per million tokens, as an evaluation prints them for confirmation.
const claudePriceTable = prices => {
  const perM = rates => Object.fromEntries(['input', 'output', 'cacheRead', 'listedCacheRead', 'cacheWrite5m', 'cacheWrite1h'].map(key => [key, round(rates[key] * 1e6)]));
  return { model: prices.model, asOf: prices.asOf, geoFactor: prices.geoFactor, perMillionTokens: perM(prices), ...(prices.longPrompt ? { longPrompt: { over: prices.longPrompt.over, perMillionTokens: perM(prices.longPrompt) } } : {}) };
};
// The most one Claude request can cost, before it is sent: every byte of its body as an input token (a token is at least one byte of text), the bytes
// of its schema once more (structured outputs add a system prompt that may restate it) and CLAUDE_ALLOWANCE, all at the highest input-side price (the
// cache write the request asks for: 1 hour when any cache_control says so); max_tokens at the output price (thinking is output); everything times
// GEO_FACTOR. A bound above longPrompt.over takes the higher tier.
function claudeWorstCaseOf(body, prices, sent = JSON.parse(body)) {
  const inputTokens = Buffer.byteLength(body) + Buffer.byteLength(JSON.stringify(sent.output_config?.format?.schema ?? null)) + CLAUDE_ALLOWANCE;
  const outputTokens = sent.max_tokens, tier = prices.longPrompt && inputTokens > prices.longPrompt.over ? prices.longPrompt : prices;
  const inputRate = Math.max(tier.input, CACHE_1H.test(body) ? tier.cacheWrite1h : tier.cacheWrite5m, tier.cacheRead), outputRate = tier.output;
  return { inputTokens, outputTokens, inputRate, outputRate, dollars: (inputTokens * inputRate + (Number.isInteger(outputTokens) && outputTokens > 0 ? outputTokens : 0) * outputRate) * prices.geoFactor };
}
// What a complete Claude answer costs, from the tokens it reports: input; the cache writes, each at its own duration's price when the answer splits them
// (else at the duration the request asked for); the cache reads; the output, thinking included; at the prices of the tier the whole prompt falls in.
//   atListPrices  at the published list prices, before any data-residency factor.
//   estimated     the published price: atListPrices, times GEO_FACTOR only when the answer reports inference_geo "us".
//   charged       what the guard counts against its caps (accounting 'reconcile'): the same tokens with each cache read at the guard's cacheRead, times
//                 GEO_FACTOR unless the answer reports inference_geo "global". Never below `estimated`.
//   conservative  the same tokens at the worst case's rates, times GEO_FACTOR (accounting 'conservative').
// thinking: the thinking tokens the answer reports (output_tokens_details.thinking_tokens), or null when it reports no count, which is never taken for 0.
// null when the usage is incomplete (the request is then charged its worst case).
function claudeChargeOf(usage, worst, prices, body) {
  const whole = v => Number.isInteger(v) && v >= 0, count = v => (v === undefined || v === null ? 0 : v);
  const input = usage?.input_tokens, output = usage?.output_tokens, write = count(usage?.cache_creation_input_tokens), read = count(usage?.cache_read_input_tokens);
  if (![input, output, write, read].every(whole)) return null;
  const split = usage.cache_creation;
  const hour = whole(split?.ephemeral_1h_input_tokens) && whole(split?.ephemeral_5m_input_tokens) && split.ephemeral_1h_input_tokens + split.ephemeral_5m_input_tokens === write ? split.ephemeral_1h_input_tokens : CACHE_1H.test(body) ? write : 0;
  const prompt = input + write + read, tier = prices.longPrompt && prompt > prices.longPrompt.over ? prices.longPrompt : prices;
  const at = cacheRead => input * tier.input + (write - hour) * tier.cacheWrite5m + hour * tier.cacheWrite1h + read * cacheRead + output * tier.output;
  const atListPrices = at(tier.listedCacheRead), geo = usage.inference_geo === 'global' ? 1 : prices.geoFactor, listedGeo = usage.inference_geo === 'us' ? prices.geoFactor : 1;
  const thinking = whole(usage.output_tokens_details?.thinking_tokens) ? usage.output_tokens_details.thinking_tokens : null;
  return { prompt, input, write, writeHour: hour, read, output, thinking, geo, atListPrices, estimated: atListPrices * listedGeo, charged: at(tier.cacheRead) * geo, conservative: (prompt * worst.inputRate + output * worst.outputRate) * prices.geoFactor };
}
const tally = values => values.reduce((out, value) => (value ? { ...out, [value]: (out[value] || 0) + 1 } : out), {});
// What an evaluation prints before its first request: the published prices, and where the guard's own count differs from them.
function describeClaudePrices(table) {
  const p = table.perMillionTokens, margin = p.cacheRead > p.listedCacheRead ? ` with a cache read at $${p.cacheRead} (no less than ${CACHE_READ_FLOOR}x input, a margin above the published price)` : '';
  return `Published prices (Anthropic's pricing page, pinned in anthropicClient.js as of ${table.asOf}, per million tokens): input $${p.input}, output $${p.output} (thinking is output), cache read $${p.listedCacheRead}, cache write $${p.cacheWrite5m} (5 min) / $${p.cacheWrite1h} (1 h); x${table.geoFactor} only when an answer reports inference_geo "us". `
    + `The guard counts the same tokens against its caps${margin}, x${table.geoFactor} unless an answer reports inference_geo "global", and reserves each request's worst case before it is sent: its own accounting, never Anthropic's invoice.`;
}
// What the Claude requests of a run used, as an evaluation prints it at the end: the tokens, the thinking as the answers reported it, the models that
// answered, and the estimate at the published prices next to what the guard charged.
function describeClaudeUsage(a) {
  const t = a.thinkingReports, register = a.limits.register;
  return `Claude usage this run: input ${a.inputTokens}, cache write ${a.cacheCreationInputTokens}, cache read ${a.cacheReadInputTokens}, output ${a.outputTokens} (thinking ${a.thinkingTokens} as reported: ${t.nonzero} request(s) reported thinking tokens, ${t.zero} reported zero, ${t.unavailable} reported no count, which is not taken for zero; thinking blocks ${a.thinkingBlocks}); models that answered ${JSON.stringify(a.modelsReturned)}. `
    + `Estimated at the published prices $${a.estimatedCost}${a.notEstimated ? ` (leaving out the ${a.notEstimated} request(s) whose usage is unknown)` : ''}; charged by the guard against its caps $${a.chargedThisRun}${register ? `; every Claude ledger together $${register.chargedByEveryLedger} of the total cap $${register.cap}` : ''}. Anthropic's invoice is what counts. `
    + `Stop reasons ${JSON.stringify(a.stopReasons)}; errors ${JSON.stringify(a.errors)}; latency ${a.latencyMs ? `median ${a.latencyMs.median} ms, p90 ${a.latencyMs.p90} ms, max ${a.latencyMs.max} ms` : 'n/a'}`;
}
// Stage S6: the spend register, shared by every Claude evaluation ledger, so that what all of them charged stays under one total cap (the authorized
// budget, the lower of the register's own cap and `cap`; the register's cap is set once, and only an edit of the file raises it). Opening it takes its
// lock, <file>.lock, created exclusively: a second evaluation cannot open it at the same time, and a lock left by a process that died is removed by
// hand once no evaluation runs. It keeps, per ledger file (relative to the register), what that ledger charged. release() frees the lock.
function openSpendRegister(file, { cap } = {}) {
  if (!file) throw Error('the spend register needs a file');
  if (!(Number.isFinite(cap) && cap > 0)) throw Error('the spend register needs a total cap, a positive number of dollars');
  const lock = `${file}.lock`, token = crypto.randomUUID();
  try { fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), token }), { flag: 'wx' }); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let holder = '';
    try { holder = fs.readFileSync(lock, 'utf8').slice(0, 200); } catch { /* the lock is reported without its content */ }
    throw Error(`the spend register ${file} is held by another evaluation (${holder || 'its lock is unreadable'}); if none is running, delete ${lock}`);
  }
  let data;
  try {
    data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { cap, ledgers: {} };
    if (!(Number.isFinite(data.cap) && data.cap > 0) || !data.ledgers || typeof data.ledgers !== 'object' || Array.isArray(data.ledgers)) throw Error(`${file} is not a spend register`);
  } catch (error) { fs.rmSync(lock, { force: true }); throw error; }
  const keyOf = ledgerFile => path.relative(path.dirname(path.resolve(file)), path.resolve(ledgerFile)).split(path.sep).join('/');
  let held = true;
  return {
    file, cap: Math.min(data.cap, cap), registeredCap: data.cap, keyOf,
    total: () => round(Object.values(data.ledgers).reduce((n, l) => n + (l.charged || 0), 0)),
    others: key => Object.entries(data.ledgers).reduce((n, [k, l]) => n + (k === key ? 0 : l.charged || 0), 0),
    record(key, counts) {
      if (!held) throw Error(`the spend register ${file} was released`);
      data.ledgers[key] = { ...counts, charged: round(counts.charged || 0), updatedAt: new Date().toISOString() };
      fs.writeFileSync(file, JSON.stringify({ cap: data.cap, total: round(Object.values(data.ledgers).reduce((n, l) => n + (l.charged || 0), 0)), ledgers: data.ledgers }, null, 2));
    },
    release() {
      if (!held) return;
      held = false;
      try { if (JSON.parse(fs.readFileSync(lock, 'utf8')).token === token) fs.rmSync(lock, { force: true }); } catch { /* already gone */ }
    },
  };
}

// The final counts of a ledger, as a later ledger links to it.
const countsOf = ledger => ({ requests: ledger.requests || 0, charged: round(ledger.charged || 0), transient: ledger.transient ?? null, invalid: ledger.invalid ?? null, ...(ledger.conservative !== undefined ? { conservative: round(ledger.conservative) } : {}), ...(ledger.provider ? { provider: ledger.provider, model: ledger.model ?? null, outputTokens: ledger.outputTokens ?? null } : {}) });
const ACCOUNTING = ['reconcile', 'conservative'];
// Stage E.6: is a provider-reported cost reliable enough to settle a reservation at? It must be a finite, non-negative number; the answer must report
// its prompt and completion tokens, within the bounds the worst case was computed from; and the cost must lie between those tokens at the LOWEST
// listed prices of the model's endpoints (cached input at the lowest cache-read price) and at the HIGHEST (`ceiling`, the conservative charge). The
// floor keeps a report that is too low to be any endpoint's bill from lowering the count (2% tolerance for rounding).
function reliableCost(usage, reported, ceiling, worst, endpoints) {
  if (!usage || !Number.isFinite(reported) || reported < 0 || !Number.isFinite(ceiling) || !Array.isArray(endpoints) || !endpoints.length) return false;
  const promptTokens = usage.prompt_tokens, completionTokens = usage.completion_tokens;
  if (!(Number.isFinite(promptTokens) && promptTokens >= 0 && Number.isFinite(completionTokens) && completionTokens >= 0)) return false;
  if (promptTokens > worst.inputTokens || completionTokens > worst.outputTokens) return false;
  const low = key => Math.min(...endpoints.map(e => (Number.isFinite(Number(e[key])) ? Number(e[key]) : 0)));
  const cachedTokens = Number.isFinite(usage.prompt_tokens_details?.cached_tokens) ? Math.min(Math.max(usage.prompt_tokens_details.cached_tokens, 0), promptTokens) : 0;
  const floor = (promptTokens - cachedTokens) * low('prompt') + cachedTokens * low('cacheRead') + completionTokens * low('completion') + low('request');
  return reported >= floor * 0.98 - 1e-12 && reported <= ceiling * 1.000001 + 1e-12;
}
// Closes a ledger: it keeps every count and entry and gains `closed` ({ at, reason, supersededBy }). A closed ledger cannot be closed again or added to.
function closeLedger(file, { reason, supersededBy = null, at = new Date().toISOString() } = {}) {
  if (!reason || !String(reason).trim()) throw Error('closeLedger needs the reason the evaluation was closed');
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (ledger.closed) throw Error(`the ledger ${file} is already closed (${ledger.closed.reason})`);
  const { entries = [], ...head } = ledger;
  fs.writeFileSync(file, JSON.stringify({ ...head, closed: { at, reason: String(reason), supersededBy }, entries }, null, 2));
  return { ...countsOf(ledger), closed: { at, reason: String(reason), supersededBy } };
}
function createGuard({ fetch: send, maxRequests, maxCost, maxTransient = 3, maxInvalid = Infinity, warnInvalid = null, maxUnproductive = Infinity, accounting = 'reconcile', maxTokens = null, ledgerFile = null, previousLedger = null, secrets = [], log = () => {}, onSend = null, check = null, provider = 'openrouter', model = null, maxOutputTokens = null, register = null } = {}) {
  if (typeof send !== 'function') throw Error('createGuard needs the fetch it sends through');
  if (!Number.isInteger(maxRequests) || maxRequests < 1) throw Error('maxRequests must be a positive integer');
  if (!(maxCost > 0)) throw Error('maxCost must be a positive number of dollars');
  const countOrNone = v => v === Infinity || (Number.isInteger(v) && v >= 1);
  if (!(Number.isInteger(maxTransient) && maxTransient >= 1) || !countOrNone(maxInvalid) || !countOrNone(maxUnproductive) || !(warnInvalid === null || countOrNone(warnInvalid))) throw Error('maxTransient, maxInvalid, warnInvalid and maxUnproductive must be positive integers');
  if (!ACCOUNTING.includes(accounting)) throw Error(`accounting must be ${ACCOUNTING.join(' or ')}`);
  if (maxTokens !== null && !(Number.isInteger(maxTokens) && maxTokens >= 256)) throw Error('maxTokens must be an integer of at least 256');
  // Stage S6: the Anthropic mode needs a model with pinned prices; its options mean nothing to OpenRouter, so they are refused there, not ignored.
  if (!['openrouter', 'anthropic'].includes(provider)) throw Error('provider must be openrouter or anthropic');
  const anthropic = provider === 'anthropic';
  if (anthropic && !claudePrices(model)) throw Error(`the Anthropic mode needs a Claude model with pinned prices (anthropicClient.js PRICES), not ${String(model || 'none').slice(0, 60)}`);
  if (!anthropic && (model !== null || maxOutputTokens !== null || register !== null)) throw Error('model, maxOutputTokens and register belong to the Anthropic mode');
  if (maxOutputTokens !== null && !(Number.isInteger(maxOutputTokens) && maxOutputTokens >= 1)) throw Error('maxOutputTokens must be a positive integer');
  if (register && !ledgerFile) throw Error('the spend register needs a ledger file to record this evaluation under');
  const keys = secrets.filter(secret => typeof secret === 'string' && secret.trim().length >= 8);
  const redact = text => keys.reduce((out, key) => out.split(key).join('[redacted]'), String(text ?? ''));
  const ledger = ledgerFile && fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : { requests: 0, charged: 0, entries: [] };
  ledger.entries = ledger.entries || [];
  if (ledger.closed) throw Error(`the ledger ${ledgerFile} is closed (${ledger.closed.reason}): a later evaluation starts its own ledger, linked to it`);
  // Stage S6: a ledger belongs to one provider and model. A Claude ledger names them; a ledger that names no provider is an OpenRouter one.
  const ownerOf = l => `${l.provider || 'openrouter'}${l.provider ? `/${l.model}` : ''}`, owner = anthropic ? `anthropic/${model}` : 'openrouter';
  if ((ledger.requests || ledger.entries.length || ledger.provider) && ownerOf(ledger) !== owner) throw Error(`the ledger ${ledgerFile} holds ${ownerOf(ledger)} requests, not ${owner} ones: each provider and model keeps its own ledger`);
  // previousLedger: the closed ledger this evaluation follows. A new ledger records it with its final counts; a resumed one must name the same ledger.
  if (previousLedger) {
    if (!ledgerFile) throw Error('previousLedger needs a ledger file to record the link in');
    if (ledger.previous) { if (ledger.previous.ledger !== previousLedger) throw Error(`the ledger ${ledgerFile} follows ${ledger.previous.ledger}, not ${previousLedger}`); } else if (ledger.requests || ledger.entries.length) throw Error(`the ledger ${ledgerFile} already holds requests and links to no earlier ledger`);
    else {
      const earlier = JSON.parse(fs.readFileSync(previousLedger, 'utf8'));
      if (!earlier.closed) throw Error(`the earlier ledger ${previousLedger} is not closed: close it (with the reason) before a new ledger follows it`);
      if (ownerOf(earlier) !== owner) throw Error(`the earlier ledger ${previousLedger} holds ${ownerOf(earlier)} requests, not ${owner} ones: a ledger follows only one of its own provider and model`);
      ledger.previous = { ledger: previousLedger, ...countsOf(earlier), closedAt: earlier.closed.at, closedBecause: earlier.closed.reason };
    }
  }
  // The timeout and invalid-answer counts carry over with the ledger too, so their limits hold across invocations as the request and dollar caps do.
  // A ledger written before they were kept is counted from its entries: a timeout, network error, rate limit or server error is a transient.
  const kept = (key, fallback) => (Number.isInteger(ledger[key]) && ledger[key] >= 0 ? ledger[key] : fallback);
  const state = { stopped: null, transient: kept('transient', ledger.entries.filter(e => e.error || e.status === 429 || e.status >= 500).length), invalid: kept('invalid', 0), unproductive: kept('unproductive', 0), warnings: [], reserved: 0, prices: null };
  // Stage S6: the pinned prices, the output tokens reserved by the requests in flight, and the ledger's output tokens (they carry over like the dollars).
  if (anthropic) {
    Object.assign(state, { prices: claudePrices(model), reservedOutput: 0 });
    if (!(Number.isInteger(ledger.outputTokens) && ledger.outputTokens >= 0)) ledger.outputTokens = 0;
  }
  const registerKey = register ? register.keyOf(ledgerFile) : null;
  // What the Stage E.5 rule would have charged (accounting 'conservative'): a ledger written before Stage E.6 charged every request that way.
  if (!(Number.isFinite(ledger.conservative) && ledger.conservative >= 0)) ledger.conservative = ledger.charged || 0;
  // A Claude request's entry also keeps its request id, the model that answered, latency, tokens (thinking: null when the answer reported no count),
  // how many thinking blocks the answer had and how it ended (never its text or its thinking), its estimate at the published prices, and its max_tokens
  // (Stage S7: what it is charged if the process ends before it settles).
  const claudeEntryOf = e => ({ maxTokens: e.maxTokens ?? null, requestId: e.requestId ?? null, modelReturned: e.modelReturned ?? null, ms: e.ms ?? null, ...(e.errorType ? { errorType: e.errorType } : {}), stopReason: e.stopReason ?? null, ...(e.stopReason === 'refusal' ? { stopCategory: e.stopCategory ?? null } : {}),
    thinkingBlocks: e.thinkingBlocks ?? null, estimatedCost: e.usage?.estimatedCost ?? null,
    tokens: e.usage ? { input: e.usage.inputTokens, cacheWrite: e.usage.cacheCreationInputTokens, cacheWrite1h: e.usage.cacheCreation1hTokens, cacheRead: e.usage.cacheReadInputTokens, output: e.usage.completionTokens, thinking: e.usage.thinkingTokens, inferenceGeo: e.usage.inferenceGeo, serviceTier: e.usage.serviceTier } : null });
  // Each entry keeps the relationships its request carried (ids), so a resumed evaluation can count every relationship's earlier attempts.
  const saveLedger = () => {
    if (ledgerFile) fs.writeFileSync(ledgerFile, JSON.stringify({ ...(anthropic ? { provider, model, modelsReturned: tally(ledger.entries.map(e => e.modelReturned)), pricesAsOf: state.prices.asOf, outputTokens: ledger.outputTokens } : {}), requests: ledger.requests, charged: round(ledger.charged), conservative: round(ledger.conservative), accounting, transient: state.transient, invalid: state.invalid, unproductive: state.unproductive, ...(ledger.previous ? { previous: ledger.previous } : {}), ...(ledger.notes ? { notes: ledger.notes } : {}), entries: ledger.entries.map(e => { const { n, kind, at, status, error, worst, charged, accounting: rule, conservativeCharge, ids } = e; return { n, kind, at, status, error, worst, charged, ...(rule ? { accounting: rule, conservativeCharge } : {}), ids, ...(anthropic ? claudeEntryOf(e) : {}) }; }) }, null, 2));
    if (register) register.record(registerKey, { model, requests: ledger.requests, charged: ledger.charged, outputTokens: ledger.outputTokens });
  };
  const httpLog = [];
  const stop = reason => { if (!state.stopped) { state.stopped = redact(reason); log(`STOP: ${state.stopped}`); } return state.stopped; };
  const warn = text => { const line = redact(text); state.warnings.push(line); log(`WARNING: ${line}`); };
  const refusal = () => Object.assign(Error(`not sent: ${state.stopped}`), { refused: true });
  const transient = what => { state.transient += 1; saveLedger(); if (state.transient >= maxTransient) stop(`${maxTransient} rate limit(s), timeout(s), network or server error(s) (the last: ${what})`); };
  // Stage S7: a Claude request that the process ended during (killed, or quit by a second Ctrl+C) left an entry without a charge, and may have been
  // billed. When its ledger is read again it is charged its worst case and its max_tokens, before anything else is sent, and the spend register with it.
  if (anthropic) {
    const unsettled = ledger.entries.filter(e => e.kind === 'model' && e.charged === undefined && Number.isFinite(e.worst));
    for (const e of unsettled) {
      Object.assign(e, { charged: e.worst, conservativeCharge: e.worst, accounting: 'worst_case', error: e.error || 'unsettled: the evaluation ended while this request was in flight' });
      ledger.charged += e.worst; ledger.conservative += e.worst; ledger.outputTokens += Number.isInteger(e.maxTokens) && e.maxTokens > 0 ? e.maxTokens : 0;
    }
    if (unsettled.length) { saveLedger(); warn(`${unsettled.length} request(s) of the ledger ${ledgerFile} never settled (the evaluation ended while they were in flight): each was charged its worst case`); }
  }
  // An answer that failed validation (in whole or for some of its relationships): an operational signal. It stops the evaluation only when maxInvalid
  // is set, and warns once at warnInvalid.
  const noteInvalid = what => {
    state.invalid += 1; saveLedger();
    if (warnInvalid !== null && state.invalid === warnInvalid) warn(`${warnInvalid} answer(s) have failed validation in whole or in part (the last: ${redact(what).slice(0, 160)}); this is not a stop: the evaluation stops on the final unresolved rate of distinct relationships`);
    if (state.invalid >= maxInvalid) stop(`${maxInvalid} answer(s) failed validation (the last: ${redact(what).slice(0, 160)})`);
  };
  // Stage E.6: one answer that arrived, with how many relationships it verified and, when some were refused, why. An answer that verified none is
  // unproductive; maxUnproductive of them in a row (a provider or schema that keeps failing) stop the evaluation, and one that verified any resets
  // the count. A request that brought no answer (a timeout, a server error) is neither: maxTransient counts it.
  const noteAnswer = ({ verified = 0, invalid = null } = {}) => {
    if (invalid) noteInvalid(invalid);
    state.unproductive = verified > 0 ? 0 : state.unproductive + 1; saveLedger();
    if (state.unproductive >= maxUnproductive) stop(`${maxUnproductive} answer(s) in a row verified no relationship (the last: ${redact(invalid || 'no judgement verified').slice(0, 160)})`);
  };
  const inputBound = body => Buffer.byteLength(body) + 256;
  const inputPrice = () => Math.max(state.prices.prompt, state.prices.cacheWrite || 0), outputPrice = () => Math.max(state.prices.completion, state.prices.reasoning || 0);
  const withMaxTokens = body => { if (!maxTokens) return body; const parsed = JSON.parse(body); parsed.max_tokens = maxTokens; return JSON.stringify(parsed); };
  function worstCase(body) {
    const outputTokens = JSON.parse(body).max_tokens;
    return { inputTokens: inputBound(body), outputTokens, dollars: inputBound(body) * inputPrice() + (outputTokens || 0) * outputPrice() + (state.prices.request || 0) };
  }
  async function guardedFetch(url, init = {}) {
    if (anthropic) return claudeFetch(url, init);
    const model = url === OPENROUTER_CHAT, keyCheck = url === OPENROUTER_KEY;
    if (state.stopped) throw refusal();
    if (ledger.requests >= maxRequests) { stop(`request cap reached (${maxRequests} provider requests)`); throw refusal(); }
    if (!model && !keyCheck && !/^https:\/\/openrouter\.ai\/api\/v1\/models\//.test(String(url))) { stop(`a request to an unexpected address was refused (${String(url).slice(0, 60)})`); throw refusal(); }
    let worst = null, sent = null;
    if (model) {
      if (!state.prices) { stop('no current prices, so the cost ceiling cannot be enforced'); throw refusal(); }
      init = { ...init, body: withMaxTokens(init.body) };
      worst = worstCase(init.body);
      if (!(worst.outputTokens > 0)) { stop('the request carries no max_tokens, so its cost cannot be bounded'); throw refusal(); }
      if (ledger.charged + state.reserved + worst.dollars > maxCost) { stop(`cost cap: $${round(ledger.charged)} already charged + $${round(worst.dollars)} worst case of the next request > $${maxCost}`); throw refusal(); }
      state.reserved += worst.dollars;
      sent = JSON.parse(init.body);
    }
    ledger.requests += 1; // counted before it is sent
    const entry = { n: ledger.requests, kind: model ? 'model' : keyCheck ? 'key-check' : 'price-lookup', at: new Date().toISOString(), ...(worst ? { worst: round(worst.dollars), inputBound: worst.inputTokens, maxTokens: worst.outputTokens, bodyBytes: Buffer.byteLength(init.body) } : {}) };
    if (sent) { try { entry.ids = JSON.parse(sent.messages[1].content).document_data.map(p => p.id); } catch { /* not a checker request */ } if (onSend) onSend(entry, sent); }
    ledger.entries.push(entry); httpLog.push(entry); saveLedger();
    const started = Date.now();
    let response;
    try { response = await send(url, init); } catch (error) {
      entry.ms = Date.now() - started; entry.error = error && error.name === 'TimeoutError' ? 'timeout' : `network: ${redact(error && error.message).slice(0, 120)}`;
      if (model) { state.reserved -= worst.dollars; entry.charged = entry.conservativeCharge = round(worst.dollars); entry.accounting = 'worst_case'; ledger.charged += worst.dollars; ledger.conservative += worst.dollars; } // an abandoned request may still be billed
      saveLedger(); transient(entry.error);
      throw Object.assign(Error(redact(error && error.message)), { name: (error && error.name) || 'Error' }); // the name keeps a timeout a timeout (gemini.js classifyFailure)
    }
    entry.ms = Date.now() - started; entry.status = response.status;
    // The response headers (cookies left out), to look for the endpoint that served a request whose answer never came: only the answer names it.
    if (model) entry.headers = Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie').map(([name, value]) => [name, redact(value).slice(0, 200)]));
    // The headers can come long before the answer (OpenRouter sends 200 at once and keeps the connection open while the model works), so a request can
    // also be abandoned while its answer is read: its timeout, or the connection. It is then a timeout or network error like one that never came:
    // charged its worst case (it may still be billed), counted toward maxTransient, and thrown. An answer that is not JSON is judged by its status.
    let body = null, cutOff = null;
    try { body = await response.clone().json(); } catch (error) { if (!error || error.name !== 'SyntaxError') cutOff = error || Error('the answer could not be read'); }
    if (cutOff) { entry.abandonedAfterMs = Date.now() - started; entry.error = cutOff.name === 'TimeoutError' ? 'timeout' : `network: ${redact(cutOff.message).slice(0, 120)}`; }
    if (model) {
      const u = body && body.usage, reported = u && u.cost !== undefined && Number.isFinite(Number(u.cost)) ? Number(u.cost) : null;
      const computed = u && Number.isFinite(u.prompt_tokens) && Number.isFinite(u.completion_tokens) ? u.prompt_tokens * inputPrice() + u.completion_tokens * outputPrice() + (state.prices.request || 0) : null;
      entry.usage = u ? { promptTokens: u.prompt_tokens ?? null, completionTokens: u.completion_tokens ?? null, reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? null, cachedTokens: u.prompt_tokens_details?.cached_tokens ?? null, reportedCost: reported, costAtListPrices: computed === null ? null : round(computed) } : null;
      const refused = response.status >= 400 && response.status < 500, unknown = reported === null && computed === null;
      const conservative = refused ? reported ?? 0 : unknown ? worst.dollars : Math.max(reported ?? 0, computed ?? 0);
      // Stage E.6: an answer that came complete (status 200, read to the end, no error inside) with a reliable reported cost settles its reservation at
      // that cost. A timeout, an abandoned answer, an error, or a report that is missing or out of bounds keeps the conservative charge.
      const reconciled = accounting === 'reconcile' && response.status === 200 && !cutOff && body && !body.error && reported !== null && reliableCost(u, reported, computed, worst, state.prices.endpoints);
      const charged = reconciled ? reported : conservative;
      entry.accounting = refused ? 'refused' : reconciled ? 'reconciled' : unknown ? 'worst_case' : 'conservative'; entry.conservativeCharge = round(conservative);
      state.reserved -= worst.dollars; ledger.charged += charged; ledger.conservative += conservative; entry.charged = round(charged);
      if (Math.max(charged, reported ?? 0) > worst.dollars * 1.000001) stop(`request ${entry.n} was charged $${round(Math.max(charged, reported ?? 0))} although its worst case was $${round(worst.dollars)}: the price assumption no longer holds`);
      if (u && (u.completion_tokens > worst.outputTokens || u.prompt_tokens > worst.inputTokens)) stop(`request ${entry.n} used more tokens than its bound: the cost bound no longer holds`);
      if (body) {
        const choice = body.choices && body.choices[0];
        Object.assign(entry, { provider: body.provider || null, modelReturned: body.model || null, generationId: body.id || null, finishReason: choice ? choice.finish_reason ?? null : null, content: choice && typeof choice.message?.content === 'string' ? choice.message.content : null });
        if (body.error && response.status === 200) transient('an error inside a 200 answer'); // a refusal's error body is judged by its status below
      }
      // An answer that arrived is checked as gemini.js checks it next (`check` returns why it failed or null, or { invalid, verified }: why, and the ids
      // it verified). It counts as an invalid answer (noteInvalid) and, when it verified nothing, toward maxUnproductive (noteAnswer).
      if (check && response.status === 200 && body && !body.error && !cutOff) {
        const result = check(sent, entry), why = result && typeof result === 'object' ? result.invalid || null : result || null;
        const verifiedIds = result && typeof result === 'object' && Array.isArray(result.verified) ? result.verified : why ? [] : entry.ids || [];
        entry.verifiedIds = verifiedIds;
        if (why) entry.invalid = redact(why).slice(0, 200);
        noteAnswer({ verified: verifiedIds.length, invalid: why });
      }
    }
    saveLedger();
    if ([401, 402, 403].includes(response.status)) stop(`HTTP ${response.status} (credits, key or access)`);
    else if (response.status === 429 || response.status >= 500) transient(`HTTP ${response.status}`);
    else if (response.status >= 400 && model) stop(`HTTP ${response.status}: the provider refused the request format or routing`);
    else if (cutOff) transient(entry.error);
    if (ledger.charged >= maxCost) stop(`cost cap reached ($${maxCost})`);
    if (cutOff) throw Object.assign(Error(redact(cutOff.message)), { name: cutOff.name || 'Error' }); // as above: the name keeps a timeout a timeout
    return response;
  }
  // Stage S6: one request in the Anthropic mode, in guardedFetch's order: refused here after a stop or at a cap; reserved, counted and written to the
  // ledger before it is sent; settled when its answer comes, or never comes; then the stop rules.
  async function claudeFetch(url, init = {}) {
    if (state.stopped) throw refusal();
    if (ledger.requests >= maxRequests) { stop(`request cap reached (${maxRequests} provider requests)`); throw refusal(); }
    if (String(url) !== ANTHROPIC_MESSAGES || String(init.method || '').toUpperCase() !== 'POST') { stop(`a request to an unexpected address was refused (${String(init.method || 'GET').toUpperCase().slice(0, 10)} ${String(url).slice(0, 60)})`); throw refusal(); }
    let sent;
    try { init = { ...init, body: withMaxTokens(init.body) }; sent = JSON.parse(init.body); } catch { stop('a request whose body is not JSON was refused: its cost cannot be bounded'); throw refusal(); }
    if (sent?.model !== model) { stop(`a request to another model (${redact(sent?.model).slice(0, 60)}) was refused: the guard holds the prices of ${model} only`); throw refusal(); }
    if (sent.stream) { stop('a streaming request was refused: its cost is settled from a complete answer'); throw refusal(); }
    const worst = claudeWorstCaseOf(init.body, state.prices, sent);
    if (!(Number.isInteger(worst.outputTokens) && worst.outputTokens > 0)) { stop('the request carries no max_tokens, so its cost cannot be bounded'); throw refusal(); }
    if (maxOutputTokens !== null && ledger.outputTokens + state.reservedOutput + worst.outputTokens > maxOutputTokens) { stop(`output-token cap: ${ledger.outputTokens} output tokens already charged + max_tokens ${worst.outputTokens} of the next request > ${maxOutputTokens}`); throw refusal(); }
    if (ledger.charged + state.reserved + worst.dollars > maxCost) { stop(`cost cap: $${round(ledger.charged)} already charged + $${round(worst.dollars)} worst case of the next request > $${maxCost}`); throw refusal(); }
    if (register && register.others(registerKey) + ledger.charged + state.reserved + worst.dollars > register.cap) { stop(`total cap: $${round(register.others(registerKey) + ledger.charged)} already charged by every Claude ledger of the spend register + $${round(worst.dollars)} worst case of the next request > $${register.cap}`); throw refusal(); }
    state.reserved += worst.dollars; state.reservedOutput += worst.outputTokens;
    ledger.requests += 1; // counted before it is sent
    const entry = { n: ledger.requests, kind: 'model', at: new Date().toISOString(), worst: round(worst.dollars), inputBound: worst.inputTokens, maxTokens: worst.outputTokens, bodyBytes: Buffer.byteLength(init.body) };
    try { entry.ids = JSON.parse(sent.messages[0].content).document_data.map(p => p.id); } catch { /* not a checker request */ }
    if (onSend) onSend(entry, sent);
    ledger.entries.push(entry); httpLog.push(entry); saveLedger();
    // Settles the reservation: the dollars and output tokens charged, what the conservative rule charges, and the rule that charged it.
    const settle = (charged, conservative, rule, outputTokens) => {
      state.reserved -= worst.dollars; state.reservedOutput -= worst.outputTokens;
      ledger.charged += charged; ledger.conservative += conservative; ledger.outputTokens += outputTokens;
      Object.assign(entry, { charged: round(charged), conservativeCharge: round(conservative), accounting: rule });
    };
    const worstCharge = () => settle(worst.dollars, worst.dollars, 'worst_case', worst.outputTokens);
    // The adapter's deadline aborts a request (AbortError through the SDK, TimeoutError directly): either way a timeout.
    const abandoned = error => (['TimeoutError', 'AbortError'].includes(error?.name) ? 'timeout' : `network: ${redact(error && error.message).slice(0, 120)}`);
    const started = Date.now();
    let response;
    try { response = await send(url, init); } catch (error) {
      entry.ms = Date.now() - started; entry.error = abandoned(error);
      worstCharge(); // an abandoned request may still be billed
      saveLedger(); transient(entry.error);
      throw Object.assign(Error(redact(error && error.message)), { name: (error && error.name) || 'Error' }); // the name keeps a timeout a timeout
    }
    entry.ms = Date.now() - started; entry.status = response.status;
    entry.requestId = response.headers.get('request-id') ? redact(response.headers.get('request-id')).slice(0, 120) : null;
    entry.headers = Object.fromEntries([...response.headers].filter(([name]) => CLAUDE_HEADERS.test(name)).map(([name, value]) => [name, redact(value).slice(0, 200)]));
    // As for OpenRouter, an answer can be abandoned while it is read: a timeout or network error like one that never came.
    let body = null, cutOff = null;
    try { body = await response.clone().json(); } catch (error) { if (!error || error.name !== 'SyntaxError') cutOff = error || Error('the answer could not be read'); }
    if (cutOff) { entry.abandonedAfterMs = Date.now() - started; entry.error = abandoned(cutOff); }
    const budget = response.status >= 400 && budgetRefusal(response.status, body);
    if (response.status >= 400) {
      if (body?.error) Object.assign(entry, { errorType: String(body.error.type || '').slice(0, 60) || null, errorMessage: redact(body.error.message).slice(0, 200) || null });
      // A refusal of the request (4xx) is not billed; a server error (5xx, 504 the API's own timeout) may have been, so it is charged its worst case.
      if (response.status < 500) settle(0, 0, 'refused', 0); else worstCharge();
    } else {
      const c = !cutOff && body?.usage ? claudeChargeOf(body.usage, worst, state.prices, init.body) : null;
      if (!c) worstCharge(); // cut off, or without complete usage: what it cost is unknown
      else {
        settle(accounting === 'reconcile' ? c.charged : c.conservative, c.conservative, accounting === 'reconcile' ? 'reconciled' : 'conservative', c.output);
        entry.usage = { promptTokens: c.prompt, completionTokens: c.output, reasoningTokens: c.thinking, cachedTokens: c.read, reportedCost: null, costAtListPrices: round(c.atListPrices), estimatedCost: round(c.estimated), inputTokens: c.input, cacheCreationInputTokens: c.write, cacheCreation1hTokens: c.writeHour, cacheReadInputTokens: c.read, thinkingTokens: c.thinking, inferenceGeo: body.usage.inference_geo ?? null, serviceTier: body.usage.service_tier ?? null };
        if (c.prompt > worst.inputTokens || c.output > worst.outputTokens) stop(`request ${entry.n} used more tokens than its bound (${c.prompt} input of ${worst.inputTokens}, ${c.output} output of ${worst.outputTokens}): the cost bound no longer holds`);
        else if (c.charged > worst.dollars * 1.000001) stop(`request ${entry.n} was charged $${round(c.charged)} although its worst case was $${round(worst.dollars)}: the price assumption no longer holds`);
        if (body.usage.service_tier != null && body.usage.service_tier !== 'standard') stop(`request ${entry.n} was served at service tier ${redact(body.usage.service_tier).slice(0, 40)}, which the pinned prices do not cover`);
        if (body.usage.inference_geo != null && !['global', 'us'].includes(body.usage.inference_geo)) stop(`request ${entry.n} ran in inference geography ${redact(body.usage.inference_geo).slice(0, 40)}, which the pinned prices do not cover`);
      }
      // How the answer ended, the model that gave it, how many thinking blocks it had, and its text: only the text blocks, so no thinking is ever kept.
      if (body) {
        const blocks = Array.isArray(body.content) ? body.content : null;
        const text = blocks ? blocks.filter(block => block?.type === 'text').map(block => (typeof block.text === 'string' ? block.text : '')).join('') : null;
        Object.assign(entry, { provider: 'anthropic', modelReturned: typeof body.model === 'string' ? redact(body.model).slice(0, 80) : null, messageId: typeof body.id === 'string' ? body.id.slice(0, 80) : null, stopReason: body.stop_reason ?? null, ...(body.stop_reason === 'refusal' ? { stopCategory: body.stop_details?.category ?? null } : {}),
          thinkingBlocks: blocks ? blocks.filter(block => block?.type === 'thinking' || block?.type === 'redacted_thinking').length : null, content: text });
        if (entry.modelReturned && !sameModel(entry.modelReturned, model)) stop(`request ${entry.n} was answered by ${entry.modelReturned}, not ${model}: the pinned prices and this evaluation are for ${model} only`);
      }
      // An answer that arrived is checked as gemini.js checks it next, as for OpenRouter (the `check` hook, noteInvalid, noteAnswer).
      if (check && response.status === 200 && body && !cutOff) {
        const result = check(sent, entry), why = result && typeof result === 'object' ? result.invalid || null : result || null;
        const verifiedIds = result && typeof result === 'object' && Array.isArray(result.verified) ? result.verified : why ? [] : entry.ids || [];
        entry.verifiedIds = verifiedIds;
        if (why) entry.invalid = redact(why).slice(0, 200);
        noteAnswer({ verified: verifiedIds.length, invalid: why });
      }
    }
    saveLedger();
    if (budget) stop(`HTTP ${response.status}: a spend limit or an exhausted credit balance (${entry.errorMessage || 'no detail'})`);
    else if ([401, 402, 403].includes(response.status)) stop(`HTTP ${response.status} (credits, key or access)`);
    else if (response.status === 429 || response.status >= 500) transient(`HTTP ${response.status}`);
    else if (response.status >= 400) stop(`HTTP ${response.status}: the provider refused the request format or routing`);
    else if (cutOff) transient(entry.error);
    if (ledger.charged >= maxCost) stop(`cost cap reached ($${maxCost})`);
    if (cutOff) throw Object.assign(Error(redact(cutOff.message)), { name: cutOff.name || 'Error' });
    return response;
  }
  // The model's current prices from OpenRouter (USD per token), the highest of every endpoint that serves it: the worst case does not depend on routing.
  async function readPrices(model, apiKey) {
    if (anthropic) throw Error('the Anthropic mode charges the prices pinned in anthropicClient.js: there is nothing to look up');
    const response = await guardedFetch(`https://openrouter.ai/api/v1/models/${model}/endpoints`, { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const endpoints = (await response.json())?.data?.endpoints;
    if (!Array.isArray(endpoints) || !endpoints.length) throw Error('no endpoint is listed for the model');
    const num = v => (v === undefined || v === null || v === '' ? 0 : Number(v));
    const list = endpoints.map(e => ({ provider: redact(e.provider_name || e.name || '?').slice(0, 80), tag: e.tag ? redact(e.tag).slice(0, 80) : null, status: e.status ?? null, uptime30m: Number.isFinite(e.uptime_last_30m) ? e.uptime_last_30m : null, prompt: num(e.pricing?.prompt), completion: num(e.pricing?.completion), reasoning: num(e.pricing?.internal_reasoning), request: num(e.pricing?.request), cacheRead: num(e.pricing?.input_cache_read), cacheWrite: num(e.pricing?.input_cache_write), structuredOutputs: (e.supported_parameters || []).includes('structured_outputs') }));
    if (list.some(e => ![e.prompt, e.completion, e.reasoning, e.request, e.cacheWrite].every(v => Number.isFinite(v) && v >= 0))) throw Error('a listed price is not a number');
    const max = key => Math.max(...list.map(e => e[key]));
    const prices = { prompt: max('prompt'), completion: max('completion'), reasoning: max('reasoning'), request: max('request'), cacheWrite: max('cacheWrite'), endpoints: list, readAt: new Date().toISOString() };
    if (!(prices.prompt > 0 && prices.completion > 0)) throw Error('the listed prices are zero, but a paid model was expected');
    state.prices = prices;
    return prices;
  }
  // Stage E.7: is the key accepted? Its status from OpenRouter, without the label (it shows part of the key) or any other text the answer carries.
  // A refused key has already stopped the guard (401/402/403 above) when this returns.
  async function checkKey(apiKey) {
    if (anthropic) throw Error('the Anthropic mode has no key check: a refused key (HTTP 401) stops the evaluation at its first request, which bills nothing');
    const response = await guardedFetch(OPENROUTER_KEY, { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(30000) });
    const data = response.ok ? (await response.json().catch(() => null))?.data : null;
    const num = v => (Number.isFinite(v) ? v : null);
    return { status: response.status, ok: response.ok && !!data, freeTier: typeof data?.is_free_tier === 'boolean' ? data.is_free_tier : null, limit: num(data?.limit), limitRemaining: num(data?.limit_remaining), usage: num(data?.usage), expiresAt: typeof data?.expires_at === 'string' ? data.expires_at.slice(0, 40) : null };
  }
  const baseSummary = () => {
    const models = httpLog.filter(e => e.kind === 'model'), sum = key => models.reduce((n, e) => n + (e.usage?.[key] || 0), 0);
    const byRule = Object.fromEntries(['reconciled', 'conservative', 'worst_case', 'refused'].map(rule => [rule, models.filter(e => e.accounting === rule).length]));
    return { requests: ledger.requests, thisRun: httpLog.length, model: models.length, priceLookups: httpLog.filter(e => e.kind === 'price-lookup').length, keyChecks: httpLog.filter(e => e.kind === 'key-check').length, invalidAnswers: state.invalid, unproductiveInARow: state.unproductive, transient: state.transient, promptTokens: sum('promptTokens'), completionTokens: sum('completionTokens'), cachedTokens: sum('cachedTokens'), reportedCost: round(sum('reportedCost')), charged: round(ledger.charged),
      accounting: { rule: accounting, requests: byRule, chargedConservatively: round(ledger.conservative) }, warnings: [...state.warnings],
      limits: { maxRequests, maxCost, maxTransient, maxInvalid: maxInvalid === Infinity ? null : maxInvalid, warnInvalid, maxUnproductive: maxUnproductive === Infinity ? null : maxUnproductive, maxTokens }, stopped: state.stopped };
  };
  // Stage S6: what the Claude requests of this run used (Anthropic reports tokens, never a cost: reportedCost stays 0), the models that answered, how
  // their answers ended, their latency (answers that came; timeouts are counted apart), and the output-token and spend-register limits. thinkingTokens
  // adds up the counts the answers reported; thinkingReports counts the requests by what they reported (nonzero, zero, or unavailable: no count, or no
  // answer). The cost: atListPrices and estimatedCost (at the published prices, before and with data residency; requests whose usage is unknown are left
  // out and counted in notEstimated) next to chargedThisRun, what the guard counted against its caps.
  const claudeSummary = () => {
    const models = httpLog.filter(e => e.kind === 'model'), sum = key => models.reduce((n, e) => n + (e.usage?.[key] || 0), 0);
    const times = models.filter(e => Number.isFinite(e.ms) && e.status === 200 && !e.error).map(e => e.ms).sort((a, b) => a - b);
    const thinking = models.map(e => e.usage?.thinkingTokens ?? null);
    return { provider, model, prices: claudePriceTable(state.prices), modelsReturned: tally(models.map(e => e.modelReturned)), inputTokens: sum('inputTokens'), cacheCreationInputTokens: sum('cacheCreationInputTokens'), cacheReadInputTokens: sum('cacheReadInputTokens'), outputTokens: sum('completionTokens'), thinkingTokens: sum('thinkingTokens'),
      thinkingReports: { nonzero: thinking.filter(v => v > 0).length, zero: thinking.filter(v => v === 0).length, unavailable: thinking.filter(v => v === null).length }, thinkingBlocks: models.reduce((n, e) => n + (e.thinkingBlocks || 0), 0),
      atListPrices: round(sum('costAtListPrices')), estimatedCost: round(sum('estimatedCost')), notEstimated: models.filter(e => !e.usage && e.accounting === 'worst_case').length, chargedThisRun: round(models.reduce((n, e) => n + (e.charged || 0), 0)),
      outputTokensCharged: ledger.outputTokens, stopReasons: tally(models.map(e => e.stopReason)), refusalCategories: tally(models.filter(e => e.stopReason === 'refusal').map(e => e.stopCategory ?? 'none')),
      inferenceGeo: tally(models.map(e => e.usage?.inferenceGeo)), serviceTier: tally(models.map(e => e.usage?.serviceTier)), errors: tally(models.map(e => e.errorType || (e.error === 'timeout' ? 'timeout' : e.error ? 'network' : null))),
      latencyMs: times.length ? { answers: times.length, median: times[Math.floor((times.length - 1) / 2)], p90: times[Math.ceil(times.length * 0.9) - 1], max: times[times.length - 1] } : null,
      limits: { maxOutputTokens, register: register ? { cap: register.cap, chargedByEveryLedger: round(register.others(registerKey) + ledger.charged) } : null } };
  };
  const summary = () => (anthropic ? { ...baseSummary(), anthropic: claudeSummary() } : baseSummary());
  const setPrices = prices => { if (anthropic) throw Error('the Anthropic mode charges the prices pinned in anthropicClient.js'); state.prices = prices; };
  return { fetch: guardedFetch, readPrices, checkKey, setPrices, noteInvalid, noteAnswer, warn, stop, stopped: () => state.stopped, redact, worstCase: anthropic ? body => claudeWorstCaseOf(body, state.prices) : worstCase, inputBound, withMaxTokens, ledger, state, httpLog, saveLedger, summary, provider, release: () => register?.release() };
}
module.exports = { createGuard, closeLedger, reliableCost, ACCOUNTING, OPENROUTER_CHAT, OPENROUTER_KEY, DATA_MODULES, loadedDataModules, round,
  ANTHROPIC_MESSAGES, GEO_FACTOR, CACHE_READ_FLOOR, CLAUDE_ALLOWANCE, claudePrices, claudePriceTable, claudeWorstCaseOf, claudeChargeOf, describeClaudePrices, describeClaudeUsage, openSpendRegister };
