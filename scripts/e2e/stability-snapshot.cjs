'use strict';
// Copy source bytes without touching another session's working files or .git.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'docs/e2e-stability-2026-11-05'),WORK=path.join(ROOT,'tmp/e2e-stability-2026-11-05');
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(WORK,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function files(){
 const listed=cp.execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:ROOT,maxBuffer:16*1024*1024}).toString().split('\0');
 return [...new Set(listed.filter(f=>f&&!/^tmp\/|^docs\/e2e-stability-2026-11-05\//.test(f)&&!/^server\/(uploads|private|sample_cor)\//.test(f)&&!/(^|\/)\.env(?:\.|$)/.test(f)&&fs.existsSync(path.join(ROOT,f))))].sort();
}
function manifest(){return files().map(file=>{const b=fs.readFileSync(path.join(ROOT,file));return {file,bytes:b.length,sha256:sha(b)};});}
function main(action){
 const now=manifest(),hash=sha(JSON.stringify(now));const result={capturedAt:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT}).toString().trim(),sourceHash:hash,files:now};
 if(action==='capture'){
  const dest=path.join(WORK,'source-'+Date.now());
  fs.writeFileSync(path.join(OUT,'capture-attempt-'+Date.now()+'.json'),JSON.stringify({...result,snapshot:dest,status:'candidate; not valid until final manifest is written'},null,2));
  for(const file of now){const target=path.join(dest,file.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(ROOT,file.file),target);if(sha(fs.readFileSync(target))!==file.sha256)throw Error('Source changed during copy: '+file.file);}
  const after=manifest();if(sha(JSON.stringify(after))!==hash)throw Error('Source changed during capture; do not test this snapshot');
  for(const rel of ['node_modules','server/node_modules'])fs.symlinkSync(path.join(ROOT,rel),path.join(dest,rel),'junction');
  result.snapshot=dest;result.sharedDependencyJunctions=['node_modules','server/node_modules'];
  fs.writeFileSync(path.join(OUT,'source-state.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(OUT,'git-status.txt'),cp.execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:ROOT,maxBuffer:32*1024*1024}));
 }else{
  const initial=JSON.parse(fs.readFileSync(path.join(OUT,'source-state.json'),'utf8'));const old=new Map(initial.files.map(f=>[f.file,f.sha256])),current=new Map(now.map(f=>[f.file,f.sha256]));
  result.changedSinceSnapshot=[...new Set([...old.keys(),...current.keys()])].filter(f=>old.get(f)!==current.get(f));
  fs.writeFileSync(path.join(OUT,'working-tree-'+action+'.json'),JSON.stringify(result,null,2));
 }
 console.log(JSON.stringify({files:now.length,sourceHash:hash,snapshot:result.snapshot,changedSinceSnapshot:result.changedSinceSnapshot}));
}
if(require.main===module)main(process.argv[2]||'capture');
