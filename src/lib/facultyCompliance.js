// Who has submitted what: one entry per faculty member (by account) from the syllabi list. The Compliance page, the Reports page and the Faculty
// Compliance PDF all read this, so they cannot disagree. A syllabus counts toward the requirement once it is submitted (waiting for review) or
// approved; a draft, or one sent back for revision, does not. Plain functions, tested on their own.
export const REQUIRED = 2;
const COUNTED = ['submitted', 'under_review', 'approved'];
const RETURNED = ['for_revision', 'rejected'];

export function facultyCompliance(syllabi, required = REQUIRED) {
  const map = new Map();
  syllabi.forEach((s) => {
    const key = s.userId ?? s.faculty;
    if (!map.has(key)) map.set(key, { key, userId: s.userId, avatarUrl: s.ownerAvatarUrl, name: s.faculty, approved: 0, waiting: 0, returned: 0, drafts: 0, subjects: [] });
    const f = map.get(key);
    if (s.status === 'approved') f.approved++;
    else if (COUNTED.includes(s.status)) f.waiting++;
    else if (RETURNED.includes(s.status)) f.returned++;
    else f.drafts++;
    f.subjects.push({ code: s.courseCode || s.code || '', title: s.courseTitle || s.title || '', status: s.status });
  });
  return [...map.values()].map((f) => {
    const counted = f.approved + f.waiting;
    return { ...f, counted, required, compliant: counted >= required, missing: Math.max(0, required - counted), pct: Math.min(100, Math.round((counted / required) * 100)) };
  });
}
