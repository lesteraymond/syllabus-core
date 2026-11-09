'use strict';
// Versioned Program Outcome references (tables program_po_reference_versions / _active / _audit).
// Policy: the Admin encodes the references the VPAA supplies, so what an authorized Admin saves IS the institution's reference. There is no draft, approval or publication step.
//   * Saving a program's Program Outcomes (routes/programs.js) creates the next version in the same transaction and makes it the one in force for that program row, and so for that academic
//     year. The live program_outcomes rows stay equal to it (loadProgram refuses a drift). Every academic year has its own program rows.
//   * A version is immutable: its outcomes_json is never updated and is re-verified against its hash on every read. The previous version stays, as 'superseded', so history is never rewritten.
//   * Every save records who, when, the previous version and the new one (program_po_reference_audit, which also keeps the before and after of EGA and Vision/Mission saves).
//   * A version only says which statements are the reference. It never says a faculty mapping is aligned: Claude still judges each CLO against the statement, and PO-to-EGA needs its own evidence.
//   * A subject stays on the version it was given until the Admin uses Apply to Subjects (withAssignedVersion). A syllabus still on an earlier version is refused for checking until reviewed, so an
//     outdated reference is never treated as aligned with the newer one, and no CLO mapping is rewritten.
//   * The source versions made by the controlled PO migration (official-po-migration.cjs) keep working unchanged, and a later Admin save supersedes them like any other version.
const crypto = require('node:crypto');
const { httpError, inTransaction } = require('./http');
const basis = rows => (Array.isArray(rows) ? rows : []).map(p => ({ no: Number(p?.no), text: String(p?.text || '').replace(/\s+/g, ' ').trim() })).sort((a,b)=>a.no-b.no);
const sameBasis = (a,b) => JSON.stringify(basis(a)) === JSON.stringify(basis(b));
const hasPoMappings = content => (content?.clos || []).some(c => c.pos?.length) ||
  (content?.plan || []).some(row => (row.ilos || []).some(ilo => (ilo.tags || []).some(tag => /^po:\d+$/.test(tag))));
