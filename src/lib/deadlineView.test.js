import test from 'node:test';
import assert from 'node:assert/strict';
import { termOf, splitTerm, schoolYearOptions, toInputValue, fromInputValue, toDayValue, fromDayValue, phDayOf, currentDeadline, chipTone, isSettled, reminderToast, submittedCount, groupByCourse, SEMESTERS, SEMESTER_KEYS } from './deadlineView.js';

test('a term is stored as English text built from two choices, and splits back into them', () => {
  assert.equal(termOf('2026-2027', '1st Semester'), '2026-2027 · 1st Semester');
  assert.deepEqual(splitTerm('2026-2027 · 2nd Semester'), { schoolYear: '2026-2027', semester: '2nd Semester' });
  assert.equal(splitTerm('Fall 2026'), null, 'free text from elsewhere is not forced into the lists');
  assert.equal(splitTerm(undefined), null);
  assert.ok('2026-2027 · Summer'.length <= 30 && termOf('2026-2027', '2nd Semester').length <= 30, 'it fits the 30 characters the server allows');
  assert.deepEqual(Object.keys(SEMESTER_KEYS), SEMESTERS, 'every semester has a translation key');
});

test('the school year choices run from last year to two years ahead', () => {
  assert.deepEqual(schoolYearOptions(2026), ['2025-2026', '2026-2027', '2027-2028', '2028-2029']);
});

test('the date and time fields always hold Philippine time, whatever the computer\'s clock', () => {
  assert.equal(toInputValue('2026-10-30T08:00:00.000Z'), '2026-10-30T16:00');
  assert.equal(fromInputValue('2026-10-30T16:00'), '2026-10-30T08:00:00.000Z');
  assert.equal(fromInputValue(toInputValue('2026-12-31T16:30:00.000Z')), '2026-12-31T16:30:00.000Z', 'it round-trips');
  assert.equal(toInputValue('2026-10-30T16:30:00.000Z'), '2026-10-31T00:30', 'half past midnight in Manila is the next day');
  assert.equal(fromInputValue(''), null);
  assert.equal(fromInputValue('2026-13-45T99:99'), null);
  assert.equal(toInputValue('not a date'), '');
});

test('a day field means midnight in Manila', () => {
  assert.equal(fromDayValue('2026-10-14'), '2026-10-13T16:00:00.000Z');
  assert.equal(toDayValue('2026-10-13T16:00:00.000Z'), '2026-10-14');
  assert.equal(fromDayValue('14/10/2026'), null);
  assert.equal(phDayOf(Date.UTC(2026, 9, 14, 15, 59)), '2026-10-14');
  assert.equal(phDayOf(Date.UTC(2026, 9, 14, 16, 0)), '2026-10-15');
});

const NOW = Date.UTC(2026, 9, 14, 2, 0, 0);
const at = (days) => new Date(NOW + days * 86400000).toISOString();

test('a subject\'s row shows the soonest deadline still ahead, or else the most recent one that has passed', () => {
  assert.equal(currentDeadline([], NOW), null);
  assert.equal(currentDeadline(null, NOW), null);
  const list = [{ id: 1, dueAt: at(-30) }, { id: 2, dueAt: at(40) }, { id: 3, dueAt: at(5) }, { id: 4, dueAt: at(-2) }];
  assert.equal(currentDeadline(list, NOW).id, 3);
  assert.equal(currentDeadline([{ id: 1, dueAt: at(-30) }, { id: 4, dueAt: at(-2) }], NOW).id, 4);
});

test('the chip is red when someone missed it, green when everyone has submitted, and says so when nobody is assigned', () => {
  const d = (summary, dueAt = at(10)) => ({ summary, dueAt });
  assert.equal(chipTone(d({ total: 0, submitted: 0, late: 0, waiting: 0, failed: 0 }), NOW), 'none');
  assert.equal(chipTone(d({ total: 3, submitted: 1, late: 0, waiting: 1, failed: 1 }), NOW), 'failed');
  assert.equal(chipTone(d({ total: 3, submitted: 2, late: 1, waiting: 0, failed: 0 }), NOW), 'done');
  assert.equal(chipTone(d({ total: 3, submitted: 1, late: 0, waiting: 2, failed: 0 }, at(0.2)), NOW), 'due_today');
  assert.equal(chipTone(d({ total: 3, submitted: 1, late: 0, waiting: 2, failed: 0 }), NOW), 'upcoming');
  assert.equal(chipTone({ dueAt: at(1) }, NOW), 'none', 'a deadline with no numbers yet is treated as nobody assigned');
  assert.equal(submittedCount({ submitted: 2, late: 1 }), 3);
  assert.equal(submittedCount(undefined), 0);
});

test('deadlines are grouped by subject and keep their order', () => {
  const grouped = groupByCourse([{ id: 1, courseId: 10 }, { id: 2, courseId: 20 }, { id: 3, courseId: 10 }]);
  assert.deepEqual(grouped.get(10).map((x) => x.id), [1, 3]);
  assert.deepEqual(grouped.get(20).map((x) => x.id), [2]);
  assert.equal(grouped.get(99), undefined);
  assert.equal(groupByCourse(undefined).size, 0);
});

import { dueParts, sortForFaculty, sortForAdmin, deadlineOfSyllabus, deadlineForCard } from './deadlineView.js';

