'use strict';
const crypto = require('node:crypto');
const { canonical } = require('../compliance/hash');
const { loadOutcomes } = require('../institution');
const { loadResolvedProgram, findProgram } = require('../programs');
const { httpError } = require('../http');
const { withholdReviewedDrafts } = require('./reportSafety');
const { assertContentBasis, assertRecordReview } = require('../programPoReferences');
async function mastersFor(db, content, { syllabusId = null } = {}) {
  await assertRecordReview(db,syllabusId);
  const institution = await loadOutcomes(db);
  let program;
  // A specialization (BSIT-CYBERSECURITY) is checked against the POs of the program it inherits from, not a separate copy.
  try { program = await loadResolvedProgram(db, await findProgram(db, content.meta?.program || '')); }
  catch (error) { if (error.status !== 404) throw error; program = { pos: [] }; }
  assertContentBasis(content,program.poReference);
  // A renamed program keeps resolving through its code aliases; its curriculum rows must too. Both the saved code and the resolved one match.
  const codes = new Set([content.meta?.program, program.code].filter(Boolean));
  let rows;
  try { [rows] = await db.query("SELECT reference_id, program_code, curriculum_year, source, courses_json FROM syllabus_check_curricula WHERE status = 'approved' ORDER BY reference_id"); }
  catch (error) { if (error.code === 'ER_NO_SUCH_TABLE') throw httpError(503, 'Run npm run migrate-syllabuscheck before using the mandatory hybrid checker.'); throw error; }
  const curricula = rows.filter(row => codes.has(row.program_code) &&(!content.meta?.curriculumYear || row.curriculum_year === content.meta.curriculumYear)).map(row => ({ id: row.reference_id, source: row.source, program: row.program_code, curriculumYear: row.curriculum_year, status: 'approved', courses: JSON.parse(row.courses_json) }));
  const bundle = { institution: { vision: institution.vision, mission: institution.mission, egas: institution.egas }, pos: program.pos, curricula };
  if(program.poReference)bundle.poReference=program.poReference;
  // Approved curricula of OTHER programs, kept outside the bundle (and so outside the fingerprint): only used to tell an author that a course code exists elsewhere.
  const otherCurricula = rows.filter(row => !codes.has(row.program_code)).map(row => { try { return { program: row.program_code, curriculumYear: row.curriculum_year, courses: (JSON.parse(row.courses_json) || []).map(c => ({ code: c.code, title: c.title })) }; } catch { return null; } }).filter(Boolean);
  return { ...bundle, otherCurricula, programCodes: [...codes], outcomeSource: program.inheritedFrom ? program.inheritedFrom.code : null, fingerprint: crypto.createHash('sha256').update(canonical(bundle)).digest('hex') };
}
async function saveReport(db, runId, report, fingerprint) {
  if (require('./academicPolicyV2').isV2(report)) throw httpError(409, 'Policy V2 preview JSON must not replace an official or historical report.', {code:'academic_preview_not_official'});
  await db.query('INSERT INTO syllabus_check_reports (run_id, reference_hash, report_json) VALUES (?, ?, ?)', [runId, fingerprint, JSON.stringify(withholdReviewedDrafts(report))]);
}
async function readReport(db, runId) {
  try {
    const [rows] = await db.query('SELECT reference_hash, report_json FROM syllabus_check_reports WHERE run_id = ?', [runId]);
    return rows[0] ? withholdReviewedDrafts({ fingerprint: rows[0].reference_hash, ...JSON.parse(rows[0].report_json) }) : null;
  } catch (error) { if (error.code === 'ER_NO_SUCH_TABLE') return null; throw error; }
}
// Verified AI judgements from this syllabus's own most recent checks, by fingerprint, newest first. They are only ever offered back to
// the same syllabus (never shared between people), and a judgement that could not be verified is never reusable. This is an
// optimisation: any problem reading the history just means nothing is reused and the whole syllabus is asked again.
async function reusableJudgements(db, syllabusId, checks = 3) {
  const found = new Map();
  try {
    const [rows] = await db.query('SELECT p.report_json FROM syllabus_check_reports p JOIN ai_check_runs r ON r.run_id = p.run_id WHERE r.syllabus_id = ? ORDER BY r.run_id DESC LIMIT ?', [syllabusId, checks]);
    for (const row of rows) {
      let report;
      try { report = JSON.parse(row.report_json); } catch { continue; }
      if (require('./academicPolicyV2').isV2(report)) continue;
      for (const j of report.hybrid?.alignment?.judgements || []) {
        if (typeof j.key === 'string' && !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE' && !found.has(j.key)) found.set(j.key, j);
      }
    }
  } catch { return new Map(); }
  return found;
}
// What the author already did about this syllabus's earlier checks, so a new check can tell "still wrong after I fixed it" from "never fixed" and
// stop proposing yet another wording. Built from the stored reports and the author's saved decisions (accept / edit apply a suggestion; a later
// reject, which is how Undo is recorded, takes it back).
//   attempts  { field path: corrections applied since that field last passed }       counted until every relationship it was for is aligned
//   last      { field path: { runId, basedOn: [relationship ids], before: { id: verdict } } }   the latest applied correction of that field
//   previous  { relationship id: verdict }                                              the verdicts of the check just before this one
// Any problem reading the history just means no history (the check then behaves as a first check).
async function correctionHistory(db, syllabusId, runs = 8) {
  const none = { attempts: {}, last: {}, previous: {} };
  try {
    const [rows] = await db.query('SELECT r.run_id, p.report_json FROM ai_check_runs r JOIN syllabus_check_reports p ON p.run_id = r.run_id WHERE r.syllabus_id = ? ORDER BY r.run_id DESC LIMIT ?', [syllabusId, runs]);
    const reports = rows.slice().reverse().map((row) => { try { const saved = JSON.parse(row.report_json); return require('./academicPolicyV2').isV2(saved) ? null : { id: row.run_id, hybrid: saved.hybrid }; } catch { return null; } }).filter((r) => r && r.hybrid);
    if (!reports.length) return none;
    const [decisions] = await db.query('SELECT run_id, suggestion_id, action FROM syllabus_check_decisions WHERE run_id IN (?) ORDER BY decision_id', [reports.map((r) => r.id)]);
    const latest = new Map();
    for (const d of decisions) latest.set(`${d.run_id}|${d.suggestion_id}`, d.action);
    const attempts = {}, last = {};
    const labelsOf = (hybrid) => new Map((hybrid.alignment?.judgements || []).filter((j) => !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE').map((j) => [j.id, j.label]));
    for (const report of reports) {
      const labels = labelsOf(report.hybrid);
      // A field whose corrected relationships are all aligned has passed: its count starts again.
      for (const path of Object.keys(last)) if (last[path].basedOn.length && last[path].basedOn.every((id) => labels.get(id) === 'ALIGNED')) { delete attempts[path]; delete last[path]; }
      for (const s of report.hybrid.suggestions || []) {
        const action = latest.get(`${report.id}|${s.id}`);
        if (s.source !== 'ai' || (action !== 'accept' && action !== 'edit')) continue;
        const basedOn = (s.basedOn && s.basedOn.length ? s.basedOn : [s.id]).map((id) => String(id).replace(/^SEM:/, ''));
        attempts[s.path] = (attempts[s.path] || 0) + 1;
        last[s.path] = { runId: report.id, basedOn, before: Object.fromEntries(basedOn.filter((id) => labels.has(id)).map((id) => [id, labels.get(id)])) };
      }
    }
    return { attempts, last, previous: Object.fromEntries(labelsOf(reports[reports.length - 1].hybrid)) };
  } catch { return none; }
}
module.exports = { mastersFor, saveReport, readReport, reusableJudgements, correctionHistory };
