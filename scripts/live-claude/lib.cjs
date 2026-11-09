'use strict';
// Shared helpers for the controlled real-Claude test. Nothing here sends a request by itself: every function that could reach a provider takes the transport it is
// given, so the offline plan and tests pass a scripted one and the authorized live runner passes the guarded one (server/lib/syllabuscheck/eval/providerGuard.js).
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const harness = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/harness'));
const svc = require(path.join(ROOT, 'server/lib/compliance/service'));
const repo = require(path.join(ROOT, 'server/lib/syllabuscheck/repository'));
const { createMemoryDb } = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/memdb'));
const profile = require(path.join(ROOT, 'server/lib/syllabuscheck/checkingProfile'));
const anthropic = require(path.join(ROOT, 'server/lib/syllabuscheck/anthropicClient'));

const MODEL = 'claude-sonnet-5-5';
const [IN_PER_M, OUT_PER_M, CACHE_READ_PER_M] = anthropic.PRICES[MODEL];
const US_FACTOR = anthropic.US_ONLY_FACTOR;

// The environment of the REAL Anthropic provider path: the same variables a staging server sets. `key` is a stand-in for offline work and the real key (read from the process
// environment by the caller, never printed) for an authorized live run. Provider, model and the approval lock are the verified ones; the in-app caps are the arguments.
// mode 'comprehensive' (the profile) or 'v2only' (Policy V2 on, no profile: the scored relationships and the seven VPAA links and four CLO classifications, without the optional stages).
function anthropicEnv({ key, cap, maxRequests = 120, mode = 'comprehensive', extra = {} } = {}) {
  const modeEnv = mode === 'v2only' ? { SYLLABUS_CHECK_ACADEMIC_V2: 'on' } : { [profile.FLAG]: profile.NAME };
  return { ...process.env, SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: key, ANTHROPIC_MODEL: MODEL, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL, SYLLABUS_CHECK_AI_GATE: 'advisory', ANTHROPIC_MAX_RETRIES: '0',
    ...modeEnv, SYLLABUS_CHECK_AI_MAX_COST_USD: String(cap), SYLLABUS_CHECK_AI_MAX_REQUESTS: String(maxRequests), ...extra };
}
const STAND_IN_KEY = 'sk-ant-local-stand-in-not-a-real-key-0123456789';

// A per-check budget that also keeps a record of every request it is asked to reserve (size, ceiling, estimated worst case). The reservation itself is the real one.
function recordingBudget(env) {
  const real = require(path.join(ROOT, 'server/lib/syllabuscheck/gemini')).createRequestBudget(env);
  const log = [];
  const budget = { ...real, reserveRequest(body, maxOut, options) {
    const before = real.summary().reservedCostUsd || 0; const r = real.reserveRequest(body, maxOut, options);
    const text = JSON.stringify(body);
    const types = [...new Set([...text.matchAll(/\\"type\\":\\"([A-Z][A-Za-z0-9-]+)\\"|"type":"([A-Z][A-Za-z0-9-]+)"/g)].map((m) => m[1] || m[2]))];
    log.push({ bytes: Buffer.byteLength(text, 'utf8'), maxOut, reservedUsd: (real.summary().reservedCostUsd || 0) - before, priority: (options && options.priority) || 'scored', types });
    return r;
  } };
  return { budget, log };
}

// The application's environment for a comprehensive-profile check. `cap` is the in-app per-check RESERVATION ceiling (it reserves each request at its worst case and is
// never reconciled downward, so it is not the dollars spent); `maxRequests` bounds the requests of one check.
function profileEnv({ cap, maxRequests = 120, extra = {} } = {}) {
  return harness.envFor({ [profile.FLAG]: profile.NAME, SYLLABUS_CHECK_AI_MAX_COST_USD: String(cap), SYLLABUS_CHECK_AI_MAX_REQUESTS: String(maxRequests), ...extra });
}

// Runs one synthetic fixture through the real service (deterministic rules, scored relationships, Policy V2, coverage, budget) against the memory database. The
// masters come from the fixture, not from any database. `transport` decides what answers the model requests.
async function runFixture(fixture, { env, transport, signal, requestBudget } = {}) {
  const masters = structuredClone(fixture.masters); masters.synthetic = false; masters.fingerprint = 'live-claude-' + fixture.meta.case;
  const original = repo.mastersFor;
  repo.mastersFor = async () => masters;
  try {
    const db = createMemoryDb({ syllabus: { content: JSON.stringify(fixture.content) } });
    return await svc.checkHybrid(db, fixture.content, { syllabusId: 100, env, transport, signal, ...(requestBudget ? { requestBudget } : {}), linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) });
  } finally { repo.mastersFor = original; }
}

// The stored-run object the browser receives from GET /compliance for a result, built with the production storage code over the in-memory database (no network, no
// database server, no model). The faculty UI is rendered from this (scripts/live-claude/render-ui.mjs).
async function storedRunOf(fixture, result) {
  const masters = structuredClone(fixture.masters); masters.synthetic = false; masters.fingerprint = 'live-claude-' + fixture.meta.case;
  const original = repo.mastersFor;
  repo.mastersFor = async () => masters;
  try {
    const db = createMemoryDb({ syllabus: { content: JSON.stringify(fixture.content) } });
    const runId = await svc.storeRun(db, { syllabusId: 100, versionId: null, content: fixture.content, result, createdBy: 26, ai: true });
    const [rows] = await db.query('SELECT * FROM ai_check_runs WHERE run_id = ?', [runId]);
    return JSON.parse(JSON.stringify({ ...(await svc.loadDetail(db, rows[0], svc.hashOf(fixture.content))), syllabusId: 100 }));
  } finally { repo.mastersFor = original; }
}

// A transport that records every request it is asked to send (size and relationship types) and answers with the scripted double.
function recordingTransport(script) {
  const base = harness.scriptedTransport(script);
  const log = [];
  const transport = async (url, init) => {
    const body = String(init && init.body || '');
    const types = [...new Set([...body.matchAll(/\\"type\\":\\"([A-Z][A-Za-z0-9-]+)\\"|"type":"([A-Z][A-Za-z0-9-]+)"/g)].map((m) => m[1] || m[2]))];
    log.push({ bytes: Buffer.byteLength(body, 'utf8'), types });
    return base(url, init);
  };
  return { transport, log };
}

// Estimated dollars for a set of requests under the calibrated model (see plan.cjs for the calibration). All prices from anthropicClient.PRICES.
const dollars = ({ inputTokens, cachedShare = 0, outputTokens, geo = 1 }) => ((inputTokens * (1 - cachedShare) * IN_PER_M + inputTokens * cachedShare * CACHE_READ_PER_M + outputTokens * OUT_PER_M) / 1e6) * geo;

module.exports = { storedRunOf, anthropicEnv, STAND_IN_KEY, recordingBudget, ROOT, MODEL, IN_PER_M, OUT_PER_M, CACHE_READ_PER_M, US_FACTOR, harness, profile, profileEnv, runFixture, recordingTransport, dollars };
