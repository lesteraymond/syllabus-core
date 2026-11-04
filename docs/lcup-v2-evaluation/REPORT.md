# D1/D2 corrections and controlled Claude evaluation preparation

Date: 2026-10-29. Policy: `academic-evaluation-v2-preview-1`. This continues the completed comprehensive verification. It does not replace that report or rerun its entire 1,188-test selection.

**Both confirmed defects are corrected. Final targeted result: 473 distinct tests passed, zero failed, zero skipped. The original four failing assertions now pass.** The frontend production build also succeeded into a fresh temporary directory.

**Paid Claude requests: zero. ACADEMIC ACCURACY: NOT YET MEASURED.** Genuine smoke/pilot judgments and faculty reference labels remain unassigned. Policy V2 remains inactive, offline-only in the application, and nonofficial. No production database connection, migration, PO rollout, reference change, commit, push or deployment occurred.

## A. Defect corrections

### D1: visibly empty markup

Root cause: frontend/backend compliance predicates used `trim()` as a presence check. The Builder used a different formatting-aware predicate. V2 could also mistake generated strings such as `Week 3 course content: ** **` for meaningful source evidence.

Implemented one shared, pure `hasContent` utility for the Builder's supported bold/list formatting. It returns a boolean and never normalizes or replaces stored text. Backend and frontend compliance, new-lesson authoring, the existing complete-outcomes boundary, and AI evidence presence now agree on whitespace and empty supported markup. Both `** **` and `- ** **` fail presence checks. Meaningful bold/list text, multiplication, exponentiation, pointers, negative numbers, underscores and literal HTML/generic-type syntax remain populated text. This utility is a presence check, not a programming-language validator, HTML sanitizer or academic-quality test.

The new `evidencePresence.hasPairEvidence` checks the original cells behind contextual labels. The V2 planner marks missing evidence unavailable before dispatch, and the existing Claude alignment path also prevents reuse/request of those empty relationships. Independent links with their own valid evidence remain independent. No relationship type, stage, rule ID, weight, score formula or new submission criterion was added.

The existing complete-outcomes check uses the same presence predicate for its existing required text fields. Incomplete drafts remain saveable under its existing non-complete mode. Calling its existing complete mode rejects visibly empty outcome text with its existing409 response. Faculty data is not rewritten or deleted.

| Controlled original probe | Before | After |
|---|---|---|
| Weekly content `** **` | No T-16 finding | Existing T-16 reports empty Course Contents |
| Content-dependent academic relationships with scripted positive answers | Could be supported by supplied labels | All four required content-dependent links are NOT_EVALUATED for missing evidence |
| Overall academic disposition in this probe | SUPPORTED_BY_SUPPLIED_EVIDENCE | FACULTY_REVIEW under existing precedence |
| Rounded compliance score | 100 | **100 can remain because the existing weighted score rounds** |
| Faculty text and official V2 grade | Original text; grade null | Original text unchanged; grade null |

The remaining rounded100 is not a failed presence check: the T-16 finding is present and the academic profile cannot approve the missing evidence. Altering rounding/weights or turning a major warning into a new blocking gate would exceed this task and was not done. See [post-fix probe](markup-after.json) and the unchanged [original evidence](../lcup-comprehensive-verification/markup-only-evidence.json).

### D2: malformed V2 structure

Root cause: planning called `.map` and related operations before validating structured array/object shapes. Invalid saved `content.plan` therefore threw a TypeError and produced500.

`academicV2Input.validateInput` now performs structural validation before planning. It checks present sections and nested lists/objects/text fields consumed by planning, including plan rows/ILOs/tags, CLOs/mappings, descriptions, references, outcomes and relevant master structures. Missing permitted optional sections stay absent. Invalid present structures are rejected, not converted into academically acceptable defaults.

The shared service applies the V2-only structural check before institutional resolution; the planner checks both content and supplied masters. This prevents malformed client/preview structures from reaching unsafe collection operations or unnecessary master queries. The normal legacy branch is unchanged.

