'use strict';
// Re-planned AI Checker, Phase 2: does a reference exist? Looked up, never guessed by the AI (owner decision 2026-11-12).
//   DOI            Crossref (api.crossref.org/works/<doi>), title compared
//   ISBN           Open Library (openlibrary.org/isbn/<isbn>.json)
//   book, no ISBN  Open Library title search (title and first author's surname only)
//   link           the existing SSRF-safe link checker (links.js checkUrl)
// Only the reference's own text is sent: nothing about the user, the faculty or the syllabus. A source that cannot be reached or found is
// "not verified" or "not found" (faculty review), never "fake". Only a broken link is a finding. Off unless the caller passes `lookup` to check().
const { parseReference, crossrefFetch } = require('../references');
const { checkUrl } = require('../links');
const { clean } = require('./extract');

const MAX_REFERENCES = 30, CONCURRENCY = 4;
const words = text => new Set((clean(text).toLowerCase().match(/[a-z0-9]{3,}/g) || []));
function titleMatch(a, b) {
  const x = words(a), y = words(b);
  if (!x.size || !y.size) return false;
  let shared = 0; for (const w of x) if (y.has(w)) shared++;
  return shared / Math.min(x.size, y.size) >= 0.6;
}
const isbnOf = text => {
  const m = String(text).match(/\bISBN(?:-1[03])?:?\s*([0-9Xx][0-9Xx\s-]{8,16}[0-9Xx])/) || String(text).match(/\b(97[89][0-9-]{10,14})\b/);
  if (!m) return null;
  const digits = m[1].replace(/[\s-]/g, '');
  return /^(\d{9}[\dXx]|\d{13})$/.test(digits) ? digits : null;
};

async function openLibraryFetch(url, fetchImpl = fetch) {
  if (!/^https:\/\/openlibrary\.org\/(isbn\/[0-9Xx]+\.json|search\.json\?)/.test(url)) throw new Error('only Open Library ISBN and search lookups are allowed');
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Open Library HTTP ' + response.status);
  return response.json();
}

async function lookupOne(ref, { fetchImpl, urlChecker, year }) {
  const parsed = parseReference(ref.text, { year });
  const title = parsed.components?.title || '';
  const base = { key: `ref:${ref.group}:${ref.id}`, group: ref.group, ref: ref.id };
  const tries = [];
  try {
    const doi = parsed.components?.doi?.valid ? parsed.components.doi.value : null;
    if (doi) {
      const work = await crossrefFetch('https://api.crossref.org/works/' + encodeURIComponent(doi), fetchImpl);
      if (!work) return { ...base, status: 'not_found', source: 'crossref', detail: 'Crossref has no record of this DOI.' };
      const found = (work.message?.title || [])[0] || '';
      return titleMatch(title, found) ? { ...base, status: 'verified', source: 'crossref', detail: found }
        : { ...base, status: 'mismatch', source: 'crossref', detail: `The DOI belongs to "${clean(found).slice(0, 160)}".` };
    }
    const isbn = isbnOf(ref.text);
    if (isbn) {
      const book = await openLibraryFetch(`https://openlibrary.org/isbn/${isbn}.json`, fetchImpl);
      if (!book) return { ...base, status: 'not_found', source: 'openlibrary', detail: 'Open Library has no book with this ISBN.' };
      return titleMatch(title, book.title) ? { ...base, status: 'verified', source: 'openlibrary', detail: book.title }
        : { ...base, status: 'mismatch', source: 'openlibrary', detail: `The ISBN belongs to "${clean(book.title).slice(0, 160)}".` };
    }
    if (parsed.type?.kind === 'book' && title) {
      const surname = (String(parsed.components?.authors || '').match(/^[^,]+/) || [''])[0];
      const q = new URLSearchParams({ title: title.slice(0, 200), ...(surname ? { author: surname.slice(0, 60) } : {}), limit: '3', fields: 'title' });
      const result = await openLibraryFetch('https://openlibrary.org/search.json?' + q.toString(), fetchImpl);
      if ((result?.docs || []).some(d => titleMatch(title, d.title))) return { ...base, status: 'verified', source: 'openlibrary', detail: 'Found in the Open Library catalogue.' };
      tries.push('not in the Open Library catalogue');
    }
  } catch (error) {
    tries.push('lookup failed: ' + clean(error && error.message).slice(0, 120));
  }
  const urls = parsed.components?.urls || [];
  if (urls.length) {
    const link = await urlChecker(urls[0]);
    if (link.status === 'ok') return { ...base, status: 'verified', source: 'link', detail: urls[0] };
    if (link.status === 'broken') return { ...base, status: 'link_broken', source: 'link', detail: `${urls[0]} (${link.reason || 'not found'})` };
    tries.push('link could not be confirmed');
  }
  return { ...base, status: 'not_verified', source: null, detail: tries.join('; ') || 'No DOI, ISBN, catalogue entry or link to check.' };
}

// Look up every reference of a map (at most 30, four at a time). opts: fetchImpl (default global fetch), urlChecker (default links.checkUrl), year.
async function lookupReferences(map, opts = {}) {
  const settings = { fetchImpl: opts.fetchImpl || fetch, urlChecker: opts.urlChecker || checkUrl, year: Number.isFinite(opts.year) ? opts.year : new Date().getFullYear() };
  const refs = map.references.slice(0, MAX_REFERENCES), out = [];
  for (let i = 0; i < refs.length; i += CONCURRENCY) out.push(...await Promise.all(refs.slice(i, i + CONCURRENCY).map(ref => lookupOne(ref, settings))));
  for (const ref of map.references.slice(MAX_REFERENCES)) out.push({ key: `ref:${ref.group}:${ref.id}`, group: ref.group, ref: ref.id, status: 'not_verified', source: null, detail: `Only the first ${MAX_REFERENCES} references are looked up.` });
  return out;
}

// Lookup results as fixed-rule style findings: a broken link is a finding; a source not found or not matching goes to faculty review.
function findingsOf(results) {
  const out = [];
  for (const r of results) {
    const where = { group: r.group, ref: r.ref };
    if (r.status === 'link_broken') out.push({ rule: 'REF-LINK', severity: 'finding', area: 'references', field: 'references', layer: 7, where, message: `The reference's link does not open: ${r.detail}.` });
    if (r.status === 'not_found') out.push({ rule: 'REF-EXISTS', severity: 'review', area: 'references', field: 'references', layer: 7, where, message: `${r.detail} Please confirm the source.` });
    if (r.status === 'mismatch') out.push({ rule: 'REF-EXISTS', severity: 'review', area: 'references', field: 'references', layer: 7, where, message: `${r.detail} Please confirm the reference.` });
  }
  return out;
}

module.exports = { lookupReferences, findingsOf, openLibraryFetch, isbnOf, titleMatch, MAX_REFERENCES };
