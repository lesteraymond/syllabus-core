// Where clicking a notification should take you. A message opens that syllabus's chat; for a faculty member, a reviewer comment or a
// decision on their syllabus opens that syllabus's comments (the decision's reason is in the thread); anything else opens the page where
// the syllabus lives: for an administrator a new submission or a resubmission opens the AI Checker (it is checked there before it is
// reviewed); a decision-related notification opens Review & Approval. Plain logic, so it is tested on its own; App.jsx acts on the answer.
//   -> { kind: 'chat', id } | { kind: 'comments', id } | { kind: 'page', page }
export function notificationTarget(n, role) {
  if (n.type === 'message' && n.syllabusId) return { kind: 'chat', id: n.syllabusId };
  // A deadline is about a subject, not a syllabus: faculty go to their syllabi (where the subject's syllabus is started or edited).
  if (n.type === 'deadline') return { kind: 'page', page: role === 'admin' ? 'courses' : 'my-syllabi' };
  if (role === 'faculty' && n.syllabusId && (n.type === 'comment' || n.type === 'status')) return { kind: 'comments', id: n.syllabusId };
  if (role === 'admin' && (n.type === 'submission' || n.type === 'edit')) return { kind: 'page', page: 'ai' };
  return { kind: 'page', page: role === 'admin' ? 'review' : 'my-syllabi' };
}

// The notifications that a faculty member has dealt with by reading a syllabus's comments: the unread ones about that syllabus that are
// comments or decisions. Opening the comments marks these read, so the bell does not keep nagging about what they have just read.
export const commentNotificationIds = (items, syllabusId) => items.filter((n) => n.syllabusId === syllabusId && !n.isRead && (n.type === 'comment' || n.type === 'status')).map((n) => n.id);

// What the Comments button on a card says: the number that are new, or the total when none are new, or nothing when there are none.
// `unread` is null when read tracking is not set up on the server: then only the total can be shown.
export function commentBadge(counts) {
  if (!counts || !counts.total) return { text: '', fresh: false };
  if (counts.unread) return { text: String(counts.unread), fresh: true };
  return { text: String(counts.total), fresh: false };
}
