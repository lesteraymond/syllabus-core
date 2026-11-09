# Controlled activation and recovery

Status: implemented and tested only in isolated synthetic MySQL. No existing development/staging/production rollout was executed. The current database reference rows are unchanged. The example authorization receipt is deliberately unconfirmed.

1. Review REPORT.md, comparison.md, impact.md, the source authorization classification and the institutional approval dependency. Confirm the approved BSIT curriculum/cohort selection. No Vision, Mission, EGA or PO–EGA replacements are part of this rollout.
2. Obtain explicit user authorization for the named existing environment. Record the deciding operator and authorization decision. Keep credentials and full physical database backups outside version control. Take a restorable full database backup and a maintenance window before any write.
3. Supply an explicit private connection JSON with mysql2 connection properties and `mode: "existing"`. The CLI never loads an environment file. No automatic startup migration is installed.
4. Re-run the read-only plan using the four stable IDs for ONE academic-year catalog. Current audited selections are BSIT=1, BSIT-CYBERSECURITY=17, BSIE=15, BSCPE=16; re-verify rather than assuming they stayed current.

`node scripts/po-controlled-activation/rollout.cjs plan --config <private.json> --program-ids 1,17,15,16`

5. Create a fresh exclusive backup file from the same reviewed state. This backs up the mutated reference rows/versions/links and includes protected-table and unrelated-program hashes; it supplements the full database backup.

`node scripts/po-controlled-activation/rollout.cjs backup --config <private.json> --program-ids <four-IDs> --backup <new-private-backup.json>`

6. Complete a copy of authorization.example.json only AFTER explicit approval. Bind it to the plan's database identity hash, exact before hash, migration version and four program IDs. The unchanged example cannot authorize a write. Keep this signed/recorded authorization receipt with migration output and backups; source verification is not a formal VPAA approval record.
7. The following commands are prepared for a separately authorized maintenance window. They were NOT executed against any existing environment:

`node scripts/po-controlled-activation/rollout.cjs apply --config <private.json> --program-ids <four-IDs> --backup <reviewed-backup.json> --expected <before-hash> --maintenance --authorization <approved-receipt.json>`

`node scripts/po-controlled-activation/rollout.cjs verify --config <private.json> --program-ids <four-IDs>`

8. Verify three active canonical source assignments; the Cyber link must resolve BSIT's nine POs and approved BSIT curriculum, with zero competing Cyber PO rows. Review all affected historical references through the existing faculty/admin workflow. Do not resolve review items by copying only text or renumbering tags. Generate a new check against reviewed content; old reports retain their original context. The current recorded formal approval classification remains explicit.
9. DDL is additive and MySQL commits it independently; reference DML and audit/queue writes are one serializable transaction with locks and before/after checks. Injected failures roll back all reference DML. Reruns of the same applied state are no-ops. Drift, wrong IDs, mixed catalog years, another active target version, or conflicting inheritance cause refusal. Non-target program records, all institution/EGA/curriculum rows, faculty records and reports are hash-protected.
10. Recovery, under separate authorization and the same maintenance safeguards:

`node scripts/po-controlled-activation/rollout.cjs rollback --config <private.json> --program-ids <four-IDs> --backup <matching-backup.json> --expected <before-hash> --maintenance --authorization <approved-receipt.json>`

Rollback restores the previous PO rows, program versions and source links, while retaining inactive source versions and migration history. It refuses rollback after intervening protected data changes, preventing reinterpretation of newer work. If drift is detected, stop and use a reviewed recovery plan/full backup; never force-reset faculty data. Do not delete historical curriculum records or drop support tables automatically.

Offline reproduction: `node scripts/po-controlled-activation/verify-sources.mjs`; start the identity-guarded workspace MySQL on 127.0.0.1:43308; `node --test scripts/po-controlled-activation/migration.test.cjs`; `npm run test:vpaa`; `npm test`; `npm run build`; `node scripts/po-controlled-activation/browser.test.mjs`. Browser results are local component E2E using existing product components and real isolated-service output, not a deployed/staging full-stack certification.
