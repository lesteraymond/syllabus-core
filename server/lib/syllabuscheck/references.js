'use strict';
// Stage D2: APA 7 references. Three questions that are kept apart everywhere (the report, the findings, the UI):
//   FORMAT        does the reference follow APA 7 for its kind of source?      deterministic, from the text alone (this file)
//   RELEVANCE     does the source concern the course?                          the AI, from the citation only (Ref-relevance, advisory)
//   AUTHENTICITY  does the work exist, with this title and year?               'not_verified' unless a DOI was checked against an external source
//                                                                              the operator switched on (SYLLABUS_CHECK_REF_VERIFY=crossref)
// A well-formatted reference can be irrelevant or invented, and an authentic one can be badly formatted: no answer here is allowed to stand in for another.
// Nothing is invented. A suggested text exists only for a MECHANICAL repair that re-uses characters already in the reference (a DOI written as "doi:10.x/y"
// becomes https://doi.org/10.x/y; "and" between authors becomes ", &"). Italics cannot be seen in plain text and are not checked.
// What this cannot decide is reported as 'possible' or left NOT_CHECKED, never as a pass: a reference whose kind is not clear gets no kind-specific verdict.
const { examLike, brief } = require('./planrows');

const GROUPS = ['books', 'program', 'online', 'electronics'];
const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const DOI_BODY = /10\.\d{4,9}\/[^\s"<>]+/;
const GROUP_AUTHOR = /\b(commission|department|ministry|office|bureau|republic|philippines|agency|council|board|institute|association|organization|organisation|society|university|authority|congress|senate|government)\b/i;
const PUBLISHER = /\b(press|publishers?|publishing|books|inc\.?|ltd\.?|llc|wiley|pearson|springer|mcgraw|elsevier|routledge|cengage|oxford|cambridge|prentice|addison|o'reilly|sage|taylor|ieee|acm)\b/i;

function parseReference(text, ctx = {}) {
  const t = clean(text), year = Number.isFinite(ctx.year) ? ctx.year : new Date().getFullYear();
  const issues = [], missing = [];
  const issue = (code, severity, message, component, fix) => issues.push({ code, severity, message, component, fix: fix || null });
  const urls = [...t.matchAll(/https?:\/\/[^\s<>"]+/gi)].map(m => m[0].replace(/[.,;)]+$/, ''));
  const doiMatch = DOI_BODY.exec(t);
  const doi = doiMatch ? doiMatch[0].replace(/[.,;)]+$/, '') : null;
  const doiForm = !doi ? null : /https:\/\/doi\.org\/10\./i.test(t) ? 'https' : /https?:\/\/(dx\.)?doi\.org\/10\./i.test(t) ? 'http' : /\bdoi\s*:?\s*10\./i.test(t) ? 'prefixed' : 'bare';
  // ---- author block and date ----
  const dateRe = /\((\d{4}[a-z]?|n\.d\.)(?:,\s*[A-Za-z]+(?:\s+\d{1,2})?)?\)(\.?)/;
  const date = dateRe.exec(t);
  const authors = date ? clean(t.slice(0, date.index)) : '';
  const after = date ? clean(t.slice(date.index + date[0].length)) : t;
  if (!t) return { text: t, blank: true, type: { kind: 'unknown', confidence: 'none', signals: [] }, components: {}, issues: [], missing: [], format: { status: 'NOT_CHECKED' }, authenticity: { status: 'not_verified' } };
  if (!date) { missing.push('date'); issue('DATE_MISSING', 'definite', 'No publication date in the form (2020). was found after the authors.', 'date'); }
  else {
    const y = /^\d{4}/.test(date[1]) ? Number(date[1].slice(0, 4)) : null;
    if (!date[2]) issue('DATE_PERIOD', 'definite', 'The date should be followed by a period: (' + date[1] + ').', 'date');
    if (y !== null && (y < 1000 || y > year + 1)) issue('DATE_RANGE', 'definite', `The year ${y} is not a plausible publication year.`, 'date');
  }
  const individual = [...authors.matchAll(/([A-Z][\p{L}'’\-]+(?: [\p{L}'’\-]+)*),\s*((?:[A-Z]\.\s?)+)/gu)];
  const groupAuthor = !!authors && !individual.length && (GROUP_AUTHOR.test(authors) || !/,/.test(authors));
  if (date && !authors) { missing.push('author'); issue('AUTHOR_MISSING', 'possible', 'Nothing precedes the date. If the work has no author APA 7 begins with the title; this checker does not verify that form.', 'author'); }
  if (authors) {
    if (!/\.$/.test(authors)) issue('AUTHOR_PERIOD', 'definite', 'The author block should end with a period before the date.', 'author');
    if (!individual.length && !groupAuthor) issue('AUTHOR_FORM', 'possible', 'The authors are not in the form "Surname, A. B." and do not look like an organization.', 'author');
    if (individual.length >= 2) {
      if (/\.\s+and\s+[A-Z]/.test(authors) || /,\s+and\s+[A-Z]/.test(authors)) issue('AUTHOR_AND', 'definite', 'APA 7 joins the last author with "&", not "and".', 'author', 'and-to-ampersand');
      else if (/\.\s+&\s+[A-Z]/.test(authors)) issue('AUTHOR_COMMA', 'definite', 'APA 7 puts a comma before "&": "Surname, A., & Surname, B."', 'author', 'comma-before-ampersand');
      else if (!/&/.test(authors) && individual.length >= 2 && individual.length <= 20) issue('AUTHOR_AMPERSAND', 'possible', 'More than one author but no "&" before the last one.', 'author');
    }
    if (!individual.length && /\b[A-Z][a-z]+ [A-Z]\b(?!\.)/.test(authors) && !groupAuthor) issue('AUTHOR_INITIALS', 'possible', 'Initials should be written with periods ("Smith, J. K.").', 'author');
  }
  // ---- the rest: title, source, locator ----
  const segments = after.replace(doi ? new RegExp('(https?://(dx\\.)?doi\\.org/|doi\\s*:?\\s*)?' + doi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : '', '').split(/\.\s+/).map(clean).filter(Boolean);
  const urlFree = segments.filter(s => !/^https?:\/\//i.test(s));
  const title = urlFree[0] || '';
  const rest = urlFree.slice(1).join('. ');
  if (date && !title) { missing.push('title'); issue('TITLE_MISSING', 'definite', 'No title was found after the date.', 'title'); }
  const volume = /,\s*(\d{1,4})\s*(?:\((\d{1,4}|[A-Za-z0-9\-–]+)\))?\s*,\s*(?:pp?\.\s*)?(?:\d+\s*[–-]\s*\d+|[A-Za-z]?\d{4,}|Article\s+\w+|e\d+)/.exec(rest) || /,\s*(\d{1,4})\s*\((\d{1,4})\)/.exec(rest);
  const pages = /(?:\bpp?\.\s*)?\d+\s*[–-]\s*\d+|\bArticle\s+\w+|\be\d{3,}/.exec(rest);
  const proceedings = /\b(proceedings|conference|symposium|workshop|congress)\b/i.test(rest + ' ' + title);
  const edition = /\(\d+(st|nd|rd|th)\s+ed\.\)/i.test(after);
  const publisher = urlFree.length > 1 ? urlFree[urlFree.length - 1] : '';
  const signals = [];
  let kind = 'unknown';
  const chapter = /\bIn\s+.{2,}?\(Eds?\.\)/.test(after);
  const report = /\((?:Report|Technical Report|Research Report|Working Paper|White Paper)(?:\s+No\.?\s*[\w.\-\/]+)?\)|\bTechnical Report\b|\bWorking Paper\b|\bWhite Paper\b/i.test(after);
  if (chapter) { kind = 'chapter'; signals.push('"In ... (Ed.)" wording'); }
  else if (report) { kind = 'report'; signals.push('report wording'); }
  else if (groupAuthor && /\b(no\.|memorandum|order|act|report|circular|policy|guidelines?|framework)\b/i.test(after) ) { kind = 'official'; signals.push('organization author', 'document number or report wording'); }
  else if (proceedings && /\bin\b/i.test(rest + ' ' + after)) { kind = 'conference'; signals.push('proceedings or conference wording'); }
  else if (volume) { kind = 'journal'; signals.push('volume (issue) and pages'); }
  else if (/\b(journal|transactions on|letters)\b/i.test(rest)) { kind = 'journal'; signals.push('journal wording'); }
  else if (edition || (rest && PUBLISHER.test(rest) && !urls.length) || (rest && PUBLISHER.test(rest) && doi)) { kind = 'book'; signals.push(edition ? 'edition' : 'publisher name'); }
  else if (urls.length && !volume) { kind = groupAuthor ? 'official' : 'website'; signals.push('URL without volume or pages'); if (groupAuthor) signals.push('organization author'); }
  const confidence = kind === 'unknown' ? 'none' : signals.length >= 2 || ['website', 'journal', 'book', 'chapter', 'report'].includes(kind) ? 'medium' : 'low';
  // ---- kind-specific required components ----
  if (kind === 'journal') {
    if (!volume) { missing.push('volume'); issue('JOURNAL_VOLUME', 'definite', 'A journal article needs the journal name and a volume number (issue in parentheses).', 'volume'); }
    if (!pages) { missing.push('pages'); issue('JOURNAL_PAGES', 'definite', 'A journal article needs a page range or an article number.', 'pages'); }
    if (!rest || !/[A-Za-z]{3,}/.test(rest.split(',')[0] || '')) { missing.push('journal'); issue('JOURNAL_NAME', 'definite', 'The journal name was not found.', 'source'); }
  }
  if (kind === 'book') {
    if (!rest || !PUBLISHER.test(rest) && !/^[A-Z][^,]{2,}$/.test(rest)) { missing.push('publisher'); issue('BOOK_PUBLISHER', 'definite', 'A book needs its publisher.', 'publisher'); }
    if (/\b[A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2}\s*:/.test(rest) || /\b[A-Z][a-z]+,\s*[A-Z][a-z]+\s*:\s*[A-Z]/.test(rest)) issue('BOOK_LOCATION', 'definite', 'APA 7 does not give the place of publication.', 'publisher');
  }
  if (kind === 'chapter') {
    if (!/\(pp?\.\s*\d+/.test(after)) { missing.push('pages'); issue('CHAPTER_PAGES', 'definite', 'A chapter in an edited book needs its page range, written (pp. 10-25).', 'pages'); }
    if (!PUBLISHER.test(after)) issue('CHAPTER_PUBLISHER', 'possible', 'A chapter in an edited book is followed by the publisher of the book; none was recognised.', 'publisher');
  }
  if (kind === 'report') {
    if (!PUBLISHER.test(after) && !groupAuthor && !urls.length) { missing.push('publisher'); issue('REPORT_PUBLISHER', 'possible', 'A report names its publisher unless the publisher is also the author; none was found.', 'publisher'); }
  }
  if (kind === 'conference') {
    if (!/\bin\b/i.test(after)) { missing.push('proceedings'); issue('CONF_IN', 'definite', 'A conference paper names the proceedings after "In".', 'source'); }
  }
  if (kind === 'website' || kind === 'official') {
    if (!urls.length && !doi) { missing.push('url'); issue('WEB_URL', 'definite', 'An online source needs its URL.', 'url'); }
    if (!date) { /* already reported */ }
  }
  if (/\bretrieved\s+from\b/i.test(t) && !/\bretrieved\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}/i.test(t)) issue('RETRIEVED', 'possible', '"Retrieved from" is used in APA 7 only with a retrieval date, for pages that are meant to change.', 'url');
  if (/["“][^"”]{8,}["”]/.test(after)) issue('TITLE_QUOTES', 'definite', 'APA 7 does not put the title of an article, chapter or page in quotation marks.', 'title');
  if (/\bAccessed\s+(\d|[A-Z][a-z])/.test(t)) issue('ACCESSED', 'possible', '"Accessed" is not APA 7 style; APA 7 uses "Retrieved Month Day, Year, from URL" only for pages meant to change.', 'url');
  // ---- DOI and URL structure ----
  const doiOk = doi ? /^10\.\d{4,9}\/\S+$/.test(doi) : null;
  if (doi && doiForm !== 'https') issue('DOI_FORM', 'definite', 'A DOI is written as a link: https://doi.org/' + doi, 'doi', 'doi-to-https');
  if (/doi\.org/i.test(t) && !doi) issue('DOI_MALFORMED', 'definite', 'The DOI link does not contain a DOI of the form 10.xxxx/yyyy.', 'doi');
  for (const url of urls) {
    try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw new Error('scheme'); if (u.protocol === 'http:' && !/doi\.org$/i.test(u.hostname)) issue('URL_HTTP', 'possible', 'The link uses http, not https: ' + url, 'url'); }
    catch (error) { issue('URL_MALFORMED', 'definite', 'This link is not a valid web address: ' + url, 'url'); }
  }
  if (/\s(https?:\/\/\S+)\s+(https?:\/\/\S+)/.test(t) && !doi) issue('URL_TWICE', 'possible', 'Two links are given; APA 7 gives one.', 'url');
  // ---- the mechanical repair, only from characters already in the reference ----
  let suggested = t;
  for (const i of issues) {
    if (i.fix === 'doi-to-https' && doi) suggested = suggested.replace(new RegExp('(https?://(dx\\.)?doi\\.org/|\\bdoi\\s*:?\\s*)?' + doi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), 'https://doi.org/' + doi);
    if (i.fix === 'and-to-ampersand') suggested = suggested.replace(/(\.|,)\s+and\s+(?=[A-Z])/, '$1 ').replace(/^([^(]*?\.)\s+(?=[A-Z][\p{L}'’\-]+,\s*(?:[A-Z]\.\s?)+\s*\()/u, '$1, & ');
    if (i.fix === 'comma-before-ampersand') suggested = suggested.replace(/\.\s+&\s+/, '., & ');
  }
  const definite = issues.some(i => i.severity === 'definite'), possible = issues.some(i => i.severity === 'possible');
  const status = definite ? 'FAIL' : possible || confidence === 'none' || confidence === 'low' ? 'NEEDS_REVIEW' : 'PASS';
  return {
    text: t, blank: false, type: { kind, confidence, signals },
    components: { authors, groupAuthor, authorCount: individual.length, date: date ? date[1] : null, title, rest, volume: volume ? volume[1] : null, pages: pages ? pages[0] : null, publisher: kind === 'book' ? rest : null, doi: doi ? { value: doi, form: doiForm, valid: doiOk } : null, urls },
    issues, missing, format: { status, uncertain: confidence === 'none' || confidence === 'low' }, suggestedText: suggested !== t ? suggested : null, authenticity: { status: 'not_verified' },
  };
}

// ---- the whole list ----
function referenceReport(content, ctx = {}) {
  const out = [];
  const groups = content.refs || {};
  for (const key of GROUPS) {
    const group = groups[key];
    if (!group || group.na) continue;
    (group.items || []).forEach((item, k) => {
      if (!clean(item && item.t)) return;
      out.push({ path: `refs.${key}.items[${k}]`, group: key, index: k, ...parseReference(item.t, ctx) });
    });
  }
  return out;
}

// ---- AUTHENTICITY: opt-in, one external source (Crossref), bounded, never required ----
// verified     the DOI exists AND its title and year agree with the reference
// mismatch     the DOI exists but its title or year do not agree: the reference may be wrong or invented
// not_found    the DOI does not resolve in that source
// unavailable  the source could not be reached: nothing is said (the reference stays not verified)
const words = text => new Set((String(text ?? '').toLowerCase().match(/[a-z0-9]{3,}/g) || []));
const overlap = (a, b) => { const x = words(a), y = words(b); if (!x.size || !y.size) return 0; let n = 0; for (const w of x) if (y.has(w)) n++; return n / Math.min(x.size, y.size); };
async function verifyDois(entries, fetchJson, { max = 20 } = {}) {
  let used = 0;
  for (const entry of entries) {
    const doi = entry.components && entry.components.doi && entry.components.doi.valid ? entry.components.doi.value : null;
    if (!doi || used >= max) continue;
    used += 1;
    try {
      const body = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      if (body === null) { entry.authenticity = { status: 'not_found', source: 'crossref' }; continue; }
      const message = body && body.message;
      const title = Array.isArray(message && message.title) ? message.title[0] : '';
      const issued = message && message.issued && message.issued['date-parts'] && message.issued['date-parts'][0] && message.issued['date-parts'][0][0];
      const mine = Number(String(entry.components.date || '').slice(0, 4)) || null;
      const titleOk = overlap(title, entry.components.title) >= 0.6, yearOk = !mine || !issued || Math.abs(mine - issued) <= 1;
      entry.authenticity = { status: titleOk && yearOk ? 'verified' : 'mismatch', source: 'crossref', registered: { title: String(title).slice(0, 300), year: issued || null } };
    } catch (error) { entry.authenticity = { status: 'unavailable', source: 'crossref' }; }
  }
  return entries;
}
// The default fetcher: Crossref only, JSON only, a short timeout; a missing work (404) is null, any other failure throws.
async function crossrefFetch(url, fetchImpl = fetch) {
  if (!/^https:\/\/api\.crossref\.org\/works\//.test(url)) throw new Error('only Crossref work lookups are allowed');
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Crossref HTTP ' + response.status);
  return response.json();
}

// ---- RELEVANCE: one scoped question per reference that no page-based question already covers ----
const MAX_REF_QUESTIONS = 20;
function courseTopics(content) {
  const meta = content.meta || {};
  const topics = (content.plan || []).filter(row => row.kind !== 'exam' && !examLike(row) && clean(row.contents)).map(row => `Week ${row.week}: ${brief(row.contents, 90)}`).join('\n');
  const description = (content.description || []).map(d => clean(d && d.t)).filter(Boolean).join(' ');
  return [`Course: ${[meta.code, meta.title].map(clean).filter(Boolean).join(' - ')}`, description ? `Description: ${description.slice(0, 600)}` : '', topics ? `Weekly topics:\n${topics}` : ''].filter(Boolean).join('\n').slice(0, 2600);
}
// `judgements` are the first-pass answers: a reference whose link was read and judged against the topics (REF-plan) is answered already and is not asked again.
function relevanceTargets(content, entries, judgements = []) {
  const judgedUrls = new Set(judgements.filter(j => j.type === 'REF-plan' && !j.unverified).map(j => String(j.path || '').replace(/^refs:/, '')));
  const asked = [], reused = [];
  for (const entry of entries) (entry.components.urls || []).some(url => judgedUrls.has(url)) ? reused.push(entry) : asked.push(entry);
  return { asked: asked.slice(0, MAX_REF_QUESTIONS), reused };
}
function relevancePairs(content, entries) {
  const source = courseTopics(content);
  return entries.map(entry => ({ id: `ref-${entry.group}-${entry.index}`, type: 'Ref-relevance', source, target: entry.text.slice(0, 600), path: entry.path, targetPath: null }));
}
module.exports = { parseReference, referenceReport, verifyDois, crossrefFetch, relevanceTargets, relevancePairs, courseTopics, MAX_REF_QUESTIONS, GROUPS };
