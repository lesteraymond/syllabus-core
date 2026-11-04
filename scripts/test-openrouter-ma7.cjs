// Small real-provider diagnostic. Does not submit, approve or alter any syllabus.
require('../server/node_modules/dotenv').config({ path: require('node:path').resolve(__dirname, '../server/.env') });
const fs = require('node:fs/promises');
const path = require('node:path');
const { pairsOf, requestOpenRouter, providerConfig } = require('../server/lib/syllabuscheck/gemini');
async function main() {
  const root = path.resolve(__dirname, '..');
  const config = providerConfig();
  if (!config.configured || config.provider !== 'openrouter') throw Error('Configure the server OpenRouter key first.');
  const input = JSON.parse(await fs.readFile(path.join(root, '.api-test-backups/ma7-semantic-diagnostic-input.json'), 'utf8'));
  const all = pairsOf(input.content, input.masters);
  const pairs = [
    all.find(p => p.type === 'CLO-EGA'),
    all.find(p => p.type === 'ILO-CLO'),
    all.find(p => p.type === 'ILO-assessment' && p.path.startsWith('plan[16]')),
  ];
  if (pairs.some(p => !p)) throw Error('The expected MA 7 test relationships are missing.');
  let report;
  try {
    const judgements = await requestOpenRouter(pairs);
    report = { testedAt: new Date().toISOString(), provider: config.provider, model: config.model, syllabusId: 101, scope: 'Three deliberately misaligned MA 7 relationships. Real semantic diagnostic only; not a complete syllabus verification.', liveProviderResponded: true, evidenceValidated: true, canAuthorizeSubmission: false, judgements, detectedMisalignments: judgements.filter(j => ['NOT_ALIGNED', 'PARTIALLY_ALIGNED'].includes(j.label)).length };
  } catch (error) {
    report = { testedAt: new Date().toISOString(), provider: config.provider, model: config.model, syllabusId: 101, liveProviderResponded: false, canAuthorizeSubmission: false, reason: error.message };
    process.exitCode = 1;
  }
  await fs.writeFile(path.join(root, 'docs/openrouter-ma7-live-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
