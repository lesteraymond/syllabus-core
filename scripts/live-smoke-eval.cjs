#!/usr/bin/env node
'use strict';
// Stage E.3: Phase 1 of docs/live-evaluation-plan.md, a bounded live SMOKE evaluation. A few evaluation items (one per relationship type, for one or
// two courses) are put to the CONFIGURED provider with every advisory stage switched on in this process only, and each answer is recorded with how
// it validated. It calls the real provider, costs money and is never run by `npm test`. Stage E.4 re-runs it under the E.4 answer contract
// (docs/stage-e4-response-contract.md): the report also says what each answer recommends and counts every refusal by its code. Stage E.5
// (docs/stage-e5-reference-evidence.md) adds the corrective retries (each attempt records the corrections it carried) and ledgers that close and link.
// Stage E.6 (docs/stage-e6-evaluation-reliability.md) counts what the run completed by distinct relationship (eval/evalMetrics.js), decides completion
// on the final unresolved rate, settles reliable reported costs (accounting), and can ask for a non-empty judgements list (--min-items).
//
//   node scripts/live-smoke-eval.cjs --plan                                     what would be sent (no network, no key needed)
//   node scripts/live-smoke-eval.cjs --prices --ledger <file>                   the model's current prices only (one free request, counted)
//   node scripts/live-smoke-eval.cjs --live --confirm-paid --ledger <file> [--max-requests 10] [--max-cost 0.01] [--courses prog1,syseng]
//                                    [--max-tokens N] [--max-unresolved 0.2] [--min-sample 8] [--max-unproductive N] [--warn-invalid N]
//                                    [--max-invalid N] [--accounting reconcile|conservative] [--min-items] [--out result.json] [--stage "label"]
//                                    [--baseline earlier-result.json] [--previous-ledger <closed ledger>]
//   node scripts/live-smoke-eval.cjs --close-ledger <file> --reason "why" [--superseded-by <file>]   closes a ledger (no network, no key needed)
//
// A ledger that reached a stop condition is closed (--close-ledger): it keeps every count and entry, and no run adds to it again. The evaluation that
// follows starts its own --ledger and names the closed one with --previous-ledger: the new ledger records it with its final counts, and the result
// reports both, so no historical counter is silently reset. --baseline names the earlier result the summary compares with (only its attempts that
// asked the same relationships); without it, Stage E.3 run 2.
//
// The limits are enforced by the guard requestOpenRouter sends through (server/lib/syllabuscheck/eval/providerGuard.js, passed as gemini.js
// `transport`), BEFORE a request leaves the process:
//   - requests: at most --max-requests provider HTTP requests in the whole smoke test, retries and price lookups included. The count is kept in
//     --ledger, so a later invocation continues it, with the dollars charged, the timeout and invalid-answer counts, and the relationships each
//     request carried: a resumed run starts again from the first batch, and a send that timed out counts toward that relationship's MAX_ATTEMPTS.
//   - cost: a model request is sent only when the dollars already charged plus its WORST CASE fit under --max-cost. Worst case = every byte of the
//     request body as an input token at the highest input price any endpoint of the model lists, plus max_tokens at the highest output price, plus
//     the per-request fee. The prices are read from OpenRouter at the start of every run, never taken from earlier runs. The worst case is reserved
//     before a request is sent; when the answer comes, a reliable provider-reported cost settles it (--accounting reconcile, the default since
//     Stage E.6), and anything else is charged as before (--accounting conservative keeps that rule for every request): the larger of the reported
//     cost and its reported tokens at the highest prices; a 4xx refusal what is reported (nothing if nothing is); anything else without usage, and a
//     timeout, its worst case.
//   - HTTP 401/402/403 stops at once, as does any other 4xx except 429 (the request format or routing is refused, so every request would be); the
//     third rate limit, timeout, network or server error stops; a charge above the worst case stops. An answer cut off while it is read (its
//     headers came, its body did not before the timeout) is a timeout, never an invalid answer, and a batch that timed out is not asked again.
//   - an answer that breaks the JSON schema it was sent with stops, as does a verified answer whose structured fields contradict its own label. A
//     re-tag (RETAG_OUTCOME) that leaves its draft out, or sends it as null, does not break it: a re-tag needs no rewrite and the checker accepts it.
//   - a serious repeated contract failure stops: a relationship refused twice in a row for the same contract code (gemini.js CONTRACT_CODES). At
//     temperature 0 the same question gets the same answer, so the checker does not ask it a third time, and the run stops there.
//   - --max-unproductive answers in a row that verified no relationship stop: a provider or schema that keeps failing. The default is the most
//     answers one batch's bounded retries can bring, 1 + 2 x the batch size (9 for a batch of 4: each relationship is sent at most MAX_ATTEMPTS = 3
//     times, and every request carries at least one).
//   - the academic stop (Stage E.6): between batches, once --min-sample (default 8) distinct relationships were attempted, a final unresolved rate
//     above --max-unresolved (default 0.2) stops the run. The completion decision of the result uses the same rate and the coverage of the plan.
//   - answers that failed validation in whole or in part are an operational signal: a warning at --warn-invalid (default 40% of --max-requests,
//     at least 3, the Stage E.5 stop), and a stop only when --max-invalid is given. Until Stage E.5 they stopped the run, also when the corrected
//     request verified what they had refused.
// The global fetch is replaced by one that throws, so nothing in the process reaches the network around the guard, and requests are sequential.
// --max-tokens (evaluation only) replaces the production max_tokens (8192) in the request; it is reported with the result. --min-items (evaluation
// only, Stage E.6) asks the provider for a non-empty judgements list (SYLLABUS_CHECK_SCHEMA_MIN_ITEMS=on in the local env object): an empty list
// that still comes back is reported as "minItems not enforced", and a provider that refuses the schema stops the run (HTTP 4xx).
// Read-only with respect to the application: the stage switches live in a local env object (never process.env or server/.env), no database module
// is loaded (checked before the first request and again before the report), and no syllabus, report, score or gate is touched. It writes only
// --ledger and --out. The expected verdicts are provisional (written by the developer, not reviewed by faculty): a match is not faculty-verified.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.join(__dirname, '..'), root = path.join(repo, 'server');
const g = require(path.join(root, 'lib/syllabuscheck/gemini.js'));
const { trimOn, stageFlags } = require(path.join(root, 'lib/syllabuscheck/stages.js'));
const { variantOf } = require(path.join(root, 'lib/syllabuscheck/variants.js'));
const { readAspects } = require(path.join(root, 'lib/syllabuscheck/aspects.js'));
const { isTrivialRewrite } = require(path.join(root, 'lib/syllabuscheck/stewardship.js'));
const { createGuard, closeLedger, loadedDataModules } = require(path.join(root, 'lib/syllabuscheck/eval/providerGuard.js'));
const { createTracker, academicStopOf, completionOf, describe: describeMetrics } = require(path.join(root, 'lib/syllabuscheck/eval/evalMetrics.js'));

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };
const has = (name) => args.includes('--' + name);
const STAGE = flag('stage', 'smoke');
// Closing a ledger is a file operation only: nothing is loaded that reaches the network, and no key is needed.
if (has('close-ledger')) {
  const file = flag('close-ledger', ''), reason = flag('reason', '');
  if (!file || !reason) { console.error('--close-ledger <file> needs --reason "why the evaluation was closed"'); process.exit(2); }
  const closed = closeLedger(file, { reason, supersededBy: flag('superseded-by', null) });
  console.log(`closed ${file}: ${closed.requests} request(s), $${closed.charged} charged, ${closed.transient ?? '?'} timeout(s) or other transient error(s), ${closed.invalid ?? '?'} invalid answer(s); reason: ${closed.closed.reason}${closed.closed.supersededBy ? `; superseded by ${closed.closed.supersededBy}` : ''}`);
  process.exit(0);
}
const mode = has('live') ? 'live' : has('prices') ? 'prices' : 'plan';
if (mode === 'live' && !has('confirm-paid')) { console.error('--live makes PAID provider calls. Add --confirm-paid to confirm, after approval.'); process.exit(2); }
const maxRequests = Number(flag('max-requests', 10)), maxCost = Number(flag('max-cost', 0.01));
const maxTokens = flag('max-tokens', '') ? Number(flag('max-tokens', '')) : null;
// Stage E.6: answers that failed validation warn (at the Stage E.5 threshold) and stop only when --max-invalid is given; the run stops on the final
// unresolved rate of distinct relationships, and on --max-unproductive answers in a row that verified nothing.
const maxInvalid = flag('max-invalid', '') ? Number(flag('max-invalid', '')) : Infinity, warnInvalid = Number(flag('warn-invalid', Math.max(3, Math.ceil(maxRequests * 0.4))));
const unproductiveGiven = flag('max-unproductive', '') ? Number(flag('max-unproductive', '')) : null, maxUnresolved = Number(flag('max-unresolved', 0.2)), minSample = Number(flag('min-sample', 8));
const accounting = flag('accounting', 'reconcile'), minItems = has('min-items');
const count = (v) => Number.isInteger(v) && v >= 1;
if (!count(maxRequests) || !(maxCost > 0) || (maxTokens !== null && !(Number.isInteger(maxTokens) && maxTokens >= 256)) || !(maxInvalid === Infinity || count(maxInvalid)) || !count(warnInvalid) || !(unproductiveGiven === null || count(unproductiveGiven)) || !count(minSample) || !(maxUnresolved >= 0 && maxUnresolved <= 1) || !['reconcile', 'conservative'].includes(accounting)) {
  console.error('--max-requests, --max-invalid, --warn-invalid, --max-unproductive and --min-sample must be positive integers, --max-cost a positive number, --max-unresolved a share from 0 to 1, --accounting reconcile or conservative, and --max-tokens an integer of at least 256'); process.exit(2);
}
const ledgerFile = flag('ledger', ''), previousLedger = flag('previous-ledger', null);
if (mode !== 'plan' && !ledgerFile) { console.error('--ledger <file> is required: it carries the request count and the charges across invocations.'); process.exit(2); }

