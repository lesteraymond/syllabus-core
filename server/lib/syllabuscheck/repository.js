'use strict';
const crypto = require('node:crypto');
const { canonical } = require('../compliance/hash');
const { loadOutcomes } = require('../institution');
const { loadResolvedProgram, findProgram } = require('../programs');
const { httpError } = require('../http');
const { programIdOfSyllabus, currentLabel } = require('../academicYear');
const { withholdReviewedDrafts } = require('./reportSafety');
const { assertContentBasis, assertRecordReview, recordReviewOf } = require('../programPoReferences');
// The references a syllabus is checked against. An open record review refuses this, so nothing new is judged against references the faculty has not reviewed.
// `historicalRead` is for one caller only: service.loadDetail, which reads a SAVED report and compares its fingerprint. It judges nothing, so it is not refused; it is told about the review instead (recordReview).
// The subject link is gone (or was never made): the program is found by its code, but only in the syllabus's OWN academic year. Before this, the code was looked
// up in the current year, so after the Admin activated another year an old syllabus borrowed that year's program and Program Outcomes. A code that has no
// program in the syllabus's year resolves to nothing (404), never to another year's program. A database before the academic-year scope behaves as before.
async function yearOfSyllabus(db, syllabusId) {
  if (!syllabusId) return null;
  try { const [rows] = await db.query('SELECT academic_year FROM syllabi WHERE syllabus_id = ?', [syllabusId]); return (rows[0] && rows[0].academic_year) || null; }
  catch (error) { if (error && error.code === 'ER_BAD_FIELD_ERROR') return null; throw error; }
}
async function programOfOwnYear(db, syllabusId, code) {
  const year = await yearOfSyllabus(db, syllabusId);
  if (!year) return findProgram(db, code);
  const found = await findProgram(db, code, { year });
  let programYear = null;
  try { const [[row]] = await db.query('SELECT academic_year FROM programs WHERE program_id = ?', [found.program_id]); programYear = (row && row.academic_year) || (await currentLabel(db)); }
  catch (error) { if (error && error.code === 'ER_BAD_FIELD_ERROR') return found; throw error; } // programs not yet year-scoped: one catalog
  if (programYear !== year) throw httpError(404, 'This program has no catalog in the academic year of this syllabus.');
  return found;
}
async function mastersFor(db, content, { syllabusId = null, historicalRead = false } = {}) {
  const recordReview = historicalRead ? await recordReviewOf(db, syllabusId) : null;
  if (!historicalRead) await assertRecordReview(db,syllabusId);
  const institution = await loadOutcomes(db);
  let program;
  // A specialization (BSIT-CYBERSECURITY) is checked against the POs of the program it inherits from, not a separate copy.
  try {
    const byId = await programIdOfSyllabus(db, { syllabusId, courseId: content.meta?.courseId }); // the program of the syllabus's own subject (and so its own academic year)
    program = await loadResolvedProgram(db, byId ? await findProgram(db, byId) : await programOfOwnYear(db, syllabusId, content.meta?.program || ''));
  }
  catch (error) { if (error.status !== 404) throw error; program = { pos: [] }; }
  assertContentBasis(content,program.poReference);
  // A renamed program keeps resolving through its code aliases; its curriculum rows must too. Both the saved code and the resolved one match.
  // The curriculum follows the syllabus's OWN program, never the program its outcomes are inherited from: PO inheritance and curriculum selection are
  // independent, so a specialization is checked against its own approved curriculum (its specialization subjects included) and its source program's POs.
  const codes = new Set([content.meta?.program, program.code].filter(Boolean));
  let rows;
  try { [rows] = await db.query("SELECT reference_id, program_code, curriculum_year, source, courses_json FROM syllabus_check_curricula WHERE status = 'approved' ORDER BY reference_id"); }
  catch (error) { if (error.code === 'ER_NO_SUCH_TABLE') throw httpError(503, 'Run npm run migrate-syllabuscheck before using the mandatory hybrid checker.'); throw error; }
  const curricula = rows.filter(row => codes.has(row.program_code) &&(!content.meta?.curriculumYear || row.curriculum_year === content.meta.curriculumYear)).map(row => ({ id: row.reference_id, source: row.source, program: row.program_code, curriculumYear: row.curriculum_year, status: 'approved', courses: JSON.parse(row.courses_json) }));
  // Which list of EGAs a syllabus of this program must carry: the program's own EGAs (program_egas: the Admin's per-program assignment, which the syllabus copies from its subject) when the
  // program has any, else the institution-wide default list. Vision and mission stay institutional. The PO-to-EGA crosswalk is not here: it is each PO's own ega_nos (see ruleCoverage P-03).
  const egaSource = Array.isArray(program.egas) && program.egas.length ? 'program' : 'institution';
  const egaMaster = egaSource === 'program' ? program.egas.map(e => ({ no: e.no, name: e.name, short: e.short })) : institution.egas;
  const bundle = { institution: { vision: institution.vision, mission: institution.mission, egas: egaMaster }, pos: program.pos, curricula };
  if(program.poReference){const {id,version,sourceFile,sourceSha256,outcomes,authorization,institutionalApproval}=program.poReference;bundle.poReference={id,version,sourceFile,sourceSha256,outcomes,...(authorization!==undefined?{authorization}:{}),...(institutionalApproval!==undefined?{institutionalApproval}:{})};}
  bundle.referenceContext = {program:{id:program.id||null,code:program.code||content.meta?.program||null},po:{source:program.inheritedFrom?.code||program.code||null,status:program.referenceStatus||(program.poReference?'versioned':'legacy_unversioned'),reference:program.poReference?{id:program.poReference.id,version:program.poReference.version,sourceFile:program.poReference.sourceFile,sourceSha256:program.poReference.sourceSha256,authorization:program.poReference.authorization||null,...(program.poReference.institutionalApproval?{institutionalApproval:program.poReference.institutionalApproval}:{})}:null},curriculum:{source:program.code||null,selectedYear:content.meta?.curriculumYear||null,referenceIds:curricula.map(c=>c.id)}};
  // Approved curricula of OTHER programs, kept outside the bundle (and so outside the fingerprint): only used to tell an author that a course code exists elsewhere.
  const otherCurricula = rows.filter(row => !codes.has(row.program_code)).map(row => { try { return { program: row.program_code, curriculumYear: row.curriculum_year, courses: (JSON.parse(row.courses_json) || []).map(c => ({ code: c.code, title: c.title })) }; } catch { return null; } }).filter(Boolean);
  const fingerprint = crypto.createHash('sha256').update(canonical(bundle)).digest('hex'); // computed over the bundle as it always was
  // What a saved report records about the references it used (outside the fingerprint, which already covers their content): the resolved identifiers and versions, never a label borrowed from
  // another program. Academic year = the program row's year; PO source = the program that owns the outcomes; hashes identify the exact reference content.
  let academicYear = null;
  if (program.id) try { const [[row]] = await db.query('SELECT academic_year FROM programs WHERE program_id = ?', [program.id]); academicYear = (row && row.academic_year) || null; } catch { academicYear = null; } // informational metadata only: never a reason to fail a check
  const ref = program.poReference || null, sha = value => crypto.createHash('sha256').update(String(value)).digest('hex');
  bundle.referenceContext = { ...bundle.referenceContext, program: { ...bundle.referenceContext.program, academicYear, versions: program.versions || null },
    po: { ...bundle.referenceContext.po, sourceProgram: program.inheritedFrom ? { id: program.inheritedFrom.id, code: program.inheritedFrom.code } : (program.id ? { id: program.id, code: program.code || null } : null),
      reference: ref ? { ...bundle.referenceContext.po.reference, kind: ref.kind || null, status: ref.status || 'published', academicYear: ref.academicYear || null, publishedAt: ref.publishedAt || null, publishedBy: ref.publishedBy ?? null, supersedes: ref.supersedes || null, contentSha256: ref.contentSha256 || null } : null },
    ega: { source: egaSource, programId: program.id || null, version: program.versions ? program.versions.egas : null, count: egaMaster.length, sha256: sha(canonical(egaMaster)) },
    institution: { version: institution.version ?? null },
    curriculum: { ...bundle.referenceContext.curriculum, sha256: curricula.map(c => sha(c.source + '|' + JSON.stringify(c.courses))) } };
  return { ...bundle, ...(ref ? { poReference: ref } : {}), otherCurricula, programCodes: [...codes], outcomeSource: program.inheritedFrom ? program.inheritedFrom.code : null, fingerprint, ...(recordReview ? { recordReview } : {}) };
}
async function saveReport(db, runId, report, fingerprint) {
  if (require('./academicPolicyV2').isV2(report)) throw httpError(409, 'Policy V2 preview JSON must not replace an official or historical report.', {code:'academic_preview_not_official'});
  const json = JSON.stringify(withholdReviewedDrafts(report));
  const sql = 'INSERT INTO syllabus_check_reports (run_id, reference_hash, report_json) VALUES (?, ?, ?)';
  // The whole report travels in ONE statement, so the database's max_allowed_packet must hold it (the escaped text is larger than the JSON). When it cannot, say so in
  // plain words: the database would otherwise drop the connection and the author would only see "read ECONNRESET". The check is rolled back, nothing is half-saved.
  const bytes = Buffer.byteLength(json, 'utf8'), limit = await packetLimitOf(db);
  let packet = Math.ceil(bytes * 1.15) + 256; // an estimate, replaced by the exact size when the pool can format the statement
  try { const format = typeof db.format === 'function' ? db.format.bind(db) : typeof db.pool?.format === 'function' ? db.pool.format.bind(db.pool) : null; if (format) packet = Buffer.byteLength(format(sql, [runId, fingerprint, json]), 'utf8'); } catch { /* keep the estimate */ }
  if (limit && packet > limit) throw reportTooLarge(bytes, packet, limit);
  try { await db.query(sql, [runId, fingerprint, json]); } catch (error) {
    // The server's own refusal, or the dropped connection that follows an oversized packet on some servers (only claimed when the size really was near the limit).
    if (error && (error.code === 'ER_NET_PACKET_TOO_LARGE' || (error.code === 'ECONNRESET' && limit && packet > limit * 0.85))) throw reportTooLarge(bytes, packet, limit);
    throw error;
  }
}
// What a staging database must allow: reports of a realistic 18-week syllabus are about 1 MB once escaped, and grow with longer text.
const MIN_PACKET_BYTES = 16 * 1024 * 1024;
async function packetLimitOf(db) {
  try { const [rows] = await db.query('SELECT @@max_allowed_packet AS limit_bytes'); const n = Number(rows && rows[0] && rows[0].limit_bytes); return Number.isFinite(n) && n > 0 ? n : null; } catch { return null; }
}
const mb = (n) => (n / (1024 * 1024)).toFixed(2);
function reportTooLarge(bytes, packet, limit) {
  return httpError(507, `The checking report is too large for this database to store (about ${mb(packet)} MB; the database accepts ${limit ? mb(limit) : 'a smaller'} MB per write). Nothing was saved and the syllabus is unchanged. Ask the system administrator to raise the database setting max_allowed_packet to at least ${mb(MIN_PACKET_BYTES)} MB (docs/deployment/DATABASE-REQUIREMENTS.md).`,
    { code: 'report_too_large', reportBytes: bytes, packetBytes: packet, limitBytes: limit, requiredMinimumBytes: MIN_PACKET_BYTES });
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
      for (const j of [...(report.hybrid?.alignment?.judgements || []), ...(report.hybrid?.academicV2?.alignment?.judgements || [])]) {
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
module.exports = { mastersFor, saveReport, readReport, reusableJudgements, correctionHistory, recordReviewOf };
