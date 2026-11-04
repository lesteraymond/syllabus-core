// Read-only inventory. Credentials are supplied only through the process environment.
const assert = require('node:assert/strict');
(async () => {
  const base = 'http://localhost:3001/api';
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.FILL_EMAIL, password: process.env.FILL_PASSWORD }) });
  assert.equal(login.status, 200, 'Login failed');
  const { user } = await login.json();
  const headers = { Cookie: login.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
  const get = async url => { const response = await fetch(base + url, { headers }); assert.ok(response.ok, `${url}: ${response.status}`); return response.json(); };
  const [courses, syllabi, program] = await Promise.all([get('/courses?program=BSIE&taken=1'), get('/syllabi'), get('/programs/BSIE/outcomes')]);
  console.log(JSON.stringify({ user: { id: user.id, name: user.name }, courses, syllabi: syllabi.filter(s => s.userId === user.id && s.programCode === 'BSIE'), program }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
