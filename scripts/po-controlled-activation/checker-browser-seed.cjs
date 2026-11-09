'use strict';
// Only the identity-verified synthetic server; never imports development config.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mysql=require('../../server/node_modules/mysql2/promise');
const {seed}=require('../e2e/seed-e2e.cjs');
const {loadCourse}=require('../../server/lib/courses');
const h=require('../../server/lib/syllabuscheck/vpaa-conformance/harness');
const input=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/po-checker-integration/references.json'),'utf8'));
async function seedCorrected(name){
 assert.match(name,/^syllabus_e2e_po_\w+$/);const cfg={host:'127.0.0.1',port:43310,user:'root',password:'',database:name,dateStrings:true};
 const db=await mysql.createConnection(cfg);const fixtures=[];
 try{
  const [[identity]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(identity.port,43310);assert.equal(path.resolve(identity.datadir).toLowerCase(),path.resolve('tmp/po-checker-integration/db/data').toLowerCase());
 }finally{await db.end();}
 const seeded=await seed(cfg),conn=await mysql.createConnection(cfg);
 try{
  // Corrected-reference support is deliberately not an automatic application
  // startup migration. Provision its EXISTING DDL only in this scratch schema.
  if(process.env.PO_E2E_PREPROVISIONED!=='1')for(const ddl of require('../../server/db/official-po-migration.cjs').DDL)await conn.query(ddl);
  else for(const table of ['program_po_reference_versions','program_po_reference_active','program_outcome_sources'])await conn.query('SELECT 1 FROM '+table+' LIMIT 1');
  const [[year]]=await conn.query('SELECT label FROM academic_years WHERE is_current=1');const academicYear=year.label;
  const [[faculty]]=await conn.query("SELECT user_id FROM users WHERE email='e2e.faculty@e2e.invalid'");
  await conn.query('UPDATE institution_settings SET vision=?,mission_lead=?,mission_items=? WHERE setting_id=1',[input.institution.vision,input.institution.mission.lead,JSON.stringify(input.institution.mission.items)]);
  await conn.query('DELETE FROM institution_egas');for(const e of input.institution.egas)await conn.query('INSERT INTO institution_egas(ega_no,name,short_name) VALUES(?,?,?)',[e.no,e.name,e.short]);
  await conn.query('DELETE FROM syllabus_check_curricula');
  for(const ref of input.references.filter(r=>r.code!=='BSIT-CYBERSECURITY'))for(const c of ref.masters.curricula)await conn.query("INSERT INTO syllabus_check_curricula(reference_id,program_code,curriculum_year,status,source,courses_json) VALUES(?,?,?,'approved',?,?)",[c.id,c.program,c.curriculumYear,c.source,JSON.stringify(c.courses)]);
  const ids={BSIT:seeded.programId};
  for(const code of ['BSIE','BSCPE','BSIT-CYBERSECURITY']){const r=input.references.find(r=>r.code===code);const [p]=await conn.query('INSERT INTO programs(code,name,academic_year) VALUES(?,?,?)',[code,r.program.name,academicYear]);ids[code]=p.insertId;await conn.query('INSERT INTO faculty_programs(user_id,program_id) VALUES(?,?)',[faculty.user_id,p.insertId]);}
  for(const ref of input.references){
   const id=ids[ref.code];await conn.query('DELETE FROM program_outcomes WHERE program_id=?',[id]);await conn.query('DELETE FROM program_egas WHERE program_id=?',[id]);
   for(const e of ref.program.egas)await conn.query('INSERT INTO program_egas(program_id,ega_no,name,short_name) VALUES(?,?,?,?)',[id,e.no,e.name,e.short]);
   if(ref.code!=='BSIT-CYBERSECURITY'){
    for(const p of ref.program.pos)await conn.query('INSERT INTO program_outcomes(program_id,po_no,short_name,outcome_text,ega_nos) VALUES(?,?,?,?,?)',[id,p.no,p.short,p.text,'']);
    const r=ref.program.poReference;await conn.query('INSERT INTO program_po_reference_versions(reference_id,program_id,version_label,source_file,source_sha256,outcomes_json) VALUES(?,?,?,?,?,?)',[r.id,id,r.version,r.sourceFile,r.sourceSha256,JSON.stringify(r.outcomes)]);await conn.query('INSERT INTO program_po_reference_active(program_id,reference_id) VALUES(?,?)',[id,r.id]);
   }
  }
  await conn.query('INSERT INTO program_outcome_sources(program_id,source_program_id,specialization) VALUES(?,?,?)',[ids['BSIT-CYBERSECURITY'],ids.BSIT,'Cyber Security']);
  for(const [i,selection]of input.subjects.entries()){
   const ref=input.references.find(r=>r.code===selection.code),c=selection.course,courseId=30+i,{content}=h.sample();
   const standards={...input.institution,egas:ref.program.egas,pos:ref.program.pos,poReference:ref.program.poReference,versions:{vision:1,egas:1,pos:1}};
   await conn.query('INSERT INTO courses(course_id,code,title,program_id,standards_json,academic_year,semester,year_level,prerequisite) VALUES(?,?,?,?,?,?,?,?,?)',[courseId,c.code,c.title,ids[selection.code],JSON.stringify(standards),academicYear,c.semester,c.yearLevel,c.prereq]);
   for(const [j,clo]of content.clos.entries())await conn.query('INSERT INTO course_clos(course_id,sort_order,title,clo_level,statement,ega_nos,po_nos) VALUES(?,?,?,?,?,?,?)',[courseId,j,clo.title,h.POLICY.classifications[j],clo.statement,'1','1']);
   await conn.query('INSERT INTO faculty_courses(user_id,course_id) VALUES(?,?)',[faculty.user_id,courseId]);
   const course=await loadCourse(conn,courseId),old=content.clos.map(c=>c.id);content.clos=course.clos;
   content.plan.forEach(r=>r.ilos.forEach(ilo=>{ilo.tags=(ilo.tags||[]).map(t=>t.startsWith('clo:')?'clo:'+course.clos[old.indexOf(t.slice(4))]?.id:t).filter(t=>!t.includes('undefined'));}));
   content.meta={...content.meta,program:selection.code,courseId,code:c.code,title:c.title,prereq:c.prereq,lecture:String(c.lecture),lab:String(c.lab),yearLevel:String(c.yearLevel),curriculumYear:selection.curriculumYear,academicYear,semester:c.semester};const {versions,...authored}=standards;content.outcomes=authored;delete content.catalog;
   fixtures.push({code:selection.code,course,content,source:selection.sourceProgram,referenceId:ref.program.poReference.id,curriculumId:selection.curriculumId,syntheticFacultyMappings:true});
  }
  return {seeded,fixtures};
 }finally{await conn.end();}
}
module.exports={seedCorrected};
