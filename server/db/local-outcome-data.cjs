'use strict';
const egas = [
  { no: 1, name: 'Critical and Creative thinker', short: 'Critical and Creative Thinker' },
  { no: 2, name: 'Competent Catholic Augustinian-Marian Professional', short: 'Competent Professional' },
  { no: 3, name: 'Socially Responsive Steward', short: 'Socially Responsive Steward' },
  { no: 4, name: 'Transformative Lifelong learner', short: 'Transformative Lifelong Learner' },
];
// PO-to-EGA crosswalks are not stated independently in these PDFs. Leave egas
// empty rather than inventing mappings from overlapping CLO tags.
const engineering = [
  'Ability to apply knowledge of mathematics and science to solve complex engineering problems;',
  'Ability to design and conduct experiments, as well as to analyze and interpret data;',
  'Ability to design a system, component, or process to meet desired needs within realistic constraints such as economic, environmental, social, political, ethical, health and safety, manufacturability and sustainability, in accordance with standards.',
  'Ability to function on multidisciplinary teams',
  'Ability to identify; formulate, and solve complex engineering problems;',
  'Understanding of professional and ethical responsibility.',
  'Ability to communicate effectively',
  'Broad education necessary to understand the impact of engineering solutions in a global, economic, environmental, and societal context.',
  'Recognition of the need for, and an ability to engage in life-long learning;',
  'Knowledge of contemporary issues;',
  'Ability to use techniques, skills and modern engineering tools necessary for engineering practice; and',
  'Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in',
  'Ability to design, develop, implement and improve integrated system that include people materials, implementation, equipment and energy.',
].map((text, i) => ({ no: i + 1, short: `PO ${i + 1}`, text, egas: [], ...(i === 11 ? { sourceIncomplete: true } : {}) }));
const bsitPdf = [
  'Articulate and discuss the latest developments in the specific field of practice;',
  'Effectively communicate orally and in writing using both English and Filipino;',
  'Work effectively and independently in multi-disciplinary and multi-cultural teams;',
  'Act in recognition of professional, social ethical responsibility;',
  'Preserve and promote “Filipino historical and cultural heritage;',
  'Analyze complex problems, and identify and define the computing requirements needed to design and appropriate solution;',
  'Apply computing and other knowledge domains to address real-world problems;',
  'Design and develop computing solutions using a system-level perspective;',
  'Utilize modern computing tools.',
].map((text, i) => ({ no: i + 1, short: `PO ${i + 1}`, text, egas: [] }));
const sources = {
  BSIE: { file: 'IE402-SYSTEM-ENGINEERINGS.pdf', pages: [2, 3, 4], egas, pos: engineering.map(p => ({ ...p, ...(p.no === 11 ? { text: p.text.replace(/and$/, 'and;') } : {}) })), warnings: ['PO12 ends mid-sentence in the source; preserved without an invented completion.', 'The source does not provide a standalone PO-to-EGA crosswalk.'] },
  BSCPE: { file: 'CPE-304-Fundamentals-of-Mixed-Signals-and-Sensors.pdf', pages: [2, 3], egas, pos: engineering, warnings: ['PO12 ends mid-sentence in the source; preserved without an invented completion.', 'The source does not provide a standalone PO-to-EGA crosswalk.'] },
  BSIT: { file: 'IT-202-Programming-1.pdf', pages: [2, 3], egas, pos: bsitPdf, warnings: ['The nine PDF outcomes differ in count and numbering from the existing ten BSIT database outcomes; preserve the existing set rather than merge incompatible numbering.'] },
};
module.exports = { sources, egas };
