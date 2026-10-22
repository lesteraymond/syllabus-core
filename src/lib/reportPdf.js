// Draws the analytics report (see reportView.js buildReport) as an A4 PDF and saves it. The PDF library is loaded when the button is
// pressed, so it is not part of the page's first download. Plain black on white with light-blue column names; the header is the one the
// syllabus uses (LCUP logo, university and address, Testmark logo, school year and college).
import { phDateTime } from './phTime.js';
import { COLLEGE_NAME } from './schoolYear.js';

const MARGIN = 18;
const INK = 0;
const HEAD_FILL = [207, 230, 248];
const COLLEGE = COLLEGE_NAME;

async function imageData(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    if (!res.ok || !/^image\/(png|jpeg)/.test(blob.type)) return null; // a missing file must not break the report
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

const pct = (v) => (v === null || v === undefined ? '—' : v + '%');

async function loadDeps() {
  const [pdfModule, tableModule, lcup, testmark] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), imageData('/lcup-logo.png'), imageData('/testmark-logo.png'),
  ]);
  // The dev server hands these CommonJS packages over wrapped (the real export one level down); the build does not.
  const jsPDF = pdfModule.jsPDF || (pdfModule.default && pdfModule.default.jsPDF) || pdfModule.default;
  const autoTable = [tableModule.default, tableModule.default && tableModule.default.default, tableModule.autoTable].find((f) => typeof f === 'function');
  return { jsPDF, autoTable, lcup, testmark };
}

export async function downloadReport(report) {
  drawReport(report, await loadDeps()).save('compliance-report-' + report.schoolYear + (report.historical ? '-' + report.semester.replace(/\s+/g, '-').toLowerCase() : '') + '.pdf');
}

export async function downloadFacultyReport(report) {
  drawFacultyReport(report, await loadDeps()).save('faculty-compliance-' + report.schoolYear + '-' + report.semester.replace(/\s+/g, '-').toLowerCase() + '.pdf');
}

