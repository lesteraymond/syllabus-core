# Academic evaluation benchmark preparation

Date: 2026-10-29. Benchmark: **`lcup-academic-benchmark-1`**. Policy: `academic-evaluation-v2-preview-1`.

**The offline benchmark and review materials are prepared. Actual academic accuracy is not yet measurable.** There are no assigned faculty labels or genuine Claude responses. Production Policy V2 remains inactive, and every existing project file captured before this task remains unchanged.

## Deliverables

- [Faculty reviewer guide](REVIEWER-GUIDE.md), [review dataset](package/cases.json), [blank Part A JSON](package/faculty-part-a.responses.json) / [CSV](package/faculty-part-a.responses.csv), [adjudication template](package/adjudication-template.json).
- Program-specific reviewable HTML: [BSIT](package/faculty-BSIT.html), [Cyber Security](package/faculty-BSIT-CYBERSECURITY.html), [BSIE](package/faculty-BSIE.html), [BSCpE](package/faculty-BSCPE.html).
- [Separate recommendation-review page](package/faculty-part-b.html), [blank Part B responses](package/faculty-part-b.responses.json), [model evidence-review template](package/model-evidence-review.template.json).
- [Reference verification report](reference-verification.md) and [exact comparison/source data](package/reference-verification.json).
- [Reusable harness assessment and handoff limitations](harness-assessment.md), [proposed metrics and denominators](metrics.md).
- [Inventory/coverage](inventory.json), [76-case coverage selection](package/pilot-selection.json), [package manifest](package/package-manifest.json), [unavailable measurement result](not-yet-measurable.json), [executed CLI result](cli-measurement.json).
- [Executed test commands/results](test-results.json), [integrity verification](integrity.json), [exact added files](FILES.md).

## Cases and faculty materials

| Program | Verified-source cases | Synthetic cases | Total | Cases with reference/context holds |
|---|---:|---:|---:|---:|
| BSIT | 211 | 77 | 288 | 43 |
| BSIT–Cyber Security | 0 | 77 | 77 | 4 |
| BSIE | 146 | 77 | 223 | 29 |
| BSCpE | 147 | 77 | 224 | 50 |
| Total | **504** | **308** | **812** | **126** |

The three verified contexts are unchanged IT202, IE402 and CpE304 fixtures with their raw source evidence and frozen masters. Their originally declared PDF paths are absent here; byte-identical `reference-data/` copies were located and hash-verified. The official IT101/IE403/CPE404 PO references and all eight curriculum images were hash-verified. No approved syllabus was invented for Cyber Security. Its examples use explicitly synthetic prose against its actual separate 2025–2026 curriculum and inherited nine-PO source.

The pool includes all seven relationships independently. Counts (real / total): Title–Content 24/48; Content–ILO 51/75; ILO–CLO 81/109; Content–Activities 24/48; ILO–Activities 51/75; Content–Assessment 24/48; Activities–Assessment 24/48. These are relationship observations and explicit missing-mapping placeholders, not numbers of independent syllabi. Grouped weeks, orientation, examinations in the schedule, every authored mapping and untagged ILOs remain represented.

Course title/description and taught-content relationships, Course-CLO, CLO–PO/EGA, classification meaning, learner support, content/value integration, optional deeper assessment appropriateness and objective four-CLO/schedule/field/APA-text review are also included. Sixty-one objective-review cases remain separate from 751 semantic/diagnostic observations. Optional Assessment-fit does not create an eighth required weekly link.

Synthetic contrasts include coherent-looking candidates, partial-scope candidates, complete but unrelated human-anatomy content, deliberately changed mapping tags, ambiguous prose, missing evidence and classification-meaning contrasts. These are **construction intents, not expected academic answers**. They are retained only in `coordinator-only.json`; all reviewer judgments remain unassigned. Faculty must determine which are aligned/partial/not aligned/insufficient. The eight Part B proposals include grounded-looking and unrelated-looking corrections, are clearly synthetic, and are not attributed to Claude or labelled academically correct/incorrect.

