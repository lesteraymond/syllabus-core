// Institution outcomes: vision, mission and the EGA list. Everyone signed in reads; only admins write.
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { loadOutcomes } = require('../lib/institution');
const { egasInUse, inUseMessages, inUseError } = require('../lib/catalogUse');
const { isStale, STALE_MESSAGE } = require('../lib/programEgas');
const router = express.Router();

router.get('/outcomes', requireAuth, async (req, res) => {
  try {
    res.json(await loadOutcomes(req.app.locals.db));
  } catch (err) { sendError(res, err); }
});

const str = (v, max, what) => {
  if (typeof v !== 'string' || !v.trim()) throw httpError(400, `${what} is required`);
  if (v.length > max) throw httpError(400, `${what} is too long (max ${max} characters)`);
  return v.trim();
};

router.put('/outcomes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { vision, mission, egas, version } = req.body || {};
    const v = str(vision, 4000, 'Vision');
    const lead = str(mission && mission.lead, 1000, 'Mission lead');
    if (!Array.isArray(mission.items) || !mission.items.length || mission.items.length > 20) throw httpError(400, 'Mission needs 1 to 20 items');
    const items = mission.items.map((x, i) => str(x, 1000, `Mission item ${i + 1}`));
    if (!Array.isArray(egas) || !egas.length || egas.length > 20) throw httpError(400, 'Provide 1 to 20 EGAs');
    const seen = new Set();
    const list = egas.map((e, i) => {
      const no = Number(e && e.no);
      if (!Number.isInteger(no) || no < 1 || no > 99 || seen.has(no)) throw httpError(400, `EGA ${i + 1} needs a unique number from 1 to 99`);
      seen.add(no);
      return [no, str(e.name, 255, `EGA ${no} name`), str(e.short, 120, `EGA ${no} short name`)];
    });

    // This list is only the default: each program has its own EGAs (program_egas). An EGA can be removed from the default
    // unless a program that still relies on it (one with no EGAs of its own) has a CLO tag or a PO pointing at it.
    const [current] = await db.query('SELECT ega_no FROM institution_egas');
    const removed = current.map((e) => e.ega_no).filter((n) => !seen.has(n));
    if (removed.length) {
      const [relying] = await db.query('SELECT p.program_id FROM programs p WHERE NOT EXISTS (SELECT 1 FROM program_egas e WHERE e.program_id = p.program_id)');
      const blocked = [];
      for (const p of relying) blocked.push(...inUseMessages('EGA', removed, await egasInUse(db, p.program_id)));
      if (blocked.length) throw httpError(409, inUseError([...new Set(blocked)]));
    }

    await inTransaction(db, async (conn) => {
      // A save from an out-of-date screen is refused, so two admins never overwrite each other.
      const [[row]] = await conn.query('SELECT version FROM institution_settings WHERE setting_id = 1 FOR UPDATE');
      if (row && isStale(version, row.version)) throw httpError(409, STALE_MESSAGE);
      await conn.query(
        `INSERT INTO institution_settings (setting_id, vision, mission_lead, mission_items) VALUES (1, ?, ?, ?)
         ON DUPLICATE KEY UPDATE vision = VALUES(vision), mission_lead = VALUES(mission_lead), mission_items = VALUES(mission_items), version = version + 1`,
        [v, lead, JSON.stringify(items)]
      );
      await conn.query('DELETE FROM institution_egas WHERE ega_no NOT IN (?)', [list.map((e) => e[0])]);
      for (const [no, name, short] of list) {
        await conn.query(
          'INSERT INTO institution_egas (ega_no, name, short_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), short_name = VALUES(short_name)',
          [no, name, short]
        );
      }
    });
    res.json(await loadOutcomes(db));
  } catch (err) { sendError(res, err); }
});

module.exports = router;