// One item per relationship type of the smoke test, for each course. Misaligned and aligned items are mixed, so verdicts, drafts and the structured
// fields of Stages C and D are all exercised. The ids are from the stage datasets (server/lib/syllabuscheck/eval).
const PICKS = {
  prog1: ['cc-prog1-offsubject', 'cp-bsit-wrongpo', 'wi-prog1-aligned', 'ic-prog1-wrongclo', 'af-prog1-good', 'as-prog1-recall-quiz', 'vu-prog1-name-only', 'rr-prog1-relevant'],
  syseng: ['cc-syseng-aligned', 'cp-bsie-real2', 'wi-syseng-unrelated', 'ic-syseng-ok', 'af-syseng-irrelevant', 'as-syseng-good', 'vu-syseng-community', 'rr-syseng-unrelated'],
  sensors: ['cc-sensors-keyword', 'cp-bscpe-aligned', 'wi-sensors-keyword', 'ic-sensors-wrongclo', 'af-sensors-passive', 'as-sensors-quiz', 'vu-sensors-courage', 'rr-sensors-tangential'],
};
const DATASETS = ['stage-a', 'stage-b', 'stage-b3', 'stage-c', 'stage-d1', 'stage-d2'].map((name) => ({ name, data: require(path.join(root, 'lib/syllabuscheck/eval', `${name}-dataset.json`)) }));
const byId = new Map(DATASETS.flatMap(({ name, data }) => data.items.map((item) => [item.id, { ...item, dataset: `${name}@${data.version}`, reviewStatus: item.reviewStatus || data.reviewStatus || 'unreviewed' }])));
const courses = flag('courses', 'prog1,syseng').split(',').filter(Boolean);
if (!courses.length || courses.some((c) => !PICKS[c] || PICKS[c].some((id) => !byId.has(id)))) { console.error(`--courses must name some of ${Object.keys(PICKS).join(', ')}`); process.exit(2); }
// The course as production sends it (gemini.js courseOf); the dataset's `discipline` is an evaluation field and is not sent.
const courseOf = (key) => { const { code, title, program, yearLevel, description } = DATASETS.find((d) => d.data.courses?.[key]).data.courses[key]; return { code, title, program, yearLevel, description }; };
const pairOf = (item) => ({ id: item.id, type: item.type, source: item.source, target: item.target, path: 'eval', targetPath: g.isNoRewrite(item.type) ? null : 'eval' });

