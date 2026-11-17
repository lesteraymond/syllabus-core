'use strict';
// Builds REAL stored-run JSON (the exact object the browser receives from GET /compliance) for the UI conformance test: the production no-AI engine, the new
// AI Checker (pipeline/official.js officialize) with its scripted judge and rewriter, and the production storage code. No network, no database, no
// committed fixture: scripts/test-vpaa-ui.mjs calls this, writes a temporary JSON file for the bundled test, and deletes it afterwards.
const h = require('./harness');
const { createMemoryDb } = require('./memdb');
const svc = require('../../compliance/service');
const repo = require('../repository');
const engine = require('../engine');
const officialReplan = require('../pipeline/official');
const R = require('../pipeline/rules');
const T = require('../pipeline/testSyllabus');
const { semanticCoverageOf } = require('../semanticCoverage');
const { coverageOf } = require('../ruleCoverage');

const LINK = async (url) => ({ url, status: 'ok', httpStatus: 200 });
// a checklist answer: every item yes, except the ones named
const answer = (q, no) => ({ q: q.id, items: R.CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: no.includes(i.id) ? 'no' : 'yes' })), quote: String(q.field.text).split(/\s+/).slice(0, 4).join(' '), explanation: 'scripted' });

// The new checker's conforming syllabus (pipeline/testSyllabus.js: every fixed rule passes), with the sample masters. Its course details are the
// approved curriculum's, so the curriculum check passes as it would for a real syllabus.
function syllabusAndMasters() {
  const content = T.conforming(), { masters } = h.sample();
  const course = masters.curricula[0].courses.find(c => engine.normCode(c.code) === engine.normCode(content.meta.code)) || masters.curricula[0].courses[0];
  Object.assign(course, { code: content.meta.code, title: content.meta.title, prereq: content.meta.prereq, lecture: Number(content.meta.lecture), lab: Number(content.meta.lab) });
  content.meta.yearLevel = String(course.yearLevel); // the conforming syllabus names none
  return { content, masters };
}

async function oneRun({ judge, changed, syllabusId = 100 }) {
  const { content, masters } = syllabusAndMasters();
  masters.synthetic = false; masters.fingerprint = 'ui-fixture-fingerprint';
  repo.mastersFor = async () => masters; // storage and read-back take the masters from here, not from a database
  const db = createMemoryDb({ syllabus: { content: JSON.stringify(content) } });
  // what compliance/service.js checkHybrid does, with the scripted provider in place of Claude
  const result = await engine.run(content, masters, { env: {}, linkChecker: LINK });
  const provider = { model: 'claude-sonnet-5-5', ask: judge, rewrite: T.scriptedRewriter(), usage: () => null };
  try {
    await officialReplan.officialize({ noAi: result, content, masters, env: {}, provider, store: new Map(), year: 2026 });
  } catch (error) {
    result.hybrid.replan = { mode: 'official', error: String(error && error.message || error).slice(0, 300) };
    result.hybrid.alignment = { ...result.hybrid.alignment, status: 'not_evaluated', reason: 'The AI Checker could not complete: ' + result.hybrid.replan.error };
  }
  result.referenceHash = masters.fingerprint;
  result.hybrid.semanticCoverage = semanticCoverageOf(result);
  result.hybrid.ruleCoverage = coverageOf(result, content, masters);
  const runId = await svc.storeRun(db, { syllabusId, versionId: null, content, result, createdBy: 26, ai: true });
  const [rows] = await db.query('SELECT * FROM ai_check_runs WHERE run_id = ?', [runId]);
  const shown = changed ? Object.assign(structuredClone(content), { description: [{ id: 'd1', t: 'Changed after the check.' }] }) : content;
  return JSON.parse(JSON.stringify({ ...(await svc.loadDetail(db, rows[0], svc.hashOf(shown))), syllabusId }));
}

async function buildRuns() {
  // the first week's activities do not fit (ACTIVITY-FIT: one item no): a deduction and a draft to act on
  let first = true;
  const misaligned = () => T.scriptedJudge({ override: q => { if (q.relationship === 'ACTIVITY-FIT' && first) { first = false; return answer(q, [R.CHECKLISTS[q.relationship].items[0].id]); } return undefined; } });
  const fails = async () => { throw Object.assign(new Error('upstream timeout'), { kind: 'provider_timeout' }); };
  return {
    scored: await oneRun({ judge: misaligned() }),
    clean: await oneRun({ judge: T.scriptedJudge() }),
    failed: await oneRun({ judge: fails }),
    stale: await oneRun({ judge: (first = true, misaligned()), changed: true }),
  };
}
module.exports = { buildRuns };
