'use strict';
// One meaning for "this subject has no pre-requisite", however it is written. The curriculum check (CUR-FIELD meta.prereq, verdict CUR-07) compares
// pre-requisites exactly, EXCEPT that these forms are one value:
//   - empty or missing (a subject the administrator set up without a pre-requisite stores nothing);
//   - "None" / "N/A" (what a syllabus shows for such a subject, lib/subjectTerm.js; what an administrator may type);
//   - the import's sentence for a blank pre-requisite cell in the official curriculum (db/local-curriculum-data.cjs BLANK).
// The data is not reinterpreted (a blank cell stays recorded as printed, not as an official "None"): only the COMPARISON accepts that a syllabus stating no
// pre-requisite does not differ from a curriculum that specifies none. Anything else is compared exactly, so a genuine difference is still found:
// "None" against "IT 101", or "IT 101" against a blank cell, both differ.
// Nothing here invents a pre-requisite, and none of these forms is ever turned into one.
const { BLANK } = require('../../db/local-curriculum-data.cjs');

const NONE_WORDS = /^(none|n\/a)\.?$/i;
const noPrerequisite = (value) => {
  const text = String(value ?? '').trim();
  return text === '' || NONE_WORDS.test(text) || text === BLANK;
};
const samePrerequisite = (entered, official) => String(entered ?? '') === String(official ?? '') || (noPrerequisite(entered) && noPrerequisite(official));

// The blank-cell sentence is an internal placeholder, never text for a syllabus. When the syllabus names a pre-requisite against such a cell, the finding
// says plainly that none is listed and asks for verification (a blank cell does not prove the subject has none), and no replacement is offered.
const isBlankCell = (value) => String(value ?? '').trim() === BLANK;
const notListedMessage = (entered) => `No pre-requisite is listed for this subject in the approved curriculum (the pre-requisite cell is blank in the source document), but this syllabus names "${String(entered ?? '').trim()}". A blank cell does not prove that the subject has no pre-requisite: verify it against the official curriculum or with the program chair. If the subject has none, its pre-requisite can be left empty (the syllabus then shows "None"); if it has one, the approved curriculum reference should be corrected.`;

module.exports = { noPrerequisite, samePrerequisite, isBlankCell, notListedMessage, BLANK };
