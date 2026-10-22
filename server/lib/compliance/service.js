'use strict';
// Compliance checks as the server uses them: run the rules, store a run with its area scores and findings, attach
// recommendations afterwards (a background job, outside any request's transaction), and read stored runs back.
//
// Until `npm run migrate-compliance` has been run the tables do not exist: isInstalled() says so, storing is skipped, and submit
// still works (the conformance gate needs no tables).
const standard = require('./standard-v4.json');
const { evaluate } = require('./rules');
const { contentHash } = require('./hash');
const { recommend } = require('./recommend');
const { MockProvider, LlmProvider } = require('./providers');
const { createGeminiClient } = require('./geminiClient');
const { createOpenRouterClient } = require('./openrouterClient');
const { inTransaction } = require('../http');
const { schoolYearStart } = require('../schoolYear');
const uploadCheck = require('./upload');
const { judgeContent } = require('./meaning');

// ---- is the database ready? (only a positive answer is remembered, so running the migration needs no restart) ----
let installed = false;
async function isInstalled(db) {
  if (installed) return true;
  try { await db.query('SELECT 1 FROM ai_check_runs LIMIT 1'); installed = true; } catch { installed = false; }
  return installed;
}
const resetInstalledCache = () => { installed = false; };

// ---- running the rules ----
// `catalog` is the live { institution, program } (see catalogSnapshot in routes/syllabusContent.js); `preparedBy` the owner's name.
// `judged` is the AI's verdict on the fields (see meaning.js); without it those rules do not apply.
const check = (content, { catalog, preparedBy, judged } = {}) => evaluate(content, standard, { year: schoolYearStart(), catalog, preparedBy, judged });

// The 409 a blocking failure turns into: a message and the rules that failed, so the builder can show each next to its step.
function gateError(result) {
  const failed = result.conformance.failed;
  return {
    message: 'This syllabus does not follow the form yet: ' + failed[0].message + (failed.length > 1 ? ' (and ' + (failed.length - 1) + ' more).' : ''),
    failed: failed.slice(0, 50).map((f) => ({ id: f.id, ruleId: f.ruleId, step: f.step, path: f.path, message: f.message })),
  };
}

// ---- storing ----
const j = (v) => (v === undefined || v === null ? null : JSON.stringify(v));

