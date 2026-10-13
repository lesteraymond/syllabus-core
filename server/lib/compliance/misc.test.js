// Run: npm test (from the project root). Small pieces the compliance routes rely on.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { createLimiter } = require('../rateLimit');
const { schoolYearStart, FALLBACK_START_YEAR } = require('../schoolYear');
const { httpError } = require('../http');

test('the limiter allows max calls per window per key, then says how long to wait, then resets', () => {
  let t = 1000;
  const l = createLimiter({ max: 3, windowMs: 60000, now: () => t });
  for (let i = 0; i < 3; i++) assert.deepStrictEqual(l.take('a'), { ok: true });
  const blocked = l.take('a');
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.retryAfterSec, 60);
  assert.deepStrictEqual(l.take('b'), { ok: true }); // another key is separate
  t += 30000;
  assert.strictEqual(l.take('a').retryAfterSec, 30);
  t += 30000;
  assert.deepStrictEqual(l.take('a'), { ok: true }); // a new window
  l.reset();
  assert.deepStrictEqual(l.take('b'), { ok: true });
});

test('the server school year matches the one the builder uses, unless SCHOOL_YEAR_START overrides it', () => {
  const client = fs.readFileSync(path.join(__dirname, '../../../src/lib/schoolYear.js'), 'utf8');
  assert.strictEqual(Number(client.match(/startYear:\s*(\d{4})/)[1]), FALLBACK_START_YEAR);
  const saved = process.env.SCHOOL_YEAR_START;
  try {
    delete process.env.SCHOOL_YEAR_START;
    assert.strictEqual(schoolYearStart(), FALLBACK_START_YEAR);
    process.env.SCHOOL_YEAR_START = '2030';
    assert.strictEqual(schoolYearStart(), 2030);
    process.env.SCHOOL_YEAR_START = 'soon';
    assert.strictEqual(schoolYearStart(), FALLBACK_START_YEAR);
  } finally {
    if (saved === undefined) delete process.env.SCHOOL_YEAR_START; else process.env.SCHOOL_YEAR_START = saved;
  }
});

test('an http error can carry extra fields next to the message', () => {
  const e = httpError(409, 'nope', { failed: [1] });
  assert.deepStrictEqual([e.status, e.message, e.body], [409, 'nope', { failed: [1] }]);
  assert.strictEqual(httpError(404, 'x').body, undefined);
});
