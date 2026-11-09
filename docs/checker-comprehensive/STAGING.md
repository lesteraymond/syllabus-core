# Controlled activation

No environment file was modified by this task. The current local flags (whitelisted only) are recorded in inventory.json.

1. Run the offline checks from the repository root: `npm run test:vpaa`, `npm test`, `npm run build`, then `node scripts/checker-comprehensive-report.cjs`. On PowerShell with script execution disabled, use `npm.cmd`.
2. On an authorized isolated staging server, set only `SYLLABUS_CHECK_PROFILE=comprehensive-testing` in that server's configuration. The existing Re-Check API and shared service resolve V2 plus distinct stages. Explicit individual stage-off values are overridden for this profile, and the resolved profile is saved in each coverage manifest. No browser/user-supplied field selects the profile.
3. For offline provider-unavailable rehearsal, leave the existing provider unconfigured. Automated tests inject a synthetic transport and memory database; never place their fake key in staging.
4. Live staging model use needs separate authorization, an approved existing provider/model configuration and a provider-side spending limit. This prompt provides no such authorization. Retain existing request/token/cost limits, concurrency and cooldown settings. A configured low budget may leave checks NOT_CHECKED; inspect the manifest rather than increasing it automatically.
5. The profile never enables `SYLLABUS_CHECK_REF_VERIFY=crossref`, creates background work, or changes AI submission policy. Any external lookup requires its existing explicit network configuration.
6. Supply institutionally approved references through the existing configuration/workflow. Review all NOT_CHECKED/partial entries, model quotations and faculty recommendations. No automated correction or real-record mutation is part of this rehearsal.
7. Roll back scope by unsetting the profile. Existing V2/stage flags resume their normal behavior. There are no schema changes or migrations.
