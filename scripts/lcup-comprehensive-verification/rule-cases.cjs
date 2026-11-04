'use strict';
const F=require('../../server/lib/compliance/fixtures');
const standard=require('../../server/lib/compliance/standard-v4.json');
const set=(o,p,v)=>{const keys=p.split('.'),last=keys.pop();for(const k of keys)o=o[k];o[last]=v;};
function scenario(rule,mode){
 const c=F.good(),ctx=F.ctx();ctx.preparedBy='Synthetic Preparer';
 c.grading.override={on:true,term:'Class Standing (60%) + Examination (40%)',final:'Prelim Grade + Midterm Grade + Final Grade'};
 const id=rule.id;
 if(mode==='positive')return {c,ctx};
 const mutations={
  'T-01':()=>c.meta.code='', 'T-02':()=>c.meta.title='', 'T-03':()=>c.meta.program='', 'T-04':()=>c.description=[], 'T-05':()=>c.meta.prereq='', 'T-06':()=>c.meta.lecture='unusable', 'T-07':()=>c.clos=[], 'T-08':()=>c.plan.forEach(r=>r.ilos=[]),
  'T-09':()=>ctx.catalog.institution.vision='Different reference', 'T-10':()=>ctx.catalog.institution.mission.lead='Different reference', 'T-11':()=>ctx.catalog.program.egas[0].name='Different reference', 'T-12':()=>ctx.catalog.program.pos[0].text='Different reference',
  'T-13':()=>c.plan[0].ilos[0].tags=[], 'T-14':()=>c.plan[0].ilos[0].tags=['clo:missing'], 'T-15':()=>delete c.plan[0].activities, 'T-16':()=>c.plan[0].contents='', 'T-17':()=>c.plan[0].ilos.unshift({id:'gap',text:'',tags:[]}), 'T-18':()=>c.plan.reverse(),
  'T-19':()=>c.reqs=c.reqs.slice(0,2), 'T-20':()=>c.reqs[0].t='1. Manually numbered', 'T-21':()=>c.refs.books={na:false,items:[]}, 'T-22':()=>c.refs.books.na=true, 'T-23':()=>c.grading.rows=[], 'T-24':()=>c.grading.rows[0].pct=59, 'T-25':()=>c.grading.override.term='', 'T-26':()=>c.grading.override.final='Final Grade', 'T-27':()=>ctx.preparedBy='',
  'C-01':()=>c.description[0].t='Only a short description', 'C-02':()=>c.plan[0].ilos[0].text='Explain', 'C-03':()=>c.clos[0].statement='', 'C-04':()=>{c.refs.books.items=[];c.refs.program.items=[];},
  'P-01':()=>c.clos[0].egas=[], 'P-02':()=>c.clos[0].pos=[], 'P-03':()=>c.clos[0].egas=[1], 'P-04':()=>c.clos[0].pos=[2,1], 'P-05':()=>c.plan.forEach(r=>r.ilos.forEach(i=>i.tags=i.tags.filter(t=>t!=='clo:c4'))),
  'A-01':()=>c.plan[0].tasks='', 'A-02':()=>c.plan.forEach(r=>{if(r.ilos.some(i=>i.tags.includes('clo:c1')))r.tasks='';}), 'A-03':()=>c.plan=c.plan.filter(r=>!r.contents.includes('MIDTERM EXAM')), 'A-04':()=>c.grading.rows[1].label='Participation',
  'H-01':()=>{c.meta.lecture='0';c.meta.lab='0';}, 'H-02':()=>c.plan=c.plan.filter(r=>r.week!=='4'), 'H-03':()=>c.plan[0].week='19', 'H-04':()=>c.plan[1].week='1',
  'R-01':()=>Object.values(c.refs).forEach(g=>g.items=[]), 'R-02':()=>c.refs.books.items[0].t='A reference without publication date.', 'R-03':()=>c.refs.books.items[0].t='Old, A. (2015). A reference. Publisher.'
 };
 if(mode==='negative'){mutations[id]();return {c,ctx};}
 // Genuine near-boundary examples, rather than relabeling the normal fixture.
 if(rule.check==='nonEmpty'&&rule.params.path?.startsWith('meta.'))set(c,rule.params.path,'X');
 if(id==='T-06'||id==='H-01'){c.meta.lecture='0';c.meta.lab='1';}
 if(id==='T-07')c.clos=c.clos.slice(0,1);
 if(id==='T-08')c.plan=c.plan.slice(0,1);
 if(id==='T-13')c.plan[0].ilos[0].tags=['clo:c1'];
 if(id==='T-14')c.plan[0].ilos[0].tags=['clo:c4','po:5','ega:4'];
 if(id==='T-15')c.plan[0].activities=''; // column exists; T-16 covers content
 if(id==='T-17')c.plan[0].ilos.push({id:'last-blank',text:'',tags:[]});
 if(id==='T-18')c.plan[0].week='1-1';
 if(id==='T-19')c.reqs=c.reqs.slice(0,3);
 if(id==='T-20')c.reqs[0].t='Attend class 1';
 if(id==='T-21'||id==='T-22')c.refs.electronics={na:true,items:[]};
 if(id==='T-23')c.grading.rows=[{id:'g',label:'Examination',pct:100}];
 if(id==='T-24')c.grading.rows[0].pct=60+1e-10;
 if(id==='T-25')c.grading.override={on:false,term:'',final:''};
 if(id==='T-26')c.grading.override={on:true,term:'CS (60%) + Ex (40%)',final:'Prelim Grade + Midterm Grade + Final Grade'};
 if(id==='T-27')ctx.preparedBy='A';
 if(id==='C-01')c.description[0].t=Array(30).fill('word').join(' ');
 if(id==='C-02')c.plan[0].ilos[0].text='Explain four relevant words';
 if(id==='C-03'){c.clos[0].title='A';c.clos[0].statement='B';}
 if(id==='C-04'){c.refs.books.items=c.refs.books.items.slice(0,1);c.refs.program.items=[];c.refs.electronics={na:false,items:[{id:'third',t:'A. (2026). Reference.'}]};}
 if(id==='P-01')c.clos[0].egas=[4];
 if(id==='P-02')c.clos[0].pos=[5];
 if(id==='P-03'){c.clos[0].pos=[5];c.clos[0].egas=[1];}
 if(id==='P-04'){c.clos[0].pos=[1,5];c.clos[0].egas=[1,4];}
 if(id==='H-02'||id==='H-03'||id==='H-04'){c.plan[0].week='1-2';c.plan.splice(1,1);}
 if(id==='R-02')c.refs.books.items[0].t='A. (2026). Reference.';
 if(id==='R-03')c.refs.books.items[0].t='A. (2016). Exactly ten years old.';
 return {c,ctx};
}
module.exports={scenario,standard,F};
