// The review chain's memory: which of the three stages (dean, Asst. VPAA, LIC Director) have been cleared, on which version of a syllabus.
// A stage counts only when it was cleared on the syllabus's NEWEST version. The stages are cleared in order (dean, Asst. VPAA, LIC Director: turnOf
// below), and a resubmission after a return keeps the stages cleared before the reviewer who returned it (carryForward below), so it goes back to that
// reviewer; any other new version starts the three checks again. The VPAA can approve once all three count. Rows live in syllabus_review_stages (db/review-stages-ddl.js); until
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
  return { ...out, allCleared: count === STAGES.length, cleared: count, turn: turnOf(out) };
}

// ---- the order of the chain ----
// The three stages are cleared one after another: the dean first, then the Asst. VPAA, then the LIC Director, then the VPAA decides. `turn` is who has
// the syllabus now: the first stage not cleared on the newest version, or 'vpaa' once all three are. Only that reviewer clears their stage or returns it
// for revision (routes/reviewChain.js, routes/syllabi.js); the others can open and read it, and wait.
const TURN_ORDER = [...STAGES, 'vpaa'];
const turnOf = (summary) => STAGES.find((s) => !(summary && summary[s] && summary[s].cleared)) || 'vpaa';
const TURN_NAME = { dean: 'the dean', asst_vpaa: 'the Asst. VPAA', lic_director: 'the LIC Director', vpaa: 'the VPAA' };
const NOT_YOUR_TURN = (turn) => `This syllabus is with ${TURN_NAME[turn] || 'another reviewer'} now. The dean reviews first, then the Asst. VPAA, then the LIC Director.`;
// One stage reviewer acting on one syllabus (clearing their stage, or returning it): refuses (409, code stage_out_of_order) when it is not their turn.
function assertTurn(summary, stage) {
  const turn = turnOf(summary);
  if (turn !== stage) {
    const { httpError } = require('./http');
    throw httpError(409, NOT_YOUR_TURN(turn), { code: 'stage_out_of_order', turn });
  }
}

// ---- a resubmission goes back to whoever returned it ----
// When a reviewer returns a syllabus for revision (or the VPAA rejects it), the stages cleared before that reviewer stay cleared: the faculty member's
// new version goes straight to the reviewer who returned it, not to the start of the chain. The LIC Director returns it -> the dean and the Asst. VPAA
// stay cleared; the Asst. VPAA returns it -> the dean stays cleared; the dean returns it -> nothing is kept; the VPAA returns or rejects it -> all three stay
// and it goes back to the VPAA. The kept stages are copied onto the new version with their reviewer, note and date (a stage still counts only on the
// newest version, so nothing else changes). A new version saved while the syllabus is under review (not returned) still starts the chain again.
// Who returned it is the last 'revision' or 'reject' in its log after its last 'submit'; if the log cannot be read nothing is kept (the chain starts again).
async function returnedBy(conn, syllabusId) {
  try {
    const [rows] = await conn.query(
      "SELECT l.log_id, l.action, u.role FROM submission_logs l JOIN users u ON u.user_id = l.user_id WHERE l.syllabus_id = ? AND l.action IN ('revision', 'reject', 'submit') ORDER BY l.log_id DESC LIMIT 1",
      [syllabusId]
    );
    const last = rows && rows[0];
    if (!last || last.action === 'submit') return null;
    if (last.role === 'vpaa') return 'vpaa';
    return require('./roles').STAGE_OF[last.role] || null;
  } catch { return null; }
}
// The stages to keep for a resubmission returned by `returner`: those before the returner, cleared in order on the returned version.
function keptStages(summary, returner) {
  const until = TURN_ORDER.indexOf(returner);
  const kept = [];
  for (const stage of STAGES.slice(0, Math.max(until, 0))) { if (!(summary && summary[stage] && summary[stage].cleared)) break; kept.push(stage); }
  return kept;
}
// Copies the kept stages from the returned version (fromVersionId) onto the resubmitted one (toVersionId). -> { returner, kept: [stage...] }.
async function carryForward(conn, { syllabusId, fromVersionId, toVersionId }) {
  const none = { returner: null, kept: [] };
  if (!fromVersionId || !toVersionId || fromVersionId === toVersionId || !(await isInstalled(conn))) return none;
  const returner = await returnedBy(conn, syllabusId);
  if (!returner) return none;
  const [rows] = await conn.query('SELECT stage, reviewer_id, note, cleared_at FROM syllabus_review_stages WHERE syllabus_id = ? AND version_id = ?', [syllabusId, fromVersionId]);
  const summary = summarize((rows || []).map((r) => ({ ...r, version_id: fromVersionId })), fromVersionId);
  const kept = keptStages(summary, returner);
  for (const stage of kept) {
    const row = rows.find((r) => r.stage === stage);
    await conn.query(
      'INSERT INTO syllabus_review_stages (syllabus_id, version_id, stage, reviewer_id, note, cleared_at) VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP)) ON DUPLICATE KEY UPDATE stage_id = stage_id',
      [syllabusId, toVersionId, stage, row.reviewer_id, row.note || null, row.cleared_at || null]
    );
  }
  return { returner, kept };
}

