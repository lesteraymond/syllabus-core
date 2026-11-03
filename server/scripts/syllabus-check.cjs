#!/usr/bin/env node
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const fs = require('node:fs/promises');
const { run } = require('../lib/syllabuscheck/engine');
const { mastersFor } = require('../lib/syllabuscheck/repository');
async function main() {
  const args = process.argv.slice(2);
  const option = key => { const index = args.indexOf(key); return index < 0 ? null : args[index + 1]; };
  if (args.includes('--help') || !args.length) {
    console.log('syllabus-check.cjs <builder-content.json> [--references masters.json] [--ai gemini|openrouter|anthropic|off] [--json report.json]\nsyllabus-check.cjs --sample aligned|invalid-course|misaligned|broken-link [--ai gemini|openrouter|anthropic|off] [--json report.json]\nWithout --references, reads official database masters. Samples are synthetic and never authorize submission.');
    return;
  }
  let content, masters, db;
  const sampleKind = option('--sample');
  try {
    if (sampleKind) {
      if (!['aligned', 'invalid-course', 'misaligned', 'broken-link'].includes(sampleKind)) throw Error('Unknown sample');
      ({ content, masters } = require('../lib/syllabuscheck/fixtures').sample(sampleKind));
    } else {
      const input = JSON.parse(await fs.readFile(args[0], 'utf8'));
      content = input.content || input;
      if (option('--references')) masters = { ...JSON.parse(await fs.readFile(option('--references'), 'utf8')), synthetic: true };
      else {
        db = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
        masters = await mastersFor(db, content);
      }
    }
    const ai = option('--ai') || 'off';
    if (!['gemini', 'openrouter', 'anthropic', 'off'].includes(ai)) throw Error('--ai must be gemini, openrouter, anthropic or off');
    const report = await run(content, masters, { useAi: ai !== 'off', env: { ...process.env, SYLLABUS_CHECK_AI_PROVIDER: ai } });
    if (masters.synthetic) { report.hybrid.ready = false; report.passed = false; report.hybrid.synthetic = true; }
    if (option('--json')) await fs.writeFile(option('--json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ sample: sampleKind, score: report.score, baseScore: report.baseScore, ready: report.hybrid.ready, synthetic: !!masters.synthetic, alignment: report.hybrid.alignment.status, reason: report.hybrid.alignment.reason, deductions: report.hybrid.deductions, hardFailures: report.conformance.failed.map(f => f.message), judgements: report.hybrid.alignment.judgements?.length || 0 }, null, 2));
  } finally { if (db) await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
