// What a student sees of the syllabi: approved ones only, the newest of each subject, and "My subjects" taken from their COR.
// Only major subjects count for "My subjects" (IT-xxx, IT-ELECx and CAPSPRO): general education and the like have no syllabus here.

// A subject code with its spaces and hyphens removed, so "IT 301", "IT-301" and "it301" are the same subject.
const norm = (code) => String(code || '').toUpperCase().replace(/[\s-]/g, '');

const isMajor = (code) => /^(IT\d+|ITELEC\d*|CAPSPRO\d*)$/.test(norm(code));

// `rows` are approved syllabi, newest first. Keeps the first (newest) one of each subject; one with no course code stands alone.
function currentPerSubject(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const key = norm(r.course_code) || 'id:' + r.syllabus_id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// The student's major subjects, each with the id of its current approved syllabus (or null when there is none yet).
function mySubjects(enrolled, current) {
  const byCode = new Map();
  for (const r of current) if (norm(r.course_code)) byCode.set(norm(r.course_code), r.syllabus_id);
  const seen = new Set();
  const out = [];
  for (const e of enrolled) {
    const key = norm(e.subject_code);
    if (!isMajor(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ code: e.subject_code, title: e.subject_title || '', syllabusId: byCode.get(key) || null });
  }
  return out;
}

module.exports = { norm, isMajor, currentPerSubject, mySubjects };
