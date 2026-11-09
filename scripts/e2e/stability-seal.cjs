'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'docs/e2e-stability-2026-11-05');
const state=JSON.parse(fs.readFileSync(path.join(OUT,'source-state.json'),'utf8')),base=state.snapshot;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'||['uploads','private','sample_cor'].includes(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=[...['src','server','shared','scripts','tests','public'].filter(d=>fs.existsSync(path.join(base,d))).flatMap(d=>walk(path.join(base,d))),...fs.readdirSync(base).filter(n=>/\.(json|js|mjs|cjs)$/.test(n)).map(n=>path.join(base,n))].sort();
const manifest=files.map(f=>({file:path.relative(base,f).replaceAll('\\','/'),sha256:sha(fs.readFileSync(f))}));
const dependencies=['node_modules/react/package.json','node_modules/vite/package.json','node_modules/playwright-core/package.json','server/node_modules/mysql2/package.json','server/node_modules/express/package.json','server/node_modules/@anthropic-ai/sdk/package.json'].filter(f=>fs.existsSync(path.join(base,f))).map(f=>({file:f,sha256:sha(fs.readFileSync(path.join(base,f)))}));
const result={capturedAt:new Date().toISOString(),head:state.head,snapshot:base,sourceHash:sha(JSON.stringify(manifest)),files:manifest,dependencies,baseCaptureHash:state.sourceHash,node:process.version,configuration:{VITE_NEW_BUILDER:'true',VITE_GOOGLE_CLIENT_ID:'',E2E_DB_PORT:43310,E2E_SKIP_BOOTSTRAP:'1',E2E_NO_DDL:'1',model:'claude-sonnet-5-5 (scripted)',ordinaryDevelopmentPolicyV2:'off/unset',productionActivated:false}};
const mode=process.argv[2]||'seal',file=path.join(OUT,'tested-source.json');
if(mode==='verify'){const old=JSON.parse(fs.readFileSync(file,'utf8'));if(old.sourceHash!==result.sourceHash||JSON.stringify(old.dependencies)!==JSON.stringify(dependencies))throw Error('Frozen test source/dependency manifest changed');console.log(JSON.stringify({verified:true,sourceHash:result.sourceHash,files:manifest.length}));}
else{fs.writeFileSync(file,JSON.stringify(result,null,2));console.log(JSON.stringify({sourceHash:result.sourceHash,files:manifest.length,configuration:result.configuration}));}