The 76-case selection covers 28 weekly relationships plus 48 other criteria/diagnostics across the four programs. It is a manageable coverage starting point, not a correctness-balanced/statistically representative benchmark or an authorized paid batch. Seventeen selections are reference-held items requiring review. Actual assignments and all reviewer identities are blank.

Every case retains an ID/hash, exact planned or explicitly authored-basis source/target, full context binding, original structured fields, source file hashes/pages, raw excerpts, selected program/curriculum and reference holds. Real CLO–PO review cases expose authored PDF meanings and preserve the frozen planner's text separately; none are silently mapped into a new meaning. English source wording, spelling, punctuation and grouped/exam rows remain intact. Faculty can record expected judgment, evidence, reason, responsible field/relationship, correction, expertise, identity, date and status. Separate Part B/evidence templates handle recommendation appropriateness and whether model evidence supports its explanation.

The HTML export behavior was exercised offline: editing one case exports only that supplied judgment, keeps the rest unassigned and retains benchmark/case bindings. It makes no network request or official decision. Returns are `faculty-return-unverified`; an identified adjudication is required separately. Raw returned files must be retained outside the blank package.

## Reference readiness and blockers

The designated current source data has BSIT 9, Cyber the same inherited 9, BSIE 13 and BSCpE 13, including full engineering PO12. Cyber's course curriculum remains separate. This verifies local source/reference content, not a live database deployment.

IT202's authored nine-PO list matches the designated official IT101 reference exactly; its frozen master export still has ten different POs. Both engineering fixtures have thirteen but differ from the designated complete references, including PO12 and additional literal wording/punctuation differences. All 43 real CLO–PO review cases remain held while using conflicting frozen masters. Current canonical references are not used to reinterpret historical tags automatically.

Existing title/curriculum issues are preserved: BSIT's canonical title has a parenthetical suffix; IE402 differs in title capitalization under the unchanged exact policy; CpE304's authored code differs from the approved hyphenated curriculum code. The source PDFs do not specify curriculum year. Institutional EGA names lack richer approved definitions, value definitions remain `pending_approval`, and missing/ambiguous mappings need faculty review. These reference limitations are not assigned to faculty as invented academic mistakes.

The prior official PO correction was tested against a disposable database and not applied to the last verified existing-database snapshot. The existing resolution/inheritance/remediation logic can be reused after separate authorization. This task made no fresh database connection and does not claim a new current-database state. Before actual record-based evaluation, establish an explicitly reviewed isolated reference context or separately authorize the existing rollout/remediation workflow. Do not bypass historical PO-basis guards, alter faculty records or run migrations to make this benchmark appear ready.

## Infrastructure reuse and measurement

Used the existing V2 planner, C2 pair factory, response/evidence validator, CSV parser/writer, `scoreEval`, `qualityOf` and distinct-relationship tracker. Reused the earlier faculty-review packages' independent Part A/Part B/adjudication procedure. The old generic/development datasets, protected 42 held-out cases, old developer expected labels, actual A1/A2/A3/B1/B2 results and faculty-response importer outputs were not incorporated as new faculty gold or rewritten.

The existing guarded paid evaluation scripts remain the foundation for a later approved run. They cannot consume this package unchanged: the alignment CLI has fixed dataset aliases, and the production V2 evaluator is intentionally offline-only. A separately reviewed thin dataset/prompt/result adapter is still required to bind selected cases, the V2 prompt namespace, source snapshots, budgets and raw transcripts through those existing guards. No new provider loop, checker or AI stage was created here.

The measurement adapter is data-only. It checks benchmark/case version/hash and model provenance, validates exact response quotations through existing code, uses an explicit selected run plan, excludes objective/optional/reference-held cases from required semantic accuracy, and separates real/synthetic/program/type groups. It measures false approvals/rejections, strict/permissive agreement and missing/invalid/unattempted results when actual eligible faculty/model evidence is supplied. Evidence support and recommendation appropriateness require independent human ratings; quote containment alone is not academic correctness.

Current output is **awaiting_faculty_adjudication**: zero gold labels, zero responses, zero planned requests, null accuracy/error rates and no institutional threshold. Unit tests use explicitly marked mock judgments only to verify arithmetic and safeguards; none are stored in benchmark faculty templates. Whole-syllabus false academic approval/rejection remains unavailable until complete-scope faculty dispositions and genuine version-matched V2 reports exist. No second disposition engine was built to invent them.

