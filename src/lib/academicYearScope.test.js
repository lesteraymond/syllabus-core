import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, groupOfPage, defaultSelection, currentOf, yearOptions, normalizeSelection, yearParam, selectionLabel, readStored, writeStored, STORAGE_KEY } from './academicYearScope.js';

const t = (key, params) => (({ 'years.currentTag': 'current', 'subjects.allYears': 'All academic years', 'scope.bothYears': 'Previous and current year', 'scope.currentIs': 'current: {year}' })[key] || key).replace('{year}', params ? params.year : '');
const Y = (label, startYear, isCurrent = false) => ({ label, startYear, isCurrent });
const ALL_YEARS = [Y('2025–2026', 2025), Y('2026–2027', 2026), Y('2027–2028', 2027, true), Y('2028–2029', 2028)];
const FACULTY_YEARS = [Y('2026–2027', 2026), Y('2027–2028', 2027, true)]; // what the server returns to a non-administrator

test('the work queues and the data screens are different groups', () => {
  assert.equal(groupOfPage('review'), GROUPS.queue);
  assert.equal(groupOfPage('ai'), GROUPS.queue);
  for (const page of ['dashboard', 'my-syllabi', 'repository', 'compliance', 'analytics', 'reports', 'courses']) assert.equal(groupOfPage(page), GROUPS.data, page);
  assert.equal(defaultSelection(GROUPS.data), '', 'the data screens follow the current academic year');
  assert.equal(defaultSelection(GROUPS.queue), '', 'the queues start on the current year too (no combined "all" choice is offered)');
});

test('the filter offers the years only, newest first, with the current one tagged: no "all" or "previous and current" choice, for any role', () => {
  const faculty = yearOptions({ years: FACULTY_YEARS, group: 'data', isAdmin: false }, t);
  // `short` is what the closed dropdown shows: the year alone, with no "current" tag (the tag appears only in the open list)
  assert.deepEqual(faculty, [{ value: '', label: '2027–2028 · current', short: '2027–2028' }, { value: '2026–2027', label: '2026–2027', short: '2026–2027' }]);
  const admin = yearOptions({ years: ALL_YEARS, group: 'data', isAdmin: true }, t);
  assert.deepEqual(admin.map((o) => o.label), ['2028–2029', '2027–2028 · current', '2026–2027', '2025–2026']);
  assert.deepEqual(admin.map((o) => o.value), ['2028–2029', '', '2026–2027', '2025–2026']);
});

test('the queues offer the same list: the years only, for every role', () => {
  assert.deepEqual(yearOptions({ years: FACULTY_YEARS, group: 'queue', isAdmin: false }, t).map((o) => o.label), ['2027–2028 · current', '2026–2027']);
  assert.deepEqual(yearOptions({ years: ALL_YEARS, group: 'queue', isAdmin: true }, t).map((o) => o.value), ['2028–2029', '', '2026–2027', '2025–2026']);
  for (const isAdmin of [false, true]) for (const group of ['data', 'queue']) {
    const values = yearOptions({ years: isAdmin ? ALL_YEARS : FACULTY_YEARS, group, isAdmin }, t).map((o) => o.value);
    assert.ok(!values.includes('all'), group + (isAdmin ? ' admin' : ' others') + ': no combined choice');
  }
  assert.deepEqual(yearOptions({ years: [], group: 'data', isAdmin: false }, t), [], 'no years yet: no filter to show');
  assert.deepEqual(yearOptions({ years: [], group: 'queue', isAdmin: false }, t), [], 'the same for the queues');
});

test('a stored selection that is no longer offered falls back to the default of its group', () => {
  const options = yearOptions({ years: FACULTY_YEARS, group: 'data', isAdmin: false }, t);
  assert.equal(normalizeSelection('2026–2027', options, GROUPS.data), '2026–2027');
  assert.equal(normalizeSelection('', options, GROUPS.data), '');
  assert.equal(normalizeSelection('2025–2026', options, GROUPS.data), '', 'the year moved on: the faculty member no longer sees 2025–2026');
  assert.equal(normalizeSelection('all', options, GROUPS.data), '', 'a stored "all" (from before) falls back to the current year');
  const queue = yearOptions({ years: FACULTY_YEARS, group: 'queue', isAdmin: false }, t);
  assert.equal(normalizeSelection('2020–2021', queue, GROUPS.queue), '');
  assert.equal(normalizeSelection('all', queue, GROUPS.queue), '', 'the queues too');
});

test('what the API is asked for: nothing for the current year, otherwise the label or all', () => {
  assert.equal(yearParam(''), undefined);
  assert.equal(yearParam(undefined), undefined);
  assert.equal(yearParam('all'), 'all');
  assert.equal(yearParam('2026–2027'), '2026–2027');
});

test('the selection label names the year a report covers', () => {
  assert.equal(selectionLabel('', FACULTY_YEARS, t), '2027–2028');
  assert.equal(selectionLabel('2026–2027', FACULTY_YEARS, t), '2026–2027');
  assert.equal(selectionLabel('all', FACULTY_YEARS, t), 'All academic years');
  assert.equal(selectionLabel('', [], t), '');
  assert.equal(currentOf(ALL_YEARS).label, '2027–2028');
  assert.equal(currentOf([]), null);
});

test('the choice is remembered per user and a broken store is harmless', () => {
  const store = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; })();
  assert.deepEqual(readStored(store, 5), { data: '', queue: '' });
  writeStored(store, 5, { data: '2026–2027', queue: '2027–2028' });
  writeStored(store, 6, { data: '', queue: 'all' });
  assert.deepEqual(readStored(store, 5), { data: '2026–2027', queue: '2027–2028' });
  assert.deepEqual(readStored(store, 6), { data: '', queue: 'all' });
  store.setItem(STORAGE_KEY, 'not json');
  assert.deepEqual(readStored(store, 5), { data: '', queue: '' });
  assert.doesNotThrow(() => writeStored({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } }, 5, {}));
});
