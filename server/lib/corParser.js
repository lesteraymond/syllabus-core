// Reads the text OCR returned for a Certificate of Registration ("Official Registration Form") into the few fields
// needed to verify a BSIT, BSCPE or BSIE student (lib/corPrograms.js). Pure: no OCR, no database. OCR is imperfect, so every field may come back null
// and the caller decides (verified / pending admin review / rejected).
//
// Fields: studentId, studentName, program, programCode ('BSIT' | 'BSCPE' | 'BSIE' | null), programOk ('yes' | 'maybe' | 'no'), yearLevel, section,
// schoolYear, term, printedAt, subjects[].
const { PROGRAMS, ANY_SECTION, sectionCode, programOf } = require('./corPrograms');
const ONE_SECTION = new RegExp(ANY_SECTION.source, 'i');

// Characters OCR commonly confuses inside numbers.
const DIGITS = { O: '0', o: '0', Q: '0', D: '0', I: '1', l: '1', '|': '1', S: '5', s: '5', B: '8', Z: '2' };
const fixDigits = (s) => s.replace(/[OoQDIl|SsBZ]/g, (c) => DIGITS[c]);

const clean = (s) => s.replace(/\s+/g, ' ').trim();

function findStudentId(text) {
  // 23-3389-455: 2 digits, 4 digits, 3 digits, separators may be read as other dashes or spaces.
  const m = text.match(/Student\s*I[DO0]\W{0,6}([0-9OoIlSB|]{2})\s*[-–—_.]\s*([0-9OoIlSB|]{4})\s*[-–—_.]\s*([0-9OoIlSB|]{3})/i)
    || text.match(/\b(\d{2})\s*[-–—]\s*(\d{4})\s*[-–—]\s*(\d{3})\b/);
  return m ? [m[1], m[2], m[3]].map(fixDigits).join('-') : null;
}

// "INSULAR, RAYMOND LESTER": the surname, a comma, then the given names, ending where the next label starts.
function findName(text) {
  const found = [];
  for (const line of text.split('\n')) {
    const m = line.match(/\b([A-Z][A-Z'-]{1,}),\s*([A-Z][A-Z .'-]{2,}?)(?=\s+(?:Year|Gender|Student|Course)\b|\s*$)/);
    if (m) found.push(clean(`${m[1]}, ${m[2]}`));
  }
  return found.sort((x, y) => y.length - x.length)[0] || null;
}

// The Course/Major text, read from every OCR pass. The college name in the page header ("COLLEGE OF INFORMATION
// TECHNOLOGY AND ENGINEERING") is on every CITE student's COR whatever their program, so it is never evidence.
// -> an accepted program's full name, or the partial text read after "Science in" ("SCIENCE IN INFORMATION ...": a program, but not clearly an accepted
// one, e.g. Information Systems), or null. Information ... Technology a few OCR words apart still reads as BSIT, as before.
function findProgram(text) {
  const flat = text.split('\n').filter((l) => !/COLLEGE\s+OF/i.test(l)).join(' ');
  const found = PROGRAMS.find((p) => p.full.test(flat));
  if (found) return found.name;
  const m = flat.match(/SCIENCE\s+IN\s+(INFORMAT\w*|COMPUT\w*|INDUSTR\w*)(?:\W+(?:\w+\W+){0,6}?(TECHNOLOGY))?/i);
  if (!m) return null;
  if (m[2] && /^INFORMAT/i.test(m[1])) return PROGRAMS[0].name;
  return 'SCIENCE IN ' + m[1].toUpperCase() + ' ...';
}

function findTerm(text) {
  const term = text.match(/\b(1st|2nd|3rd|first|second|summer|mid\s*year)\s*(?:semester|sem|term)?\b[^\n]{0,12}AY/i);
  const ay = text.match(/AY\s*(\d{4})\s*[-–—]\s*(\d{4})/i);
  return {
    term: term ? clean(term[1]).replace(/^first$/i, '1st').replace(/^second$/i, '2nd') + (/summer|mid/i.test(term[1]) ? '' : ' Semester') : null,
    schoolYear: ay ? `${ay[1]}-${ay[2]}` : null,
  };
}

function findYearLevel(text) {
  const m = text.match(/Year\s*Level\W{0,4}([1-6])\b/i);
  return m ? Number(m[1]) : null;
}

function findPrinted(text) {
  const m = text.match(/printed\W{0,3}\s*(\d{4})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{1,2})\s+(\d{1,2}):(\d{2})/i);
  if (!m) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${m[1]}-${p(m[2])}-${p(m[3])} ${p(m[4])}:${m[5]}:00`;
}

// A subject row starts with a code (IT-401, CAPSPRO 2, IT-ELEC3) and carries a section of an accepted program (BSIT3A, BSCPE2B, BSIE1A). Titles are best-effort.
function findSubjects(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const sec = line.match(ONE_SECTION);
    if (!sec) continue;
    const code = line.match(/^\W*([A-Z]{2,8}[ -]?(?:ELEC\s?)?\d{1,3}[A-Z]?)\b/i);
    if (!code) continue;
    const title = clean(line.slice(code[0].length, sec.index).replace(/[|[\]_]/g, ' ').replace(/\bS\s*\d?:?\d{0,2}:?\d{0,2}[AP]?M?-?[\d:]*[AP]?M?\b/gi, ' '));
    out.push({ code: clean(code[1]).toUpperCase(), title, section: sectionCode(sec[0]) });
  }
  return out;
}

function parseCor(text) {
  const t = String(text || '').replace(/\r/g, '');
  const program = findProgram(t);
  const sections = [...t.matchAll(ANY_SECTION)].map((x) => sectionCode(x[0]));
  const found = programOf(program && !program.endsWith('...') ? program : '', sections); // the printed course first, else the sections on the subject rows
  const ok = found.ok === 'no' && program ? 'maybe' : found.ok; // a partial "SCIENCE IN ..." is a program, just not a clear one
  return {
    studentId: findStudentId(t),
    studentName: findName(t),
    program: ok === 'yes' ? found.name : program,
    programCode: ok === 'yes' ? found.code : null,
    programOk: ok,
    yearLevel: findYearLevel(t),
    section: sections[0] || null,
    ...findTerm(t),
    printedAt: findPrinted(t),
    subjects: findSubjects(t),
  };
}

module.exports = { parseCor };
