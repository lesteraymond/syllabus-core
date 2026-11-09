'use strict';
// VPAA Rule Conformance Testing Framework: shared harness.
//
// SCOPE. This is a SOFTWARE-CONFORMANCE harness. It runs the production checking code (Policy V2 planner, the shared Hybrid-2 alignment
// pipeline, response validation, finding and recommendation generation) against controlled SYNTHETIC syllabi with a SCRIPTED model.
// The scripted model is a test double: it returns whatever the scenario tells it to, so a passing test proves how the SOFTWARE handles
// that answer, never that Claude would give it. Nothing here calls the network: every request goes to `scriptedTransport`, and
// `liveGuard()` fails the suite if any real fetch is attempted.
const { sample } = require('../fixtures');
const engine = require('../engine');
const policy = require('../academicPolicyV2');
const { POLICY } = require('../academicV2Plan');

const MODEL = 'claude-sonnet-5-5';
const SYNTHETIC_KEY = 'sk-ant-conformance-test-only-not-a-real-key';

// An isolated environment object: it never reads or changes process.env.
function envFor(over = {}) {
  return {
    SYLLABUS_CHECK_ACADEMIC_V2: 'on', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic',
    SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL, ANTHROPIC_MODEL: MODEL, ANTHROPIC_API_KEY: SYNTHETIC_KEY,
    ANTHROPIC_MAX_TOKENS: '4096', ANTHROPIC_MAX_RETRIES: '0', SYLLABUS_CHECK_AI_BATCH: '8', SYLLABUS_CHECK_AI_CONCURRENCY: '1',
    ...over,
  };
}
const coded = (content, masters) => engine.coded(content, masters);

// Fail loudly if anything in a test reaches the real network. A conformance test must never spend money.
// Loopback stays open because route tests talk to their own ephemeral 127.0.0.1 server; anything else is a live call.
function liveGuard(t) {
  // A provider refusal (401/402/403) starts a process-wide cooldown (gemini.js breaker); reset it so one test cannot silence the next.
  const gemini = require('../gemini');
  gemini.resetProviderBlock();
  t.after(() => gemini.resetProviderBlock());
  const original = globalThis.fetch;
  const loopback = (url) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(String(url?.url || url));
  globalThis.fetch = async (url, init) => {
    if (loopback(url)) return original(url, init);
    throw new Error('LIVE NETWORK CALL BLOCKED in a conformance test: ' + String(url?.url || url));
  };
  t.after(() => { globalThis.fetch = original; });
}

