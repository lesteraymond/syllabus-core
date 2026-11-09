// A subject's term as the administrator sets it (academic year, semester, year level 1-4, pre-requisite) and how it is shown. Pure functions: no React, no network.
export const SEMESTER_OPTIONS = [{ value: '1st Semester', key: 'deadline.sem.first' }, { value: '2nd Semester', key: 'deadline.sem.second' }, { value: 'Summer', key: 'deadline.sem.summer' }];
// The translation key of a stored semester name ('' for an unknown one, so the caller can show the stored text as it is).
export const semesterKey = (semester) => (SEMESTER_OPTIONS.find((s) => s.value === semester) || {}).key || '';
export const YEAR_LEVELS = [1, 2, 3, 4];

export const emptyTerm = () => ({ academicYear: '', semester: '', yearLevel: '', prerequisite: '' });
export const termFrom = (term) => (term ? { academicYear: term.academicYear || '', semester: term.semester || '', yearLevel: term.yearLevel == null ? '' : String(term.yearLevel), prerequisite: term.prerequisite || '' } : emptyTerm());
// The pre-requisite is optional: many subjects have none (the syllabus then shows NO_PREREQUISITE).
export const termComplete = (value) => !!(value && value.academicYear && value.semester && YEAR_LEVELS.includes(Number(value.yearLevel)));
export const NO_PREREQUISITE = 'None';
export const termSet = (term) => !!(term && (term.academicYear || term.semester || term.yearLevel != null || term.prerequisite));
// What the API wants: the four fields, the year level as a number.
export const termBody = (value) => ({ academicYear: value.academicYear, semester: value.semester, yearLevel: Number(value.yearLevel), prerequisite: String(value.prerequisite || '').trim() });

// "2026–2027 · 1st Semester · Year 2", or '' when the subject has no term yet. `semesterLabel` translates the stored semester name.
export function termLine(term, t, semesterLabel = (s) => s) {
  if (!term || !term.academicYear || !term.semester || term.yearLevel == null) return '';
  return t('term.line', { year: term.academicYear, semester: semesterLabel(term.semester), level: term.yearLevel });
}

// The step 1 values faculty may not change for a subject (the same ones the server forces in routes/syllabusContent.js). Empty when the subject has none.
// The administrator entered the subject's term (semester, year level or pre-requisite). The academic year alone is not a set-up: every subject of a catalog
// year carries it automatically. Same rule as server/lib/subjectTerm.js setUp.
export const subjectSetUp = (term) => !!(term && (term.prerequisite || term.semester || term.yearLevel != null));
// What Step 1 shows as the pre-requisite of a set-up subject: its own, or "None" when it has none. null when the subject was not set up (the typed value stays).
export const prerequisiteOf = (term) => (subjectSetUp(term) ? term.prerequisite || NO_PREREQUISITE : null);
export const lockedFields = (term) => ({
  prereq: subjectSetUp(term), yearLevel: !!(term && term.yearLevel != null), // a set-up subject owns its pre-requisite, "None" included
  academicYear: !!(term && term.academicYear), semester: !!(term && term.semester),
});
export const anyLocked = (term) => Object.values(lockedFields(term)).some(Boolean);

// The Program & Subjects table filters. Every filter that is set must match (AND); '' means "all". A subject without a term yet (created before terms existed) matches
// only when no term filter (academic year, semester, year level) is set, since it has nothing to match. The year level filter value is a string ('3') from the dropdown.
// The curriculum year filter is separate from the term: CURRICULUM_NONE keeps the subjects that have no curriculum year yet.
export const noFilters = () => ({ program: '', curriculumYear: '', academicYear: '', semester: '', yearLevel: '' });
export const filtersActive = (f) => !!(f && (f.program || f.curriculumYear || f.academicYear || f.semester || f.yearLevel));
export const termFiltersActive = (f) => !!(f && (f.academicYear || f.semester || f.yearLevel));
export function filterSubjects(list, f = noFilters()) {
  return (list || []).filter((c) => {
    if (f.program && c.program !== f.program) return false;
    if (f.curriculumYear && (f.curriculumYear === CURRICULUM_NONE ? !!c.curriculumYear : c.curriculumYear !== f.curriculumYear)) return false;
    if (!termFiltersActive(f)) return true;
    const t = c.term || {};
    if (f.academicYear && t.academicYear !== f.academicYear) return false;
    if (f.semester && t.semester !== f.semester) return false;
    if (f.yearLevel && String(t.yearLevel) !== String(f.yearLevel)) return false;
    return true;
  });
}

