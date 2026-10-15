// The five summary cards on the administrator dashboard. Pure, so the counting is unit-tested without React.
// Syllabus counts come from the list the app already keeps fresh; programs and subjects come from the catalog.
// `programs` / `subjects` are the number of records, or null while they are loading or could not be read.
export const ADMIN_STAT_ORDER = ['Programs', 'Subjects', 'Under Review', 'Approved', 'For Revision'];

export function adminStatCards({ programs = null, subjects = null, syllabi = [] }) {
  const count = (...statuses) => syllabi.filter(s => statuses.includes(s.status)).length;
  const shown = value => (Number.isFinite(value) ? String(value) : '—');
  return [
    ['Programs', shown(programs), 'In the catalog', 'blue'],
    ['Subjects', shown(subjects), 'Across all programs', 'teal'],
    // A faculty submission waits on the administrator from the moment it is sent, so it counts as under review.
    ['Under Review', String(count('submitted', 'under_review')), 'Awaiting decision', 'gold'],
    ['Approved', String(count('approved')), 'Accepted syllabi', 'green'],
    ['For Revision', String(count('for_revision')), 'Needs changes', 'red'],
  ];
}
