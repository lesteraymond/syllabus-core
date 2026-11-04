// Read current draft/references and count simulated transport calls. No external
// request, syllabus edit, persisted AI run or provider credit usage is performed.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env'), quiet: true });
(async () => {
  const db = await require('../server/node_modules/mysql2/promise').createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  let content, masters;
  try {
    const [rows] = await db.query('SELECT content FROM syllabi WHERE syllabus_id = ?', [101]);
    content = JSON.parse(rows[0].content);
    masters = await require('../server/lib/syllabuscheck/repository').mastersFor(db, content);
  } finally { await db.end(); }
  const { align, pairsOf, MINIMAX_FREE } = require('../server/lib/syllabuscheck/gemini');
  const pairs = pairsOf(content, masters);
  const seen = new Map(), sizes = [];
  const result = await align(content, masters, { simulated: true, env: { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_MODEL: MINIMAX_FREE, OPENROUTER_API_KEY: 'simulation-only-no-network' }, transport: async (url, request) => {
    const body = JSON.parse(request.body);
    const batch = JSON.parse(body.messages[1].content).document_data;
    sizes.push(batch.length);
    for (const pair of batch) seen.set(pair.id, (seen.get(pair.id) || 0) + 1);
    return { ok: true, json: async () => ({ model: MINIMAX_FREE, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: batch.map(p => ({ id: p.id, label: 'ALIGNED', explanation: 'Synthetic response used only to count requests.', sourceQuote: p.source, targetQuote: p.target, sourceBloom: 'N/A', targetBloom: 'N/A', draft: '' })) }) } }] }) };
  } });
  assert.equal(sizes.length, Math.ceil(pairs.length / 4));
  assert.equal(seen.size, pairs.length);
  assert.ok([...seen.values()].every(count => count === 1));
  assert.equal(result.judgements.length, pairs.length);
  assert.equal(result.status, 'not_evaluated', 'Simulation must never authorize submission.');
  const report = { testedAt: new Date().toISOString(), syllabusId: 101, simulated: true, actualOpenRouterRequests: 0, relationships: pairs.length, batchSize: 4, simulatedRequestsPerEvaluation: sizes.length, batchSizes: sizes, duplicateRelationships: [...seen].filter(([, count]) => count > 1).length, submissionAuthorized: false };
  await fs.writeFile(path.resolve(__dirname, '../docs/ai-check-request-audit.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
