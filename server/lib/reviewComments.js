// Rules for the reviewer's comments on a syllabus and for the reason that goes with a decision. Uses the `comments` table, which has
// a type for each kind: a plain comment, or the reason recorded with an approval, a revision request or a rejection.
const { httpError } = require('./http');

const MAX_LENGTH = 2000;
const MIN_REASON = 5; // a return for revision or a rejection must say why
const NEEDS_REASON = ['for_revision', 'rejected'];
const TYPE_OF_STATUS = { approved: 'approval', for_revision: 'revision', rejected: 'rejection' };

const clean = (raw) => (typeof raw === 'string' ? raw.trim() : '');

// A comment someone types into the comments tab: not empty, not too long. Returns the cleaned text.
function validateComment(raw) {
  const text = clean(raw);
  if (!text) throw httpError(400, 'Write a comment first.');
  if (text.length > MAX_LENGTH) throw httpError(400, `A comment can be at most ${MAX_LENGTH} characters.`);
  return text;
}

// A status change: returning a syllabus for revision or rejecting it needs a reason of at least a few characters. Approving does not.
// Returns the cleaned note ('' when there is none).
function validateReason(status, raw) {
  const text = clean(raw);
  if (NEEDS_REASON.includes(status) && text.length < MIN_REASON) {
    throw httpError(400, status === 'rejected' ? 'Say why the syllabus is rejected (at least 5 characters).' : 'Say what needs to change (at least 5 characters).');
  }
  if (text.length > MAX_LENGTH) throw httpError(400, `The note can be at most ${MAX_LENGTH} characters.`);
  return text;
}

const typeForStatus = (status) => TYPE_OF_STATUS[status] || 'comment';

module.exports = { validateComment, validateReason, typeForStatus, MAX_LENGTH, MIN_REASON, NEEDS_REASON };
