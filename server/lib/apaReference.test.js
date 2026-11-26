'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatUrlAsApa7, isStandaloneLink, fallbackApa7FromUrl, extractHtmlMeta } = require('./apaReference');
const { parseReference } = require('./syllabuscheck/references');

test('isStandaloneLink recognizes bare http/https URLs and doi: links, and ignores full citations', () => {
  assert.equal(isStandaloneLink('https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API'), true);
  assert.equal(isStandaloneLink('doi:10.1145/3290605.3300233'), true);
  assert.equal(isStandaloneLink('MDN Web Docs. (2024). Fetch API. https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API'), false);
  assert.equal(isStandaloneLink('Cormen, T. H. (2022). Introduction to algorithms. MIT Press.'), false);
});

test('formats a webpage with author, date, title, and site name into APA 7 that passes parseReference', async () => {
  const html = `<!doctype html><html><head>
    <title>Understanding Async/Await | Tech Blog</title>
    <meta property="og:site_name" content="Tech Blog">
    <meta name="author" content="Jane Marie Doe">
    <meta property="article:published_time" content="2024-05-14T10:00:00Z">
  </head><body></body></html>`;
  const res = await formatUrlAsApa7('https://techblog.example/async-await', {
    fetchHtml: async (u) => ({ html, finalUrl: u }),
  });
  assert.equal(res.source, 'webpage');
  assert.equal(res.citation, 'Doe, J. M. (2024, May 14). Understanding Async/Await. Tech Blog. https://techblog.example/async-await');
  assert.equal(parseReference(res.citation).format.status, 'PASS');
});

test('omits duplicate site name when organization is both author and site (APA 7 rule)', async () => {
  const html = `<!doctype html><html><head>
    <title>Fetch API - Web APIs | MDN Web Docs</title>
    <meta property="og:site_name" content="MDN Web Docs">
    <meta name="date" content="2024-03-01">
  </head><body></body></html>`;
  const res = await formatUrlAsApa7('https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API', {
    fetchHtml: async (u) => ({ html, finalUrl: u }),
  });
  assert.equal(res.citation, 'MDN Web Docs. (2024, March 1). Fetch API - Web APIs. https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API');
  assert.equal(parseReference(res.citation).format.status, 'PASS');
});

test('formats a DOI link using Crossref metadata into APA 7 journal article citation', async () => {
  const work = {
    message: {
      author: [{ family: 'Smith', given: 'Alice B.' }, { family: 'Cruz', given: 'Juan' }],
      issued: { 'date-parts': [[2023]] },
      title: ['Adaptive syllabus compliance checking'],
      'container-title': ['Journal of Computing Education'],
      volume: '14',
      issue: '2',
      page: '101-118',
      DOI: '10.1000/jce.2023.14',
    },
  };
  const res = await formatUrlAsApa7('https://doi.org/10.1000/jce.2023.14', {
    fetchCrossref: async () => work,
    fetchHtml: async () => { throw new Error('should not fetch html when crossref succeeds'); },
  });
  assert.equal(res.source, 'crossref');
  assert.equal(res.citation, 'Smith, A. B., & Cruz, J. (2023). Adaptive syllabus compliance checking. Journal of Computing Education, 14(2), 101-118. https://doi.org/10.1000/jce.2023.14');
  assert.equal(parseReference(res.citation).format.status, 'PASS');
});

test('falls back cleanly to an APA 7 URL citation when the remote site cannot be fetched', async () => {
  const res = await formatUrlAsApa7('https://docs.python.org/3/tutorial/classes.html', {
    fetchHtml: async () => { throw new Error('HTTP 403'); },
  });
  assert.equal(res.source, 'url_fallback');
  assert.equal(res.citation, 'Python Software Foundation. (n.d.). Classes. https://docs.python.org/3/tutorial/classes.html');
  assert.equal(parseReference(res.citation).format.status, 'PASS');
  assert.match(fallbackApa7FromUrl('https://example.org/'), /^Example\. \(n\.d\.\)\. Home\. https:\/\/example\.org\/$/);
});

// The server has one thread: before 2026-11-26 each of the first four pages held it for 3 to 10 seconds.
test('a hostile 200 KB page is read in well under a second, however it is written', () => {
  const KB = 200 * 1024;
  const fill = (unit, around = (s) => s) => around(unit.repeat(Math.ceil(KB / unit.length)).slice(0, KB));
  const pages = {
    'unclosed meta': fill('<meta '), 'unclosed script': fill('<script type '), 'unclosed title': fill('<title>'), 'unclosed time': fill('<time datetime '),
    'script without end': fill('<script type="application/ld+json">'), 'time with an open quote': fill('<time datetime="'),
    'meta with spaces': fill('<meta name' + ' '.repeat(500) + '>'), 'many metas': fill('<meta name=author content=b>'),
    'one long meta': fill('name="', (s) => '<meta ' + s + '>'),
    'dots in the title': fill('.', (s) => '<title>' + s + 'a</title>'), 'quotes in the title': fill('"', (s) => '<title>' + s + 'a</title>'),
    'bars in the title and site': fill('|', (s) => '<meta name="og:site_name" content="' + s + '"><title>' + s + 'a</title>'),
    'dots in JSON-LD': fill('.', (s) => '<script type="application/ld+json">' + JSON.stringify({ headline: s + 'a', datePublished: s, author: [{ name: s }] }) + '</script>'),
    'many JSON-LD authors': '<script type="application/ld+json">' + JSON.stringify({ headline: 'T', author: Array(20000).fill('Ann Lee') }) + '</script>',
    'nested JSON-LD': fill('[', (s) => '<script type="application/ld+json">' + s + '</script>'),
    'entities': fill('&#x', (s) => '<title>' + s + '</title>'),
  };
  for (const [name, html] of Object.entries(pages)) {
    const started = process.hrtime.bigint();
    extractHtmlMeta(html, 'https://example.org/page');
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(ms < 700, name + ': ' + Math.round(ms) + ' ms');
  }
});

test('reads every place a page keeps its author, title and date, and takes only text from them', () => {
  const ld = (o) => '<script>var a = 1 < 2;</script><script async type="application/ld+json">' + JSON.stringify(o) + '</script>';
  const a = extractHtmlMeta(ld({ '@graph': [{ '@type': 'WebSite' }, { headline: 'From JSON', datePublished: '2022-02-03', author: [{ name: 'Ana Cruz' }, 'Ben Lim'] }] }), 'https://example.org/x');
  assert.deepEqual([a.title, a.date, a.authors], ['From JSON', '2022, February 3', ['Ana Cruz', 'Ben Lim']]);
  const b = extractHtmlMeta("<TITLE lang='en'>A &amp; B\n</TITLE><meta content='Ana Cruz' name='author'><time>x</time><time class=y datetime='2021-05-06'>May</time>", 'https://example.org/x');
  assert.deepEqual([b.title, b.date, b.authors], ['A & B', '2021, May 6', ['Ana Cruz']]);
  const c = extractHtmlMeta(ld({ headline: { x: 1 }, datePublished: { y: 2 }, author: [{ name: { z: 3 } }, 7, null], publisher: { name: [] } }) + '<title>Plain</title>', 'https://example.org/x');
  assert.deepEqual([c.title, c.date, c.authors, c.siteName], ['Plain', 'n.d.', ['7'], 'Example']);
  const d = extractHtmlMeta('<title>' + 'word '.repeat(5000) + '</title>', 'https://example.org/x');
  assert.ok(d.title.length <= 500);
});
