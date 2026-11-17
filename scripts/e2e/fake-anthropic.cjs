'use strict';
// Offline stand-in for Anthropic's Messages API (POST https://api.anthropic.com/v1/messages) for the LOCAL E2E stack. It answers the two requests the
// new AI Checker sends (server/lib/syllabuscheck/pipeline/prompt.js) in exactly the format the checker asks for:
//   JUDGE    output schema { answers: [...] }: every checklist item of every question answered yes/no/unclear, with a quote copied from the question's texts;
//   REWRITE  output schema { text, explanation }: one rewritten field.
// The judge is pipeline/testSyllabus.js `scriptedAnswer` (it reads OFFTOPIC/WEAK markers, never meaning), plus ONE deliberate, repeatable gap so every
// report has something to act on: the Week 2 activities do not practise their ILO at its level (ACTIVITY-FIT, item "level": PARTIALLY_ALIGNED, -1 point).
// The rewriter repairs that field with text carrying the REPAIRED marker, and the judge accepts any text that carries it, so the repair plan verifies
// the rewrite and the report offers it as a draft the author can accept.
// It proves how the SOFTWARE handles answers; it says nothing about how Claude judges a syllabus. No byte leaves this machine.
const path = require('node:path');
const T = require(path.resolve(__dirname, '../../server/lib/syllabuscheck/pipeline/testSyllabus'));
const R = require(path.resolve(__dirname, '../../server/lib/syllabuscheck/pipeline/rules'));

const REPAIRED = 'Scripted revision for faculty review';
const GAP = { relationship: 'ACTIVITY-FIT', label: 'Week 2 activities', item: 'level' };

const isGap = (q) => q.relationship === GAP.relationship && q.field.label === GAP.label && !String(q.field.text).includes(REPAIRED);

function judge(message) {
  const answers = T.questionsIn(message).map((q) => {
    const base = T.scriptedAnswer(q);
    if (!isGap(q)) return base;
    return { ...base, items: R.CHECKLISTS[q.relationship].items.map((i) => ({ id: i.id, answer: i.id === GAP.item ? 'no' : 'yes' })), explanation: 'Scripted: the activities do not let students practise the ILO at its level.' };
  });
  return { answers };
}

const rewriter = T.scriptedRewriter();
async function rewrite(message) {
  const job = JSON.parse(message.user);
  if (job.field.kind === 'activities') {
    return { text: `- ${REPAIRED}: pairs solve guided problems on the week's topic\n- Option: self-paced exercise or video walkthrough`, explanation: 'Scripted: added practice at the level of the ILO.' };
  }
  return JSON.parse(await rewriter(message));
}

// The request body the SDK sends -> the { system, user } message pipeline/testSyllabus.js reads.
function messageOf(body) {
  const system = (Array.isArray(body.system) ? body.system : [body.system]).map((b) => (typeof b === 'string' ? b : b && b.text) || '');
  const content = body.messages && body.messages[0] && body.messages[0].content;
  const user = typeof content === 'string' ? content : (content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { system, user };
}

// What kind of request this is, from the output schema the checker sends with it.
function kindOf(body) {
  const props = (((body.output_config || {}).format || {}).schema || {}).properties || {};
  if (props.answers) return 'judge';
  if (props.text) return 'rewrite';
  return 'unknown';
}

const json = (status, value, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_e2e_fake', ...headers } });
const error = (status, type, message, headers) => json(status, { type: 'error', error: { type, message } }, headers);

// mode: ok | down (HTTP 503) | auth (HTTP 401) | rate (HTTP 429) | invalid (HTTP 200 whose body is not a message) | garbage (a message whose text is not the answer JSON)
async function answer(init, mode = 'ok') {
  if (mode === 'down') return error(503, 'api_error', 'scripted outage');
  if (mode === 'auth') return error(401, 'authentication_error', 'scripted auth failure');
  if (mode === 'rate') return error(429, 'rate_limit_error', 'scripted rate limit', { 'retry-after': '1' });
  if (mode === 'invalid') return new Response('{"not":"a message"', { status: 200, headers: { 'content-type': 'application/json' } });
  let body;
  try { body = JSON.parse(String(init && init.body)); } catch { return error(400, 'invalid_request_error', 'the request body is not JSON'); }
  const kind = kindOf(body);
  if (kind === 'unknown') return error(400, 'invalid_request_error', 'the E2E stand-in answers only the AI Checker judge and rewrite requests');
  const message = messageOf(body);
  const out = mode === 'garbage' ? 'not the JSON the checker asked for' : JSON.stringify(kind === 'judge' ? judge(message) : await rewrite(message));
  return json(200, {
    id: 'msg_e2e_fake', type: 'message', role: 'assistant', model: body.model,
    content: [{ type: 'text', text: out }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: Math.ceil(String(init.body).length / 4), output_tokens: Math.ceil(out.length / 4), cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  });
}

module.exports = { answer, kindOf, judge, rewrite, REPAIRED, GAP };
