// The school year the compliance checks measure reference age from (the year it starts). The builder reads the same value from
// src/lib/schoolYear.js; lib/compliance/misc.test.js fails if the two ever differ. SCHOOL_YEAR_START in .env overrides it.
const FALLBACK_START_YEAR = 2026;

function schoolYearStart() {
  const n = Number(process.env.SCHOOL_YEAR_START);
  return Number.isInteger(n) && n > 1900 && n < 3000 ? n : FALLBACK_START_YEAR;
}

module.exports = { schoolYearStart, FALLBACK_START_YEAR };
