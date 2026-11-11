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

// An HTTP error that the route handler turns into a response. `body` adds fields next to `error` (for example the failed rules).
const httpError = (status, message, body) => Object.assign(new Error(message), { status, body });

// What a client is told when something unexpected failed. The reason (a database message, a file path, a stack) goes to the server log only: it can
// name tables, columns and folders, and is of no use to the person looking at the screen.
const SERVER_ERROR = 'Something went wrong on the server. Please try again.';

// An unexpected failure in a route: logged in full, answered generically.
const serverError = (res, err, label = 'ROUTE ERROR:') => {
  console.error(label, err);
  return res.status(500).json({ error: SERVER_ERROR });
};

// A refusal made on purpose (httpError: it has a status) keeps its message; anything else is an unexpected failure.
const sendError = (res, err) => {
  if (err.status) return res.status(err.status).json({ error: err.message, ...(err.body || {}) });
  return serverError(res, err);
};

module.exports = { inTransaction, httpError, sendError, serverError, SERVER_ERROR };
