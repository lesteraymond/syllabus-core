require("dotenv").config();
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

app.use(restoreSession);

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
app.use("/api/users", require("./routes/users"));
app.use("/api/syllabi", require("./routes/syllabi"));
app.use("/api/curriculum", require("./routes/curriculum"));
app.use("/api/logs", require("./routes/logs"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/mapping", require("./routes/mapping"));

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
});
