'use strict';
// Reference suggestions for the AI Syllabus Generator. The checker's rule is that a source is looked up, never invented, and a model cannot look one up. So the AI only NAMES candidates
// (a title and the first author's surname): books, checked in the Open Library catalogue, and journal articles, checked in Crossref. A candidate is kept only when the catalogue confirms
// it exists, and the reference text is built from the CATALOGUE's record (its authors, title, edition or journal, year, publisher or DOI), never from what the AI wrote. The text must pass the
// checker's own APA check (references.js parseReference). Titles are put in APA sentence case by the AI in one more request, but only as a change of capital letters: a title whose letters differ from
// the catalogue's in any other way keeps the catalogue's spelling. Websites are not suggested: nothing can confirm a page's title, author and date the way a catalogue confirms a book or a DOI.
// Only the candidate's title and surname are sent to a catalogue: nothing about the user, the faculty or the syllabus. Anything that cannot be confirmed (no match, the network down, a record
// missing its authors, publisher, journal or DOI) is left out; this module never throws, so a lookup problem can never stop a generation. The author still confirms each source.
const { parseReference } = require('../references');
const { titleMatch } = require('./lookup');
const { clean } = require('./extract');
const { REFERENCE_RECENCY_YEARS } = require('./rules');

const MAX_BOOKS = 8, MAX_ARTICLES = 5, KEEP_BOOKS = 5, KEEP_ARTICLES = 3, CONCURRENCY = 4, MAX_EDITIONS = 8;
const REQUEST_MS = 20000, BUDGET_MS = 90000; // each request may take 20 s (Open Library answers in 4 to 5 s on a good day), and no new candidate starts after 90 s
// The only addresses a lookup may call: Open Library's search, one work's editions and one edition by ISBN, and Crossref's work search.
const ALLOWED = [/^https:\/\/openlibrary\.org\/search\.json\?/, /^https:\/\/openlibrary\.org\/works\/OL\d+W\/editions\.json\?/, /^https:\/\/openlibrary\.org\/isbn\/[0-9Xx]+\.json$/, /^https:\/\/api\.crossref\.org\/works\?/];
const patient = (impl) => (url, init = {}) => impl(url, { ...init, signal: AbortSignal.timeout(REQUEST_MS) });
async function getJson(url, fetchImpl) {
  if (!ALLOWED.some(re => re.test(url))) throw new Error('this lookup address is not allowed');
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('catalogue HTTP ' + response.status);
  return response.json();
}

const candidateList = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'firstAuthorSurname', 'year'], properties: { title: { type: 'string' }, firstAuthorSurname: { type: 'string' }, year: { type: 'integer' } } } };
const SCHEMA = { type: 'object', additionalProperties: false, required: ['books', 'articles'], properties: { books: candidateList, articles: candidateList } };
const CASE_SCHEMA = { type: 'object', additionalProperties: false, required: ['titles'], properties: { titles: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['n', 'sentenceCase'], properties: { n: { type: 'integer' }, sentenceCase: { type: 'string' } } } } } };

function candidateMessage({ system, subject, topics }) {
  return { system, schema: SCHEMA, user: JSON.stringify({
    task: 'Name candidate reference books and journal articles for the references of this course. A library catalogue will confirm each one, so you only name them.',
    subject, weeklyTopics: topics,
    format: {
      books: `Up to ${MAX_BOOKS} real textbooks or reference books that fit the subject and its topics: "title" (the exact title as published), "firstAuthorSurname", "year" (of the edition you have in mind, preferring the last ${REFERENCE_RECENCY_YEARS} years). Widely used college books only.`,
      articles: `Up to ${MAX_ARTICLES} real peer-reviewed journal articles about teaching or applying the subject, preferring the last ${REFERENCE_RECENCY_YEARS} years: "title" (exact), "firstAuthorSurname", "year". Name an article only if you are sure it exists; otherwise leave it out.`,
    },
    rules: ['Never invent a title or an author. If you are not sure a source exists, leave it out; fewer candidates is fine, and an empty list is fine.', 'No websites, standards or news.'],
  }) };
}

