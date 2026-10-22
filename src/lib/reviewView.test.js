// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { toReviewRow, fileName, versionOption, headline, noFormMessage, programLabel, subjectLabel, canDecide, readyForReview, waitsForCheck, checkDecision, DECISIONS, commentTypeLabel, programTone, toneStyle, PROGRAM_COLORS } from './reviewView.js';
import { readFileSync } from 'node:fs';
import { groupByFacultyProgram, filterRows } from './complianceView.js';

const syl = (id, over = {}) => ({ id, userId: 1, faculty: 'Ana Cruz', programCode: 'BSIT', program: '', courseCode: 'IT 101', courseTitle: 'Intro', title: 'Intro', status: 'submitted', version: 'v1.0', ...over });

test('a list row becomes a grouping row: faculty, program code, subject', () => {
  const r = toReviewRow(syl(7));
  assert.deepStrictEqual([r.syllabusId, r.facultyName, r.programCode, r.programName, r.courseCode, r.courseTitle, r.status, r.version], [7, 'Ana Cruz', 'BSIT', '', 'IT 101', 'Intro', 'submitted', 'v1.0']);
  assert.strictEqual(r.raw.id, 7);
});

test('an old upload with only a curriculum program name is filed under that name; with neither it is "No program"', () => {
  const old = toReviewRow(syl(8, { programCode: '', program: 'BS Information Technology', courseTitle: '' , title: 'Data Analytics' }));
  assert.deepStrictEqual([old.programCode, old.programName, old.courseTitle], ['', 'BS Information Technology', 'Data Analytics']);
  const none = toReviewRow(syl(9, { programCode: '', program: '' }));
  const g = groupByFacultyProgram([old, none]);
  assert.deepStrictEqual(g[0].programs.map((p) => p.name), ['BS Information Technology', 'No program']);
  // a catalog program wins over the curriculum name
  assert.strictEqual(toReviewRow(syl(10, { program: 'Old name' })).programName, '');
});

test('the queue groups by faculty, program and subject, and the search finds a syllabus by any of them', () => {
  const rows = [
    toReviewRow(syl(1, { faculty: 'Ben Reyes', userId: 2, programCode: 'BSIE', courseCode: 'IE 201', courseTitle: 'Work Study' })),
    toReviewRow(syl(2)),
    toReviewRow(syl(3, { courseCode: 'IT 102', courseTitle: 'Networks' })),
  ];
  const g = groupByFacultyProgram(rows);
  assert.deepStrictEqual(g.map((f) => f.facultyName), ['Ana Cruz', 'Ben Reyes']);
  assert.deepStrictEqual(g[0].programs[0].rows.map((r) => r.courseCode), ['IT 101', 'IT 102']);
  const ids = (q) => filterRows(rows, { q }).map((r) => r.syllabusId);
  assert.deepStrictEqual(ids('ben'), [1]);
  assert.deepStrictEqual(ids('bsit networks'), [3]);
  assert.deepStrictEqual(ids('work study'), [1]);
  assert.deepStrictEqual(ids(''), [1, 2, 3]);
});

test('file names, version options and the headline read well', () => {
  assert.strictEqual(fileName('/uploads/syllabi/data-analytics.pdf'), 'data-analytics.pdf');
  assert.strictEqual(fileName('/uploads/My%20File.pdf'), 'My File.pdf');
  assert.strictEqual(fileName('C:\\x\\y.docx'), 'y.docx');
  assert.strictEqual(fileName(null), '');
  assert.strictEqual(versionOption({ label: 'v1.1', statusAtSave: 'submitted', createdAt: '2026-01-02 08:00:00' }, true), 'v1.1 · Submitted · Jan 2, 2026 (current)');
  assert.strictEqual(versionOption({ label: 'v1.0', statusAtSave: 'for_revision', createdAt: 'nonsense' }, false), 'v1.0 · For Revision');
  assert.strictEqual(headline({ facultyName: 'Fay F', programCode: 'BSIT', courseCode: 'IT 204', courseTitle: 'Computer Programming 2' }), 'Fay F · BSIT · IT 204 — Computer Programming 2');
  assert.strictEqual(headline({ facultyName: 'Gus G', programCode: '', programName: 'BS Information Technology', courseCode: 'IT304', courseTitle: 'Data' }), 'Gus G · BS Information Technology · IT304 — Data');
  assert.strictEqual(headline({ facultyName: 'Gus G', programCode: '', programName: 'No program', courseCode: 'X', courseTitle: '' }), 'Gus G · No program · X');
});

