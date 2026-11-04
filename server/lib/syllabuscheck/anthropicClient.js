'use strict';
// The direct Anthropic Messages API transport (SYLLABUS_CHECK_AI_PROVIDER=anthropic), through the official SDK. It sends one question and returns the
// answer text and what the question used. The prompt, the schema and the verification of the answer stay with the callers (gemini.js, modelClient.js),
// exactly as for OpenRouter, so this provider changes only how a question travels.
//   - The key is handed to the SDK in code and the base URL is fixed: ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN or a credential profile can neither
//     redirect the key nor stand in for it, and every header ANTHROPIC_CUSTOM_HEADERS names is removed from the request. The SDK's logging, tracing,
//     trace propagation and own retries are off.
//   - Only a model whose request parameters were checked (MODELS) is asked, with its thinking mode and effort stated in every request. A combination
//     the API would refuse is refused here, before anything is sent.
//   - One deadline per question (ANTHROPIC_TIMEOUT_SEC). A question that timed out, here or at the API (HTTP 504), is never sent again: Anthropic may
//     already have billed it.
//   - Bounded retries (ANTHROPIC_MAX_RETRIES): only a rate limit (429), an overload (529), a server error (500, 502, 503) or a dropped connection,
//     after the wait the API asks for (retry-after) or an exponential one, and only while the deadline leaves time. A 4xx refusal is never sent again,
//     and neither is a spend limit or an exhausted credit balance (kind provider_budget), whatever its status.
//   - A schema Anthropic's structured outputs would refuse is refused here (anthropicSchema.js), before anything is sent.
//   - No error that leaves this file carries the key.
const { schemaProblems } = require('./anthropicSchema');
const API = 'https://api.anthropic.com';
const MODEL_ID = /^claude-[a-z0-9][a-z0-9.-]*$/;
const KEY_FORMAT = /^sk-ant-\S+$/;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const RETRY_STATUS = new Set([429, 500, 502, 503, 529]);
const MAX_WAIT_MS = 30000, MIN_ATTEMPT_MS = 10000; // a longer wait than MAX_WAIT_MS is not waited for; a retry needs MIN_ATTEMPT_MS of the deadline left
const inRange = (value, low, high, fallback) => { const n = Number.parseInt(value, 10); return Number.isInteger(n) && n >= low && n <= high ? n : fallback; };
// The models whose request parameters were checked against Anthropic's documentation on 2026-10-27. off: what turns thinking off on the model (null: it
// cannot be turned off, so ANTHROPIC_THINKING=off leaves the model not configured); effort: its default; efforts: the levels it accepts. Any other
// claude-* id is not configured, so no request goes out with parameters nobody checked.
const MODELS = {
  'claude-sonnet-5-5': { off: 'between_tools', effort: 'high', efforts: EFFORTS },
  'claude-haiku-5-5': { off: 'disabled', effort: 'medium', efforts: EFFORTS },
  'claude-opus-5-5': { off: null, effort: 'medium', efforts: EFFORTS },
  'claude-fable-5-1': { off: null, effort: 'high', efforts: EFFORTS },
  'claude-opus-5': { off: 'disabled', effort: 'high', efforts: EFFORTS },
  'claude-sonnet-5': { off: 'disabled', effort: 'high', efforts: EFFORTS },
  'claude-sonnet-4-6': { off: 'disabled', effort: 'high', efforts: ['low', 'medium', 'high', 'max'] },
};
// What an operator can tune, read for every question. A value out of range falls back to the default. No temperature: API version 2026-10-21 refuses
// sampling parameters on every model. ANTHROPIC_THINKING is adaptive (the default) or off.
function anthropicSettings(env = process.env) {
  const effort = String(env.ANTHROPIC_EFFORT || '').trim().toLowerCase(), thinking = String(env.ANTHROPIC_THINKING || '').trim().toLowerCase();
  return { timeoutMs: inRange(env.ANTHROPIC_TIMEOUT_SEC, 10, 300, 180) * 1000, maxRetries: inRange(env.ANTHROPIC_MAX_RETRIES, 0, 3, 2), maxTokens: inRange(env.ANTHROPIC_MAX_TOKENS, 1024, 16000, 16000),
    effort: EFFORTS.includes(effort) ? effort : null, thinking: thinking === 'off' ? 'off' : 'adaptive', cache: String(env.ANTHROPIC_PROMPT_CACHE || '').trim().toLowerCase() !== 'off' };
}
// The thinking and effort a request to `model` carries under these settings, both stated even where they are the model's default so that every result
// records them; or `problem` when the API would refuse them: the model is not verified, it does not take that effort, it cannot turn thinking off, or
// thinking is off at effort xhigh or max.
function requestConfigOf(model, settings) {
  const spec = Object.hasOwn(MODELS, model || '') ? MODELS[model] : null;
  if (!spec) return { problem: `${model || 'no model'} is not one of the Claude models this checker was verified with` };
  const effort = settings.effort || spec.effort;
  if (!spec.efforts.includes(effort)) return { problem: `${model} does not accept effort ${effort}` };
  if (settings.thinking !== 'off') return { thinking: { type: 'adaptive' }, effort };
  if (!spec.off) return { problem: `${model} cannot turn thinking off` };
  if (effort === 'xhigh' || effort === 'max') return { problem: `effort ${effort} needs thinking on` };
  return { thinking: { type: spec.off }, effort };
}
// Ready only with a key in Anthropic's own format, a verified claude-* model and settings that model accepts, so a key meant for another service is
// never sent to Anthropic and no request goes out that the API would refuse for its parameters.
const anthropicReady = (env = process.env) => KEY_FORMAT.test(env.ANTHROPIC_API_KEY || '') && MODEL_ID.test(env.ANTHROPIC_MODEL || '') && !requestConfigOf(env.ANTHROPIC_MODEL, anthropicSettings(env)).problem;
// The configuration a verdict is made under, for the reuse fingerprint (gemini.js pairKey): a verdict made with one thinking mode or effort is never
// reused under another.
function configKeyOf(env = process.env) {
  const config = requestConfigOf(env.ANTHROPIC_MODEL, anthropicSettings(env));
  return `${env.ANTHROPIC_MODEL || ''}|thinking=${config.thinking?.type || 'none'}|effort=${config.effort || 'none'}`;
}
// List prices in US$ per million tokens, as Anthropic's pricing page publishes them (platform.claude.com/docs/en/about-claude/pricing, checked on
// PRICES_AS_OF): input, output and cache read; a cache write is 1.25x the input price (5 minutes) or 2x (1 hour). Thinking is billed as output and is part
// of outputTokens. US-only inference (an answer that reports inference_geo "us") costs US_ONLY_FACTOR times every token. Claude Haiku 5.5 costs more once
// a prompt passes 100,000 tokens (LONG_PROMPT). They give the estimate a check reports next to its token counts, nothing more: Anthropic's invoice is
// what counts, and an estimate is never a spending limit. A model missing here gets its token counts and no estimate. The Claude Sonnet 5.5 and Claude
// Opus 5.5 cache reads are 0.05x the input price ($0.10 and $0.20). The evaluation guard (eval/providerGuard.js) charges against its caps a cache read
// at no less than 0.1x the input price, a margin above the published price kept on purpose.
const PRICES_AS_OF = '2026-10-27';
const US_ONLY_FACTOR = 1.1;
const PRICES = {
  'claude-fable-5-1': [10, 50, 0.25], 'claude-fable-5': [10, 50, 1], 'claude-opus-5-5': [4, 20, 0.2], 'claude-opus-5': [5, 25, 0.5], 'claude-opus-4-8': [5, 25, 0.5],
  'claude-opus-4-7': [5, 25, 0.5], 'claude-opus-4-6': [5, 25, 0.5], 'claude-sonnet-5-5': [2, 10, 0.1], 'claude-sonnet-5': [2, 10, 0.2], 'claude-sonnet-4-6': [3, 15, 0.3],
  'claude-haiku-5-5': [0.1, 0.5, 0.01], 'claude-haiku-4-5': [1, 5, 0.1],
};
const LONG_PROMPT = { 'claude-haiku-5-5': { over: 100000, price: [0.5, 2.5, 0.05] } };
const promptTokensOf = used => used.inputTokens + used.cacheCreationInputTokens + used.cacheReadInputTokens;
// The list price of one request to `model`: [input, output, cache read] per million tokens, or null for a model without one.
function priceOf(model, used) {
  const id = String(model || '').replace(/-\d{8}$/, ''), long = Object.hasOwn(LONG_PROMPT, id) ? LONG_PROMPT[id] : null;
  return long && promptTokensOf(used) > long.over ? long.price : Object.hasOwn(PRICES, id) ? PRICES[id] : null;
}
// The estimate at the published prices. writeHour: the cache-write tokens the answer says went to the 1-hour cache (2x the input price); inferenceGeo:
// the geography the answer reports ("us" costs US_ONLY_FACTOR times every token; "global", or none reported, the list price).
function estimateUsd(model, used, { writeHour = 0, inferenceGeo = null } = {}) {
  const price = priceOf(model, used);
  if (!price) return null;
  const [input, output, cacheRead] = price, hour = Math.min(writeHour, used.cacheCreationInputTokens);
  const usd = (used.inputTokens * input + (used.cacheCreationInputTokens - hour) * input * 1.25 + hour * input * 2 + used.cacheReadInputTokens * cacheRead + used.outputTokens * output) / 1e6;
  return Math.round(usd * (inferenceGeo === 'us' ? US_ONLY_FACTOR : 1) * 1e8) / 1e8;
}
const count = value => (Number.isFinite(value) && value > 0 ? value : 0);
// What one question used: the attempts it took (retries included) and the tokens of the answer that came back. thinkingTokens is the part of
// outputTokens spent thinking as the answer reports it (output_tokens_details.thinking_tokens), or null when it reports no count or no answer came: a
// missing count is never taken for 0 (outputTokens, which is billed, includes the thinking either way). A failed attempt bills no tokens, except one that
// timed out, whose tokens are unknown (timedOut). estimatedUsd is at the published prices of priceAsOf. `ending` says how it ended, once the API
// answered: requestId, stopReason and, for a refusal, stopCategory (which can be null).
function usageOf(model, usage, attempts, ending = {}) {
  const thinking = usage?.output_tokens_details?.thinking_tokens;
  const used = { attempts, inputTokens: count(usage?.input_tokens), outputTokens: count(usage?.output_tokens), thinkingTokens: Number.isInteger(thinking) && thinking >= 0 ? thinking : null,
    cacheCreationInputTokens: count(usage?.cache_creation_input_tokens), cacheReadInputTokens: count(usage?.cache_read_input_tokens) };
  const estimatedUsd = estimateUsd(model, used, { writeHour: count(usage?.cache_creation?.ephemeral_1h_input_tokens), inferenceGeo: usage?.inference_geo ?? null });
  return { ...used, estimatedUsd, priceAsOf: PRICES_AS_OF, ...ending };
}
const endingOf = (requestId, message) => ({ ...(requestId ? { requestId } : {}), ...(message?.stop_reason ? { stopReason: message.stop_reason } : {}),
  ...(message?.stop_reason === 'refusal' ? { stopCategory: message.stop_details?.category ?? null } : {}) });
