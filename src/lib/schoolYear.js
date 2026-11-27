// The one place the school year is configured. Everything in the new builder reads it from here
// (labels, the form header, reference-age checks). Academic years stored in the database can replace this later.
export const CURRENT_SCHOOL_YEAR = { label: '2026–2027', startYear: 2026 };

// Printed in the form header and shown in the course strip. Automatic: faculty do not edit it.
export const COLLEGE_NAME = 'College of Information Technology and Engineering';

// Letterhead printed at the top of the finished form, word for word as on the approved institutional syllabi
// (docs/academic-references/IT-101-Introduction-to-Computing-.pdf): the name, the former name, and the address, in a script italic.
export const INSTITUTION_NAME = 'La Consolacion University Philippines';
export const INSTITUTION_FORMER_NAME = '(formerly University of Regina Carmeli)';
export const INSTITUTION_ADDRESS = 'Catmon, City of Malolos';
// The ISO document control number of the institutional syllabus form. Printed bottom-left at the end of the downloaded Word file only
// (lib/syllabusDocx.js), not on the form shown in the app. It identifies the form itself, not a syllabus: it is the same for every
// syllabus, course and college, and it never comes from syllabus data. Change it here only when the VPAA issues a new revision of
// the form (the number in brackets is the revision, e.g. 011).
export const FORM_CODE = 'PRE-VPAA-FO-001(011)';
