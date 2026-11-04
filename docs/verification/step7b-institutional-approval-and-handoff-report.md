# STEP 7B — INSTITUTIONAL APPROVAL AND FACULTY EVALUATION HANDOFF REPORT
**LCUP Syllabus Management System — Hybrid AI Checker**  
**Academic Validation Framework, Governance Packaging, and Operational Handoff**

---

## 1. FORMAL STATUS & BOUNDARY DECLARATIONS

This report concludes **Step 7B — Institutional Approval and Faculty Evaluation Handoff**. In strict compliance with academic research integrity, research ethics, and institutional constraints, the project status is formally categorized as follows:

```
[✓] VALIDATION PREPARATION COMPLETED     : COMPLETE (All materials, protocols, workbooks, and schemas verified)
[!] INSTITUTIONAL AUTHORIZATION PENDING   : PENDING (Awaiting VPAA Decisions 14a/b/c and Ethics Committee clearance)
[!] FACULTY EVALUATION PENDING            : PENDING (Awaiting formal faculty appointment and independent review)
[!] AI COMPARISON PENDING                 : PENDING (Awaiting frozen faculty ground truth and authorized API execution)
[!] ACADEMIC VALIDATION PENDING           : PENDING (Awaiting empirical concordance analysis and VPAA acceptance)
```

> [!CAUTION]
> **Definitive Boundary Declaration**: The Hybrid AI Checker **has not yet achieved academic validation**. Achieving academic validation requires actual independent evaluations by qualified faculty, discipline adjudication, and authorized AI comparison. The engineering team has prepared all operational materials, but has **not** fabricated faculty judgments, **not** executed paid AI API calls, and **not** activated Policy V2 in production.

---

## 2. SECTION 1 — INSTITUTIONAL APPROVAL PACKAGE

The institutional briefing document has been compiled and saved to:  
👉 [`docs/verification/institutional-approval-package.md`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/docs/verification/institutional-approval-package.md)

### Key Executive Dimensions for Academic Leadership:
1. **Research Purpose**: Bridges the gap between 100% verified deterministic rule compliance (formatting/structural) and human-expert pedagogical alignment across Outcome-Based Education (OBE) syllabi.
2. **Curricular Scope**: 21 representative relationship cases drawn from three verified institutional syllabi:
   - **BSIT**: IT 202 (*Computer Programming 1*) — 7 cases
   - **BSIE**: IE 402 (*Systems Engineering*) — 9 cases
   - **BSCpE**: CPE 304 (*Fundamentals of Mixed Signals and Sensors*) — 5 cases
   - *Note on BSIT Specialization*: BSIT–Cyber Security inherits directly from the approved BSIT core curriculum and program outcomes; it is not treated as a divergent curriculum profile.
3. **The Seven VPAA Academic Relationships**:
   - Course Title $\leftrightarrow$ Course Content (`Content-course`)
   - Course Content $\leftrightarrow$ ILO (`Content-ILO`)
   - ILO $\leftrightarrow$ CLO (`ILO-CLO`)
   - Course Content $\leftrightarrow$ Learning Activities (`Content-activity`)
   - ILO $\leftrightarrow$ Learning Activities (`ILO-activity`)
   - Course Content $\leftrightarrow$ Assessment (`Content-assessment`)
   - Learning Activities $\leftrightarrow$ Assessment (`Activity-assessment`)
   - *Exclusion Confirmed*: CLO $\leftrightarrow$ Course Description is strictly excluded from all datasets.
4. **Phased Authorization Model**:
   - **Phase 1 (Internal Faculty Evaluation)**: Requires authorization for internal syllabus text utilization (Decisions 14a/c) and ethics clearance (Item I15). All activities remain 100% on university computers.
   - **Phase 2 (External AI Comparison)**: Requires separate explicit authorization (Decision 14b) to transmit isolated textual excerpts to Anthropic's Claude API under strict non-training enterprise terms.

---

## 3. SECTION 2 — FACULTY REVIEWER INSTRUCTIONS

The operational instructions for faculty evaluators have been compiled and saved to:  
👉 [`docs/verification/faculty-reviewer-instructions.md`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/docs/verification/faculty-reviewer-instructions.md)

