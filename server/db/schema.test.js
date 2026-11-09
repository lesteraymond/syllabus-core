'use strict';
// server/db/init.js runs schema.sql and seed.sql by splitting them on ';'. A semicolon inside a comment therefore cuts a statement in half and the whole bootstrap fails on a
// fresh database (it did: a comment at schema.sql:319). This test applies the same split and requires every piece to be a real statement.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['schema.sql', 'seed.sql']) {
  test(`${file}: splitting on ";" (as init.js does) yields only whole statements`, () => {
    const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const pieces = text.split(';').filter((s) => s.trim());
    assert.ok(pieces.length > 0);
    for (const piece of pieces) {
      const code = piece.split(/\r?\n/).filter((line) => !/^\s*--/.test(line)).join('\n').trim();
      assert.match(code, /^(CREATE|ALTER|INSERT|UPDATE|DROP|SET|USE)\b/i, `a piece of ${file} is not a statement (a ";" in a comment?): ${code.slice(0, 80)}`);
    }
  });
}
