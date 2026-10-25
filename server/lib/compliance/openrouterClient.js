'use strict';
// An OpenRouter client for the AI step: `complete(prompt) -> string`, the shape LlmProvider (providers.js) expects. It only reaches
// OpenRouter when the AI Checker asks for recommendations, and what it sends is the provider's prompt (rule findings plus a short
// excerpt with names and emails masked, see recommend.js buildExcerpt). The key comes from OPENROUTER_API_KEY and is never logged or
// put in an error message.
const { ProviderError } = require('./providers');

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// The model comes from OPENROUTER_MODEL in .env (no built-in default, so switching models is only an .env change). Free models are rate
// limited, which is why 429 and 503 get one retry.
// Recommendations are a few short items, so the reply is capped to keep token use small. This model "thinks" before it answers, and at
// the default effort that thinking alone used a 1024-token cap and left no answer: low effort answers in about 600 tokens.
const MAX_OUTPUT_TOKENS = 2048;

function createOpenRouterClient({ apiKey, model, timeoutMs = 45000, retryDelayMs = 2000, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new ProviderError('not_configured', 'OPENROUTER_API_KEY is not set.');
  if (!model) throw new ProviderError('not_configured', 'OPENROUTER_MODEL is not set. Put the OpenRouter model id in .env (for example OPENROUTER_MODEL=vendor/model-name).');

  async function attempt(prompt, temperature) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature, max_tokens: MAX_OUTPUT_TOKENS, reasoning: { effort: 'low' } }),
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = err && err.name === 'AbortError';
      throw new ProviderError(timedOut ? 'timeout' : 'network', timedOut ? 'The AI model did not answer in time.' : 'OpenRouter could not be reached.');
    } finally {
      clearTimeout(timer);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ProviderError('http_' + res.status, 'OpenRouter answered ' + res.status + (body && body.error && body.error.message ? ': ' + String(body.error.message).slice(0, 160) : '.'));
    const msg = body && body.choices && body.choices[0] && body.choices[0].message;
    const out = msg && typeof msg.content === 'string' ? msg.content : '';
    if (!out.trim()) throw new ProviderError('empty', 'The AI model returned no text.');
    return out;
  }

  return {
    model,
    // `temperature` 0 gives the same answer for the same text as nearly as the model allows (judging the fields); 0.2 reads better (advice).
    async complete(prompt, { temperature = 0.2 } = {}) {
      try { return await attempt(prompt, temperature); } catch (err) {
        if (err.code !== 'http_503' && err.code !== 'http_429') throw err;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        return attempt(prompt, temperature);
      }
    },
  };
}

module.exports = { createOpenRouterClient };