// The page every report shares: the syllabus header, numbered tables, text lines, the signature block and the footer on each page.
// `lines` are the two rows under the header ([left, right] pairs).
function sheet(report, { jsPDF, autoTable, lcup, testmark }, { lines, footer }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const mid = W / 2;
  let y = MARGIN;

  // Header, as in the syllabus.
  try {
    if (lcup) doc.addImage(lcup, 'PNG', MARGIN, y - 2, 18, 18);
    if (testmark) doc.addImage(testmark, 'PNG', W - MARGIN - 28, y + 1, 28, 14.2);
  } catch { /* the report is still useful without the logos */ }
  doc.setTextColor(INK).setFont('times', 'bold').setFontSize(14).text('La Consolacion University Philippines', mid, y + 6, { align: 'center' });
  doc.setFont('times', 'normal').setFontSize(7.5).text('Valenzuela St., Capitol View Park Subdivision, Bulihan, City of Malolos, Bulacan', mid, y + 10.5, { align: 'center' });
  y += 24;
  doc.setFont('times', 'bold').setFontSize(13).text(report.title.toUpperCase(), mid, y, { align: 'center' });
  doc.setFontSize(10).text('SCHOOL YEAR ' + report.schoolYear, mid, y + 6, { align: 'center' });
  doc.text(COLLEGE.toUpperCase(), mid, y + 11, { align: 'center' });
  y += 15;
  doc.setLineWidth(0.3).line(MARGIN, y, W - MARGIN, y);
  y += 6;
  doc.setFont('times', 'normal').setFontSize(10);
  lines.forEach(([left, right], k) => {
    doc.text(left, MARGIN, y);
    doc.text(right, W - MARGIN, y, { align: 'right' });
    y += k === lines.length - 1 ? 4 : 5;
  });

  let n = 0;
  const room = (needed) => { if (y + needed > H - 22) { doc.addPage(); y = MARGIN; } };
  const api = {
    doc,
    table(heading, head, body, { right = [], widths = {}, small = false } = {}) {
      n += 1;
      room(Math.min(28 + body.length * 6, 60));
      doc.setFont('times', 'bold').setFontSize(10.5).setTextColor(INK).text(n + '. ' + heading.toUpperCase(), MARGIN, y + 6);
      const columnStyles = {};
      right.forEach((c) => { columnStyles[c] = { halign: 'right' }; });
      Object.entries(widths).forEach(([c, w]) => { columnStyles[c] = { ...(columnStyles[c] || {}), cellWidth: w }; });
      autoTable(doc, {
        startY: y + 8, head: [head], body, theme: 'grid', margin: { left: MARGIN, right: MARGIN }, columnStyles,
        styles: { font: 'times', fontSize: small ? 8.5 : 9.5, textColor: INK, lineColor: INK, lineWidth: 0.15, cellPadding: small ? 1.4 : 1.8 },
        headStyles: { fillColor: HEAD_FILL, textColor: INK, fontStyle: 'bold', lineColor: INK, lineWidth: 0.15 },
        bodyStyles: { fillColor: [255, 255, 255] },
        didParseCell: (d) => { if (d.section === 'head' && right.includes(d.column.index)) d.cell.styles.halign = 'right'; },
      });
      y = doc.lastAutoTable.finalY + 4;
    },
    list(heading, items) {
      n += 1;
      room(30);
      doc.setFont('times', 'bold').setFontSize(10.5).setTextColor(INK).text(n + '. ' + heading.toUpperCase(), MARGIN, y + 6);
      doc.setFont('times', 'normal').setFontSize(10);
      let ty = y + 12;
      items.forEach((line, k) => {
        const wrapped = doc.splitTextToSize((k + 1) + '. ' + line, W - MARGIN * 2);
        doc.text(wrapped, MARGIN, ty);
        ty += wrapped.length * 4.6 + 1;
      });
      y = ty + 2;
    },
    finish() {
      room(38);
      y += 8;
      doc.setFont('times', 'normal').setFontSize(10);
      const col = (x, label, name, role) => {
        doc.text(label, x, y);
        doc.line(x, y + 14, x + 70, y + 14);
        doc.text(name, x, y + 19);
        if (role) doc.text(role, x, y + 24);
        doc.text('Date: ______________', x, y + (role ? 30 : 25));
      };
      col(MARGIN, 'Prepared by:', report.preparedBy, report.isFaculty ? 'Faculty' : 'Administrator');
      col(mid + 4, 'Noted by:', '', 'Dean, ' + COLLEGE);
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p += 1) {
        doc.setPage(p);
        doc.setFont('times', 'normal').setFontSize(8).setTextColor(90);
        doc.text(footer, MARGIN, H - 10);
        doc.text('Page ' + p + ' of ' + pages, W - MARGIN, H - 10, { align: 'right' });
      }
      return doc;
    },
  };
  return api;
}