Invalid structures return the existing compatible typed HTTP error:

```json
{
  "error": "Invalid structured academic preview input.",
  "code": "academic_v2_invalid_input",
  "field": "content.plan"
}
```

HTTP status is400. No stack trace or internal TypeError is exposed for the tested malformed cases. Authentication and ownership checks still run before the saved record is disclosed/validated. Invalid stored records are not repaired automatically; previews remain read-only. [Actual disposable SQL response](reruns/malformed-api-response.json).

### Exact production files

| Existing file changed | Narrow purpose |
|---|---|
| `server/lib/compliance/rules.js` | Shared content-presence predicate |
| `src/lib/complianceRules.js` | Identical browser predicate |
| `src/lib/lessonAuthoring.js` | Reuse predicate at new-lesson dependency boundary |
| `server/lib/syllabusOutcomes.js` | Correct empty detection in existing complete-text checks; no new field requirement |
| `server/lib/syllabuscheck/gemini.js` | Empty raw/scaffolded evidence cannot be reused or requested as meaningful text |
| `server/lib/syllabuscheck/academicV2Plan.js` | Validate shapes and mark unavailable original-field evidence |
| `server/lib/syllabuscheck/academicPolicyV2.js` | Same presence rule at final relationship-record boundary |
| `server/lib/compliance/service.js` | Early V2-only shape validation before master resolution |

New production helpers: `shared/contentPresence.cjs`, `server/lib/syllabuscheck/evidencePresence.js`, and `server/lib/syllabuscheck/academicV2Input.js`. All other additions are isolated tests, evaluation scripts and documentation. [FILES.md](FILES.md) lists every added/modified artifact. Existing uncommitted edits were retained through small patches.

`standard-v4.json` remains unchanged with47 rules and passing mark79. Numeric aggregation, legacy academic deductions, `requireHybrid` policy/gate behavior, official V2 scoring/storage guards, PO/curriculum sources and production flags were not changed. The correction affects how existing requirements recognize visibly empty text; it does not introduce a new gate or make79 a universal submission threshold.

## B. Executed regression results

[test-results.json](test-results.json) records final distinct tests, intermediate/rerun executions, commands and logs. [commands.json](commands.json) supplies the exact selected compatibility command.

| Executed group | Final distinct tests | Passed | Failed | Evidence |
|---|---:|---:|---:|---|
| Original failing unit assertions plus two whitespace controls | 5 | 5 | 0 | [log](original-failures-unit.log) |
| Original failing actual SQL/HTTP preview assertion | 1 | 1 | 0 | [log](original-failure-sql.log) |
| New presence/syntax/parity/shapes/immutability/boundary cases | 55 | 55 | 0 | [51-case log](corrections-tests.log), [3 boundary cases](outcome-boundary-tests.log), [optional engine case](optional-structure-test.log) |
| Seven original evidence sides, independent of generated labels | 14 | 14 | 0 | [log](scaffolding-final.log) |
| Existing rules/parity/V2 planning/API/legacy scoring/gates/prompt compatibility | 187 | 187 | 0 | [log](compatibility-final.log) |
| Existing outcome save/model compatibility | 61 | 61 | 0 | [log](outcome-compatibility-tests.log) |
| Existing English/Filipino Builder dependency tests | 6 | 6 | 0 | [log](builder-tests.log) |
| Existing seven-relationship software contracts | 98 | 98 | 0 | [log](seven-relationships-final.log) |
| New malformed HTTP/authentication/no-write tests | 9 | 9 | 0 | [log](malformed-api-tests.log) |
| Runner selection, real prompt/schema capture, authorization, limits, transport/report/provenance/measurement | 37 | 37 | 0 | [33 cases](pipeline-tests.log), [review safeguards](review-safeguards-test.log), [model provenance](model-provenance-test.log), [measurement reuse](measurement-export-final.log), [context binding](context-binding-test.log) |
| **Total final distinct tests** | **473** | **473** | **0** | |

