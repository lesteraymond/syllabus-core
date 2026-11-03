// Test-only isolation for existing catalog/storage/recommendation tests. They test the
// layer AFTER mandatory verification. Real gates are covered by engine/gates tests.
const test = require('node:test');
module.exports = function isolateVerifiedPrecondition() {
  const svc = require('../compliance/service');
  const repo = require('./repository');
  test.mock.method(svc, 'requireHybrid', async () => undefined);
  test.mock.method(repo, 'readReport', async () => null);
  test.mock.method(svc, 'checkHybrid', async (db, content) => svc.check(content, { catalog: await require('../../routes/syllabusContent').catalogSnapshot(db, content) }));
};
module.exports.realRequireHybrid = require('../compliance/service').requireHybrid;
