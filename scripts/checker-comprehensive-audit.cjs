'use strict';
// Read-only source audit; writes only its own generated artifacts. No DB/provider.
const fs = require('node:fs'), crypto = require('node:crypto');
const standard = require('../server/lib/compliance/standard-v4.json');
const files = ['engine','gemini','academicPolicyV2','academicV2Plan','stages','verdict','quality','validation','references','policy'].map(n => `server/lib/syllabuscheck/${n}.js`).concat(['server/lib/compliance/standard-v4.json','server/lib/compliance/rules.js','server/lib/compliance/service.js']);
const output = 'docs/checker-comprehensive/audit-before.json';
if (fs.existsSync(output)) throw Error('Preserve the original audit snapshot');
const ruleIds = text => [...new Set(text.match(/\b(?:CUR|INST|PO|CLO|ILO|HEADER|WEEK|GRADE|VALUE|LINK|STR|ADM|PLAN|ALN|VAL|REF)[-A-Z]*\d*\b/g) || [])].sort();
const sources = files.map(file => ({file, sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), mentionedRuleIds:ruleIds(fs.readFileSync(file,'utf8'))}));
fs.writeFileSync(output, JSON.stringify({capturedAt:new Date().toISOString(),registered:standard.rules,replaced:['C-04','R-02','R-03'],sources,activation:'Default stage flags and V2 are off. Implementation does not prove execution.',pending:['STR-07','ADM-04','ADM-05','CUR-10','CLO-05','CLO-10','PLAN-05','PLAN-06','ALN-03','ALN-04','ALN-10']},null,2)+'\n');
