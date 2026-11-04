const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();
const DEFAULTS = Object.freeze({ template: 'Undergraduate Syllabus v4', academicYear: '2026–2027', department: 'College of Information Technology and Engineering', aiChecking: true, strictValidation: false, emailNotifications: true });
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [rows] = await req.app.locals.db.query("SELECT setting_value FROM app_settings WHERE setting_key = 'administration'");
    res.json({ settings: { ...DEFAULTS, ...(rows[0] ? JSON.parse(rows[0].setting_value) : {}) } });
  } catch { res.status(500).json({ message: 'Could not load administrator settings. Please try again.' }); }
});
router.put('/', requireAdmin, async (req, res) => {
  const body = req.body;
  if (!body || Object.keys(body).length !== Object.keys(DEFAULTS).length || Object.keys(body).some(key => !Object.hasOwn(DEFAULTS, key)) ||
    !['Undergraduate Syllabus v4', 'Undergraduate Syllabus v3'].includes(body.template) ||
    !/^\d{4}–\d{4}$/.test(body.academicYear) ||
    typeof body.department !== 'string' || !body.department.trim() || body.department.length > 255 ||
    ['aiChecking', 'strictValidation', 'emailNotifications'].some(key => typeof body[key] !== 'boolean')) {
    return res.status(400).json({ message: 'Enter valid administrator settings.' });
  }
  const settings = { ...body, department: body.department.trim() };
  try {
    await req.app.locals.db.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('administration', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [JSON.stringify(settings)]);
    res.json({ settings });
  } catch { res.status(500).json({ message: 'Could not save administrator settings. Please try again.' }); }
});
module.exports = router;
module.exports.DEFAULTS = DEFAULTS;
