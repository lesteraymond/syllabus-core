// The Compliance tab (the administrator's): each faculty member measured against the subjects the administrator ASSIGNED to them, for the academic year on
// screen, so the numbers can be used as evidence. Plain logic, tested in facultyCompliance.test.js; src/views/Compliance.jsx reads the data and shows it.
//   faculty   the faculty accounts ({ id, firstName, lastName, avatarUrl, disabled })
//   holders   who holds each subject ({ courseId, userId }: GET /api/users/subject-holders; one faculty member per subject)
//   subjects  the catalog's subjects of the academic year ({ id, code, title, program })
//   syllabi   the syllabus list the administrator sees ({ userId, courseId, status, archived }; drafts are not in it: a draft is not submitted)
// Submitted counts Submitted, Under Review and Approved. A syllabus returned for revision or rejected must be submitted again, so it is not counted,
// and it is named among what is still missing with its status.
import { FACULTY_SUBMITTED } from './complianceStats.js';

// The furthest a syllabus for one subject has come, when the faculty member has more than one for it.
const RANK = { approved: 5, under_review: 4, submitted: 3, for_revision: 2, rejected: 1 };

export function facultyCompliance({ faculty = [], holders = [], subjects = [], syllabi = [] }) {
  const subjectById = new Map(subjects.map((s) => [Number(s.id), s]));
  return faculty.map((f) => {
    const assigned = holders.filter((h) => Number(h.userId) === Number(f.id) && subjectById.has(Number(h.courseId))).map((h) => subjectById.get(Number(h.courseId)));
    const mine = syllabi.filter((s) => s && Number(s.userId) === Number(f.id) && !s.archived && s.courseId != null);
    const statusOf = (subjectId) => mine.filter((s) => Number(s.courseId) === Number(subjectId)).map((s) => s.status).sort((a, b) => (RANK[b] || 0) - (RANK[a] || 0))[0] || null;
    const rows = assigned.map((s) => ({ id: s.id, code: s.code, title: s.title, program: s.program, status: statusOf(s.id) }));
    const submitted = rows.filter((r) => FACULTY_SUBMITTED.includes(r.status)).length;
    const approved = rows.filter((r) => r.status === 'approved').length;
    const missing = rows.filter((r) => !FACULTY_SUBMITTED.includes(r.status)).sort((a, b) => String(a.code).localeCompare(String(b.code)));
    const total = rows.length;
    return {
      key: f.id, userId: f.id, avatarUrl: f.avatarUrl || null, name: [f.firstName, f.lastName].filter(Boolean).join(' ').trim() || f.email || '',
      programs: [...new Set(rows.map((r) => r.program).filter(Boolean))].sort(),
      total, submitted, approved, pct: total ? Math.round((submitted / total) * 100) : 0,
      compliant: total > 0 && submitted === total,
      missing: missing.map((r) => ({ code: r.code, status: r.status })), // status null: nothing submitted; for_revision / rejected: to submit again
    };
  }).sort((a, b) => (a.total === 0) - (b.total === 0) || a.name.localeCompare(b.name));
}
