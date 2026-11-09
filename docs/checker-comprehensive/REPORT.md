# Comprehensive Hybrid AI Checker implementation report

Generated 2026-11-04T21:34:51.928Z from the existing working tree. [Complete inventory](inventory.md), [machine-readable inventory](inventory.json), [activation matrix](activation-matrix.md), [all synthetic run receipts](runs.json), [exact test counts](test-results.json), [scoring parity](scoring-parity.json), [exact task file list](files.json), [staging instructions](STAGING.md).

## Outcome and limits

The existing checker now has a server-owned comprehensive testing profile and a saved per-run coverage manifest. No live Claude/paid API call, production activation, DB migration, real-record update, commit, push or deployment was performed. All model results below are scripted software-conformance observations. No 100% academic-coverage claim is made.

Registered deterministic rules: **47**. Direct Hybrid-2 rules: **44**. C-04/R-02/R-03 remain replaced; link availability does not prove reference count, publication year, age, formatting or authenticity. APA text diagnostics are separate advisory checks, not restored legacy deductions. Total catalogue entries: **195**, including report aliases/subchecks; they are not new official rules.

## Implementation

- Added centralized profile/catalogue/coverage modules to the current shared checker; no parallel checking service. Default activation and paid-provider authorization are unchanged.
- Comprehensive routing preserves Plan-sequence and distinct Stage A/B3/B4/C1/C2/D1/D2 and Week 1 checks; V2 owns overlapping A/B/C3/title-description/description-plan advisory questions. Scored legacy questions retain their original contracts and deductions. V2's scored-type overlap is intentional because its advisory classification/context contract differs; no second deduction is made.
- V2 now honors useAi=false. Its validated judgments are persisted and reused by the existing fingerprint cache, including provider/model/prompt/reference context identity. Request/token/cost budgets remain shared; no limits were increased. Each answer records whether its pair reached the request hook, separately from cache reuse and evidence verification.
- Added deterministic execution receipts without changing score calculation; quality and APA predicates now record successful execution as well as findings. Missing PO-EGA crosswalks produce NOT_CHECKED coverage without silently changing the old scoring formula.
- Corrected CLO-08 structural checking so a valid label assigned to the wrong CLO number requires review. Faculty text/labels are not changed.
- Added an expandable coverage section in the existing faculty/admin report with English and Filipino status labels. The hidden Verdict Panel stays hidden. Stored reports remain backward compatible; older reports do not gain fabricated receipts.

## Activation and observed execution

| Configuration | Catalogued | Implemented | Enabled | Executed | Attempted | Verified | Failed | Needs review | N/A | Not checked | Partial | Test-double requests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| aiDisabled | 195 | 184 | 113 | 99 | 90 | 90 | 6 | 2 | 10 | 95 | 0 | 0 |
| legacy | 195 | 184 | 113 | 113 | 105 | 102 | 6 | 2 | 10 | 83 | 0 | 13 |
| policyV2 | 195 | 184 | 131 | 131 | 123 | 120 | 6 | 2 | 10 | 65 | 0 | 29 |
| comprehensive | 195 | 184 | 180 | 162 | 155 | 153 | 8 | 3 | 22 | 19 | 1 | 38 |
| providerUnavailable | 195 | 184 | 180 | 121 | 112 | 111 | 8 | 3 | 21 | 62 | 1 | 0 |

[Per-namespace and per-instance counts](runs.json) keep aliases and relationship instances separate. ACTlVE means the required evaluation receipt exists, including a verified FAIL; it does not mean pass. Deterministic NEEDS_REVIEW is a completed heuristic, not an official academic approval. Model verification requires validated quotations; unavailable/unasked responses never count as complete.

## VPAA and CLO coverage

| VPAA ID | Relationship | Verified in scripted comprehensive run | Instances |
| --- | --- | --- | --- |
| VPAA-01 | Content-course | true | 15 |
| VPAA-02 | Content-ILO | true | 15 |
| VPAA-03 | ILO-CLO | true | 15 |
| VPAA-04 | Content-activity | true | 15 |
| VPAA-05 | ILO-activity | true | 15 |
| VPAA-06 | Content-assessment | true | 15 |
| VPAA-07 | Activity-assessment | true | 15 |

