'use strict';
// Structural boundary only. Missing optional data stays missing; completeness,
// mapping validity and academic meaning remain the existing checker's work.
const {httpError}=require('../http');
function validateInput(content,masters) {
  const fail=path=>{throw httpError(400,'Invalid structured academic preview input.',{code:'academic_v2_invalid_input',field:path});};
  const object=(v,p)=>{if(!v||typeof v!=='object'||Array.isArray(v))fail(p);};
  const optionalObject=(v,p)=>{if(v!==undefined)object(v,p);};
  const text=(v,p)=>{if(v!==undefined&&v!==null&&typeof v!=='string')fail(p);};
  const array=(v,p,visit)=>{if(v===undefined)return;if(!Array.isArray(v))fail(p);v.forEach((x,i)=>visit(x,`${p}[${i}]`));};
  const texts=(v,p)=>array(v,p,text);
  const scalar=(v,p)=>{if(v!==null&&!['undefined','string','number','boolean'].includes(typeof v))fail(p);};
  function outcome(v,p){object(v,p);for(const k of ['name','short','text'])text(v[k],p+'.'+k);array(v.egas,p+'.egas',scalar);scalar(v.no,p+'.no');}
  function institution(v,p){if(v===undefined)return;object(v,p);text(v.vision,p+'.vision');if(v.mission!==undefined){object(v.mission,p+'.mission');text(v.mission.lead,p+'.mission.lead');texts(v.mission.items,p+'.mission.items');}array(v.egas,p+'.egas',outcome);array(v.pos,p+'.pos',outcome);}
  object(content,'content');object(masters,'masters');
  optionalObject(content.meta,'content.meta');for(const k of ['title','code','program','prereq','curriculumYear','schoolYear'])text(content.meta?.[k],'content.meta.'+k);
  array(content.description,'content.description',(x,p)=>{object(x,p);text(x.t,p+'.t');});
  array(content.clos,'content.clos',(x,p)=>{object(x,p);for(const k of ['id','title','statement','level'])text(x[k],p+'.'+k);array(x.pos,p+'.pos',scalar);array(x.egas,p+'.egas',scalar);});
  array(content.plan,'content.plan',(r,p)=>{object(r,p);for(const k of ['contents','activities','tasks','values','kind'])text(r[k],p+'.'+k);scalar(r.week,p+'.week');array(r.ilos,p+'.ilos',(i,q)=>{object(i,q);text(i.text,q+'.text');texts(i.tags,q+'.tags');});});
  array(content.reqs,'content.reqs',(x,p)=>{object(x,p);text(x.t,p+'.t');});
  if(content.refs!==undefined){object(content.refs,'content.refs');for(const [k,g] of Object.entries(content.refs)){object(g,'content.refs.'+k);array(g.items,'content.refs.'+k+'.items',(x,p)=>{object(x,p);text(x.t,p+'.t');});}}
  if(content.grading!==undefined){object(content.grading,'content.grading');optionalObject(content.grading.override,'content.grading.override');array(content.grading.rows,'content.grading.rows',(x,p)=>{object(x,p);text(x.label,p+'.label');scalar(x.pct,p+'.pct');});}
  institution(content.outcomes,'content.outcomes');
  if(content.catalog!==undefined){object(content.catalog,'content.catalog');institution(content.catalog.institution,'content.catalog.institution');if(content.catalog.program!==undefined&&content.catalog.program!==null){object(content.catalog.program,'content.catalog.program');array(content.catalog.program.pos,'content.catalog.program.pos',outcome);array(content.catalog.program.egas,'content.catalog.program.egas',outcome);}}
  institution(masters.institution,'masters.institution');array(masters.pos,'masters.pos',outcome);
  array(masters.curricula,'masters.curricula',(r,p)=>{object(r,p);array(r.courses,p+'.courses',(c,q)=>{object(c,q);for(const k of ['code','title','prereq'])text(c[k],q+'.'+k);});});
  if(masters.valueDefinitions!==undefined){object(masters.valueDefinitions,'masters.valueDefinitions');const d=masters.valueDefinitions.definitions;if(d!==undefined&&!Array.isArray(d))optionalObject(d,'masters.valueDefinitions.definitions');if(Array.isArray(d))d.forEach((x,i)=>object(x,'masters.valueDefinitions.definitions['+i+']'));}
}
module.exports={validateInput};
