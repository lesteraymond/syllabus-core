const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

const ROLES = ['faculty', 'admin']; // admin = Dean / Academic Administrator

const fail = (res, status, message) => res.status(status).json({ message, error: message });

const toUser = (r) => ({
  id: r.user_id, email: r.email, role: r.role,
  firstName: r.first_name, lastName: r.last_name, createdAt: r.created_at,
});

// Registered users = the sign-in allowlist.
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [rows] = await req.app.locals.db.query(
      'SELECT user_id, email, role, first_name, last_name, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows.map(toUser));
  } catch (err) {
    console.error('USERS ERROR:', err);
    fail(res, 500, err.message);
  }
});

// Admin registers a user. A password is optional: users normally sign in with Google, so
// without one we store a random hash nobody can match (password_hash is NOT NULL).
router.post('/', requireAdmin, async (req, res) => {
  try {
    const firstName = String(req.body.first_name ?? req.body.firstName ?? '').trim();
    const lastName = String(req.body.last_name ?? req.body.lastName ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const role = req.body.role ?? 'faculty';
    const password = req.body.password ? String(req.body.password) : crypto.randomBytes(32).toString('hex');

    if (!firstName || !lastName || !email) return fail(res, 400, 'first_name, last_name and email are required');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 400, 'Invalid email address');
    if (!ROLES.includes(role)) return fail(res, 400, 'Invalid role');

    const db = req.app.locals.db;
    const [existing] = await db.query('SELECT user_id FROM users WHERE LOWER(email) = ?', [email]);
    if (existing.length) return fail(res, 409, 'A user with this email is already registered');

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
      [email, hash, role, firstName, lastName]
    );
    res.status(201).json({ id: result.insertId, email, role, firstName, lastName });
  } catch (err) {
    console.error('USERS ERROR:', err);
    fail(res, 500, err.message);
  }
});

// Offboarding: deleting the row removes access (the user can no longer sign in).
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (Number(req.params.id) === req.session.user.id) return fail(res, 400, 'You cannot remove your own account');
    const [result] = await req.app.locals.db.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return fail(res, 404, 'User not found');
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('USERS ERROR:', err);
    fail(res, 500, err.message);
  }
});

module.exports = router;