// Which academic years are already used by subjects, so the dropdown can say so. { '2026–2027': 3 }. `exceptId` leaves one subject out (the one being edited does not
// make its own year "used"). Subjects without a term are ignored.
export function yearUsage(list, exceptId = null) {
  const usage = {};
  for (const c of list || []) {
    if (exceptId != null && c.id === exceptId) continue;
    const year = c.term && c.term.academicYear;
    if (year) usage[year] = (usage[year] || 0) + 1;
  }
  return usage;
}
// The text of one option in the academic year dropdown: "2027–2028 · not used yet", "2026–2027 · in use by 1 subject", "... in use by 3 subjects"; the current academic year is tagged: "2027–2028 · current · in use by 2 subjects".
export const yearOptionLabel = (year, count, t, isCurrent = false) => year + (isCurrent ? ' · ' + t('years.currentTag') : '') + ' · ' + (count > 0 ? t(count === 1 ? 'years.inUseOne' : 'years.inUse', { count }) : t('years.notUsed'));
// The value of the dropdown's last option, which adds a new academic year instead of choosing one.
export const ADD_YEAR = '__add_academic_year__';

// A subject's CURRICULUM YEAR (the curriculum it is taught under, e.g. 2022-2023), which is not its academic year. Same rule as the server (server/lib/curriculumYear.js):
// two consecutive years, stored with a plain hyphen. '2022–2023' and '2022 - 2023' are accepted and normalized; anything else is null.
export const CURRICULUM_NONE = '__no_curriculum_year__';
export function normalizeCurriculumYear(value) {
  const m = /^(\d{4})\s*[-–—]\s*(\d{4})$/.exec(String(value == null ? '' : value).trim());
  if (!m || Number(m[2]) !== Number(m[1]) + 1 || Number(m[1]) < 1950 || Number(m[1]) > 2200) return null;
  return `${m[1]}-${m[2]}`;
}
// The curriculum years to offer, newest first, without duplicates: the ones subjects already use and the approved curriculum references' (`extra`).
export function curriculumYearOptions(list, extra = []) {
  const years = new Set();
  for (const c of list || []) { const y = normalizeCurriculumYear(c && c.curriculumYear); if (y) years.add(y); }
  for (const value of extra || []) { const y = normalizeCurriculumYear(value); if (y) years.add(y); }
  return [...years].sort((a, b) => b.localeCompare(a));
}
// The curriculum year dropdown's choices, newest first: every curriculum from next year back RANGE years, the years already in use (`inUse`), the program's approved
// curriculum references (`approved`, each marked so the administrator sees which ones the AI Checker can compare with) and the subject's current value, so an older
// value is never lost from the list. [{ value: '2022-2023', approved: true }]
export const CURRICULUM_RANGE = 20;
export function curriculumYearChoices({ inUse = [], approved = [], value = '', thisYear = new Date().getFullYear() } = {}) {
  const years = new Set();
  for (let start = thisYear + 1; start >= thisYear - CURRICULUM_RANGE; start -= 1) years.add(`${start}-${start + 1}`);
  const approvedSet = new Set((approved || []).map(normalizeCurriculumYear).filter(Boolean));
  for (const y of [...(inUse || []), ...approvedSet, value]) { const n = normalizeCurriculumYear(y); if (n) years.add(n); }
  return [...years].sort((a, b) => b.localeCompare(a)).map((y) => ({ value: y, approved: approvedSet.has(y) }));
}
