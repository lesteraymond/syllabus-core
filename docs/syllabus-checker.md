# Hybrid syllabus checker

Current OpenRouter model: `minimax/minimax-m3.1-flash:free` (user-selected).
`SYLLABUS_CHECK_AI_PROVIDER=openrouter` and `OPENROUTER_MODEL` select it in
`server/.env`. The existing API key is preserved. No model fallback is used, and
this route requests a zero-price provider so it cannot silently switch to a paid
model. OpenRouter's model page states that the free route retires on October 22,
2026 at 12:00 UTC: <https://openrouter.ai/minimax/minimax-m3.1-flash:free>.

MiniMax advertises JSON `response_format`, but does not advertise strict
`structured_outputs` in the model metadata. Its adapter requests JSON object
mode, supplies the output schema in the system prompt and independently validates
required fields, types, enum values, pair coverage, exact/whitespace-only evidence
and recommendation drafts on the server. Gemini through OpenRouter retains its
strict JSON-schema request. Coded gates, deductions and human approval rules are
shared. Completed MiniMax checks are accepted by the submission gate; simulated,
incomplete or unsupported-model checks cannot authorize submission. UI labels are
provider-neutral and show the model used for each report.
MiniMax is evaluated in batches of four relationships. A failed batch retains
earlier verified judgments for diagnosis but leaves the evaluation incomplete and
the final score unavailable; partial progress never authorizes submission.

Opening the builder review step only reads the stored report. It no longer starts
an automatic provider call, so React Strict Mode's repeated mount effects cannot
start duplicate evaluations. The faculty and administrator actions also use
synchronous click guards while a check is pending. Report polling is read-only.
One explicit evaluation still creates one OpenRouter request per batch: MA 7 has
74 relationships, so a complete MiniMax evaluation takes up to 19 sequential
requests with four relationships per batch. This is expected batching, not 19
separate syllabus checks. A failed batch stops the remaining requests.

Recommendation acceptance uses the normal owner-edit API and immediately saves
the updated draft before recording its decision. "Applied and saved" appears
only after both operations succeed. Save failures remain visible and do not
record acceptance. A decision-log failure after a successful save is reported
explicitly; retrying the same proposal is idempotent for the content change.

New suggestions retain the full original target value plus stable CLO, week and
ILO identifiers. Independent recommendations from one report can be accepted
successively even after the score becomes stale. A changed target or reordered
row is rejected rather than overwritten, and competing rewrites of the same
field require another check or manual editing. Older reports without target
bindings display an explicit instruction to click AI CHECK for fresh proposals.
This does not trigger an automatic model request. Reviewer-only decisions still
attach proposals without changing another author's submitted syllabus.

The builder and administrator AI Checker now use one server pipeline through
`POST /api/syllabi/:id/compliance/recheck`. A check reports findings and draft
suggestions. It never approves a syllabus. No model, link fetch or extraction
process should be described as universally accurate: unavailable evidence blocks
verification rather than producing a claimed pass.

## Rule hierarchy

1. **Official curriculum integrity.** The course code must occur in an approved
   curriculum for the selected program and curriculum year. Code whitespace/case
   is normalized, but punctuation is significant. A confirmed absent code returns
   the required critical alert and a final score of **0**, before network calls.
   Title and prerequisite text, lecture/laboratory credit units and year level
   must match that row. No units-to-hours conversion is used for this comparison.
   A missing or ambiguous official curriculum blocks submission; it does not
   invent a curriculum match. Specializations use separate program codes.
2. **Master constants.** Vision, Mission and institutional EGA definitions must
   exactly equal the institution master. PO definitions must equal the selected
   program master. Differences include exact replacement drafts. Syllabus-owned
   text is not used as its own authoritative master.
3. **Structure.** All ten standard sections are required. The structured builder
   renders the ten fixed headers; the checker validates their backing fields.
   Explicit header lists, when present, must contain all ten headers. ILO gaps,
   duplicate week assignments and grading totals other than exactly 100 block
   submission. Existing required-field and valid-mapping checks remain in force.
4. **Reference links.** Every unique HTTP(S) URL in reference entries is checked
   using GET without following redirects. HTTP 200 passes. Redirects, confirmed
   404/410 and nonexistent domains each deduct **2 percentage points per URL**.
   Access restrictions, server errors, timeouts and unsafe/private destinations
   are reported as unverifiable and block completion; they are not called broken.
   At most four connections run at once, with an eight-second per-link deadline
   and a 60-URL cap. Exceeding the cap blocks a complete result.
5. **Gemini meaning/alignment.** Every designated CLO–PO/EGA and ILO–CLO mapping
   is evaluated, along with each ILO's activities and assessments and each
   lesson's value integration. The rubric checks Bloom levels and constructive
   alignment. Every judgement must name a requested pair and quote evidence
   found in both supplied texts. Omitted/duplicate IDs, unsupported quotes,
   malformed replies, failures and insufficient evidence prevent completion.
