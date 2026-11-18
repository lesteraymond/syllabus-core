// The top bar's search: one box that looks through what the signed-in person can already see.
// Pure functions only (no React, no network), so src/lib/globalSearch.test.js can check them.
//
//   syllabi  the list the app already holds (the server scopes it to the role: faculty see their own and approved ones, reviewers what reached them)
//   courses  the subject catalog (code, title, program), read once when the search is first used
//   users    the people of the system (administrator only: GET /users). Everyone else finds faculty through the syllabi they wrote.
//   pages    the screens of the side menu this role may open: [{ page, label }]
//
// Every word the person types must be found somewhere in the record (any order, accents and capitals ignored), so "cpe 101 santos" finds
// the CPE 101 syllabus of Santos. Records whose main field starts with the word come first.

export const GROUP_ORDER = ['syllabi', 'courses', 'faculty', 'pages'];
export const DEFAULT_LIMIT = 6;

const fold = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const queryWords = (query) => fold(query).split(/[\s,;]+/).filter(Boolean);

// null when a word is missing from the record, otherwise a rank (lower is better): 0 the word starts a main field, 1 it starts a word, 2 it is inside.
function rank(main, rest, words) {
  const mains = main.map(fold);
  const all = [...mains, ...rest.map(fold)].join(' \u0001 ');
  let total = 0;
  for (const word of words) {
    if (!all.includes(word)) return null;
    if (mains.some((m) => m.startsWith(word))) total += 0;
    else if (mains.some((m) => m.split(/[^a-z0-9]+/).some((part) => part.startsWith(word)))) total += 1;
    else total += 2;
  }
  return total;
}

function collect(records, words, describe) {
  const hits = [];
  records.forEach((record, index) => {
    const { main, rest } = describe(record);
    const r = rank(main, rest, words);
    if (r !== null) hits.push({ r, index, record });
  });
  return hits.sort((a, b) => a.r - b.r || a.index - b.index);
}

// The people to search: everyone who owns a syllabus in the list, plus (for the administrator) every faculty member of the system.
export function facultyDirectory({ syllabi = [], users = [] }) {
  const people = new Map();
  const add = (id, name, email) => {
    if (id == null || !String(name || '').trim()) return;
    const known = people.get(id);
    if (known) { if (!known.email && email) known.email = email; return; }
    people.set(id, { id, name: String(name).trim(), email: email || '', count: 0 });
  };
  users.filter((u) => u && u.role === 'faculty').forEach((u) => add(u.id, `${u.firstName || ''} ${u.lastName || ''}`, u.email));
  syllabi.forEach((s) => add(s.userId, s.faculty));
  syllabi.forEach((s) => { const p = people.get(s.userId); if (p) p.count += 1; });
  return [...people.values()];
}

// Returns the groups that have results, in GROUP_ORDER: [{ key, items: [...], total }]. `total` counts all matches; `items` is cut to `limit`.
export function searchAll({ query, syllabi = [], courses = [], users = [], pages = [], isAdmin = false, limit = DEFAULT_LIMIT }) {
  const words = queryWords(query);
  if (!words.length) return [];
  const groups = {
    syllabi: collect(syllabi, words, (s) => ({
      main: [s.courseCode, s.title, s.courseTitle],
      rest: [s.faculty, s.programCode, s.program, s.academicYear, s.version, String(s.status || '').replace(/_/g, ' ')],
    })).map(({ record: s }) => ({
      key: `syllabus-${s.id}`, kind: 'syllabus', id: s.id, title: `${s.courseCode || ''}`.trim() || s.title || '', subtitle: s.title || s.courseTitle || '',
      meta: [s.faculty, s.programCode || s.program, s.academicYear].filter(Boolean).join(' · '), status: s.status, record: s,
    })),
    // The administrator manages the catalog; for everyone else the syllabi already carry the course code and title.
    courses: isAdmin ? collect(courses, words, (c) => ({ main: [c.code, c.title], rest: [c.program] })).map(({ record: c }) => ({
      key: `course-${c.id}`, kind: 'course', id: c.id, title: c.code, subtitle: c.title, meta: c.program || '', record: c,
    })) : [],
    faculty: collect(facultyDirectory({ syllabi, users }), words, (p) => ({ main: [p.name], rest: [p.email] })).map(({ record: p }) => ({
      key: `faculty-${p.id}`, kind: 'faculty', id: p.id, title: p.name, subtitle: p.email, count: p.count, record: p,
    })),
    pages: collect(pages, words, (p) => ({ main: [p.label], rest: [] })).map(({ record: p }) => ({
      key: `page-${p.page}`, kind: 'page', id: p.page, title: p.label, subtitle: '', record: p,
    })),
  };
  return GROUP_ORDER.map((key) => ({ key, total: groups[key].length, items: groups[key].slice(0, limit) })).filter((g) => g.total > 0);
}

// Where choosing a syllabus leads, by who is asking: 'view' (the reviewer's window), 'my-syllabi' (their own work) or 'repository' (a published one).
export function syllabusDestination(user, syllabus, isReviewer) {
  const own = user && syllabus.userId === user.id;
  if (own && ['draft', 'for_revision', 'rejected'].includes(syllabus.status)) return 'my-syllabi';
  if (isReviewer) return 'view';
  return own ? 'my-syllabi' : 'repository';
}
