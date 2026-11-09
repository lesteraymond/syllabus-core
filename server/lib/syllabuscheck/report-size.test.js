'use strict';
// A checking report is stored with ONE statement, so it must fit the database's max_allowed_packet. When it does not, the author gets a plain, actionable error
// (HTTP 507, code report_too_large) and nothing is stored, instead of a bare "read ECONNRESET" from a dropped connection.
const test = require('node:test'), assert = require('node:assert/strict');
const repo = require('./repository');

const report = (bytes) => ({ overall: 90, passed: true, hybrid: { padding: 'x'.repeat(bytes) } });
function fakeDb({ limit, failWith, noLimitQuery } = {}) {
  const inserts = [];
  return {
    inserts,
    query: async (sql, params) => {
      if (/@@max_allowed_packet/.test(sql)) { if (noLimitQuery) throw new Error('not supported'); return [[{ limit_bytes: limit }]]; }
      if (/^INSERT INTO syllabus_check_reports/.test(sql)) { if (failWith) throw failWith; inserts.push(params); return [{}]; }
      throw new Error('unexpected query: ' + sql);
    },
  };
}
const MB = 1024 * 1024;

test('a report that fits is stored as before', async () => {
  const db = fakeDb({ limit: 16 * MB });
  await repo.saveReport(db, 7, report(200000), 'fp');
  assert.equal(db.inserts.length, 1);
  assert.equal(db.inserts[0][0], 7);
});

test('a report that cannot fit the limit is refused BEFORE the INSERT with a clear 507, and says what to change', async () => {
  const db = fakeDb({ limit: 1 * MB });
  await assert.rejects(repo.saveReport(db, 7, report(1000 * 1000), 'fp'), (e) => {
    assert.equal(e.status, 507);
    assert.equal(e.body.code, 'report_too_large');
    assert.equal(e.body.limitBytes, 1 * MB);
    assert.ok(e.body.packetBytes > 1 * MB && e.body.reportBytes >= 1000 * 1000);
    assert.equal(e.body.requiredMinimumBytes, 16 * MB);
    assert.match(e.message, /too large for this database to store/);
    assert.match(e.message, /max_allowed_packet to at least 16\.00 MB/);
    assert.match(e.message, /Nothing was saved/);
    assert.ok(!/ECONNRESET/.test(e.message));
    return true;
  });
  assert.equal(db.inserts.length, 0, 'no statement was sent');
});

test('the server refusing the packet itself is reported the same way, even when the limit could not be read', async () => {
  const db = fakeDb({ noLimitQuery: true, failWith: Object.assign(new Error('Got a packet bigger than max_allowed_packet bytes'), { code: 'ER_NET_PACKET_TOO_LARGE' }) });
  await assert.rejects(repo.saveReport(db, 7, report(1000), 'fp'), (e) => e.status === 507 && e.body.code === 'report_too_large');
});

test('a dropped connection is blamed on the size only when the report really was near the limit; an unrelated reset is passed through untouched', async () => {
  const reset = () => Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
  await assert.rejects(repo.saveReport(fakeDb({ limit: 1 * MB, failWith: reset() }), 7, report(900 * 1000), 'fp'), (e) => e.status === 507 && e.body.code === 'report_too_large', 'near the limit: the size is the explanation');
  await assert.rejects(repo.saveReport(fakeDb({ limit: 16 * MB, failWith: reset() }), 7, report(900 * 1000), 'fp'), (e) => e.code === 'ECONNRESET' && !e.body, 'far below the limit: a genuine network problem stays what it is');
});

test('if the limit cannot be read the INSERT is simply attempted', async () => {
  const db = fakeDb({ noLimitQuery: true });
  await repo.saveReport(db, 7, report(1000), 'fp');
  assert.equal(db.inserts.length, 1);
});

test('the Policy V2 preview guard is unchanged', async () => {
  await assert.rejects(repo.saveReport(fakeDb({ limit: 16 * MB }), 7, { mode: 'preview', evaluationPolicy: { id: 'academic-evaluation-v2-preview-1' }, hybrid: {} }, 'fp').then(() => { throw new Error('stored a preview'); }), (e) => e.message !== 'stored a preview');
});