All four fixed CLO classifications have separate structural and semantic entries. The fixture intentionally has repeated Introductory labels: valid evaluation can therefore include structural FAILs; the software never assumes or saves a classification. Existing 35 VPAA scenarios exercise aligned, misaligned, partial, insufficient and keyword-adversarial handling. Existing CLO classification conformance cases cover label conflicts, missing labels, ambiguous text and semantic mismatch. Scripted judgments prove response handling, not Claude accuracy. CLO-to-description is not introduced.

## Eleven reserved rules

| ID | State | Missing authority/dependency |
| --- | --- | --- |
| STR-07 | PENDING_POLICY_CLARIFICATION | VPAA must identify the approved export template/version, layout acceptance criteria and the exported artifact to inspect. PDF layout regression tests do not verify an individual checking run. |
| ADM-04 | PENDING_INSTITUTIONAL_REFERENCE | VPAA/Registrar must supply an approved, versioned grading policy with applicable program/course scope and permitted component/formula constraints. GRADE-100 alone does not establish that policy. |
| ADM-05 | PENDING_POLICY_CLARIFICATION | VPAA/Registrar must specify required approver roles, revision events, ordering, authorized signatures and which revision requires renewed approval. Existing review gates and T-27 remain in force. |
| CUR-10 | PENDING_INSTITUTIONAL_REFERENCE | Registrar must supply approved curriculum/reference versions, effective cohorts, provenance and supersession rules. CUR-REF validates selection/availability; a content fingerprint is not institutional version approval. |
| CLO-05 | PENDING_POLICY_CLARIFICATION | VPAA must supply the authoritative definition, scope, evidence requirements and decision rubric for reserved CLO-05. No scoped implementation or approved definition was located; no meaning is inferred from this identifier. |
| CLO-10 | PENDING_POLICY_CLARIFICATION | VPAA must supply the authoritative definition, scope, evidence requirements and decision rubric for reserved CLO-10. No scoped implementation or approved definition was located; no meaning is inferred from this identifier. |
| PLAN-05 | PENDING_POLICY_CLARIFICATION | VPAA must supply the authoritative definition, scope, evidence requirements and decision rubric for reserved PLAN-05. No scoped implementation or approved definition was located; no meaning is inferred from this identifier. |
| PLAN-06 | PENDING_POLICY_CLARIFICATION | VPAA must supply the authoritative definition, scope, evidence requirements and decision rubric for reserved PLAN-06. No scoped implementation or approved definition was located; no meaning is inferred from this identifier. |
| ALN-03 | PENDING_POLICY_CLARIFICATION | VPAA must supply the authoritative definition, scope, evidence requirements and decision rubric for reserved ALN-03. No scoped implementation or approved definition was located; no meaning is inferred from this identifier. |
| ALN-04 | PENDING_POLICY_CLARIFICATION | VPAA must supply the authoritative definition, scope, evidence requirements and decision rubric for reserved ALN-04. No scoped implementation or approved definition was located; no meaning is inferred from this identifier. |
| ALN-10 | PENDING_POLICY_CLARIFICATION | VPAA must supply the authoritative definition, scope, evidence requirements and decision rubric for reserved ALN-10. No scoped implementation or approved definition was located; no meaning is inferred from this identifier. |

None had a complete authoritative implementation contract in the inspected catalogues/references. Existing similar checks (CUR-REF, GRADE-100, T-27, PDF layout tests, review workflow) remain available but cannot certify these broader reserved requirements. Their precise institutional dependency now travels in the backend verdict and manifest.

## Institutional reference review

The repository contains BSIT PO-EGA mappings, with a historical provenance/approval question; BSIE and BSCpE local outcome records explicitly leave the crosswalk empty. Do not fabricate them. BSIT-CYBERSECURITY continues resolving BSIT outcomes through the existing program reference/inheritance workflow while retaining its own curriculum. No migration was executed to change any live inheritance record.