test('the modal never goes blank for a syllabus without a form', () => {
  assert.match(noFormMessage('/uploads/a.pdf'), /uploaded file.*Open the file below/);
  assert.match(noFormMessage(null), /no uploaded file stored/);
});

test('a card shows the program and the subject, with sensible fallbacks', () => {
  assert.strictEqual(programLabel({ programCode: 'BSIT', programName: 'BS Information Technology' }), 'BSIT · BS Information Technology');
  assert.strictEqual(programLabel({ programCode: 'BSIT', programName: '' }), 'BSIT');
  assert.strictEqual(programLabel({ programCode: '', programName: 'BS Information Technology' }), 'BS Information Technology');
  assert.strictEqual(programLabel({ programCode: '', programName: '' }), 'No program');
  assert.strictEqual(subjectLabel({ courseCode: 'IT 204', courseTitle: 'Computer Programming 2' }), 'IT 204 — Computer Programming 2');
  assert.strictEqual(subjectLabel({ courseCode: 'IT304', courseTitle: '' }), 'IT304');
  assert.strictEqual(subjectLabel({ courseCode: '', courseTitle: '', title: 'Old upload' }), 'Old upload');
  assert.strictEqual(subjectLabel({}), 'Untitled syllabus');
});

test('only a syllabus waiting for a decision can be decided', () => {
  ['submitted', 'under_review'].forEach((s) => assert.strictEqual(canDecide(s), true, s));
  ['draft', 'approved', 'rejected', 'for_revision', undefined].forEach((s) => assert.strictEqual(canDecide(s), false, String(s)));
});

test('approving needs no reason; returning for revision and rejecting need one of at least 5 characters', () => {
  assert.strictEqual(checkDecision('approve', ''), '');
  assert.strictEqual(checkDecision('approve', undefined), '');
  ['revise', 'reject'].forEach((k) => {
    ['', '   ', 'no', 'four', null, undefined].forEach((n) => assert.notStrictEqual(checkDecision(k, n), '', k + ' / ' + String(n)));
    assert.strictEqual(checkDecision(k, 'Fix it.'), '');
    assert.strictEqual(checkDecision(k, '  12345  '), '');
  });
  assert.match(checkDecision('reject', ''), /why it is rejected/);
  assert.match(checkDecision('revise', ''), /what needs to change/);
  assert.match(checkDecision('nope', 'x'), /Choose a decision/);
});

test('the decisions use the statuses the app already sends, and each asks to be confirmed', () => {
  assert.deepStrictEqual(Object.values(DECISIONS).map((d) => d.status), ['Approved', 'For Revision', 'Rejected']);
  Object.values(DECISIONS).forEach((d) => assert.match(d.confirm, /\?/));
  assert.deepStrictEqual(Object.values(DECISIONS).map((d) => d.reason), [false, true, true]);
});

test('comment types read as labels', () => {
  assert.deepStrictEqual(['comment', 'revision', 'rejection', 'approval', 'x'].map(commentTypeLabel), ['Comment', 'Revision request', 'Rejection', 'Approval', 'Comment']);
});

// ---- program colours
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// a colour at 12% over white, as the card's tinted header shows it
const over = (hex, alpha) => { const n = parseInt(hex.slice(1), 16); const mix = (v) => Math.round(v * alpha + 255 * (1 - alpha)); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join(''); };

