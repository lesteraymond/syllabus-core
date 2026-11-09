# Corrected PO integration verification

Verified 2026-11-05T12:16:20.591Z. **Corrected POs remain active in development** at localhost:3306 / syllabus_cms_plus. This task performed only read-only development queries. All evaluation/workflow writes and schema provisioning used a separate identity-verified synthetic MariaDB server on port 43310, with its own datadir. No real faculty content, academic references, approval records, shared environment variables, staging or production database was changed. No paid/live Anthropic request, commit, push or deployment occurred.

## Activation and subject resolution

Exactly three active versioned sources serve four selections: BSIT 9, BSIE 13, BSCPE 13, Cyber 9 inherited from BSIT. Exact statement text, short labels, numbering/order, designated source hashes and version lcup-po-2026-10-29 match the existing canonical references. Cyber retains code/identity BSIT-CYBERSECURITY, has no authoritative independent master, and selects only BSIT's approved curriculum (reference ID1). Formal VPAA approval remains not_recorded. [Read-only before audit](audit-before.json), [after audit](audit-after.json), [public reference snapshot](references.json).

The actual subject resolver was read against these existing development catalog subjects:

| Program | Subject | Approved curriculum year / ID | PO source | Resolved POs | Existing catalog CLOs |
|---|---|---|---|---:|---:|
| BSIT | IT 202 (catalog 41) | 2022-2023 / 1 | BSIT | 9 | 0 |
| BSIE | IE-402 (catalog 130) | 2022-2023 / 2 | BSIE | 13 | 0 |
| BSCPE | CpE-304 (catalog 182) | 2022-2023 / 3 | BSCPE | 13 | 0 |
| BSIT-CYBERSECURITY | IT 202 (catalog 226) | 2022-2023 / 1 | BSIT | 9 | 0 |

IT 202, IE-402 and CpE-304 were found in the applicable approved curriculum before use. Titles, prerequisites, lecture/lab units and year levels come from those records. Cyber uses BSIT's IT202; no separate curriculum was invented. The browser fixture copies these public references into a fresh synthetic catalog and supplies explicitly synthetic faculty-authored CLO statements/subset mappings. Those test choices are never presented as approved course-specific mappings. No subject automatically selects every program PO.

## Deterministic and semantic contracts

Focused tests exercise T-12's submitted catalog snapshot comparison; P-01/P-02 tag validity; PO-MASTER's missing-master branch; PO-EXACT's exact wording comparison; and CLO-MAP invalid tags. Wrong wording, missing lists, unknown numbers, old reference bases and obsolete BSIT PO10 are detected without rewriting input. **P-03 is NOT_CHECKED / unverified** because the corrected source supplies no approved PO–EGA crosswalk. The legacy numeric behavior is preserved; lack of a finding is not a verified mapping pass. No crosswalk was fabricated.

All four selections send exact current statements in CLO–PO / CLO-anyPO and exact EGA context in CLO–EGA / CLO-anyEGA requests. A real existing PO number receiving a scripted NOT_ALIGNED judgment stays academically misaligned. The existing secondary-tag policy remains: an aligned whole-list answer can make another tag's mismatch advisory; unsupported groups retain their authorized deductions. Baseline and optimized negative cases have equal scores/deductions. New or invalid PO tags are refused, invented source quotations are unverified, and no model answer can mutate the official master or faculty mappings. Recommendations remain faculty-review proposals. [Focused evidence](focused-evidence.json).

## Policy V2, classifications and coverage

The explicit isolated profile SYLLABUS_CHECK_PROFILE=comprehensive-testing resolves Policy V2 and applicable stages even when the V2 switch is explicitly off in that test process. Production code, existing contracts, overlap suppression and request budgets are used. All seven relationships are evaluated independently with their own source/target texts, week, VPAA ID, status, explanation and evidence receipt: Title–Content; Content–ILO; ILO–CLO; Content–Activities; ILO–Activities; Content–Assessment; Activities–Assessment. Scripted mixed verdicts include aligned, partial, not aligned and insufficient evidence, including shared-keyword inputs with different required performances. No verified result is inferred from populated fields or enabling a flag.

CLO1 Introductory, CLO2 Enabling, CLO3 Demonstrating and CLO4 Integration of Values retain separate structure and semantic receipts. Correct labels with deliberately inappropriate scripted statements, wrong labels, missing classifications and ambiguous statements are handled distinctly; missing labels are not guessed or sent as verified semantics. Title/program and original CLO statements reach the model contract. No statement or classification is automatically changed. [Per-program type/instance and classification coverage](academic-coverage.json). Rule types and per-week instances are reported separately; missing institutional references and reserved policies prevent any 100% academic-coverage claim.

## Full application workflow

The existing React application, real Express API and shared checking/storage services were driven in Edge over local HTTPS, with the existing scripted Claude transport and network guard. For each of four selections the browser selected the program and approved subject, verified exact PO text and mapping choices, completed Step1, supplied long synthetic Steps2–6 through the authenticated content API, opened Review, ran comprehensive checking through the UI, read score/VPAA/classification/semantic findings, saved and reloaded the same report, reviewed recommendations, submitted the synthetic draft and checked its administrator view. No synthetic approval was performed in these four-program cases. The separate existing regression exercised its synthetic approval chain.