// A spend limit (one the organisation or workspace set: HTTP 400; the usage tier's monthly cap: HTTP 429 enforced_spend_limit_reached) or a credit
// balance that has run out. Asking again cannot succeed until someone acts, so it is never retried, and gemini.js reports it as provider_budget.
function budgetRefusal(status, body) {
  const error = body?.error;
  return (status === 400 && /specified (?:workspace )?API usage limits|credit balance is too low/i.test(String(error?.message || ''))) || (status === 429 && error?.details?.error_code === 'enforced_spend_limit_reached');
}
// The headers the SDK would add from ANTHROPIC_CUSTOM_HEADERS (one "Name: value" per line), each set to null, which makes the SDK leave it out.
function customHeadersOff() {
  const off = {};
  for (const line of String(process.env.ANTHROPIC_CUSTOM_HEADERS || '').split('\n')) { const colon = line.indexOf(':'); if (colon >= 0) off[line.slice(0, colon).trim()] = null; }
  return off;
}
const redact = (text, key) => String(text || '').replaceAll(key || '\u0000', '[redacted]').replace(/sk-ant-[\w-]+/g, '[redacted]').slice(0, 500);
const numberOf = value => (value == null || String(value).trim() === '' ? NaN : Number(value));
// How long to wait before asking again: what the API asked for (retry-after-ms, or retry-after in seconds), else 1 s, 2 s, 4 s. null: too long to wait.
function waitOf(error, retry) {
  const ms = numberOf(error?.headers?.get?.('retry-after-ms')), seconds = numberOf(error?.headers?.get?.('retry-after'));
  const wait = ms >= 0 ? ms : seconds >= 0 ? seconds * 1000 : 1000 * 2 ** retry;
  return wait <= MAX_WAIT_MS ? wait : null;
}
// A dated snapshot of the requested alias (claude-haiku-4-5-20251001 for claude-haiku-4-5) is the same model; anything else is not.
const sameModel = (got, model) => got === model || (got.startsWith(model + '-') && /^\d{8}$/.test(got.slice(model.length + 1)));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let sdk; // loaded on first use: a server that never selects Anthropic never loads the SDK
function failureOf(error, status, key, tail, usage) {
  if (status) {
    const detail = redact(error.error?.error?.message, key);
    return Object.assign(Error(`Anthropic HTTP ${status}${detail ? ': ' + detail : ''}${tail}`), { status, requestId: error.requestID || null, usage, ...(budgetRefusal(status, error.error) ? { kind: 'provider_budget' } : {}) });
  }
  if (error instanceof sdk.APIConnectionError) return Object.assign(Error(`Anthropic connection failed${tail}`), { usage });
  return Object.assign(Error(`Anthropic request failed: ${redact(error?.message, key)}${tail}`), { usage });
}
// One question: `system` is cached (ANTHROPIC_PROMPT_CACHE=off turns it off) and the answer must match `schema` (structured outputs). `subject` names
// what is not evaluated when it fails ('alignment' for gemini.js). options.transport replaces fetch (tests); options.sleep and options.timeoutMs are for
// tests too. Returns { text, stopReason, stopCategory, model, requestId, latencyMs, usage }. Every error it throws after a request was sent carries
// `usage`: a refused or cut-off answer was billed all the same.
async function anthropicMessage({ model, system, user, schema, subject = '' }, { env = process.env, transport, sleep = pause, timeoutMs, signal, onRequest } = {}) {
  const key = env.ANTHROPIC_API_KEY;
  if (!KEY_FORMAT.test(key || '') || !MODEL_ID.test(model || '')) throw Error('Anthropic requires ANTHROPIC_API_KEY and a claude-* ANTHROPIC_MODEL');
  if (signal?.aborted) throw Object.assign(Error('AI checking was cancelled before all relationships were evaluated.'), { kind: 'request_cancelled', retryable: false, cause: signal.reason });
  const settings = anthropicSettings(env), config = requestConfigOf(model, settings);
  if (config.problem) throw Object.assign(Error(`Anthropic is not configured: ${config.problem}`), { kind: 'not_configured' });
  const limit = timeoutMs || settings.timeoutMs, tail = subject ? `; ${subject} not evaluated` : '';
  // Refused here as the API would refuse it (HTTP 400, provider_rejected), but without sending it.
  const problems = schemaProblems(schema);
  if (problems.length) throw Object.assign(Error(`Anthropic structured outputs cannot take this schema: ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? ` (and ${problems.length - 3} more)` : ''}${tail}`), { kind: 'provider_rejected' });
  sdk = sdk || require('@anthropic-ai/sdk');
  // A transport that refuses to send (an evaluation's guard, eval/providerGuard.js: error.refused) is obeyed at once: its refusal is passed on as it is,
  // never retried, and never reported as a timeout or a failed connection, which is what the SDK would make of it.
  let refused = null;
  const send = transport ? async (url, init) => { try { return await transport(url, init); } catch (error) { if (error?.refused) refused = error; throw error; } } : null;
  const client = new sdk.Anthropic({ apiKey: key, baseURL: API, maxRetries: 0, logLevel: 'off', openTelemetry: { traces: false, propagation: false }, defaultHeaders: customHeadersOff(), ...(send ? { fetch: send } : {}) });
  const body = { model, max_tokens: settings.maxTokens, thinking: config.thinking,
    system: [{ type: 'text', text: system, ...(settings.cache ? { cache_control: { type: 'ephemeral' } } : {}) }],
    messages: [{ role: 'user', content: user }],
    output_config: { effort: config.effort, format: { type: 'json_schema', schema } } };
  const started = Date.now(), deadline = started + limit;
  for (let attempt = 1; ; attempt += 1) {
    const remaining = Math.max(1, deadline - Date.now());
    // The SDK's own timeout covers the wait for the response headers; this signal covers the whole attempt, reading the answer included.
    const attemptSignal = signal ? AbortSignal.any([AbortSignal.timeout(remaining), signal]) : AbortSignal.timeout(remaining);
    const expired = new Promise((resolve, reject) => attemptSignal.addEventListener('abort', () => reject(attemptSignal.reason), { once: true }));
    expired.catch(() => {});
    let message;
    if (signal?.aborted) throw Object.assign(Error('AI checking was cancelled before all relationships were evaluated.'), { kind: 'request_cancelled', retryable: false, cause: signal.reason, usage: usageOf(model, null, attempt - 1) });
    // Reserve each SDK attempt immediately before it can reach the provider. Keep this outside the transport catch so a local budget refusal is
    // neither mistaken for an API error nor retried by the SDK wrapper.
    onRequest?.(body, body.max_tokens, attempt);
    try { message = await Promise.race([client.messages.create(body, { timeout: remaining, signal: attemptSignal }), expired]); } catch (error) {
      if (refused) throw attempt > 1 && !refused.usage ? Object.assign(refused, { usage: usageOf(model, null, attempt - 1) }) : refused; // the attempts before it were sent
      if (signal?.aborted) throw Object.assign(Error(`Anthropic request cancelled${tail}`), { kind: 'request_cancelled', retryable: false, cause: signal.reason, latencyMs: Date.now() - started, usage: usageOf(model, null, attempt) });
      if (attemptSignal.aborted || error instanceof sdk.APIConnectionTimeoutError) throw Object.assign(Error(`Anthropic request timed out after ${Math.round(limit / 1000)} s${tail}`), { name: 'TimeoutError', latencyMs: Date.now() - started, usage: { ...usageOf(model, null, attempt), timedOut: true } });
      const status = error instanceof sdk.APIError && Number.isInteger(error.status) ? error.status : null;
      const ending = endingOf(error?.requestID, null);
      // HTTP 504 is the API's own timeout: the question may have been processed and billed, so it is a timeout like ours and is never sent again.
      if (status === 504) throw Object.assign(failureOf(error, status, key, tail, { ...usageOf(model, null, attempt, ending), timedOut: true }), { name: 'TimeoutError', latencyMs: Date.now() - started });
      const retryable = status ? RETRY_STATUS.has(status) && !budgetRefusal(status, error.error) : error instanceof sdk.APIConnectionError;
      const wait = retryable && attempt <= settings.maxRetries ? waitOf(error, attempt - 1) : null;
      if (wait !== null && Date.now() + wait + MIN_ATTEMPT_MS <= deadline) { await sleep(wait); continue; }
      throw Object.assign(failureOf(error, status, key, tail, usageOf(model, null, attempt, ending)), { latencyMs: Date.now() - started });
    }
    const requestId = message._request_id || null, latencyMs = Date.now() - started;
    const usage = usageOf(model, message.usage, attempt, endingOf(requestId, message));
    const stopCategory = message.stop_reason === 'refusal' ? message.stop_details?.category ?? null : null;
    if (message.model && !sameModel(message.model, model)) throw Object.assign(Error(`Anthropic returned a different model${tail}`), { usage, requestId, latencyMs, modelReturned: redact(message.model, key).slice(0, 80) });
    const text = (message.content || []).filter(block => block?.type === 'text').map(block => block.text || '').join('');
    if (message.stop_reason !== 'end_turn' || !text) throw Object.assign(Error(`Anthropic returned incomplete ${subject ? subject + ' ' : ''}output (stop_reason ${message.stop_reason || 'none'})`), { unverified: true, code: 'incomplete_output', usage, requestId, latencyMs, stopReason: message.stop_reason || null, stopCategory });
    return { text, stopReason: message.stop_reason, stopCategory, model: message.model || model, requestId, latencyMs, usage };
  }
}
module.exports = { anthropicMessage, anthropicSettings, anthropicReady, requestConfigOf, configKeyOf, estimateUsd, priceOf, usageOf, budgetRefusal, customHeadersOff, sameModel, MODELS, EFFORTS, PRICES, LONG_PROMPT, PRICES_AS_OF, US_ONLY_FACTOR, MODEL_ID, KEY_FORMAT, API };
