# Importing faculty responses: coordinator guide (restricted)

**Restricted to the review coordinator and the data steward.** Never send this guide, the inbox or any import record to reviewers, to the policy panel or to any outside service. It shows no software answer and no provisional verdict, but the records it describes list reviewer codes with their answers.

**Status, 2026-10-28.** The importer is built and has been tested only with synthetic returns. Those include forms filled in and saved by Microsoft Word 16. No faculty return has been imported. The package is not sent until decisions I1, I2, I5, I12 and I15 are recorded (`3-policy-panel/02-institutional-decisions-and-approvals`). Nothing the importer writes approves or decides anything.

The importer is `scripts/import-align1-faculty-responses.cjs`. It reads the returns of the align-1 adjudication package, Version 2 (`docs/faculty-review/align-1-dev-adjudication-v2/`).

## 1. What it does and what it never does

| It does | It never does |
|---|---|
| Reads the returned Version 2 Word forms (.docx) and response sheets (.csv) in an inbox folder | Makes a network request: it runs offline |
| Records every answer as returned, by reviewer code, with the issues the coordinator must settle | Writes to the inbox, the package, Version 1 or a folder that is not empty |
| Proposes a state for each Part A case: Pending, Reassigning, To adjudication or Excluded | Marks a case Agreed, Adjudicated or Unresolved, or treats a majority as a decision |
| Lists disagreements, missing answers, clarification requests and reassignment requests | Fills in a blank, picks one of two ticked boxes, or interprets a written answer |
| Counts the Part B ratings apart from the alignment verdicts | Reads the software's answers, the provisional verdicts, the case sets or the blinding key |
| Gives agreement statistics only where there are enough paired answers | Reads the author of a Word comment, or the names Word stores in a file's properties |
| Keeps an exact, read-only copy of every file it read | Changes a returned file |

## 2. Before the first import

1. **Keep a restricted store outside the repository**, for example a folder on the institution's restricted drive. The inbox, the received files, the tracking record and every import record live there. Real responses must never be committed to Git or kept in the repository. The importer warns when the inbox or the output folder lies inside the repository.
2. **Check the package:**
   ```
   node scripts/import-align1-faculty-responses.cjs --check-package
   ```
   It should print `58 cases and 160 proposals in 7 courses; the 13 forms and sheets match the importer`. If it refuses, the package has changed since it was built. Stop and tell the developer. Every import repeats this check and refuses to run on a changed package.
3. **Copy the two templates** from `coordinator-restricted/templates/` into the restricted store and fill in the copies, never the package's files:
   - `reviewer-tracking.csv`: one row per reviewer. Give the course, the slot, the reviewer's code, and the date each part was sent.
   - `reassignment-log.csv`: empty until a case is reassigned.
4. **Reviewer codes** use letters, digits, `-`, `.` or `_`, at most 40 characters, for example `R07`. Never use a name or initials. Codes beginning with `SYNTH-` are reserved for tests (section 10). The key that links codes to people is kept apart from everything in this guide.

## 3. When a return arrives

1. **Keep the file exactly as received** in the restricted store.
2. **Record it in the tracking record.** Fill in the date (`part_a_returned` or `part_b_returned`) and the file's checksum (`part_a_sha256` or `part_b_sha256`). On Windows, use `certutil -hashfile <file> SHA256`; the first 16 or more characters are enough. When more than one file belongs to the same return, list each checksum, separated by `;`. That covers a revised form, or a scan together with its transcription.
3. **Copy the file into the inbox** under a name made of codes only, for example `HM210-part-a-R07.docx`. The importer never uses a file name to decide whose return a file is. The name does appear in the import record, though, so it must never contain a person's name. Renaming a file does not change its checksum.
4. **Never edit a returned file.** An unclear answer is settled by a clarification (section 7).

| Received as | What to do |
|---|---|
| The Version 2 Word form (.docx) | Put it in the inbox |
| The course's response sheet (.csv): comma, semicolon or tab separated; UTF-8, UTF-16 or Windows-1252 | Put it in the inbox. A Windows-1252 sheet is read with a note, because characters outside that encoding may be lost. If a text looks wrong, ask for a "CSV UTF-8" copy |
| A workbook (.xlsx, .xls, .ods) | Save it as "CSV UTF-8", then import the CSV |
| An old Word file (.doc) or an OpenDocument file (.odt) | Ask the reviewer for the .docx form |
| Paper, a scan, a PDF or a photograph | Transcribe it into the course's sheet (section 4) |

**Word desktop is the safe way to fill in a form.** Google Docs and LibreOffice may remove the form's controls. If a form is rejected because "no form controls were found", ask the reviewer to use the CSV sheet instead.

## 4. Transcribing a paper or scanned return

1. Start from a fresh copy of the course's sheet: `1-part-a-for-reviewers/<COURSE>/<COURSE>-part-a-responses.csv`, or the Part B sheet.
2. Write the reviewer's code and the return date on every row.
3. Write each answer in the option's own words, as printed on the form, for example `Partially aligned`.
   - Where several boxes may be ticked, separate the options with `;`.
   - For "Other", write `Other: ` followed by the reviewer's words, or use the sheet's "other" column where it has one.
