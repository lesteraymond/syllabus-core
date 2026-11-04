import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require=createRequire(import.meta.url),root=process.cwd();
const pdfjs=await import('../../server/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const {positionedText,vectorBoxes}=require('../../server/lib/pdfGeometry');
const {recoverTables,tableBands,textLines}=require('../../server/lib/pdfLayout');
const {createCanvas}=require('../../server/node_modules/@napi-rs/canvas');
const out=path.join(root,'docs/lcup-po-correction');
const result={version:'lcup-po-2026-10-29',authorization:'User instruction 2026-10-29: IT101 / IE403 / CPE404 authoritative',programs:{}};
for(const [code,file,count] of [['BSIT','IT-101-Introduction-to-Computing-.pdf',9],['BSIE','IE-403-Operation-Management.pdf',13],['BSCPE','CPE-404-Digital-Signal-Processing.pdf',13]]){
  const bytes=await fs.readFile(path.join(root,'docs/academic-references',file));
  const task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true}),pdf=await task.promise;
  const geometry=[];
  for(let n=1;n<=Math.min(4,pdf.numPages);n++){
    const page=await pdf.getPage(n),viewport=page.getViewport({scale:1}),text=await page.getTextContent();
    geometry.push({number:n,width:viewport.width,height:viewport.height,items:positionedText(text.items,viewport),boxes:vectorBoxes(await page.getOperatorList(),pdfjs,viewport)});
    if(n===2||n===3){const v=page.getViewport({scale:1.4}),canvas=createCanvas(Math.ceil(v.width),Math.ceil(v.height));await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;await fs.writeFile(path.join(out,`${code}-p${n}.png`),canvas.toBuffer('image/png'));}
  }
  const columns=[];let active=false;
  for(const page of geometry)for(const band of tableBands(page)){
    const cells=band.xs.slice(0,-1).map((_,i)=>textLines(page.items.filter(t=>{const x=t.x+Math.min(t.width/2,3),y=t.y+t.height/2;return x>=band.xs[i]-1&&x<band.xs[i+1]-1&&y>band.top+1&&y<band.bottom-1;})).join('\n'));
    if(cells.length===3&&/PROGRAM\s+OUTCOMES/.test(cells[1])){active=true;continue;}
    if(cells.length===6)active=false;
    if(active&&cells.length===3&&cells[1])columns.push({page:page.number,text:cells[1]});
  }
  const text=columns.map(c=>c.text).join('\n'),labels=[...text.matchAll(/\bPO\s*(\d+)\s*[.:]/gi)];
  const outcomes=labels.map((m,i)=>{const raw=text.slice(m.index,labels[i+1]?.index??text.length).trim();let offset=0;const pages=columns.filter(c=>{const start=offset;offset+=c.text.length+1;return start<m.index+raw.length&&offset-1>m.index;}).map(c=>c.page);return {no:+m[1],short:`PO ${m[1]}`,text:raw.slice(m[0].length).replace(/\s+/g,' ').trim(),egas:[],sourcePages:pages,raw};});
  if(outcomes.length!==count||outcomes.some((p,i)=>p.no!==i+1))throw Error(`Incomplete PO extraction ${code}`);
  result.programs[code]={sourceFile:`docs/academic-references/${file}`,sha256:createHash('sha256').update(bytes).digest('hex'),outcomes,ambiguities:[]};
  await task.destroy();
}
result.programs['BSIT-CYBERSECURITY']={inheritsFrom:'BSIT',curriculum:'2025-2026 (unchanged; not an outcome source)'};
await fs.writeFile(path.join(out,'official-data.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
