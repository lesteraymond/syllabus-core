// The review chain's memory: which of the three stages (dean, Asst. VPAA, LIC Director) have been cleared, on which version of a syllabus.
// A stage counts only when it was cleared on the syllabus's NEWEST version, so a resubmission (a new version) starts the three checks
// again. The VPAA can approve once all three count. Rows live in syllabus_review_stages (db/review-stages-ddl.js); until
// `npm run migrate-review-stages` has been run isInstalled() says so and nothing here is stored or read.
const { STAGES } = require('./roles');

let installed = false;
async function isInstalled(db) {
  if (installed) return true;
  try { await db.query('SELECT 1 FROM syllabus_review_stages LIMIT 1'); installed = true; } catch { installed = false; }
  return installed;
}
const resetInstalledCache = () => { installed = false; };

const nameOf = (r) => [r.first_name, r.last_name].filter(Boolean).join(' ');

// rows: the stage rows of ONE syllabus ({ version_id, stage, reviewer_id, first_name, last_name, note, cleared_at });
// latestVersionId: its newest version. -> { dean: { cleared, by, byId, at, note }, asst_vpaa: {...}, lic_director: {...}, allCleared, cleared }
function summarize(rows, latestVersionId) {
  const out = {};
  for (const stage of STAGES) {
    const row = latestVersionId === null || latestVersionId === undefined ? null : (rows || []).find((r) => r.stage === stage && r.version_id === latestVersionId);
    out[stage] = row
      ? { cleared: true, by: nameOf(row), byId: row.reviewer_id, at: row.cleared_at || null, note: row.note || '' }
      : { cleared: false, by: '', byId: null, at: null, note: '' };
  }
  const count = STAGES.filter((s) => out[s].cleared).length;
  return { ...out, allCleared: count === STAGES.length, cleared: count };
}

// Several syllabi at once -> Map(syllabusId -> summary). Two queries however many ids.
async function stagesOf(db, ids) {
  const out = new Map();
  if (!ids.length || !(await isInstalled(db))) return out;
  const [versions] = await db.query('SELECT syllabus_id, MAX(version_id) AS version_id FROM syllabus_versions WHERE syllabus_id IN (?) GROUP BY syllabus_id', [ids]);
  const [rows] = await db.query(
    'SELECT s.syllabus_id, s.version_id, s.stage, s.reviewer_id, s.note, s.cleared_at, u.first_name, u.last_name FROM syllabus_review_stages s JOIN users u ON u.user_id = s.reviewer_id WHERE s.syllabus_id IN (?)',
    [ids]
  );
  const latest = new Map(versions.map((v) => [v.syllabus_id, v.version_id]));
  for (const id of ids) out.set(id, summarize(rows.filter((r) => r.syllabus_id === id), latest.has(id) ? latest.get(id) : null));
  return out;
}

// Clears one stage on one version. Clearing again changes nothing (the first reviewer stays on record).
async function clear(conn, { syllabusId, versionId, stage, reviewerId, note = '' }) {
  if (!STAGES.includes(stage)) throw new Error('Unknown stage');
  await conn.query(
    'INSERT INTO syllabus_review_stages (syllabus_id, version_id, stage, reviewer_id, note) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE stage_id = stage_id',
    [syllabusId, versionId, stage, reviewerId, String(note || '').slice(0, 1000) || null]
  );
}

// Who approved a syllabus and when (the last 'approve' in its log), for the printed form. null before approval.
async function approvalOf(db, syllabusId) {
  const [rows] = await db.query(
    "SELECT l.action_date, u.first_name, u.last_name FROM submission_logs l JOIN users u ON u.user_id = l.user_id WHERE l.syllabus_id = ? AND l.action = 'approve' ORDER BY l.log_id DESC LIMIT 1",
    [syllabusId]
  );
  return rows[0] ? { by: nameOf(rows[0]), at: rows[0].action_date || null } : null;
}

