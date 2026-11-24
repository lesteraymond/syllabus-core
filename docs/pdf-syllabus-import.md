# PDF syllabus import

The builder's upload tab now imports a PDF into the structured form. It does not
submit a file, approve a syllabus, or invoke an alignment provider. Existing
PDF-only records and their historical file checks are unchanged.

1. Open **Upload a file instead**, select a PDF, and choose **Scan PDF and preview**.
   A subject does not have to be chosen first: when none is chosen, the PDF's
   course code and title pick the one assigned subject they match.
2. The **Template check** runs on the preview: every section I to X must be filled;
   only IV. Pre-requisite may be empty (`src/lib/pdfTemplateScan.js`). Placeholder
   text (TBA, N/A, -) counts as empty. An empty pre-requisite imports as "None".
3. Review the editable sections and source text. Correct OCR errors and table
   boundaries. Confirm that replacing the corresponding draft sections is intended.
4. Choose **Apply and check with AI** or **Apply and submit directly**. Both save
   the draft first and open the Review step. Apply is refused while a required
   section is empty, the course code differs, or a CLO names a PO or EGA number
   that neither list has.
5. Complete remaining fields, mappings, reference groups and units when flagged.
   Recommendation acceptance, submission gates, ownership checks and the subject
   lock apply normally.

## A refresh does not lose the scan (since 2026-11-24)

The builder gives each scan an id of its own and keeps it in the URL
(`#builder?id=12&mode=upload&job=…`, `src/lib/builderRoute.js`). The server
records the scan under the person who started it (`server/lib/pdfImportJobs.js`).
After a browser refresh the builder reopens the upload tab and asks for that job
(`src/lib/pdfImportResume.js`): a running scan is waited for, and a finished one
hands back its preview and the PDF without uploading or scanning again.

- `GET /api/syllabi/pdf-import/job/:job` answers `{ state: 'running' | 'done' | 'failed', kind, file }`,
  with `result` when done or `status` and `error` when it failed. A finished scan
  is checked again against the syllabus as it is now (a draft created or locked
  since then changes the answer).
- `GET /api/syllabi/pdf-import/job/:job/file` returns that scan's PDF to its owner only.
- Jobs are kept in memory, never on disk: one per person (a new scan replaces the
  last), dropped 30 minutes after they end. A server restart forgets them, and the
  builder then says the scan was interrupted.

## Architecture

`GET /api/syllabi/pdf-import/config` exposes availability and upload limits.
`POST /api/syllabi/:id/import-pdf` accepts multipart field `file` and returns a
preview only. It checks ownership, editable status and course assignment before
parsing, then rechecks access after extraction. The PDF stays in memory and is
never written under public `/uploads`. The route performs no database mutations.

`server/lib/pdfImport.js` validates actual PDF bytes and runs extraction in a
bounded worker. PDF.js handles embedded text; scanned pages are rendered with
`@napi-rs/canvas` and read by Tesseract using the installed English language data.
No provider key or network OCR service is needed. Up to two imports run at once
per API application (`SYLLABUS_PDF_IMPORT_CONCURRENCY`, 1 to 8) and each person
runs one at a time. Imports are limited to five attempts per user per ten minutes,
10 MB, 30 pages and 180,000 extracted characters. The upload is received before a
rate-limit or import slot is taken, and receiving is cut off after 30 seconds. The
worker reports each page it starts: an import stops when one page takes over two
minutes or the whole import over nine (the browser waits up to ten). OCR runs only
on a page with almost no text that shows an image, or no text at all, and replaces
the existing text only when it reads clearly more. A blank or unreadable page is
skipped and reported instead of failing the import. Worker V8 heap is limited to 256 MB;
OCR images are capped near five million pixels. Unreadable pages, very low OCR
confidence, malformed/encrypted files and timeouts fail without creating a draft
or report. The extracted text is user content and is rendered as text, not HTML.

`src/lib/pdfImport.js` identifies sections I–X and maps reviewed source text into
the existing schema. Mappings require explicit PO/EGA/CLO identifiers; unstated
associations remain empty. Clearly labelled Vision/Mission/EGA/PO columns replace
their corresponding form values; source text is exposed for editing before this
happens. Master database records are never changed. Unrecovered institutional
columns retain current form values and are explicitly marked for review. Selected
course identity remains catalog-controlled. A different
PDF course code prevents application until the matching subject is selected or
an extraction error is corrected. Credit-unit splits and CLO levels need review.

