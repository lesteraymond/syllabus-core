import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'rolldown';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),dir=path.join(root,'tmp/lcup-comprehensive-verification');await fs.mkdir(dir,{recursive:true});const file=path.join(dir,'integration.test.mjs');
await build({input:path.join(root,'scripts/lcup-comprehensive-verification/integration.test.jsx'),platform:'node',external:['react','react-dom/client','react/jsx-runtime','happy-dom',/^node:/],transform:{define:{'import.meta.env':'{}'},jsx:{runtime:'automatic'}},output:{file},logLevel:'silent'});
const r=spawnSync(process.execPath,['--test','--test-concurrency=1',...process.argv.slice(2),file],{cwd:root,stdio:'inherit',env:{...process.env,SYLLABUS_CHECK_AI_PROVIDER:'off'}});process.exitCode=r.status??1;
