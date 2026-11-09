'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {authorize}=require('../../../scripts/po-controlled-activation/rollout.cjs');
const migration=require('../../db/official-po-migration.cjs');
const official=require('../../../src/data/officialProgramOutcomes.json');
const identity={database:'explicit_review_target',hostname:'test-host',port:3306,datadir:'test-only'};
const ids=[1,2,3,4],expected='reviewed-before-hash';
test('PO rollout targets exactly four supported selections and three distinct source masters',()=>{
 assert.deepEqual(migration.CODES,['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE']);
 assert.equal(Object.values(official.programs).filter(p=>p.outcomes).length,3);
 for(const [code,n]of [['BSIT',9],['BSIE',13],['BSCPE',13]])assert.deepEqual(official.programs[code].outcomes.map(p=>p.no),Array.from({length:n},(_,i)=>i+1));
 assert.equal(official.programs['BSIT-CYBERSECURITY'].inheritsFrom,'BSIT');assert.equal(official.programs['BSIT-CYBERSECURITY'].outcomes,undefined);
 assert.equal(official.programs['BSIT-CYBERSECURITY'].curriculumSource,'BSIT');
 migration.verifySources();
});
test('obsolete direct ILO PO10 tags require review even beside a copied corrected PO list',async()=>{
 const content={meta:{program:'BSIT'},outcomes:{pos:official.programs.BSIT.outcomes},clos:[],plan:[{ilos:[{tags:['po:10']}]}]};
 const db={query:async(sql,p)=>{if(sql.includes('information_schema.tables'))return [[{table_name:p[0]}]];if(sql==='SELECT * FROM syllabi')return [[{syllabus_id:789,content:JSON.stringify(content)}]];return [[]];}};
 const impacts=await migration.impacts(db,{programs:[]});assert.equal(impacts.length,1);assert.deepEqual(impacts[0].obsoleteMappings,[{rowIndex:0,iloIndex:0,po:10}]);assert.equal(impacts[0].proposedMappings,null);
});
test('existing-environment rollout refuses absent, unconfirmed, stale or wrong-target authorization',()=>{
 const valid={confirmed:true,authorizedBy:'Synthetic test operator',authorizationRecord:'Synthetic authorization test only',migrationId:migration.ID,databaseIdentityHash:migration.hash(identity),beforeHash:expected,programIds:ids};
 const input={config:{mode:'existing'},identity,ids,expected,maintenance:true};
 for(const receipt of [null,{...valid,confirmed:false},{...valid,beforeHash:'stale'},{...valid,databaseIdentityHash:'other'},{...valid,programIds:[1,2,3,99]}])assert.throws(()=>authorize({...input,receipt}),/authorization/);
 assert.throws(()=>authorize({...input,receipt:valid,maintenance:false}),/maintenance/);assert.doesNotThrow(()=>authorize({...input,receipt:valid}));
});
test('isolated mode cannot authorize a normal development database identity',()=>{
 assert.throws(()=>authorize({config:{mode:'isolated',host:'127.0.0.1',port:43308},identity,ids,expected,maintenance:true}),/isolated/);
});
test('curriculum-only historical remediation has a precise reference-review status',async()=>{
 const {assertRecordReview}=require('../programPoReferences');const db={query:async()=>[[{migration_id:'synthetic',details_json:JSON.stringify({curriculumReview:{previousProgram:'BSIT-CYBERSECURITY',proposedProgram:'BSIT',automaticRewrite:false}})}]]};
 await assert.rejects(()=>assertRecordReview(db,123),e=>e.status===409&&e.body?.code==='curriculum_reference_review_required'&&e.body.reviewRequirements.automaticRewrite===false);
});
test('builder copies corrected reference provenance once and preserves existing faculty-owned mappings on reopening',async()=>{
 const {applyCourse}=await import('../../../src/lib/syllabusModel.js');
 const source=official.programs.BSIT;
 const draft={meta:{program:'BSIT-CYBERSECURITY'},clos:[],plan:[]};
 const course={id:44,code:'IT 204',title:'Synthetic selection',program:{code:'BSIT-CYBERSECURITY'},clos:[{id:'new',pos:[1],egas:[1]}],standards:{vision:'Unchanged',mission:{lead:'Unchanged',items:[]},egas:[{no:1,name:'Existing EGA'}],pos:source.outcomes,poReference:{id:'version-BSIT',version:official.version,sourceFile:source.sourceFile,sourceSha256:source.sha256,institutionalApproval:'not_recorded'}}};
 const applied=applyCourse(draft,course);assert.equal(applied.meta.program,'BSIT-CYBERSECURITY');assert.equal(applied.outcomes.pos.length,9);assert.equal(applied.outcomes.poReference.version,official.version);
 const historical={...applied,clos:[{id:'original',pos:[10]}],outcomes:{...applied.outcomes,pos:[{no:10,text:'Historical wording'}]}};
 const reopened=applyCourse(historical,course);assert.deepEqual(reopened.outcomes,historical.outcomes);assert.deepEqual(reopened.clos,historical.clos);assert.equal(historical.clos[0].pos[0],10);
});
