// Targeted suite only. No eval exporters, migrations, DB connectors or live AI scripts.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/lcup-requirements');
const {groups}=JSON.parse(await fs.readFile(path.join(out,'test-commands.json'),'utf8'));
const results=await Promise.allSettled(groups.map(group=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,group.args,{cwd:root,windowsHide:true});let stdout='',stderr='';
 child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
 child.on('error',reject);child.on('close',async code=>{
  try{await fs.writeFile(path.join(out,group.log),stdout+(stderr?'\nSTDERR:\n'+stderr:''));console.log(`${group.name}: exit ${code} (${group.log})`);resolve({name:group.name,exitCode:code});}catch(error){reject(error);}
 });
})));
if(results.some(result=>result.status==='rejected'||result.value.exitCode!==0))process.exitCode=1;
