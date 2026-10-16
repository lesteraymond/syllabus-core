# Time usage

The dashboard's **Time Usage** card shows how long the signed-in person was active in the system: today, a bar per day for the last 7 or
30 days, the average session, the number of active days and the busiest day. Each person sees only their own time. Student accounts are not
tracked (the server closes every API but sign-in to them).

## Turning it on

Run once on an existing database, from `server/`, then restart the API:

    npm run migrate-usage

Fresh installs get the table from `server/db/schema.sql`. Until the migration has run, the card says time tracking is not set up and
nothing else is affected. To switch tracking off without removing anything, set `USAGE_TRACKING=off` in `server/.env`: the endpoints
answer `{ enabled: false }` and the browser stops sending heartbeats.

## How it counts

| Part | What it does |
|---|---|
| Browser (`src/lib/useActiveTime.js`, `activity.js`) | Sends a heartbeat every 30 s, only while the tab is visible and there was mouse, key, scroll or touch input in the last 5 minutes (`IDLE_MS`). A last beat goes out as the tab hides. |
| Server (`server/lib/usage.js`) | Credits the time since that user's previous heartbeat, at most 90 s per beat, per **user** (two tabs cannot count twice). Silence over 120 s starts a new session. Beats closer than 10 s are ignored. |
| Database (`usage_daily`) | One row per user per Philippine day. The server keeps credits in memory and writes every user in **one** batched statement about once a minute and when it stops, so heartbeats never write. A crash loses at most the last minute. |

## API (new; no existing endpoint changed)

- `POST /api/usage/heartbeat` returns `{ enabled }`.
- `GET /api/usage/summary?days=7|30` returns the per-day seconds, `todaySeconds`, `totalSeconds`, `activeDays`, `avgPerActiveDay`,
  `avgSessionSeconds`, `busiest` and `hasData`. Always the signed-in user's own; a `userId` in the query is ignored.

## Scaling

The in-memory buffer and the 30-second summary cache are the only process-local parts. If the API ever runs as several processes, replace
them with Redis (`INCRBY` per user and day, plus a short-lived cache); the routes, the table and the browser code stay as they are.

## Privacy

This is a staff activity measure. The card tells the person what is counted ("only while this tab is open and you are active"), and it
records only time, never pages visited or content. Tell staff it exists.
