'use strict';
// Course identity: has the course been matched to an approved curriculum record? This is the one fact that decides which checks may be called
// curriculum-verified. Nothing here builds a reference from faculty-entered text: an identity is verified only by an approved record.
//   verified               the code is in the selected approved curriculum
//   code_missing           no code was entered
//   code_not_found         the curriculum was found but does not list the code (it may exist in another program or curriculum year: reported, not assumed)
//   curriculum_unavailable no approved curriculum for the program
//   curriculum_ambiguous   several approved versions and none selected
const normCode = value => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
function identityOf(meta, masters, sets, course) {
  const base = { code: meta.code || '', program: meta.program || '', curriculumYear: meta.curriculumYear || '' };
  if (course) return { ...base, status: 'verified', elsewhere: [] };
  const status = sets.length === 0 ? 'curriculum_unavailable' : sets.length > 1 ? 'curriculum_ambiguous' : !normCode(meta.code) ? 'code_missing' : 'code_not_found';
  // Where else the code appears, among the approved curricula the checker was given: a hint for the author, never a match.
  const elsewhere = [];
  for (const record of [...(masters.curricula || []), ...(masters.otherCurricula || [])]) {
    if (sets.includes(record)) continue;
    const hit = (record.courses || []).find(row => normCode(row.code) === normCode(meta.code));
    if (hit && normCode(meta.code)) elsewhere.push({ program: record.program, curriculumYear: record.curriculumYear, code: hit.code, title: hit.title });
  }
  return { ...base, status, elsewhere: elsewhere.slice(0, 5) };
}
// Relationships whose answer is a claim about THIS course (the CLOs, weekly topics, description and sequence fit the course). Without a verified
// identity they make no claim: never a PASS and never a rewrite, even as provisional feedback. Every other check (fields, structure, the ILO chain
// inside a lesson) does not depend on the course identity. The deterministic checks always run.
const NEEDS_IDENTITY = new Set(['Course-CLO', 'CLO-set', 'Content-course', 'Description-plan', 'Plan-sequence', ...require('./requirementsAdvice').TYPES]);
module.exports = { identityOf, NEEDS_IDENTITY, normCode };
