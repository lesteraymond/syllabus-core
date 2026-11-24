import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, buildFacultySyllabiCsv, buildAdminComplianceCsv, buildAllFacultySyllabiCsv, buildRepositoryCsv } from './reportCsv.js';

test('csvCell escapes quotes, commas, newlines and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('Plain text'), 'Plain text');
  assert.equal(csvCell('Hello, "World"'), '"Hello, ""World"""');
  assert.equal(csvCell('Line 1\nLine 2'), 'Line 1 Line 2');
  assert.equal(csvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(csvCell('+cmd'), "'+cmd");
});

test('buildFacultySyllabiCsv formats all syllabus columns cleanly', () => {
  const csv = buildFacultySyllabiCsv([
    {
      courseCode: 'IT-204',
      title: 'Programming 2, Intermediate',
      program: 'BSIT',
      academicYear: '2026–2027',
      version: 'v1.0',
      statusLabel: 'Approved',
      score: 96,
      standing: 'Meets standard',
      findingsCount: 0,
      findingsSummary: 'None',
      updatedAt: 'Nov 21, 2026',
    },
  ]);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Course Code,Course Title,Program,Academic Year,Version,Status,AI Score \(%\),Compliance Standing,Findings Count,Findings Summary,Last Updated$/);
  assert.ok(lines[1].includes('"Programming 2, Intermediate"'));
  assert.ok(lines[1].includes(',Approved,96,Meets standard,0,None,'));
});

test('buildAdminComplianceCsv includes faculty breakdown and TOTAL summary row', () => {
  const csv = buildAdminComplianceCsv([
    { name: 'Jp Del Rosario', total: 5, approved: 1, pending: 3, rate: 20 },
    { name: 'Ana Cruz', total: 5, approved: 5, pending: 0, rate: 100 },
  ], { academicYear: '2026–2027' });
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 4);
  assert.equal(lines[3], 'TOTAL,2026–2027,10,6,3,60');
});

test('buildAllFacultySyllabiCsv includes Faculty column and full syllabus compliance fields', () => {
  const csv = buildAllFacultySyllabiCsv([
    {
      faculty: 'Jp Del Rosario',
      courseCode: 'IT-204',
      title: 'Programming 2',
      program: 'BSIT',
      academicYear: '2026–2027',
      version: 'v1.0',
      statusLabel: 'Approved',
      score: 96,
      standing: 'Meets standard',
      findingsCount: 0,
      findingsSummary: 'No findings',
      updatedAt: 'Nov 21, 2026',
    },
  ]);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Faculty,Course Code,Course Title,Program,Academic Year,Version,Status,AI Score \(%\),Compliance Standing,Findings Count,Findings Summary,Last Updated$/);
  assert.ok(lines[1].startsWith('Jp Del Rosario,IT-204,Programming 2,BSIT,'));
});

test('buildRepositoryCsv lists the shown approved syllabi with their program, faculty and archive flag', () => {
  const csv = buildRepositoryCsv([
    { courseCode: 'IT 204', courseTitle: 'Programming 2', programCode: 'BSIT', faculty: 'Fay F', academicYear: '2026-2027', version: 'v1.1', status: 'approved', updatedAt: '2026-11-20T00:00:00Z' },
    { courseCode: 'CS 101', title: '=cmd, "x"', program: 'Old', faculty: 'Ann A', status: 'approved', archived: true },
  ], (row) => row.programCode || row.program);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'Course Code,Course Title,Program,Faculty,Academic Year,Version,Status,Archived,Last Updated');
  assert.equal(lines[1], 'IT 204,Programming 2,BSIT,Fay F,2026-2027,v1.1,Approved,No,2026-11-20T00:00:00Z');
  assert.equal(lines[2], 'CS 101,"\'=cmd, ""x""",Old,Ann A,,,Approved,Yes,'); // a formula is neutralized, quotes and commas escaped
  assert.equal(buildRepositoryCsv([]).trim(), 'Course Code,Course Title,Program,Faculty,Academic Year,Version,Status,Archived,Last Updated');
});