### Core Reviewer Directives:
1. **AI-Blinded Integrity**: Evaluators work strictly from the Case Booklet ([`case-booklet.html`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/docs/lcup-faculty-validation-1/for-reviewers/case-booklet.html)) and the Academic Rubric ([`academic-evaluation-rubric.md`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/docs/lcup-faculty-validation-1/for-reviewers/academic-evaluation-rubric.md)). They have zero visibility into Claude-generated outputs, baseline heuristics, draft rewrites, or benchmark IDs.
2. **Independent Non-Author Review**: Reviewers evaluate discipline courses they did not author, working alone without consulting authors, peers, or AI tools.
3. **The Four Discrete Academic Judgments**:
   - `ALIGNED`: Mutually coherent content, scope, and cognitive level; no material pedagogical gap.
   - `PARTIALLY_ALIGNED`: Meaningful alignment exists, but a material gap, ambiguity, or scope mismatch remains.
   - `NOT_ALIGNED`: Substantiated mismatch or contradiction in subject matter or objectives.
   - `INSUFFICIENT_EVIDENCE`: Information is too brief, circular, or generic (e.g. "Lecture using PowerPoint", "Quiz on topics discussed") to support a defensible judgment.
4. **Mandatory Evidence Quotation**: Every justification must quote exact phrasing from both compared statements within quotation marks (`"..."`).
5. **Constructive Revision Prototyping**: Any judgment of `PARTIALLY_ALIGNED` or `NOT_ALIGNED` requires a constructive proposed correction.
6. **CLO Classification Rigor**: Reviewers evaluate whether ILOs match the developmental level of the CLO (CLO1 Introductory, CLO2 Enabling, CLO3 Demonstrating, CLO4 Values Integration), and are cautioned **not** to evaluate alignment by Bloom's cognitive verbs alone.

---

## 4. SECTION 3 — COORDINATOR WORKFLOW & ADJUDICATION PROCEDURE

The operational manual for the Research Coordinator has been compiled and saved to:  
👉 [`docs/verification/coordinator-workflow-guide.md`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/docs/verification/coordinator-workflow-guide.md)

### Standard Operating Procedures:
1. **Reviewer Appointment & Anonymization Key**:
   - Coordinate with College Deans to appoint 2 qualified faculty reviewers per course (total 6) and 1 discipline adjudicator per department (total 3).
   - Generate and securely store the confidential Reviewer Anonymization Master Key mapping codes (`R-IT-01`, `R-IE-02`, etc.) to faculty names.
   - *Rule*: Contact faculty strictly through institutional academic channels; automated programmatic contact is strictly prohibited.
2. **Distribution Protocol**:
   - Distribute strictly the designated course-specific Excel workbooks (`faculty-evaluation-form-IT202.xlsx`, `IE402.xlsx`, `CpE304.xlsx`), the case booklet, and rubric.
   - Ensure coordinator-only materials remain air-gapped and confidential.
3. **Intake & Completeness Audit**:
   - Inspect every returned row to verify verdict selection, presence of exact quotations in justifications, and presence of proposed corrections where required.
   - Incomplete forms are returned solely for field completion, never to suggest or alter judgments.
4. **Inter-Rater Agreement Measurement**:
   - Ingest reviewer pairs into [`faculty-claude-comparison-template.xlsx`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/docs/lcup-faculty-validation-1/coordinator-only/faculty-claude-comparison-template.xlsx).
   - Calculate percentage observed agreement and Cohen's Kappa ($\kappa$) per course discipline.
5. **Documented Discipline Adjudication**:
   - Convene Discipline Adjudicators to review split judgments, read justifications, and record a single authoritative **Faculty Reference Judgment**. Automated averaging is prohibited.
6. **Ground Truth Freezing**:
   - Populate [`adjudication.template.json`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/docs/lcup-faculty-validation-1/coordinator-only/adjudication.template.json), lock file as immutable, and record its cryptographic SHA-256 hash.

---

## 5. SECTION 4 — AI COMPARISON PREPARATION SPECIFICATION

