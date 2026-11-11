const express = require('express');
const { serverError } = require('../lib/http'); // an unexpected failure: logged here, answered generically
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [rows] = await db.query('SELECT * FROM curriculum ORDER BY program_name, year_level, semester');
    res.json(rows.map(r => ({ id: r.curriculum_id, programName: r.program_name, yearLevel: r.year_level, semester: r.semester, courseDescription: r.course_description, learningOutcomes: r.learning_outcomes })));
  } catch (err) {
    serverError(res, err, 'CURRICULUM ERROR:');
  }
});

module.exports = router;
