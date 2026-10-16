# How to Run Syllabus Management System

Step-by-step guide to run the full system (frontend + backend + database).

---

## Prerequisites

Install these first:

- [Node.js](https://nodejs.org/) (v18 or higher, includes npm)
- [XAMPP](https://www.apachefriends.org/) (for MySQL)

---

## Step 1: Start MySQL (XAMPP)

1. Open **XAMPP Control Panel**
2. Click **Start** next to **MySQL**
3. Make sure it shows green/running

> MySQL must be running before starting the backend.

---

## Step 2: Setup Backend

Open a terminal:

```bash
cd server
npm install
npm run init-db
npm run dev
```

- `npm install` — installs backend dependencies
- `npm run init-db` — creates the database, tables, and seed data (run once)
- `npm run dev` — starts the API server on **http://localhost:3001**

You should see:
```
Server running on http://localhost:3001
```

---

## Step 3: Setup Frontend

Open another terminal:

```bash
npm install
npm run dev
```

- `npm install` — installs frontend dependencies
- `npm run dev` — starts the Vite dev server on **http://localhost:5173**

You should see:
```
Local: http://localhost:5173/
```

---

## Step 4: Login

1. Open **http://localhost:5173** in your browser
2. Use one of the demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@university.edu.ph | admin123 |
| Faculty | faculty@university.edu.ph | faculty123 |

---

## Troubleshooting

### "Invalid email or password"
```bash
cd server
npm run init-db
```
This re-seeds the database with correct password hashes.

### "Failed to fetch" or CORS error
Make sure the backend is running on port 3001:
```bash
cd server
npm run dev
```

### MySQL connection error
Make sure XAMPP MySQL is started and the credentials in `server/.env` match:
```
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=syllabus_cms_plus
```

### Port already in use
Change the port in `server/.env`:
```
PORT=3002
```
Then update `src/lib/api.js`:
```js
const API = 'http://localhost:3002/api';
```

---

## Project Structure

```
syllabus-cms-plus/
├── src/                ← Frontend (React + Vite)
│   ├── App.jsx
│   ├── components/
│   ├── views/
│   ├── data/
│   └── lib/
├── server/             ← Backend (Node.js + Express)
│   ├── index.js
│   ├── routes/
│   ├── middleware/
│   ├── db/
│   └── uploads/
├── public/
└── package.json
```

---

## Available Scripts

### Frontend
| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |

### Backend
| Command | Description |
|---------|-------------|
| `npm run dev` | Start API server |
| `npm run init-db` | Initialize/reset database |
| `npm run migrate-students` | Add the student role and COR tables (existing databases) |
| `node scripts/ocr-cor-test.js [image]` | Try the COR reader on `server/sample_cor/` or an image |

The other `npm run migrate-*` scripts upgrade older databases; each is safe to run again.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Check session |
| GET | /api/syllabi | List syllabi |
| POST | /api/syllabi | Create syllabus |
| PUT | /api/syllabi/:id | Update syllabus |
| DELETE | /api/syllabi/:id | Delete syllabus |
| GET | /api/curriculum | List curricula |
| GET | /api/logs | List activity logs |
| GET | /api/messages/:id | Get messages |
| POST | /api/messages/:id | Send message |
| PUT | /api/messages/read/:id | Mark as read |
| POST | /api/students/scan | Read a COR photo (public) |
| POST | /api/students/register | Create the student account from the scan (public) |
| GET | /api/students/me | A student's profile and subjects |
| GET | /api/students/pending | Registrations waiting for review (admin) |
| GET | /api/students/:id/cor | The COR photo of a pending student (admin) |
| POST | /api/students/:id/verify | Approve or reject a pending student (admin) |
| GET | /api/users | List users (admin) |
| POST | /api/users | Create user (admin) |
| DELETE | /api/users/:id | Delete user (admin) |
