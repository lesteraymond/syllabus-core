// Read-only extraction audit against the local source PDFs. No database or AI calls.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { extractPdf } = require('../server/lib/pdfImport');
const root = path.resolve(__dirname, '..');
const sources = [
  ['IE402-SYSTEM-ENGINEERINGS.pdf', 9, 13, '2-3', [4, 5]],
  ['CPE-304-Fundamentals-of-Mixed-Signals-and-Sensors.pdf', 11, 13, '1', [3, 4]],
  ['IT-202-Programming-1.pdf', 13, 9, '1', [3, 4]],
];
(async () => {
  const { mapPdfFields } = await import('../src/lib/pdfImport.js');
  const results = [];
  for (const [file, expectedRows, expectedPOs, continuedWeek, expectedPages] of sources) {
    const bytes = await fs.readFile(path.join(root, 'reference-data', file));
    const preview = await extractPdf(bytes);
    assert.equal(preview.found.length, 10);
    assert.equal(preview.layout.planRows.length, expectedRows);
    assert.deepEqual(preview.layout.warnings, []);
    assert.deepEqual(preview.layout.planRows.find(row => row.week === continuedWeek).sourcePages, expectedPages);
    assert.equal(/(?:^|\n)\s*PO\s*\d+[.:]/i.test(preview.fields.clos), false, 'PO statement leaked into CLO column');
    let counter = 0;
    const mapped = mapPdfFields(preview.fields, { meta: { code: preview.fields.code, title: preview.fields.title }, outcomes: { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] } }, () => `audit_${++counter}`, { planRows: preview.layout.planRows });
    require('../server/lib/syllabusOutcomes').validateOutcomes(mapped.content.outcomes, mapped.content.clos, mapped.content.plan);
    assert.equal(mapped.content.clos.length, 4);
    assert.equal(mapped.content.outcomes.egas.length, 4);
    assert.equal(mapped.content.outcomes.pos.length, expectedPOs);
    assert.equal(mapped.content.plan.filter(row => row.kind === 'exam').length, 3);
    assert.equal(mapped.content.grading.rows.reduce((sum, row) => sum + Number(row.pct), 0), 100);
    results.push({ file, sha256: createHash('sha256').update(bytes).digest('hex'), pages: preview.pages.length, sections: preview.found.length, clos: mapped.content.clos.length, egas: mapped.content.outcomes.egas.length, pos: mapped.content.outcomes.pos.length, planRows: mapped.content.plan.length, exams: 3, weeks: mapped.content.plan.map(row => row.week), continuedRows: preview.layout.planRows.filter(row => row.sourcePages.length > 1).map(row => ({ week: row.week, sourcePages: row.sourcePages })), warnings: preview.layout.warnings });
  }
  const audit = { testedAt: new Date().toISOString(), layoutVersion: 2, aiRequests: 0, databaseWrites: 0, results };
  await fs.writeFile(path.join(root, 'docs/pdf-layout-extraction-audit.json'), JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify(audit, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
