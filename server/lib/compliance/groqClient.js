'use strict';
// A Groq client for the AI step: `complete(prompt) -> string`, the shape LlmProvider (providers.js) expects. Groq's API is OpenAI-compatible.
// It only reaches Groq when the AI Checker asks for the AI's help, and what it sends is the provider's prompt (rule findings plus a short
// excerpt with names and emails masked, see recommend.js buildExcerpt). The key comes from GROQ_API_KEY and the model from GROQ_MODEL, both
// in .env (no built-in model, so switching models is only an .env change); neither is logged or put in an error message.
const { ProviderError } = require('./providers');

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_OUTPUT_TOKENS = 2048;

function createGroqClient({ apiKey, model, timeoutMs = 45000, retryDelayMs = 2000, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new ProviderError('not_configured', 'GROQ_API_KEY is not set.');
  if (!model) throw new ProviderError('not_configured', 'GROQ_MODEL is not set. Put the Groq model id in .env (for example GROQ_MODEL=llama-3.3-70b-versatile).');

  async function attempt(prompt, temperature) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature, max_tokens: MAX_OUTPUT_TOKENS }),
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = err && err.name === 'AbortError';
      throw new ProviderError(timedOut ? 'timeout' : 'network', timedOut ? 'The AI model did not answer in time.' : 'Groq could not be reached.');
    } finally {
      clearTimeout(timer);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ProviderError('http_' + res.status, 'Groq answered ' + res.status + (body && body.error && body.error.message ? ': ' + String(body.error.message).slice(0, 160) : '.'));
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

module.exports = { createGroqClient };