The existing reference inventory marks value definitions pending approval, APA implementation awaiting librarian confirmation, some curriculum/reference provenance unresolved, the values-profile percentages proposed, and the advisory verdict rubric unapproved. These remain advisory and do not become approved academic policy through this profile. The 18-week calendar remains existing behavior pending institution-specific calendar/version confirmation. No official partial-alignment scoring rubric was invented. See docs/institutional-reference-inventory.md and docs/lcup-academic-decisions-for-vpaa.md; these are repository evidence, not new institutional approvals.

## Testing and scoring

| Command/suite | Tests | Pass | Fail | Skipped | Todo | Cancelled |
| --- | --- | --- | --- | --- | --- | --- |
| baseline | 1960 | 1960 | 0 | 0 | 0 | 0 |
| targeted | 64 | 64 | 0 | 0 | 0 | 0 |
| vpaa | 288 | 288 | 0 | 0 | 0 | 0 |
| regression | 2026 | 2026 | 0 | 0 | 0 | 0 |

Baseline was 1,960 passing tests, not the previously reported 1,940. Current command logs are linked from test-results.json. Build exit: 0. Existing large-bundle/performance warnings are not checker failures.

The six official area weights remain 20/20/20/15/10/15 and the threshold remains 79. Existing -3/-1 semantic deductions, tag grouping/secondary treatment, -1 values presence and -2 confirmed link deductions remain unchanged. Parity assertions compare scores, base scores, passed state, threshold and deduction records in aligned/partial/misaligned/insufficient scripted cases. Existing route tests exercise faculty/admin permissions, saved reports, correction actions, hard gates and approval flow.

## Remaining coverage limitations

- Live model accuracy is unmeasured. No paid calls are authorized or performed.
- Eleven reserved IDs remain NOT_CHECKED pending the decisions above. Missing approved crosswalks/versioned references limit institutional verification.
- External reference authenticity remains off; plain text cannot verify italics/hanging indentation or physical exported layout.
- Existing scoped factories, context limits, eligibility checks, request caps and provider refusals can leave criteria unasked; the manifest preserves those gaps. A nonempty field or a passing base relationship does not certify a deeper unassessed aspect.
- All 47 deterministic rules have explicit valid/invalid/missing fixtures and execution receipt parity tests. Boundary and non-applicable scenarios follow each rule's declared domain; not every rule has a distinct explicit invalid-boundary fixture. Inventory.json records that limitation instead of claiming universal boundary coverage.
- IDs without a literal/type-linked test-file trace: INST-MASTER, ILO-MISSING, ILO-NUM, GRADE-RANGE, workload.manyTasksInAWeek, CUR-06, CUR-07, CUR-08, CUR-09, STR-01, STR-04, STR-06, ADM-03, APA:DATE_MISSING, APA:DATE_PERIOD, APA:DATE_RANGE, APA:AUTHOR_MISSING, APA:AUTHOR_PERIOD, APA:AUTHOR_FORM, APA:AUTHOR_AND, APA:AUTHOR_COMMA, APA:AUTHOR_AMPERSAND, APA:AUTHOR_INITIALS, APA:TITLE_MISSING, APA:TITLE_QUOTES, APA:JOURNAL_VOLUME, APA:JOURNAL_NAME, APA:BOOK_LOCATION, APA:CHAPTER_PAGES, APA:CHAPTER_PUBLISHER, APA:REPORT_PUBLISHER, APA:CONF_IN, APA:WEB_URL, APA:RETRIEVED, APA:ACCESSED, APA:DOI_FORM, APA:DOI_MALFORMED, APA:URL_HTTP, APA:URL_MALFORMED, APA:URL_TWICE. Literal traces are not branch-coverage measurements. Reserved rules cannot have behavioral conformance tests without a policy contract; their NOT_CHECKED handling is tested.

## File changes and activation

Only files in [files.json](files.json) were intentionally edited/added by this task; pre-existing local work was retained. Generated conformance reports under docs/vpaa-conformance may be refreshed by their existing generator. No environment file was written. Enable the profile only through [STAGING.md](STAGING.md) after separate staging authorization; live model use remains separately unauthorized.
