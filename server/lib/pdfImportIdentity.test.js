const test=require('node:test');
const assert=require('node:assert/strict');
const {contextFor}=require('./pdfImportIdentity');

const row={course_id:25,code:'IT-202',title:'System Integration',program_id:9,program_code:'BSIT-CYBERSECURITY',semester:'1st Semester',year_level:2,prerequisite:null,curriculum_year:'2031-2032',lecture_units:null,lab_units:null};
test('preview context is the administrator\'s own subject, with no curriculum on file and no record writes',async()=>{
  const queries=[];
  const result=await contextFor({query:async(sql,p)=>{queries.push(sql);if(!/FROM courses c JOIN programs p/.test(sql))throw new Error('unexpected query: '+sql);return [p[0]===25||p[0]===9?[row]:[]];}},25);
  assert.deepEqual(result.selected,{id:25,program:'BSIT-CYBERSECURITY',code:'IT-202',title:'System Integration'});
  assert.deepEqual(result.curricula,[{id:'subject:25',origin:'admin',program:'BSIT-CYBERSECURITY',curriculumYear:'2031-2032',status:'approved',courses:[{code:'IT-202',title:'System Integration'}]}]);
  assert.ok(queries.every(q=>/^SELECT/.test(q)));
});
test('a missing subject provides no unverifiable Apply identity',async()=>{
  assert.deepEqual(await contextFor({query:async()=>[[]]},25),{selected:null,curricula:[]});
});
