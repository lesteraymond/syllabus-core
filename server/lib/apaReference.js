'use strict';
// Automatic APA 7th edition reference formatter for a URL or DOI pasted into Syllabus Builder Step 5 (References).
// Uses the same SSRF-safe public-address policy as server/lib/syllabuscheck/links.js and Crossref DOI lookup from
// server/lib/syllabuscheck/references.js. Never throws on network/parse failures: falls back cleanly to a
// deterministic APA 7 website citation derived from the URL itself.
const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const { publicAddress } = require('./syllabuscheck/links');
const { crossrefFetch } = require('./syllabuscheck/references');

const MAX_BYTES = 200 * 1024;
const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;
// A page is untrusted text and the server has one thread, so reading it must take time proportional to its length: tags are found in one pass
// (tagScanner) and every value is cut to these lengths before a pattern with a repeat at its end ("...$") runs on it.
const MAX_ATTRS = 4096;
const MAX_VALUE = 1000;
const MAX_TITLE = 500;
const MAX_METAS = 400;
const MAX_LD_NODES = 100;
const MAX_AUTHORS = 100;
const DOI_BODY = /10\.\d{4,9}\/[^\s"<>]+/;
const STANDALONE_URL_RE = /^https?:\/\/[^\s<>"]+$/i;
const STANDALONE_DOI_RE = /^doi\s*:?\s*(10\.\d{4,9}\/[^\s"<>]+)$/i;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const KNOWN_SITES = Object.freeze({
  'developer.mozilla.org': 'MDN Web Docs',
  'github.com': 'GitHub',
  'docs.python.org': 'Python Software Foundation',
  'en.wikipedia.org': 'Wikipedia',
  'wikipedia.org': 'Wikipedia',
  'stackoverflow.com': 'Stack Overflow',
  'w3schools.com': 'W3Schools',
  'geeksforgeeks.org': 'GeeksforGeeks',
  'learn.microsoft.com': 'Microsoft Learn',
  'docs.oracle.com': 'Oracle',
  'react.dev': 'React',
  'nodejs.org': 'Node.js',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'arxiv.org': 'arXiv',
  'ieee.org': 'IEEE',
  'ieeexplore.ieee.org': 'IEEE Xplore',
  'dl.acm.org': 'ACM Digital Library',
  'sciencedirect.com': 'ScienceDirect',
  'springer.com': 'Springer',
  'link.springer.com': 'Springer',
  'coursera.org': 'Coursera',
  'khanacademy.org': 'Khan Academy',
  'ched.gov.ph': 'Commission on Higher Education',
});

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
  '&ndash;': '–', '&mdash;': '—', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
};

function decodeHtml(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { const n = parseInt(h, 16); return Number.isFinite(n) ? String.fromCodePoint(n) : _; })
    .replace(/&#(\d+);/g, (_, d) => { const n = parseInt(d, 10); return Number.isFinite(n) ? String.fromCodePoint(n) : _; })
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp|ndash|mdash|rsquo|lsquo|ldquo|rdquo);/gi, (m) => ENTITIES[m.toLowerCase()] || m)
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

// Text of at most max characters, from a string or a number of a page; anything else is no text.
function short(value, max = MAX_VALUE) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, max) : '';
}

function isStandaloneLink(text) {
  const t = clean(text);
  return STANDALONE_URL_RE.test(t) || STANDALONE_DOI_RE.test(t);
}

function normalizeUrl(raw) {
  const t = clean(raw);
  const doiPrefix = STANDALONE_DOI_RE.exec(t);
  if (doiPrefix) return 'https://doi.org/' + doiPrefix[1].replace(/[.,;)]+$/, '');
  if (!STANDALONE_URL_RE.test(t)) return null;
  try {
    const u = new URL(t);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function extractDoiFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (/^(www\.|dx\.)?doi\.org$/i.test(u.hostname)) {
      const m = DOI_BODY.exec(decodeURIComponent(u.pathname.replace(/^\/+/, '')));
      return m ? m[0].replace(/[.,;)]+$/, '') : null;
    }
  } catch {}
  return null;
}

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address))) {
      return callback(new Error('Non-public address refused'));
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

function assertSafeUrl(raw) {
  const u = new URL(raw);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password ||
    (u.port && !['80', '443'].includes(u.port)) ||
    (net.isIP(u.hostname.replace(/^\[|\]$/g, '')) && !publicAddress(u.hostname.replace(/^\[|\]$/g, '')))) {
    throw new Error('Unsafe URL refused');
  }
  return u;
}

