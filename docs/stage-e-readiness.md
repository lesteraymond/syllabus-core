# Academic enforcement readiness assessment (Stage E)

> Superseded for current status by `docs/stage-e2-readiness.md` (Stage E.2). Section D (manual Verdict Panel steps) still applies.

**Official academic scoring is not enforced and nothing in this document changes that.** Software readiness and academic approval are different things; this page keeps them apart. No pass mark, weight or threshold below is an official university requirement.

## A. Software readiness

| Criterion | Evidence | Assessment |
|---|---|---|
| Rule completeness | 44 coded form rules unchanged; advisory rules CUR/STR/CLO/PLAN/ALN/VAL/REF/ADM mapped. Not covered: activity-to-assessment consistency, co-requisite and semester, per-week reference relevance, export rendering (STR-07), policy items ADM-04/05, CLO-05/10, PLAN-05/06 (stay NOT_CHECKED). | Mostly complete for the requested chain; known gaps listed |
| Flag safety | 256 flag combinations: official score, deductions and pass flag identical; each flag asks only its own questions. | Ready |
| Backward compatibility | Old saved reports rebuild a verdict; all additions optional; prompt byte-identical with flags off. | Ready |
| Provider reliability | Schema-validated answers, halving retries, timeouts (90-240 s), circuit breaker for 401/402/403, honest NOT_CHECKED. **No live run has covered the full all-stages pipeline** (the last provider credit refusal was 2026-10-25). | Not proven live |
| Offline behaviour | Deterministic reference format, curriculum, structure and values wording still run; nothing semantic is passed. | Ready |
| Cost and latency | 13-19 requests, about 120k-170k input tokens, about $0.011-0.015 per check (estimate). Latency not measured. | Acceptable; unmeasured |
| Rollback | Switch the stage flags off (no schema change, no data change, `report_json` additive). Migration `program_outcome_sources` is separate and **not run**. | Ready |
| Automated tests | 1074 server, 22, 50 UI, 12; localization audit and production build pass. No browser automation was available: see the manual steps below. | Ready, except browser check |

## B. Academic readiness (not met)

| Criterion | Evidence | Assessment |
|---|---|---|
| Academic accuracy evidence | Only author-written synthetic datasets (Stage A 28 items, B1-B2 36, B3 22, B4 15, C 28, D1 12, D2 9) plus 17 reference format fixtures. 100% agreement on an easy synthetic set is a ceiling effect, not proof. | **Insufficient** |
| False-positive / false-negative rates | **Cannot be computed**: there are no faculty-labelled examples. Quoting a rate from the synthetic sets would be misleading. | **Unknown** |
| Faculty review | The package `docs/academic-validation-package/` (232 records: 65 real text, 167 synthetic) is ready; **0 reviewed**. | **Not started** |
| Institution-approved references | Value definitions are published wording, pending approval; APA rules not checked against the official pages; curricula and outcomes are image transcriptions. | **Pending** |
| Open curriculum-policy questions | (1) Should a capitalisation-only title difference count? (official check is exact). (2) Is a CRITICAL code mismatch allowed to hide all semantic feedback? (3) Cyber Security policy confirmation. (4) What should a values column that lists non-core words (such as "Respect") produce? (5) Which APA style is required for course syllabi? | **Open** |

## C. Recommendation

Ready for a **controlled live evaluation**, not for enforcement. Suggested order (each step needs your approval before any paid call):

1. Approve or correct the value definitions in `server/config/marian-values.json`; have a librarian confirm the APA rules.
2. Have faculty complete the validation package for the three courses.
3. Run the full prompt on the D1/D2 datasets and the three real syllabi (estimated under $0.20 in total), then the trimmed prompt on the same items and compare accuracy and recommendation quality.
4. Only then decide thresholds, and describe them as a faculty-approved policy.

## D. Manual verification of the faculty-facing Verdict Panel (no browser automation was available)

1. `npm run dev` (client) and the server with, in `server/.env`, `SYLLABUS_CHECK_STAGE_A/B/B3/B4/C1/C2/D1/D2=on` (leave the trimmed prompt off).
2. Sign in as faculty, open a syllabus, go to AI Checker and run the check.
3. In the Verdict panel confirm: completeness, curriculum, alignment and overall are separate; a PASS is never shown for something marked "Not checked"; a lesson finding shows who must change it (content, ILO, tag, activity, assessment or values) and shows no rewrite when an earlier field is wrong; reference findings show format, relevance and "Authenticity not verified" separately; a value finding shows "Value definitions: published wording, awaiting institutional approval".
4. Switch the language to Filipino and confirm every label above translates.
5. Turn the AI off (remove the key) and re-run: alignment must read "Not checked" and overall must not be "Compliant".
6. Confirm the official score, pass mark and the Submit button behave as before.
