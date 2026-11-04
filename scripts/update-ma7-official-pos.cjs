// Update only the provisional PO list in the existing faculty test draft.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  assert.ok(process.env.FILL_EMAIL && process.env.FILL_PASSWORD);
  const root = path.resolve(__dirname, '..');
  const base = 'http://localhost:3001/api';
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.FILL_EMAIL, password: process.env.FILL_PASSWORD }) });
  assert.equal(login.status, 200, 'Login failed');
  const headers = { 'Content-Type': 'application/json', Cookie: login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
  const request = async (url, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const value = await response.json(); assert.ok(response.ok, `${url}: ${response.status} ${value.error || value.message || ''}`); return value;
  };
  const id = 101;
  const before = await request(`/syllabi/${id}/content`);
  assert.ok(before.editable && before.status === 'draft');
  assert.equal(before.content.meta.code, 'MA 7');
  assert.equal(before.content.meta.program, 'BSIE');
  const program = await request('/programs/BSIE/outcomes');
  assert.equal(program.pos.length, 13, 'Expected the verified imported BSIE outcome set.');
  const backupDir = path.join(root, '.api-test-backups'); await fs.mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `ma7-before-official-pos-${Date.now()}.json`);
  await fs.writeFile(backup, JSON.stringify(before, null, 2), { flag: 'wx' });
  assert.deepEqual((await request(`/syllabi/${id}/content`)).content, before.content, 'Concurrent edit; refusing overwrite.');
  await request(`/syllabi/${id}/content`, 'PUT', { schemaVersion: 3, sections: { outcomes: { ...before.content.outcomes, pos: program.pos } } });
  const saved = await request(`/syllabi/${id}/content`);
  assert.deepEqual(saved.content.outcomes.pos, program.pos);
  for (const key of ['meta', 'description', 'clos', 'plan', 'reqs', 'refs', 'grading']) assert.deepEqual(saved.content[key], before.content[key], `Unexpected change: ${key}`);
  console.log(JSON.stringify({ saved: true, syllabusId: id, status: saved.status, officialPOs: saved.content.outcomes.pos.length, backup: path.relative(root, backup), submitted: false }));
  const checked = await request(`/syllabi/${id}/compliance/recheck`, 'POST', { force: true });
  assert.deepEqual((await request(`/syllabi/${id}/content`)).content, saved.content, 'Checker changed the draft.');
  const report = { testedAt: new Date().toISOString(), syllabusId: id, run: checked.run, submitted: false, backup: path.relative(root, backup) };
  await fs.writeFile(path.join(root, 'docs/ma7-official-pos-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ runId: checked.run.id, score: checked.run.score, baseScore: checked.run.hybrid?.baseScore, ready: checked.run.hybrid?.ready, alignment: checked.run.hybrid?.alignment, blockers: checked.run.findings.filter(f => f.severity === 'blocking').map(f => ({ ruleId: f.ruleId, message: f.message })) }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
