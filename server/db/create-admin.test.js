'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createAdmin } = require('./create-admin');

function fakeDb(existing = []) {
  const calls = [];
  return { calls, query: async (sql, params) => { calls.push({ sql, params }); if (/^SELECT/.test(sql)) return [existing]; return [{ insertId: 7 }]; } };
}

test('create-admin: stores a bcrypt hash, forces a password change, makes an admin, never stores the password', async () => {
  const db = fakeDb();
  const id = await createAdmin(db, { email: ' Owner@Example.Invalid ', password: 'Temp-Passw0rd-x' });
  assert.equal(id, 7);
  const insert = db.calls.find((c) => /^INSERT INTO users/.test(c.sql));
  assert.match(insert.sql, /must_change_password, role/);
  assert.equal(insert.params[0], 'owner@example.invalid');
  assert.ok(await bcrypt.compare('Temp-Passw0rd-x', insert.params[1]));
  assert.ok(!insert.params.includes('Temp-Passw0rd-x'));
  assert.equal(insert.params[2], 'admin');
});

test('create-admin: refuses a bad email, a weak password, and an existing account (nothing is written)', async () => {
  for (const [args, pattern] of [[{ email: 'nope', password: 'Temp-Passw0rd-x' }, /email address/], [{ email: 'a@b.invalid', password: 'short' }, /at least 8/], [{ email: 'a@b.invalid', password: 'allletters' }, /letter and one number/]]) {
    const db = fakeDb();
    await assert.rejects(() => createAdmin(db, args), pattern);
    assert.ok(!db.calls.some((c) => /^INSERT/.test(c.sql)));
  }
  const db = fakeDb([{ user_id: 1 }]);
  await assert.rejects(() => createAdmin(db, { email: 'a@b.invalid', password: 'Temp-Passw0rd-x' }), /already exists/);
  assert.ok(!db.calls.some((c) => /^INSERT/.test(c.sql)));
});