// The configured provider and model (server/.env), read into a LOCAL object: process.env and server/.env are never changed.
const env = { ...process.env };
for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim(); }
// Every advisory stage on, in this object only, with the full (untrimmed) prompt.
for (const stage of ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2']) env[`SYLLABUS_CHECK_STAGE_${stage}`] = 'on';
env.SYLLABUS_CHECK_PROMPT_TRIM = 'off';
env.SYLLABUS_CHECK_SCHEMA_MIN_ITEMS = minItems ? 'on' : 'off'; // Stage E.6: only with --min-items, and only in this object
const config = g.providerConfig(env);
const keyPresent = typeof env.OPENROUTER_API_KEY === 'string' && env.OPENROUTER_API_KEY.trim().length >= 20;
const variant = variantOf(env), promptVersion = g.promptVersionOf(config.model, env), batchSize = g.batchSizeOf(config.model, env);
const maxUnproductive = unproductiveGiven ?? 1 + (g.MAX_ATTEMPTS - 1) * batchSize; // the most answers one batch can bring (9 for a batch of 4)
const fullPrompt = g.systemPromptOf(variant, env, []);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const round = (v) => Math.round(v * 1e8) / 1e8;

// No module that can reach the application's data may be loaded: checked before the first request and again before the report. Stricter than the
// guard's own list (eval/providerGuard.js DATA_MODULES): the smoke test needs neither the engine nor the compliance rules.
const FORBIDDEN = /[\/]server[\/](db|routes)[\/]|[\/]compliance[\/]|[\/]syllabuscheck[\/](repository|engine)\.js$|[\/]node_modules[\/](pg|mysql2?|knex|sequelize|better-sqlite3|mongodb)[\/]/;
const forbiddenLoaded = () => loadedDataModules(FORBIDDEN).map((file) => path.relative(repo, file));

// ---- the guard (eval/providerGuard.js): every provider request of this process goes through guard.fetch ----
const realFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Blocked: every request of the smoke evaluation goes through the guarded transport'); };
const schemas = new Map();
const guard = createGuard({
  fetch: realFetch, maxRequests, maxCost, maxTokens, maxInvalid, warnInvalid, maxUnproductive, accounting, ledgerFile: mode !== 'plan' ? ledgerFile : null, previousLedger: mode !== 'plan' ? previousLedger : null, secrets: [env.OPENROUTER_API_KEY], log: (line) => console.log(line),
  // What the report needs about each model request: the schema its answer is held to, and whether it carried the full prompt.
  onSend: (entry, sent) => {
    const system = sent.messages[0].content;
    schemas.set(entry.n, sent.response_format?.json_schema?.schema);
    Object.assign(entry, { promptSha256: sha(system), fullPrompt: system === fullPrompt, responseFormat: sent.response_format?.type || null, strict: sent.response_format?.json_schema?.strict === true });
  },
});
const { ledger, state, httpLog, stop, saveLedger, worstCase, inputBound, withMaxTokens } = guard;
// What the ledger already holds when a run is resumed with it: every relationship's earlier attempts (a send that timed out or failed counts), so the
// limit of MAX_ATTEMPTS per relationship holds across invocations, as the request, dollar, timeout and invalid-answer limits do (the guard).
const earlierAttempts = new Map();
for (const e of ledger.entries.filter((x) => x.kind === 'model' && Array.isArray(x.ids))) {
  for (const id of e.ids) { const seen = earlierAttempts.get(id) || { attempts: 0, codes: [] }; seen.attempts += 1; seen.codes.push(e.error === 'timeout' ? 'provider_timeout' : e.error ? 'provider_error' : 'earlier_run'); earlierAttempts.set(id, seen); }
}
const resumedFrom = ledger.requests ? { requests: ledger.requests, charged: round(ledger.charged), transient: state.transient, invalid: state.invalid, attempts: Object.fromEntries([...earlierAttempts].map(([id, seen]) => [id, seen.attempts])) } : null;

// The exact request bodies the run would send first (one per batch), built by requestOpenRouter itself with a transport that sends nothing.
async function plannedRequests() {
  const out = [];
  for (const course of courses) {
    const pairs = PICKS[course].map((id) => pairOf(byId.get(id)));
    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize);
      let body = null;
      await g.requestOpenRouter(batch, { env: { ...env, OPENROUTER_API_KEY: 'not-sent' }, course: courseOf(course), transport: async (url, init) => { body = init.body; throw Object.assign(new Error('planned only'), { planned: true }); } })
        .catch((error) => { if (!error.planned) throw error; });
      out.push({ course, types: batch.map((p) => p.type), body: withMaxTokens(body) });
    }
  }
  return out;
}

