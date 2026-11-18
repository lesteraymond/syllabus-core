'use strict';
// The AI provider the application uses: the direct Anthropic API, for the new AI Checker (pipeline/provider.js, anthropicClient.js). The old checker's
// providers (Gemini, OpenRouter, DeepSeek, Groq) and its request code (gemini.js) were removed with the old AI Checker.
const { anthropicReady } = require('./anthropicClient');

// Claude runs only for the one model the operator approved (SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL): a valid key on its own turns nothing on.
const anthropicApproved = (env, model) => !!model && String(env.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL || '').trim() === model;

// off (or anything but anthropic): no AI provider; the fixed rules still run, and an AI check says why it has no AI part.
function providerConfig(env = process.env) {
  const provider = String(env.SYLLABUS_CHECK_AI_PROVIDER || '').trim().toLowerCase();
  if (provider !== 'anthropic') return { provider, model: '', configured: false };
  const model = env.ANTHROPIC_MODEL || '', approved = anthropicApproved(env, model);
  return { provider, model, configured: anthropicReady(env) && approved, approved };
}

// What the submission gate accepts as a verified check (compliance/service.js requireHybrid): a completed check of the new AI Checker, made with the
// approved Claude model. A report of the old AI Checker no longer counts: the author runs the check again.
function verifiedAlignment(alignment, env = process.env) {
  if (alignment?.status !== 'completed' || alignment.evaluationOnly) return false;
  return alignment.engine === 're-planned' && alignment.provider === 'anthropic' && anthropicApproved(env, alignment.model);
}

module.exports = { providerConfig, verifiedAlignment, anthropicApproved };
