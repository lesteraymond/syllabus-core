'use strict';
// Browser-only timing evidence for E19. No network/auth payloads are recorded.
const fs=require('node:fs'),path=require('node:path');
const L=require('./lib.cjs'),session=L.session;let serial=0;
L.session=async(...args)=>{const s=await session(...args),events=[],id=++serial;const dir=path.resolve('docs/e2e-stability-2026-11-05/traces/'+(process.env.E2E_TRACE_RUN||'run'));fs.mkdirSync(dir,{recursive:true});
 await s.page.exposeFunction('recordSelectTrace',row=>events.push(row));
 await s.page.addInitScript(()=>{const record=(kind,target)=>{const el=target instanceof Element?target:null,combo=el?.closest('[role="combobox"]');window.recordSelectTrace({kind,t:performance.now(),scrollY,tag:el?.tagName||'document',role:el?.getAttribute('role'),label:combo?.getAttribute('aria-label')||null,text:combo?.innerText?.slice(0,65)||null,expanded:combo?.getAttribute('aria-expanded')||null,options:[...document.querySelectorAll('[role="option"]')].map(e=>e.textContent.trim()).slice(0,8)});};for(const name of ['pointerdown','click','scroll'])document.addEventListener(name,e=>record(name,e.target),true);new MutationObserver(rows=>{for(const r of rows)if(r.attributeName==='aria-expanded')record('expanded',r.target);}).observe(document,{attributes:true,subtree:true,attributeFilter:['aria-expanded']});});
 s.page.on('close',()=>fs.writeFileSync(path.join(dir,'page-'+id+'.json'),JSON.stringify(events,null,2)));
 return s;};