// Does the answer keep to the JSON schema it was sent with (strict structured output)? A quote that is not in the text is a validation failure, not this.
function schemaProblems(text, schema) {
  if (typeof text !== 'string') return ['no text answer'];
  let raw;
  try { raw = JSON.parse(text); } catch { return ['the answer is not JSON']; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['the answer is not an object'];
  const out = [], item = schema.properties.judgements.items, keys = item.required;
  const extra = Object.keys(raw).filter((k) => k !== 'judgements');
  if (extra.length) out.push(`unexpected top-level ${extra.join(', ')}`);
  if (!Array.isArray(raw.judgements)) return [...out, 'judgements is not a list'];
  raw.judgements.forEach((j, i) => {
    if (!j || typeof j !== 'object' || Array.isArray(j)) { out.push(`judgement ${i + 1} is not an object`); return; }
    const retagNoDraft = (k) => k === 'draft' && j.recommendation === 'RETAG_OUTCOME' && j.draft == null; // accepted by the checker (header)
    const missing = keys.filter((k) => !(k in j) && !retagNoDraft(k)), unexpected = Object.keys(j).filter((k) => !keys.includes(k));
    const notText = keys.filter((k) => k in j && typeof j[k] !== 'string' && !retagNoDraft(k)), offList = keys.filter((k) => typeof j[k] === 'string' && item.properties[k].enum && !item.properties[k].enum.includes(j[k]));
    if (missing.length) out.push(`judgement ${i + 1} lacks ${missing.join(', ')}`);
    if (unexpected.length) out.push(`judgement ${i + 1} adds ${unexpected.join(', ')}`);
    if (notText.length) out.push(`judgement ${i + 1} has non-text ${notText.join(', ')}`);
    if (offList.length) out.push(`judgement ${i + 1} has values outside their lists: ${offList.map((k) => `${k}=${j[k]}`).join(', ')}`);
  });
  return out;
}

// One provider request as judgeBatch makes it (the first attempt or a retry), with what its answer showed.
const attempts = [];
// The refusal codes of each relationship, in order, to find a serious repeated contract failure as judgeStaged does (gemini.js): the same contract
// code twice in a row. An answer that names no relationship gives each relationship of the request its own code, as it does there.
const codeHistory = new Map();
function noteRefusals(ids, error) {
  const salvaged = new Set((error.salvaged || []).map((j) => j.id)), named = new Map((error.rejected || []).filter((r) => r.id !== '*').map((r) => [r.id, r.code]));
  for (const id of ids.filter((x) => !salvaged.has(x))) {
    const codes = codeHistory.get(id) || [], code = named.get(id) || error.code || 'invalid_output';
    codes.push(code); codeHistory.set(id, codes);
    if (g.CONTRACT_CODES.has(code) && codes.length >= 2 && codes[codes.length - 2] === code) stop(`repeated contract failure: ${id} was refused twice in a row for ${code}`);
  }
}
// Stage E.6: every relationship of the run, counted once however often it is asked (eval/evalMetrics.js).
const tracker = createTracker();
const requestFor = (course, batch) => async (pairs, options) => {
  const attempt = { attempt: attempts.length + 1, course, batch, ids: pairs.map((p) => p.id) }, before = httpLog.length;
  // A retry of a staged check carries a correction for each relationship it asks again (gemini.js judgeStaged): which, and for what.
  if (options && options.corrections && options.corrections.length) attempt.corrections = options.corrections.map((c) => ({ id: c.id, refused: c.refused }));
  attempts.push(attempt);
  try {
    attempt.judgements = await g.requestOpenRouter(pairs, { ...options, env, course: courseOf(course), transport: guard.fetch });
    attempt.outcome = 'verified';
    tracker.sent({ keys: attempt.ids, answered: true, verified: attempt.judgements.map((j) => j.id) });
    guard.noteAnswer({ verified: attempt.judgements.length });
    return attempt.judgements;
  } catch (error) {
    attempt.outcome = error.refused ? 'not sent' : error.unverified ? 'invalid' : 'error';
    attempt.error = guard.redact(error.message).slice(0, 300);
    if (!error.refused) attempt.errorClass = g.failureClassOf(error); // contract, evidence, coverage, output; transient or access for no answer
    if (error.code) attempt.code = error.code;
    if (error.rejected) attempt.rejected = error.rejected;
    if (error.salvaged && error.salvaged.length) attempt.judgements = error.salvaged;
    // An answer that came back and failed validation, in whole or for some relationships: those it verified are verified, the rest are asked again
    // (an operational signal, noteAnswer). A request that brought no answer is a send without an answer; one the guard refused was never sent.
    if (error.unverified) {
      tracker.sent({ keys: attempt.ids, answered: true, verified: (error.salvaged || []).map((j) => j.id) });
      guard.noteAnswer({ verified: (error.salvaged || []).length, invalid: `${error.code || 'invalid_answer'}: ${error.message}` });
      noteRefusals(attempt.ids, error);
    } else if (!error.refused) tracker.sent({ keys: attempt.ids, answered: false });
    throw error;
  } finally {
    const http = httpLog.length > before ? httpLog[httpLog.length - 1] : null;
    attempt.request = http ? http.n : null;
    // An answer cut off while it was read (http.error: the request's timeout, or the connection) brought nothing to check: the guard counts it as a
    // timeout or network error, as the checker does (classifyFailure), not as a schema problem.
    if (http && http.status === 200 && !http.error) {
      attempt.truncated = http.finishReason === 'length';
      attempt.schemaProblems = attempt.truncated ? [] : schemaProblems(http.content, schemas.get(http.n));
      if (attempt.schemaProblems.length) stop(`schema incompatibility in request ${http.n}: ${attempt.schemaProblems.slice(0, 3).join('; ')}`);
    }
    for (const j of attempt.judgements || []) { const found = readAspects(j).contradictions; if (found.length) stop(`contradictory academic decision for ${j.id}: ${found.join('; ')}`); }
  }
};

// ---- what each answer showed, item by item ----
const rawJudgement = (attempt, id) => { const http = httpLog.find((e) => e.n === attempt.request); try { return JSON.parse(http.content).judgements.find((j) => j && j.id === id) || null; } catch { return null; } };
// What each verified answer recommends (the E.4 contract), against the provisional expectation of its item (developer-written, unreviewed): a sound
// text with a wrong tag is a re-tag, an item that passes needs no change, a failing advice-only relationship is a review, and any other failing one a
// rewrite. An ambiguous item (a pass or a partial are both accepted) has no single expectation.
const RETAG_CATEGORIES = new Set(['wrong-po-mapping', 'wrong-clo']);
const expectedRecommendationOf = (item) => (item.ambiguous ? null : item.accept.every((label) => label === 'ALIGNED') ? 'NO_CHANGE' : RETAG_CATEGORIES.has(item.category) ? 'RETAG_OUTCOME' : g.isNoRewrite(item.type) ? 'REVIEW_REQUIRED' : 'REWRITE_TEXT');
function recommendationOf(item, j, raw) {
  if (!j) return { status: 'not verified' };
  const type = j.recommendation || null, expected = expectedRecommendationOf(item);
  const base = { type, expected, matchesExpected: expected ? type === expected : null };
  const rawDraft = raw && typeof raw.draft === 'string' ? raw.draft.trim() : '';
  if (type === 'NO_CHANGE') return { ...base, status: rawDraft ? 'none needed (a draft was written for an ALIGNED answer; the checker discards it)' : 'none needed' };
  if (type === 'RETAG_OUTCOME') return { ...base, status: 'valid re-tag: the faculty text is kept, no rewrite', draftInAnswer: !raw ? null : !('draft' in raw) ? 'left out' : raw.draft === null ? 'null' : rawDraft ? 'the unchanged text' : 'empty' };
  if (type === 'REVIEW_REQUIRED') return { ...base, status: g.isNoRewrite(item.type) ? 'review: advice only, this relationship never rewrites the syllabus' : 'review: the evidence was insufficient', draftWritten: !!rawDraft };
  // REWRITE_TEXT (the checker refuses it without a draft): does the draft change the text, and would the author be offered it?
  const draft = String(j.draft || '').trim();
  // What a faculty member would be offered to paste into the syllabus: it must be plain text in the field's own form.
  const safety = [
    /https?:\/\/|www\./i.test(draft) && 'contains a link', /<\/?[a-z][^>]*>|```/i.test(draft) && 'contains markup',
    /\b(ignore (all|the|previous)|system prompt|as an ai|language model)\b/i.test(draft) && 'contains instruction-like text',
    draft.length > Math.max(400, item.target.length * 6) && 'much longer than the original',
  ].filter(Boolean);
  const held = j.draftReview || [], noOp = isTrivialRewrite(item.target, draft).trivial;
  const status = noOp ? 'a rewrite that changes nothing: not offered (the finding stays)' : held.length ? `a rewrite held for the author's decision (${held.join(', ')})` : safety.length ? 'proposed rewrite, with safety flags' : 'proposed rewrite';
  return { ...base, status, draft, safety, draftReview: held };
}
function aspectsOf(item, j) {
  if (!j) return null;
  const read = readAspects(j), required = g.ASPECTS_REQUIRED[item.type] || [], values = read.values;
  // A value in a field this relationship type does not use is ignored by the checker; it shows how the model filled the shared schema.
  const offType = Object.entries(values).filter(([k, v]) => !required.includes(k) && k !== 'responsible' && v !== 'not_assessed').map(([k, v]) => `${k}=${v}`);
  const expected = item.expectedAspects ? Object.fromEntries(Object.entries(item.expectedAspects).map(([k, want]) => [k, { provisional: want, got: values[k] ?? null, matches: values[k] !== undefined && [].concat(want).includes(values[k]) }])) : null;
  return { required: Object.fromEntries(required.map((k) => [k, values[k] ?? null])), responsible: values.responsible ?? null, invalid: read.invalid, missing: read.missing, contradictions: read.contradictions, offType, expected };
}
// Why the checker stopped asking a relationship that never verified (judgeStaged's unverified judgement): its reason, codes and refused quotes.
const stoppedAsking = new Map();
function itemReport(id) {
  const item = byId.get(id), tried = attempts.filter((a) => a.ids.includes(id));
  const verifiedIn = [...tried].reverse().find((a) => (a.judgements || []).some((j) => j.id === id && !j.unverified));
  const j = verifiedIn ? verifiedIn.judgements.find((x) => x.id === id) : null, raw = verifiedIn ? rawJudgement(verifiedIn, id) : null;
  const evidenceOk = (m) => m === 'exact' || m === 'whitespace';
  const stopped = !j ? stoppedAsking.get(id) || null : null;
  return {
    id, course: item.course, type: item.type, dataset: item.dataset, category: item.category, reviewStatus: item.reviewStatus, provisional: item.accept, why: item.why,
    verdict: j ? j.label : 'NOT VERIFIED', matchesProvisional: j ? item.accept.includes(j.label) : null,
    schemaValid: verifiedIn ? !(verifiedIn.schemaProblems || []).length : null,
    evidence: j ? { source: j.evidenceMatching?.source, target: j.evidenceMatching?.target, valid: j.label === 'INSUFFICIENT_EVIDENCE' || (evidenceOk(j.evidenceMatching?.source) && evidenceOk(j.evidenceMatching?.target)) } : null,
    recommendation: recommendationOf(item, j, raw), aspects: aspectsOf(item, j),
    bloom: j ? { source: j.sourceBloom, target: j.targetBloom } : null, explanation: j ? j.explanation : null,
    attempts: tried.map((a) => a.attempt), retries: Math.max(0, tried.filter((a) => a.outcome !== 'not sent').length - 1), verifiedInRequest: verifiedIn ? verifiedIn.request : null,
    verifiedAfterCorrection: verifiedIn ? (verifiedIn.corrections || []).some((c) => c.id === id) : null,
    ...(stopped ? { stoppedBecause: stopped.stoppedBecause, failureCodes: stopped.failureCodes, refusals: stopped.refusals } : {}),
  };
}

// The counts for review, from the attempt records. docs/ai-eval-stage-e3-smoke-run2.json has the same shape, so the two runs are counted alike: an
// answer is one model response; a judgement is one relationship in one answer; a refusal is counted once per relationship, by each of its codes (run 2
// predates the codes, so its reasons are the messages it recorded).
function summarize(list) {
  const sent = list.filter((a) => a.outcome !== 'not sent'), answered = sent.filter((a) => a.outcome === 'verified' || a.outcome === 'invalid');
  const sends = {}, reasons = {};
  const count = (code, n = 1) => { reasons[code] = (reasons[code] || 0) + n; };
  for (const a of sent) for (const id of a.ids) sends[id] = (sends[id] || 0) + 1;
  for (const a of answered.filter((x) => x.outcome === 'invalid')) {
    const verified = new Set(a.verifiedIds || []), named = (a.rejected || []).filter((r) => r.id !== '*');
    for (const r of named) for (const code of r.codes || [r.code || r.reason]) count(code);
    const unnamed = a.ids.filter((id) => !verified.has(id) && !named.some((r) => r.id === id)).length;
    if (unnamed) count(a.code || 'invalid_output', unnamed);
  }
  const asked = answered.reduce((n, a) => n + a.ids.length, 0), valid = answered.reduce((n, a) => n + (a.verifiedIds || []).length, 0);
  const ids = Object.keys(sends), verified = new Set(answered.flatMap((a) => a.verifiedIds || []));
  return {
    answers: { sent: sent.length, verified: sent.filter((a) => a.outcome === 'verified').length, invalid: sent.filter((a) => a.outcome === 'invalid').length, errors: sent.filter((a) => a.outcome === 'error').length },
    judgements: { asked, valid, refused: asked - valid },
    refusalReasons: reasons,
    relationships: { asked: ids.length, verified: ids.filter((id) => verified.has(id)).length, neverVerified: ids.filter((id) => !verified.has(id)) },
    sends: { retries: Math.max(0, sent.length - new Set(sent.map((a) => a.batch)).size), mostForOneRelationship: Math.max(0, ...Object.values(sends)), relationshipsSentAgain: Object.values(sends).filter((n) => n > 1).length },
  };
}
const BASELINE = flag('baseline', path.join(repo, 'docs', 'ai-eval-stage-e3-smoke-run2.json'));

async function main() {
  const flags = stageFlags(env);
  console.log(`Stage ${STAGE} (${mode})`);
  console.log(`Provider ${config.provider || 'none'}; model ${config.model}; configured ${config.configured}; API key ${keyPresent ? 'present (not shown)' : 'MISSING'}`);
  console.log(`Prompt ${promptVersion}; variant ${variant}; trimmed ${trimOn(env)}; full system prompt ${fullPrompt.length} characters, sha256 ${sha(fullPrompt).slice(0, 16)}`);
  console.log(`Stages on in this process only: ${Object.entries(flags).filter(([, v]) => v).map(([k]) => k.toUpperCase()).join(', ')}; batch size ${batchSize}; requests sequential`);
  console.log(`Limits: ${maxRequests} provider requests (ledger already holds ${ledger.requests}), $${maxCost} (ledger already charged $${round(ledger.charged)}; accounting ${accounting}); max_tokens ${maxTokens ? maxTokens + ' (evaluation override)' : 'as in production'}; stops after 3 rate limits, timeouts or server errors (ledger already holds ${state.transient}), after ${maxUnproductive} answers in a row that verified nothing, and when the final unresolved rate exceeds ${maxUnresolved} once ${minSample} relationships were attempted; invalid answers warn at ${warnInvalid}${maxInvalid === Infinity ? '' : ` and stop at ${maxInvalid}`} (ledger already holds ${state.invalid})`);
  console.log(`Schema: judgements list ${minItems ? 'asked to be non-empty (minItems 1, --min-items; the answer is verified exactly as before)' : 'as before (no minItems)'}; prompt version ${promptVersion}`);
  if (earlierAttempts.size) console.log(`Earlier attempts in the ledger (each counts toward ${g.MAX_ATTEMPTS} per relationship): ${[...earlierAttempts].map(([id, seen]) => `${id} ${seen.attempts} (${seen.codes.join(', ')})`).join('; ')}`);
  if (ledger.previous) { const p = ledger.previous; console.log(`Ledger ${ledgerFile} follows the closed ledger ${p.ledger}: ${p.requests} request(s), $${p.charged} charged, ${p.transient} timeout(s) or other transient error(s), ${p.invalid} invalid answer(s); closed ${p.closedAt} because ${p.closedBecause}. Those counts stay there; this ledger counts this evaluation.`); }
  const loaded = forbiddenLoaded();
  if (loaded.length) { console.error(`Refusing to run: modules that reach application data are loaded: ${loaded.join(', ')}`); process.exit(1); }
  console.log('Isolation: no database, route, compliance or repository module is loaded.\n');
  const planned = await plannedRequests();
  for (const p of planned) {
    const sent = JSON.parse(p.body);
    console.log(`${p.course}: ${p.types.join(', ')}`);
    console.log(`  request body ${Buffer.byteLength(p.body)} bytes -> at most ${inputBound(p.body)} input tokens (about ${Math.round(Buffer.byteLength(p.body) / 4)} at 4 bytes a token); max_tokens ${sent.max_tokens}; ${sent.messages[0].content === fullPrompt ? 'full prompt' : 'NOT the full prompt'}`);
  }
  if (mode === 'plan') return;
  if (config.provider !== 'openrouter' || !config.configured || !keyPresent) { console.error('\nThe smoke evaluation needs the configured OpenRouter provider, a supported model and an API key.'); process.exit(2); }
  if (ledger.requests >= maxRequests) { console.error(`\nThe ledger already holds ${ledger.requests} request(s): the cap of ${maxRequests} is reached.`); process.exit(2); }
  try { await guard.readPrices(config.model, env.OPENROUTER_API_KEY); } catch (error) { stop(`the price lookup failed (${guard.redact(error.message).slice(0, 120)}), so the cost ceiling cannot be enforced`); }
  if (state.prices) {
    const p = state.prices, perM = (v) => '$' + round(v * 1e6) + '/M';
    console.log(`\nPrices now (highest of ${p.endpoints.length} endpoint(s)): input ${perM(p.prompt)}${p.cacheWrite > p.prompt ? `, cache write ${perM(p.cacheWrite)}` : ''}; output ${perM(p.completion)}${p.reasoning > p.completion ? `, reasoning ${perM(p.reasoning)}` : ''}; per request $${p.request}`);
    // The request requires strict structured output (require_parameters), so only those endpoints can serve it; the bound uses every endpoint, which is never lower.
    const permitted = p.endpoints.filter((e) => e.structuredOutputs);
    if (permitted.length) console.log(`  endpoints that can serve the request (structured outputs): ${permitted.length}; highest input ${perM(Math.max(...permitted.map((e) => e.prompt)))}, output ${perM(Math.max(...permitted.map((e) => e.completion)))}`);
    for (const e of p.endpoints) console.log(`  ${e.provider}${e.tag ? ` (${e.tag})` : ''}: input ${perM(e.prompt)}, output ${perM(e.completion)}, cache read ${perM(e.cacheRead)}, structured outputs ${e.structuredOutputs}; status ${e.status ?? '?'}, uptime over 30 min ${e.uptime30m ?? '?'}`);
    let spent = ledger.charged, affordable = 0;
    for (const req of planned) { const w = worstCase(req.body); console.log(`  worst case of the first ${req.course} request: $${round(w.dollars)} (${w.inputTokens} input tokens + ${w.outputTokens} output tokens at the highest prices)`); if (affordable === planned.indexOf(req) && spent + w.dollars <= maxCost) { spent += w.dollars; affordable += 1; } }
    console.log(`  the cap admits ${affordable} of the ${planned.length} first requests even if each were charged its worst case (retries are checked the same way when they come)`);
  }
  if (mode === 'prices' || state.stopped) return finish();
  tracker.plan(courses.flatMap((course) => PICKS[course]));
  for (const course of courses) {
    const pairs = PICKS[course].map((id) => pairOf(byId.get(id)));
    for (let i = 0; i < pairs.length && !state.stopped; i += batchSize) {
      // A relationship the ledger already sent MAX_ATTEMPTS times is not sent again; the others carry their earlier attempts into the retry policy.
      const batch = pairs.slice(i, i + batchSize).filter((p) => (earlierAttempts.get(p.id)?.attempts || 0) < g.MAX_ATTEMPTS);
      if (!batch.length) continue;
      try {
        for (const j of await g.judgeBatch(requestFor(course, `${course}#${i / batchSize + 1}`), batch, { halve: true, history: earlierAttempts })) {
          tracker.settle(j.id, j);
          if (j.unverified) stoppedAsking.set(j.id, { stoppedBecause: j.stoppedBecause, failureCodes: j.failureCodes, refusals: j.refusals });
        }
      } catch (error) { if (!error.refused) console.log(`  ${course}: ${guard.redact(error.message).slice(0, 160)}`); }
      // Stage E.6: between batches, the academic stop on the final unresolved rate of the distinct relationships attempted so far.
      const academic = academicStopOf(tracker.metrics(), { maxUnresolved, minSample });
      if (academic) stop(`academic stop: ${academic}`);
    }
    if (state.stopped) break;
  }
  return finish();
}

function finish() {
  const models = httpLog.filter((e) => e.kind === 'model'), sum = (key) => models.reduce((n, e) => n + (e.usage?.[key] || 0), 0);
  const items = attempts.length ? courses.flatMap((c) => PICKS[c]).filter((id) => attempts.some((a) => a.ids.includes(id))).map(itemReport) : [];
  const sentAttempts = attempts.filter((a) => a.outcome !== 'not sent');
  const result = {
    stage: STAGE, ranAt: new Date().toISOString(), mode, resumedFrom, ledger: { file: ledgerFile || null, previous: ledger.previous || null },
    model: `${config.provider}/${config.model}`, promptVersion, variant, promptSha256: sha(fullPrompt), promptTrimmed: trimOn(env), stagesOnInThisProcessOnly: stageFlags(env),
    limits: { maxRequests, maxCost, maxTokens: maxTokens || 'production (8192)', maxInvalid: maxInvalid === Infinity ? null : maxInvalid, warnInvalid, maxUnproductive, maxUnresolved, minSample, maxTransient: 3, accounting, sequential: true },
    stopped: state.stopped, warnings: [...state.warnings],
    // Stage E.6: by distinct relationship, and whether the run completed for academic use (eval/evalMetrics.js).
    relationshipMetrics: tracker.metrics(), completion: completionOf(tracker.metrics(), { maxUnresolved, stopped: state.stopped }),
    schema: { minItems: minItems ? 1 : null, emptyAnswers: attempts.filter((a) => a.code === 'empty_answer').length, minItemsNotEnforced: minItems && attempts.some((a) => a.code === 'empty_answer') ? 'an empty judgements list came back although minItems 1 was asked: the provider does not enforce it' : null },
    prices: state.prices,
    requests: { total: ledger.requests, model: models.length, priceLookups: httpLog.filter((e) => e.kind === 'price-lookup').length, attemptsSent: sentAttempts.length, retries: Math.max(0, sentAttempts.length - new Set(sentAttempts.map((a) => a.batch)).size) },
    responses: { verified: sentAttempts.filter((a) => a.outcome === 'verified').length, invalid: sentAttempts.filter((a) => a.outcome === 'invalid').length, errors: sentAttempts.filter((a) => a.outcome === 'error').length, timeouts: models.filter((e) => e.error === 'timeout').length, schemaProblems: sentAttempts.filter((a) => (a.schemaProblems || []).length).length, truncated: sentAttempts.filter((a) => a.truncated).length },
    usage: { promptTokens: sum('promptTokens'), completionTokens: sum('completionTokens'), reasoningTokens: sum('reasoningTokens'), cachedTokens: sum('cachedTokens'), reportedCost: round(sum('reportedCost')), charged: round(ledger.charged), chargedConservatively: round(ledger.conservative), accounting: guard.summary().accounting },
    items,
    attempts: attempts.map(({ judgements, ...rest }) => ({ ...rest, verifiedIds: (judgements || []).filter((j) => !j.unverified).map((j) => j.id) })),
    http: httpLog,
    isolation: { forbiddenModulesLoaded: forbiddenLoaded(), processEnvStageFlags: Object.keys(process.env).filter((k) => /^SYLLABUS_CHECK_STAGE_/.test(k)) },
    note: 'Expected verdicts and recommendations are provisional (developer-written, unreviewed by faculty). A match is not faculty-verified accuracy, and an answer that was never verified is not a PASS.',
  };
  saveLedger();
  // The summary is computed after the record is complete, so a fault in it cannot lose the run's data.
  try {
    const recs = {}, expected = items.filter((r) => r.recommendation.type && r.recommendation.expected);
    for (const r of items) if (r.recommendation.type) recs[r.recommendation.type] = (recs[r.recommendation.type] || 0) + 1;
    result.summary = { ...summarize(result.attempts),
      recommendations: { verified: recs, asProvisionallyExpected: expected.filter((r) => r.recommendation.matchesExpected).length, withAnExpectation: expected.length,
        retags: items.filter((r) => r.recommendation.type === 'RETAG_OUTCOME').map((r) => ({ id: r.id, expected: r.recommendation.expected, draftInAnswer: r.recommendation.draftInAnswer })),
        rewrites: items.filter((r) => r.recommendation.type === 'REWRITE_TEXT').map((r) => ({ id: r.id, expected: r.recommendation.expected, status: r.recommendation.status })) },
      budget: { requests: { cap: maxRequests, used: ledger.requests, remaining: Math.max(0, maxRequests - ledger.requests) },
        dollars: { cap: maxCost, chargedAgainstCap: round(ledger.charged), remainingUnderCap: round(Math.max(0, maxCost - ledger.charged)), providerReported: result.usage.reportedCost, accounting, chargedConservatively: round(ledger.conservative) } } };
    // Only the baseline's attempts that asked a relationship this run asked, so a run of one course is not compared with a run of two.
    const asked = new Set(attempts.flatMap((a) => a.ids)), earlier = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;
    const same = earlier ? (earlier.attempts || []).filter((a) => (a.ids || []).some((id) => asked.has(id))) : [];
    result.comparison = { baseline: path.relative(repo, BASELINE).split(path.sep).join('/'), baselineStage: earlier ? earlier.stage || 'E.3 smoke (run 2)' : null, baselinePromptVersion: earlier ? earlier.promptVersion || null : null,
      attemptsCompared: same.length, note: 'only the baseline attempts that asked a relationship this run asked', before: earlier ? summarize(same) : null };
  } catch (error) { result.summary = { error: `the summary could not be computed: ${error.message}` }; }
  console.log(`\nrequests: ${result.requests.total} in the ledger (${result.requests.model} to the model, ${result.requests.priceLookups} price lookup(s) this run); retries ${result.requests.retries}`);
  console.log(`answers: ${result.responses.verified} verified, ${result.responses.invalid} invalid, ${result.responses.errors} errors (${result.responses.timeouts} timeouts); schema problems in ${result.responses.schemaProblems}; truncated ${result.responses.truncated}`);
  console.log(`tokens: input ${result.usage.promptTokens} (cached ${result.usage.cachedTokens}), output ${result.usage.completionTokens} (reasoning ${result.usage.reasoningTokens}); reported cost $${result.usage.reportedCost}; charged against the cap $${result.usage.charged}`);
  const s = result.summary, e3 = result.comparison && result.comparison.before && result.comparison.attemptsCompared ? result.comparison.before : null, was = (text) => (e3 ? ` (${result.comparison.baselineStage}, same relationships: ${text(e3)})` : '');
  if (s && !s.error) {
    const arrived = (a) => a.sent - a.errors; // a request that timed out or failed brought no answer to count
    console.log(`answers: ${s.answers.invalid} of ${arrived(s.answers)} invalid${s.answers.errors ? `; ${s.answers.errors} request(s) brought no answer (a timeout or another error)` : ''}${was((b) => `${b.answers.invalid} of ${arrived(b.answers)}`)}`);
    console.log(`judgements: ${s.judgements.valid} valid, ${s.judgements.refused} refused, of ${s.judgements.asked} asked${was((b) => `${b.judgements.valid} valid, ${b.judgements.refused} refused, of ${b.judgements.asked}`)}`);
    console.log(`relationships: ${s.relationships.verified} of ${s.relationships.asked} verified${was((b) => `${b.relationships.verified} of ${b.relationships.asked}`)}; most sends for one relationship ${s.sends.mostForOneRelationship}${was((b) => String(b.sends.mostForOneRelationship))}`);
    console.log(`refusal reasons: ${Object.entries(s.refusalReasons).map(([code, n]) => `${code} x${n}`).join('; ') || 'none'}`);
    console.log(`recommendations of the verified answers: ${Object.entries(s.recommendations.verified).map(([type, n]) => `${type} ${n}`).join(', ') || 'none'}; as provisionally expected ${s.recommendations.asProvisionallyExpected} of ${s.recommendations.withAnExpectation}`);
    console.log(`budget: ${s.budget.requests.used} of ${s.budget.requests.cap} requests used (${s.budget.requests.remaining} left); $${s.budget.dollars.chargedAgainstCap} of $${s.budget.dollars.cap} charged against the cap ($${s.budget.dollars.remainingUnderCap} left; accounting ${s.budget.dollars.accounting}, the conservative rule would have charged $${s.budget.dollars.chargedConservatively}); provider-reported cost $${s.budget.dollars.providerReported}`);
  } else if (s) console.log(s.error);
  console.log(describeMetrics(result.relationshipMetrics));
  console.log(`completion: ${result.completion.state} (${result.completion.reason})`);
  if (result.schema.minItemsNotEnforced) console.log(`schema: ${result.schema.minItemsNotEnforced}`);
  for (const w of result.warnings) console.log(`warning: ${w}`);
  for (const a of attempts.filter((x) => x.corrections)) console.log(`  attempt ${a.attempt} (${a.batch}, request ${a.request ?? 'not sent'}) carried corrections: ${a.corrections.map((c) => `${c.id} (${c.refused.join(', ')})`).join('; ')} -> ${a.outcome}${a.code ? ' ' + a.code : ''}`);
  for (const r of items) console.log(`  ${r.id.padEnd(24)} ${r.type.padEnd(15)} ${String(r.verdict).padEnd(19)} provisional ${r.provisional.join('/').padEnd(36)} quotes ${r.evidence ? (r.evidence.valid ? 'ok' : 'NOT FOUND') : '-'}  ${r.recommendation.type ? r.recommendation.type + ': ' : ''}${r.recommendation.status}${r.verifiedAfterCorrection ? ' (after a correction)' : ''}${r.stoppedBecause ? `  stopped: ${r.stoppedBecause} (${(r.failureCodes || []).join(', ')})` : ''}${r.aspects && r.aspects.contradictions.length ? '  CONTRADICTION ' + r.aspects.contradictions.join('; ') : ''}`);
  if (state.stopped) console.log(`stopped: ${state.stopped}`);
  if (result.isolation.forbiddenModulesLoaded.length) console.log(`ISOLATION BREACH: ${result.isolation.forbiddenModulesLoaded.join(', ')}`);
  const out = flag('out', '');
  if (out) { fs.writeFileSync(out, JSON.stringify(result, null, 2)); console.log(`wrote ${out}`); }
}

// An unexpected fault still writes what completed (the ledger is already written after every request).
main().catch((error) => {
  console.error(guard.redact(error && error.stack || error));
  if (mode !== 'plan') try { finish(); } catch (failure) { console.error(`the result could not be written: ${guard.redact(failure && failure.message)}`); }
  process.exit(1);
});
