'use strict';
// The three sample syllabi in reference-data/ as checker input: IT 202 (BSIT), IE 402 (BSIE) and CpE 304 (BSCpE).
// The weekly plan, CLOs and references are the faculty's own text, read from the PDF by the application's importer (and so may carry extraction
// errors: check against the PDF). The masters (Program Outcomes, EGAs, curriculum record) come from the repository's own transcribed data
// (db/local-outcome-data.cjs, db/local-curriculum-data.cjs), not from an invented source. The PDFs are not tracked by git, so loadReal() returns null
// when a PDF is missing and callers skip.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..', '..', '..', '..');
const COURSES = {
  prog1: { program: 'BSIT', pdf: 'IT-202-Programming-1.pdf', code: 'IT 202', label: 'BSIT - IT 202 Computer Programming 1' },
  syseng: { program: 'BSIE', pdf: 'IE402-SYSTEM-ENGINEERINGS.pdf', code: 'IE 402', label: 'BSIE - IE 402 Systems Engineering' },
  sensors: { program: 'BSCPE', pdf: 'CPE-304-Fundamentals-of-Mixed-Signals-and-Sensors.pdf', code: 'CpE 304', label: 'BSCpE - CpE 304 Fundamentals of Mixed Signals and Sensors' },
};
const squash = text => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
let mapper;
const mapPdfFields = async () => (mapper ||= (await import(pathToFileURL(path.join(root, 'src/lib/pdfImport.js')).href)).mapPdfFields);

async function loadReal(key) {
  const course = COURSES[key];
  const file = path.join(root, 'reference-data', course.pdf);
  if (!fs.existsSync(file)) return null;
  const { extractPdf } = require(path.join(root, 'server/lib/pdfImport.js'));
  const { sources } = require(path.join(root, 'server/db/local-outcome-data.cjs'));
  const { programs } = require(path.join(root, 'server/db/local-curriculum-data.cjs'));
  const F = require('../../compliance/fixtures');
  const imported = await extractPdf(fs.readFileSync(file));
  const f = imported.fields;
  const base = F.good();
  base.meta.program = course.program; base.meta.title = f.title;
  // As in the application, the course code comes from the selected catalog subject (the PDF spells some codes differently, e.g. "CpE 304" and "CpE-304").
  const subject = programs.find(p => p.code === course.program).terms.flatMap(t => t.rows).find(r => squash(r.code) === squash(course.code));
  base.meta.code = subject ? subject.code : f.code;
  let n = 0;
  const { content } = (await mapPdfFields())(f, base, () => `real-${key}-${++n}`, { planRows: imported.layout.planRows });
  const curriculum = programs.find(p => p.code === course.program);
  const rows = curriculum.terms.flatMap(t => t.rows.map(r => ({ ...r, yearLevel: t.yearLevel })));
  const record = rows.find(r => squash(r.code) === squash(course.code));
  content.meta.curriculumYear = curriculum.curriculumYear;
  // As in the application, the year level comes from the selected subject. The units are what the faculty wrote in the PDF ("2 units lecture / 1 unit laboratory");
  // a syllabus that gives only "3 units" is read as 3 lecture and 0 laboratory, which is an assumption and is noted on the record.
  if (record) content.meta.yearLevel = String(record.yearLevel);
  const credits = String(f.credits || ''), lec = /(\d+)\s*units?\s*(?:of\s*)?lecture/i.exec(credits), lab = /(\d+)\s*units?\s*(?:of\s*)?lab/i.exec(credits), only = /^\s*(\d+)\s*units?\s*$/i.exec(credits);
  content.meta.lecture = lec ? lec[1] : only ? only[1] : '';
  content.meta.lab = lab ? lab[1] : only || lec ? '0' : '';
  const src = sources[course.program];
  content.outcomes = { ...content.outcomes, egas: src.egas, pos: src.pos };
  const masters = {
    synthetic: false,
    institution: { vision: content.outcomes.vision || '', mission: content.outcomes.mission || {}, egas: src.egas },
    pos: src.pos,
    curricula: [{ program: course.program, curriculumYear: curriculum.curriculumYear, status: 'approved', source: 'db/local-curriculum-data.cjs (transcribed from the curriculum images in reference-data/)', courses: rows.map(r => ({ code: r.code, title: r.title, prereq: r.prereq, lecture: r.lecture, lab: r.lab, yearLevel: r.yearLevel })) }],
  };
  return { key, ...course, content, masters, record: record || null, extracted: imported };
}
module.exports = { loadReal, COURSES };