The technical specification for authorized Claude model evaluation has been compiled and saved to:  
👉 [`docs/verification/ai-comparison-preparation-spec.md`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/docs/verification/ai-comparison-preparation-spec.md)

### Technical Execution Protocol:
1. **Pre-Execution Gate**: Live API dispatches remain blocked until faculty reference judgments are frozen and VPAA Decision 14b is granted in writing.
2. **Model & Configuration Locking**:
   - Model: Anthropic Claude Sonnet 5.5 (`claude-sonnet-5-5`) via [`anthropicClient.js`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/server/lib/syllabuscheck/anthropicClient.js).
   - Policy Version: `academic-evaluation-v2-preview-1`.
   - Dataset Version: `lcup-academic-benchmark-1` (Hash: `ebd12920...bbf7`).
   - Inference & Token Bounds: Standard API parameters (sampling parameters omitted per API v2026-10-21); `max_tokens: 16000` preserved to prevent academic justification and replacement truncation.
3. **Strict Air-Gap Protection**:
   - Faculty justifications, ratings, and corrections are **never** included in API requests, completely preventing prompt contamination.
   - Only raw syllabus excerpts are submitted over encrypted TLS.
4. **Software Budget Bounds & Cumulative Reservation Analysis**:
   - Model Pricing (`claude-sonnet-5-5`): \$2.00 / M input tokens, \$10.00 / M output tokens, \$0.10 / M cache read.
   - Cumulative Reservation Dynamics: [`providerGuard.js`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/server/lib/syllabuscheck/eval/providerGuard.js) reserves each request's worst-case liability (~$0.1918 USD at `max_tokens: 16000`) before sending. Under a \$0.50 cap, dispatches halt once settled spend reaches \$0.3082 USD, causing premature termination before 32 retried requests complete, or at Case 11 in adaptive thinking mode.
   - Baseline Expected Spend (21 cases, zero retries): ~\$0.17–\$0.23 USD (thinking off) or ~\$0.67 USD (adaptive thinking).
   - Standard Thinking-Off Authorization: An institutional budget cap of **\$1.00 USD** (minimum \$0.75 USD) is required to safely accommodate 32 requests with retries and potential timeout liability.
   - Adaptive Thinking Recommendation: If adaptive extended thinking (`ANTHROPIC_THINKING=adaptive`, effort `high`) is authorized on Sonnet 5.5, an institutional spending authorization of **\$1.50 USD** (with a safety register cap of **\$2.00 USD**) is required for VPAA approval.
   - Repeatability Notice: Disabling thinking (`thinking: { type: 'between_tools' }`) bypasses internal reasoning scratchpads, but does not guarantee bit-level determinism on parallel GPU clusters; evaluation repeatability is enforced via frozen benchmark hashes (`ebd12920...bbf7`), strict JSON schemas, and append-only evaluation ledgers.
   - Request Ceiling: `SYLLABUS_CHECK_AI_MAX_REQUESTS=32`.
   - Token Ceiling: `SYLLABUS_CHECK_AI_MAX_TOKENS=800000`.
   - Bounded retries: Maximum 2 HTTP retries for transient 5xx/429 and maximum 2 validation retries for unverified outputs.