test('the date box shows the Philippine day and the short month', () => {
  assert.deepEqual(dueParts('2026-10-30T08:00:00.000Z', 'en'), { day: '30', month: 'Oct' });
  assert.deepEqual(dueParts('2026-10-30T16:30:00.000Z', 'en'), { day: '31', month: 'Oct' }, '00:30 the next day in Manila');
  assert.deepEqual(dueParts('2026-12-31T17:00:00.000Z', 'en'), { day: '01', month: 'Jan' }, 'across a year end');
  assert.deepEqual(dueParts('nope'), { day: '', month: '' });
});

test('a faculty member sees what has failed first, then what is due, then what is in', () => {
  const list = [
    { id: 1, status: 'submitted', dueAt: at(-3) }, { id: 2, status: 'upcoming', dueAt: at(9) }, { id: 3, status: 'failed', dueAt: at(-1) },
    { id: 4, status: 'upcoming', dueAt: at(2) }, { id: 5, status: 'due_today', dueAt: at(0.2) }, { id: 6, status: 'submitted_late', dueAt: at(-8) },
  ];
  assert.deepEqual(sortForFaculty(list).map((x) => x.id), [3, 5, 4, 2, 6, 1]);
  assert.deepEqual(list.map((x) => x.id), [1, 2, 3, 4, 5, 6], 'the original list is not reordered');
});

test('an administrator sees the subjects where someone missed the deadline first, then the soonest, and finished ones last', () => {
  const s = (failed, waiting, submitted, total) => ({ total, failed, waiting, submitted, late: 0 });
  const list = [
    { id: 1, summary: s(0, 0, 2, 2), dueAt: at(-5) }, { id: 2, summary: s(0, 2, 0, 2), dueAt: at(20) }, { id: 3, summary: s(1, 0, 1, 2), dueAt: at(-1) },
    { id: 4, summary: s(0, 1, 1, 2), dueAt: at(4) }, { id: 5, summary: s(0, 0, 0, 0), dueAt: at(1) },
  ];
  assert.deepEqual(sortForAdmin(list, NOW).map((x) => x.id), [3, 4, 2, 1, 5]);
});

test('a syllabus finds the deadline of its own subject, and none without a subject', () => {
  const deadlines = [{ id: 1, courseId: 10, dueAt: at(-30) }, { id: 2, courseId: 10, dueAt: at(5) }, { id: 3, courseId: 20, dueAt: at(3) }];
  assert.equal(deadlineOfSyllabus(deadlines, { courseId: 10 }, NOW).id, 2);
  assert.equal(deadlineOfSyllabus(deadlines, { courseId: 20 }, NOW).id, 3);
  assert.equal(deadlineOfSyllabus(deadlines, { courseId: 99 }, NOW), null);
  assert.equal(deadlineOfSyllabus(deadlines, { courseId: null }, NOW), null);
  assert.equal(deadlineOfSyllabus(undefined, { courseId: 10 }, NOW), null);
});

test('a draft card never says Submitted, whatever the faculty member sent for the subject before; other cards and other states are untouched', () => {
  const dl = (status) => [{ id: 1, courseId: 9, dueAt: at(5), status }];
  assert.equal(deadlineForCard(dl('submitted'), { courseId: 9, status: 'draft' }, NOW), null);
  assert.equal(deadlineForCard(dl('submitted_late'), { courseId: 9, status: 'draft' }, NOW), null);
  for (const status of ['upcoming', 'due_today', 'failed']) assert.equal(deadlineForCard(dl(status), { courseId: 9, status: 'draft' }, NOW).status, status, status + ' still shows on a draft');
  for (const status of ['submitted', 'under_review', 'for_revision', 'approved']) assert.equal(deadlineForCard(dl('submitted'), { courseId: 9, status }, NOW).status, 'submitted', status + ' card keeps it');
  assert.equal(deadlineForCard(dl('submitted'), { courseId: null, status: 'draft' }, NOW), null, 'no subject, no deadline');
  assert.equal(deadlineForCard(dl('upcoming'), { courseId: 9, status: 'approved', archived: true }, NOW), null, 'an archived record carries no deadline');
});

test('a deadline is settled when faculty are assigned and every one has submitted', () => {
  const dl = (summary) => ({ dueAt: new Date(NOW + 86400000 * 3).toISOString(), summary });
  assert.equal(isSettled(dl({ total: 3, submitted: 2, late: 1, waiting: 0, failed: 0 })), true);
  assert.equal(isSettled(dl({ total: 3, submitted: 2, late: 0, waiting: 1, failed: 0 })), false);
  assert.equal(isSettled(dl({ total: 0, submitted: 0, late: 0, waiting: 0, failed: 0 })), false);
});

test('the reminder toast names the person, counts a group, and says why when nobody was reminded', () => {
  assert.deepEqual(reminderToast({ sent: 1, skipped: [] }, ['Fay Cruz']), { key: 'deadline.toastSentOne', values: { name: 'Fay Cruz' } });
  assert.deepEqual(reminderToast({ sent: 3, skipped: [] }, []), { key: 'deadline.toastSent', values: { count: 3 } });
  assert.deepEqual(reminderToast({ sent: 2, skipped: [{ reason: 'submitted' }] }, []), { key: 'deadline.toastSent', values: { count: 2 } }, 'someone was reminded: say so');
  assert.equal(reminderToast({ sent: 0, skipped: [{ reason: 'cooldown' }] }, ['Fay']).key, 'deadline.toastCooling');
  assert.equal(reminderToast({ sent: 0, skipped: [{ reason: 'submitted' }] }, []).key, 'deadline.toastSubmitted');
  assert.equal(reminderToast({ sent: 0, skipped: [] }, []).key, 'deadline.remindNobody');
  assert.equal(reminderToast(undefined).key, 'deadline.remindNobody');
});
