'use strict';
// Syllabus content fixtures for the compliance tests (server and browser parity). Each call returns a fresh object.
// Shaped like the builder's stored content (src/lib/syllabusModel.js emptyDraft) plus the `catalog` snapshot a submit adds.

const { constants } = require('./standard-v4.json');

const YEAR = 2026;

// The live catalog the fixtures were "submitted" against: school-wide vision and mission, and the BSIT program's own EGAs and POs.
function catalog() {
  return {
    institution: { vision: constants.institution.vision, mission: JSON.parse(JSON.stringify(constants.institution.mission)) },
    program: {
      code: 'BSIT', name: 'BS Information Technology',
      egas: constants.institution.egas.map(({ no, name }) => ({ no, name, short: 'EGA ' + no })),
      pos: [1, 2, 3, 4, 5].map((no) => ({ no, short: 'PO ' + no, text: 'Program outcome ' + no, egas: [((no - 1) % 4) + 1] })),
    },
  };
}
const ctx = () => ({ year: YEAR, catalog: catalog() });

const words = (n) => Array.from({ length: n }, (_, i) => 'word' + i).join(' ');
const ilo = (id, textValue, tags) => ({ id, text: textValue, tags });

// A conforming IT 204 style syllabus: 18 weeks, Prelim / Midterm / Final rows, tagged ILOs, CLOs mapped to POs and to the EGAs
// those POs imply, current references, grading 60 + 40, and the catalog snapshot equal to the live catalog (which carries the LCUP vision, mission and EGAs).
function good() {
  const clos = [1, 2, 3, 4].map((n) => ({
    id: 'c' + n, title: 'Outcome ' + n, level: 'Introductory', statement: 'Statement ' + n + ' on computer programming',
    egas: [1, 2], pos: [1, 2], // PO 1 maps to EGA 1 and PO 2 to EGA 2, so EGAs 1 and 2 are what the POs imply
  }));
  const plan = [];
  for (let w = 1; w <= 18; w++) {
    if (w === 6 || w === 12 || w === 18) {
      plan.push({ id: 'x' + w, kind: 'exam', week: String(w), ilos: [ilo('xi' + w, '', [])], contents: ['PRELIM', 'MIDTERM', 'FINAL'][w / 6 - 1] + ' EXAMINATION', activities: '', tasks: '', values: '' });
    } else {
      const c = 'c' + (((w - 1) % 4) + 1);
      const topic = w === 1 ? 'course orientation' : 'topic number ' + w;
      plan.push({ id: 'r' + w, kind: 'lesson', week: String(w), ilos: [ilo('i' + w, 'Explain ' + topic + ' clearly', ['clo:' + c])], contents: topic, activities: 'Lecture on ' + topic, tasks: '- Quiz on ' + topic, values: 'Core Value: Courage' });
    }
  }
  return {
    schemaVersion: 2,
    meta: { courseId: 10, code: 'IT 204', title: 'Computer Programming 2', program: 'BSIT', lecture: '2', lab: '1', prereq: 'IT 202 - Programming 1' },
    description: [{ id: 'd1', t: words(60) }],
    clos,
    plan,
    reqs: [{ id: 'q1', t: 'Class attendance' }, { id: 'q2', t: 'Quizzes' }, { id: 'q3', t: 'Examinations' }, { id: 'q4', t: 'Programming project' }, { id: 'q5', t: 'Students who need accommodations, for example because of a disability, tell the instructor early so that accessible formats can be arranged' }],
    refs: {
      books: { na: false, items: [{ id: 'b1', t: 'Balti, H., & Galloway, A. (2021). Job ready Java. John Wiley & Sons.' }, { id: 'b2', t: 'Boyarsky, J. (2020). OCP Java. Sybex.' }] },
      program: { na: false, items: [{ id: 'p1', t: 'Oracle (2023). The Java tutorials.' }] },
      online: { na: false, items: [{ id: 'o1', t: 'W3Schools (2024). Java tutorial.' }] },
      electronics: { na: true, items: [] },
    },
    grading: { rows: [{ id: 'g1', label: 'Class Standing', pct: 60 }, { id: 'g2', label: 'Examination', pct: 40 }], override: { on: false, term: '', final: '' } },
    signoff: {},
    catalog: { ...catalog(), savedAt: '2026-01-05T00:00:00.000Z' },
  };
}

// Several things wrong at once: grading totals 90, untagged and unresolved tags, an unmapped CLO, old and undated references,
// a short plan with rows out of order, an unassessed CLO and no exam rows.
function bad() {
  const c = good();
  c.description = [{ id: 'd1', t: 'A short description.' }];
  c.clos = [
    { id: 'c1', title: 'Outcome 1', level: 'Introductory', statement: 'Statement 1', egas: [1], pos: [1] },
    { id: 'c2', title: 'Outcome 2', level: 'Enabling', statement: 'Statement 2', egas: [], pos: [] },
  ];
  c.plan = [
    { id: 'r3', kind: 'lesson', week: '3', ilos: [ilo('i3', 'Third lesson outcome here', ['clo:c1'])], contents: 'Three', activities: '', tasks: 'Quiz', values: '' },
    { id: 'r1', kind: 'lesson', week: '1', ilos: [ilo('i1', 'First', [])], contents: 'One', activities: 'Lecture', tasks: '', values: '' },
    { id: 'r2', kind: 'lesson', week: '2', ilos: [ilo('i2', 'Second lesson outcome here', ['clo:gone', 'po:99', 'junk'])], contents: 'Two', activities: 'Lecture', tasks: '', values: '' },
    { id: 'r20', kind: 'lesson', week: '2, 20', ilos: [ilo('i20', 'Late lesson outcome here', ['clo:c1'])], contents: 'Late', activities: 'Lecture', tasks: 'Quiz', values: '' },
  ];
  c.reqs = [{ id: 'q1', t: '1. Attendance' }];
  c.refs = {
    books: { na: false, items: [{ id: 'b1', t: 'Old Book (2005). Publisher.' }, { id: 'b2', t: 'A book with no year' }] },
    program: { na: false, items: [] },
    online: { na: true, items: [{ id: 'o1', t: 'Hidden (2024).' }] },
    electronics: { na: true, items: [] },
  };
  c.grading = { rows: [{ id: 'g1', label: 'Class Standing', pct: 50 }, { id: 'g2', label: 'Quizzes', pct: 40 }], override: { on: false, term: '', final: '' } };
  return c;
}

// A new draft with almost nothing in it (no stored catalog copy yet).
function empty() {
  return {
    schemaVersion: 2,
    meta: { courseId: null, code: '', title: '', program: '', lecture: '', lab: '', prereq: '' },
    description: [{ id: 'd1', t: '' }],
    clos: [],
    plan: [{ id: 'r1', kind: 'lesson', week: '', ilos: [{ id: 'i1', text: '', tags: [] }], contents: '', activities: '', tasks: '', values: '' }],
    reqs: [],
    refs: { books: { na: false, items: [] }, program: { na: false, items: [] }, online: { na: false, items: [] }, electronics: { na: false, items: [] } },
    grading: { rows: [], override: { on: false, term: '', final: '' } },
    signoff: {},
  };
}

module.exports = { good, bad, empty, catalog, ctx, YEAR };