The original two markup assertions and both malformed-input assertions are unchanged and now pass. The evidence-output preload redirects only the old comprehensive report writes/config path into this task's `reruns/` directory, so executing original regression files does not overwrite their frozen evidence.

There were776 total assertion executions during development, including justified reruns and intermediate failures; these are not776 distinct tests. The scaffold probe first exposed five remaining D1 failures out of14; all14 passed after raw-field presence was corrected. The187 compatibility and98 relationship cases were rerun after that shared evidence change. A new measurement test initially referenced a nonexistent template filename; only that path was corrected to the actual existing `adjudication-template.json`. Its assertions were retained. Final selected results are all passing; intermediate logs remain available. Existing provider/prompt settings and academic assertions were not weakened.

Additional successful commands: final smoke dry-run, final pilot dry-run, result-report CLI against explicitly mock data, post-fix probe, preservation check and production frontend build. Build output is isolated under `tmp/lcup-v2-evaluation-build`; Vite's existing large-chunk warning remains. No unrelated optimization was attempted. Local PowerShell execution policy initially blocked script/npm.ps1 launch; process-scoped PowerShell execution and `npm.cmd` succeeded without changing machine policy.

Useful focused rerun commands:

```powershell
node --test scripts/lcup-v2-evaluation/corrections.test.cjs scripts/lcup-v2-evaluation/evidence-presence.test.cjs scripts/lcup-v2-evaluation/api.test.cjs scripts/lcup-v2-evaluation/pipeline.test.cjs
node scripts/lcup-requirements/test-ui.mjs
node --require ./scripts/lcup-v2-evaluation/isolate-evidence.cjs --test scripts/lcup-comprehensive-verification/relationships.test.cjs
```

The first command now runs115 tests (55+14+9+37); supplementary patterns in the ledger show how cases were added/executed without rerunning unchanged groups. The187-file selection is in `commands.json`. This report does not claim that all1,188 comprehensive assertions were rerun or newly certified.

The SQL reproduction used a newly initialized MariaDB on localhost43309, with a fresh database/schema and synthetic records. Exact datadir/port checks preceded writes. It never loaded production connection settings or executed migrations. The corrupted synthetic record was restored, the unrelated sentinel was preserved, and the disposable server was shut down. [SQL evidence](reruns/sql-integration-evidence.json), [shutdown receipt](reruns/disposable-shutdown.json). Additional API tests use a SELECT-only stub and assert zero report/content writes and401/404 ownership behavior.

## C. Controlled Claude evaluation preparation

The final frozen manifest is [prepared-final/bundle.json](prepared-final/bundle.json). [Case manifest](prepared-final/case-manifest.json) records exact source/target text, source PDF/file hashes/pages, program/course, benchmark case hash, input/reference hash, snapshot version, actual constructed prompt version and expected response schema for every selected case. Earlier newly created preparation directories are diagnostic snapshots; use `prepared-final`.

No dataset or reference records were regenerated. The selected contexts are byte-equivalent, canonically hashed copies of the existing benchmark contexts, explicitly separate from production. A coherent rehash of changed contextual metadata cannot substitute for the original benchmark context. Unknown/duplicate case IDs, held cases, labels, changed source files, changed prompts and stale content/reference hashes are refused.

### Three real-source smoke cases

| Verified case ID | Program/course | Relationship | Source document and referenced pages |
|---|---|---|---|
| `BM1-IT202-096` | BSIT, IT202 Computer Programming1 | Content-ILO | `reference-data/IT-202-Programming-1.pdf`, pages1,2,3,4 |
| `BM1-IE402-074` | BSIE, IE-402 Systems Engineering | Content-ILO | `reference-data/IE402-SYSTEM-ENGINEERINGS.pdf`, pages1,3,4 |
| `BM1-CPE304-051` | BSCpE, CpE304 Fundamentals of Mixed Signals and Sensors | Content-ILO | `reference-data/CPE-304-Fundamentals-of-Mixed-Signals-and-Sensors.pdf`, pages1,2,4,5 |