// Whose turn it is on a version whose cleared stages are `cleared` (a list of stages): the first stage not in it, or 'vpaa'. Used right after a
// submission, before anything else can clear a stage, to tell only that reviewer (routes/syllabusContent.js).
const turnAfter = (cleared) => STAGES.find((s) => !(cleared || []).includes(s)) || 'vpaa';
// Tells the reviewer whose turn it is, and only them: the dean (every administrator), the Asst. VPAA or the LIC Director. The VPAA's own notice is
// sent where the third stage clears (routes/reviewChain.js) or where a resubmission goes straight back to the VPAA (routes/syllabusContent.js).
// A notification never fails the caller (lib/notify.js).
async function notifyTurn(db, turn, notice) {
  const { notifyAdmins, notifyRoles } = require('./notify');
  if (turn === 'dean') return notifyAdmins(db, notice);
  if (turn === 'asst_vpaa' || turn === 'lic_director') return notifyRoles(db, [turn], notice);
}

// The newest version before `beforeVersionId` that was sent for review with the dean stage cleared (the dean's own syllabus: every version the dean
// sends has it, routes/syllabusContent.js publish). null when there is none or the table cannot be read.
async function lastSentVersion(conn, syllabusId, beforeVersionId) {
  try {
    const [rows] = await conn.query("SELECT MAX(version_id) AS version_id FROM syllabus_review_stages WHERE syllabus_id = ? AND stage = 'dean' AND version_id < ?", [syllabusId, beforeVersionId]);
    return rows && rows[0] && rows[0].version_id ? rows[0].version_id : null;
  } catch { return null; }
}

