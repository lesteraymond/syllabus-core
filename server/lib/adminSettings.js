'use strict';
// The administrator's settings (Settings > Administration, stored in app_settings under 'administration'; routes/settings.js) as the rest of the
// server uses them. Three switches have an effect:
//   strictValidation    ON: faculty complete the builder's steps 1-6 in order (step N before N+1). OFF: they open any step. Submitting needs a
//                       complete form either way (the server's submit checks never change with it). The builder reads it through GET /api/settings/policy.
//   aiChecking          OFF: a check runs the coded format rules only, with no AI provider request (and no AI recommendation is refined). ON: as configured.
//   emailNotifications  OFF: no email (deadline notices, and the decision emails to faculty). The in-app notifications are sent either way.
// Read on every use, so a change applies at once with no restart.
const DEFAULTS = Object.freeze({ template: 'Undergraduate Syllabus v4', academicYear: '2026–2027', department: 'College of Information Technology and Engineering', aiChecking: true, strictValidation: false, emailNotifications: true });

// What applies when the settings cannot be read: the stricter step rule, and AI and email as they were before the switches were connected.
const UNREADABLE = Object.freeze({ ...DEFAULTS, strictValidation: true });

async function read(db) {
  try {
    const [rows] = await db.query("SELECT setting_value FROM app_settings WHERE setting_key = 'administration'");
    return { ...DEFAULTS, ...(rows[0] ? JSON.parse(rows[0].setting_value) : {}) };
  } catch { return { ...UNREADABLE }; }
}

// The three switches only, as booleans (what the builder and the checks need; nothing else of the administrator's settings leaves the server this way).
async function policy(db) {
  const s = await read(db);
  return { strictValidation: s.strictValidation !== false, aiChecking: s.aiChecking !== false, emailNotifications: s.emailNotifications !== false };
}

// The environment a check runs with when the administrator turned AI checking off: no provider, so every AI stage sends nothing and says why.
const AI_OFF_MESSAGE = 'AI compliance checking is turned off in Settings (AI & Notifications), so no AI request was sent; the coded format rules ran.';
const aiOffEnv = (env = process.env) => ({ ...env, SYLLABUS_CHECK_AI_PROVIDER: 'off', SYLLABUS_CHECK_AI_OFF_BY: 'settings' });
// Why an action that is only an AI request (checking and improving a recommendation) is refused while the switch is off.
const AI_OFF_REFUSAL = 'AI compliance checking is turned off in Settings (AI & Notifications), so this recommendation cannot be checked with AI. You can still apply or edit it yourself.';

module.exports = { DEFAULTS, UNREADABLE, read, policy, aiOffEnv, AI_OFF_MESSAGE, AI_OFF_REFUSAL };