These exact IDs were checked against the actual benchmark and current planner; they have no case-level reference/context holds. Source references include course/context pages as well as weekly cells. [SMOKE.md](SMOKE.md) prints the exact source/target texts, hashes and citations. All three use the same relationship for a small initial provider/response/evidence check; they are not a balanced academic-accuracy sample.

### Seven-relationship pilot

[PILOT.md](PILOT.md) lists all21 verified case IDs: three for each of `Content-course`, `Content-ILO`, `ILO-CLO`, `Content-activity`, `ILO-activity`, `Content-assessment`, and `Activity-assessment`. All four program contexts are represented, including Cyber's separate curriculum context. They reuse existing, explicitly synthetic coherent-candidate, partial-scope-candidate and unrelated-content-candidate scenarios.

These are construction contrasts, not approved aligned/partial/misaligned answers. The faculty must judge them independently; their natural-language intent does not guarantee Claude's expected label. Construction notes and developer expectations are not sent as answers. Faculty expectations and Claude judgments remain null. The direct ILO-assessment diagnostic is not requested as an eighth relationship.

### Prompt/adapter reuse and reference holds

The runner calls the existing `gemini.align` / `requestAnthropic`, `anthropicClient`, actual V2 prompt extension, relationship factories, schema and evidence/draft validators. It takes selected original pairs from the V2 planner, preserving their source/target paths and contextual fields. It does not call a new checking engine or calculate a V2 disposition/grade from these small subsets.

Actual constructed prompt version:

`alignment-12ab34c1c2c3d1d2req1-r8-rubric-academic-evaluation-v2-preview-1`

The full existing rubric/stage/V2 instructions remain intact. Stage settings are scoped to the evaluation's local environment object, matching the existing V2 replay configuration. No production flag, provider approval setting or environment file is changed. Evaluation-only results cannot satisfy an official check or submission gate.

Requested model: `claude-sonnet-5-5`, explicitly selected from the repository's existing evaluation allowlist. **Actual returned model/version is null until a genuine call occurs.** Availability is not established by these software tests. Future runs retain the actual response model string, including an accepted dated snapshot. Missing/unsupported returned model provenance cannot become a verified model observation.

Reference snapshot version: `lcup-v2-controlled-evaluation-1-frozen-benchmark-contexts`. This describes an isolated snapshot, not a new institutional approval or PO rollout. The three real smoke links are local content/ILO relationships; they do not use held official PO mappings. Frozen real master conflicts remain visible in context notes. The canonical approved-source PO requirements remain9/9/13/13, with Cyber's separate curriculum; their pending existing-database rollout was not applied. Real CLO-PO holds, curriculum/title/code/year issues, limited EGA definitions and pending value-definition approval remain outside this pilot's evaluated scope. No reference was silently repaired and no faculty mapping was remapped.

There is still no verified real Cyber syllabus in the benchmark; Cyber pilot examples are explicitly synthetic. Broader course-level/PO/EGA/value evaluation must honor its existing reference holds and independent faculty review requirements.

## D. API execution and result-report plan

### Dry-run verification

[Final smoke plan](dry-smoke-ready/plan.json) and [final pilot plan](dry-pilot-ready/plan.json) were executed through the dry-run CLI. They captured the actual SDK-built request bodies with a closed transport; external requests and live model calls are zero. No fake academic responses were needed to create the plans. Raw model outputs generated in unit tests stay under task-owned temporary mock directories and retain `synthetic-test-only` provenance.

| Setting | Smoke | Pilot |
|---|---:|---:|
| Selected relationship cases | 3 | 21 |
| Actual initial request count | 3 | **12** |
| Maximum total provider requests, including retries/splits | 6 | 24 |
| Conservative initial input reservation | 158,039 tokens | 615,408 tokens |
| Maximum total input reservation | 600,000 | 2,400,000 |
| Maximum input reservation per request | 120,000 | 120,000 |
| Output/thinking cap per request | 4,096 | 4,096 |
| Maximum cumulative output/thinking tokens | 24,576 | 98,304 |
| Timeout per request | 90 seconds | 90 seconds |
| Client/SDK automatic retries | 0 | 0 |
| Concurrency | 1 | 1 |
| Local estimated-spend cap | USD2 | USD6 |