6. **Value webbing.** Every lesson needs at least one of Compassion, Courage,
   Community-orientedness, Humility, Interiority or Missionary Spirit. A missing
   named value deducts **1 point per lesson** and supplies a draft suggestion.
   Gemini additionally evaluates whether the value is meaningfully applied.

The coded weighted score remains the base score. Semantic `NOT_ALIGNED` findings
deduct **3 points per relationship**, and `PARTIALLY_ALIGNED` findings deduct
**1 point**. Penalties are direct percentage points, not weighted warnings.
Once verification is complete, final score is `max(0, baseScore - sum(deductions))`,
overridden to zero for a confirmed absent curriculum course. Incomplete checks
return `score: null`, `overall: null`, `status: incomplete` and no pass band; the
coded baseline and provisional deductions remain separate diagnostic fields.
Historical incomplete reports are normalized on read, so their old baseline
cannot appear as a final AI score. The report/persisted run/submission response
carry that final `score` and the individual `deductions`. The six area scores
describe the coded base; the panel separately displays semantic/link/value
deductions. Policy amounts are explicit in `engine.js`, not selected by Gemini.
The old automatic citation-year, reference-count and ten-year-age deductions are
not part of this new pipeline; link verification replaces those heuristics.

## Submission and human decisions

The Submit to Admin button stays disabled until a real Gemini check has completed
and all hard gates pass. The server independently requires the persisted report
for the exact saved content and current master-reference fingerprint, checked
within 30 minutes. Any edit, master change or expiry invalidates it. AI-off,
missing provider, rate limits and mock/synthetic checks cannot authorize submission.
Reports and scores supplied by the client are never accepted as verification.
The pass label still requires 79% with no blockers; semantic warnings deduct
points and remain visible for the human administrator's decision.

The administrator checks the submitted version independently. Approval endpoints
also enforce the current hybrid verification. Existing file-only submission
routes cannot bypass the gate: new submissions use the structured builder.
Historical uploaded PDFs remain readable and may receive their limited legacy
file check, but that check cannot authorize approval. PDF/document extraction is
not claimed as implemented by this structured-form pipeline.

Both screens offer **Accept**, **Edit** and **Reject** for suggestions. Each
decision is recorded separately. An administrator attaches a recommendation as a
draft for the author. In an editable faculty builder, accepting the displayed
draft applies it only after that explicit action; an edited suggestion uses the
faculty member's wording. The change must be saved and rechecked. No automatic
approval or background syllabus editing occurs.

## Setup and official reference data

From `server/`:

```sh
npm run migrate-syllabuscheck
```

