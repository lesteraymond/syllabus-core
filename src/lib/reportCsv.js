// RFC 4180 CSV builders for Reports (Faculty syllabi report & Admin compliance summary).
// Includes UTF-8 BOM for clean Excel import and formula-injection neutralization.

const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(value) {
  let str = String(value ?? '').replace(/\r\n|\r|\n/g, ' ').trim();
  if (FORMULA_LEAD.test(str)) str = "'" + str;
  if (/[",]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(headers, rows) {
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ];
  return lines.join('\r\n') + '\r\n';
}

export function buildFacultySyllabiCsv(items = [], { academicYear = '' } = {}) {
  const headers = [
    'Course Code',
    'Course Title',
    'Program',
    'Academic Year',
    'Version',
    'Status',
    'AI Score (%)',
    'Compliance Standing',
    'Findings Count',
    'Findings Summary',
    'Last Updated',
  ];
  const rows = items.map((item) => [
    item.courseCode || '',
    item.title || '',
    item.program || '',
    item.academicYear || academicYear || '',
    item.version || '',
    item.statusLabel || item.status || '',
    item.score !== null && item.score !== undefined ? String(item.score) : '',
    item.standing || '',
    item.findingsCount !== null && item.findingsCount !== undefined ? String(item.findingsCount) : '',
    item.findingsSummary || '',
    item.updatedAt || '',
  ]);
  return toCsv(headers, rows);
}

export function buildAdminComplianceCsv(facultyRows = [], { academicYear = '' } = {}) {
  const headers = [
    'Faculty',
    'Academic Year',
    'Total Syllabi',
    'Approved',
    'Pending Review',
    'Compliance Rate (%)',
  ];
  const rows = facultyRows.map((f) => [
    f.name || '',
    academicYear || '',
    String(f.total ?? 0),
    String(f.approved ?? 0),
    String(f.pending ?? 0),
    String(f.rate ?? 0),
  ]);
  if (facultyRows.length > 0) {
    const total = facultyRows.reduce((s, f) => s + (f.total || 0), 0);
    const approved = facultyRows.reduce((s, f) => s + (f.approved || 0), 0);
    const pending = facultyRows.reduce((s, f) => s + (f.pending || 0), 0);
    const rate = total ? Math.round((approved / total) * 100) : 0;
    rows.push(['TOTAL', academicYear || '', String(total), String(approved), String(pending), String(rate)]);
  }
  return toCsv(headers, rows);
}

export function buildAllFacultySyllabiCsv(items = [], { academicYear = '' } = {}) {
  const headers = [
    'Faculty',
    'Course Code',
    'Course Title',
    'Program',
    'Academic Year',
    'Version',
    'Status',
    'AI Score (%)',
    'Compliance Standing',
    'Findings Count',
    'Findings Summary',
    'Last Updated',
  ];
  const rows = items.map((item) => [
    item.faculty || '',
    item.courseCode || '',
    item.title || '',
    item.program || '',
    item.academicYear || academicYear || '',
    item.version || '',
    item.statusLabel || item.status || '',
    item.score !== null && item.score !== undefined ? String(item.score) : '',
    item.standing || '',
    item.findingsCount !== null && item.findingsCount !== undefined ? String(item.findingsCount) : '',
    item.findingsSummary || '',
    item.updatedAt || '',
  ]);
  return toCsv(headers, rows);
}

// The Repository's "Export list": the approved syllabi on screen. `programOf(row)` names the program the way the table does.
export function buildRepositoryCsv(rows = [], programOf = (row) => row.programCode || row.program || '') {
  const headers = ['Course Code', 'Course Title', 'Program', 'Faculty', 'Academic Year', 'Version', 'Status', 'Archived', 'Last Updated'];
  return toCsv(headers, rows.map((row) => [
    row.courseCode || '',
    row.courseTitle || row.title || '',
    programOf(row) || '',
    row.faculty || '',
    row.academicYear || '',
    row.version || '',
    row.status === 'approved' ? 'Approved' : row.status || '',
    row.archived ? 'Yes' : 'No',
    row.updatedAt || '',
  ]));
}

export function downloadCsv(csvText, filename) {
  const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
