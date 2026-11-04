'use strict';
const {fork}=require('node:child_process'),path=require('node:path');
async function start(){
 const child=fork(path.join(__dirname,'sql-server.cjs'),[],{stdio:['ignore','inherit','inherit','ipc']}),pending=new Map();let next=0;
 const ready=new Promise((resolve,reject)=>{child.on('message',m=>{if(m.ready)return resolve(m);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.value);}});child.on('error',reject);child.on('exit',code=>{if(code)reject(Error('Isolated backend exited '+code));for(const p of pending.values())p.reject(Error('Backend closed'));});});
 const state=await ready,call=(action,data={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});child.send({id,action,...data});});
 return {...state,pool:{query:(sql,params)=>call('query',{sql,params})},masters:(content,syllabusId)=>call('masters',{content,syllabusId}),installReplay:(syllabusId,data)=>call('replay',{syllabusId,data}),sqlSnapshot:()=>call('sql'),storeAdminFixture:()=>call('storeAdminFixture'),close:async()=>{await call('close');await new Promise(resolve=>child.on('exit',resolve));}};
}
module.exports={start};
