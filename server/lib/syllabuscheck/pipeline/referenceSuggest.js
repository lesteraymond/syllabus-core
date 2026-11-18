'use strict';
// Reference suggestions for the AI Syllabus Generator. The checker's rule is that a source is looked up, never invented, and a model cannot look one up. So the AI only NAMES candidate
// books (a title and the first author's surname); a candidate is kept only when the Open Library catalogue confirms that the book exists, and the reference text is then built from the
// CATALOGUE's record (its authors, title, edition, year and publisher), never from what the AI wrote. The text must pass the checker's own APA check (references.js parseReference).
// Only the candidate's title and surname are sent to Open Library: nothing about the user, the faculty or the syllabus. Anything that cannot be confirmed (no match, the network down, a
// record missing its authors or publisher) is simply left out; this module never throws, so a lookup problem can never stop a generation. The author still confirms each source.
const { parseReference } = require('../references');
const { openLibraryFetch, titleMatch } = require('./lookup');
const { clean } = require('./extract');
const { REFERENCE_RECENCY_YEARS } = require('./rules');

const MAX_CANDIDATES = 8, MAX_KEPT = 5, CONCURRENCY = 4, MAX_EDITIONS = 8;
const REQUEST_MS = 20000, BUDGET_MS = 90000; // Open Library answers in 4 to 5 seconds on a good day: each request may take 20 s, and no new candidate starts after 90 s
// The lookups of lookup.js give each request 6 seconds, too short for this catalogue; this wrapper gives its own signal.
const patient = (impl) => (url, init = {}) => impl(url, { ...init, signal: AbortSignal.timeout(REQUEST_MS) });
const SCHEMA = { type: 'object', additionalProperties: false, required: ['books'], properties: { books: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'firstAuthorSurname', 'year'], properties: { title: { type: 'string' }, firstAuthorSurname: { type: 'string' }, year: { type: 'integer' } } } } } };

