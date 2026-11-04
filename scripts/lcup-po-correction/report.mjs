import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'docs/lcup-po-correction');
const official=JSON.parse(await fs.readFile(path.join(root,'src/data/officialProgramOutcomes.json'),'utf8'));
const plan=JSON.parse(await fs.readFile(path.join(out,'live-readonly-final-plan.json'),'utf8'));
let text='# Official LCUP PO data: '+official.version+'\n\nAuthority: the user designated IT101, IE403 and CPE404 as the official references. Numbering and wording are preserved; whitespace/line wraps are normalized. Exact line text, page numbers and PDF SHA-256 hashes are retained in the canonical JSON. No PO–EGA crosswalk is inferred.\n\n';
for(const [code,ref] of Object.entries(official.programs)){
 text+=`## ${code}\n\n`;
 if(ref.inheritsFrom){text+='Inherits exactly the nine BSIT POs above through `program_outcome_sources`. No competing PO copy. Its 2025–2026 curriculum is unchanged.\n\n';continue;}
 text+=`Source: ${ref.sourceFile}\n\nSHA-256: \`${ref.sha256}\`\n\n| PO | PDF pages | Exact wording (whitespace normalized) |\n|---|---|---|\n`;
 for(const p of ref.outcomes)text+=`| ${p.no} | ${p.sourcePages.join(', ')} | ${p.text.replaceAll('|','\\|')} |\n`;
 text+='\n';
}
text+='## Source wording notes\n\nIT101 PO5 contains an opening curly quotation mark with no closing mark: `Preserve and promote “Filipino historical and cultural heritage;`. IT101 PO6 prints `design and appropriate solution;`. Engineering PO13 prints `people materials, implementation, equipment and energy.` These are retained verbatim; no “an”, closing quote, comma or alternative noun was invented. All 35 numbered statements are legible and complete as printed, including engineering PO12. IE403 and CPE404 punctuation differs and remains program-specific. PO–EGA crosswalks are not supplied by these columns; new references use empty crosswalk arrays, with old mappings retained in backup/history.\n';
await fs.writeFile(path.join(out,'exact-program-outcomes.md'),text);
const worksheets=plan.impacts.map(item=>({...item,targetReference:official.version,targetProgram:item.program==='BSIT-CYBERSECURITY'?'BSIT':item.program,
 facultyReview:{reviewer:null,reviewDate:null,decisions:item.cloMappings.map(c=>({cloId:c.id,oldPoNumbers:c.pos,newPoNumbers:null,decision:null,rationale:null})),directIloDecisions:(item.directIloPoMappings||[]).map(m=>({...m,newPoNumbers:null,decision:null,rationale:null})),referenceAdoptionConfirmed:false},
 action:'Do not apply this worksheet automatically. Faculty must explicitly confirm meanings. Preserve approved/historical versions and saved reports.'}));
await fs.writeFile(path.join(out,'remediation-worksheets.json'),JSON.stringify(worksheets,null,2)+'\n');
let impact='# Database and service impact\n\n## Actual existing records (read-only)\n\n';
impact+='| Syllabus ID | Program | Status | CLOs requiring PO-context review | Direct ILO–PO mapping entries |\n|---|---|---|---|---|\n';
for(const item of plan.impacts.filter(i=>i.type==='syllabus'))impact+=`| ${item.id} | ${item.program} | ${item.status} | ${item.cloMappings.map(c=>c.id+': '+c.pos.join(',')).join('; ')} | ${(item.directIloPoMappings||[]).length} |\n`;
impact+='\nNo proposed new PO numbers or faculty judgments have been assigned. Four BSIT records and three BSIE records require review; no mapped Cyber/BSCpE record or catalog CLO row was identified in this database snapshot. A record with no current mappings is not evidence that old versions have no mappings. Historical versions/reports remain immutable and are fingerprinted, not rewritten.\n\n## Existing foreign keys involving programs/courses/outcomes\n\n| Table.column | Referenced key | Constraint |\n|---|---|---|\n';
const initial=JSON.parse(await fs.readFile(path.join(out,'live-readonly-plan.json'),'utf8'));
for(const f of initial.foreignKeys.filter(f=>['programs','courses','program_outcomes'].includes(f.referenced_table_name)||f.table_name==='program_outcomes'))impact+=`| ${f.table_name}.${f.column_name} | ${f.referenced_table_name}.${f.referenced_column_name} | ${f.constraint_name} |\n`;
impact+='\n`course_clos.po_nos` and syllabus JSON mappings have no foreign key to `(program_id, po_no)`; a number-only update cannot preserve their meaning. Program IDs and all course/assignment foreign keys remain unchanged.\n\n## New foreign keys\n\n- program_outcome_sources.program_id/source_program_id → programs.program_id (the existing intended mechanism).\n- program_po_reference_versions.program_id → programs.program_id.\n- program_po_reference_active.program_id → programs.program_id; reference_id → program_po_reference_versions.reference_id.\n- program_po_reference_remediation.migration_id → program_po_reference_migrations.migration_id.\n- Immutable reference versions restrict program deletion; they must not be cascade-deleted to erase history. Existing deletion handlers may surface the FK refusal; no delete workflow was exercised or changed here.\n';
await fs.writeFile(path.join(out,'database-impact.md'),impact);
console.log('Exact data, impact assessment and blank faculty remediation worksheets prepared.');
