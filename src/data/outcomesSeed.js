// Institution/EGA prototype text is retained. The vision and mission are the LCUP's current wording and are the same text the
// AI Checker's standard (server/lib/compliance/standard-v4.json, rules T-28 and T-29) compares a syllabus with. POs use the
// user-designated official PDF version. Existing databases are corrected only by the explicit versioned migration.
import officialPoReferences from './officialProgramOutcomes.json' with { type: 'json' };
export const INSTITUTION = {
  vision: 'Moved by the Spirit of the Risen Christ, La Consolacion University Philippines, envisions itself to become a catalyst for the wholistic transformational development of Catholic Augustinian Marian graduates rooted in Gospel values.',
  mission: {
    lead: 'LCUP commits to generate and make available to all persons and communities programs and services that will enable them to:',
    items: [
      'exhibit academic and technical competence in their respective areas of discipline in the local and international environment;',
      'demonstrate their knowledge, critical thinking and creativity by exploring the various avenues of learning and searching for truth;',
      'live Gospel values in the varied aspects of their personal and professional lives;',
      'manifest their willingness to serve specially the marginalized sector of our society;',
      'demonstrate productivity in various areas of learning as responsible stewards of our common home and society; and',
      'develop individuals who are resilient, inclusive, and responsive to the socio-economic realities of the Philippines and the complexities of the global environment.',
    ],
  },
  egas: [
    { no: 1, name: 'Critical and Creative thinker', short: 'Critical and Creative Thinker' },
    { no: 2, name: 'Competent Catholic Augustinian-Marian Professional', short: 'Competent Professional' },
    { no: 3, name: 'Socially Responsive Steward', short: 'Socially Responsive Steward' },
    { no: 4, name: 'Transformative Lifelong learner', short: 'Transformative Lifelong Learner' },
  ],
};

const officialPos = code => officialPoReferences.programs[code].outcomes.map(({no,short,text})=>({no,short,text,egas:[]}));
const PO_BSIT = officialPos('BSIT');

export const PROGRAMS = {
  BSIT: { name: 'BS Information Technology', pos: PO_BSIT },
  'BSIT-CYBERSECURITY': { name: 'BS Information Technology with Specialization in Cyber Security', pos: PO_BSIT, outcomeSource: 'BSIT' },
  BSIE: { name: 'BS Industrial Engineering', pos: officialPos('BSIE') },
  BSCPE: { name: 'BS Computer Engineering', pos: officialPos('BSCPE') },
  BSIS: { name: 'BS Information Systems', pos: [] },
  BSCS: { name: 'BS Computer Science', pos: [] },
  BLIS: { name: 'BS Library and Information Science', pos: [] },
  BSEMC: { name: 'BS Entertainment and Multimedia Computing', pos: [] },
};

// Course catalog seed: the course learning outcomes are constant data per course (admin-managed once loaded).
// IT 204 is copied from the corrected syllabus template (IT204-Programming2-EOMS). The template tags CLO 2, 3 and 4
// with PO 11 and PO 14. These historic tags were omitted from the old ten-PO seed.
// Retain this legacy example for history; seeders must not adopt its number mappings
// under the official nine-PO reference without faculty review.
export const COURSES = [
  {
    code: 'IT 204',
    legacyPoReference: 'pre-2026-10-29; faculty mapping review required',
    title: 'Computer Programming 2',
    program: 'BSIT',
    clos: [
      { title: 'Foundational Knowledge', level: 'Introductory', egas: [1, 4], pos: [1, 5], statement: 'Analyze and explain the fundamental concepts of object-oriented programming, including classes, objects, inheritance, polymorphism, encapsulation, and basic design patterns, using appropriate Java syntax and terminology.' },
      { title: 'Skill Development / Evaluate', level: 'Enabling', egas: [1, 4], pos: [6], statement: 'Apply object-oriented design principles to develop Java programs using classes, subclasses, inheritance, interfaces, collection classes, iteration protocols, and APIs, and evaluate the correctness and efficiency of solutions.' },
      { title: 'Application / Create', level: 'Demonstrating', egas: [1, 4], pos: [3, 7], statement: 'Design, implement, and test robust and maintainable Java programs that integrate OOP concepts, event handling, exception management, and fundamental design patterns to solve real-world engineering or computing problems.' },
      { title: 'Ethics & Responsibility / Evaluate & Create', level: 'Integration of Values', egas: [2, 3], pos: [6, 8], statement: 'Demonstrate ethical, socially responsible, and collaborative programming practices by reflecting on the impact of software solutions on users and society, integrating Christo-centric Catholic and Marian\u2013Augustinian values in teamwork, problem-solving, and code development.' },
    ],
  },
];
