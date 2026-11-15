'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./testSyllabus');
const { extract } = require('./extract');
const { check } = require('./check');
const { lookupReferences, findingsOf, isbnOf, openLibraryFetch } = require('./lookup');

const YEAR = 2026;
const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
// A fake network: answers by URL, records every URL asked. Nothing leaves the machine.
function fakeFetch(routes) {
  const asked = [];
  const fn = async url => { asked.push(url); for (const [pattern, reply] of routes) if (pattern.test(url)) return typeof reply === 'function' ? reply(url) : reply; return json(404, {}); };
  fn.asked = asked;
  return fn;
}
const okLink = async url => ({ url, status: 'ok' });
function withRefs(items) {
  const c = T.conforming();
  c.refs = { books: { na: false, items: items.map((t, i) => ({ id: 'b' + (i + 1), t })) }, program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] } };
  return c;
}
const lookup = (items, fetchImpl, urlChecker = okLink) => lookupReferences(extract(withRefs(items)), { fetchImpl, urlChecker, year: YEAR });

test('a DOI is verified on Crossref when the title matches; a DOI for another work goes to review; an unknown DOI is "not found", never "fake"', async () => {
  const article = 'Smith, J., & Lee, K. (2023). Teaching Java with pair programming. Journal of Computing Education, 12(3), 1-10. https://doi.org/10.1234/jce.2023.5';
  const match = fakeFetch([[/api\.crossref\.org/, json(200, { message: { title: ['Teaching Java with Pair Programming'] } })]]);
  assert.equal((await lookup([article], match))[0].status, 'verified');
  const other = fakeFetch([[/api\.crossref\.org/, json(200, { message: { title: ['Soil chemistry of rice paddies'] } })]]);
  const mismatched = await lookup([article], other);
  assert.equal(mismatched[0].status, 'mismatch');
  assert.deepEqual(findingsOf(mismatched).map(f => [f.rule, f.severity]), [['REF-EXISTS', 'review']]);
  const missing = await lookup([article], fakeFetch([]));
  assert.equal(missing[0].status, 'not_found');
  assert.doesNotMatch(JSON.stringify(findingsOf(missing)), /fake|invented|fabricated/i);
});

test('an ISBN is checked on Open Library; a book without one is searched by title and first author only', async () => {
  const isbnBook = 'Balti, H., & Galloway, A. (2021). Job ready Java. John Wiley & Sons. ISBN 978-1-119-77513-3';
  assert.equal(isbnOf(isbnBook), '9781119775133');
  const byIsbn = fakeFetch([[/openlibrary\.org\/isbn\/9781119775133\.json/, json(200, { title: 'Job Ready Java' })]]);
  assert.equal((await lookup([isbnBook], byIsbn))[0].status, 'verified');

  const plain = 'Balti, H., & Galloway, A. (2021). Job ready Java. John Wiley & Sons.';
  const search = fakeFetch([[/openlibrary\.org\/search\.json/, json(200, { docs: [{ title: 'Job Ready Java' }] })]]);
  assert.equal((await lookup([plain], search))[0].status, 'verified');
  const url = new URL(search.asked[0]);
  assert.deepEqual([...url.searchParams.keys()].sort(), ['author', 'fields', 'limit', 'title']);
  assert.equal(url.searchParams.get('author'), 'Balti');
});

test('a broken link is a finding; a link that cannot be confirmed is not; a lookup failure is "not verified"', async () => {
  const web = 'Oracle. (2024). The Java tutorials. https://docs.oracle.com/javase/tutorial/';
  const broken = await lookup([web], fakeFetch([]), async u => ({ url: u, status: 'broken', reason: 'HTTP 404' }));
  assert.deepEqual(findingsOf(broken).map(f => [f.rule, f.severity]), [['REF-LINK', 'finding']]);
  const unsure = await lookup([web], fakeFetch([]), async u => ({ url: u, status: 'unverifiable' }));
  assert.equal(unsure[0].status, 'not_verified');
  assert.deepEqual(findingsOf(unsure), []);
  const down = fakeFetch([[/./, () => { throw new Error('network down'); }]]);
  const failed = await lookup(['Balti, H., & Galloway, A. (2021). Job ready Java. John Wiley & Sons.'], down);
  assert.equal(failed[0].status, 'not_verified');
  assert.match(failed[0].detail, /lookup failed: network down/);
});

test('only Crossref and Open Library are ever asked, and only with the reference text', async () => {
  await assert.rejects(openLibraryFetch('https://example.org/isbn/1.json', fakeFetch([])), /only Open Library/);
  const f = fakeFetch([]);
  await lookup(['Balti, H., & Galloway, A. (2021). Job ready Java. John Wiley & Sons.', 'Smith, J. (2023). A title. Journal, 1(1), 1-2. https://doi.org/10.1/x'], f);
  assert.ok(f.asked.every(u => /^https:\/\/(api\.crossref\.org|openlibrary\.org)\//.test(u)));
  assert.ok(f.asked.every(u => !/IT%20204|Computer%20Programming|BSIT/i.test(u)), 'no course or person data');
});

test('check() runs the lookups only when asked, and a broken link becomes a misalignment the author fixes', async () => {
  const c = withRefs(['Oracle. (2024). The Java tutorials. https://docs.oracle.com/javase/tutorial/']);
  const plain = await check(c, null, { ask: T.scriptedJudge(), year: YEAR });
  assert.equal(plain.lookups, null);
  const looked = await check(c, null, { ask: T.scriptedJudge(), year: YEAR, lookup: { fetchImpl: fakeFetch([]), urlChecker: async u => ({ url: u, status: 'broken' }) } });
  assert.ok(looked.misalignments.some(m => m.rule === 'REF-LINK'));
});
