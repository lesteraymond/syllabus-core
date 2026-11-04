import { build } from 'rolldown';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
const file=path.join(root,'scripts/lcup-evaluation-readiness/workflow.bundle.mjs');
await build({input:path.join(root,'scripts/lcup-evaluation-readiness/workflow.test.jsx'),platform:'node',external:['react','react-dom/client','react/jsx-runtime','happy-dom',/^node:/],transform:{define:{'import.meta.env':'{}'},jsx:{runtime:'automatic'}},output:{file},logLevel:'silent'});
const result=spawnSync(process.execPath,['--test','--test-concurrency=1',file],{cwd:root,stdio:'inherit'});
process.exitCode=result.status??1;
