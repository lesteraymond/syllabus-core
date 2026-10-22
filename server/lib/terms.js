'use strict';
// School terms for the reports, worked out from dates in Philippine time (UTC+8, no daylight saving). A school year starts in June:
// Summer is June and July, the 1st Semester August to December, the 2nd Semester January to May. "2026-2027" is June 2026 to May 2027.
const PH_OFFSET_MS = 8 * 3600 * 1000;
const SEMESTERS = ['Summer', '1st Semester', '2nd Semester'];

// The term a moment falls in: { schoolYear: '2026-2027', semester: '1st Semester' }.
function termOf(date) {
  const d = new Date(new Date(date).getTime() + PH_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const start = month >= 6 ? year : year - 1;
  return { schoolYear: start + '-' + (start + 1), semester: month >= 8 ? '1st Semester' : month >= 6 ? 'Summer' : '2nd Semester' };
}

// The moments a term covers, as [from, to) in UTC; null when the school year or semester is not valid.
function rangeOf(schoolYear, semester) {
  const m = /^(\d{4})-(\d{4})$/.exec(String(schoolYear || ''));
  if (!m || Number(m[2]) !== Number(m[1]) + 1 || !SEMESTERS.includes(semester)) return null;
  const y = Number(m[1]);
  const [a, b] = semester === 'Summer' ? [[y, 6], [y, 8]] : semester === '1st Semester' ? [[y, 8], [y + 1, 1]] : [[y + 1, 1], [y + 1, 6]];
  const at = ([yy, mm]) => new Date(Date.UTC(yy, mm - 1, 1) - PH_OFFSET_MS);
  return { from: at(a), to: at(b) };
}

module.exports = { termOf, rangeOf, SEMESTERS };
