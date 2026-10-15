'use strict';
// The rule check for a syllabus that was uploaded as a file (a PDF) instead of filled in the builder. For now it can only look at the
// file itself and at the course details entered with it: matching the file to the template needs the AI service, which is not switched
// on yet (no key, and the corrected template is still to come). That step is marked as not done, in the result and in a recommendation,
// so the administrator reads the file against the template themselves. When it exists it becomes one more rule here.
//
// It returns the same shape as rules.evaluate(), so a stored run, the score, the findings and the dialogs need nothing special. Only the
// Format Compliance area is scored; the other five areas read "not scored" because they are about the form's contents.
const fs = require('fs');
const path = require('path');
const standard = require('./standard-v4.json');

// Where uploaded files are kept (the same folder index.js serves). Read when used, so a test can point it somewhere else.
const uploadRoot = () => path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');
const AREA = 'template'; // Format Compliance

// The rules of an upload. weight: how much each counts inside the Format Compliance score. severity 'blocking' fails conformance.
const RULES = [
  { id: 'U-01', severity: 'blocking', weight: 10, message: 'The uploaded file could not be found on the server, or it is empty.' },
  { id: 'U-02', severity: 'blocking', weight: 10, message: 'The file is not a complete PDF document (the PDF header or end marker is missing). Ask the faculty member to upload it again.' },
  { id: 'U-03', severity: 'major', weight: 6, message: 'The PDF is password protected, so a reviewer cannot open it.' },
  { id: 'U-04', severity: 'major', weight: 6, message: 'The course code and title were not entered with the upload.' },
  { id: 'U-05', severity: 'major', weight: 6, message: 'No program is linked to this upload.' },
  { id: 'U-06', severity: 'minor', weight: 3, message: 'The PDF has only one page. A syllabus in the university form runs to several pages, so this file may be incomplete.' },
];

const blank = (v) => !String(v == null ? '' : v).trim();

// Reads what the rules need from a file on disk. `filePath` is what the database holds ("/uploads/abc.pdf"); only its file name is used,
// so a stored path can never point outside the uploads folder.
function readFacts(filePath, root = uploadRoot()) {
  const empty = { exists: false, size: 0, header: false, ended: false, encrypted: false, pages: null };
  if (blank(filePath)) return empty;
  let file;
  try {
    file = path.join(root, path.basename(String(filePath)));
    const stat = fs.statSync(file);
    if (!stat.isFile()) return empty;
    const buf = fs.readFileSync(file);
    const text = buf.toString('latin1');
    const found = text.match(/\/Type\s*\/Page(?![A-Za-z])/g);
    return {
      exists: buf.length > 0,
      size: buf.length,
      header: text.slice(0, 1024).includes('%PDF-'),
      ended: text.slice(-2048).includes('%%EOF'),
      encrypted: /\/Encrypt\b/.test(text.slice(-4096)) || /\/Encrypt\b/.test(text.slice(0, 4096)),
      pages: found ? found.length : null, // null when the page tree is packed away and cannot be counted: then the rule is skipped
    };
  } catch {
    return empty;
  }
}

// The size of the stored file in bytes (0 when it is missing): enough to tell one upload from another without reading it.
function fileSize(filePath, root = uploadRoot()) {
  try { return blank(filePath) ? 0 : fs.statSync(path.join(root, path.basename(String(filePath)))).size; } catch { return 0; }
}

// facts: from readFacts. details: { courseCode, title, programCode }.
function checkUpload(facts, details = {}) {
  const f = facts || {};
  const passes = {
    'U-01': f.exists ? 1 : 0,
    'U-02': f.exists ? (f.header && f.ended ? 1 : 0) : null, // no file: already failed U-01
    'U-03': f.exists && f.header ? (f.encrypted ? 0 : 1) : null,
    'U-04': !blank(details.courseCode) && !blank(details.title) ? 1 : 0,
    'U-05': !blank(details.programCode) ? 1 : 0,
    'U-06': f.pages === null || f.pages === undefined ? null : (f.pages >= 2 ? 1 : 0),
  };
  let wsum = 0;
  let wscore = 0;
  const findings = [];
  RULES.forEach((rule) => {
    const v = passes[rule.id];
    if (v === null || v === undefined) return; // not applicable
    wsum += rule.weight;
    wscore += rule.weight * v;
    if (v < 1) findings.push({ id: rule.id + ':file', area: AREA, source: 'rule', ruleId: rule.id, severity: rule.severity, step: null, path: 'file', message: rule.message, evidence: {} });
  });
  const score = wsum ? Math.round((wscore / wsum) * 100) : null;
  const areas = standard.areas.map((a) => ({ key: a.key, name: a.name, weight: a.weight, stage: a.stage, score: a.key === AREA ? score : null }));
  const failed = findings.filter((x) => x.severity === 'blocking');
  const overall = score;
  return {
    standard: standard.version,
    status: overall === null ? 'insufficient' : 'scored',
    filledSections: 0,
    overall,
    band: overall === null ? null : standard.bands.find((b) => overall >= b.min).label,
    passThreshold: standard.passThreshold,
    passed: overall !== null && overall >= standard.passThreshold && failed.length === 0,
    areas,
    conformance: { ok: failed.length === 0, failed },
    contact: null,
    findings,
  };
}

// The one recommendation every upload check carries: what was not checked, and what the administrator must do instead.
const PENDING_NOTE = {
  source: 'rule', title: 'Matching to the template is not done yet',
  text: 'This syllabus was uploaded as a file, so only the file and the course details were checked. Matching its contents to the template needs the AI service, which is not switched on yet. Read the file against the template yourself before deciding.',
  step: null, basedOn: [], steps: [], areas: [AREA], rows: [], clos: [], priority: null, level: 'Medium',
};

module.exports = { fileSize, checkUpload, readFacts, RULES, PENDING_NOTE, uploadRoot };