The UI requires explicit confirmation and saves with the existing `setAndSave`
draft path, then calls the ordinary compliance recheck endpoint. Changing the
preview requires confirmation again. Selecting or scanning a file never invokes
alignment by itself. A failed save makes no checker request. If checking fails
after saving, the imported draft is kept and the author gets a retry explanation
in Review & Check. Local draft edits
after extraction invalidate the preview. Normal save authorization runs again,
so a preview never grants write access. Import does not bypass the existing
one-active-syllabus rule or create an additional syllabus version automatically.

The Apply action explains a missing review confirmation, a different course code
or a mapping error beside the button rather than silently disabling it. Apply/save
errors are displayed and focused at that same location. A failed save keeps the
preview bound to the imported local text so the author can retry without rescanning;
separate subsequent edits still invalidate it. No check starts until saving succeeds.

Set `SYLLABUS_PDF_IMPORT=off` to disable extraction. It is enabled by default.
The file picker remains usable while availability loads or fails. A failed or
eight-second timed-out availability request exposes a retry button; retrying
retains the selected file. The scan action can try the authoritative endpoint even
when the advisory availability request fails. Missing-file, missing-subject and
disabled-service clicks show explicit messages instead of silently disabling the
button. Write access is still required; read-only records display their reason.
Existing draft previews do not first save unfinished form content. A new draft
still needs its assigned subject saved before the import route can authorize it.
No schema migration is needed. Install backend dependencies with `npm ci` in
`server` when deploying the updated lockfile. PDF.js requires a supported recent
Node runtime; its package declares Node >=22.13 or >=24.

## Extraction limits

Layout version 2 uses displayed text coordinates and actual PDF grid segments,
not whitespace splitting, to recover table cells. A header must identify all six
learning-plan columns before those rows are accepted. A row continuing on another
page appends to its prior week with source-page provenance. Repeated headers are
skipped and section VIII ends the plan. Source week ranges, examination rows and
source errors are preserved; the importer does not repair overlapping weeks.

For scanned tables, local OCR word boxes and detected printed grid lines feed the
same layout reader. Vision/Mission and EGA/PO/CLO tables use their own labelled
columns, preventing adjacent outcomes from leaking into CLO statements. Wrapped
paragraphs and bibliography entries are joined; explicit reference groups remain
grouped. Multiple ILOs per week remain separate, and mappings use the printed CLO
number rather than assuming consecutive CLO numbering.

Recovered plans appear as six editable columns with source-page labels. Applying
uses these same structured cells, so mathematical `|` characters and line breaks
cannot shift columns. Faculty can add/remove/correct rows before confirmation.
PDFs without reliable grid boundaries fall back to the editable source text with
a warning and retain the complete extraction for comparison.

Template variants the reader handles (2026-11-21 to 2026-11-23): headings with
extra spaces or tabs, a missing space after the numeral, a stray numeral before a
heading ("I. V. CREDIT UNITS"), and the spellings CREDIT UNIT, PRE-REQUISITE(S) and
SUGGESTED REFERENCES; credit units with lecture and laboratory in any order;
landscape pages rotated with `/Rotate` (read by displayed position); the sign-off
block and lone page numbers kept out of the last sections; "Passing Grade: 50%"
not read as a grading component; references by multi-word surnames, organisations
and "Park J. et. Al., (2023)" style authors starting a new citation; a week number
printed below a page break; and plan outcome columns that list "CLO n:" lines.
Course titles match across "&"/"and", "II"/"2" and an optional trailing "(...)". Extraction cannot
guarantee every possible layout: ambiguous or missing data still requires review,
and extraction itself never produces an AI score.

Tests cover real embedded-text and scanned PDFs, encrypted/malformed/oversized
files, page and time limits, conservative mapping, permissions, feature switch,
rate limits, concurrent requests, access changes and read-only preview behavior.
`npm run test:pdf-import-ui` exercises actual React controls in a test DOM, covering
pending availability, failure/retry, timeout, subject selection and read-only state.
The local API audit in `docs/pdf-import-api-audit.json` used an existing 12-page
reference PDF, detected all ten sections, and verified unchanged draft content
and report ID. This audit did not apply an import to the faculty's live syllabus.

`node scripts/audit-pdf-layout.cjs` audits the three local syllabus PDFs without
database or AI calls. `docs/pdf-layout-extraction-audit.json` records file hashes,
all ten sections, four CLOs and four EGAs per file, the printed PO counts, three
exam rows per file, and 9/11/13 plan rows (including multi-week ranges) for
IE402/CPE304/IT202 respectively. It checks known page continuations and validates
the mapped structure with the backend outcome validator. These are extraction
checks, not declarations that the source syllabi satisfy the official curriculum
or are pedagogically aligned.
