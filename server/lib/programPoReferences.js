'use strict';
const { httpError } = require('./http');
const basis = rows => (Array.isArray(rows) ? rows : []).map(p => ({ no: Number(p?.no), text: String(p?.text || '').replace(/\s+/g, ' ').trim() })).sort((a,b)=>a.no-b.no);
const sameBasis = (a,b) => JSON.stringify(basis(a)) === JSON.stringify(basis(b));
const hasPoMappings = content => (content?.clos || []).some(c => c.pos?.length) ||
  (content?.plan || []).some(row => (row.ilos || []).some(ilo => (ilo.tags || []).some(tag => /^po:\d+$/.test(tag))));
async function activeFor(db, programId) {
  try {
    const [rows] = await db.query('SELECT r.reference_id, r.version_label, r.source_file, r.source_sha256, r.outcomes_json FROM program_po_reference_active a JOIN program_po_reference_versions r ON r.reference_id = a.reference_id WHERE a.program_id = ?', [programId]);
    const row = rows[0];
    return row ? { id:row.reference_id, version:row.version_label, sourceFile:row.source_file, sourceSha256:row.source_sha256, outcomes:JSON.parse(row.outcomes_json) } : null;
  } catch(error) { if(error.code === 'ER_NO_SUCH_TABLE')return null; throw error; }
}
function assertContentBasis(content, reference) {
  if (!reference || !hasPoMappings(content)) return;
  const authored = content.outcomes?.pos || content.catalog?.program?.pos;
  if (!sameBasis(authored, reference.outcomes)) throw httpError(409, 'This syllabus uses a previous or unknown Program Outcome reference. Review its CLO–PO mappings with faculty and explicitly adopt the current reference before checking. No mapping was changed.', {code:'po_reference_review_required', referenceId:reference.id, referenceVersion:reference.version});
}
async function requireMutable(db, programId) {
  if(await activeFor(db,programId))throw httpError(409,'These official Program Outcomes use an immutable source version. Prepare an approved new reference version instead of editing it in place.',{code:'po_reference_versioned'});
}
async function assertRecordReview(db, syllabusId) {
  if(!syllabusId)return;
  try{
    const [rows]=await db.query("SELECT migration_id, details_json FROM program_po_reference_remediation WHERE entity_type='syllabus' AND entity_id=? AND status='needs_review'",[syllabusId]);
    if(rows.length)throw httpError(409,'This historical syllabus has unresolved PO mapping remediation. Replacing only the PO text cannot confirm old CLO mappings. Faculty must review them; saved content and reports remain unchanged.',{code:'po_mapping_remediation_required',syllabusId,migrationId:rows[0].migration_id});
  }catch(error){if(error.code==='ER_NO_SUCH_TABLE')return;throw error;}
}
module.exports = { basis, sameBasis, hasPoMappings, activeFor, assertContentBasis, assertRecordReview, requireMutable };
