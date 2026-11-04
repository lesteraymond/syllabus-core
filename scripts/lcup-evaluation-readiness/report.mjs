import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'docs/lcup-evaluation-readiness');
const a=JSON.parse(await fs.readFile(path.join(out,'current-pos.json'),'utf8'));
const r=JSON.parse(await fs.readFile(path.join(out,'academic-readiness.json'),'utf8'));
let text='# Current Program Outcome verification\n\nRead-only local database snapshot: '+a.verifiedAt+'. Session read-only flag: '+a.server.readOnly+'. All '+a.queries.length+' recorded data queries are SELECT. No faculty syllabus records were read and no database records were written. Source PDFs were verified by their existing SHA-256 hashes; raw wording/page evidence comes from the unchanged verified fixtures.\n\n';
text+='| Program | Current own / resolved POs | Inheritance | Complete PO12 |\n|---|---|---|---|\n';
for(const [code,p] of Object.entries(a.programs))text+=`| ${code} | ${p.ownPos.length} / ${p.resolvedPos.length} | ${p.inheritedFrom?.code||'Own stored set'} | ${code==='BSIE'||code==='BSCPE'?a.completeEngineeringPO12[code]:'Not applicable'} |\n`;
text+='\nThe BSIT seed has ten POs and exactly matches current database rows. `server/db/local-outcome-data.cjs` separately preserves the nine printed IT202 POs; that reference transcription does not replace the database master. Engineering transcriptions contain thirteen POs and mark PO12 sourceIncomplete; the current database resolver returns its text without that marker. The outcome-sharing code exists in `server/lib/programs.js`, but `program_outcome_sources` does not exist in this database. Cyber Security therefore resolves its own identical copy.\n\n';
for(const c of a.comparisons){
  text+=`## ${c.key}: current database vs faculty reference\n\nDatabase count: ${c.dbCount}; PDF count: ${c.pdfCount}. Matching numbered text: ${c.numbered.filter(p=>p.exactTextMatch).length}/${c.numbered.length}.\n\n| PO | PDF page(s) | Faculty reference wording | Current database wording at the same number | Exact match |\n|---|---|---|---|---|\n`;
  for(const p of c.numbered)text+=`| ${p.no} | ${p.pages.join(', ')} | ${p.pdf.replaceAll('|','\\|')} | ${(p.database||'Missing').replaceAll('|','\\|')} | ${p.exactTextMatch} |\n`;
  if(c.program==='BSIT')text+=`\nDatabase PO10 has no numbered counterpart in IT202: “${a.programs.BSIT.ownPos[9].text}”\n`;
  text+='\n';
}
text+='## Supporting engineering references\n\nIE403 and CPE404 both give PO12 in full on PDF page3:\n\n> '+a.engineering.find(v=>v.key==='ie403').pos[11].text+'\n\nBoth current engineering database masters, IE402 p3 and CpE304 p3 end after “and in”. Full supporting wording was not adopted or substituted.\n\nBeyond PO12, IE402 vs IE403 differs in punctuation at PO2/4/5/7/10/11; CpE304 vs CPE404 at PO4/7; the engineering baselines differ at PO11; the two supporting documents differ at PO2/5/7/10. The full unchanged comparison is in ../lcup-approved-offline/engineering-po-comparison.md. The remaining lexical wording agrees; there is still no independent PO–EGA crosswalk, and BSCpE PO13 applicability remains a decision.\n';
await fs.writeFile(path.join(out,'program-outcomes.md'),text);
let summary='# Academic relationship readiness\n\nThis inventories production pairsOf on the three unchanged fixtures, against the fresh database masters, with current stages only and no link fetching or AI. Ready means evidence can be put before faculty for labeling; every expected label remains null. It does not authorize an external run or assert that a pair is ALIGNED.\n\n| Relationship | IT202 ready / total | IE402 ready / total | CpE304 ready / total |\n|---|---|---|---|\n';
for(const type of [...new Set(r.results.flatMap(v=>Object.keys(v.counts)))])summary+=`| ${type} | `+r.results.map(v=>`${v.counts[type]?.ready||0} / ${v.counts[type]?.total||0}`).join(' | ')+' |\n';
summary+='\nHolds: all19 IT202 tagged CLO–PO pairs and its four CLO-anyPO pairs await the authoritative BSIT list/numbering; CpE304 CLO2–PO12 awaits a complete adopted reference, and CLO4–PO13 awaits applicability confirmation. All eight engineering CLO-anyPO pairs include the incomplete full list and are held. EGA pairs have names but no richer approved attribute definitions; faculty must establish the intended interpretation.\n\nThese are evaluation-inventory holds, not new production gates. The current checker would still build these pairs if called; this verification does not change its rules or stages. Any future authorized evaluation runner must enforce the reviewed scope before calling a provider.\n\nUntagged outcomes and missing ILO evidence:\n\n';
for(const item of r.results){
  summary+=`## ${item.key}\n\n`;
  for(const v of item.untagged)summary+=`- Week ${v.week}, PDF page(s) ${v.sourcePages.join(', ')}: ${v.text}\n`;
  if(!item.untagged.length)summary+='- No untagged lesson outcomes.\n';
  for(const v of item.missingIlos)summary+=`- Week ${v.week}, PDF page(s) ${v.pages.join(', ')}: no source ILO; no relationship can be fabricated.\n`;
  summary+='\n';
}
summary+='Expected faculty judgments, intended targets for missing tags, ambiguous boundaries and source-specific policies remain pending. No source wording, PO, mapping or verified fixture was changed.\n';
await fs.writeFile(path.join(out,'academic-readiness.md'),summary);
console.log('Current PO comparison and academic readiness documents generated.');
