import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'rolldown';
const root=path.resolve(import.meta.dirname,'../..'),dir=path.join(root,'tmp/lcup-requirements');
await fs.mkdir(dir,{recursive:true});
const file=path.join(dir,'lesson-authoring.test.mjs');
await build({input:path.join(root,'tests/lesson-authoring.test.jsx'),platform:'node',external:['react','react-dom/client','react/jsx-runtime','happy-dom','node:test','node:assert/strict'],transform:{define:{'import.meta.env':'{}'},jsx:{runtime:'automatic'}},output:{file},logLevel:'silent'});
const result=spawnSync(process.execPath,['--test',file],{cwd:root,stdio:'inherit'});process.exitCode=result.status??1;
