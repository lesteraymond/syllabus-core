require("dotenv").config();
// The Gemini key for the AI Checker may sit in the project's root .env (next to the Vite settings); values already set are kept.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const path = require("path");
const mysql = require("mysql2/promise");
const { restoreSession } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
	session({
		secret: process.env.SESSION_SECRET || "capstone-secret",
		resave: false,
		saveUninitialized: false,
		cookie: { maxAge: 24 * 60 * 60 * 1000 },
	}),
);

const uploadsDir = path.join(__dirname, process.env.UPLOAD_DIR || "uploads");
// Profile photos are private: they are only served by GET /api/users/:id/avatar (authorization checked).
app.use("/uploads/avatars", (req, res) => res.sendStatus(404));
app.use("/uploads", express.static(uploadsDir));

const pool = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
	waitForConnections: true,
	connectionLimit: 10,
});

app.locals.db = pool;
// Developer edits of the compliance standard (kept in the database) are laid over the file before the first request is served.
require('./lib/compliance/overridesStore').load(pool).catch((err) => console.warn('Standard edits could not be loaded; using the standard file as it is.', err.message));
require('./lib/catalogFileCleanup').startCleanup(pool);
// Time usage: counted in memory, written in one batch about once a minute, and written out when the server stops.
const usage = require('./lib/usage').createUsageService({ db: pool });
app.locals.usage = usage;
usage.start();
// Deadline notices: the bell and an email when a deadline is set, changed or cancelled, and the automatic due-soon, due-today and missed ones.
const deadlineNotices = require('./lib/deadlineNotices').createDeadlineNotifier({ db: pool, notify: require('./lib/notify').createNotification, mail: require('./lib/mailer').sendNotice });
app.locals.deadlineNotices = deadlineNotices;
deadlineNotices.start();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { Promise.all([usage.stop(), deadlineNotices.stop()]).finally(() => process.exit(0)); });

app.use(restoreSession);

// Student accounts can sign in, see their own profile and read approved syllabi: every other API is closed to them.
app.use("/api", (req, res, next) => {
	const u = req.session.user;
	// ...except reading the approved syllabi (the list and one syllabus to read).
	const readsSyllabi = req.method === "GET" && /^\/syllabi(\/\d+\/review)?\/?$/.test(req.path);
	if (u && u.role === "student" && !readsSyllabi && !/^\/(auth|students)(\/|$)/.test(req.path)) return res.status(403).json({ error: "Not available for student accounts" });
	next();
});

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
app.use("/api/students", require("./routes/students"));
app.use("/api/users", require("./routes/users"));
app.use("/api/settings", require("./routes/settings"));
// The developer rule editor: a page of its own at /dev/rules, behind DEV_EDITOR_PASSWORD (off when that is not set).
app.use("/dev/rules", require("./routes/devRules"));
app.use("/api/syllabi", require("./routes/syllabi"));
app.use("/api/syllabi", require("./routes/syllabusContent"));
app.use("/api/syllabi", require("./routes/comments"));
app.use("/api", require("./routes/compliance"));
app.use("/api/institution", require("./routes/institution"));
app.use("/api/programs", require("./routes/programs"));
app.use("/api/courses", require("./routes/courses"));
app.use("/api/curriculum", require("./routes/curriculum"));
app.use("/api/logs", require("./routes/logs"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/usage", require("./routes/usage"));
app.use("/api/deadlines", require("./routes/deadlines"));

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
