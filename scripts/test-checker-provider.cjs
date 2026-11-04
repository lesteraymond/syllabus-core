// Safe provider metadata and one-relationship smoke test. Never edits a syllabus.
const path = require('node:path');
require('../server/node_modules/dotenv').config({ path: path.resolve(__dirname, '../server/.env'), quiet: true });
(async () => {
  const model = process.env.OPENROUTER_MODEL;
  if (process.argv.includes('--info')) {
    const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error('OpenRouter models HTTP ' + response.status);
    const body = await response.json();
    const found = body.data.find(m => m.id === (model || 'minimax/minimax-m3.1-flash:free'));
    if (!found) throw Error('Requested model is not listed');
    console.log(JSON.stringify({ id: found.id, supported_parameters: found.supported_parameters, pricing: found.pricing, top_provider: found.top_provider }, null, 2));
    return;
  }
  const { requestOpenRouter, providerConfig } = require('../server/lib/syllabuscheck/gemini');
  const config = providerConfig();
  if (!config.configured) throw Error('Checker provider is not configured.');
  const pairs = [{ id: 'smoke-derivative-assessment', type: 'ILO-assessment', source: 'Compute and explain the derivative of a polynomial function.', target: 'Compute the derivative of a polynomial function and explain each step in a worked solution.', path: 'plan[0].ilos[0].text', targetPath: 'plan[0].tasks' }];
  const judgements = await requestOpenRouter(pairs);
  console.log(JSON.stringify({ provider: config.provider, model: config.model, validated: true, canAuthorizeSubmission: false, judgements }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
