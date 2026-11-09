'use strict';
// Liveness and readiness for the load balancer, the post-deploy smoke test and uptime monitoring. Public on purpose and deliberately small: it reports only
// whether the process is up and whether the database answers. It never returns a version, a host name, a configuration value, a count or an error message.
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const db = req.app.locals.db;
  if (!db) return res.status(503).json({ status: 'unavailable', database: 'unconfigured' });
  try {
    await Promise.race([db.query('SELECT 1'), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))]);
    res.json({ status: 'ok', database: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'unreachable' });
  }
});

module.exports = router;
