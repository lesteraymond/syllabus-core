// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { translate, t } from '../i18n/index.js';
import { approvedRefusalText } from './approvedRefusal.js';
import { createRequire } from 'node:module';
const records = createRequire(import.meta.url)('../../server/lib/approvedRecords.js');

const rows = [{ id: 1, code: 'IT 101', title: 'A' }, { id: 2, code: 'IT 102', title: 'B' }];
const refusals = { syllabus: records.syllabusRefused(), subject: records.subjectRefused(rows), account: records.accountRefused(rows), program: records.programRefused('BSIT', rows) };

test('every refusal reads the same in English as the server wrote it', () => {
  for (const [scope, error] of Object.entries(refusals)) {
    assert.strictEqual(error.body.scope, scope);
    assert.strictEqual(approvedRefusalText(error.body), error.message);
  }
});

test('every refusal has a Filipino text with its count and code filled in', () => {
  assert.strictEqual(translate('hybrid.approvedProtectedSubject', { count: 2 }, 'tl'), 'Hindi mabubura ang asignaturang ito. Mga aprubadong silabus na umaasa rito: 2.');
  assert.strictEqual(translate('hybrid.approvedProtectedAccount', { count: 2 }, 'tl'), 'Hindi mabubura ang account na ito. Mga aprubadong silabus na umaasa rito: 2.');
  assert.strictEqual(translate('programs.blockedByApproved', { code: 'BSIT', count: 2 }, 'tl'), 'Hindi mabubura ang BSIT. Mga aprubadong silabus na umaasa rito: 2.');
  assert.ok(!translate('hybrid.approvedProtectedSyllabus', {}, 'tl').includes('hybrid.'));
  assert.notStrictEqual(translate('hybrid.approvedProtectedSyllabus', {}, 'tl'), t('hybrid.approvedProtectedSyllabus', {}, 'en'));
});

test('anything else is left to the ordinary message', () => {
  assert.strictEqual(approvedRefusalText({ code: 'preview_required', message: 'x' }), null);
  assert.strictEqual(approvedRefusalText({ code: 'approved_records_protected' }), null);
  assert.strictEqual(approvedRefusalText(undefined), null);
});
