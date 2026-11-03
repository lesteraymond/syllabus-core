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

module.exports = { isInstalled, resetInstalledCache, summarize, stagesOf, clear, approvalOf };
