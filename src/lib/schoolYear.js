// The one place the school year is configured. Everything in the new builder reads it from here
// (labels, the form header, reference-age checks). Academic years stored in the database can replace this later.
export const CURRENT_SCHOOL_YEAR = { label: '2026–2027', startYear: 2026 };

// Printed in the form header and shown in the course strip. Automatic: faculty do not edit it.
export const COLLEGE_NAME = 'College of Information Technology and Engineering';

// Letterhead printed at the top of the finished form (from the institutional template).
export const INSTITUTION_NAME = 'La Consolacion University Philippines';
export const INSTITUTION_ADDRESS = 'Valenzuela St., Capitol View Park Subdivision, Bulihan, City of Malolos, Bulacan';