test('a program always gets the same colour, whatever its case or spacing, and different programs spread over the palette', () => {
  assert.deepStrictEqual(programTone('BSIT'), programTone('bsit'));
  assert.deepStrictEqual(programTone('BSIT'), programTone('  BSIT '));
  assert.strictEqual(programTone('BSIT').color, programTone('BSIT').color);
  const codes = ['BSIT', 'BSIE', 'BSFM', 'BSEMC', 'BSCS', 'BSA', 'BSN', 'BSBA', 'BSED', 'BSPSY', 'BSCE', 'BSME'];
  const used = new Set(codes.map((c) => programTone(c).index));
  assert.ok(used.size >= 4, 'colours are spread, not all the same: ' + [...used]);
  codes.forEach((c) => assert.ok(PROGRAM_COLORS.includes(programTone(c).color)));
});

test('no program gets a neutral colour, never one of the program colours', () => {
  ['', '   ', null, undefined].forEach((c) => { const t = programTone(c); assert.strictEqual(t.index, -1); assert.ok(!PROGRAM_COLORS.includes(t.color)); });
  assert.deepStrictEqual(toneStyle({ programCode: '', programName: 'No program' }), toneStyle({ programCode: '', programName: '' }));
  assert.deepStrictEqual(toneStyle({ programCode: 'BSIT' }), toneStyle({ programCode: 'bsit', programName: 'x' })); // the code decides
  assert.deepStrictEqual(Object.keys(toneStyle({ programCode: 'BSIT' })), ['--tone', '--tone-soft']);
  assert.notDeepStrictEqual(toneStyle({ programCode: '', programName: 'BS Information Technology' }), toneStyle({ programCode: '', programName: '' })); // an old upload is coloured by its program name
});

test('every program colour is readable as text on white and on its own light tint (4.5:1 or better)', () => {
  [...PROGRAM_COLORS, programTone('').color].forEach((c) => {
    assert.ok(contrast(c, '#ffffff') >= 4.5, c + ' on white: ' + contrast(c, '#ffffff').toFixed(2));
    assert.ok(contrast(c, over(c, 0.12)) >= 4.5, c + ' on its tint: ' + contrast(c, over(c, 0.12)).toFixed(2));
  });
});

test('the decision buttons are readable: the colours in the stylesheet pass 4.5:1', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const token = (name) => { const m = css.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})')); assert.ok(m, name + ' is defined in styles.css'); return m[1]; };
  assert.ok(contrast(token('rv-approve-ink'), token('rv-approve')) >= 4.5, 'approve: white on green');
  assert.ok(contrast(token('rv-revise'), token('rv-revise-bg')) >= 4.5, 'return: amber text on its fill');
  assert.ok(contrast(token('rv-reject'), token('rv-reject-bg')) >= 4.5, 'reject: red text on its fill');
});

test('every decision has a label, a hint and an icon the app has', () => {
  Object.values(DECISIONS).forEach((d) => { assert.ok(d.label && d.hint && d.icon); });
  assert.deepStrictEqual(Object.values(DECISIONS).map((d) => d.icon), ['approved', 'revise', 'denied']);
});

test('a submission is on the review board only after the administrator checked it; until then it waits for the AI Checker', () => {
  const waiting = { status: 'submitted', awaitingAiCheck: true };
  const checked = { status: 'submitted', awaitingAiCheck: false };
  assert.strictEqual(waitsForCheck(waiting), true);
  assert.strictEqual(readyForReview(waiting), false);
  assert.strictEqual(waitsForCheck(checked), false);
  assert.strictEqual(readyForReview(checked), true);
  assert.strictEqual(readyForReview({ status: 'under_review' }), true); // no flag (an older list, or nothing to check): not held back
  assert.strictEqual(readyForReview({ status: 'approved', awaitingAiCheck: false }), false); // decided syllabi are not pending
  assert.strictEqual(readyForReview({ status: 'for_revision' }), false); // with the faculty member
  assert.strictEqual(waitsForCheck(null), false);
});
