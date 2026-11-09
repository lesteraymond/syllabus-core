# Database requirements (staging and production)

## The one setting that can silently break the AI Checker: `max_allowed_packet`

**Minimum: 16 MB (16777216 bytes), on the database server, for every connection the application opens.**

A checking report is stored with a single `INSERT`, so the whole report has to fit in one packet. Measured on the synthetic 18-week syllabus used by the
test suites (scripted provider, no live model):

| Configuration | Report (raw JSON) | `INSERT` packet (escaped) | Fits a 1 MB limit? |
|---|---|---|---|
| comprehensive profile, $100 cap (everything evaluated) | 0.84 MB | 0.96 MB | barely |
| comprehensive profile, $10 cap (17 optional checks not sent) | 0.94 MB | 1.06 MB | **no** |
| comprehensive profile, $6 cap (required coverage incomplete) | 0.94 MB | 1.08 MB | **no** |

The default of the XAMPP/MariaDB used for local development is `max_allowed_packet=1M`, which rejected the $6 report (`ER_NET_PACKET_TOO_LARGE`, which some
servers surface to the client as `read ECONNRESET`). A real faculty syllabus with longer text will produce a larger report than the synthetic one, so a value
close to the measured sizes is **not** safe. 16 MB is the supported minimum; 64 MB leaves comfortable headroom (it is the MySQL 8 default).

The column is not the limit: `syllabus_check_reports.report_json` is `LONGTEXT` (up to 4 GiB).

### What the application does when the limit is too small

The save is refused **before** anything is written, the check is rolled back, and the author sees (HTTP 507, code `report_too_large`):

> The checking report is too large for this database to store (about 1.01 MB; the database accepts 1.00 MB per write). Nothing was saved and the syllabus is
> unchanged. Ask the system administrator to raise the database setting max_allowed_packet to at least 16.00 MB.

A dropped connection is blamed on the size only when the report really was near the limit; an unrelated network reset is passed through unchanged.

### Verify (run as the application's database user, before every first deployment and after any database change)

```sql
SELECT @@global.max_allowed_packet AS global_bytes, @@session.max_allowed_packet AS session_bytes;
-- both must be >= 16777216
```

### Set

* Self-managed server, `my.cnf` / `my.ini`, section `[mysqld]`: `max_allowed_packet=16M`, then restart. For an immediate effect on **new** connections only:
  `SET GLOBAL max_allowed_packet = 16777216;` (not persistent, so also edit the file).
* Managed database: set the same parameter in the provider's parameter group.
* The setting belongs to the server. Do not raise it on a database shared with other work to make a test pass: use an isolated instance (below).

This is a **pre-staging gate**: staging is not ready for the checker until the verification query above shows at least 16777216.

## Testing against an isolated database server (no change to the shared one)

The E2E scripts can run against a separate MariaDB instance on another port without any application change (the application has no `DB_PORT` setting):

```
mysql_install_db.exe --datadir=<new empty dir> --service=none
mysqld.exe --no-defaults --standalone --basedir=<xampp>/mysql --datadir=<that dir> --port=3407 --bind-address=127.0.0.1 ^
           --socket=ISO_MARIADB_TEST --max_allowed_packet=16M --innodb_buffer_pool_size=48M
E2E_DB_PORT=3407 E2E_DB_NAME=<name containing "e2e"> node scripts/e2e/run-comprehensive-ui.cjs --suite=budget
```

`scripts/e2e/db-port-redirect.cjs` sends only the E2E processes' loopback connections to port 3306 to `E2E_DB_PORT`. The runner refuses to start unless a plain
`localhost:3306` connection really reaches that port **and** allows at least 16 MB (`E2E_MIN_PACKET` overrides the minimum, for tests of the refusal itself), and it
records what it reached in `docs/checker-comprehensive/ui-verification/<suite>/database-isolation.json`. Stop the instance and delete its data directory afterwards.

## What is in a report (for sizing; nothing here is removed or changed)

For the synthetic syllabus at the $100 cap, 0.80 MB in memory: Policy V2 results 42 %, the rule-coverage manifest 27 %, legacy alignment judgements 15 %, the
verdict 8 %, deterministic checks 5 %. Long text stored more than once is only 1.6 % of the report (26 repeated strings, mostly the same explanation repeated in
the coverage manifest and the verdict); the rest is many structured per-relationship records, so the size is inherent to evaluating every relationship, not
waste. Reducing it would mean changing what a report records, which is an academic-evidence decision and was deliberately not done.