## Executed verification

Final targeted result: **149 passed, 0 failed, 0 skipped**, plus a successful read-only package regeneration check and successful data-only metrics CLI execution.

| Executed suite | Passed | Log |
|---|---:|---|
| New benchmark sources, forms, citations, blank labels, measurement and preservation | 36 | [benchmark-tests.log](benchmark-tests.log) |
| Existing V2 replacement/API/context/reference/persistence protections | 51 | [policy-v2-regressions.log](policy-v2-regressions.log) |
| Existing reused metrics tests | 18 | [existing-metrics-tests.log](existing-metrics-tests.log) |
| Existing consolidated seven-link/C3 tests | 44 | [existing-chain-tests.log](existing-chain-tests.log) |
| Package `build --check` | Command exit 0 | [package-check.log](package-check.log) |

All test commands/results are in `test-results.json`. This task does not claim to have rerun the earlier complete 604-test selection. It reran the relevant existing suites and added benchmark-specific coverage. No full `npm test`, paid runner, old package exporter, protected response importer or migration was executed.

Initial test findings are retained: the first run had 33 passes and one assertion failure because the citation test incorrectly expected a mapped CLO page for an explicitly untagged ILO. The test now verifies that its source remains empty. The later form-interaction check exposed a `structuredClone` dependency absent in the DOM harness; the new standalone exporter now copies JSON using standard JSON serialization, and its actual export behavior passes. This changed only the newly created review-material renderer. Policy V2 needed no defect correction or modification. Initial/debug and final logs are separate.

## Files and preservation

All added files are under `docs/lcup-academic-benchmark/` and `scripts/lcup-academic-benchmark/`; see [FILES.md](FILES.md). No existing project file was modified. New scripts implement reference location/checks, synthetic stimuli, planner-to-review adaptation, standalone HTML/CSV/JSON materials, a thin measurement adapter, targeted tests and inventory/integrity reporting. This is benchmark preparation, not a parallel AI Checker.

The task started with an extensive dirty working tree. The before snapshot captured 1,161 existing project files, including the protected datasets, faculty packages, reference data, PDFs, old evaluations, Policy V2 implementation, deterministic rules/gates and `server/.env`. All 1,161 remain byte-identical; none were deleted. HEAD is unchanged. Test-created synthetic scratch returns are isolated under `tmp/academic-benchmark-test-*` and retained; they are not faculty review results or response-importer outputs. No production flag, official score, passing mark 79, submission gate or reference was changed.

## Remaining prerequisites and recommended next step

1. Review the case pool and coverage selection; confirm faculty expertise, assignments, independent review/adjudication protocol and handling of reference/interpretation questions. No additional document request or presumed faculty answer is made here.
2. Collect actual independent Part A reviews, preserve returns, adjudicate disputes and bind the accepted evidence to this benchmark/reference version. Review synthetic proposals separately after Part A. Do not use construction intents or software labels as gold.
3. Resolve the identified evaluation reference holds through authorized institutional review and an explicitly versioned isolated reference context. Preserve historical mappings; an existing-database migration remains a separate authorization.
4. Freeze selected case families and their intended development/validation use before tuning. Do not incorporate the protected 42-case held-out set. Recognize that 812 correlated observations from three real syllabi do not establish broad generalization, and Cyber has no real-syllabus accuracy evidence yet.
5. Review one adapter to the existing guarded Claude runner for this package/V2 namespace; approve exact eligible scope, model/configuration, budget, output/ledger locations and raw-response retention. No previous budget or model allowlist is treated as permission to spend now.
6. Only after explicit authorization, run the controlled evaluation and then independently review actual Claude evidence/recommendations. Report program/type/source-specific denominators, coverage, false approvals and false rejections without inventing an institutional acceptance threshold or academic score.

**Readiness:** ready for faculty/coordinator review of the benchmark; not yet ready to claim accuracy or run a live V2 evaluation unchanged. Paid/model requests: 0. Database connections/writes/migrations: 0. Production activation and commit/push/merge/deploy actions: 0. Stopped for review.
