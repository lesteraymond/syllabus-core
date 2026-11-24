// The programs a student may register for with a COR (lib/corPrograms.js): BSIT, BSCPE and BSIE (2026-11-24), as both COR readers decide them.
const test = require('node:test');
const assert = require('node:assert');
const { programOf, PROGRAMS } = require('./corPrograms');
const { parseCor } = require('./corParser');
const { normalize } = require('./corClaude');

test('the accepted programs are BSIT, BSCPE and BSIE', () => {
  assert.deepStrictEqual(PROGRAMS.map((p) => p.code), ['BSIT', 'BSCPE', 'BSIE']);
});

test('the printed course decides the program; a BSIT specialization is BSIT', () => {
  assert.deepStrictEqual(programOf('BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY'), { code: 'BSIT', name: 'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY', ok: 'yes' });
  assert.strictEqual(programOf('BS Information Technology with Specialization in Cyber Security').code, 'BSIT');
  assert.deepStrictEqual(programOf('Bachelor of Science in Computer Engineering'), { code: 'BSCPE', name: 'BACHELOR OF SCIENCE IN COMPUTER ENGINEERING', ok: 'yes' });
  assert.deepStrictEqual(programOf('BS Industrial Engineering'), { code: 'BSIE', name: 'BACHELOR OF SCIENCE IN INDUSTRIAL ENGINEERING', ok: 'yes' });
});

test('without a readable course, one accepted program\'s sections decide it; two different ones, or another program, are not clear', () => {
  assert.strictEqual(programOf('', ['BSCPE2A', 'BS CPE 2A']).code, 'BSCPE');
  assert.strictEqual(programOf(null, ['BSIE1B']).code, 'BSIE');
  assert.deepStrictEqual(programOf('', ['BSIT3A', 'BSIE1A']), { code: null, name: null, ok: 'maybe' });
  assert.deepStrictEqual(programOf('BACHELOR OF SCIENCE IN NURSING'), { code: null, name: null, ok: 'maybe' });
  assert.deepStrictEqual(programOf('', []), { code: null, name: null, ok: 'no' });
});

test('the OCR reader finds a BSCPE or BSIE course and its subject rows; the college name in the header is never evidence', () => {
  const cpe = parseCor('COLLEGE OF INFORMATION TECHNOLOGY AND ENGINEERING\nCourse: BACHELOR OF SCIENCE IN COMPUTER ENGINEERING\nCPE-201 Data Structures BSCPE2A');
  assert.deepStrictEqual([cpe.programCode, cpe.programOk, cpe.section, cpe.subjects.length], ['BSCPE', 'yes', 'BSCPE2A', 1]);
  const ie = parseCor('Course: Bachelor of Science in Industrial Engineering\nIE-101 Intro to IE BS IE 1B');
  assert.deepStrictEqual([ie.programCode, ie.programOk, ie.section], ['BSIE', 'yes', 'BSIE1B']);
  const header = parseCor('COLLEGE OF INFORMATION TECHNOLOGY AND ENGINEERING');
  assert.deepStrictEqual([header.programCode, header.programOk], [null, 'no']);
  const it = parseCor('Bachelor of Science in Information Technology');
  assert.deepStrictEqual([it.programCode, it.programOk, it.program], ['BSIT', 'yes', 'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY']);
  assert.strictEqual(parseCor('Science in Informat').programOk, 'maybe', 'a partial course is a program, not a clear one');
});

test('the Claude reader decides the program the same way', () => {
  const cpe = normalize({ program: 'BACHELOR OF SCIENCE IN COMPUTER ENGINEERING', subjects: [{ code: 'CPE 201', title: 'x', section: 'BSCPE2A' }] });
  assert.deepStrictEqual([cpe.programCode, cpe.programOk, cpe.program], ['BSCPE', 'yes', 'BACHELOR OF SCIENCE IN COMPUTER ENGINEERING']);
  const ie = normalize({ program: null, section: 'BSIE1A', subjects: [] });
  assert.deepStrictEqual([ie.programCode, ie.programOk], ['BSIE', 'yes']);
  const nursing = normalize({ program: 'BS NURSING', subjects: [] });
  assert.deepStrictEqual([nursing.programCode, nursing.programOk], [null, 'maybe']);
});