function fetchHtmlSafe(rawUrl, { timeoutMs = TIMEOUT_MS, maxRedirects = MAX_REDIRECTS } = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = assertSafeUrl(rawUrl); } catch (e) { return reject(e); }

    const req = (url.protocol === 'https:' ? https : http).get(url, {
      lookup: safeLookup,
      agent: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SyllabusReferenceFormatter/1.0)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      },
    }, (res) => {
      const code = res.statusCode || 0;
      if (code >= 300 && code < 400 && res.headers.location && maxRedirects > 0) {
        res.destroy();
        try {
          const next = new URL(res.headers.location, url).toString();
          return fetchHtmlSafe(next, { timeoutMs, maxRedirects: maxRedirects - 1 }).then(resolve, reject);
        } catch (e) {
          return reject(e);
        }
      }
      if (code < 200 || code >= 300) {
        res.destroy();
        return reject(new Error(`HTTP ${code}`));
      }
      const ctype = String(res.headers['content-type'] || '');
      if (!/text\/html|application\/xhtml/i.test(ctype)) {
        res.destroy();
        return reject(new Error('Non-HTML content'));
      }
      const chunks = [];
      let size = 0;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve({ html: Buffer.concat(chunks).subarray(0, MAX_BYTES).toString('utf8'), finalUrl: url.toString() });
        res.destroy();
      };
      res.on('data', (chunk) => {
        chunks.push(chunk);
        size += chunk.length;
        if (size >= MAX_BYTES) finish();
      });
      res.on('end', finish);
      res.on('close', finish);
      res.on('error', (err) => { if (!done) { done = true; reject(err); } });
    });

    const timer = setTimeout(() => req.destroy(new Error('Request timed out')), timeoutMs);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
  });
}

// ---- APA 7th edition formatting helpers ----

function formatInitials(given) {
  return clean(given)
    .split(/[\s-]+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ''))
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + '.')
    .join(' ');
}

