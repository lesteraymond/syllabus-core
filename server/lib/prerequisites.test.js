'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPrerequisites, describe } = require('./prerequisites');

test('prerequisites come back in printed order, a link showing the subject\'s code as it is now', async () => {
  const db = { query: async (sql, params) => {
    assert.deepEqual(params, [[7, 8, 9]]);
    return [[
      { course_id: 7, position: 1, prereq_course_id: 3, label: 'IT 202', code: 'IT 202', title: 'Computer Programming 1' },
      { course_id: 7, position: 2, prereq_course_id: null, label: '3rd Yr', code: null, title: null },
      { course_id: 8, position: 1, prereq_course_id: null, label: 'None', code: null, title: null },
    ]];
  } };
  const map = await loadPrerequisites(db, [7, 8, 9]);
  assert.deepEqual(map.get(7), [
    { position: 1, courseId: 3, code: 'IT 202', title: 'Computer Programming 1', label: 'IT 202' },
    { position: 2, courseId: null, code: '3rd Yr', title: '', label: '3rd Yr' },
  ]);
  assert.equal(describe(map.get(7)).prerequisiteText, 'IT 202 – Computer Programming 1; 3rd Yr');
  assert.equal(describe(map.get(8)).prerequisiteText, 'None');
  assert.equal(describe(map.get(9)).prerequisiteText, null); // nothing set for this one
  assert.deepEqual(describe(undefined), { prerequisites: [], prerequisiteText: null });
});

test('before the migration has run there are simply no prerequisites; any other failure is not hidden', async () => {
  const missing = { query: async () => { throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); } };
  assert.equal((await loadPrerequisites(missing, [1])).size, 0);
  const broken = { query: async () => { throw new Error('disk full'); } };
  await assert.rejects(loadPrerequisites(broken, [1]), /disk full/);
  assert.equal((await loadPrerequisites({ query: async () => { throw new Error('not called'); } }, [])).size, 0);
});