This adds the curriculum, full-report and human-decision tables and ensures the
older compliance tables exist. It is repeatable and does not approve or fabricate
any institutional data. Fresh installations should run this migration too.

Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in `server/.env`.
`SYLLABUS_CHECK_AI_PROVIDER=gemini` explicitly selects Gemini; with no provider
setting a supplied key also selects Gemini. `off`, `mock` and the old unconfigured
`llm` setting cannot satisfy the mandatory gate. Keys never leave the server.
The REST transport follows the [Gemini generateContent API](https://ai.google.dev/api/generate-content).

Alternatively, use Gemini through OpenRouter in `server/.env`:

```dotenv
SYLLABUS_CHECK_AI_PROVIDER=openrouter
OPENROUTER_API_KEY=YOUR_SECRET_KEY
OPENROUTER_MODEL=google/gemini-2.5-flash
```

The model identifier is not an API key. The OpenRouter transport uses the server-only
key with [Chat Completions](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request)
and strict JSON-schema output, followed by the exact same pair/evidence validation,
deductions and submission safeguards. It does not silently fall back to direct
Gemini when the OpenRouter key is missing. Non-Gemini OpenRouter models cannot
satisfy the mandatory Gemini gate. Quota, credit and provider errors remain
`not_evaluated`. Reports record both the actual transport and configured model.

Editable catalog subjects are not official curricula. Administrators import an
entire verified curriculum using authenticated `POST /api/syllabus-check/references`:

```json
{
  "program": "BSIE",
  "curriculumYear": "2022-2023",
  "source": "Registrar-approved curriculum document and version identifier",
  "courses": [
    {"code": "COPY OFFICIAL CODE", "title": "Copy exact official title", "prereq": "Copy explicit official prerequisite or None", "lecture": 3, "lab": 0, "yearLevel": 1}
  ]
}
```

The example is a schema example, not an official course row. Replace every value
with verified source data. The import remains draft until an administrator calls
`POST /references/:id/approve` with `{"confirmedAgainstSource":true}`.
Only approved records are used. Approved rows are immutable; `POST
/references/:id/retire` retires one, and a different curriculum-year/version can
be imported. `GET /references` lists the records. Synthetic fixtures are refused.
Vision/Mission/EGAs and program POs use the existing master-data APIs.

## CLI and validation

```sh
node scripts/syllabus-check.cjs builder-content.json --ai gemini --json report.json
node scripts/syllabus-check.cjs --sample invalid-course --ai off --json invalid.json
node scripts/syllabus-check.cjs --sample misaligned --ai gemini --json misaligned.json
node scripts/syllabus-check.cjs --sample misaligned --ai openrouter --json openrouter.json
node --test lib/syllabuscheck/*.test.js routes/syllabusCheck.routes.test.js
```

CLI inputs are builder JSON (or an API response containing `content`). By default
real inputs read official master data from the database. `--references file.json`
allows an external master bundle for diagnostics only. Built-in samples and
external reference bundles are always marked synthetic and never authorize a
production submission.

Engine/gate/UI tests cover hard mismatch priority, exact master replacements,
identity fields, punctuation, ambiguous references, headers, numbering, grading,
link penalties and SSRF refusals, Gemini output grounding, score deductions,
unavailable AI, report expiry and stale references, and explicit human decisions.
Legacy catalog/storage/recommendation suites isolate the independently tested
hybrid precondition; they do not claim mock recommendations prove real alignment.

The implementation run produced `sample-invalid-course-report.json` with score
zero and the critical alert. The live Gemini attempt in
`sample-misaligned-report.json` returned **HTTP 429**, kept alignment not evaluated
and left submission blocked. No live semantic accuracy claim is made from that
unavailable result. The database currently needs verified official curriculum
records before an actual builder syllabus can complete the hard gates.
# Coded rule update: hybrid-2

Evidence validation now accepts whitespace-only differences in provider quotes
(for example, a newline flattened to a space). It reconstructs and persists the
original source substring and records `evidenceMatching` as `exact` or
`whitespace`. Changed words, case, punctuation and invented quotations remain
invalid. A live MA 7 diagnostic reproduced the newline issue in three weekly
value judgments; the regression suite covers the same behavior.

Re-Check continues through the existing shared compliance service. Reports add
`hybrid.reportVersion = 2`, `hybrid.codedChecks`, and a frozen, persisted scoring
policy snapshot (`syllabus-policy-2`). Existing score, findings, suggestions and
alignment fields remain compatible. No database migration is needed for these
additive JSON fields.

Each new coded check records its rule ID, path, version, status and observed vs
required evidence. Statuses distinguish `PASS`, `FAIL`, `NOT_EVALUATED` (such as
missing official references), and `NOT_APPLICABLE` (such as a lesson ILO on an
examination row). Existing legacy findings retain their IDs and failure evidence;
the ledger does not claim unperformed legacy checks passed. The faculty and
admin shared panel exposes these records for review.

The update adds unique CLO IDs, valid nonduplicate official PO/EGA selections,
and valid ILO-to-CLO mappings as hard gates. These establish referential integrity;
Gemini still evaluates meaning. Weeks must parse completely, fall within the
existing 18-week policy, cover every week, and avoid duplicate assignments. Grading
uses exact decimal arithmetic (up to 12 decimal places) instead of floating point
equality or rounding near-100 totals into compliance.

Reference hashes include the selected program/year's approved curriculum IDs,
sources and contents plus the institution and program outcome masters. Changes
to unrelated program curricula no longer invalidate a report. Ambiguous selected
curricula still block membership verification. The rule version participates in
the existing content hash, so old checks cannot authorize a new submission;
historical reports remain readable and are marked stale after an engine update.
Approval, syllabus text and previous reports are not rewritten by this update.

Offline regression examples:

```powershell
node --test server/lib/syllabuscheck/*.test.js
node server/scripts/syllabus-check.cjs --sample invalid-course --ai off
node server/scripts/syllabus-check.cjs --sample misaligned --ai off
```

Samples remain synthetic. With AI disabled, semantic alignment is not evaluated
and no final score is issued except the curriculum-absence hard zero. These
examples test deterministic gates, not Gemini accuracy or real submission approval.

Explicit AI checks share one active evaluation slot across faculty, administrators,
tabs and syllabi on the running API server. An overlapping POST returns HTTP 409
with code `ai_check_in_progress` without calling the provider or storing a run.
Requests are rejected rather than queued or retried automatically. The slot stays
held through evaluation and report persistence, and is released on completion or
failure. Legacy background recommendations retain the slot until their job settles.
Stored-report GET requests remain available. Provider batches within one evaluation
continue sequentially; this guard does not reduce a whole syllabus to one batch.

The guard is in memory and applies to this Express application instance. A future
deployment with multiple API workers or replicas must replace it with a shared
distributed lock before relying on a deployment-wide concurrency limit.