// "Thomas H. Cormen" -> "Cormen, T. H."; null when it does not look like one person's name (the catalogue sometimes holds citations or organisations in the author field).
function apaName(full) {
  const text = clean(full).replace(/,$/, '');
  if (!text || text.length > 40 || /[0-9;:()]/.test(text) || /\b(and|et al|press|inc|ltd|university|editors?)\b/i.test(text)) return null;
  const parts = text.split(' ');
  if (parts.length < 2 || parts.length > 4 || parts.some(p => !/^[\p{L}.'’-]+$/u.test(p))) return null;
  const surname = parts[parts.length - 1];
  if (/^[\p{Lu}]\.?$/u.test(surname) || /^(jr|sr|ii|iii)\.?$/i.test(surname)) return null; // a name ending in an initial or a suffix: not worth guessing
  const initials = parts.slice(0, -1).map(p => p.replace(/[^\p{L}]/gu, '')[0]).filter(Boolean).map(c => c.toUpperCase() + '.').join(' ');
  return initials ? `${surname}, ${initials}` : null;
}
const authorBlock = names => (names.length === 1 ? names[0] : names.length === 2 ? `${names[0]}, & ${names[1]}` : `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`);
const yearOf = text => { const m = /\b(1[5-9]\d\d|20\d\d)\b/.exec(String(text ?? '')); return m ? Number(m[1]) : null; };
const WORD_NUMBER = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
const EDITION_AT_END = /[,:]?\s*\(?\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th))\s+edition\)?\.?$/i;
// The edition number the catalogue states (its edition name, else "Fourth Edition" at the end of the title), and the title without that phrase: APA 7 writes it as (4th ed.).
function editionOf(title, editionName) {
  const read = text => { const m = /(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+)(?:st|nd|rd|th)?\s*(?:ed\b|edition)/i.exec(String(text ?? '')); if (!m) return 0; const w = m[1].toLowerCase(); return WORD_NUMBER[w] || Number(w) || 0; };
  const cut = EDITION_AT_END.exec(title);
  const n = read(editionName) || (cut ? read(cut[0]) : 0);
  return { title: cut ? title.slice(0, cut.index).trim() : title, n };
}
const ordinal = n => { if (!(n > 1)) return ''; const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'); return ` (${n}${s} ed.)`; };
const letters = text => clean(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// ---- books (Open Library) ----
// The editions of the work: the newest English one with a year and a publisher. The work's own list of editions first (one request); the ISBNs the search returned, one by one, if that fails.
async function editionsOf(doc, title, { fetchImpl, year }) {
  const usable = (edition, published, publisher) => edition && (edition.languages || []).some(l => /\/eng$/.test(String(l && l.key))) && published && published <= year && publisher && titleMatch(title, edition.title); // a translation is not the book the author means
  const found = [];
  try {
    const list = await getJson(`https://openlibrary.org${doc.key}/editions.json?limit=50`, fetchImpl);
    for (const edition of (list && list.entries) || []) { const published = yearOf(edition.publish_date), publisher = clean((edition.publishers || [])[0]); if (usable(edition, published, publisher)) found.push({ edition, published, publisher }); }
  } catch { /* fall back to the ISBNs below */ }
  if (found.length) return found;
  const isbns = [...new Set((doc.isbn || []).filter(i => /^97[89]\d{10}$/.test(i)))].slice(0, MAX_EDITIONS);
  const records = await Promise.all(isbns.map(async isbn => { try { return await getJson(`https://openlibrary.org/isbn/${isbn}.json`, fetchImpl); } catch { return null; } }));
  for (const edition of records) { const published = edition && yearOf(edition.publish_date), publisher = edition && clean((edition.publishers || [])[0]); if (usable(edition, published, publisher)) found.push({ edition, published, publisher }); }
  return found;
}

// One book candidate -> { kind: 'book', parts, year, source, url } or { rejected: reason }. `parts` are the pieces the text is built from (so a corrected title can be put back in).
async function verifyBook(candidate, { fetchImpl, year }) {
  const title = clean(candidate && candidate.title), surname = clean(candidate && candidate.firstAuthorSurname);
  if (!title || !surname) return { rejected: 'no title or author' };
  const q = new URLSearchParams({ title: title.slice(0, 200), author: surname.slice(0, 60), limit: '5', fields: 'key,title,author_name,first_publish_year,isbn' });
  const found = await getJson('https://openlibrary.org/search.json?' + q.toString(), fetchImpl);
  const doc = ((found && found.docs) || []).find(d => titleMatch(title, d.title) && (d.author_name || []).some(a => clean(a).toLowerCase().includes(surname.toLowerCase())));
  if (!doc) return { rejected: 'not in the Open Library catalogue' };
  const names = (doc.author_name || []).map(apaName).filter(Boolean).slice(0, 6);
  if (!names.length || !(doc.author_name || []).some(a => clean(a).toLowerCase().includes(surname.toLowerCase()) && apaName(a))) return { rejected: 'the catalogue gives no clear author names' };
  const editions = await editionsOf(doc, title, { fetchImpl, year });
  if (!editions.length) return { rejected: 'no edition with a year and a publisher' };
  const best = editions.sort((a, b) => b.published - a.published)[0]; // the newest edition
  const { title: bare, n } = editionOf(clean(best.edition.title).replace(/[.]+$/, '') + (best.edition.subtitle ? ': ' + clean(best.edition.subtitle).replace(/[.]+$/, '') : ''), best.edition.edition_name);
  return { kind: 'book', parts: { names, year: best.published, title: bare, edition: n, publisher: best.publisher.replace(/[.]+$/, '') }, year: best.published, source: 'openlibrary', url: 'https://openlibrary.org' + doc.key };
}

// ---- journal articles (Crossref) ----
async function verifyArticle(candidate, { fetchImpl, year }) {
  const title = clean(candidate && candidate.title), surname = clean(candidate && candidate.firstAuthorSurname);
  if (!title || !surname) return { rejected: 'no title or author' };
  const q = new URLSearchParams({ 'query.bibliographic': (title + ' ' + surname).slice(0, 300), filter: 'type:journal-article', rows: '5', select: 'title,author,issued,container-title,volume,issue,page,DOI,type' });
  const result = await getJson('https://api.crossref.org/works?' + q.toString(), fetchImpl);
  const item = (((result && result.message) || {}).items || []).find(i => titleMatch(title, (i.title || [])[0]) && (i.author || []).some(a => clean(a.family).toLowerCase() === surname.toLowerCase()));
  if (!item) return { rejected: 'not in Crossref' };
  const published = Number(((item.issued || {})['date-parts'] || [[]])[0][0]);
  const journal = clean((item['container-title'] || [])[0]), doi = clean(item.DOI), name = clean((item.title || [])[0]);
  if (!(published && published <= year) || !journal || !doi || !name) return { rejected: 'the record has no year, journal or DOI' };
  const people = item.author || [];
  if (!people.length || people.length > 20 || people.some(a => !clean(a.family) || !clean(a.given))) return { rejected: 'the record has no clear author names' };
  const names = people.map(a => apaName(clean(a.given) + ' ' + clean(a.family)));
  if (names.some(n => !n)) return { rejected: 'the record has no clear author names' };
  const pages = clean(item.page).replace(/-/g, '–');
  return { kind: 'article', parts: { names, year: published, title: name.replace(/[.]+$/, ''), journal, volume: clean(item.volume), issue: clean(item.issue), pages, doi }, year: published, source: 'crossref', url: 'https://doi.org/' + doi };
}

// The reference text from its parts (APA 7).
function textOf({ kind, parts }) {
  const authors = authorBlock(parts.names);
  if (kind === 'book') return `${authors} (${parts.year}). ${parts.title}${ordinal(parts.edition)}. ${parts.publisher}.`;
  const tail = (parts.volume ? `, ${parts.volume}` : '') + (parts.issue ? `(${parts.issue})` : '') + (parts.pages ? `, ${parts.pages}` : '');
  return `${authors} (${parts.year}). ${parts.title}. ${parts.journal}${tail}. https://doi.org/${parts.doi}`;
}

// APA sentence case, by the AI, as a change of capital letters ONLY: a title that differs in any letter from the catalogue's keeps the catalogue's spelling. One request for all titles; never throws.
async function sentenceCase(entries, { ask, system }) {
  if (!entries.length || typeof ask !== 'function') return;
  try {
    const message = { system, schema: CASE_SCHEMA, user: JSON.stringify({
      task: 'Rewrite each title in APA 7 sentence case.',
      titles: entries.map((e, i) => ({ n: i, title: e.parts.title })),
      rules: ['Capitalize only the first word, the first word after a colon, and proper nouns, names of languages and tools, and acronyms (Java, Python, SQL, Fourier, Philippine).', 'Change only capitalization: every letter, word and punctuation mark stays exactly as given. Do not add, remove, translate or correct anything.'],
    }) };
    const body = JSON.parse(await ask(message));
    for (const row of (Array.isArray(body.titles) ? body.titles : [])) {
      const entry = entries[row && row.n];
      const text = clean(row && row.sentenceCase);
      if (entry && text && letters(text) === letters(entry.parts.title)) entry.parts.title = text; // only a change of capitals is accepted
    }
  } catch { /* the catalogue's own capitals stay */ }
}

// opts: ask (the generator's provider call), system, subject, topics (the weekly topics), fetchImpl, year, newId.
// -> { items: [{ id, t }] (books), articles: [{ id, t }], checked, kept, rejected: [{ title, reason }] }. Never throws.
async function suggestReferences({ ask, system, subject, topics = [], fetchImpl = patient(fetch), year = new Date().getFullYear(), newId = (p) => p + Math.random().toString(36).slice(2, 10) } = {}) {
  const none = (note) => ({ items: [], articles: [], checked: 0, kept: 0, rejected: [], note });
  let books = [], articles = [];
  try {
    const body = JSON.parse(await ask(candidateMessage({ system, subject, topics })));
    const ok = b => b && clean(b.title) && clean(b.firstAuthorSurname);
    books = (Array.isArray(body.books) ? body.books : []).filter(ok).map(c => ({ ...c, kind: 'book' }));
    articles = (Array.isArray(body.articles) ? body.articles : []).filter(ok).map(c => ({ ...c, kind: 'article' }));
  } catch (error) { return none('the AI could not name candidates: ' + clean(error && error.message).slice(0, 120)); }
  const seen = new Set(), unique = [];
  for (const c of [...books, ...articles]) { const key = c.kind + ':' + clean(c.title).toLowerCase(); if (!seen.has(key)) { seen.add(key); unique.push(c); } }
  const list = [...unique.filter(c => c.kind === 'book').slice(0, MAX_BOOKS), ...unique.filter(c => c.kind === 'article').slice(0, MAX_ARTICLES)];
  const results = [], started = Date.now();
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    if (i > 0 && Date.now() - started > BUDGET_MS) { results.push(...list.slice(i).map(c => ({ c, rejected: 'not looked up: the time for this step ran out' }))); break; }
    results.push(...await Promise.all(list.slice(i, i + CONCURRENCY).map(async c => {
      try { return { c, ...(await (c.kind === 'article' ? verifyArticle : verifyBook)(c, { fetchImpl, year })) }; } catch (error) { return { c, rejected: 'lookup failed: ' + clean(error && error.message).slice(0, 100) }; }
    })));
  }
  const confirmed = results.filter(r => r.parts);
  const pick = (kind, limit) => confirmed.filter(r => r.kind === kind).sort((a, b) => b.year - a.year).slice(0, limit);
  const chosen = [...pick('book', KEEP_BOOKS), ...pick('article', KEEP_ARTICLES)];
  await sentenceCase(chosen, { ask, system });
  // the checker's own APA rule has the last word on every text
  const build = (kind) => { const seenText = new Set(); return chosen.filter(r => r.kind === kind).map(r => textOf(r)).filter(t => !seenText.has(t) && seenText.add(t)).filter(t => parseReference(t, { year }).format.status !== 'FAIL').map(t => ({ id: newId(kind === 'book' ? 'b' : 'o'), t })); };
  const items = build('book'), articlesOut = build('article');
  return { items, articles: articlesOut, checked: list.length, kept: items.length + articlesOut.length, rejected: results.filter(r => !r.parts).map(r => ({ title: clean(r.c.title).slice(0, 120), reason: r.rejected })) };
}

module.exports = { suggestReferences, verifyBook, verifyArticle, textOf, sentenceCase, editionOf, ordinal, apaName, authorBlock, candidateMessage, SCHEMA, CASE_SCHEMA, MAX_BOOKS, MAX_ARTICLES, KEEP_BOOKS, KEEP_ARTICLES };
