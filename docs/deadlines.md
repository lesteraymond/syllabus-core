# Subject deadlines

An administrator gives a subject a submission deadline for a term. Every faculty member assigned to that subject has their own
requirement against it. A requirement is **Failed to submit** once the due time passes with nothing submitted, and **Submitted late** if
the syllabus then arrives. Faculty are told by the notification bell and by email, and the administrator can remind people by hand.

This replaces the program-wide, UI-only plan in `docs/claude-program-deadlines-ui.md`: deadlines are per subject and term, and they are real.

## Turning it on

Run once on an existing database, from `server/`, then restart the API:

    npm run migrate-deadlines

Fresh installs get the two tables from `server/db/schema.sql`. Until the migration has run, every deadline route answers `enabled: false`,
the Deadline column in Subjects and Programs stays hidden and the dashboard card says deadlines are not set up. Nothing else is affected.

Switches in `server/.env`:

| Variable | Effect |
|---|---|
| `DEADLINE_NOTICES=off` | No notifications, emails or automatic checks. Deadlines can still be set and tracked. |
| `DEADLINE_CHECK_MS` | How often the automatic check runs (default 15 minutes). |

## Where it lives in the app

- **Administrator, Subjects and Programs:** a Deadline column. The chip shows the due date and "3 of 5 submitted" (red if someone failed to
  submit, green when everyone has submitted). Clicking it opens a dialog to set or change the deadline (school year, semester, due date and
  time in Philippine Time, instructions) and to see each assigned faculty member's status, with a Remind button for each person who has not
  submitted and one for everyone. A subject can have a deadline for each term.
- **Administrator and faculty, dashboard:** the Upcoming Deadlines card now shows real deadlines, most urgent first (a faculty member's own
  status per subject; the administrator's submitted and failed counts).
- **Faculty, My Syllabi:** each syllabus shows the deadline of its subject and its status.

## How a requirement's status is decided

Nothing is stored per requirement; it is worked out from the assignments and the submission history each time (`server/lib/deadlines.js`).

- A faculty member is a requirement if they are assigned the subject (`faculty_courses`). Two faculty on one subject are tracked separately; a
  person assigned later has the deadline too. A subject nobody is assigned to shows as "no faculty assigned", not as failures.
- A **submission** is the first non-draft version the faculty member saved for that subject at or after the deadline's `opens_at` (by default
  the moment the deadline was set; "Count submissions made from" in the dialog's Advanced section changes it). This is what stops last
  term's syllabus from satisfying this term's deadline.
- **Upcoming** until the due day, **Due today** on the due day (Philippine day), **Failed to submit** once the due time has passed.
  **Submitted** if the submission was on or before the due time, **Submitted late** if after. Late submissions are never blocked, and
  approval is not considered: a deadline tracks submission only.

## Settled deadlines

A deadline is **settled** when faculty are assigned to the subject and every one of them has submitted, on time or late. It is worked out from the same numbers as the progress counts, never stored, so there is nothing to click and nothing to keep in step: the chip and the dashboard row say "Settled", the dialog shows a note, and nobody is left to remind. Someone assigned to the subject later reopens it by itself. A settled deadline is not cancelled and keeps its history; `GET /api/deadlines` and `GET /api/deadlines/:id/progress` return `settled`.

## One subject, one faculty member

A subject can be assigned to only one faculty member (programs can still be shared by many), so a deadline has at most one person to remind. The Assignments screen shows a subject held by someone else as disabled ("Assigned to Fay Cruz"); the administrator removes it from that person first. The server refuses a save that would take a held subject (409, `subject_taken`, naming the holder), and the unique key `unique_course_owner` on `faculty_courses.course_id` backs it up when two administrators save at once. Run `npm run migrate-subject-owner` in `server/` on an existing database: it stops and lists any subject that is still shared, and changes no data.

## Notices

Sent to faculty who have not submitted, on the bell (type `deadline`) and by email (`lib/deadlineNotices.js`):

| Notice | When |
|---|---|
| New deadline / Deadline changed / Deadline cancelled | After the administrator saves, changes or cancels it. |
| Reminder | The administrator pressed Remind. Once per person every 6 hours. |
| Due soon | Automatic: within 3 days of the due time (not within a day of being told about the deadline). |
| Due today | Automatic: on the due day. |
| Deadline missed | Automatic: after the due time with nothing submitted. |

Each automatic notice is sent once per person and deadline (`deadline_notices`); moving the due time starts them over. Emails follow the
administrator's **Email notifications** setting in Settings; the bell always works. A notice never undoes the save that caused it: a failed
email or bell is logged and the deadline stays saved. Notices are in English, like the server's other notifications.

## API (new; no existing endpoint changed)

| Route | Who |
|---|---|
| `GET /api/deadlines` | administrator: every active deadline with its numbers |
| `POST /api/deadlines/course/:courseId` | administrator: set a deadline `{ term, dueAt, opensAt?, instructions? }` |
| `PUT /api/deadlines/:id` | administrator: change it |
| `DELETE /api/deadlines/:id` | administrator: cancel it |
| `GET /api/deadlines/:id/progress` | administrator: each faculty member's status and when they were last reminded |
| `POST /api/deadlines/:id/remind` | administrator: `{ userIds? }` -> `{ sent, emailed, skipped }` |
| `GET /api/deadlines/mine` | the signed-in faculty member's own deadlines and statuses |

Times are stored as `TIMESTAMP` and read as epoch seconds, so the database server's time zone never shifts a deadline. Days are Philippine
days (UTC+8, no daylight saving).

## Limits and notes

- The automatic check runs inside the API process (like the usage and file-cleanup timers). If the API runs as several processes, run the
  check in only one of them.
- The term is chosen from a school-year list and a semester list, never typed. It is stored as English text ("2026-2027 · 1st Semester").
- Not built: a banner inside the syllabus builder, and choosing a deadline while creating a subject (set it afterwards from the Deadline column).
