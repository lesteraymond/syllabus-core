// The administrator's switches as the server uses them (lib/adminSettings.js): what is read, what applies when nothing is saved or the settings
// cannot be read, and the check environment for "AI compliance checking" off. Run: npm test.
const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('./adminSettings');

const dbWith = (saved, { broken = false } = {}) => ({ query: async (sql) => {
  if (broken) throw Object.assign(new Error('connection lost'), { code: 'PROTOCOL_CONNECTION_LOST' });
  assert.match(sql, /FROM app_settings WHERE setting_key = 'administration'/);
  return [saved ? [{ setting_value: JSON.stringify(saved) }] : []];
} });

test('the three switches are read as saved', async () => {
  assert.deepEqual(await settings.policy(dbWith({ aiChecking: false, strictValidation: true, emailNotifications: false })), { strictValidation: true, aiChecking: false, emailNotifications: false });
  assert.deepEqual(await settings.policy(dbWith({ aiChecking: true, strictValidation: false, emailNotifications: true })), { strictValidation: false, aiChecking: true, emailNotifications: true });
});

test('nothing saved: the defaults (the step order free, AI and email on, as the Settings page shows them)', async () => {
  assert.deepEqual(await settings.policy(dbWith(null)), { strictValidation: false, aiChecking: true, emailNotifications: true });
  assert.equal(settings.DEFAULTS, require('../routes/settings').DEFAULTS, 'one set of defaults: the Settings route uses these');
});

test('settings that cannot be read: the strict step order, and AI and email as before the switches were connected', async () => {
  assert.deepEqual(await settings.policy(dbWith(null, { broken: true })), { strictValidation: true, aiChecking: true, emailNotifications: true });
  const unparsable = { query: async () => [[{ setting_value: '{not json' }]] };
  assert.equal((await settings.policy(unparsable)).strictValidation, true);
});

test('AI off: the check runs with no provider, whatever keys the server has, and says the administrator turned it off', () => {
  const env = settings.aiOffEnv({ GEMINI_API_KEY: 'k', OPENROUTER_API_KEY: 'k', SYLLABUS_CHECK_AI_PROVIDER: 'gemini', OTHER: 'kept' });
  assert.equal(env.SYLLABUS_CHECK_AI_PROVIDER, 'off');
  assert.equal(env.OTHER, 'kept');
  const gemini = require('./syllabuscheck/gemini');
  assert.deepEqual(gemini.providerConfig(env), { provider: 'off', model: '', configured: false }, 'no provider is configured, so no request can be sent');
  assert.equal(gemini.providerConfig({ GEMINI_API_KEY: 'k' }).configured, true, 'the same keys with AI on would be configured');
});

test('AI off: the alignment step sends nothing and its reason names the Settings switch', async () => {
  const gemini = require('./syllabuscheck/gemini');
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('no request may be sent while AI checking is off'); };
  try {
    const out = await gemini.align({ meta: {}, clos: [], plan: [] }, { egas: [], pos: [], clos: [] }, { env: settings.aiOffEnv({ GEMINI_API_KEY: 'k' }) });
    assert.equal(out.status, 'not_evaluated');
    assert.equal(out.reason, settings.AI_OFF_MESSAGE);
    assert.equal(out.failure.kind, 'not_configured');
  } finally { global.fetch = originalFetch; }
});
