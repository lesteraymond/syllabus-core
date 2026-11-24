'use strict';
// The programs a student may register for with their Certificate of Registration (COR): BSIT, BSCPE and BSIE of the College (owner decision 2026-11-24;
// until then BSIT only). Both COR readers (lib/corParser.js for OCR text, lib/corClaude.js for Claude's reading) decide the program here, so they agree.
// The registration Terms and Conditions (src/lib/corTerms.js) name the same three programs.
//   full     the Course/Major text as printed ("BACHELOR OF SCIENCE IN COMPUTER ENGINEERING"); a BSIT specialization (Cyber Security) is still BSIT
//   section  a section code on the subject rows ("BSIT3A", "BS CPE 2B", "BSIE1A")
const PROGRAMS = Object.freeze([
  { code: 'BSIT', name: 'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY', full: /INFORMATION\s+TECHNOLOGY/i, section: /\bBS\s*IT\s*\d[A-Z]?\b/i },
  { code: 'BSCPE', name: 'BACHELOR OF SCIENCE IN COMPUTER ENGINEERING', full: /COMPUTER\s+ENGINEERING/i, section: /\bBS\s*C\s*P\s*E\s*\d[A-Z]?\b/i },
  { code: 'BSIE', name: 'BACHELOR OF SCIENCE IN INDUSTRIAL ENGINEERING', full: /INDUSTRIAL\s+ENGINEERING/i, section: /\bBS\s*IE\s*\d[A-Z]?\b/i },
]);
// Any accepted program's section code, to find sections and subject rows in OCR text.
const ANY_SECTION = /\bBS\s*(?:IT|C\s*P\s*E|IE)\s*\d[A-Z]?\b/gi;
const sectionCode = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');

// The program a COR shows, from its Course/Major text and its section codes.
// -> { code, name, ok } where ok is 'yes' (one accepted program, clearly), 'maybe' (a program was read but is not clearly one of them, or the
// sections point to two different ones), or 'no' (nothing program-like was read). code and name are null unless ok is 'yes'.
function programOf(programText, sections = []) {
  const text = String(programText || '');
  const byText = PROGRAMS.find((p) => p.full.test(text));
  if (byText) return { code: byText.code, name: byText.name, ok: 'yes' };
  const bySection = [...new Set(sections.map((s) => PROGRAMS.find((p) => p.section.test(String(s || '')))).filter(Boolean))];
  if (bySection.length === 1) return { code: bySection[0].code, name: bySection[0].name, ok: 'yes' };
  return { code: null, name: null, ok: text.trim() || bySection.length ? 'maybe' : 'no' };
}

module.exports = { PROGRAMS, ANY_SECTION, sectionCode, programOf };
