import fs from 'node:fs/promises';
import { out } from './extract.mjs';
const comparisons = JSON.parse(await fs.readFile(`${out}/engineering-pos.json`, 'utf8'));
const byKey = Object.fromEntries(comparisons.map(c=>[c.key,c]));
let text = '# Engineering Program Outcomes: source comparison\n\nLocal-only comparison, 2026-10-28. No official outcomes or database records were changed. Page numbers are PDF page numbers (1-based). Text below normalizes whitespace only; exact line breaks, source labels, pages and SHA-256 values are in `engineering-pos.json` and the source evidence.\n\n';
text += 'IE-403 and CPE-404 are supporting PO references only. Their CLOs, plans and other academic content are not baseline checker inputs.\n\n';
text += 'Both supporting documents print PO12 in full on page 3:\n\n> '+byKey.ie403.pos[11].text+'\n\nThe baseline IE-402 (p3) and CpE304 (p3) stop after “and in”. The completion is evidence for an institutional correction, not permission to alter official records or baseline text.\n\n';
text += '| PO | IE-402 vs IE-403 | CpE304 vs CPE-404 | IE-403 vs CPE-404 |\n|---|---|---|---|\n';
for(let i=0;i<13;i++) {
  const pairs = [['ie402','ie403'],['cpe304','cpe404'],['ie403','cpe404']];
  text += `| ${i+1} | `+pairs.map(([a,b])=>byKey[a].pos[i].text===byKey[b].pos[i].text?'Identical':i===11?'Baseline incomplete':'Punctuation differs').join(' | ')+' |\n';
}
text += '\nBeyond PO12, IE-402 vs IE-403 differs at PO2, PO4, PO5, PO7, PO10 and PO11. CpE304 vs CPE-404 differs at PO4 and PO7. Baseline IE-402 vs CpE304 differs only at PO11 (“and;” / “and”). The two supporting documents differ at PO2, PO5, PO7 and PO10 (period / semicolon). All remaining lexical wording is the same; these are not silent spelling corrections.\n\n';
text += 'The sources do not establish which punctuation is official, whether engineering programs share one formal list, whether the identical PO13 belongs to BSCpE, or a PO–EGA crosswalk. These decisions remain with VPAA/Dean (L2/L3). PO12 is no longer missing from all available sources, but its official adoption/version is still pending.\n\n';
for(const c of comparisons) {
  text += `## ${c.key}: ${c.file}\n\nSHA-256: \`${c.sha256}\`\n\n| PO | PDF pages | Text as sourced (whitespace normalized) |\n|---|---|---|\n`;
  for(const p of c.pos) text += `| ${p.no} | ${p.pages.join(', ')} | ${p.text.replaceAll('|','\\|')} |\n`;
  text += '\n';
}
await fs.writeFile(`${out}/engineering-po-comparison.md`,text);
const baseline = JSON.parse(await fs.readFile(`${out}/deterministic-baseline.json`, 'utf8'));
let findings='# Deterministic baseline findings\n\nExisting Hybrid-2 `engine.coded` only, against the frozen local MySQL export in `masters.json`. No `engine.run`, HTTP link verification or AI stage. No official score or pass/fail is issued. The standard contains 47 rules; production codedStandard omits C-04, R-02 and R-03 as it already did. Base scores below are the existing 44-rule component before Hybrid-2 deductions/gates. Passing mark remains 79.\n\n';
for(const r of baseline.results) {
  findings += `## ${r.key}: ${r.scenario}\n\nBase component: ${r.baseScore}; critical identity flag: ${r.critical}; AI: NOT_EVALUATED; official score/pass: null.\n\n`;
  for(const a of r.adaptations) findings += `- ${a}\n`;
  findings += '\n| Rule | Field | Severity | Classification | Evidence/message |\n|---|---|---|---|---|\n';
  for(const f of r.findings) findings += `| ${f.ruleId||f.id} | ${f.path} | ${f.severity} | ${f.classification.category}${f.classification.also.length ? '; also '+f.classification.also.join(', ') : ''} | ${f.message.replaceAll('|','\\|')} |\n`;
  findings+='\n';
}
findings += 'AI-dependent judgment requiring faculty validation: no labels are assigned for CLO–PO, CLO–EGA or ILO–CLO suitability; course/lesson relevance; activities and assessment; integrated-value meaning; reference relevance or authenticity. Approval of a syllabus is not a per-relationship alignment oracle.\n';
await fs.writeFile(`${out}/deterministic-findings.md`,findings);
console.log('PO comparison and classified deterministic findings written.');