// Inside the caller's transaction. Returns the run id.
// `ai: false` for a run that gets no AI step (an uploaded file has no form to describe to a provider): it stays 'none'.
async function storeRun(conn, { syllabusId, versionId = null, content, result, createdBy = null, ai = true }) {
  const aiStatus = ai && result.status === 'scored' && (result.findings.length || canJudge()) ? 'pending' : 'none';
  const [ins] = await conn.query(
    `INSERT INTO ai_check_runs (syllabus_id, version_id, content_hash, standard_version, overall, status, passed, conformant, ai_status, contact, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [syllabusId, versionId, contentHash(content, standard.version), standard.version, result.overall, result.status, result.passed ? 1 : 0, result.conformance.ok ? 1 : 0, aiStatus, j(result.contact), createdBy]
  );
  const runId = ins.insertId;
  await conn.query('INSERT INTO ai_check_area_scores (run_id, area_key, name, weight, score) VALUES ?', [result.areas.map((a) => [runId, a.key, a.name, a.weight, a.score])]);
  await insertFindings(conn, runId, result.findings);
  return runId;
}

// A finding is the rules' own, or the AI's verdict that a field is not meaningful (rules J-01 to J-05).
async function insertFindings(conn, runId, findings) {
  if (!findings.length) return;
  await conn.query(
    'INSERT INTO ai_findings (run_id, kind, source, area, rule_id, severity, step, path, message, evidence, position) VALUES ?',
    [findings.map((f, i) => [runId, 'finding', /^J-/.test(f.ruleId) ? 'ai' : 'rule', f.area, f.ruleId, f.severity, f.step, f.path.slice(0, 255), f.message, j(f.evidence), i])]
  );
}

// The run again, scored with the AI's verdicts: the score, the six area scores and the findings are replaced by the new result.
async function applyJudgment(db, runId, result) {
  await inTransaction(db, async (conn) => {
    await conn.query('UPDATE ai_check_runs SET overall = ?, status = ?, passed = ?, conformant = ? WHERE run_id = ?', [result.overall, result.status, result.passed ? 1 : 0, result.conformance.ok ? 1 : 0, runId]);
    await conn.query('DELETE FROM ai_check_area_scores WHERE run_id = ?', [runId]);
    await conn.query('INSERT INTO ai_check_area_scores (run_id, area_key, name, weight, score) VALUES ?', [result.areas.map((a) => [runId, a.key, a.name, a.weight, a.score])]);
    await conn.query("DELETE FROM ai_findings WHERE run_id = ? AND kind = 'finding'", [runId]);
    await insertFindings(conn, runId, result.findings);
  });
}

// The recommendations, and what the AI step ended up doing, saved against a run. No provider configured is not an error: the
// run is simply "rule-based" (ai_status 'none', no error text).
async function attachRecommendations(db, runId, rec) {
  const notConfigured = rec.ai.status === 'failed' && rec.ai.reason === 'not_configured';
  const status = notConfigured ? 'none' : rec.ai.status === 'ok' ? 'ok' : rec.ai.status === 'failed' ? 'failed' : 'none';
  await inTransaction(db, async (conn) => {
    await conn.query("DELETE FROM ai_findings WHERE run_id = ? AND kind = 'recommendation'", [runId]);
    if (rec.items.length) {
      await conn.query(
        'INSERT INTO ai_findings (run_id, kind, source, area, title, message, step, based_on, links, priority, priority_level, position) VALUES ?',
        [rec.items.map((it, i) => [runId, 'recommendation', it.source, it.areas[0] || null, it.title.slice(0, 160), it.text, it.step, j(it.basedOn), j({ steps: it.steps, areas: it.areas, rows: it.rows, clos: it.clos }), it.priority, it.level, i])]
      );
    }
    await conn.query(
      'UPDATE ai_check_runs SET ai_status = ?, ai_error = ?, provider = ?, model = ?, prompt_version = ? WHERE run_id = ?',
      [status, status === 'failed' ? ((rec.ai.reason || 'error') + ': ' + (rec.ai.error || '')).slice(0, 255) : null, rec.ai.provider || null, rec.ai.model || null, rec.ai.promptVersion || null, runId]
    );
  });
}

// ---- the AI step, as a background job ----
let provider;
function getProvider() {
  if (provider !== undefined) return provider;
  // COMPLIANCE_AI_PROVIDER picks one ('mock', 'llm' = an unconfigured stub, 'openrouter', 'gemini', or 'off'). Unset, an
  // OPENROUTER_API_KEY selects OpenRouter, else a GEMINI_API_KEY selects Gemini.
  const name = String(process.env.COMPLIANCE_AI_PROVIDER || (process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.GEMINI_API_KEY ? 'gemini' : '')).toLowerCase();
  if (name === 'openrouter' && process.env.OPENROUTER_API_KEY) {
    const client = createOpenRouterClient({ apiKey: process.env.OPENROUTER_API_KEY, ...(process.env.OPENROUTER_MODEL ? { model: process.env.OPENROUTER_MODEL } : {}) });
    provider = new LlmProvider({ client, model: client.model });
  } else if (name === 'gemini' && process.env.GEMINI_API_KEY) {
    const client = createGeminiClient({ apiKey: process.env.GEMINI_API_KEY, ...(process.env.GEMINI_MODEL ? { model: process.env.GEMINI_MODEL } : {}) });
    provider = new LlmProvider({ client, model: client.model });
  } else {
    provider = name === 'mock' ? new MockProvider() : name === 'llm' ? new LlmProvider() : null;
  }
  return provider;
}
const setProvider = (p) => { provider = p; };
// Whether the configured provider can judge the fields (a real model can; the offline one cannot).
const canJudge = () => { const p = getProvider(); return !!p && typeof p.judge === 'function'; };

const pending = new Set();
// Runs after the request that caused it has answered. It never throws; a failure leaves the run with ai_status 'failed'.
// `names` are people named on the syllabus (the owner and the sign-off): they are masked in what a provider sees.
// `rescore(judged)` is the same check run again with the AI's verdicts. The job: the AI judges the fields, the run is scored again with
// its verdicts, then recommendations are written from what is still wrong. A failed judging step only means no verdicts: the rules' own
// score stands and the recommendations are still written.
function startAiJob(db, { runId, content, result, names = [], timeoutMs, rescore }) {
  const job = (async () => {
    try {
      const p = getProvider();
      let current = result;
      let judgeError = null;
      if (rescore && canJudge()) {
        try {
          const judged = await judgeContent({ provider: p, content, names, ...(timeoutMs ? { timeoutMs } : {}) });
          if (judged && judged.length) { current = rescore(judged); await applyJudgment(db, runId, current); }
        } catch (err) { judgeError = err; console.error('COMPLIANCE AI JUDGE:', err.message); }
      }
      if (current.findings.length) {
        const rec = await recommend({ provider: p, result: current, content, standard, names, ...(timeoutMs ? { timeoutMs } : {}) });
        await attachRecommendations(db, runId, rec);
      } else {
        // Nothing left to fix: the run is "AI-assisted" when the AI looked at the fields, and failed when it could not.
        await db.query('UPDATE ai_check_runs SET ai_status = ?, ai_error = ?, provider = ?, model = ?, prompt_version = ? WHERE run_id = ?',
          [judgeError ? 'failed' : 'ok', judgeError ? ((judgeError.code || 'error') + ': ' + judgeError.message).slice(0, 255) : null, p.name || null, p.model || null, p.promptVersion || null, runId]);
      }
    } catch (err) {
      console.error('COMPLIANCE AI JOB:', err.message);
      try { await db.query("UPDATE ai_check_runs SET ai_status = 'failed', ai_error = ? WHERE run_id = ?", [String(err.message).slice(0, 255), runId]); } catch { /* nothing more to do */ }
    }
  })();
  pending.add(job);
  job.finally(() => pending.delete(job));
  return job;
}
const settled = () => Promise.all([...pending]);

// The names a provider must not see: the owner, and anyone named in a stored sign-off.
const namesFor = (owner, content) => [
  owner && owner.firstName && owner.lastName ? owner.firstName + ' ' + owner.lastName : '',
  ...(content && content.signoff && typeof content.signoff === 'object' ? Object.values(content.signoff).filter((v) => typeof v === 'string') : []),
].filter(Boolean);

// ---- reading ----
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const bandOf = (overall) => (overall === null || overall === undefined ? null : standard.bands.find((b) => overall >= b.min).label);

function summarize(run, areas, currentHash) {
  const overall = run.overall === null || run.overall === undefined ? null : Number(run.overall);
  return {
    id: run.run_id,
    syllabusId: run.syllabus_id,
    versionId: run.version_id,
    standard: run.standard_version,
    status: run.status,
    overall,
    band: bandOf(overall),
    passThreshold: standard.passThreshold,
    passed: !!run.passed,
    conformant: !!run.conformant,
    aiStatus: run.ai_status,
    aiError: run.ai_error || null,
    provider: run.provider || null,
    model: run.model || null,
    promptVersion: run.prompt_version || null,
    contact: parse(run.contact),
    createdAt: run.created_at || null,
    createdBy: run.created_by === undefined ? null : run.created_by,
    stale: currentHash ? run.content_hash !== currentHash : false,
    areas: areas.map((a) => ({ key: a.area_key, name: a.name, weight: Number(a.weight), score: a.score === null || a.score === undefined ? null : Number(a.score) })),
  };
}

async function loadAreas(db, runIds) {
  if (!runIds.length) return new Map();
  const [rows] = await db.query('SELECT run_id, area_key, name, weight, score FROM ai_check_area_scores WHERE run_id IN (?) ORDER BY run_id', [runIds]);
  const byRun = new Map();
  const order = standard.areas.map((a) => a.key);
  rows.forEach((r) => { (byRun.get(r.run_id) || byRun.set(r.run_id, []).get(r.run_id)).push(r); });
  byRun.forEach((list) => list.sort((a, b) => order.indexOf(a.area_key) - order.indexOf(b.area_key)));
  return byRun;
}

// A run with everything: area scores, findings, recommendations.
async function loadDetail(db, run, currentHash) {
  const areas = (await loadAreas(db, [run.run_id])).get(run.run_id) || [];
  const [rows] = await db.query('SELECT * FROM ai_findings WHERE run_id = ? ORDER BY position', [run.run_id]);
  const out = summarize(run, areas, currentHash);
  out.findings = rows.filter((r) => r.kind === 'finding').map((r) => ({
    id: r.rule_id + ':' + r.path, area: r.area, source: r.source, ruleId: r.rule_id, severity: r.severity, step: r.step, path: r.path, message: r.message, evidence: parse(r.evidence) || {},
  }));
  out.recommendations = rows.filter((r) => r.kind === 'recommendation').map((r) => {
    const links = parse(r.links) || {};
    return {
      source: r.source, title: r.title, text: r.message, step: r.step, basedOn: parse(r.based_on) || [],
      steps: links.steps || [], areas: links.areas || [], rows: links.rows || [], clos: links.clos || [],
      priority: r.priority === null ? null : Number(r.priority), level: r.priority_level,
    };
  });
  return out;
}

// An administrator's check, as SQL on ai_check_runs: stored with a submitted version by someone other than the syllabus's owner. The run a
// faculty member's own submit stores (it gates the submit) is not one: the administrator checks every submission themselves, in the AI
// Checker, and only such a check counts for the administrator (the list, the history, the stored result).
const ADMIN_RUN_SQL = 'version_id IS NOT NULL AND created_by IS NOT NULL AND created_by <> (SELECT s.user_id FROM syllabi s WHERE s.syllabus_id = ai_check_runs.syllabus_id)';

// The newest run of a syllabus. `adminOnly` keeps to the administrator's checks (see ADMIN_RUN_SQL); without it the owner sees their own
// newest run, a draft check included.
async function latestRun(db, syllabusId, { adminOnly = false } = {}) {
  const [rows] = await db.query(
    'SELECT * FROM ai_check_runs WHERE syllabus_id = ?' + (adminOnly ? ' AND ' + ADMIN_RUN_SQL : '') + ' ORDER BY run_id DESC LIMIT 1',
    [syllabusId]
  );
  return rows[0] || null;
}
// A stored run for this exact content. `adminOnly` keeps to the administrator's checks, so an administrator's Check is never answered by
// the run the faculty member's submit stored. `versionId` keeps to the same version: every version needs its own check, so content that
// returns to what an earlier version said (a revert) is checked again, not answered by that older version's run.
async function cachedRun(db, syllabusId, hash, { adminOnly = false, versionId = null } = {}) {
  const [rows] = await db.query(
    'SELECT * FROM ai_check_runs WHERE syllabus_id = ? AND content_hash = ? AND standard_version = ?' + (adminOnly ? ' AND ' + ADMIN_RUN_SQL : '') + (versionId !== null ? ' AND version_id = ?' : '') + ' ORDER BY run_id DESC LIMIT 1',
    versionId !== null ? [syllabusId, hash, standard.version, versionId] : [syllabusId, hash, standard.version]
  );
  return rows[0] || null;
}

// ---- an uploaded file instead of a form ----
// The rule check of a PDF upload (lib/compliance/upload.js). Its "content", for the hash that says whether a run is still current, is the
// file's name and size: a re-upload is a new file, and a new version, so it is never answered by an older run.
const uploadFingerprint = (filePath, facts) => ({ upload: { file: String(filePath || '').split('/').pop(), size: facts.size } });
async function versionFile(db, versionId) {
  const [rows] = await db.query('SELECT file_path FROM syllabus_versions WHERE version_id = ?', [versionId]);
  return rows[0] && rows[0].file_path ? rows[0].file_path : null;
}

// ---- has the administrator checked what was submitted? ----
// For each syllabus id: { checkable, checked }. checkable: its newest version has a form or a file the check can read. checked: the
// administrator's own check (ADMIN_RUN_SQL) was made on that newest version, so a new version submitted since needs a new check.
// A database without the tables yet has no checks, so every checkable syllabus reads as not checked.
async function adminCheckStates(db, ids) {
  const out = new Map();
  if (!ids.length) return out;
  const [versions] = await db.query(
    'SELECT v.syllabus_id, v.version_id, (v.content IS NOT NULL OR v.file_path IS NOT NULL) AS checkable FROM syllabus_versions v JOIN (SELECT MAX(version_id) AS version_id FROM syllabus_versions WHERE syllabus_id IN (?) GROUP BY syllabus_id) m ON m.version_id = v.version_id',
    [ids]
  );
  const [runs] = await db.query('SELECT DISTINCT syllabus_id, version_id FROM ai_check_runs WHERE syllabus_id IN (?) AND ' + ADMIN_RUN_SQL, [ids]);
  const checkedOn = new Set(runs.map((r) => r.syllabus_id + ':' + r.version_id));
  versions.forEach((v) => out.set(v.syllabus_id, { checkable: !!Number(v.checkable), checked: checkedOn.has(v.syllabus_id + ':' + v.version_id) }));
  return out;
}

// The newest submitted version of a syllabus: what a reviewer is looking at. { version_id, version_label, content } or null.
async function latestVersion(db, syllabusId) {
  const [rows] = await db.query('SELECT version_id, version_label, content FROM syllabus_versions WHERE syllabus_id = ? ORDER BY version_id DESC LIMIT 1', [syllabusId]);
  return rows[0] || null;
}

// Include the selected subject setup in administrator draft checks so setup edits invalidate publication checks.
const publicationContent = (content,catalog) => ({ ...content, subjectCheckBasis: { institution: catalog.institution, program: catalog.program, subjectId: catalog.subjectId } });
const hashOf = (content) => contentHash(content, standard.version);

module.exports = {
  publicationContent, ADMIN_RUN_SQL, adminCheckStates, uploadCheck, uploadFingerprint, versionFile, standard, check, gateError, isInstalled, resetInstalledCache, storeRun, attachRecommendations,
  startAiJob, canJudge, applyJudgment, settled, getProvider, setProvider, namesFor, summarize, loadAreas, loadDetail, latestRun, cachedRun, latestVersion, hashOf, bandOf,
};
