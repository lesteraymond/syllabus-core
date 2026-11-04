// Check the existing faculty BSIE draft and verify that checking does not edit it.
// Never submits, approves or changes syllabus content.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
async function main() {
  assert.ok(process.env.FILL_EMAIL && process.env.FILL_PASSWORD, 'Supply FILL_EMAIL and FILL_PASSWORD');
  const base = 'http://localhost:3001/api';
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.FILL_EMAIL, password: process.env.FILL_PASSWORD }) });
  assert.equal(login.status, 200);
  const { user } = await login.json();
  const headers = { 'Content-Type': 'application/json', Cookie: login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
  const request = async (url, body) => {
    const response = await fetch(base + url, { headers, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.ok(response.ok, `${url}: HTTP ${response.status}: ${data.error}`);
    return data;
  };
  const target = (await request('/syllabi')).find(s => s.id === 100 && s.userId === user.id && s.programCode === 'BSIE' && s.status === 'draft');
  assert.ok(target, 'Expected the existing faculty BSIE test draft');
  const before = await request('/syllabi/100/content');
  const checked = await request('/syllabi/100/compliance/recheck', { force: true });
  assert.equal(checked.run.hybrid.version, 'hybrid-1');
  assert.equal(checked.run.hybrid.ready, false, 'Missing official references must not enable submission');
  const stored = await request('/syllabi/100/compliance');
  assert.equal(stored.run.id, checked.run.id);
  assert.deepEqual(stored.run.hybrid, checked.run.hybrid);
  const after = await request('/syllabi/100/content');
  assert.deepEqual(after, before, 'Checking must preserve draft content and status');
  const summary = { testedAt: new Date().toISOString(), syllabusId: 100, runId: stored.run.id, score: stored.run.score, ready: stored.run.hybrid.ready, alignment: stored.run.hybrid.alignment, deductions: stored.run.hybrid.deductions, hardFailures: stored.run.findings.filter(f => f.severity === 'blocking').map(f => f.message), reportPersisted: true, draftUnchanged: true, submitted: false };
  await fs.writeFile(path.resolve(__dirname, '../docs/bsie-hybrid-api-result.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
