'use strict';
// The one place that writes a person's activity (submission_logs): what they did to a syllabus, shown in their Recent Activity.
// The status changes and submits already write their own row inside their transaction; the events that have no transaction of their
// own (an AI check, an answer to a recommendation) come through here.
//
// Writing the log is best effort on purpose: it is a record of what happened, and losing a line must never make the action itself fail
// (a check that ran, a recommendation that was applied). A failed write is reported once on the server console and the action goes on.
const ACTIONS = ['upload', 'update', 'submit', 'approve', 'reject', 'revision', 'delete', 'check', 'recommend'];
const TRUNCATED = 1265; // MySQL "Data truncated": the action column predates 'check' / 'recommend'
let reported = false;

async function record(db, { syllabusId, userId, action, notes }) {
  if (!ACTIONS.includes(action) || !Number.isInteger(syllabusId) || !Number.isInteger(userId)) return false;
  try {
    await db.query('INSERT INTO submission_logs (syllabus_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [syllabusId, userId, action, String(notes || '').slice(0, 500) || null]);
    return true;
  } catch (error) {
    if (!reported) {
      reported = true;
      const hint = error && (error.errno === TRUNCATED || error.code === 'WARN_DATA_TRUNCATED') ? ' Run "npm run migrate-activity-log" in server/ to add the new actions.' : '';
      console.error(`Activity log: could not record "${action}" (${(error && (error.code || error.message)) || error}).${hint}`);
    }
    return false;
  }
}

// One line for the log about a finished AI check: the score, or why there is none, and how many things it suggested.
function checkNote(result) {
  if (!result) return 'AI check ran';
  const suggested = result.hybrid && Array.isArray(result.hybrid.suggestions) ? result.hybrid.suggestions.length : 0;
  const outcome = result.overall === null || result.overall === undefined ? 'incomplete, no score yet' : `score ${result.overall}%`;
  return `AI check: ${outcome}` + (suggested ? `; ${suggested} recommendation${suggested === 1 ? '' : 's'}` : '');
}

// One line for the log about an answer to a recommendation.
const VERB = { accept: 'Accepted', edit: 'Edited and applied', reject: 'Rejected', undo: 'Undid' };
const decisionNote = (action, path) => `${VERB[action] || 'Reviewed'} recommendation${path ? ': ' + path : ''}`;

module.exports = { ACTIONS, record, checkNote, decisionNote };