// The last decision on each syllabus (the VPAA's approve or reject, or anyone's return for revision), for the review progress: Map(syllabusId ->
// { action, by, role, at }). One query however many ids; an unreadable log gives an empty Map.
async function decisionsOf(db, ids) {
  const out = new Map();
  if (!ids || !ids.length) return out;
  try {
    const [rows] = await db.query(
      "SELECT l.syllabus_id, l.action, l.action_date, u.role, u.first_name, u.last_name FROM submission_logs l JOIN users u ON u.user_id = l.user_id WHERE l.syllabus_id IN (?) AND l.action IN ('approve', 'reject', 'revision') ORDER BY l.log_id ASC",
      [ids]
    );
    for (const r of rows || []) out.set(r.syllabus_id, { action: r.action, by: nameOf(r), role: r.role || '', at: r.action_date || null });
  } catch { return new Map(); }
  return out;
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

// When the syllabus was last submitted for review (the last 'submit' in its log: the first submit, a resubmission after a return, or the dean
// sending their own syllabus for review), for the "Faculty - Date" line of the printed form. null before the first submit. Best effort: if the log
// cannot be read the form prints "Date" there instead of failing.
async function submittedOf(db, syllabusId) {
  try {
    const [rows] = await db.query("SELECT l.action_date FROM submission_logs l WHERE l.syllabus_id = ? AND l.action = 'submit' ORDER BY l.log_id DESC LIMIT 1", [syllabusId]);
    return rows[0] && rows[0].action_date ? { at: rows[0].action_date } : null;
  } catch { return null; }
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

// ---- opening one syllabus directly ----
// The lists (routes/syllabi.js GET /) hide a syllabus from the VPAA until the three stages clear, and the dean's own syllabus from the other reviewers until
// it is sent. Every route that opens ONE syllabus for a reviewer (its form, comments, AI check, stages, status) gives the same answer, so a direct call
// cannot reach what the lists hide (E2E report 2026-11-23, BUG-001/002/003). The author is never refused, and an approved syllabus is the shared Repository.
async function assertReviewerMayOpen(db, syl, viewer) {
  if (!syl || !viewer || syl.user_id === viewer.id || syl.status === 'approved') return;
  if (require('./roles').isApprover(viewer)) await assertReadyForApprover(db, syl);
  await assertSentForReview(db, syl, viewer);
}

// When a new reviewer account is created (routes/users.js POST /), send them notifications for any pending syllabi whose current turn is already on their role.
// Best effort: never fails user creation, never leaks unsent dean syllabi (hiddenFromReviewers), and reuses the exact reviewChain.js notice strings.
async function notifyNewReviewer(db, userId, role) {
  try {
    const targetTurn = role === 'vpaa' ? 'vpaa' : role === 'admin' ? 'dean' : (role === 'asst_vpaa' || role === 'lic_director') ? role : null;
    if (!userId || !targetTurn || !(await isInstalled(db))) return 0;
    const [rows] = await db.query(
      "SELECT syllabus_id, user_id, status, course_code, title FROM syllabi WHERE status IN ('submitted', 'under_review') AND archived_at IS NULL"
    );
    if (!rows || !rows.length) return 0;
    const stages = await stagesOf(db, rows.map((r) => r.syllabus_id));
    const hidden = await hiddenFromReviewers(db, rows, userId, stages);
    const { createNotification } = require('./notify');
    const prevBody = {
      vpaa: 'The dean, the Asst. VPAA and the LIC Director have cleared it.',
      lic_director: 'The Asst. VPAA cleared it. It is your turn to review it.',
      asst_vpaa: 'The dean cleared it. It is your turn to review it.',
      dean: 'Submitted and waiting for your review.',
    };
    let sent = 0;
    for (const s of rows) {
      if (s.user_id === userId || hidden.has(s.syllabus_id)) continue;
      const summary = stages.get(s.syllabus_id);
      if (!summary || summary.turn !== targetTurn) continue;
      const subject = s.course_code || s.title || 'a syllabus';
      await createNotification(db, {
        userId,
        type: 'chain',
        syllabusId: s.syllabus_id,
        title: (targetTurn === 'vpaa' ? 'Ready for approval: ' : 'Your review: ') + subject,
        body: prevBody[targetTurn],
      });
      sent++;
    }
    return sent;
  } catch { return 0; }
}

module.exports = { isInstalled, resetInstalledCache, summarize, stagesOf, clear, approvalOf, submittedOf,
  TURN_ORDER, turnOf, NOT_YOUR_TURN, assertTurn, returnedBy, keptStages, carryForward, lastSentVersion, decisionsOf, turnAfter, notifyTurn, notifyNewReviewer, NOT_READY_FOR_APPROVER, readyForApprover, approverVisible, assertReadyForApprover,
  NOT_SENT, awaitingAuthor, hiddenFromReviewers, assertSentForReview, assertReviewerMayOpen };