// Returns the jsPDF document (separate from the download so it can be drawn and looked at without a browser).
export function drawReport(report, deps) {
  const sh = sheet(report, deps, {
    footer: 'Scores are from the AI Checker.',
    lines: [
      ['Term: ' + report.semester + (report.historical ? ' (past term)' : ''), 'Generated: ' + phDateTime(report.generatedAt)],
      ['Prepared by: ' + report.preparedBy + (report.isFaculty ? ' (own subjects only)' : ''), 'Pass mark: ' + report.passThreshold + '%'],
    ],
  });
  const s = report.summary;
  sh.table('Summary', ['Measure', 'Value'], [
    ['Average AI compliance score', pct(s.average)],
    ['Checks counted', String(s.checks)],
    ['Syllabi at or above the pass mark', String(s.passing) + (s.checks ? ' (' + Math.round((s.passing / s.checks) * 100) + '%)' : '')],
    ['Syllabi below the pass mark', String(s.below) + (s.checks ? ' (' + Math.round((s.below / s.checks) * 100) + '%)' : '')],
  ], { right: [1] });

  sh.table(report.historical ? 'Status of the syllabi checked in this term (as of the date generated)' : 'Submission status', ['Status', 'Syllabi', 'Share'], [
    ...report.statuses.map((x) => [x.label, String(x.count), x.share + '%']),
    [report.historical ? 'Total checked' : 'Total assigned', String(s.assigned), s.assigned ? '100%' : '—'],
  ], { right: [1, 2] });

  sh.table('Score distribution', ['Band', 'Syllabi', 'Share'], report.distribution.map((x) => [x.label, String(x.count), x.share + '%']), { right: [1, 2] });
  sh.table('Average score by area', ['Area', 'Average'], report.areas.map((x) => [x.label, pct(x.value)]), { right: [1] });
  if (report.trend.length) sh.table('Average score by month of latest check', ['Month', 'Average'], report.trend.map((x) => [x.label, pct(x.value)]), { right: [1] });
  if (report.byProgram.length) sh.table('Scores by program', ['Program', 'Syllabi', 'Average', 'Below pass mark'], report.byProgram.map((x) => [x.program, String(x.count), pct(x.average), String(x.below)]), { right: [1, 2, 3] });

  sh.table('Syllabi below the pass mark',
    ['Code', 'Title', ...(report.isFaculty ? [] : ['Faculty']), 'Score', 'Lowest area'],
    report.needAttention.length
      ? report.needAttention.map((x) => [x.code, x.title, ...(report.isFaculty ? [] : [x.faculty]), pct(x.score), x.weakest])
      : [['None', '', ...(report.isFaculty ? [] : ['']), '', '']],
    { right: [report.isFaculty ? 2 : 3] });

  if (report.insights.length) sh.list('Insights', report.insights);
  return sh.finish();
}

const STATUS_TEXT = { approved: 'Approved', submitted: 'Submitted', under_review: 'Under review', for_revision: 'For revision', rejected: 'Rejected', draft: 'Draft' };

// The Faculty Compliance report: who has submitted how many syllabi against the requirement (see facultyCompliance.js, buildFacultyReport).
export function drawFacultyReport(report, deps) {
  const sh = sheet(report, deps, {
    footer: 'A syllabus counts once it is submitted or approved. Drafts and returned syllabi do not count.',
    lines: [
      ['Term: ' + report.semester, 'Generated: ' + phDateTime(report.generatedAt)],
      ['Prepared by: ' + report.preparedBy, 'Required per faculty: ' + report.required + ' syllabi'],
    ],
  });
  const s = report.summary;
  sh.table('Summary', ['Measure', 'Value'], [
    ['Faculty members', String(s.faculty)],
    ['Compliant', String(s.compliant) + (s.faculty ? ' (' + Math.round((s.compliant / s.faculty) * 100) + '%)' : '')],
    ['Not compliant', String(s.behind)],
    ['Syllabi counted', String(s.counted)],
    ['Of which approved', String(s.approved)],
  ], { right: [1] });

  sh.table('Faculty compliance', ['Faculty', 'Counted', 'Approved', 'Waiting', 'Required', 'Status'],
    report.faculty.length ? report.faculty.map((f) => [f.name, String(f.counted), String(f.approved), String(f.waiting), String(f.required), f.compliant ? 'Compliant' : 'Not compliant']) : [['No faculty yet', '', '', '', '', '']],
    { right: [1, 2, 3, 4] });

  sh.table('Faculty who are not compliant', ['Faculty', 'Counted', 'Still needed'],
    report.faculty.filter((f) => !f.compliant).length ? report.faculty.filter((f) => !f.compliant).map((f) => [f.name, String(f.counted), String(f.missing)]) : [['None', '', '']],
    { right: [1, 2] });

  sh.table('Syllabi by faculty', ['Faculty', 'Code', 'Title', 'Status'],
    report.faculty.flatMap((f) => (f.subjects.length ? f.subjects : [{ code: '', title: '', status: '' }]).map((x, k) => [k === 0 ? f.name : '', x.code, x.title, STATUS_TEXT[x.status] || x.status])),
    { small: true });
  return sh.finish();
}
