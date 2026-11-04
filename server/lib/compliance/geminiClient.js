'use strict';
// A Gemini client for the AI step: `complete(prompt) -> string`, the shape LlmProvider (providers.js) expects. It only reaches Google when
// the AI Checker asks for recommendations, and what it sends is the provider's prompt (rule findings plus a short excerpt with names and
// emails masked, see recommend.js buildExcerpt). The key comes from GEMINI_API_KEY and is never logged or put in an error message.
const { ProviderError } = require('./providers');

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
// The cheapest fast model (about 4 s; gemini-3.8-flash took 45 s or more). Google retires model names (gemini-2.0-flash and
// gemini-2.5-flash both answer 404 now); GEMINI_MODEL changes it without a code change.
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
// Recommendations are a few short items, so the reply is capped to keep token use small.
const MAX_OUTPUT_TOKENS = 1024;

function createGeminiClient({ apiKey, model = DEFAULT_MODEL, timeoutMs = 45000, retryDelayMs = 2000, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new ProviderError('not_configured', 'GEMINI_API_KEY is not set.');

  async function attempt(prompt, temperature) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(ENDPOINT + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature, maxOutputTokens: MAX_OUTPUT_TOKENS, responseMimeType: 'application/json' } }),
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = err && err.name === 'AbortError';
      throw new ProviderError(timedOut ? 'timeout' : 'network', timedOut ? 'Gemini did not answer in time.' : 'Gemini could not be reached.');
    } finally {
      clearTimeout(timer);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ProviderError('http_' + res.status, 'Gemini answered ' + res.status + (body && body.error && body.error.message ? ': ' + String(body.error.message).slice(0, 160) : '.'));
    const parts = body && body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts;
    const out = Array.isArray(parts) ? parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('') : '';
    if (!out.trim()) throw new ProviderError('empty', 'Gemini returned no text.');
    return out;
  }

  return {
    model,
    // Gemini answers 503 ("high demand") in short spikes: try once more after a pause before giving up.
    // `temperature` 0 gives the same answer for the same text as nearly as the model allows (judging the fields); 0.2 reads better (advice).
    async complete(prompt, { temperature = 0.2 } = {}) {
      try { return await attempt(prompt, temperature); } catch (err) {
        if (err.code !== 'http_503') throw err;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        return attempt(prompt, temperature);
      }
    },
  };
}

module.exports = { createGeminiClient, DEFAULT_MODEL };
