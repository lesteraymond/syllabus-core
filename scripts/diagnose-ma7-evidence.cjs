// Read-only live diagnostic: retain only validation mismatches, never headers/keys.
const path = require('node:path');
const fs = require('node:fs/promises');
require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env'), quiet: true });
(async () => {
  const db = await require('../server/node_modules/mysql2/promise').createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  let content, masters;
  try {
    const [rows] = await db.execute('SELECT content FROM syllabi WHERE syllabus_id = ?', [101]);
    content = JSON.parse(rows[0].content);
    masters = await require('../server/lib/syllabuscheck/repository').mastersFor(db, content);
  } finally { await db.end(); }
  const { align } = require('../server/lib/syllabuscheck/gemini');
  const batches = [];
  const result = await align(content, masters, { transport: async (url, request) => {
    const response = await fetch(url, request);
    if (response.ok) {
      const input = JSON.parse(request.body);
      const pairs = JSON.parse(input.messages[1].content).document_data;
      const body = await response.clone().json();
      let findings;
      try {
        const output = JSON.parse(body.choices[0].message.content);
        findings = output.judgements.flatMap(j => {
          const p = pairs.find(p => p.id === j.id);
          if (!p || j.label === 'INSUFFICIENT_EVIDENCE') return [];
          return ['source', 'target'].flatMap(side => typeof j[side + 'Quote'] !== 'string' || !j[side + 'Quote'].trim() || !p[side].includes(j[side + 'Quote']) ? [{ pairId: p.id, type: p.type, side, suppliedText: p[side], returnedQuote: j[side + 'Quote'], quoteBelongsToOtherSide: p[side === 'source' ? 'target' : 'source'].includes(j[side + 'Quote']), label: j.label }] : []);
        });
      } catch (error) { findings = [{ parseError: error.message }]; }
      batches.push({ pairIds: pairs.map(p => p.id), mismatches: findings });
      console.log(JSON.stringify({ batch: batches.length, mismatches: findings }));
    }
    return response;
  } });
  const report = { testedAt: new Date().toISOString(), syllabusId: 101, status: result.status, reason: result.reason, batches, syllabusModified: false };
  await fs.writeFile(path.resolve(__dirname, '../docs/ma7-evidence-diagnostic.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, reason: result.reason, batches: batches.length }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