function candidateMessage({ system, subject, topics }) {
  return { system, schema: SCHEMA, user: JSON.stringify({
    task: 'Name candidate reference books for the references of this course. A library catalogue will confirm each one, so you only name them.',
    subject, weeklyTopics: topics,
    format: { books: `Up to ${MAX_CANDIDATES} real textbooks or reference books that fit the subject and its topics: "title" (the exact title as published), "firstAuthorSurname", "year" (of the edition you have in mind, preferring the last ${REFERENCE_RECENCY_YEARS} years). Widely used college books only.` },
    rules: ['Never invent a title or an author. If you are not sure a book exists, leave it out; fewer candidates is fine.', 'Books only: no websites, articles or standards.'],
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

// One candidate -> { text, year, source, url } or { rejected: reason }.
async function verifyCandidate(candidate, { fetchImpl, year }) {
  const title = clean(candidate && candidate.title), surname = clean(candidate && candidate.firstAuthorSurname);
  if (!title || !surname) return { rejected: 'no title or author' };
  const q = new URLSearchParams({ title: title.slice(0, 200), author: surname.slice(0, 60), limit: '5', fields: 'key,title,author_name,first_publish_year,isbn' });
  const found = await openLibraryFetch('https://openlibrary.org/search.json?' + q.toString(), fetchImpl);
  const doc = ((found && found.docs) || []).find(d => titleMatch(title, d.title) && (d.author_name || []).some(a => clean(a).toLowerCase().includes(surname.toLowerCase())));
  if (!doc) return { rejected: 'not in the Open Library catalogue' };
  const names = (doc.author_name || []).map(apaName).filter(Boolean).slice(0, 6);
  if (!names.length || !(doc.author_name || []).some(a => clean(a).toLowerCase().includes(surname.toLowerCase()) && apaName(a))) return { rejected: 'the catalogue gives no clear author names' };
  // the editions: the newest one that is not in the future, from the catalogue's own record of that edition
  const isbns = [...new Set((doc.isbn || []).filter(i => /^97[89]\d{10}$/.test(i)))].slice(0, MAX_EDITIONS);
  const editions = [];
  const records = await Promise.all(isbns.map(async isbn => { try { return await openLibraryFetch(`https://openlibrary.org/isbn/${isbn}.json`, fetchImpl); } catch { return null; } })); // the editions at once
  for (const edition of records) {
    const published = edition && yearOf(edition.publish_date), publisher = edition && clean((edition.publishers || [])[0]);
    const english = edition && (edition.languages || []).some(l => /\/eng$/.test(String(l && l.key))); // a translation is not the book the author means
    if (edition && english && published && published <= year && publisher && titleMatch(title, edition.title)) editions.push({ edition, published, publisher });
  }
  if (!editions.length) return { rejected: 'no edition with a year and a publisher' };
  const best = editions.sort((a, b) => b.published - a.published)[0];
  const { title: bare, n } = editionOf(clean(best.edition.title).replace(/[.]+$/, '') + (best.edition.subtitle ? ': ' + clean(best.edition.subtitle).replace(/[.]+$/, '') : ''), best.edition.edition_name);
  const text = `${authorBlock(names)} (${best.published}). ${bare}${ordinal(n)}. ${best.publisher.replace(/[.]+$/, '')}.`;
  const parsed = parseReference(text, { year });
  if (parsed.format.status === 'FAIL') return { rejected: 'the reference could not be written in APA 7 from the catalogue record' };
  return { text, year: best.published, source: 'openlibrary', url: 'https://openlibrary.org' + doc.key };
}

// opts: ask (the generator's provider call), system, subject, topics (the weekly topics), fetchImpl, year, newId. -> { items: [{ id, t }], checked, kept, rejected: [{ title, reason }] }. Never throws.
async function suggestReferences({ ask, system, subject, topics = [], fetchImpl = patient(fetch), year = new Date().getFullYear(), newId = (p) => p + Math.random().toString(36).slice(2, 10) } = {}) {
  const none = (note) => ({ items: [], checked: 0, kept: 0, rejected: [], note });
  let candidates = [];
  try {
    const body = JSON.parse(await ask(candidateMessage({ system, subject, topics })));
    candidates = (Array.isArray(body.books) ? body.books : []).filter(b => b && clean(b.title) && clean(b.firstAuthorSurname));
  } catch (error) { return none('the AI could not name candidates: ' + clean(error && error.message).slice(0, 120)); }
  const seen = new Set(), unique = [];
  for (const c of candidates) { const key = clean(c.title).toLowerCase(); if (!seen.has(key)) { seen.add(key); unique.push(c); } }
  const list = unique.slice(0, MAX_CANDIDATES), results = [], started = Date.now();
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    if (i > 0 && Date.now() - started > BUDGET_MS) { results.push(...list.slice(i).map(c => ({ c, rejected: 'not looked up: the time for this step ran out' }))); break; }
    results.push(...await Promise.all(list.slice(i, i + CONCURRENCY).map(async c => {
      try { return { c, ...(await verifyCandidate(c, { fetchImpl, year })) }; } catch (error) { return { c, rejected: 'lookup failed: ' + clean(error && error.message).slice(0, 100) }; }
    })));
  }
  const kept = results.filter(r => r.text).sort((a, b) => b.year - a.year).slice(0, MAX_KEPT);
  const seenText = new Set();
  const items = kept.filter(r => !seenText.has(r.text) && seenText.add(r.text)).map(r => ({ id: newId('b'), t: r.text }));
  return { items, checked: list.length, kept: items.length, rejected: results.filter(r => !r.text).map(r => ({ title: clean(r.c.title).slice(0, 120), reason: r.rejected })) };
}

module.exports = { suggestReferences, verifyCandidate, editionOf, ordinal, apaName, authorBlock, candidateMessage, SCHEMA, MAX_CANDIDATES, MAX_KEPT };
