const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Time in the system, for the signed-in user only: nobody can read or add to anyone else's. Student accounts never get here
// (the server closes every API but sign-in to them). The counting lives in lib/usage.js (app.locals.usage).
//   POST /api/usage/heartbeat        the browser says "active now"; answers { enabled }
//   GET  /api/usage/summary?days=7   the last 7 or 30 days: per-day seconds, today, averages, busiest day
router.post('/heartbeat', requireAuth, (req, res) => {
  const usage = req.app.locals.usage;
  res.json(usage ? usage.heartbeat(req.session.user.id) : { enabled: false });
});

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const usage = req.app.locals.usage;
    if (!usage) return res.json({ enabled: false });
    res.json(await usage.summary(req.session.user.id, Number(req.query.days) === 30 ? 30 : 7));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
