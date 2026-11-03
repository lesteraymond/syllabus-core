'use strict';
// One JSON question to the configured model, for requests that are not alignment judgements (a rewrite of a field). The alignment requests
// in gemini.js keep their own transport; this uses the same provider settings, endpoints, key handling and failure behaviour:
//   - an answer that arrives but cannot be read (broken JSON, a cut-off reply) is marked `unverified`, so a caller may ask again;
//   - transport, HTTP and quota failures carry no such mark and are never retried here.
const { providerConfig, NEMOTRON_FREE, LAGUNA_FREE, freeJsonModel, timeoutOf } = require('./gemini');
const { anthropicMessage } = require('./anthropicClient');

// `schema(native)` builds the JSON schema: native Gemini wants upper-case type names, OpenRouter and Anthropic want additionalProperties: false.
async function askJson({ system, payload, schema, name = 'answer', maxTokens = 4096 }, { env = process.env, transport = fetch, onUsage, sleep } = {}) {
  const { provider, model, configured } = providerConfig(env);
  if (!configured) throw Object.assign(new Error('No active AI provider is configured.'), { status: 503 });
  let text;
  if (provider === 'anthropic') {
    // The direct Anthropic API (anthropicClient.js): its own deadline, bounded retries and redaction. ANTHROPIC_MAX_TOKENS caps the answer, not maxTokens:
    // on a model that thinks by default the thinking counts against the cap. options.onUsage receives what the request used.
    let answer;
    try { answer = await anthropicMessage({ model, system, user: JSON.stringify(payload), schema: schema(false) }, { env, transport, sleep }); } catch (error) { if (error.usage) onUsage?.(error.usage); throw error; }
    onUsage?.(answer.usage);
    text = answer.text;
  } else if (provider === 'openrouter') {
    const freeJson = freeJsonModel(model);
    const systemPrompt = freeJson ? `${system}\nReturn only a JSON object matching this schema: ${JSON.stringify(schema(false))}\nNever include markdown fences.` : system;
    const response = await transport('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(timeoutOf(model, env)),
      body: JSON.stringify({ model, temperature: 0, stream: false, max_tokens: maxTokens,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: JSON.stringify(payload) }],
        response_format: freeJson ? { type: 'json_object' } : { type: 'json_schema', json_schema: { name, strict: true, schema: schema(false) } },
        ...(model === NEMOTRON_FREE ? { reasoning: { effort: 'low' } } : model === LAGUNA_FREE ? { reasoning: { enabled: false } } : {}), // Laguna returns a null content while reasoning
        provider: { // Nemotron's free provider does not advertise JSON mode, so requiring it matches no endpoint (404); the answer is verified server-side instead.
        ...(freeJson ? {} : { require_parameters: true }), ...(freeJson ? { allow_fallbacks: false, max_price: { prompt: 0, completion: 0 } } : {}) },
      }),
    });
    if (!response.ok) {
      let detail = '';
      try {
        const failure = await response.json();
        if (typeof failure.error?.message === 'string') detail = failure.error.message.replaceAll(env.OPENROUTER_API_KEY || '\u0000', '[redacted]').slice(0, 500);
      } catch { /* the HTTP status alone is enough when there is no JSON error */ }
      throw Error(`OpenRouter HTTP ${response.status}${detail ? ': ' + detail : ''}`);
    }
    const body = await response.json();
    if (body.error) throw Error('OpenRouter returned an error');
    if (body.model && body.model !== model && !(freeJson && body.model === model.replace(/:free$/, ''))) throw Error('OpenRouter returned a different model');
    const choice = body.choices?.[0];
    if (!choice || (choice.finish_reason && choice.finish_reason !== 'stop') || typeof choice.message?.content !== 'string') throw Object.assign(Error('OpenRouter returned incomplete output'), { unverified: true });
    text = choice.message.content;
  } else {
    const geminiModel = env.GEMINI_MODEL || 'gemini-3.8-flash';
    const response = await transport(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema(true) } }),
    });
    if (!response.ok) throw Error(`Gemini HTTP ${response.status}`);
    const body = await response.json();
    text = body.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('');
  }
  try { return JSON.parse(text); } catch (error) { throw Object.assign(error, { unverified: true }); }
}

module.exports = { askJson };
