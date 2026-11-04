'use strict';
// Run original regression tests without rewriting their frozen report outputs.
// Only paths within the old comprehensive report directory are redirected.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),old=path.join(root,'docs/lcup-comprehensive-verification'),out=path.join(root,'docs/lcup-v2-evaluation/reruns');fs.mkdirSync(out,{recursive:true});
const isOld=p=>typeof p==='string'&&path.resolve(p).startsWith(old+path.sep);
const write=fs.writeFileSync,read=fs.readFileSync;
fs.writeFileSync=function(p,...args){return write.call(this,isOld(p)?path.join(out,path.relative(old,path.resolve(p))):p,...args);};
fs.readFileSync=function(p,...args){return read.call(this,isOld(p)&&path.basename(p)==='disposable-config.json'?path.join(out,'disposable-config.json'):p,...args);};
