// Reads the text OCR returned for a Certificate of Registration ("Official Registration Form") into the few fields
// needed to verify a BSIT student. Pure: no OCR, no database. OCR is imperfect, so every field may come back null
// and the caller decides (verified / pending admin review / rejected).
//
// Fields: studentId, studentName, program, bsit ('yes' | 'maybe' | 'no'), yearLevel, section, schoolYear, term, printedAt, subjects[].

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
function findProgram(text) {
  const flat = text.split('\n').filter((l) => !/COLLEGE\s+OF/i.test(l)).join(' ');
  const full = flat.match(/BACHELOR\s+OF\s+SCIENCE\s+IN\s+INFORMATION\s+TECHNOLOGY/i);
  if (full) return 'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY';
  const m = flat.match(/SCIENCE\s+IN\s+(INFORMAT\w*)(?:\W+(?:\w+\W+){0,6}?(TECHNOLOGY))?/i);
  if (!m) return null;
  return m[2] ? 'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY' : 'SCIENCE IN INFORMATION ...';
}

// 'yes': the course reads Information Technology, or a BSIT section is on the subject rows.
// 'maybe': only "Science in Information" was readable (could be Information Systems): needs an admin to look.
// 'no': nothing program-like was read.
function bsitConfidence(program, text) {
  if (program && /TECHNOLOGY/.test(program)) return 'yes';
  if (/\bBS\s*IT\s*\d[A-Z]?\b/i.test(text)) return 'yes';
  return program ? 'maybe' : 'no';
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

// A subject row starts with a code (IT-401, CAPSPRO 2, IT-ELEC3) and carries a BSIT section. Titles are best-effort.
function findSubjects(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const sec = line.match(/\bBS\s*IT\s*\d[A-Z]?\b/i);
    if (!sec) continue;
    const code = line.match(/^\W*([A-Z]{2,8}[ -]?(?:ELEC\s?)?\d{1,3}[A-Z]?)\b/i);
    if (!code) continue;
    const title = clean(line.slice(code[0].length, sec.index).replace(/[|[\]_]/g, ' ').replace(/\bS\s*\d?:?\d{0,2}:?\d{0,2}[AP]?M?-?[\d:]*[AP]?M?\b/gi, ' '));
    out.push({ code: clean(code[1]).toUpperCase(), title, section: clean(sec[0]).toUpperCase().replace(/\s+/g, '') });
  }
  return out;
}

function parseCor(text) {
  const t = String(text || '').replace(/\r/g, '');
  const program = findProgram(t);
  const bsit = bsitConfidence(program, t);
  const sections = [...t.matchAll(/\bBS\s*IT\s*\d[A-Z]?\b/gi)].map((x) => x[0].toUpperCase().replace(/\s+/g, ''));
  return {
    studentId: findStudentId(t),
    studentName: findName(t),
    program: bsit === 'yes' ? 'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY' : program,
    bsit,
    yearLevel: findYearLevel(t),
    section: sections[0] || null,
    ...findTerm(t),
    printedAt: findPrinted(t),
    subjects: findSubjects(t),
  };
}

module.exports = { parseCor };
