'use strict';
// Re-planned AI Checker, Phase 3: the provider the pipeline asks (judge.js `ask`, plan.js `rewrite`), on Claude through the existing direct transport
// (anthropicClient.js): verified models only, the key never leaves that file, structured outputs checked before sending, bounded retries, a timed-out
// question never sent again. This file adds:
//   - a COST CAP that cannot be left out (spendCap below): a request is sent only while what was already spent, plus that request's worst case, fits
//     under the cap. Its reservation is released when the answer settles at the cost it reports. Without a positive cap nothing is sent;
//   - a usage record (requests, tokens, estimate at the published prices; never the invoice);
//   - the reuse key's model part: the model with its thinking mode and effort (anthropicClient.js configKeyOf), so an answer made under one
//     configuration is never reused under another.
// The system blocks (rules, then the syllabus context) are the same for every request of a check, so Anthropic's prompt cache serves them after the
// first request (ANTHROPIC_PROMPT_CACHE).
const { anthropicMessage, anthropicReady, configKeyOf, priceOf, US_ONLY_FACTOR } = require('../anthropicClient');

const round = value => Math.round(value * 1e8) / 1e8;

// The cap on what one run may spend. Unlike a reservation that only ever grows, a settled request counts at what it cost, so a $2 cap is not used
// up by the 16,000-token worst cases of requests that cost a cent. Worst case of a request: every byte of its body as an input token (a token is at
// least one byte) at the highest input-side price (a cache write, 1.25x input), plus max_tokens at the output price, times the data-residency factor.
// A request whose cost is unknown afterwards (a timeout: it may have been billed) settles at its worst case.
function spendCap({ maxCostUsd, maxRequests, model }) {
  const state = { spent: 0, reserved: 0, requests: 0, refused: 0, stopReason: null };
  const worstOf = (body, maxTokens) => {
    const bytes = Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body ?? {}), 'utf8');
    const price = priceOf(model, { inputTokens: bytes, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, outputTokens: maxTokens }) || [15, 75];
    return (bytes * price[0] * 1.25 + (Number(maxTokens) || 0) * price[1]) / 1e6 * US_ONLY_FACTOR;
  };
  const refuse = reason => { state.refused += 1; state.stopReason ||= reason; return Object.assign(Error(`The re-planned checker's ${reason === 'request_limit' ? 'request' : 'cost'} cap is reached; the request was not sent.`), { kind: 'request_budget', retryable: false, budgetReason: reason }); };
  return {
    // Called by anthropicMessage immediately before each attempt is sent (onRequest). Throws to keep the attempt from being sent.
    reserve(body, maxTokens) {
      if (state.requests >= maxRequests) throw refuse('request_limit');
      const worst = worstOf(body, maxTokens);
      if (state.spent + state.reserved + worst > maxCostUsd) throw refuse('cost_budget');
      state.requests += 1;
      state.reserved += worst;
      return worst;
    },
    // When the request ends (answer or error): release what it reserved and count what it cost.
    settle(worst, used) {
      state.reserved = Math.max(0, state.reserved - worst);
      const cost = used && Number.isFinite(used.estimatedUsd) && !used.timedOut ? used.estimatedUsd : worst;
      state.spent = round(state.spent + cost);
    },
    summary: () => ({ maxCostUsd, maxRequests, requests: state.requests, spentUsd: state.spent, refused: state.refused, stopReason: state.stopReason, remainingUsd: round(Math.max(0, maxCostUsd - state.spent)) }),
  };
}

// opts: env (the ANTHROPIC_* settings), maxCostUsd (required, > 0), maxRequests (default 80), transport (an evaluation guard's fetch, or a test
// double), send (replaces anthropicMessage; tests).
function claudeProvider({ env = process.env, maxCostUsd, maxRequests = 80, transport, send = anthropicMessage } = {}) {
  if (!(Number.isFinite(maxCostUsd) && maxCostUsd > 0)) return { ready: false, reason: 'a cost cap (maxCostUsd > 0) is required' };
  if (!anthropicReady(env)) return { ready: false, reason: 'Anthropic is not configured (ANTHROPIC_API_KEY and a verified ANTHROPIC_MODEL)' };
  const model = env.ANTHROPIC_MODEL;
  const cap = spendCap({ maxCostUsd, maxRequests, model });
  const usage = { judgeRequests: 0, rewriteRequests: 0, failures: 0, inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, estimatedUsd: 0, unpriced: 0 };
  const record = used => {
    if (!used) return;
    for (const key of ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens']) usage[key] += Number(used[key]) || 0;
    if (Number.isFinite(used.estimatedUsd)) usage.estimatedUsd = round(usage.estimatedUsd + used.estimatedUsd); else if (used.attempts) usage.unpriced += 1;
  };
  const call = async (message, kind) => {
    usage[kind === 'judge' ? 'judgeRequests' : 'rewriteRequests'] += 1;
    let reserved = 0; // the worst cases of the attempts actually sent (a retry reserves again)
    const onRequest = (body, maxTokens) => { reserved += cap.reserve(body, maxTokens); };
    try {
      const reply = await send({ model, system: message.system, user: message.user, schema: message.schema, subject: 're-planned ' + kind }, { env, transport, onRequest });
      record(reply.usage);
      cap.settle(reserved, reply.usage);
      return reply.text;
    } catch (error) {
      usage.failures += 1;
      record(error && error.usage);
      if (reserved) cap.settle(reserved, error && error.usage);
      throw error;
    }
  };
  return {
    ready: true, model: configKeyOf(env),
    ask: message => call(message, 'judge'),
    rewrite: message => call(message, 'rewrite'),
    usage: () => ({ ...usage, budget: cap.summary() }),
  };
}

module.exports = { claudeProvider, spendCap };
