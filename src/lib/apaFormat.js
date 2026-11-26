// Pure APA 7th edition formatting helpers for client preview (FormPaper.jsx), Step 5 (RefsStep.jsx),
// and Word export (syllabusDocx.js). Zero external dependencies, deterministic, and lossless.

const STANDALONE_URL_RE = /^https?:\/\/[^\s<>"]+$/i;
const STANDALONE_DOI_RE = /^doi\s*:?\s*(10\.\d{4,9}\/[^\s<>"]+)$/i;

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

export function isStandaloneLink(text) {
  const t = String(text ?? '').trim();
  return STANDALONE_URL_RE.test(t) || STANDALONE_DOI_RE.test(t);
}

// Converts a standalone bare URL or doi: link into a valid APA 7th edition citation.
// Non-URL citations are returned unchanged.
export function formatBareLinkAsApa7(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!isStandaloneLink(trimmed)) return trimmed;
  const doiMatch = STANDALONE_DOI_RE.exec(trimmed);
  const urlStr = doiMatch ? 'https://doi.org/' + doiMatch[1].replace(/[.,;)]+$/, '') : trimmed;
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.');
    const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    const site = KNOWN_SITES[host] || (base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Website');
    const segs = u.pathname.split('/').filter(Boolean);
    let title = 'Home';
    if (segs.length) {
      let last = decodeURIComponent(segs[segs.length - 1])
        .replace(/\.(html?|php|aspx?|jsp|pdf)$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if ((!last || /^\d+$/.test(last)) && segs.length >= 2) {
        last = decodeURIComponent(segs[segs.length - 2]).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      }
      if (last) title = last.charAt(0).toUpperCase() + last.slice(1);
    }
    return `${site}. (n.d.). ${title}. ${u.toString()}`;
  } catch {
    return trimmed;
  }
}

// Splits an APA 7th edition reference into plain and italic segments without altering any character.
// Rules applied:
//   - Journal article: italicize "Journal Name, Volume" (keep article title, (Issue), pages, DOI/URL plain).
//   - Edited book chapter ("In ... (Ed.), Book Title (pp. ...)."): italicize Book Title.
//   - Book / Website / Report: italicize the work title (keeping "(2nd ed.)", publisher/site, URL/DOI plain).
//   - Unrecognised / non-APA text: returned as a single plain segment.
export function splitApa7Segments(raw) {
  const text = formatBareLinkAsApa7(raw);
  if (!text) return [];

  const dateRe = /\((?:\d{4}[a-z]?|n\.d\.)(?:,\s*[A-Za-z]+(?:\s+\d{1,2})?)?\)\.\s*/;
  const dateMatch = dateRe.exec(text);
  if (!dateMatch) return [{ text, italic: false }];

  const afterIdx = dateMatch.index + dateMatch[0].length;
  const prefix = text.slice(0, afterIdx);
  const rest = text.slice(afterIdx);
  if (!rest) return [{ text, italic: false }];

  const push = (arr, s, italic) => {
    if (!s) return;
    if (arr.length && arr[arr.length - 1].italic === italic) arr[arr.length - 1].text += s;
    else arr.push({ text: s, italic });
  };

  // 1. Edited book chapter: "... In A. Editor (Ed.), Book title (pp. 1-20). Publisher."
  const chapterRe = /(\bIn\s+[\s\S]+?\(Eds?\.\),\s*)([^.(]+?)(\s*\(pp?\.\s*[^)]+\)\.|\.)/;
  const chap = chapterRe.exec(rest);
  if (chap) {
    const out = [];
    push(out, prefix + rest.slice(0, chap.index) + chap[1], false);
    push(out, chap[2], true);
    push(out, chap[3] + rest.slice(chap.index + chap[0].length), false);
    return out;
  }

  // Find end of first title sentence (a period, ? or ! followed by space or end, ignoring abbreviations like "U.S." or "2nd ed.")
  const titleEndRe = /([.?!])(?:\s+|$)/g;
  let titleEnd = -1;
  let m;
  while ((m = titleEndRe.exec(rest)) !== null) {
    const before = rest.slice(0, m.index + 1);
    if (/\b(?:ed|vol|no|pp?|dr|mr|ms|vs|etc|inc|ltd|st|jr|sr)\.$/i.test(before)) continue;
    titleEnd = m.index;
    break;
  }
  if (titleEnd <= 0) return [{ text, italic: false }];

  const titlePart = rest.slice(0, titleEnd);
  const tail = rest.slice(titleEnd); // starts with "." or "?" or "!"

  // 2. Journal article: after title period, look for "Journal Name, 14(2), 101-118." or "Journal Name, 14, 101-118."
  const journalRe = /^([.?!]\s+)([^.]+?,\s*\d{1,4})(\s*(?:\([^)]+\))?\s*,\s*(?:pp?\.\s*)?(?:\d+\s*[–-]\s*\d+|[A-Za-z]?\d{4,}|Article\s+\w+|e\d+)[\s\S]*|\s*\([^)]+\)\.?[\s\S]*)$/;
  const jour = journalRe.exec(tail);
  if (jour && !/^https?:\/\//i.test(jour[2].trim())) {
    const out = [];
    push(out, prefix + titlePart + jour[1], false);
    push(out, jour[2], true);
    push(out, jour[3], false);
    return out;
  }

  // 3. Book / Website / Report: italicize title (excluding parenthetical edition like "(2nd ed.)" or bracketed format like "[Video]")
  const parenSuffix = /(\s*(?:\([^)]*(?:ed\.|rev\.|vol\.|Report|No\.)[^)]*\)|\[[^\]]+\]))+$/i.exec(titlePart);
  const italicTitle = parenSuffix ? titlePart.slice(0, parenSuffix.index) : titlePart;
  const plainTitleSuffix = parenSuffix ? titlePart.slice(parenSuffix.index) : '';

  if (!italicTitle.trim() || /^https?:\/\//i.test(italicTitle.trim())) {
    return [{ text, italic: false }];
  }

  const out = [];
  push(out, prefix, false);
  push(out, italicTitle, true);
  push(out, plainTitleSuffix + tail, false);
  return out;
}
