'use strict';
// The Phase 3 oracle (phase3/oracle.js, an offline OpenRouter mock) replayed as Anthropic's Messages API, for the evaluation's parity checks: the same
// answers reach gemini.js through the Anthropic adapter (anthropicClient.js and the official SDK), so a difference in what is verified, scored or
// recommended can only come from the provider path, never from the answers. Never makes a network call.
//   - The SDK's POST to https://api.anthropic.com/v1/messages becomes the oracle's chat/completions body: the system prompt, the user message and the
//     strict schema of the request, unchanged.
//   - The oracle's answer becomes a Messages API response: a thinking block first when the thinking mode has one (its text is never meant to be read),
//     then the text; stop_reason end_turn, or max_tokens for the oracle's cut-off answer (finish_reason length); usage from the oracle's token counts.
//     options.thinking says how the answer thinks and reports it (THINKING_MODES): 'reported' (true) a thinking block, THINKING_TOKENS more output
//     tokens and their count in usage.output_tokens_details.thinking_tokens; 'zero' no block and a count of 0; 'unreported' the block and the tokens
//     without any count; 'absent' (false, the default) neither.
//   - Faults: an oracle HTTP error becomes Anthropic's error body with that status, and the oracle's timeout becomes a request that never answers, so the
//     adapter's own deadline ends it. options.fault(n, ids) adds the faults only Anthropic has, for the n-th request (1-based, retries included) asking
//     for the relationships `ids`; it returns null or one of:
//       { status, type?, message?, details?, headers? }  an HTTP error in Anthropic's error body (a spend limit's details.error_code, a retry-after header)
//       { stop: 'refusal' | 'max_tokens', category? }    the oracle's answer, ended this way (a refusal carries stop_details.category)
//       { hang: true }                                  no answer at all, until the adapter's deadline ends the request
//       { drop: true }                                  a dropped connection
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ERROR_TYPES = { 400: 'invalid_request_error', 401: 'authentication_error', 402: 'billing_error', 403: 'permission_error', 404: 'not_found_error', 413: 'request_too_large', 429: 'rate_limit_error', 500: 'api_error', 504: 'timeout_error', 529: 'overloaded_error' };
const THINKING_TOKENS = 50;
const THINKING_MODES = { reported: { block: true, count: true }, zero: { block: false, count: true }, unreported: { block: true, count: false }, absent: { block: false, count: false } };
// The OpenRouter body the oracle reads, from an Anthropic Messages request.
function routerBodyOf(body) {
  const system = (Array.isArray(body.system) ? body.system : []).map(block => block?.text || '').join('');
  const user = typeof body.messages?.[0]?.content === 'string' ? body.messages[0].content : '';
  return { model: body.model, temperature: 0, stream: false, max_tokens: body.max_tokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: { name: 'syllabus_alignment', strict: true, schema: body.output_config?.format?.schema } } };
}
const reply = (body, status, requestId, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': requestId, ...headers } });
const hang = signal => new Promise((resolve, reject) => signal?.addEventListener('abort', () => reject(signal.reason || new Error('aborted')), { once: true }));
const idsOf = body => { try { return (JSON.parse(body.messages?.[0]?.content || '{}').document_data || []).map(pair => pair?.id); } catch { return []; } };
// options.thinking: the thinking mode, above; options.model: the model the answers name (default: the one asked for); options.fault: above.
function createAnthropicReplay(oracle, { thinking = false, model: answeredModel = null, fault: faultOf = null } = {}) {
  const modeName = thinking === true ? 'reported' : thinking === false ? 'absent' : String(thinking);
  if (!Object.hasOwn(THINKING_MODES, modeName)) throw Error(`the replay's thinking mode must be one of ${Object.keys(THINKING_MODES).join(', ')}, not ${modeName.slice(0, 40)}`);
  const mode = THINKING_MODES[modeName], calls = [];
  async function transport(url, init = {}) {
    if (String(url) !== ANTHROPIC_URL) throw new Error(`Unexpected provider URL in the Anthropic replay: ${url}`);
    const body = JSON.parse(init.body || '{}'), requestId = `req_replay_${calls.length + 1}`, pairIds = idsOf(body);
    const fault = typeof faultOf === 'function' ? faultOf(calls.length + 1, pairIds) : null;
    calls.push({ requestId, pairIds, fault: fault ? fault.status || fault.stop || (fault.hang ? 'hang' : 'drop') : null, model: body.model, maxTokens: body.max_tokens, thinking: body.thinking, effort: body.output_config?.effort, format: body.output_config?.format?.type, keys: Object.keys(body).sort() });
    if (fault?.hang) return hang(init.signal);
    if (fault?.drop) throw new TypeError('fetch failed (a dropped connection, replayed)');
    if (fault?.status) return reply({ type: 'error', error: { type: fault.type || ERROR_TYPES[fault.status] || 'api_error', message: fault.message || `HTTP ${fault.status}`, ...(fault.details ? { details: fault.details } : {}) }, request_id: requestId }, fault.status, requestId, fault.headers);
    let answer;
    try {
      answer = await oracle.transport(ROUTER_URL, { method: 'POST', body: JSON.stringify(routerBodyOf(body)) });
    } catch (error) {
      if (error?.name !== 'TimeoutError') throw error;
      return hang(init.signal);
    }
    const data = await answer.json();
    if (!answer.ok) return reply({ type: 'error', error: { type: ERROR_TYPES[answer.status] || 'api_error', message: data?.error?.message || `HTTP ${answer.status}` }, request_id: requestId }, answer.status, requestId);
    const choice = data.choices?.[0] || {}, extra = mode.block ? THINKING_TOKENS : 0;
    const content = [...(mode.block ? [{ type: 'thinking', thinking: 'Replayed thinking block: never read and never kept.', signature: 'replay' }] : []), { type: 'text', text: choice.message?.content ?? '' }];
    const stop = fault?.stop || (choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn');
    return reply({ id: `msg_replay_${calls.length}`, type: 'message', role: 'assistant', model: answeredModel || body.model, content, stop_reason: stop, stop_sequence: null,
      ...(stop === 'refusal' ? { stop_details: { type: 'refusal', category: fault.category ?? null, explanation: null } } : {}),
      usage: { input_tokens: data.usage?.prompt_tokens || 0, output_tokens: (data.usage?.completion_tokens || 0) + extra, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...(mode.count ? { output_tokens_details: { thinking_tokens: extra } } : {}) } }, 200, requestId);
  }
  return { transport, calls, stats: oracle.stats, oracle };
}
module.exports = { createAnthropicReplay, routerBodyOf, ANTHROPIC_URL, ROUTER_URL, THINKING_TOKENS, THINKING_MODES };