Baseline program cases: **4 passed / 0 failed**. Recommended-flags cases: **4 passed / 0 failed**. [Baseline results](browser-baseline/results.json), [optimized results](browser-optimized/results.json). Public PO/curriculum data came from the read-only development snapshot; no real syllabus records were copied into the test DB. Faculty/admin screenshots and saved reports are under those directories. This verifies the local full-stack software workflow, not a deployed staging/production environment.

## Optimization and official scoring

The documented recommended isolated settings are CACHE_WARMUP=on, OUTPUT_PLAN=on and OUTPUT_FIELDS=scoped. Optional COURSE_CONTEXT=scoped was separately compared in focused tests. Week grouping and prompt trimming remain off in the browser comparison. No new optimization was added. Official outcomes, six weighted areas, verdicts, all seven VPAA types, four classifications, corrected PO evidence and saved provenance match the baseline; provider-unavailable/disabled checks never become verified academic passes. [Scoring parity](scoring-parity.json).

The official standard remains 47 registered / 44 direct Hybrid-2 rules; weights 20/20/20/15/10/15; pass threshold79; existing scored deductions, secondary-tag handling, submission and approval policies unchanged. The scripted browser used the existing offline harness's $100 reservation cap solely to fit complete test coverage; ordinary development/provider limits were not edited, no provider-side limit was raised, and no charge occurred. Request counts are software measurements, not real billing/cache-hit savings. Prompt-cache markers, output planning, scoped fields, reuse and failure validation also run through the existing optimization regression tests.

## Regression results and unrelated work

| Automated suite | Passed | Failed | Skipped | Todo |
|---|---:|---:|---:|---:|
| repository | 2151 | 0 | 0 | 0 |
| vpaa | 294 | 0 | 0 | 0 |
| focused | 15 | 0 | 0 | 0 |
| optimization | 21 | 0 | 0 | 0 |
| source | 4 | 0 | 0 | 0 |

Build passed (existing non-fatal bundle-size warning). The existing browser regression finished **21/23 scenarios**, 351/353 assertions, 2 failed scenarios. **E18 and E20 now pass. E19 still times out selecting the semester filter. E23 attempts Step2 after saving metadata without the required description and is blocked by Step1.** These failures occur in the baseline with optimization/profile flags off; their academic-year/subject-term product work was not edited. The follow-up semester filter probe result is recorded in optimized browser results, separately from the unchanged raw E19 result. No failed suite is reported as green.

The applicable comprehensive browser suite summary is in [test-results.json](test-results.json) and docs/checker-comprehensive/ui-verification/comprehensive-po-integration-1105/results.json. Suite counts overlap. Newly written harness setup/selector mismatches (isolated login, certificate configuration, curriculum input locator and administrator picker separator) were corrected in task-owned test code, with initial outputs preserved. No academic policy/scoring change was used to satisfy a test.

## Historical protection

The whole-development inventory hash changed during the run. Exact table comparison identifies only **usage_daily** (43→43 rows; data changed=true, schema changed=false). The other **52 tables** have identical data/schema hashes, including all academic references, faculty content, historical reports and approval records. The eight historical review contents/statuses match. Task development connections used READ ONLY transactions and rejected non-SELECT/SHOW academic queries; this unrelated usage change is recorded without attributing it to a particular session or undoing it. See changesDuringVerification in audit-after.json. It is not a whole-database-unchanged claim. Seven PO remediation items (43,93,97,99,100,101,102) and one curriculum item110 remain needs_review; their guard codes remain visible. Original PO10 on syllabus99 is not renumbered. Historical reports/versions/decisions and institutional data are preserved. Previous reference labels that were never recorded remain previous_or_unknown, with original basis/proposed version and hashes retained in remediation/activation backup evidence; no historical version was invented. No remediation was resolved automatically.

## Activation/readiness distinctions

| Capability | Status |
|---|---|
| Corrected PO references in development | ACTIVE; verified read-only |
| Comprehensive profile in isolated tests | ACTIVE; scripted provider only |
| Comprehensive profile / Policy V2 for ordinary development users | OFF/unset; shared environment checksum unchanged |
| Real Anthropic network/auth/cache/billing integration | NOT VERIFIED in this task; zero live calls authorized or made |
| Real Claude academic accuracy | NOT VERIFIED; scripted answers cannot prove it |
| Formal VPAA approval of corrected POs | NOT_RECORDED |
| Staging / production activation | NOT PERFORMED |

Technical reference selection, contracts and isolated workflow are prepared for separately authorized real-Claude testing. Before that run, obtain explicit authorization for the named environment and synthetic/public text, verify a dedicated permitted model/key, confirm provider-side spend controls and existing per-run limits, and use the existing guarded live-test procedure. Open E19/E23 regression failures remain visible and prevent a blanket production-readiness claim. Institutional approval, authoritative Vision/Mission/EGA review, approved PO–EGA crosswalks and eight faculty/curriculum reviews remain outstanding. No permission is assumed or requested to make live calls during this task.

Exact changed files and evidence are in [files.json](files.json). No existing product source needed modification for confirmed PO integration behavior.

## Budget browser check

The existing B01 tight-budget suite completed 1/1 scenarios, 37/37 assertions, with 0 failed scenarios. Deferred optional/required checks retain their explicit incomplete status. Evidence: docs/checker-comprehensive/ui-verification/budget-po-integration-1105/results.json. The test uses a scripted provider and preserves the configured cap.