5. **Traceability & Evidence Capture**:
   - Exact bidirectional mapping maintained between `FV-01`...`FV-21` and `BM1-...`.
   - Model responses captured in benchmark JSON schema ([`model-results.template.json`](file:///C:/Users/JP%20Del%20Rosario/Syllabus-Repository/docs/lcup-faculty-validation-1/coordinator-only/model-results.template.json)).

---

## 6. SECTION 5 — REQUIRED INSTITUTIONAL APPROVALS

Prior to distributing materials to faculty or initiating AI dispatches, formal sign-offs are required on seven governance items:

| Approval Item | Authority | Specific Action Required | Current Status |
| :--- | :--- | :--- | :---: |
| **Decision 14a / 14c** | VPAA / Syllabus Authors | Written authorization to use approved syllabus excerpts for internal faculty review. | **Pending** |
| **Decision 14b** | VPAA | Written authorization to transmit isolated textual excerpts to Anthropic Claude API for Phase 2. | **Pending** |
| **Item I15** | Institutional Ethics / IRB | Ethical determination / clearance for collecting and publishing faculty evaluator judgments. | **Pending** |
| **Item I1** | Academic Deans / Chairs | Formal administrative appointment of 6 faculty reviewers and 3 discipline adjudicators. | **Pending** |
| **Item I2** | Academic Affairs / QA | Formal approval of the consensus adjudication procedure. | **Pending** |
| **Item A2.5** | Academic Council / VPAA | Determination of the institutional acceptance threshold (e.g. 80% or 85% agreement). | **Pending** |
| **Rubric Adoption** | Faculty Panel / QA | Formal review and provisional adoption of the Academic Evaluation Rubric. | **Pending** |

---

## 7. SECTION 6 — VALIDATION READINESS ASSESSMENT

An operational audit was conducted across all readiness dimensions:

```
[✓] Case Integrity Audit           : 21 / 21 cases present, verified bound to benchmark cases.
[✓] VPAA Relationship Balance       : Exactly 3 cases per relationship across all 7 relationships.
[✓] AI-Blinding Integrity          : Reviewer workbooks and booklet contain zero AI results or benchmark IDs.
[✓] Subject Workbook Segregation    : Standalone workbooks generated for IT 202, IE 402, and CpE 304.
[✓] Coordinator Tooling Readiness   : Comparison spreadsheet and JSON schemas verified.
[✓] Software Test Harness           : verify.cjs passes 298 / 298 package integrity checks.
[✓] Safety Defense Bounds           : Spending caps ($0.50) and request ceilings (32) enforced in code.
[!] Human Institutional Governance  : Pending VPAA, Dean, and Ethics Committee written sign-offs.
```

### Readiness Verdict
The technical and operational infrastructure for the LCUP Academic Validation Pilot is **100% prepared and ready for handoff**. Independent faculty evaluation may commence immediately upon receipt of administrative authorization (Decisions 14a/c and Item I1).

---

## 8. SECTION 7 — EXACT FILES CREATED OR MODIFIED

All deliverables are persisted on disk within the repository working directory:

| Absolute File Path | Size | Status | Primary Purpose |
| :--- | :---: | :---: | :--- |
| `C:\Users\JP Del Rosario\Syllabus-Repository\docs\verification\institutional-approval-package.md` | 10,757 B | **Created** | Formal institutional briefing and authorization memorandum for VPAA, Deans, and Ethics Committee. |
| `C:\Users\JP Del Rosario\Syllabus-Repository\docs\verification\faculty-reviewer-instructions.md` | 7,422 B | **Created** | Step-by-step operational guide for independent faculty evaluators. |
| `C:\Users\JP Del Rosario\Syllabus-Repository\docs\verification\coordinator-workflow-guide.md` | 7,610 B | **Created** | Standard operating procedures for Research Coordinator (intake, Kappa, adjudication, freezing). |
| `C:\Users\JP Del Rosario\Syllabus-Repository\docs\verification\ai-comparison-preparation-spec.md` | 8,962 B | **Created** | Technical specification for air-gapped Claude API evaluation under budget bounds. |
| `C:\Users\JP Del Rosario\Syllabus-Repository\docs\verification\step7b-institutional-approval-and-handoff-report.md` | 13,245 B | **Created** | This master Step 7B synthesis and governance handoff report. |
| `C:\Users\JP Del Rosario\Syllabus-Repository\docs\verification\faculty-validation-protocol.md` | 9,180 B | **Retained** | Master protocol defining blinding, methodology, and ethical standards. |
| `C:\Users\JP Del Rosario\Syllabus-Repository\docs\verification\step7-academic-validation-preparation-report.md` | 24,932 B | **Retained** | Step 7A foundational preparation report. |
| `C:\Users\JP Del Rosario\Syllabus-Repository\docs\lcup-faculty-validation-1\*` (14 files) | ~500 KB | **Verified** | Authoritative validation package (**298 / 298 checks passing**). |

---

*End of Step 7B Report. Operational handoff materials are complete. Per project constraints, development pauses here awaiting formal institutional review and administrative authorization.*
