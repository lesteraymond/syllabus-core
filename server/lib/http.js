// Small helpers shared by the route files that arrived with the new builder
// (routes/syllabusContent.js, institution.js, programs.js).

// Runs fn(conn) inside one transaction: commit on success, rollback (and rethrow) on any error.
async function inTransaction(db, fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

// An HTTP error that the route handler turns into a response.
const httpError = (status, message) => Object.assign(new Error(message), { status });

const sendError = (res, err) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('ROUTE ERROR:', err);
  return res.status(500).json({ error: err.message });
};

module.exports = { inTransaction, httpError, sendError };
