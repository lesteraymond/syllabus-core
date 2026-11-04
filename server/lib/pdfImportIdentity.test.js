const test=require('node:test');
const assert=require('node:assert/strict');
const {contextFor}=require('./pdfImportIdentity');
test('preview context reads only the selected program approved curricula, with no record writes',async()=>{
  const queries=[];
  const db={query:async(sql,params)=>{queries.push({sql,params});return sql.includes('JOIN programs')?[[{course_id:25,code:'IT-202',title:'SYSTEM INTEGRATION AND ARCHITECTURE 1',program_code:'BSIT-CYBERSECURITY'}]]:[[{reference_id:4,program_code:'BSIT-CYBERSECURITY',curriculum_year:'2025-2026',courses_json:JSON.stringify([{code:'IT-202',title:'SYSTEM INTEGRATION AND ARCHITECTURE 1'}])}]];}};
  const result=await contextFor(db,25);
  assert.equal(result.selected.program,'BSIT-CYBERSECURITY');assert.equal(result.curricula[0].curriculumYear,'2025-2026');
  assert.deepEqual(queries[1].params,['BSIT-CYBERSECURITY']);assert.ok(queries.every(q=>q.sql.startsWith('SELECT')));
});
test('missing subject or unavailable reference table provides no unverifiable Apply identity',async()=>{
  assert.deepEqual(await contextFor({query:async()=>[[]]},25),{selected:null,curricula:[]});
  const result=await contextFor({query:async sql=>{if(sql.includes('JOIN programs'))return [[{course_id:25,code:'MA 7',title:'Calculus',program_code:'BSIE'}]];throw Object.assign(Error(),{code:'ER_NO_SUCH_TABLE'});}},25);
  assert.deepEqual(result.curricula,[]);
});
