# Local curriculum reference import

The local registrar images were transcribed and verified against every printed
semester and program lecture/laboratory credit total. The import uses existing
backend tables: `programs`, `courses`, `curriculum`, `program_outcomes`,
`program_egas`, and `syllabus_check_curricula`. It does not add a competing subject
catalog. All four checker curriculum references are approved.

| Program | Curriculum | Subjects | POs | EGAs | Total credits |
| --- | --- | ---: | ---: | ---: | ---: |
| BSIT | 2022-2023 | 53 | 10 | 4 | 156 |
| BSIT Cybersecurity (`BSIT-CYBERSECURITY`) | 2025-2026 | 61 | 10 | 4 | 176 |
| BSCpE (`BSCPE`) | 2022-2023 | 66 | 13 | 4 | 187 |
| BSIE | 2022-2023 | 63 | 13 | 4 | 186 |

`local-reference-import.json` records the source SHA256 hashes, extracted outcome
snapshots, final database verification, warnings and backup location. Each
curriculum subject also retains its image filename, page, raw prerequisite,
hours and credit units. Practicum hours are not mistaken for credit units.
Blank prerequisite cells are displayed as explicitly unspecified, not inferred
to mean "None". Source punctuation in course codes is retained.

Source limitations and choices:

- The existing BSIT database set has 10 outcomes. The local IT 202 syllabus
  prints a different set of 9. The populated database set was preserved; the PDF
  set is retained in the audit report without merging incompatible numbering.
- Cybersecurity shares the existing BSIT POs by explicit user instruction. Its
  images do not independently provide POs or EGAs. Its EGA labels are the four
  institutional attributes printed in the BSIT reference syllabus.
- The BSIE and BSCpE PDFs each list 13 outcomes and 4 EGAs. PO12 ends with
  "manage projects and in" in both original PDFs. The text was preserved and
  flagged, not completed by invention. Their source documents also do not supply
  a standalone PO-to-EGA crosswalk; those mapping arrays remain empty.
- Existing institution settings, populated outcome sets, faculty assignments,
  syllabus text and approvals were preserved. An existing course with a
  conflicting title causes a rollback rather than being silently overwritten.

The migration scopes course-code uniqueness to `(program_id, code)`, allowing
shared subjects such as MA 7 in both engineering programs while preventing
duplicates within a program. Existing course IDs and foreign keys are preserved.
Catalog create/edit routes and the older outcome seed use the same scope.

Run from the repository root:

```powershell
node server/db/seed-local-references.js          # read-only plan
node server/db/seed-local-references.js --apply  # backup, migrate, transactional seed
node server/db/seed-local-references.js --verify # read-only verification
```

The seed is idempotent and refuses to replace a differing approved curriculum.
The second actual seed run was verified without duplicated subjects or outcomes.

Direct verification query:

```sql
SELECT p.code, r.curriculum_year,
       JSON_LENGTH(r.courses_json) AS reference_subjects,
       (SELECT COUNT(*) FROM courses c
        WHERE c.program_id = p.program_id) AS subjects,
       (SELECT COUNT(*) FROM program_outcomes o
        WHERE o.program_id = p.program_id) AS pos,
       (SELECT COUNT(*) FROM program_egas e
        WHERE e.program_id = p.program_id) AS egas,
       r.status
FROM programs p
JOIN syllabus_check_curricula r ON r.program_code = p.code
ORDER BY p.code;
```

After import, the MA 7 test file passes the curriculum lookup. Its provisional
two-PO form snapshot differs from the newly populated 13-PO master, so the
remaining hard gate is `PO-EXACT`, not missing curriculum or missing program
outcomes. Updating syllabus-owned text still requires the author's review and a
fresh check; importing references does not silently modify their draft.
