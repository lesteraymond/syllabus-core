'use strict';
// A reviewer's choice for a submitted syllabus: check it with the AI Checker, or review it WITHOUT an AI check.
// Every reviewer (the dean/administrator, the Asst. VPAA, the LIC Director and the VPAA) chooses for themselves, per version of the syllabus:
//   with AI       nothing is stored here: the reviewer runs the check in the AI Checker (an ai_check_runs row on the newest version, as before)
//   without AI    a syllabus_review_ai_choices row for (syllabus, newest version, reviewer), and a line in the syllabus's log
// Either one lets that reviewer clear their stage or decide (routes/reviewChain.js, routes/syllabi.js). The gate is otherwise unchanged: with no check and no
// choice the reviewer is still asked to choose first. A resubmission is a new version, so the choice is asked again.
// Not allowed when the institution requires a completed AI check (SYLLABUS_CHECK_AI_GATE=required, lib/syllabuscheck/policy.js): the AI check then stays
// mandatory. The coded hard gates at approval (lib/compliance/service.js requireHybrid) always apply, whatever was chosen.
// Until `npm run migrate-review-ai-choice` has run the table is missing: nothing is read (no reviewer has chosen) and choosing answers 503.
const { httpError } = require('./http');
const { aiGate } = require('./syllabuscheck/policy');

const WITHOUT_AI = 'without_ai';
const NOT_SET_UP = 'Reviewing without an AI check is not set up on this server yet. Ask an administrator to run npm run migrate-review-ai-choice.';
const REQUIRED = 'The institution requires a completed AI check before a syllabus is reviewed. Check it in the AI Checker.';

let installed = false;
async function isInstalled(db) {
  if (installed) return true;
  try { await db.query('SELECT 1 FROM syllabus_review_ai_choices LIMIT 1'); installed = true; } catch { installed = false; }
  return installed;
}
const resetInstalledCache = () => { installed = false; };

// May a reviewer choose to review without an AI check under the current policy?
const allowed = (env = process.env) => aiGate(env) !== 'required';

const key = (syllabusId, versionId) => syllabusId + ':' + versionId;

// The (syllabus, version) pairs this reviewer chose to review without an AI check, among `ids`: a Set of 'syllabusId:versionId'. Empty when the table is missing.
async function choicesOf(db, ids, reviewerId) {
  const out = new Set();
  if (!ids.length || !reviewerId || !(await isInstalled(db))) return out;
  const [rows] = await db.query('SELECT syllabus_id, version_id FROM syllabus_review_ai_choices WHERE syllabus_id IN (?) AND reviewer_id = ? AND choice = ?', [ids, reviewerId, WITHOUT_AI]);
  rows.forEach((r) => out.add(key(r.syllabus_id, r.version_id)));
  return out;
}

// Did this reviewer choose to review this version without an AI check? Under a policy that requires the AI check, a stored choice does not count.
async function chose(db, syllabusId, versionId, reviewerId) {
  if (versionId == null || !allowed()) return false;
  try { return (await choicesOf(db, [syllabusId], reviewerId)).has(key(syllabusId, versionId)); }
  catch { return false; } // fails closed: when the choice cannot be read, the reviewer is asked to check or choose again
}

// May this reviewer act on the newest version? `state` is compliance.adminCheckStates' answer for the syllabus ({ checkable, checked, versionId }).
// Yes when there is nothing to check, when it was checked with AI, or when this reviewer chose to review it without an AI check.
async function mayReview(db, syllabusId, state, reviewerId) {
  if (!state || !state.checkable || state.checked) return true;
  return chose(db, syllabusId, state.versionId, reviewerId);
}

// Records the choice (inside the caller's transaction `conn`). Choosing again for the same version changes nothing.
async function record(conn, { syllabusId, versionId, reviewerId, note = '' }) {
  if (!allowed()) throw httpError(409, REQUIRED, { code: 'ai_check_required' });
  if (!(await isInstalled(conn))) throw httpError(503, NOT_SET_UP);
  const [r] = await conn.query('INSERT IGNORE INTO syllabus_review_ai_choices (syllabus_id, version_id, reviewer_id, choice, note) VALUES (?, ?, ?, ?, ?)',
    [syllabusId, versionId, reviewerId, WITHOUT_AI, String(note || '').trim().slice(0, 500) || null]);
  return { created: !!(r && r.affectedRows) };
}

module.exports = { WITHOUT_AI, NOT_SET_UP, REQUIRED, isInstalled, resetInstalledCache, allowed, choicesOf, chose, mayReview, record };
