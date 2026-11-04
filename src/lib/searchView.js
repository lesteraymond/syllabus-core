// What the top bar search finds, from the syllabi list the app already holds (a student's own list is the approved repository). Plain functions,
// tested on their own. Every word typed must appear somewhere in the item (code, title, faculty, program), in any order, ignoring case.
const text = (x) => (x == null ? '' : String(x).toLowerCase());
const words = (q) => text(q).split(/\s+/).filter(Boolean);
const hit = (haystack, ws) => ws.every((w) => haystack.includes(w));

// -> { syllabi: [{ id, code, title, faculty, status }], faculty: [{ userId, name, count }], subjects: [{ code, title }] }, each at most `limit` long.
// Faculty and subject groups are for an administrator; a faculty member or student only searches syllabi.
export function searchAll(query, syllabi, { role = 'faculty', limit = 6 } = {}) {
  const ws = words(query);
  const out = { syllabi: [], faculty: [], subjects: [] };
  if (!ws.length) return out;
  const rows = syllabi.filter((s) => role !== 'admin' || s.status !== 'draft');
  const match = rows.filter((s) => hit([s.courseCode, s.courseTitle, s.title, s.faculty, s.programCode, s.program].map(text).join(' '), ws));
  out.syllabi = match.slice(0, limit).map((s) => ({ id: s.id, code: s.courseCode || '', title: s.courseTitle || s.title || '', faculty: s.faculty || '', status: s.status }));
  if (role !== 'admin') return out;
  const people = new Map();
  rows.forEach((s) => {
    const key = s.userId ?? s.faculty;
    if (!people.has(key)) people.set(key, { userId: s.userId, name: s.faculty || '', count: 0 });
    people.get(key).count += 1;
  });
  out.faculty = [...people.values()].filter((p) => hit(text(p.name), ws)).slice(0, limit);
  const subjects = new Map();
  rows.forEach((s) => { if (s.courseCode && !subjects.has(s.courseCode)) subjects.set(s.courseCode, { code: s.courseCode, title: s.courseTitle || s.title || '' }); });
  out.subjects = [...subjects.values()].filter((x) => hit(text(x.code + ' ' + x.title), ws)).slice(0, limit);
  return out;
}
