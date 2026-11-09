# Monitoring and observability plan

Hand-written. The application has **no metrics endpoint, no request-logging middleware and no alerting**; this plan says what to watch with what already exists, and what to add. Nothing here is configured on a real host. The SQL below was run against a scratch database (it works on MariaDB 10.4; MySQL 8 accepts it too).

## 1. What already exists

| Signal | Where | Notes |
|---|---|---|
| Liveness + database | `GET /api/health` → `{"status":"ok","database":"ok"}` or HTTP 503 | public, no login, reveals nothing else (tests: `server/routes/health.test.js`) |
| Startup configuration | one `HOST:` log line | origin count and source, cookie flags, trust proxy: counts only, no secret |
| Fatal configuration errors | `FATAL: ...` then exit 1 | names the setting, never a value |
| Per-check AI outcome | table `ai_check_runs` (`ai_status` ok / failed / none, `ai_error`, `provider`, `model`, `created_at`) | one row per check |
| Seven-relationship coverage | `syllabus_check_reports.report_json` → `hybrid.semanticCoverage` (`evaluated`, `total`, `complete`, `reason`) | what the UI shows as "VPAA relationships checked: N of 7" |
| Request budget | same report → `hybrid.academicV2.alignment.requestBudget` | requests sent, reserved cost: a **reservation**, not billing |
| Provider cooldown | report text "The AI provider refused a request a moment ago ... Try again after HH:MM UTC" | a refusal 401/402/403 starts a 300 s cooldown |
| Time usage, activity | `usage_daily`, activity logs | not security monitoring |

## 2. What to watch and how

| Concern | Detection | Alert when |
|---|---|---|
| API down | uptime monitor on `/api/health` every minute from outside the network | 2 consecutive failures |
| Database connectivity | same endpoint (`database: unreachable`, HTTP 503) | any 503 |
| API failures and slow requests | **reverse-proxy access log** (status, duration, path; no query strings with tokens) | 5xx rate above 5 % over 5 min; p95 above 10 s outside the check endpoints |
| Authentication errors | proxy log: `POST /api/auth/login` 401/403 counts per source address | a burst of 401s (credential guessing: see the open rate-limit item in the report) |
| Claude provider failures | `SELECT ai_status, COUNT(*) FROM ai_check_runs WHERE created_at > NOW() - INTERVAL 1 DAY GROUP BY ai_status;` | `failed` above 10 % of runs in an hour |
| AI evaluation coverage | `SELECT DATE(a.created_at) d, COUNT(*) runs, SUM(JSON_UNQUOTE(JSON_EXTRACT(r.report_json,'$.hybrid.semanticCoverage.complete'))='true') complete_runs FROM ai_check_runs a JOIN syllabus_check_reports r ON r.run_id = a.run_id GROUP BY d;` | complete share falls below the level seen in the live smoke test |
| AI cooldown events | search stored reports for the cooldown text, or the provider workspace for 401/403 | any occurrence (it means credentials or credit) |
| Request counts, token consumption, **cost** | the **Anthropic workspace usage page and spend alerts** (authoritative); the in-app figure is only a reservation guard | provider alert at 50 % and 80 % of the hard limit |
| Cost anomalies | requests per check from `requestBudget` versus the 20 measured for the synthetic sample | a check sending more than 120 requests (the cap) or a daily total far above the expected check count |
| Syllabus checking errors | `ai_check_runs` rows with `status` not ok; proxy 5xx on `/api/syllabi/*/compliance/recheck` | any repeated failure for one syllabus |
| Unexpected scoring changes | for an unchanged syllabus (same `content_hash`) two runs must have equal `overall`: `SELECT content_hash, COUNT(DISTINCT overall) FROM ai_check_runs GROUP BY content_hash HAVING COUNT(DISTINCT overall) > 1;` | any row (investigate: Policy V2 must never change the official score) |

## 3. Log hygiene

The server writes startup lines, `FATAL` lines and error objects to the console. It does not use a request logger, and a search of `server/` found no code that logs request bodies or headers. Keep it that way: configure the **proxy** log to omit the `Cookie`, `Set-Cookie`, `Authorization` headers and the bodies; never log syllabus text, the Anthropic key, `SESSION_SECRET` or `JWT_SECRET`; treat the database dumps and log files as confidential (they hold institutional text and password hashes); limit log retention to what the audit policy needs.

## 4. To add (not done)

- Proxy access logging and an uptime monitor (hosting decision).
- A scheduled job running the three SQL queries above and sending an alert (small script; needs the owner's alert channel).
- Provider-side spend alerts (owner, in the Anthropic workspace).
- Optional code: a `/api/health` extension counting recent failed AI runs (kept out: the health endpoint is public and deliberately minimal).
