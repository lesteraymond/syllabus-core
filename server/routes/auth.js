const express = require('express');
const bcrypt = require('bcryptjs');
const { issueRememberToken, revokeRememberToken, REMEMBER_MS } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body;
    const db = req.app.locals.db;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const sessionUser = { id: user.user_id, email: user.email, role: user.role, firstName: user.first_name, lastName: user.last_name };
    req.session.user = sessionUser;
    if (remember) {
      req.session.cookie.maxAge = REMEMBER_MS;
      await issueRememberToken(db, res, user.user_id);
    } else {
      req.session.cookie.expires = false; // browser-session cookie
      await revokeRememberToken(db, req, res);
    }
    res.json({ user: sessionUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', async (req, res) => {
  try { await revokeRememberToken(req.app.locals.db, req, res); } catch {}
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: req.session.user });
});

module.exports = router;