Twenty-one cases do not mean21 requests: the runner groups pairs by their original course/context and uses the existing four-pair staged batching. It asks only the selected cases, not the full syllabus or additional stages/C2 diagnostics. Existing schema/evidence retry/splitting behavior remains subject to the hard network-request/token/cost guards. One invalid/unproductive answer or transient HTTP failure stops this initial conservative run; credits/access/spend-limit failures stop immediately. Correction requests can be larger than initial bodies and are checked again before every actual send.

Existing price data is pinned to2026-10-27 and **not verified as current**. With those estimates: initial smoke range approximatelyUSD0.066-0.238, conservative initial boundUSD0.570; initial pilot rangeUSD0.166-0.978, conservative initial boundUSD2.233. The hard configured estimated-spend caps areUSD2 andUSD6; these are proposed run limits, not new spending authorization or actual invoices. Input estimates average about15,493/15,040 tokens per initial request; conservative reservation additionally accounts for body/schema bytes and allowance. See full price basis and guards in the plan JSON.

The existing global spend register is reused only during a separately authorized live run, so restarting the new runner does not create a fresh unrestricted budget. Read-only inspection observedUSD1.2840859 charged against its existingUSD10 ceiling (aboutUSD8.7159141 remaining); this task changed neither value. The live guard rechecks shared spending at execution, and may stop earlier if another run consumed funds. No account credit balance or actual current pricing was queried.

### Exact commands

Safe command now, with a **fresh** output directory:

```powershell
node scripts/lcup-v2-evaluation/run.cjs --scope smoke --model claude-sonnet-5-5 --max-requests 6 --max-input-tokens 600000 --max-input-tokens-per-request 120000 --max-output-tokens 24576 --max-output-tokens-per-request 4096 --max-cost 2 --out docs/lcup-v2-evaluation/smoke-plan-REVIEW
```

The command defaults to dry-run and reads no production environment/database settings. Existing output directories are refused to protect reports.

The following is a **future live command only**, not executed or authorized by this task:

```powershell
node scripts/lcup-v2-evaluation/run.cjs --scope smoke --model claude-sonnet-5-5 --max-requests 6 --max-input-tokens 600000 --max-input-tokens-per-request 120000 --max-output-tokens 24576 --max-output-tokens-per-request 4096 --max-cost 2 --out docs/lcup-v2-evaluation/live-smoke-REVIEWED --live --confirm-paid --authorization-file docs/lcup-v2-evaluation/authorization.smoke.REVIEWED.json
```

It requires an API credential in the process environment and a separately supplied, unexpired authorization receipt binding the prepared hash, policy, scope, model, reviewer/receipt identity and every limit. The [authorization template](prepared-final/authorization.template.json) deliberately has `approved:false`, blank approver/timestamps and cannot authorize a request. No approved receipt was created. Neither a CLI flag alone, existing Stage flags nor the old budget ceiling grants approval. A pilot requires its own explicitly matching scope/limits receipt; the runner never automatically proceeds from smoke to pilot.

Before live authorization, review the exact captured prompts/source snapshot, requested model availability, pinned-price assumptions and run budget. Do not put credentials in CLI arguments or receipts. Application `.env` is never loaded or modified by the runner. Request headers/credentials are not persisted; provider errors, raw bodies and result serialization are redacted against the supplied key.

Stops/refusals include: missing approval/key/model, expired or mismatched receipt, altered sources/prompts/contexts, unknown/duplicate/held IDs, existing output directory, impossible initial plan, request/input/output/cost caps, shared-budget lock/ceiling, provider refusal/rate-limit/timeout/error, unsupported model provenance, invalid schema/quotes/coverage and unproductive responses. Valid but academically insufficient judgments remain insufficient/faculty-review evidence, never approval. Partial or unattempted scope is explicitly retained.

### Future report generation

After a separately approved genuine run:

