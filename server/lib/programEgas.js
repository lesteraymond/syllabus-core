// A program's own expected graduate attributes (EGAs), explicitly configured by an administrator.
async function loadProgramEgas(db, programId) {
  const [own] = await db.query('SELECT ega_no, name, short_name FROM program_egas WHERE program_id = ? ORDER BY ega_no', [programId]);
  return own.map((e) => ({ no: e.ega_no, name: e.name, short: e.short_name }));
}

const egaNumbers = (egas) => new Set(egas.map((e) => e.no));

// Saves are refused when the screen they came from is out of date. `sent` is the version the client loaded
// (undefined from an older client: no check). `current` is the version in the database, read under a row lock.
function isStale(sent, current) {
  if (sent === undefined || sent === null) return false;
  return Number(sent) !== Number(current);
}
const STALE_MESSAGE = 'This was changed by someone else. Reload to see the latest.';

module.exports = { loadProgramEgas, egaNumbers, isStale, STALE_MESSAGE };
