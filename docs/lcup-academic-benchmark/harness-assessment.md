# Reusable evaluation infrastructure

No new AI Checker or AI stage was created. The new code is an isolated source adapter, review-material exporter and offline metrics adapter. All production Policy V2 code remains unchanged.

| Existing tool | Reuse in this task / future controlled evaluation | Important limit |
|---|---|---|
| `academicV2Plan.plan`, `POLICY.weeklyTypes` | Used directly to build independent seven-link, course-level, classification, C1/D1 and missing-evidence cases | Planner availability is not faculty correctness; reference holds and bounded contexts remain visible |
| `lessonfit.assessmentPairs` | Used for optional assessment-appropriateness review | These are potential C2 diagnostics, not a new required eighth link; actual pipeline C2 remains conditional |
| Existing three verified fixtures, raw extraction evidence and frozen masters | Used unchanged; exact source paths/hashes/pages retained | Frozen PO and curriculum issues must not become approved current-reference judgments by assumption |
| `local-curriculum-data.cjs`, canonical official PO JSON | Used as read-only source-attributed references for all four synthetic program contexts | No database row, curriculum or PO is changed; synthetic authored content/mappings are not approved |
| `gemini.validate`, `contractOf`, `evidenceQuote` | Used to validate supplied future raw responses and quotations against each exact case | Mechanical verification does not establish evidence relevance or academic truth |
| `academicV2Replay.replayOptions` | Reused to obtain the existing V2 response contract using its local offline configuration | Its data-only transport is not called by the metric adapter; it cannot be converted to a paid fallback |
| `eval/metrics.scoreEval` | Used for agreement, confusion/error denominators and relationship/program groupings | Legacy function names invert the ordinary meaning some readers expect: `falseNegativeRate` corresponds to false academic approvals, `falsePositiveRate` to false academic rejections. New output uses explicit names |
| `eval/qualityMetrics.qualityOf` | Reused for named false approvals/rejections and mechanical evidence diagnostics | Developer heuristic diagnostics are kept separate from faculty evidence/recommendation ratings; its old provisional-expectation note is not a faculty accuracy claim |
| `eval/evalMetrics.createTracker` | Reused for planned, attempted, never-attempted, verified and unresolved counts | No existing default unresolved-rate stop is adopted as an institutional accuracy threshold. The explicit run plan excludes unselected/reference-held cases |
| `import-align1-faculty-responses` CSV writer/parser | Imported directly for quoted, BOM/CRLF CSV and formula-safe cells | Its full Word/CSV return importer is tied to the old package version, question set and codes; it is not used to import this new schema or write its existing outputs |
| Earlier faculty packages V1/V2 | Reuse independent Part A → separate Part B → adjudication procedure and expertise/reassignment safeguards | Do not copy their developer labels or software answers into new gold labels. Existing packages and response-importer outputs are untouched |
| Phase3 faculty exporter | Inspected for context, source and review fields | Its form shows developer expected findings and planted-defect descriptions; direct reuse would compromise this independent Part A. It was not executed or recreated as an evaluation phase |
| `eval-alignment.cjs`, `live-pipeline-eval.cjs` | Future reuse of existing Claude adapter, budgeting, ledgers, stop guards, evaluation-only behavior and raw response retention | Not executed. `eval-alignment` accepts fixed dataset aliases, not this package's arbitrary file path; it does not currently select this V2 benchmark/prompt unchanged |
| `eval/providerGuard`, `eval/claudeEvaluation`, Anthropic client | Existing foundation for a separately authorized model/scope/budget run | Historical allowlists/budget registers are not a new spending authorization. Do not run old commands against new cases or overwrite historical ledgers/results |

## Current safe entry points

```text
node scripts/lcup-academic-benchmark/build.cjs --check
node scripts/lcup-academic-benchmark/run-offline.cjs
node scripts/lcup-academic-benchmark/summarize.cjs
node scripts/lcup-academic-benchmark/verify.cjs
```

The builder's default creates only absent files and otherwise verifies identical output. It refuses changed package files or possible returns. An explicit development-only `--refresh-unassigned` first checks every generated file against the old manifest and requires blank/unassigned templates. It does not permit regeneration over returned or edited materials. Once faculty review begins, freeze/distribute the package and preserve every returned original separately; do not use refresh as a review workflow.

The metrics CLI accepts explicit data files only, with an optional exclusive-create output path:

```text
node scripts/lcup-academic-benchmark/measure.cjs --dataset <cases.json> --adjudication <adjudicated.json> --model <model-results.json> --proposals <proposals.json> --evidence-reviews <evidence-reviews.json> --recommendation-reviews <part-b.json> --output <new-result.json>
```

It has no provider/paid/activation mode and does not read `.env`. The actual blank-template CLI was executed successfully; [cli-measurement.json](cli-measurement.json) reports awaiting faculty adjudication and null accuracy rates.

## Required handoff before a paid run

Reuse, rather than duplicate, the existing guarded Claude runner through one separately reviewed dataset/prompt adapter. It must consume selected eligible case IDs and their exact contexts, preserve the V2 prompt suffix and response contract, exclude faculty labels/construction intents from requests, bind raw transcripts to the benchmark/case hashes, retain attempt/stop records and output data compatible with `measure.cjs`. Reference-held/review-only cases must not be selected for requests until their reviewed context is captured in a new benchmark version.

The current production V2 evaluator deliberately accepts offline replay only. This task does not add a live transport, change its provenance labels, or activate it. A future authorized adapter must also support reusing genuine raw responses through the existing V2 evaluation/report path without describing actual model evidence as a mock. No unguarded direct SDK loop is proposed.

For a whole-syllabus false-approval metric, faculty must review the complete required scope and a genuine V2 report must exist for that exact scope. A collection of separately reviewed pairs or the 76-case coverage selection is not such a gold disposition. The current measurement leaves this unavailable rather than constructing another disposition engine.