4. **Never choose and never fill in.**
   - Two boxes ticked where one is asked: write both, separated by `;`. The importer holds the answer for clarification.
   - A blank stays blank.
   - Written answers are copied exactly, spelling included.
5. Do not change the description columns: case code, course, relationship, proposal type and proposal text.
6. Ask a second person to check the transcription against the scan. Note in the tracking record who transcribed it (by code) and when.
7. Add the transcription's checksum next to the scan's, separated by `;`. Once any checksum is recorded for a reviewer's return, a file with a checksum not on the list is held. Put the transcription in the inbox. The scan may go there too: it is listed as "not read" and kept with the record.

## 5. Running an import

From the repository folder:

```
node scripts/import-align1-faculty-responses.cjs --inbox "<store>\inbox" --out "<store>\imports\2026-11-15" --tracking "<store>\reviewer-tracking.csv" --reassignments "<store>\reassignment-log.csv" --clarifications "<store>\clarifications.csv"
```

| Option | Meaning |
|---|---|
| `--inbox` | The folder of returned files. Subfolders are read. Some files are ignored and never read: Word's temporary `~$` files, names beginning with a dot, `Thumbs.db`, `desktop.ini` and `.DS_Store`. Links are not followed |
| `--out` | A **new or empty** folder for this import's record. Every import writes a new folder, so earlier records are never overwritten. The record is written to a temporary folder and takes this name only when it is complete, so a failed import leaves no partial record |
| `--tracking` | The tracking record. **Always give it for a real import.** Without it, reviewers are taken from the returns: a form never returned cannot be listed, and assignments are not checked |
| `--reassignments` | The reassignment log (section 8) |
| `--clarifications` | The clarification record (section 7), once there is one |
| `--pkg` | Another copy of the Version 2 package. It must match the package manifest |
| `--synthetic` | Tests only (section 10) |

**Exit code 0** means the record was written and the inbox was unchanged during the import. **Exit code 1** means one of two things:
- The import was refused, with the reason printed, and nothing was written.
- A file in the inbox changed while the import ran. The record is written but says so; import again from a stable inbox.

## 6. Reading the record

| File | What it holds |
|---|---|
| `import-report.md` | The summary: inputs, files, returns, Part A states, agreement, disagreements, Part B ratings, missing answers, clarifications and limits |
| `part-a-responses.csv` / `.json`, `part-b-responses.csv` / `.json` | Every answer as returned, with its issues; written answers, Word comments and text added outside the fields as written |
| `part-a-agreement-record.csv`, `part-b-ratings-record.csv` | The package's templates, filled in from the returns |
| `disagreement-inventory.csv` | Every difference between counted judgments, and what happens to it |
| `missing-responses.csv` | Forms not returned, items left unanswered, and answers held |
| `clarification-requests.csv` | The open issues, one row each, ready for the reviewer's answer (section 7) |
| `reassignment-requests.csv` | Outside-expertise answers not yet in the reassignment log (section 8) |
| `tally.json`, `import-manifest.json` | The counts, and every input with its checksum and status |
| `originals/` | An exact, read-only copy of every file read, named by its checksum |

**Files.** Each file gets one of these statuses:
- **counted**: its answers are used.
- **same answers as another file**, or **duplicate**: counted once.
- **conflicting returns**: two different returns from one reviewer for one course and part. Neither is counted. Establish with the reviewer which one is their return, move the other out of the inbox (keep it in the store), record why in the tracking notes, and import again.
- **held**: it is not counted until its reviewer is established. The reason is given, for example no code, two codes, or a checksum that differs from the one recorded at receipt.
- **rejected**: it cannot be read; the reason is given.
- **not read**: a format the importer does not read (see section 3).
- **ignored**: a temporary, hidden or system file, or a link.

**Answers.** Each answer has an issue level:
- **hold**: not counted until clarified, for example two boxes ticked where one is asked.
- **clarify**: counted, but the reviewer is asked, for example about a blank answer to a later question.
- **note**: for the coordinator's attention only.

If a case text in a return differs from the text sent, the coordinator asks the reviewer which text they judged.
- **Part A:** the answer is held until then.
- **Part B:** the ratings of proposals whose own text changed are held. If only the outcomes shown with the case changed, the ratings are counted and the change is flagged.

**Part A states are proposals.** *Pending* means answers are still awaited, or every counted reviewer gave the same verdict and the case waits for the policy check. *Reassigning*, *To adjudication* and *Excluded* follow the adjudication procedure. Agreed, Adjudicated and Unresolved are recorded by the coordinator and the adjudicator under that procedure once its policies are adopted (decision I2). The importer never sets them.

**Part B ratings** describe the proposed changes, not alignment, and are not adjudicated. "Cannot judge" is not a rating; it is counted by its reason.

## 7. Clarifications

