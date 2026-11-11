require("dotenv").config();
const express = require("express");
const { resolveHostConfig, applyHostSecurity, applyErrorHandling, JSON_BODY_LIMIT } = require("./lib/hostConfig");
const session = require("express-session");
const path = require("path");
const mysql = require("mysql2/promise");
const { restoreSession } = require("./middleware/auth");
const { resolveSessionSecret, assertHardenedSecrets } = require("./lib/sessionSecret");

// Secrets are checked before anything else starts. With NODE_ENV=staging or production a missing or publicly known secret stops the server (no default is
// ever used); in development a random per-process session secret is used instead of a constant. No secret value is ever printed.
let sessionSecret, hostConfig, dbConfig;
try {
	assertHardenedSecrets(process.env);
	sessionSecret = resolveSessionSecret(process.env).secret;
	hostConfig = resolveHostConfig(process.env); // CORS origins, cookie flags and proxy trust: validated here, so a bad setting stops the server before it listens
	dbConfig = require("./lib/dbConfig").resolveDbConfig(process.env); // the database connection: port, TLS, pool bounds; a remote database must use TLS in staging and production
	require("./lib/signInLimits").resolveSignInLimits(process.env);
	require("./lib/aiQuota").resolveAiQuota(process.env); // the daily ceilings on AI requests (lib/aiQuota.js): a bad value stops the server here, by name // the failed sign-in limits (routes/auth.js): a bad value stops the server here, by name
} catch (error) {
	console.error("FATAL: " + error.message);
	process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

applyHostSecurity(app, hostConfig); // trust proxy, the security headers, CORS for the configured origins only, and the cross-site request guard, before the session and body parsers
console.log(`HOST: CORS allows ${hostConfig.origins.length} origin(s) (${hostConfig.originSource}); cookies Secure=${hostConfig.cookie.secure} SameSite=${hostConfig.cookie.sameSite}; trust proxy ${hostConfig.trustProxy === undefined ? "off" : JSON.stringify(hostConfig.trustProxy)}.`);
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true }));
app.use(
	session({
		secret: sessionSecret,
		resave: false,
		saveUninitialized: false,
		cookie: hostConfig.sessionCookie,
	}),
);

// No folder is served publicly. An uploaded syllabus file is read through GET /api/syllabi/:id/file (routes/syllabusFiles.js), which checks who is asking;
// a profile photo through GET /api/users/:id/avatar. Anything under /uploads answers 404, signed in or not.
app.use("/uploads", (req, res) => res.sendStatus(404));

const pool = mysql.createPool(dbConfig.pool); // lib/dbConfig.js
require("./lib/dbConfig").applySessionSettings(pool, dbConfig); // DB_SQL_STRICT=on: a strict sql_mode on every connection

app.locals.db = pool;
require('./lib/catalogFileCleanup').startCleanup(pool);
require('./lib/corCleanup').startCorCleanup(pool); // COR photos of registrations that were never finished (lib/corCleanup.js)
// Time usage: counted in memory, written in one batch about once a minute, and written out when the server stops.
const usage = require('./lib/usage').createUsageService({ db: pool });
app.locals.usage = usage;
usage.start();
// Deadline notices: the bell and an email when a deadline is set, changed or cancelled, and the automatic due-soon, due-today and missed ones.
const deadlineNotices = require('./lib/deadlineNotices').createDeadlineNotifier({ db: pool, notify: require('./lib/notify').createNotification, mail: require('./lib/mailer').sendNotice });
app.locals.deadlineNotices = deadlineNotices;
deadlineNotices.start();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { Promise.all([usage.stop(), deadlineNotices.stop()]).finally(() => process.exit(0)); });

// Public liveness/readiness (database ping only): mounted before the session restore and the student gate so a monitor needs no login.
app.use("/api/health", require("./routes/health"));

app.use(restoreSession);

// Student accounts exist only to sign in and see their own profile: every other API is closed to them.
app.use("/api", (req, res, next) => {
	const u = req.session.user;
	if (u && u.role === "student" && !/^\/(auth|students)(\/|$)/.test(req.path)) return res.status(403).json({ error: "Not available for student accounts" });
	next();
});

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
app.use("/api/students", require("./routes/students"));
app.use("/api/users", require("./routes/users"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/syllabi", require("./routes/syllabi"));
app.use("/api/syllabi", require("./routes/syllabusFiles")); // an uploaded file, only for those who may read the syllabus
app.use("/api/syllabi", require("./routes/syllabusContent"));
app.use("/api/syllabi", require("./routes/pdfImport"));
app.use("/api/syllabi", require("./routes/comments"));
app.use("/api/syllabi", require("./routes/reviewChain"));
app.use("/api", require("./routes/compliance"));
app.use("/api/syllabus-check", require("./routes/syllabusCheck"));
app.use("/api/institution", require("./routes/institution"));
app.use("/api/programs", require("./routes/programs"));
app.use("/api/programs", require("./routes/programPoReference")); // Admin: PO reference drafts and explicit publication
app.use("/api/courses", require("./routes/courses"));
app.use("/api/academic-years", require("./routes/academicYears"));
app.use("/api/curriculum", require("./routes/curriculum"));
app.use("/api/logs", require("./routes/logs"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/usage", require("./routes/usage"));
app.use("/api/deadlines", require("./routes/deadlines"));

// After every route: a JSON 404 for an unknown path, and a short JSON answer for any failure (never a stack trace, in any mode).
applyErrorHandling(app);

// Before the server listens: the application's database account may only read and write rows, and no account may still have a demo password (lib/dbConfig.js).
// In staging and production a failed check stops the server; in development it is a warning.
require("./lib/dbConfig").assertDatabaseSafe(pool, process.env).then((database) => {
for (const warning of database.warnings) console.warn("DATABASE: " + warning);
app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
	console.log("Auth endpoints:");
	for (const layer of authRoutes.stack) {
		if (!layer.route) continue;
		for (const method of Object.keys(layer.route.methods)) {
			console.log(`  ${method.toUpperCase().padEnd(5)} /api/auth${layer.route.path}`);
		}
	}
	for (const key of ["GOOGLE_CLIENT_ID", "JWT_SECRET"]) {
		if (!process.env[key]) console.warn(`WARNING: ${key} is not set in server/.env - Google sign-in will fail`);
	}
	if (!require("./lib/mailer").configured()) console.warn("MAIL: SMTP_HOST and MAIL_FROM are not set in server/.env - no credentials or password emails will be sent.");
});
}).catch((error) => {
	console.error("FATAL: " + error.message);
	process.exit(1);
});