// The canonical form of a list of outcomes, and its hash: what an administrator-published version is identified and verified by.
const canonicalOutcomes = rows => (Array.isArray(rows) ? rows : []).map(p => ({ no: Number(p?.no), short: String(p?.short ?? '').trim(), text: String(p?.text ?? '').replace(/\s+/g, ' ').trim(), egas: [...new Set((Array.isArray(p?.egas) ? p.egas : []).map(Number))].sort((a, b) => a - b) })).sort((a, b) => a.no - b.no);
const hashOutcomes = rows => crypto.createHash('sha256').update(JSON.stringify(canonicalOutcomes(rows))).digest('hex');
const ADMIN_SOURCE = 'admin-published:';
const isAdminPublished = row => String(row?.source_file || '').startsWith(ADMIN_SOURCE);
const missing = error => error && (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR');
const MIGRATION_HINT = 'Program Outcome reference versions are not set up on this database. Apply the migration npm run migrate-po-reference-publication first (it needs separate authorization).';

// A version row as a reference. A version saved by an Admin is verified against its own hash; a source version keeps its recorded provenance.
function referenceOf(row) {
  const outcomes = JSON.parse(row.outcomes_json);
  const adminPublished = isAdminPublished(row);
  if (adminPublished && hashOutcomes(outcomes) !== row.source_sha256) throw httpError(409, 'The saved PO reference does not match its recorded hash: it was changed after it was saved. Checking is refused until an administrator resolves it.', { code: 'po_reference_integrity', referenceId: row.reference_id });
  const official = require('../../src/data/officialProgramOutcomes.json');
  const known = !adminPublished && row.version_label === official.version && Object.values(official.programs).some(r => r.sha256 === row.source_sha256 && r.sourceFile === row.source_file);
  return { id: row.reference_id, version: row.version_label, sourceFile: row.source_file, sourceSha256: row.source_sha256, outcomes, kind: adminPublished ? 'admin_published' : 'official_source', status: row.status || 'published', academicYear: row.academic_year || null, contentSha256: hashOutcomes(outcomes), ...(known ? { authorization: official.authorization, institutionalApproval: 'not_recorded' } : {}) };
}
// The published version in force for a program row, or null. Never a draft. A version published by an administrator is re-verified against its own hash on every read.
async function activeFor(db, programId) {
  try {
    const [rows] = await db.query('SELECT r.*, r.program_id AS source_program_id FROM program_po_reference_active a JOIN program_po_reference_versions r ON r.reference_id = a.reference_id WHERE a.program_id = ?', [programId]);
    const row = rows[0];
    if(!row)return null;
    // How this program row came to use the version: it owns it ('owner'), or an administrator explicitly associated an existing published version of the SAME program code from another academic
    // year with it ('adopted'). The association columns exist only after migrate-po-reference-publication; before it every pointer is an owner pointer.
    let association = { kind: 'owner' };
    try { const [extra] = await db.query('SELECT association, associated_by, associated_at, association_note FROM program_po_reference_active WHERE program_id = ?', [programId]); if (extra[0] && extra[0].association === 'adopted') association = { kind: 'adopted', by: extra[0].associated_by ?? null, at: extra[0].associated_at || null, note: extra[0].association_note || null }; } catch (error) { if (error.code !== 'ER_BAD_FIELD_ERROR') throw error; }
    if(row.source_program_id!==undefined&&Number(row.source_program_id)!==Number(programId)){
      let sameProgram = false;
      if (association.kind === 'adopted') { const [codes] = await db.query('SELECT program_id, code FROM programs WHERE program_id IN (?, ?)', [Number(row.source_program_id), Number(programId)]); sameProgram = codes.length === 2 && codes[0].code === codes[1].code; }
      if (!sameProgram) throw httpError(409,'The active PO reference belongs to another program. Review the reference assignment.',{code:'po_reference_drift'});
    }
    if (row.status && !['published', 'superseded'].includes(row.status)) throw httpError(409, 'The active PO reference is not a published version. Ask an administrator to review it.', { code: 'po_reference_drift' });
    return { ...referenceOf(row), association: association.kind, ownerProgramId: Number(row.source_program_id), ...(association.kind === 'adopted' ? { associatedBy: association.by, associatedAt: association.at, associationNote: association.note } : {}), publishedAt: row.published_at || null, publishedBy: row.published_by ?? null, supersedes: row.supersedes_reference_id || null };
  } catch(error) { if(missing(error))return null; throw error; }
}
function assertContentBasis(content, reference) {
  if (!reference || !hasPoMappings(content)) return;
  const authored = content.outcomes?.pos || content.catalog?.program?.pos;
  if (!sameBasis(authored, reference.outcomes)) throw httpError(409, 'This syllabus uses a previous or unknown Program Outcome reference. Review its CLO–PO mappings with faculty and explicitly adopt the current reference before checking. No mapping was changed.', {code:'po_reference_review_required', referenceId:reference.id, referenceVersion:reference.version});
}
// A database without the version tables cannot keep the previous version, so a versioned program stays locked there rather than being overwritten.
async function requireMutable(db, programId) {
  if (await publicationReady(db)) return;
  if (await activeFor(db, programId)) throw httpError(409, MIGRATION_HINT, { code: 'po_reference_versioned' });
}
// The open review of a syllabus, or null. Only reads. Reading a saved report asks this, because a report stays readable while its syllabus waits for review; everything that makes a new judgment
// goes through assertRecordReview below and is refused.
async function recordReviewOf(db, syllabusId) {
  if(!syllabusId)return null;
  try{
    const [rows]=await db.query("SELECT migration_id, details_json FROM program_po_reference_remediation WHERE entity_type='syllabus' AND entity_id=? AND status='needs_review'",[syllabusId]);
    if(!rows.length)return null;
    let details;try{details=JSON.parse(rows[0].details_json);}catch{}
    const curriculum=!!(details?.curriculumReview&&!details.cloMappings);
    return {code:curriculum?'curriculum_reference_review_required':'po_mapping_remediation_required',syllabusId,migrationId:rows[0].migration_id,...(curriculum?{reviewRequirements:details.curriculumReview}:{})};
  }catch(error){if(error.code==='ER_NO_SUCH_TABLE')return null;throw error;}
}
// Which of these syllabi have an open record review: Map(syllabus id -> review code). Only reads. One query however many ids, for the lists.
async function openRecordReviews(db, ids) {
  const out=new Map();
  if(!ids.length)return out;
  try{
    const [rows]=await db.query("SELECT entity_id, details_json FROM program_po_reference_remediation WHERE entity_type='syllabus' AND status='needs_review' AND entity_id IN (?)",[ids]);
    for(const row of rows){let details;try{details=JSON.parse(row.details_json);}catch{}out.set(row.entity_id,details?.curriculumReview&&!details.cloMappings?'curriculum_reference_review_required':'po_mapping_remediation_required');}
    return out;
  }catch(error){if(error.code==='ER_NO_SUCH_TABLE')return out;throw error;}
}
async function assertRecordReview(db, syllabusId) {
  const review=await recordReviewOf(db,syllabusId);
  if(!review)return;
  throw httpError(409,review.code==='curriculum_reference_review_required'?'This historical syllabus uses a previous curriculum reference. Review its course identity and approved BSIT curriculum selection before checking. No saved content was changed.':'This historical syllabus has unresolved PO mapping remediation. Replacing only the PO text cannot confirm old CLO mappings. Faculty must review them; saved content and reports remain unchanged.',review);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Saved versions, history and audit (routes/programs.js saves; routes/programPoReference.js shows)
// ---------------------------------------------------------------------------------------------------------------------------------------------
async function publicationReady(db) {
  try {
    const [cols] = await db.query("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'program_po_reference_versions'");
    const have = new Set(cols.map(c => c.name));
    const [[audit]] = await db.query("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'program_po_reference_audit'");
    const [acols] = await db.query("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'program_po_reference_active'");
    const haveActive = new Set(acols.map(c => c.name));
    return ['status', 'academic_year', 'published_by', 'published_at', 'supersedes_reference_id'].every(c => have.has(c)) && ['association', 'associated_by', 'associated_at', 'association_note'].every(c => haveActive.has(c)) && Number(audit.n) === 1;
  } catch (error) { if (missing(error)) return false; throw error; }
}
async function requirePublication(db) { if (!await publicationReady(db)) throw httpError(503, MIGRATION_HINT, { code: 'po_reference_publication_not_set_up' }); }
const rowOutcomes = row => JSON.parse(row.outcomes_json);
const summaryOf = row => ({ id: row.reference_id, version: row.version_label, status: row.status || 'published', academicYear: row.academic_year || null, kind: isAdminPublished(row) ? 'admin_published' : 'official_source',
  publishedAt: row.published_at || null, publishedBy: row.published_by ?? null, supersedes: row.supersedes_reference_id || null, sha256: row.source_sha256, outcomeCount: rowOutcomes(row).length, ownerProgramId: row.program_id });
// { active, history, changes, liveStatus }: liveStatus says whether the live program_outcomes rows are covered by a saved version ('published') or predate versioning ('unpublished').
async function overview(db, programId) {
  const ready = await publicationReady(db);
  let rows = [];
  try { [rows] = await db.query("SELECT * FROM program_po_reference_versions WHERE program_id = ? AND status <> 'draft' ORDER BY created_at, reference_id", [programId]); } catch (error) { if (!missing(error)) throw error; }
  const active = await activeFor(db, programId);
  const applies = await appliesTo(db, rows.map(r => r.reference_id).concat(active ? [active.id] : []));
  const withYears = r => ({ ...summaryOf(r), appliesTo: applies.get(r.reference_id) || [] });
  let activeRow = rows.find(r => r.reference_id === active?.id);
  if (active && !activeRow) { const [o] = await db.query('SELECT * FROM program_po_reference_versions WHERE reference_id = ?', [active.id]); activeRow = o[0]; }
  return { publicationAvailable: ready, active: active ? { ...withYears(activeRow || {}), outcomes: active.outcomes, association: active.association, ...(active.association === 'adopted' ? { associatedAt: active.associatedAt, associationNote: active.associationNote, ownerProgramId: active.ownerProgramId } : {}) } : null,
    history: rows.map(withYears), changes: ready ? await changesFor(db, programId) : [], liveStatus: active ? 'published' : 'unpublished' };
}
// The change log of one program: who saved what and when, newest first, with the previous and the new version. The full statements stay in details_json; this is the readable line.
async function changesFor(db, programId) {
  const [rows] = await db.query('SELECT a.audit_id, a.action, a.reference_id, a.at, a.details_json, u.first_name, u.last_name, u.email FROM program_po_reference_audit a LEFT JOIN users u ON u.user_id = a.actor_id WHERE a.program_id = ? ORDER BY a.audit_id DESC LIMIT 50', [programId]);
  return rows.map(r => { let d = {}; try { d = JSON.parse(r.details_json) || {}; } catch { /* an unreadable detail is shown without its versions */ }
    return { id: r.audit_id, action: r.action, at: r.at, by: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || null, previous: d.previous || null, next: d.next || null, referenceId: r.reference_id || null }; });
}
// Which program rows (so which academic years) use each version: the owner's and any explicit associations. Read-only; an old database without the pointer table answers none.
async function appliesTo(db, ids) {
  const out = new Map();
  if (!ids.length) return out;
  try {
    const [rows] = await db.query('SELECT a.reference_id, a.program_id, p.code, p.academic_year FROM program_po_reference_active a JOIN programs p ON p.program_id = a.program_id WHERE a.reference_id IN (?)', [ids]);
    let assoc = new Map();
    try { const [x] = await db.query('SELECT program_id, association FROM program_po_reference_active WHERE reference_id IN (?)', [ids]); assoc = new Map(x.map(r => [r.program_id, r.association])); } catch (error) { if (error.code !== 'ER_BAD_FIELD_ERROR') throw error; }
    for (const r of rows) { if (!out.has(r.reference_id)) out.set(r.reference_id, []); out.get(r.reference_id).push({ programId: r.program_id, code: r.code, academicYear: r.academic_year || null, association: assoc.get(r.program_id) || 'owner' }); }
  } catch (error) { if (!missing(error)) throw error; }
  return out;
}
// What would change between two lists of outcomes: added, removed and changed (statement, short name or EGA mapping) by PO number. Pure.
function compareOutcomes(fromRows, toRows) {
  const a = new Map(canonicalOutcomes(fromRows).map(p => [p.no, p])), b = new Map(canonicalOutcomes(toRows).map(p => [p.no, p]));
  const added = [...b.values()].filter(p => !a.has(p.no)), removed = [...a.values()].filter(p => !b.has(p.no));
  const changed = [...b.values()].filter(p => a.has(p.no) && JSON.stringify(a.get(p.no)) !== JSON.stringify(p)).map(p => ({ no: p.no, before: a.get(p.no), after: p, fields: ['short', 'text', 'egas'].filter(k => JSON.stringify(a.get(p.no)[k]) !== JSON.stringify(p[k])) }));
  return { added, removed, changed, unchanged: [...b.values()].filter(p => a.has(p.no) && JSON.stringify(a.get(p.no)) === JSON.stringify(p)).length, identical: !added.length && !removed.length && !changed.length };
}
const liveOutcomesOf = async (db, programId) => {
  const [live] = await db.query('SELECT po_no, short_name, outcome_text, ega_nos FROM program_outcomes WHERE program_id = ? ORDER BY po_no', [programId]);
  return canonicalOutcomes(live.map(p => ({ no: p.po_no, short: p.short_name, text: p.outcome_text, egas: String(p.ega_nos || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0) })));
};
// Compare any two things the Admin can see for a program: 'active' (the version in force), 'live' (the program_outcomes rows) or the id of a version of the same program code.
async function compare(db, program, fromKey, toKey) {
  await requirePublication(db);
  const resolve = async key => {
    if (key === 'live') return { key, label: 'live rows', outcomes: await liveOutcomesOf(db, program.program_id) };
    if (key === 'active') { const a = await activeFor(db, program.program_id); if (!a) throw httpError(404, 'This program has no published version.'); return { key, label: a.version, outcomes: a.outcomes }; }
    const [r] = await db.query('SELECT v.*, p.code AS owner_code FROM program_po_reference_versions v JOIN programs p ON p.program_id = v.program_id WHERE v.reference_id = ?', [String(key)]);
    if (!r[0] || r[0].status === 'draft' || r[0].owner_code !== program.code) throw httpError(404, 'That version is not available for this program.');
    return { key, label: r[0].version_label, outcomes: rowOutcomes(r[0]) };
  };
  const from = await resolve(fromKey), to = await resolve(toKey);
  return { from: { key: from.key, label: from.label, count: from.outcomes.length }, to: { key: to.key, label: to.label, count: to.outcomes.length }, ...compareOutcomes(from.outcomes, to.outcomes) };
}
// Published versions of the SAME program code in other academic years that this program row could be associated with (read-only).
async function candidates(db, program) {
  await requirePublication(db);
  const [rows] = await db.query("SELECT v.*, p.academic_year AS owner_year FROM program_po_reference_versions v JOIN programs p ON p.program_id = v.program_id WHERE p.code = ? AND p.program_id <> ? AND v.status IN ('published','superseded') ORDER BY v.created_at, v.reference_id", [program.code, program.program_id]);
  const liveRows = await liveOutcomesOf(db, program.program_id);
  return rows.map(r => ({ ...summaryOf(r), ownerYear: r.owner_year || null, identicalToLiveRows: JSON.stringify(canonicalOutcomes(rowOutcomes(r))) === JSON.stringify(liveRows) }));
}
// Explicit association of an existing published version (of the same program code, from another academic year) with this program row: the version is NOT copied, so its source identity, hash,
// saver and owner year stay exactly as saved; the association records who made it and why. The program row live Program Outcomes must already equal the
// version statements, otherwise saving this year's outcomes makes a version of its own. A catalog copied from another year is linked this way by itself (linkCopy).
async function adopt(db, program, { actorId, referenceId, note }) {
  await requirePublication(db);
  const why = String(note || '').trim();
  if (why.length > 500) throw httpError(400, 'The note is too long (max 500 characters).');
  return inTransaction(db, async conn => {
    await conn.query('SELECT program_id FROM programs WHERE program_id = ? FOR UPDATE', [program.program_id]);
    const [vr] = await conn.query('SELECT v.*, p.code AS owner_code FROM program_po_reference_versions v JOIN programs p ON p.program_id = v.program_id WHERE v.reference_id = ? FOR UPDATE', [String(referenceId || '')]);
    const v = vr[0];
    if (!v || v.status === 'draft') throw httpError(404, 'That published version does not exist.');
    if (v.owner_code !== program.code) throw httpError(409, 'A version can only be used by the same program in another academic year.', { code: 'po_reference_other_program' });
    if (Number(v.program_id) === Number(program.program_id)) throw httpError(409, 'That version already belongs to this program year.', { code: 'po_reference_already_owned' });
    const outcomes = rowOutcomes(v);
    if (isAdminPublished(v) && hashOutcomes(outcomes) !== v.source_sha256) throw httpError(409, 'That version does not match its recorded hash and cannot be used.', { code: 'po_reference_integrity', referenceId: v.reference_id });
    if (JSON.stringify(await liveOutcomesOf(conn, program.program_id)) !== JSON.stringify(canonicalOutcomes(outcomes))) throw httpError(409, 'This program year has different Program Outcomes from that version. Saving its outcomes makes a version of its own.', { code: 'po_reference_adopt_mismatch' });
    const [egas] = await conn.query('SELECT ega_no FROM program_egas WHERE program_id = ?', [program.program_id]);
    const have = new Set(egas.map(e => e.ega_no)), needed = [...new Set(canonicalOutcomes(outcomes).flatMap(p => p.egas))];
    if (needed.some(n => !have.has(n))) throw httpError(409, 'That version maps Program Outcomes to an EGA that this program year does not have.', { code: 'po_reference_ega_mismatch' });
    const [cur] = await conn.query('SELECT r.reference_id, r.program_id FROM program_po_reference_active a JOIN program_po_reference_versions r ON r.reference_id = a.reference_id WHERE a.program_id = ?', [program.program_id]);
    if (cur[0] && cur[0].reference_id === v.reference_id) throw httpError(409, 'This program year already uses that version.', { code: 'po_reference_nothing_to_publish' });
    if (cur[0] && Number(cur[0].program_id) === Number(program.program_id)) await conn.query("UPDATE program_po_reference_versions SET status = 'superseded' WHERE reference_id = ?", [cur[0].reference_id]);
    await conn.query("REPLACE INTO program_po_reference_active (program_id, reference_id, association, associated_by, associated_at, association_note) VALUES (?, ?, 'adopted', ?, ?, ?)", [program.program_id, v.reference_id, actorId ?? null, new Date(), why || null]);
    await conn.query('UPDATE programs SET pos_version = pos_version + 1 WHERE program_id = ?', [program.program_id]);
    await audit(conn, { referenceId: v.reference_id, programId: program.program_id, action: 'adopted', actorId, details: { ownerProgramId: v.program_id, ownerYear: v.academic_year || null, previous: cur[0] ? { id: cur[0].reference_id } : null, next: { id: v.reference_id, version: v.version_label, sha256: v.source_sha256 }, note: why || null } });
    return { id: v.reference_id, version: v.version_label, sha256: v.source_sha256, association: 'adopted', ownerProgramId: v.program_id, ownerYear: v.academic_year || null, replaced: cur[0] ? cur[0].reference_id : null };
  });
}
async function audit(conn, { referenceId = null, programId, action, actorId, details }) {
  await conn.query('INSERT INTO program_po_reference_audit (reference_id, program_id, action, actor_id, details_json) VALUES (?, ?, ?, ?, ?)', [referenceId, programId, action, actorId ?? null, JSON.stringify(details || {})]);
}
// A database that has not been migrated has no audit table: the save itself still goes ahead, exactly as it always has.
async function auditIfReady(conn, entry) {
  try { await audit(conn, entry); } catch (error) { if (!missing(error)) throw error; }
}
// The next version of a program's Program Outcomes, in force from now on for this program row. Runs INSIDE the caller's transaction, after the live rows were written, with the program row locked,
// so the rows and the version can never differ. Nothing happens when the statements did not change, or on a database that has no version tables yet. The previous version is kept as 'superseded';
// a version this row only ADOPTED belongs to another academic year and is still in force there, so it is never superseded from here.
async function saveVersion(conn, program, pos, { actorId, academicYear, action = 'saved' }) {
  if (!await publicationReady(conn)) return null;
  const outcomes = canonicalOutcomes(pos);
  const [activeRows] = await conn.query('SELECT r.* FROM program_po_reference_active a JOIN program_po_reference_versions r ON r.reference_id = a.reference_id WHERE a.program_id = ?', [program.program_id]);
  const active = activeRows[0] || null;
  if (!outcomes.length) { if (active) throw httpError(400, 'A program with a saved reference needs at least one Program Outcome.'); return null; }
  if (active && JSON.stringify(canonicalOutcomes(rowOutcomes(active))) === JSON.stringify(outcomes)) return null;
  const [[count]] = await conn.query("SELECT COUNT(*) AS n FROM program_po_reference_versions WHERE program_id = ? AND status <> 'draft'", [program.program_id]);
  const n = Number(count.n) + 1, label = `${program.code}-${academicYear || 'unscoped'}-v${n}`.replace(/[^A-Za-z0-9._–-]/g, '-'), id = `po-${program.program_id}-v${n}`, sha256 = hashOutcomes(outcomes);
  await conn.query("INSERT INTO program_po_reference_versions (reference_id, program_id, version_label, source_file, source_sha256, outcomes_json, status, academic_year, published_by, published_at, supersedes_reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)",
    [id, program.program_id, label, `${ADMIN_SOURCE}${program.code}:${academicYear || ''}`, sha256, JSON.stringify(outcomes), academicYear || null, actorId ?? null, new Date(), active ? active.reference_id : null, actorId ?? null]);
  if (active && Number(active.program_id) === Number(program.program_id)) await conn.query("UPDATE program_po_reference_versions SET status = 'superseded' WHERE reference_id = ?", [active.reference_id]);
  await conn.query('REPLACE INTO program_po_reference_active (program_id, reference_id) VALUES (?, ?)', [program.program_id, id]);
  await audit(conn, { referenceId: id, programId: program.program_id, action, actorId, details: { previous: active ? { id: active.reference_id, version: active.version_label, sha256: active.source_sha256 } : null, next: { id, version: label, sha256 }, academicYear: academicYear || null, outcomes: outcomes.length } });
  return { id, version: label, sha256, supersedes: active ? active.reference_id : null, outcomes: outcomes.length };
}
// A program whose rows were saved before versioning existed has no version yet: this records those rows as its first one (the Admin's single click in the outcomes dialog).
async function recordLive(db, program, { actorId, academicYear }) {
  await requirePublication(db);
  return inTransaction(db, async conn => {
    await conn.query('SELECT program_id FROM programs WHERE program_id = ? FOR UPDATE', [program.program_id]);
    const [activeRows] = await conn.query('SELECT reference_id FROM program_po_reference_active WHERE program_id = ?', [program.program_id]);
    if (activeRows.length) throw httpError(409, 'This program already has a version in force.', { code: 'po_reference_nothing_to_publish' });
    const live = await liveOutcomesOf(conn, program.program_id);
    if (!live.length) throw httpError(400, 'A Program Outcome reference needs at least one outcome.');
    return saveVersion(conn, program, live, { actorId, academicYear, action: 'recorded' });
  });
}
// A catalog copied into a new academic year keeps using the version its source program uses: same statements, so no copy of the version, only a pointer recording where it came from.
async function linkCopy(conn, fromProgramId, toProgramId, { actorId, fromYear }) {
  try {
    const [rows] = await conn.query('SELECT reference_id FROM program_po_reference_active WHERE program_id = ?', [fromProgramId]);
    const source = rows && rows[0];
    if (!source) return false;
    await conn.query("INSERT INTO program_po_reference_active (program_id, reference_id, association, associated_by, associated_at, association_note) VALUES (?, ?, 'adopted', ?, ?, ?)", [toProgramId, source.reference_id, actorId ?? null, new Date(), `Copied with the catalog from ${fromYear}`]);
    await audit(conn, { referenceId: source.reference_id, programId: toProgramId, action: 'copied', actorId, details: { previous: null, next: { id: source.reference_id }, fromProgramId, fromYear } });
    return true;
  } catch (error) { if (missing(error)) return false; throw error; }
}
// A subject keeps the reference it was given until the Admin uses Apply to Subjects, even after a newer version is in force for its program. A subject stores its copy of the outcomes, not a
// version id, so the version is found by its statements. A copy that matches no version predates versioning: such a subject of a program with a source version has always been read through that
// source version, so it stays on it. Otherwise the subject keeps exactly what it stores. Saved rows are only read here: the stored copy and every CLO mapping stay as they are.
async function withAssignedVersion(db, programId, standards) {
  const [rows] = await db.query("SELECT v.* FROM program_po_reference_versions v JOIN programs p ON p.program_id = v.program_id JOIN programs me ON me.code = p.code AND me.program_id = ? WHERE v.status <> 'draft' ORDER BY (v.program_id = ?) DESC, v.created_at DESC, v.reference_id DESC", [programId, programId]);
  const same = rows.find(r => sameBasis(standards.pos, rowOutcomes(r)));
  if (same) return { ...standards, poReference: referenceOf(same) };
  const source = rows.find(r => !isAdminPublished(r));
  if (source) { const reference = referenceOf(source); return { ...standards, pos: reference.outcomes, poReference: reference }; }
  return standards;
}
// The academic year of a program row (null on a database that has no such column).
async function academicYearOf(db, programId) {
  try { const [[row]] = await db.query('SELECT academic_year FROM programs WHERE program_id = ?', [programId]); return (row && row.academic_year) || null; } catch (error) { if (error.code === 'ER_BAD_FIELD_ERROR') return null; throw error; }
}
// A new program's first references, in the transaction that creates it: its Program Outcomes become version 1, so it needs no further step before the checker can use them.
async function recordNewProgram(conn, program, typed, { actorId, academicYear }) {
  await auditIfReady(conn, { programId: program.program_id, action: 'ega_saved', actorId, details: { previous: null, next: { version: 'EGA v1', egas: statementsOfEgas(typed.egas) }, academicYear: academicYear || null } });
  return saveVersion(conn, program, typed.pos, { actorId, academicYear });
}
const statementsOfEgas = rows => rows.map(e => ({ no: Number(e.no), name: e.name, short: e.short })).sort((a, b) => a.no - b.no);
module.exports = { basis, sameBasis, hasPoMappings, activeFor, assertContentBasis, assertRecordReview, recordReviewOf, openRecordReviews, requireMutable, canonicalOutcomes, hashOutcomes, publicationReady, overview, saveVersion, recordNewProgram, recordLive, withAssignedVersion, linkCopy, academicYearOf, auditIfReady, statementsOfEgas, adopt, compare, compareOutcomes, candidates, appliesTo, ADMIN_SOURCE };