1. Open `clarification-requests.csv` from the latest import. Each row is an open issue, identified by its `issue_id`.
2. Ask the reviewer without suggesting an answer.
3. In the row, fill in three columns:
   - `clarified_answer`: the reviewer's answer.
   - `date_clarified`: the date, as 2026-11-12.
   - `recorded_by`: your code.
4. The answer is one of these:
   - the option's words, as on the form (several options separated by `;`);
   - `NO ANSWER`, to record that the reviewer leaves the question blank (not allowed for question 0, which needs Yes or No);
   - for a changed case text, `JUDGED ON THE TEXT AS SENT`, or `JUDGED ON THE CHANGED TEXT`. An answer judged on a changed text is kept but not counted.
5. Save the file as the store's clarification record and give it to the next import with `--clarifications`. Keep adding rows to the same file and never delete one: each import applies every row that still settles an open issue.

The answer as returned is always kept beside the clarified one. A row that settles no open issue is not applied, and the report lists it with the reason. A returned answer is never changed for any other purpose.

A spreadsheet may rewrite a date such as 2026-11-12 as 11/12/2026 when it saves. That date is ambiguous, so the row is not applied, and the report says so. Correct the date and import again.

## 8. Outside expertise and reassignment

An answer of "No, it is outside my expertise" is not a judgment. The case becomes *Reassigning*, and the import lists it in `reassignment-requests.csv`, in the reassignment log's own columns. Copy those rows into the store's reassignment log and choose a qualified reviewer (procedure, section 5). Then fill in `new_reviewer_code`, `date_reassigned` and the outcome `reassigned`, or record the outcome `excluded: no qualified reviewer`.

A replacement reviewer does not need a tracking row: their answers count for the reassigned cases only. Answers to other cases of the course are kept but not counted.

## 9. How agreement is calculated

- **A unit** is a case, or a proposal, with two or more counted answers. Two reviewers agree only when they chose the same option.
- **Verdicts:** Aligned, Partially aligned and Not aligned are treated as nominal categories. A case with an "Insufficient information to judge" answer is left out of the verdict figures and listed for the adjudicator (decision I8).
- **Thresholds:**
  - A percentage is given from 5 paired units.
  - Cohen's kappa and Krippendorff's alpha are given from 10 paired units, and only when more than one category was used.
- **Which statistic:**
  - Kappa is given only when the same two reviewers judged every unit, as within one course.
  - Across courses the reviewer pairs differ, so the overall figure is Krippendorff's alpha (nominal).
- **Recommendations** are compared by type. Re-mapping targets written in different words are listed for the coordinator to compare.
- **Part B** rating agreement is calculated separately for rewrites and for re-mappings, by the same rules.
- **Readings applied** (question 3) are counted for the policy panel's information. A count is not a policy.

The figures describe this review only. They come from one to twenty cases per course, so they are not estimates for the institution's syllabi. They never decide a case.

## 10. Synthetic test data

Codes beginning with `SYNTH-` are reserved for tests:
- A real import rejects any return that carries such a code.
- An import run with `--synthetic` accepts only such codes. It names every output file `SYNTHETIC-…` and adds `SYNTHETIC-TEST-DATA.txt` to the folder.
- Synthetic results are never faculty evaluations and are never reported as such.

The offline tests make every return from a copy of a blank form, in a temporary folder, and remove it afterwards. Run them with:

```
node scripts/import-align1-faculty-responses.test.cjs
```

They are not part of `npm test`.

## 11. Confidentiality

- Several things are restricted to the coordinator and the data steward:
  - the inbox;
  - the received files and transcriptions;
  - the tracking record and the reassignment and clarification records;
  - every import folder.
- **The copies in `originals/` are exact copies.** Word stores the name of whoever last saved a form in the file's properties, and a Word comment carries its author's name. The importer reads neither, and no generated record contains them, but the copies still hold them. Treat an import folder like the inbox.
- Nothing from an import is sent to reviewers, the policy panel or any outside service, and nothing is committed to the repository.
- **Formulas.** In the CSV files the importer writes, a cell that begins with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe, so that a spreadsheet does not run it as a formula. The JSON files keep the exact text. So that the guard holds, open these CSV files in a spreadsheet only to read them; never re-save them over the record.

## 12. Limits

- Only the Version 2 forms and sheets are read. Two kinds of file are rejected:
  - a Version 1 response sheet, because its columns differ;
  - a form whose controls were changed.
- Tracked changes in a returned form are read as if they were accepted, with a note.
- Dates are read only when they are unambiguous: 2026-11-03, 3 November 2026 or Nov 3, 2026. A date such as 11/03/2026 is kept as written.
- Some files are rejected unread:
  - a file larger than 50 MB;
  - a .docx archive with more than 1,000 entries;
  - a .docx archive with a part larger than 32 MB;
  - a form whose text, comments or styles part is larger than 8 MB (a form's text is under 1 MB);
  - a form whose elements are nested far deeper than a form's;
  - a file that is damaged, encrypted or not well formed.

  The rest of the inbox is still imported.
- Written answers, comments and added text are kept and never interpreted. Re-mapping targets written differently are compared by the coordinator.
