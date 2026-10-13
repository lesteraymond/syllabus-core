// Has an administrator finished setting up what a syllabus is built from? A faculty member cannot complete the Learning
// Outcomes step without the vision, mission, the program's EGAs and POs, and the subject's CLOs, so the server refuses to
// submit without them and the admin's subject list flags what is missing.
//
// Pure function. `inputs`: { vision, mission: { lead, items }, egaCount, poCount, cloCount, programCode, subjectCode }.
// Returns the gaps as short, admin-readable phrases (an empty list means ready).
const blank = (v) => !String(v == null ? '' : v).trim();

function catalogGaps({ vision, mission, egaCount, poCount, cloCount, programCode, subjectCode }) {
  const gaps = [];
  if (blank(vision)) gaps.push('the vision');
  const m = mission || {};
  if (blank(m.lead) || !(m.items || []).some((t) => !blank(t))) gaps.push('the mission');
  if (!egaCount) gaps.push(`the ${programCode || 'program'} graduate attributes (EGAs)`);
  if (!poCount) gaps.push(`the ${programCode || 'program'} program outcomes`);
  if (!cloCount) gaps.push(`the learning outcomes of ${subjectCode || 'the subject'}`);
  return gaps;
}

const NOT_READY = 'The administrator has not finished setting up this subject yet';
const gapsMessage = (gaps) => `${NOT_READY}: ${gaps.join(', ')} ${gaps.length === 1 ? 'is' : 'are'} missing. Please contact them, then try again.`;

module.exports = { catalogGaps, gapsMessage, NOT_READY };
