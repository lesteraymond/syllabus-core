'use strict';
// Builds REAL stored-run JSON (the exact object the browser receives from GET /compliance) for the UI conformance test, by running the production
// service and storage code with scripted model answers. No network, no database, no committed fixture: scripts/test-vpaa-ui.mjs calls this, writes a
// temporary JSON file for the bundled test, and deletes it afterwards.
const h = require('./harness');
const { createMemoryDb } = require('./memdb');
const svc = require('../../compliance/service');
const repo = require('../repository');
const gemini = require('../gemini');
const { documentedStagingEnv } = require('./staging');

const LINK = async (url) => ({ url, status: 'ok', httpStatus: 200 });
const flags = { SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_STAGE_C3: 'on' };

async function oneRun({ env, exact = false, script, transport, changed, mutate, syllabusId = 100 }) {
  gemini.resetProviderBlock();
  const { content, masters } = h.sample();
  if (mutate) mutate(content, masters);
  masters.synthetic = false; masters.fingerprint = 'ui-fixture-fingerprint';
  repo.mastersFor = async () => masters;
  const db = createMemoryDb({ syllabus: { content: JSON.stringify(content) } });
  const tr = transport || h.scriptedTransport(script);
  const result = await svc.checkHybrid(db, content, { syllabusId, env: exact ? env : h.envFor(env), transport: tr, linkChecker: LINK });
  const runId = await svc.storeRun(db, { syllabusId, versionId: null, content, result, createdBy: 26, ai: true });
  const [rows] = await db.query('SELECT * FROM ai_check_runs WHERE run_id = ?', [runId]);
  const shown = changed ? Object.assign(structuredClone(content), { description: [{ id: 'd1', t: 'Changed after the check.' }] }) : content;
  return JSON.parse(JSON.stringify({ ...(await svc.loadDetail(db, rows[0], svc.hashOf(shown))), syllabusId }));
}

async function buildRuns() {
  const misaligned = (p) => (p.id === 'row0-ilo0-activity' ? { label: 'NOT_ALIGNED' } : p.id === 'row0-contentassessment' ? { label: 'PARTIALLY_ALIGNED' } : undefined);
  return {
    scored: await oneRun({ env: flags, script: misaligned }),
    clean: await oneRun({ env: flags, script: () => undefined }),
    failed: await oneRun({ env: flags, transport: async () => new Response(JSON.stringify({ type: 'error', error: { type: 'timeout_error', message: 'upstream timeout' } }), { status: 504, headers: { 'content-type': 'application/json' } }) }),
    stale: await oneRun({ env: flags, script: misaligned, changed: true }),
    v2: await oneRun({ env: { ...flags, SYLLABUS_CHECK_ACADEMIC_V2: 'on' }, script: misaligned }),
    // the default production configuration: V2 off, no stage on, so only two of the seven relationships are checked
    default: await oneRun({ env: { SYLLABUS_CHECK_ACADEMIC_V2: 'off' }, script: () => undefined }),
    // the exact documented staging environment (POLICY-V2-ACTIVATION.md), scripted provider, with failing relationships so there is something to recommend
    staging: await oneRun({ env: documentedStagingEnv(), exact: true, script: (p) => (['row0-content', 'row0-ilo0-activity'].includes(p.id) ? { label: 'NOT_ALIGNED' } : p.id === 'row0-contentassessment' ? { label: 'PARTIALLY_ALIGNED' } : undefined) }),
    // V2 on, with one CLO whose classification is not saved
    blankClo: await oneRun({ env: { SYLLABUS_CHECK_ACADEMIC_V2: 'on' }, script: () => undefined, mutate: (content) => { content.clos[1].level = ''; } }),
  };
}
module.exports = { buildRuns };
