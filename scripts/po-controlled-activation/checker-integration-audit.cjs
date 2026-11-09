'use strict';
// READ ONLY. Exports public academic references and hashes, never faculty text.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mysql=require('../../server/node_modules/mysql2/promise');
const {findProgram,loadResolvedProgram}=require('../../server/lib/programs');
const {mastersFor}=require('../../server/lib/syllabuscheck/repository');
const {assertRecordReview}=require('../../server/lib/programPoReferences');
const official=require('../../src/data/officialProgramOutcomes.json');
const OUT=path.resolve(__dirname,'../../docs/po-checker-integration'),TMP=path.resolve(__dirname,'../../tmp/po-checker-integration');
const CODES=['BSIT','BSIE','BSCPE','BSIT-CYBERSECURITY'];
async function audit(mode='before'){
 const safety=require('./development-safety.cjs');
 fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(TMP,{recursive:true});
 const connection=await mysql.createConnection(safety.config());
 try{
  const identity=safety.assertDevelopment(await safety.identityOf(connection));await connection.query('START TRANSACTION READ ONLY');
  const db={query:(sql,args)=>{if(!/^\s*(SELECT|SHOW)\b/i.test(sql))throw Error('Development audit forbids writes');return connection.query(sql,args);}};
  const full=await safety.inventory(db),references=[],subjects=[];
  for(const code of CODES){const program=await loadResolvedProgram(db,await findProgram(db,code)),canonical=code==='BSIT-CYBERSECURITY'?'BSIT':code;
   assert.deepEqual(program.pos.map(p=>[p.no,p.short,p.text]),official.programs[canonical].outcomes.map(p=>[p.no,p.short,p.text]));assert.equal(program.poReference.version,official.version);assert.equal(program.poReference.institutionalApproval,'not_recorded');
   const masters=await mastersFor(db,{meta:{program:code}});assert.equal(masters.curricula.length,1);
   const wanted=code==='BSIE'?'IE402':code==='BSCPE'?'CPE304':'IT202';
   const curriculum=masters.curricula[0],course=curriculum.courses.find(c=>String(c.code).replace(/[^A-Z0-9]/gi,'').toUpperCase()===wanted);assert.ok(course,code+' requested course must exist in approved curriculum');
   const [catalog]=await db.query('SELECT course_id,code,program_id FROM courses WHERE program_id=? ORDER BY course_id',[program.id]);
   const selection=catalog.find(c=>String(c.code).replace(/[^A-Z0-9]/gi,'').toUpperCase()===wanted);
   const selectedSubject=selection?await require('../../server/lib/courses').loadCourse(db,selection.course_id):null;
   if(selectedSubject){assert.deepEqual(selectedSubject.standards.pos.map(p=>[p.no,p.text]),program.pos.map(p=>[p.no,p.text]));assert.equal(selectedSubject.program.code,code);}
   references.push({code,program,masters});subjects.push({code,course,existingCatalogCourseId:selection?.course_id||null,catalogSubjectPoCount:selectedSubject?.standards.pos.length??null,catalogAuthoredCloCount:selectedSubject?.clos.length??null,curriculumId:curriculum.id,curriculumYear:curriculum.curriculumYear,sourceProgram:canonical,poReferenceId:program.poReference.id});
  }
  const [active]=await db.query('SELECT program_id,reference_id FROM program_po_reference_active ORDER BY program_id');assert.equal(active.length,3);
  const [reviews]=await db.query('SELECT entity_id,status,details_json FROM program_po_reference_remediation ORDER BY entity_id');assert.deepEqual(reviews.map(r=>r.entity_id),[43,93,97,99,100,101,102,110]);
  const historical=[];
  for(const row of reviews){assert.equal(row.status,'needs_review');const detail=JSON.parse(row.details_json);const [[syllabus]]=await db.query('SELECT content FROM syllabi WHERE syllabus_id=?',[row.entity_id]);
   const contentSha256=safety.sha(syllabus.content||'');if(detail.contentSha256)assert.equal(contentSha256,detail.contentSha256,'Historical content changed since activation: '+row.entity_id);
   let status;try{await assertRecordReview(db,row.entity_id);}catch(e){status=e.body?.code;}assert.equal(status,row.entity_id===110?'curriculum_reference_review_required':'po_mapping_remediation_required');
   historical.push({syllabusId:row.entity_id,status:row.status,contentSha256,reviewCode:status,proposedMappings:detail.proposedMappings});
  }
  const institution=references[0].masters.institution;
  const report={generatedAt:new Date().toISOString(),developmentTarget:{host:identity.configuredHost,port:identity.configuredPort,database:identity.configuredName,identityHash:identity.databaseIdentityHash},programs:references.map(r=>({code:r.code,count:r.program.pos.length,referenceId:r.program.poReference.id,referenceVersion:r.program.poReference.version,source:r.program.inheritedFrom?.code||r.code,curriculumIds:r.masters.curricula.map(c=>c.id)})),subjects,historical,canonicalActive:active,fullInventory:full.tables.map(({ddl,...r})=>r),fullInventoryHash:full.hash,readOnly:true};
  if(mode==='before')fs.writeFileSync(path.join(OUT,'references.json'),JSON.stringify({references,subjects,institution},null,2));
  else{const before=JSON.parse(fs.readFileSync(path.join(OUT,'audit-before.json'),'utf8'));report.developmentUnchanged=report.fullInventoryHash===before.fullInventoryHash;report.changesDuringVerification=report.fullInventory.filter(t=>{const old=before.fullInventory.find(b=>b.name===t.name);return !old||old.sha256!==t.sha256||old.ddlSha256!==t.ddlSha256;}).map(t=>{const old=before.fullInventory.find(b=>b.name===t.name);return {table:t.name,beforeRows:old?.rows??null,afterRows:t.rows,dataChanged:old?.sha256!==t.sha256,schemaChanged:old?.ddlSha256!==t.ddlSha256,beforeDataSha256:old?.sha256??null,afterDataSha256:t.sha256};});report.historicalReviewContentsUnchanged=JSON.stringify(report.historical)===JSON.stringify(before.historical);}
  fs.writeFileSync(path.join(OUT,'audit-'+mode+'.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({readOnly:true,programs:report.programs,subjects,reviewCount:historical.length,allDevelopmentTables:full.tables.length,developmentUnchanged:report.developmentUnchanged??null}));
 }finally{await connection.rollback();await connection.end();}
}
module.exports={OUT,TMP,CODES};
if(require.main===module)audit(process.argv[2]).catch(e=>{console.error(e.message);process.exitCode=1;});
