'use strict';
// The old AI Checker is retired (owner, 2026-11-17: "don't use the old AI Checker anymore"). Through the real check service: with an AI provider set but
// the new checker not ready, nothing is sent to any AI and the check is incomplete with the reason (before: the old checker ran with its AI, Policy V2 and
// the whole-syllabus plan). Offline: scripted transport, network blocked.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../vpaa-conformance/harness');
const svc = require('../../compliance/service');
const repo = require('../repository');
const { createMemoryDb } = require('../vpaa-conformance/memdb');

const link = async url => ({ url, status: 'ok', httpStatus: 200 });
// every old AI path switched on, as the dev .env has them, and Policy V2 on; the new checker is NOT ready (SYLLABUS_CHECK_REPLAN is not official)
const OLD_ALL_ON = { SYLLABUS_CHECK_ACADEMIC_V2: 'on', SYLLABUS_CHECK_WHOLE_PLAN: 'on', SYLLABUS_CHECK_COORDINATED_PLAN: 'on', SYLLABUS_CHECK_REQUIREMENTS_ADVICE: 'on',
  SYLLABUS_CHECK_STAGE_A: 'on', SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_STAGE_C1: 'on', SYLLABUS_CHECK_STAGE_C2: 'on', SYLLABUS_CHECK_STAGE_C3: 'on', SYLLABUS_CHECK_STAGE_D2: 'on' };

async function check(t, over, options = {}) {
  h.liveGuard(t);
  const { content, masters } = h.sample(); masters.synthetic = false; masters.fingerprint = 'retired-old-checker';
  t.mock.method(repo, 'mastersFor', async () => masters);
  const db = createMemoryDb({ syllabus: { content: JSON.stringify(content) } });
  const transport = h.scriptedTransport();
  const result = await svc.checkHybrid(db, content, { syllabusId: 100, env: h.envFor({ ...OLD_ALL_ON, ...over }), transport, linkChecker: link, ...options });
  return { result, transport };
}

test('the new checker not ready: no AI request at all, no old-checker verdicts, plans or Policy V2, and the check is incomplete with the reason', async t => {
  assert.equal(process.env.SYLLABUS_CHECK_LEGACY_AI, undefined);
  const { result, transport } = await check(t, {});
  assert.equal(transport.sent.length, 0, 'nothing is sent to any AI');
  assert.equal(result.hybrid.alignment.status, 'not_evaluated');
  assert.match(result.hybrid.alignment.reason, /^The new AI Checker is not ready on this server: SYLLABUS_CHECK_REPLAN is not official$/);
  assert.equal(result.hybrid.academicV2, undefined, 'Policy V2 does not run');
  assert.equal(result.hybrid.improvementPlan, undefined, 'no old whole-syllabus or coordinated plan');
  assert.ok(!(result.hybrid.suggestions || []).length, 'no old-checker drafts');
  assert.ok(result.findings.length >= 0 && result.hybrid.baseScore !== undefined, 'the no-AI rules still run');
});

test('the same with a cost cap missing: the reason names it', async t => {
  const { result, transport } = await check(t, { SYLLABUS_CHECK_REPLAN: 'official' });
  assert.equal(transport.sent.length, 0);
  assert.match(result.hybrid.alignment.reason, /not ready on this server: SYLLABUS_CHECK_REPLAN_MAX_COST_USD is required/);
});

test('a check without AI is the no-AI rules only, with no "not ready" reason', async t => {
  const { result, transport } = await check(t, {}, { useAi: false });
  assert.equal(transport.sent.length, 0);
  assert.equal(result.hybrid.replan, undefined);
  assert.equal(result.hybrid.academicV2, undefined);
});
