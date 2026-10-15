// Run: npm test (from the project root). The rule check of an uploaded PDF: the file and the course details, nothing about its contents yet.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkUpload, readFacts, RULES, PENDING_NOTE } = require('./upload');

const pdf = (pages, extra = '') => '%PDF-1.4\n' + Array.from({ length: pages }, (_, i) => `${i + 1} 0 obj\n<< /Type /Page /Parent 9 0 R >>\nendobj\n`).join('') + '9 0 obj\n<< /Type /Pages /Count ' + pages + ' >>\nendobj\n' + extra + 'trailer\n<< /Root 1 0 R >>\n%%EOF\n';
const withFile = (content, fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upl-'));
  fs.writeFileSync(path.join(dir, 'a.pdf'), content, 'latin1');
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const good = { courseCode: 'FM 202', title: 'Fundamentals of Mathematics', programCode: 'BSFM' };

test('a complete multi-page PDF with its course details scores 100 and conforms', () => withFile(pdf(5), (dir) => {
  const facts = readFacts('/uploads/a.pdf', dir);
  assert.deepStrictEqual([facts.exists, facts.header, facts.ended, facts.encrypted, facts.pages], [true, true, true, false, 5]);
  const r = checkUpload(facts, good);
  assert.strictEqual(r.overall, 100);
  assert.strictEqual(r.status, 'scored');
  assert.strictEqual(r.conformance.ok, true);
  assert.strictEqual(r.findings.length, 0);
  assert.strictEqual(r.passed, true);
}));

test('only Format Compliance is scored; the five form areas are not scored, in the same shape the form check returns', () => withFile(pdf(3), (dir) => {
  const r = checkUpload(readFacts('a.pdf', dir), good);
  assert.deepStrictEqual(r.areas.map((a) => a.key), ['template', 'completeness', 'co_po', 'assessment', 'contact_hours', 'reference_currency']);
  assert.strictEqual(r.areas[0].score, 100);
  assert.ok(r.areas.slice(1).every((a) => a.score === null));
  ['standard', 'status', 'overall', 'band', 'passThreshold', 'passed', 'areas', 'conformance', 'findings'].forEach((k) => assert.ok(k in r, k));
}));

test('a missing file, or one that is not a whole PDF, blocks; a password-protected one is a warning', () => {
  const none = checkUpload(readFacts('/uploads/nope.pdf', os.tmpdir()), good);
  assert.deepStrictEqual(none.findings.map((f) => f.ruleId), ['U-01']);
  assert.strictEqual(none.conformance.ok, false);
  withFile('not a pdf at all', (dir) => {
    const r = checkUpload(readFacts('a.pdf', dir), good);
    assert.ok(r.findings.some((f) => f.ruleId === 'U-02' && f.severity === 'blocking'));
    assert.strictEqual(r.passed, false);
  });
  withFile('%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n', (dir) => { // cut short: no end marker
    assert.ok(checkUpload(readFacts('a.pdf', dir), good).findings.some((f) => f.ruleId === 'U-02'));
  });
  withFile(pdf(4, '5 0 obj\n<< /Encrypt 7 0 R >>\n'), (dir) => {
    const r = checkUpload(readFacts('a.pdf', dir), good);
    assert.deepStrictEqual(r.findings.map((f) => [f.ruleId, f.severity]), [['U-03', 'major']]);
    assert.strictEqual(r.conformance.ok, true); // a warning does not block
  });
});

test('missing course details and a one-page file are advice with their own rule', () => withFile(pdf(1), (dir) => {
  const r = checkUpload(readFacts('a.pdf', dir), { courseCode: '', title: 'x', programCode: '' });
  assert.deepStrictEqual(r.findings.map((f) => f.ruleId).sort(), ['U-04', 'U-05', 'U-06']);
  assert.ok(r.overall < 100);
  assert.strictEqual(r.findings.find((f) => f.ruleId === 'U-06').severity, 'minor');
}));

test('a page count that cannot be read is skipped, not failed', () => withFile('%PDF-1.5\n1 0 obj\n<< /Type /ObjStm >>\nendobj\n%%EOF\n', (dir) => {
  const facts = readFacts('a.pdf', dir);
  assert.strictEqual(facts.pages, null);
  const r = checkUpload(facts, good);
  assert.ok(!r.findings.some((f) => f.ruleId === 'U-06'));
  assert.strictEqual(r.overall, 100);
}));

test('a stored path can never point outside the uploads folder', () => withFile(pdf(2), (dir) => {
  assert.strictEqual(readFacts('../../../etc/passwd', dir).exists, false);
  assert.strictEqual(readFacts('/uploads/../a.pdf', dir).exists, true); // only the file name counts, so it resolves inside the folder
  assert.strictEqual(readFacts('', dir).exists, false);
  assert.strictEqual(readFacts(null, dir).exists, false);
}));

test('every rule is documented once and the note about the template says what was not done', () => {
  assert.strictEqual(new Set(RULES.map((r) => r.id)).size, RULES.length);
  RULES.forEach((r) => { assert.ok(r.message && r.weight > 0 && ['blocking', 'major', 'minor'].includes(r.severity)); });
  assert.match(PENDING_NOTE.text, /not switched on yet/);
  assert.deepStrictEqual(PENDING_NOTE.areas, ['template']);
});