const message = (judgements, extra = {}) => new Response(JSON.stringify({
  id: 'msg_scripted_test_double', type: 'message', role: 'assistant', model: MODEL,
  content: [{ type: 'text', text: JSON.stringify({ judgements }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 100 }, ...extra,
}), { status: 200, headers: { 'content-type': 'application/json' } });

// A faithful scripted answer: quotes are copied from the pair's own text, as the validator requires.
function answerFor(pair, spec = {}) {
  const label = spec.label || 'ALIGNED';
  const cut = (s, n = 18) => String(s || '').trim().slice(0, n);
  const needsDraft = label === 'PARTIALLY_ALIGNED' || label === 'NOT_ALIGNED';
  return {
    id: pair.id, label,
    explanation: spec.explanation || (needsDraft ? 'Scripted test-double explanation naming the specific gap.' : 'Scripted test-double explanation.'),
    sourceQuote: spec.sourceQuote !== undefined ? spec.sourceQuote : cut(pair.source),
    targetQuote: spec.targetQuote !== undefined ? spec.targetQuote : cut(pair.target),
    sourceBloom: 'N/A', targetBloom: 'N/A',
    draft: spec.draft !== undefined ? spec.draft : (needsDraft && pair.targetPath ? 'Scripted revised text for faculty review.' : ''),
    recommendation: spec.recommendation || (needsDraft ? 'REWRITE_TEXT' : 'NO_CHANGE'),
    correctionField: spec.correctionField || (needsDraft ? 'course_content' : 'none'),
    correctionReason: spec.correctionReason || (needsDraft ? 'Scripted test-double reason.' : ''),
  };
}

// The request carries the exact schema the provider must answer with (it differs by path and by which stages are on), so a faithful
// test double answers with exactly those fields: extra fields would be refused as a schema violation, and missing ones as incomplete.
function fitToSchema(answer, item) {
  if (!item || !item.properties) return answer;
  const out = {};
  for (const [key, def] of Object.entries(item.properties)) {
    if (answer[key] !== undefined) { out[key] = answer[key]; continue; }
    const options = Array.isArray(def.enum) ? def.enum : null;
    // An aspect field of a faithful, positive answer: the first non-"not_assessed" option, or "none" where that is an option.
    out[key] = options ? (options.includes('none') ? 'none' : options.find((o) => o !== 'not_assessed') || options[0]) : '';
  }
  return out;
}

// script(pair, request) -> { label?, ... } | 'omit' | undefined (faithful ALIGNED). Records every request in `sent`.
function scriptedTransport(script = () => undefined, { onCall } = {}) {
  const sent = [];
  const transport = async (_url, init) => {
    const body = JSON.parse(init.body), user = JSON.parse(body.messages[0].content);
    sent.push({ body, user, system: Array.isArray(body.system) ? body.system.map((x) => x.text).join('\n') : String(body.system || '') });
    if (onCall) { const out = await onCall({ body, user, call: sent.length }); if (out) return out; }
    const item = body.output_config?.format?.schema?.properties?.judgements?.items;
    const judgements = [];
    for (const pair of user.document_data) {
      const spec = script(pair, user);
      if (spec === 'omit') continue;
      judgements.push(fitToSchema(answerFor(pair, spec || {}), item));
    }
    return message(judgements);
  };
  transport.sent = sent;
  transport.pairs = () => sent.flatMap((r) => r.user.document_data);
  return transport;
}

// Run the integrated Policy V2 evaluator (the production path behind SYLLABUS_CHECK_ACADEMIC_V2) over a synthetic syllabus.
async function evaluateV2(content, masters, { script, transport, env, signal } = {}) {
  const t = transport || scriptedTransport(script);
  const result = await policy.evaluateIntegrated(content, masters, coded, { env: envFor(env), transport: t, signal });
  return { result, transport: t, sent: t.sent, record: (id) => result.academic.relationships.find((r) => r.id === id) };
}

// ---- synthetic syllabus builder: one controlled lesson row, everything else neutral --------------------------------------------------
// Returns { content, masters, rowIndex } with exactly the lesson fields the scenario sets. The shared fixture supplies the approved
// curriculum, official outcomes and four classified CLOs so the identity gate is satisfied (synthetic masters, never real curricula).
function syllabus(fields = {}) {
  const { content, masters } = sample();
  const rowIndex = content.plan.findIndex((r) => r.kind !== 'exam');
  const row = content.plan[rowIndex];
  if (fields.title !== undefined) { content.meta.title = fields.title; masters.curricula[0].courses[0].title = fields.title; }
  if (fields.contents !== undefined) row.contents = fields.contents;
  if (fields.activities !== undefined) row.activities = fields.activities;
  if (fields.tasks !== undefined) row.tasks = fields.tasks;
  if (fields.ilo !== undefined) row.ilos = [{ id: 'syn-ilo', text: fields.ilo, tags: fields.tags || row.ilos[0]?.tags || [] }];
  if (fields.tags !== undefined && fields.ilo === undefined) row.ilos[0].tags = fields.tags;
  if (fields.clo !== undefined) content.clos[fields.cloIndex ?? 0].statement = fields.clo;
  return { content, masters, rowIndex, row };
}

module.exports = { MODEL, POLICY, envFor, coded, liveGuard, message, answerFor, scriptedTransport, evaluateV2, syllabus, sample, engine, policy };
