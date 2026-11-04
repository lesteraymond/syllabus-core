const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();
const svc = require('../lib/compliance/service');
const terms = require('../lib/terms');
// The syllabus standard in use is the one the AI Checker applies and the system serves one department, so neither is chosen here: they are
// always set when read (an older saved value is ignored). The academic year is the one setting an administrator changes; until one is
// saved it is today's school year.
const STANDARD = svc.standard.title;
// The system serves one department; it is not a setting.
const DEPARTMENT = 'College of Information Technology and Engineering';
const currentYear = () => terms.termOf(new Date()).schoolYear.replace('-', '–');
const DEFAULTS = Object.freeze({ template: STANDARD, academicYear: currentYear(), department: DEPARTMENT, aiChecking: true, strictValidation: false, emailNotifications: true });
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [rows] = await req.app.locals.db.query("SELECT setting_value FROM app_settings WHERE setting_key = 'administration'");
    res.json({ settings: { ...DEFAULTS, academicYear: currentYear(), ...(rows[0] ? JSON.parse(rows[0].setting_value) : {}), template: STANDARD, department: DEPARTMENT } });
  } catch { res.status(500).json({ message: 'Could not load administrator settings. Please try again.' }); }
});
// The standard lists what is still a project decision by field name (e.g. "constants.minReferences"); the administrator reads it as a sentence.
const PENDING = {
  passThreshold: std => `The pass mark (${std.passThreshold}%).`,
  bands: () => 'The score bands: Excellent, Meets the standard and Needs work.',
  'areas[].weight': () => 'How much each of the six areas counts toward the total score.',
  'rules[].weight': () => 'How many points each rule is worth.',
  'rules[].severity (except where a note says the builder already blocks it)': () => 'Which rules block a submission and which only warn (where the builder does not already block it).',
  'constants.weeksPerTerm': std => `The number of weeks in a term (${std.constants.weeksPerTerm}).`,
  'constants.hoursPerLectureUnit': std => `Hours per lecture unit (${std.constants.hoursPerLectureUnit}).`,
  'constants.hoursPerLabUnit': std => `Hours per laboratory unit (${std.constants.hoursPerLabUnit}).`,
  'constants.maxUnitsPerPart': std => `The most units a lecture or laboratory part may have (${std.constants.maxUnitsPerPart}).`,
  'constants.minDescriptionWords': std => `The fewest words a course description needs (${std.constants.minDescriptionWords}).`,
  'constants.minIloWords': std => `The fewest words an intended learning outcome needs (${std.constants.minIloWords}).`,
  'constants.minReferences': std => `The fewest references a syllabus needs (${std.constants.minReferences}).`,
  'constants.referenceMaxAgeYears': std => `How old a reference may be before it counts as outdated (${std.constants.referenceMaxAgeYears} years).`,
  'insufficient.minFilledSections': std => `How much must be written before a syllabus is scored at all (at least ${std.insufficient.minFilledSections} of ${std.insufficient.of.length} sections).`,
  recommendations: () => 'How the checker picks and ranks its recommendations.',
};
const pendingText = (key, std) => (PENDING[key] ? PENDING[key](std) : key);

// The standard the AI Checker applies, read-only, for the administrator's "View standard" screen. It is the checker's own copy (not a second
// one), trimmed to what a reader needs: the pass mark, bands, areas, and every rule with its severity, weight and message.
router.get('/standard', requireAdmin, (req, res) => {
  const std = svc.standard;
  res.json({
    standard: {
      title: std.title, version: std.version, form: std.form, passThreshold: std.passThreshold, bands: std.bands, insufficient: std.insufficient,
      areas: std.areas.map(a => ({ key: a.key, name: a.name, weight: a.weight })),
      rules: std.rules.map(r => ({ id: r.id, area: r.area, step: r.step, severity: r.severity, weight: r.weight, message: r.message, fix: r.fix || '', note: r.note || '' })),
      pending: (std.assumptions || []).map(key => pendingText(key, std)),
    },
  });
});
router.put('/', requireAdmin, async (req, res) => {
  const body = req.body;
  if (!body || Object.keys(body).length !== Object.keys(DEFAULTS).length || Object.keys(body).some(key => !Object.hasOwn(DEFAULTS, key)) ||
    body.template !== STANDARD ||
    !/^\d{4}–\d{4}$/.test(body.academicYear) || Number(body.academicYear.slice(5)) !== Number(body.academicYear.slice(0, 4)) + 1 ||
    body.department !== DEPARTMENT ||
    ['aiChecking', 'strictValidation', 'emailNotifications'].some(key => typeof body[key] !== 'boolean')) {
    return res.status(400).json({ message: 'Enter valid administrator settings.' });
  }
  const settings = { ...body };
  try {
    await req.app.locals.db.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('administration', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [JSON.stringify(settings)]);
    res.json({ settings });
  } catch { res.status(500).json({ message: 'Could not save administrator settings. Please try again.' }); }
});
module.exports = router;
module.exports.DEFAULTS = DEFAULTS;
