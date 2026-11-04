const test = require('node:test');
const assert = require('node:assert/strict');
const { verdictOf } = require('./links');

test('a moved page is penalized as a redirect, but a DOI resolver redirecting to the publisher is a working link', () => {
  assert.equal(verdictOf('beginnersbook.com', 301), 'redirected');
  assert.equal(verdictOf('www.example.org', 302), 'redirected');
  for (const host of ['doi.org', 'DOI.org', 'www.doi.org', 'dx.doi.org']) assert.equal(verdictOf(host, 302), 'ok', host);
  assert.equal(verdictOf('doi.org', 301), 'ok');
});

test('a DOI that does not exist, and every other status, count exactly as before', () => {
  assert.equal(verdictOf('doi.org', 404), 'broken', 'an unknown DOI is a broken link');
  assert.equal(verdictOf('example.org', 200), 'ok');
  assert.equal(verdictOf('doi.org', 200), 'ok');
  assert.equal(verdictOf('example.org', 404), 'broken');
  assert.equal(verdictOf('example.org', 410), 'broken');
  assert.equal(verdictOf('example.org', 403), 'unverifiable');
  assert.equal(verdictOf('doi.org', 500), 'unverifiable');
  assert.equal(verdictOf('lookalike-doi.org.evil.example', 302), 'redirected', 'only the real resolver hosts are exempt');
});