// ---- when a syllabus reaches the VPAA ----
// The VPAA's work starts when the chain is done: a syllabus reaches the VPAA once the dean, the Asst. VPAA and the LIC Director have cleared its NEWEST
// version, or once it is approved. Before that it is not in the VPAA's lists (Review & Approval, the dashboard), the AI Checker's queue or its history, and
// the VPAA can neither check nor decide it. A resubmission is a new version, so it leaves the VPAA again until the three clear it. (The VPAA is notified
// when the third stage clears: routes/reviewChain.js.) The other reviewers are not affected. Without the stage table nothing is cleared, so the VPAA
// sees approved syllabi only, as nothing else could be approved either.
const NOT_READY_FOR_APPROVER = 'This syllabus reaches the VPAA once the dean, the Asst. VPAA and the LIC Director have cleared it.';
const readyForApprover = (status, summary) => status === 'approved' || !!(summary && summary.allCleared);
// rows: [{ syllabus_id, status }] -> the Set of syllabus ids the VPAA may see. Reads the chain in two queries however many rows.
async function approverVisible(db, rows) {
  const ids = (rows || []).map((r) => r.syllabus_id);
  let stages = new Map();
  if (ids.length) { try { stages = await stagesOf(db, ids); } catch { stages = new Map(); } }
  return new Set((rows || []).filter((r) => readyForApprover(r.status, stages.get(r.syllabus_id))).map((r) => r.syllabus_id));
}
// One syllabus, inside a route: refuses (409, code STAGES_PENDING) when it has not reached the VPAA yet.
async function assertReadyForApprover(db, syl) {
  if (!(await approverVisible(db, [syl])).has(syl.syllabus_id)) {
    const { httpError } = require('./http');
    throw httpError(409, NOT_READY_FOR_APPROVER, { code: 'STAGES_PENDING' });
  }
}

// ---- an administrator's own syllabus before it is sent for review ----
// The dean (an administrator) checks their own syllabus in the AI Checker first: "Continue to check" in the builder, or "Check my syllabus" in the AI
// Checker, saves a version and makes it Under Review. It reaches the other reviewers (the Asst. VPAA, the LIC Director, the VPAA and any other
// administrator) only when the dean sends it for review, which clears the dean stage on that version with the dean as its author
// (routes/syllabusContent.js publish). Until then it is not in their lists, AI Checker queue or history, and they can neither check it, clear a stage on
// it, choose to review it without AI, nor decide it. A faculty member's syllabus is not affected.
const AWAITING_AUTHOR = ['submitted', 'under_review'];
const NOT_SENT = 'This syllabus has not been sent for review yet: its author, the dean, is still checking it.';
const awaitingAuthor = (ownerRole, status, summary) => ownerRole === 'admin' && AWAITING_AUTHOR.includes(status) && !(summary && summary.dean && summary.dean.cleared);
// rows: [{ syllabus_id, user_id, status }], viewerId -> the Set of syllabus ids hidden from that viewer (never their own). `stages` may be passed when
// the caller already read them. The authors' roles are read in one query; if they cannot be read nothing is hidden or refused (a database that cannot
// read the users table cannot serve these routes anyway). If the stages cannot be read, an administrator's Under Review syllabus stays hidden.
async function hiddenFromReviewers(db, rows, viewerId, stages) {
  const candidates = (rows || []).filter((r) => r.user_id !== viewerId && AWAITING_AUTHOR.includes(r.status));
  if (!candidates.length) return new Set();
  let roles;
  try {
    const [users] = await db.query('SELECT user_id, role FROM users WHERE user_id IN (?)', [[...new Set(candidates.map((r) => r.user_id))]]);
    roles = new Map(users.map((u) => [u.user_id, u.role]));
  } catch { return new Set(); }
  const byAdmins = candidates.filter((r) => roles.get(r.user_id) === 'admin');
  if (!byAdmins.length) return new Set();
  let summaries = stages && byAdmins.every((r) => stages.has(r.syllabus_id)) ? stages : null;
  if (!summaries) { try { summaries = await stagesOf(db, byAdmins.map((r) => r.syllabus_id)); } catch { summaries = new Map(); } }
  return new Set(byAdmins.filter((r) => awaitingAuthor('admin', r.status, summaries.get(r.syllabus_id))).map((r) => r.syllabus_id));
}
// One syllabus, inside a route: refuses (409, code not_sent_for_review) a reviewer who is not its author while the dean has not sent it yet.
async function assertSentForReview(db, syl, viewer) {
  if (!syl || !viewer || syl.user_id === viewer.id) return;
  if ((await hiddenFromReviewers(db, [syl], viewer.id)).has(syl.syllabus_id)) {
    const { httpError } = require('./http');
    throw httpError(409, NOT_SENT, { code: 'not_sent_for_review' });
  }
}

module.exports = { isInstalled, resetInstalledCache, summarize, stagesOf, clear, approvalOf, NOT_READY_FOR_APPROVER, readyForApprover, approverVisible, assertReadyForApprover,
  NOT_SENT, awaitingAuthor, hiddenFromReviewers, assertSentForReview };
