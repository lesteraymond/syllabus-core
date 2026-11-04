// Test-only source locator. Existing baseline paths are absent in this checkout;
// use ONLY byte-identical approved copies already present in reference-data/.
// No fixture, PDF or production path is changed; a hash mismatch fails closed.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const read=fs.readFile.bind(fs),root=process.cwd(),copies=new Map();
for(const key of ['it202','ie402','cpe304']){
 const f=JSON.parse(await read(path.join(root,'docs/lcup-approved-offline',`${key}.fixture.json`),'utf8'));
 copies.set(path.resolve(root,f.source.file).toLowerCase(),{file:path.join(root,'reference-data',path.basename(f.source.file)),sha256:f.source.sha256});
}
fs.readFile=async(file,options)=>{
 try{return await read(file,options);}catch(error){
  const name=file instanceof URL?fileURLToPath(file):String(file);
  const fallback=copies.get(path.resolve(name).toLowerCase());
  if(error.code!=='ENOENT'||!fallback)throw error;
  const bytes=await read(fallback.file);
  if(createHash('sha256').update(bytes).digest('hex')!==fallback.sha256)throw Error('Approved baseline copy hash mismatch');
  return options?read(fallback.file,options):bytes;
 }
};
