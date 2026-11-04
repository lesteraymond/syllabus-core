# Database and service impact

## Actual existing records (read-only)

| Syllabus ID | Program | Status | CLOs requiring PO-context review | Direct ILO–PO mapping entries |
|---|---|---|---|---|
| 43 | BSIT | draft | c1: 1,5; c2: 6; c3: 3,7; c4: 6,8 | 0 |
| 93 | BSIT | for_revision | c9: 1; api93_clo2: 1,2; api93_clo3: 3; api93_clo4: 4,7 | 0 |
| 97 | BSIE | draft | kmvax3geut0vgvl: 1; kmvax3hk1otdyd1: 1; kmvax3imhluz216: 1; kmvax3kanekeayr: 2 | 0 |
| 99 | BSIT | draft | c9: 1; api99_clo2: 1,2; api99_clo3: 3; api99_clo4: 4,7; bss99_team: 5,6,8,9,10 | 30 |
| 100 | BSIE | draft | bsie100_clo1: 2; bsie100_clo2: 1; bsie100_clo3: 1; bsie100_clo4: 2 | 0 |
| 101 | BSIE | for_revision | ma7_aligned_clo1: 1; ma7_aligned_clo2: 1; ma7_aligned_clo3: 1,5; ma7_aligned_clo4: 6,7,8,9 | 0 |
| 102 | BSIT | draft | imp2: 2,3,6,8; imp3: 2,3,6,8; imp4: 2,3,6,8,9; imp5: 9 | 0 |

No proposed new PO numbers or faculty judgments have been assigned. Four BSIT records and three BSIE records require review; no mapped Cyber/BSCpE record or catalog CLO row was identified in this database snapshot. A record with no current mappings is not evidence that old versions have no mappings. Historical versions/reports remain immutable and are fingerprinted, not rewritten.

## Existing foreign keys involving programs/courses/outcomes

| Table.column | Referenced key | Constraint |
|---|---|---|
| courses.program_id | programs.program_id | courses_ibfk_1 |
| course_clos.course_id | courses.course_id | course_clos_ibfk_1 |
| course_prerequisites.course_id | courses.course_id | course_prerequisites_ibfk_1 |
| course_prerequisites.prereq_course_id | courses.course_id | course_prerequisites_ibfk_2 |
| faculty_courses.course_id | courses.course_id | faculty_courses_ibfk_2 |
| faculty_programs.program_id | programs.program_id | faculty_programs_ibfk_2 |
| program_code_aliases.program_id | programs.program_id | program_code_aliases_ibfk_1 |
| program_egas.program_id | programs.program_id | program_egas_ibfk_1 |
| program_name_aliases.program_id | programs.program_id | program_name_aliases_ibfk_1 |
| program_outcomes.program_id | programs.program_id | program_outcomes_ibfk_1 |
| student_enrollments.course_id | courses.course_id | student_enrollments_ibfk_2 |
| subject_deadlines.course_id | courses.course_id | subject_deadlines_ibfk_1 |
| syllabi.course_id | courses.course_id | fk_syllabi_course |

`course_clos.po_nos` and syllabus JSON mappings have no foreign key to `(program_id, po_no)`; a number-only update cannot preserve their meaning. Program IDs and all course/assignment foreign keys remain unchanged.

## New foreign keys

- program_outcome_sources.program_id/source_program_id → programs.program_id (the existing intended mechanism).
- program_po_reference_versions.program_id → programs.program_id.
- program_po_reference_active.program_id → programs.program_id; reference_id → program_po_reference_versions.reference_id.
- program_po_reference_remediation.migration_id → program_po_reference_migrations.migration_id.
- Immutable reference versions restrict program deletion; they must not be cascade-deleted to erase history. Existing deletion handlers may surface the FK refusal; no delete workflow was exercised or changed here.
