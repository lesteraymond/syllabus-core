'use strict';
// The direct DeepSeek API (platform.deepseek.com), OpenAI-compatible: POST https://api.deepseek.com/chat/completions with DEEPSEEK_API_KEY.
// Checked against DeepSeek's API documentation on 2026-11-10:
//   - models: deepseek-v4-pro (DeepSeek-V4-Pro-0813) and deepseek-flash (DeepSeek-V4.1-Flash-1017); both support JSON output and optional thinking;
//   - JSON output is response_format {"type":"json_object"} only (no strict json_schema), and the prompt must contain the word "json" with an example
//     of the structure. The API may return a content of spaces when the model's output is not valid JSON, even with finish_reason "stop": that is an
//     incomplete answer here, never an empty pass;
//   - thinking is ON by default; "thinking": {"type": "disabled"} turns it off. In thinking mode temperature is ignored.
// The checker turns thinking off by default (a judgement against fixed tests, temperature 0, a bounded answer, lower cost). DEEPSEEK_THINKING=on turns it
// on with reasoning_effort low. Experimental: a DeepSeek check counts as a verified check only for the model an operator approves by name
// (SYLLABUS_CHECK_DEEPSEEK_APPROVED_MODEL, gemini.js verifiedAlignment), as for Claude.
const ENDPOINT = 'https://api.deepseek.com/chat/completions';
const MODELS = new Set(['deepseek-v4-pro', 'deepseek-flash']);
const DEFAULT_MODEL = 'deepseek-v4-pro';
const MAX_TOKENS = 8192;

const modelOf = (env = process.env) => String(env.DEEPSEEK_MODEL || DEFAULT_MODEL).trim();
const supported = model => MODELS.has(String(model || ''));
const thinkingOn = (env = process.env) => String(env.DEEPSEEK_THINKING || '').trim().toLowerCase() === 'on';
// What a request carries about thinking; part of the reuse key (gemini.js), so an answer given with thinking is never reused for one without it.
const thinkingOf = (env = process.env) => (thinkingOn(env) ? { thinking: { type: 'enabled' }, reasoning_effort: 'low' } : { thinking: { type: 'disabled' } });
const configKeyOf = (env = process.env) => `${modelOf(env)}:thinking-${thinkingOn(env) ? 'low' : 'off'}`;
const approved = (env, model) => !!model && String(env.SYLLABUS_CHECK_DEEPSEEK_APPROVED_MODEL || '').trim() === model;
// The JSON-output contract of the API: the word "json" and the structure in the prompt.
const jsonInstruction = schema => `\nReturn only a json object matching this JSON schema: ${JSON.stringify(schema)}\nNever include markdown fences.`;

// One chat completion. Returns { text, usage, model }. A transport failure throws; an answer that is cut off, empty or blank throws an error marked
// unverified (retried by the caller, never read as a verdict).
async function deepseekChat({ model, system, user, maxTokens = MAX_TOKENS }, { env = process.env, transport = fetch, signal, timeoutMs = 240000 } = {}) {
  if (!supported(model)) throw Error('Unsupported DeepSeek model');
  if (!env.DEEPSEEK_API_KEY) throw Object.assign(Error('DeepSeek requires DEEPSEEK_API_KEY.'), { status: 503 });
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await transport(ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    body: JSON.stringify({ model, temperature: 0, stream: false, max_tokens: maxTokens, response_format: { type: 'json_object' }, ...thinkingOf(env),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const failure = await response.json();
      const message = failure?.error?.message;
      if (typeof message === 'string') detail = message.replaceAll(env.DEEPSEEK_API_KEY || '\u0000', '[redacted]').slice(0, 500);
    } catch { /* the HTTP status alone is enough when there is no JSON error */ }
    throw Error(`DeepSeek HTTP ${response.status}${detail ? ': ' + detail : ''}`);
  }
  const body = await response.json();
  if (body.error) throw Error('DeepSeek returned an error');
  const choice = body.choices?.[0];
  const text = choice?.message?.content;
  if (!choice || (choice.finish_reason && choice.finish_reason !== 'stop') || typeof text !== 'string' || !text.trim()) {
    throw Object.assign(Error('DeepSeek returned incomplete output'), { unverified: true, code: 'incomplete_output' });
  }
  return { text, usage: body.usage || null, model: body.model || model };
}

module.exports = { ENDPOINT, MODELS, DEFAULT_MODEL, MAX_TOKENS, modelOf, supported, thinkingOn, thinkingOf, configKeyOf, approved, jsonInstruction, deepseekChat };