```powershell
node scripts/lcup-v2-evaluation/report.cjs docs/lcup-v2-evaluation/live-smoke-REVIEWED
```

The run directory retains `plan.json`, authorization receipt, bounded `ledger.json`, `results.json`, and separate `raw/NNN.request.json` / `raw/NNN.json` transcripts. Request headers are excluded. Token usage, actual returned model, latency, request-level estimated cost/guard charge, input/reference bindings and hashes remain associated with the relevant cases. Costs shared by a batch are not invented as per-relationship charges.

The report generator verifies transcript/source/prompt bindings and reuses existing response validation. It emits:

- `review-report.json`: actual verified judgment, explanation, quotes/matching status, review flags, withheld/retained correction, identified responsible field when supplied, paths, provenance and incomplete/invalid state for each case.
- `review-report.md`: readable nonofficial results with explicit genuine/mock provenance and faculty-review limitation.
- `benchmark-model-input.json`: source-bound raw judgments in the existing benchmark measurement format. This reuses the existing measurement implementation rather than introducing another accuracy engine.

Incorrect quotes/schema/missing answers are flagged mechanically. Unsupported explanations and unsafe drafts preserve existing restrictive review annotations; academically plausible but wrong recommendations still require independent faculty assessment. Potential false approvals/rejections are explicitly undetermined without independent reference judgments. Expected faculty labels, recommendation appropriateness and accuracy percentages remain unassigned/null. No developer construction intent becomes faculty gold. The export test verifies that mock provenance cannot be promoted into genuine accuracy reporting and that zero faculty labels produce no agreement percentage. No actual model accuracy has been calculated.

## E. Preservation, limitations and final status

[integrity.json](integrity.json) verifies the original comprehensive evidence and this task's baseline. Of1,162 captured current files, only the eight authorized existing source files changed. Cross-checking all1,205 files from the earlier comprehensive baseline also finds only those same eight source changes; all other1,197 match. This includes ignored reference/PDF artifacts from that earlier inventory. Historical evaluations, protected datasets, verified fixtures, approved references and `server/.env` remain unchanged. Three new production helpers and all test/evaluation/report files are enumerated in [FILES.md](FILES.md). HEAD remains `68926cb392756c07bb0b999538d098d1038be368`; no commit was made.

| Area | Status | Evidence/remaining conditions |
|---|---|---|
| D1 correction | **COMPLETE, targeted regressions passed** | Whitespace/markup/raw-cell scaffolding rejected as missing; valid syntax preserved; no text rewriting |
| D2 correction | **COMPLETE, targeted regressions passed** | Controlled400 for malformed arrays/objects; original SQL failure fixed; auth/read-only behavior preserved |
| Offline software correctness | **READY_WITH_CONDITIONS** for this targeted scope | 473 distinct passing tests and successful build; full1,188 selection not repeated; existing score rounding/APA/browser/live-provider limits remain |
| Controlled Claude smoke/pilot execution | **READY_WITH_CONDITIONS** | Final eligible manifests, actual prompts and guarded runner prepared; explicit live authorization/key/model/pricing/budget review still required |
| Actual Claude academic accuracy | **NOT YET MEASURED** | No genuine responses or independently adjudicated V2 reference judgments produced here |
| Policy V2 production integration/deployment | **NOT_READY** | V2 deliberately inactive/nonofficial; academic validation, reference rollout and production integration remain separately unauthorized |

Remaining limits include plain-text APA formatting/authenticity, real-browser/accessibility/deployed-auth verification, unreviewed academic classification/value interpretations, real Cyber syllabus coverage and held institutional mapping bases. None was silently resolved by this task. The existing weighted compliance score can round to100 while a finding exists; changing that policy was not authorized. A high score does not override missing evidence or the separate academic disposition.

Recommended next action: review the narrow source patches, final smoke prompts/manifests and execution caps; obtain explicit authorization for the three-case smoke only if acceptable. Then inspect genuine transcripts and faculty review needs before separately authorizing the21-case pilot. No paid request, reference rollout, production activation or deployment has been initiated. Work stops for review.
