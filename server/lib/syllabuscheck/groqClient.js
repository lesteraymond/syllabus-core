'use strict';
// The direct Groq API (console.groq.com), OpenAI-compatible: POST https://api.groq.com/openai/v1/chat/completions with GROQ_API_KEY.
// Checked against Groq's documentation on 2026-11-10:
//   - Structured Outputs (json_schema, strict) are listed for openai/gpt-oss-20b and openai/gpt-oss-120b; JSON Object Mode works on every model.
//     The checker uses JSON Object Mode with the schema in the prompt (the same as DeepSeek), so the server-side checks of the answer (verifyAnswer)
//     are the only authority and a model that ignores the schema is refused, never trusted;
//   - the published base limits of the gpt-oss models are 30 requests/min, 1K requests/day, 8K tokens/min and 200K tokens/day. One checker request
//     of twelve relationships (about 3.8K tokens in) plus an 8K answer cannot fit 8K tokens/min, so a Groq request carries a smaller answer ceiling,
//     the checker sends four relationships at a time, one request at a time, and waits a minute after a rate limit (gemini.js batchSizeOf,
//     concurrencyOf, cooldownOf). Limits differ by account: https://console.groq.com/settings/limits shows yours.
// Experimental: a Groq check counts as a verified check only for the model an operator approves by name (SYLLABUS_CHECK_GROQ_APPROVED_MODEL).
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODELS = new Set(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const MAX_TOKENS = 4096; // the requested answer counts toward the tokens-per-minute limit, so it is kept below the 8K limit with the prompt
const BATCH = 4;

const modelOf = (env = process.env) => String(env.GROQ_MODEL || DEFAULT_MODEL).trim();
const supported = model => MODELS.has(String(model || ''));
const approved = (env, model) => !!model && String(env.SYLLABUS_CHECK_GROQ_APPROVED_MODEL || '').trim() === model;
// gpt-oss reasons before it answers and the reasoning counts against the answer ceiling: low effort by default (GROQ_REASONING_EFFORT low|medium|high).
const effortOf = (env = process.env) => { const v = String(env.GROQ_REASONING_EFFORT || '').trim().toLowerCase(); return ['low', 'medium', 'high'].includes(v) ? v : 'low'; };
const configKeyOf = (env = process.env) => `${modelOf(env)}:reasoning-${effortOf(env)}`;
const jsonInstruction = schema => `\nReturn only a json object matching this JSON schema: ${JSON.stringify(schema)}\nNever include markdown fences.`;

// A per-minute rate limit (HTTP 429, "tokens per minute") is waited out and the same request sent again: Groq says how long ("try again in 18.7s", or a
// Retry-After header). A per-day limit, or a wait longer than MAX_WAIT_MS, is not waited out: the request fails with the status and the reason.
const MAX_RETRIES = 8, MAX_WAIT_MS = 90000;
function waitOf(response, message) {
  const header = Number(response.headers?.get?.('retry-after'));
  if (Number.isFinite(header) && header > 0) return header * 1000;
  const m = /try again in (?:(\d+)m)?\s*(\d+(?:\.\d+)?)s/i.exec(message || '');
  return m ? ((Number(m[1] || 0) * 60) + Number(m[2])) * 1000 : null;
}
// One chat completion. Returns { text, usage, model }. A cut-off, empty or blank answer throws an error marked unverified (never read as a verdict).
async function groqChat({ model, system, user, maxTokens = MAX_TOKENS }, { env = process.env, transport = fetch, signal, timeoutMs = 90000, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (!supported(model)) throw Error('Unsupported Groq model');
  if (!env.GROQ_API_KEY) throw Object.assign(Error('Groq requires GROQ_API_KEY.'), { status: 503 });
  for (let attempt = 0; ; attempt++) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await transport(ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    body: JSON.stringify({ model, temperature: 0, stream: false, max_completion_tokens: maxTokens, reasoning_effort: effortOf(env), response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const failure = await response.json();
      const message = failure?.error?.message;
      if (typeof message === 'string') detail = message.replaceAll(env.GROQ_API_KEY || '\u0000', '[redacted]').slice(0, 500);
    } catch { /* the HTTP status alone is enough when there is no JSON error */ }
    const wait = response.status === 429 && !/per day|\bTPD\b|\bRPD\b/i.test(detail) ? waitOf(response, detail) : null;
    if (wait !== null && wait <= MAX_WAIT_MS && attempt < MAX_RETRIES) { await sleep(Math.ceil(wait) + 1000); continue; }
    throw Error(`Groq HTTP ${response.status}${detail ? ': ' + detail : ''}`);
  }
  const body = await response.json();
  if (body.error) throw Error('Groq returned an error');
  const choice = body.choices?.[0];
  const text = choice?.message?.content;
  if (!choice || (choice.finish_reason && choice.finish_reason !== 'stop') || typeof text !== 'string' || !text.trim()) {
    throw Object.assign(Error('Groq returned incomplete output'), { unverified: true, code: 'incomplete_output' });
  }
  return { text, usage: body.usage || null, model: body.model || model };
  }
}

module.exports = { ENDPOINT, MODELS, DEFAULT_MODEL, MAX_TOKENS, BATCH, modelOf, supported, approved, effortOf, configKeyOf, jsonInstruction, groqChat };
