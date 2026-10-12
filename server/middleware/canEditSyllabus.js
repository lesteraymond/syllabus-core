const { verifyAccessToken } = require('./jwt');

const EDITOR_ROLES = ['faculty', 'admin']; // faculty = TEACHER, admin = DEAN / Administrator

// Layer 2: RBAC (role) + ABAC (assignment to this syllabus).
// Mount on a route with a :syllabusId (or :id) param.
async function canEditSyllabus(req, res, next) {
  try {
    // 1. Verify the Bearer JWT.
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Missing bearer token' });

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Role comes from the DB, not the token, so offboarding is immediate.
    const db = req.app.locals.db;
    const [users] = await db.query('SELECT user_id, email, role FROM users WHERE user_id = ?', [claims.userId]);
    const user = users[0];

    // 2. The user must still exist (offboarding deletes the row, so access ends at once).
    if (!user) return res.status(403).json({ error: 'Access Denied. Account not registered.' });

    // 3. Role must be TEACHER (faculty) or DEAN (admin).
    if (!EDITOR_ROLES.includes(user.role)) return res.status(403).json({ error: 'Insufficient role' });

    const syllabusId = Number(req.params.syllabusId ?? req.params.id);
    if (!Number.isInteger(syllabusId) || syllabusId <= 0) return res.status(400).json({ error: 'Invalid syllabus id' });

    // 4. Teachers must hold a current assignment to this syllabus. Deans/admins bypass.
    if (user.role === 'faculty') {
      const params = [user.user_id, syllabusId];
      let sql = "SELECT 1 FROM course_assignments WHERE teacher_id = ? AND syllabus_id = ? AND status = 'ACTIVE'";
      if (process.env.CURRENT_TERM) {
        sql += ' AND term = ?';
        params.push(process.env.CURRENT_TERM);
      }
      const [assignments] = await db.query(sql + ' LIMIT 1', params);
      if (assignments.length === 0) return res.status(403).json({ error: 'Not assigned to this syllabus' });
    }

    req.user = { id: user.user_id, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { canEditSyllabus };