function formatPersonName(raw) {
  const text = clean(raw).replace(/^by\s+/i, '').replace(/,$/, '');
  if (!text || text.length > 80 || /[0-9;:()@#]/.test(text) || /^https?:\/\//i.test(text)) return null;
  // Already "Surname, First ..."
  if (text.includes(',')) {
    const [surnameRaw, ...rest] = text.split(',');
    const surname = clean(surnameRaw);
    const given = clean(rest.join(' '));
    if (!surname || !given) return null;
    if (/^(?:[A-Z]\.\s?)+$/.test(given)) return `${surname}, ${given.replace(/\.([A-Z])/g, '. $1')}`;
    const initials = formatInitials(given);
    return initials ? `${surname}, ${initials}` : null;
  }
  const parts = text.split(' ').filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return null;
  if (/\b(inc|ltd|llc|corp|press|university|department|ministry|commission|organization|organisation|foundation|institute|association|news|times|post|journal|media|team|staff|editors?)\b/i.test(text)) {
    return null; // organization, not an individual
  }
  if (parts.some((p) => !/^[\p{L}.'’-]+$/u.test(p))) return null;
  const surname = parts[parts.length - 1];
  if (/^[\p{Lu}]\.?$/u.test(surname) || /^(jr|sr|ii|iii|iv)\.?$/i.test(surname)) return null;
  const initials = formatInitials(parts.slice(0, -1).join(' '));
  return initials ? `${surname}, ${initials}` : null;
}

function formatAuthorList(names) {
  const list = names.filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]}, & ${list[1]}`;
  if (list.length <= 20) return `${list.slice(0, -1).join(', ')}, & ${list[list.length - 1]}`;
  return `${list.slice(0, 19).join(', ')}, ... ${list[list.length - 1]}`;
}

function formatApaDate(raw) {
  const s = clean(short(raw, 100));
  if (!s) return 'n.d.';
  // YYYY-MM-DD or YYYY/MM/DD (including ISO-8601 timestamps like 2024-05-14T10:00:00Z)
  const ymd = /\b(19\d{2}|20\d{2})[-/](\d{1,2})(?:[-/](\d{1,2}))?(?![0-9])/.exec(s);
  if (ymd) {
    const y = ymd[1];
    const m = Number(ymd[2]);
    const d = ymd[3] ? Number(ymd[3]) : null;
    if (m >= 1 && m <= 12) {
      if (d && d >= 1 && d <= 31) return `${y}, ${MONTHS[m - 1]} ${d}`;
      return `${y}, ${MONTHS[m - 1]}`;
    }
    return y;
  }
  // Just year
  const yOnly = /\b(19\d{2}|20\d{2})\b/.exec(s);
  if (yOnly) return yOnly[1];
  return 'n.d.';
}

function cleanTitle(raw, siteName = '') {
  let t = decodeHtml(short(raw)).slice(0, MAX_TITLE).replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
  if (!t) return '';
  // Strip common " | Site Name" or " - Site Name" suffix
  if (siteName) {
    const escaped = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const suffixRe = new RegExp(`\\s*[|\\-–—:]\\s*${escaped}\\s*$`, 'i');
    const stripped = t.replace(suffixRe, '').trim();
    if (stripped.length >= 4) t = stripped;
  }
  return t.replace(/[.]+$/, '').trim();
}

function siteNameFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (KNOWN_SITES[host]) return KNOWN_SITES[host];
    const parts = host.split('.');
    const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (!base) return host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return 'Website';
  }
}

function titleFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const segs = u.pathname.split('/').filter(Boolean);
    if (!segs.length) return siteNameFromUrl(urlStr);
    let last = decodeURIComponent(segs[segs.length - 1]);
    last = last.replace(/\.(html?|php|aspx?|jsp|pdf)$/i, '');
    last = last.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!last || /^\d+$/.test(last)) {
      if (segs.length >= 2) {
        last = decodeURIComponent(segs[segs.length - 2]).replace(/[-_]+/g, ' ').trim();
      }
    }
    if (!last) return siteNameFromUrl(urlStr);
    return last.charAt(0).toUpperCase() + last.slice(1);
  } catch {
    return 'Web page';
  }
}

function ensurePeriod(s) {
  const t = clean(s);
  if (!t) return '';
  return /[.!?]$/.test(t) ? t : t + '.';
}

// ---- Crossref DOI -> APA 7 ----

function formatCrossrefAsApa7(work, doi) {
  const msg = (work && work.message) || work;
  if (!msg || typeof msg !== 'object') return null;

  const rawAuthors = Array.isArray(msg.author) ? msg.author : [];
  const formattedAuthors = rawAuthors.map((a) => {
    if (a.name) return clean(a.name);
    if (a.family && a.given) {
      const initials = formatInitials(a.given);
      return initials ? `${clean(a.family)}, ${initials}` : clean(a.family);
    }
    if (a.family) return clean(a.family);
    return null;
  }).filter(Boolean);

  const dateParts = (msg.issued && msg.issued['date-parts'] && msg.issued['date-parts'][0]) ||
    (msg.published && msg.published['date-parts'] && msg.published['date-parts'][0]) ||
    (msg.created && msg.created['date-parts'] && msg.created['date-parts'][0]) || [];
  const year = dateParts[0] ? String(dateParts[0]) : 'n.d.';
  const title = cleanTitle(Array.isArray(msg.title) ? msg.title[0] : msg.title);
  if (!title) return null;

  const container = clean(Array.isArray(msg['container-title']) ? msg['container-title'][0] : msg['container-title']);
  const publisher = clean(msg.publisher).replace(/,\s*The$/i, '').replace(/[.]+$/, '');
  const volume = clean(msg.volume);
  const issue = clean(msg.issue);
  const page = clean(msg.page);
  const doiUrl = 'https://doi.org/' + clean(msg.DOI || doi);

  const authorStr = formatAuthorList(formattedAuthors) || publisher || container || 'Unknown Author';
  const head = `${ensurePeriod(authorStr)} (${year}). ${ensurePeriod(title)}`;

  if (container && volume) {
    const volIssue = issue ? `${volume}(${issue})` : volume;
    const locator = page ? `${container}, ${volIssue}, ${page}.` : `${container}, ${volIssue}.`;
    return `${head} ${locator} ${doiUrl}`;
  }
  if (container) {
    const locator = page ? `${container}, ${page}.` : `${ensurePeriod(container)}`;
    return `${head} ${locator} ${doiUrl}`;
  }
  if (publisher && publisher.toLowerCase() !== authorStr.toLowerCase()) {
    return `${head} ${ensurePeriod(publisher)} ${doiUrl}`;
  }
  return `${head} ${doiUrl}`;
}

// ---- HTML metadata extraction -> APA 7 ----

// The opening tags with this name, in order: { attrs, end }. A tag ends at the next ">"; with none left there are no more tags. The search always goes
// on from where the last tag ended, so a page is read once however it is written. skipTo moves the search past a tag's content.
function tagScanner(html, name) {
  const open = new RegExp('<' + name + '\\b', 'gi');
  return {
    next() {
      const m = open.exec(html);
      if (!m) return null;
      const from = open.lastIndex, close = html.indexOf('>', from);
      if (close < 0) return null;
      open.lastIndex = close + 1;
      return { attrs: html.slice(from, Math.min(close, from + MAX_ATTRS)), end: close + 1 };
    },
    skipTo(index) { open.lastIndex = index; },
  };
}

// Where the closing tag starts at or after an index, or -1.
function closingTag(html, name, from) {
  const close = new RegExp('</' + name + '\\b', 'gi');
  close.lastIndex = from;
  const m = close.exec(html);
  return m ? m.index : -1;
}

function parseMetaTags(html) {
  const metas = [];
  const scan = tagScanner(html, 'meta');
  for (let tag = scan.next(); tag && metas.length < MAX_METAS; tag = scan.next()) {
    const name = (/\b(?:name|property)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag.attrs) || []).slice(1).find(Boolean);
    const content = (/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag.attrs) || []).slice(1).find(Boolean);
    if (name && content) metas.push({ name: short(name, 100).toLowerCase(), content: decodeHtml(short(content)) });
  }
  return metas;
}

function parseJsonLd(html) {
  const out = [];
  const scan = tagScanner(html, 'script');
  for (let tag = scan.next(); tag && out.length < MAX_LD_NODES; tag = scan.next()) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(tag.attrs)) continue;
    const close = closingTag(html, 'script', tag.end);
    if (close < 0) break;
    scan.skipTo(close);
    try {
      const parsed = JSON.parse(html.slice(tag.end, close).trim());
      const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed]);
      out.push(...items.slice(0, MAX_LD_NODES).filter((x) => x && typeof x === 'object'));
    } catch {}
  }
  return out;
}

function titleTagOf(html) {
  const tag = tagScanner(html, 'title').next();
  const close = tag ? closingTag(html, 'title', tag.end) : -1;
  return close < 0 ? '' : html.slice(tag.end, Math.min(close, tag.end + MAX_VALUE));
}

function timeTagOf(html) {
  const scan = tagScanner(html, 'time');
  for (let tag = scan.next(); tag; tag = scan.next()) {
    const m = /\bdatetime\s*=\s*["']([^"']+)["']/i.exec(tag.attrs);
    if (m) return m[1];
  }
  return '';
}

function extractHtmlMeta(html, urlStr) {
  const metas = parseMetaTags(html);
  const all = (key) => metas.filter((x) => x.name === key).map((x) => x.content).filter(Boolean);
  const first = (...keys) => { for (const k of keys) { const v = all(k)[0]; if (v) return v; } return ''; };

  const ld = parseJsonLd(html);
  const ldNode = ld.find((n) => n.headline || n.datePublished || n.author) || ld[0] || {};

  const ldAuthors = [];
  const rawLdAuth = ldNode.author;
  for (const a of Array.isArray(rawLdAuth) ? rawLdAuth.slice(0, MAX_AUTHORS) : (rawLdAuth ? [rawLdAuth] : [])) {
    const name = decodeHtml(short(a && typeof a === 'object' ? a.name : a));
    if (name) ldAuthors.push(name);
  }

  const citationAuthors = all('citation_author');
  const metaAuthors = citationAuthors.length ? citationAuthors
    : [...all('author'), ...all('dc.creator'), ...all('dcterms.creator'), ...all('article:author')].filter((a) => !/^https?:\/\//i.test(a));

  const rawAuthors = citationAuthors.length ? citationAuthors : (metaAuthors.length ? metaAuthors : ldAuthors);

  const siteName = clean(
    first('og:site_name', 'application-name', 'twitter:site')
      .replace(/^@/, '') ||
    (ldNode.publisher && ldNode.publisher.name ? decodeHtml(short(ldNode.publisher.name)) : '') ||
    siteNameFromUrl(urlStr)
  );

  const titleTag = titleTagOf(html);
  const rawTitle = first('citation_title', 'og:title', 'twitter:title', 'dc.title') ||
    short(ldNode.headline) || short(ldNode.name) ||
    titleTag;
  const title = cleanTitle(rawTitle, siteName) || titleFromUrl(urlStr);

  const timeTag = timeTagOf(html);
  const rawDate = first(
    'citation_publication_date', 'citation_date', 'citation_online_date',
    'article:published_time', 'og:published_time', 'dc.date', 'dcterms.issued',
    'publish-date', 'pubdate', 'date'
  ) || ldNode.datePublished || ldNode.dateCreated || timeTag;

  const doiRaw = first('citation_doi', 'dc.identifier');
  const doiMatch = doiRaw ? DOI_BODY.exec(doiRaw) : null;

  return {
    authors: rawAuthors,
    date: formatApaDate(rawDate),
    title,
    siteName,
    journal: first('citation_journal_title'),
    volume: first('citation_volume'),
    issue: first('citation_issue'),
    firstPage: first('citation_firstpage'),
    lastPage: first('citation_lastpage'),
    doi: doiMatch ? doiMatch[0].replace(/[.,;)]+$/, '') : null,
  };
}

function formatMetaAsApa7(meta, urlStr) {
  const individual = meta.authors.map(formatPersonName).filter(Boolean);
  const groupFromMeta = !individual.length && meta.authors.length ? clean(meta.authors[0]) : '';
  const siteName = clean(meta.siteName) || siteNameFromUrl(urlStr);
  const authorStr = individual.length ? formatAuthorList(individual) : (groupFromMeta || siteName);
  const dateStr = meta.date || 'n.d.';
  const titleStr = meta.title || titleFromUrl(urlStr);
  const locator = meta.doi ? `https://doi.org/${meta.doi}` : urlStr;

  const head = `${ensurePeriod(authorStr)} (${dateStr}). ${ensurePeriod(titleStr)}`;

  if (meta.journal && meta.volume) {
    const volIssue = meta.issue ? `${meta.volume}(${meta.issue})` : meta.volume;
    const pages = meta.firstPage && meta.lastPage ? `${meta.firstPage}–${meta.lastPage}` : (meta.firstPage || '');
    const src = pages ? `${meta.journal}, ${volIssue}, ${pages}.` : `${meta.journal}, ${volIssue}.`;
    return `${head} ${src} ${locator}`;
  }

  // APA 7th edition rule: omit the site name when it is the same as the author.
  const sameSite = siteName.toLowerCase() === authorStr.replace(/\.$/, '').toLowerCase();
  if (siteName && !sameSite) {
    return `${head} ${ensurePeriod(siteName)} ${locator}`;
  }
  return `${head} ${locator}`;
}

function fallbackApa7FromUrl(urlStr) {
  const site = siteNameFromUrl(urlStr);
  const title = titleFromUrl(urlStr);
  if (title.toLowerCase() === site.toLowerCase()) {
    return `${ensurePeriod(site)} (n.d.). Home. ${urlStr}`;
  }
  return `${ensurePeriod(site)} (n.d.). ${ensurePeriod(title)} ${urlStr}`;
}

async function formatUrlAsApa7(rawInput, { fetchHtml = fetchHtmlSafe, fetchCrossref = crossrefFetch } = {}) {
  const urlStr = normalizeUrl(rawInput);
  if (!urlStr) return null;

  // 1. Direct DOI link -> Crossref lookup
  const doi = extractDoiFromUrl(urlStr);
  if (doi) {
    try {
      const work = await fetchCrossref('https://api.crossref.org/works/' + encodeURIComponent(doi));
      const citation = formatCrossrefAsApa7(work, doi);
      if (citation) return { citation, source: 'crossref', url: 'https://doi.org/' + doi };
    } catch { /* fall through to HTML / URL fallback */ }
  }

  // 2. HTML page metadata lookup (SSRF-safe)
  try {
    const { html, finalUrl } = await fetchHtml(urlStr);
    const meta = extractHtmlMeta(html, finalUrl || urlStr);
    if (meta.doi && !doi) {
      try {
        const work = await fetchCrossref('https://api.crossref.org/works/' + encodeURIComponent(meta.doi));
        const citation = formatCrossrefAsApa7(work, meta.doi);
        if (citation) return { citation, source: 'crossref', url: 'https://doi.org/' + meta.doi };
      } catch { /* fall back to extracted HTML metadata */ }
    }
    return { citation: formatMetaAsApa7(meta, urlStr), source: 'webpage', url: urlStr };
  } catch {
    // 3. Deterministic APA 7 fallback from the URL itself
    return { citation: fallbackApa7FromUrl(urlStr), source: 'url_fallback', url: urlStr };
  }
}

module.exports = {
  formatUrlAsApa7,
  extractHtmlMeta,
  formatMetaAsApa7,
  formatCrossrefAsApa7,
  fallbackApa7FromUrl,
  isStandaloneLink,
  normalizeUrl,
};
