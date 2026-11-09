# Coverage matrix: the 47 deterministic compliance rules

Generated 2026-11-04T21:33:57.138Z. Source of the rules: `server/lib/compliance/standard-v4.json` (pass mark **79**, six weighted areas template 20, completeness 20, co_po 20, assessment 15, contact_hours 10, reference_currency 15). Each rule was tested **in isolation** with a valid case, an invalid case and a missing-field case (`coded-rules.cases.js`), then again inside the full standard.

**Missing-field classes.** *finding raised*: the rule flags the absence. *neutral*: the rule has nothing to judge, so it contributes neither credit nor deduction (a companion rule is expected to flag the absence). *scope-limited*: the rule judges one narrow property, still applies, and passes on it; a companion flags the absence.

## Summary

| Rule | Area | Severity | Weight | Check | In Hybrid-2 | Missing-field class | Existing tests naming it | Conformance result |
|---|---|---|---|---|---|---|---|---|
| T-01 | template | blocking | 3 | nonEmpty | applied | finding raised, credit withheld | 0 | PASS |
| T-02 | template | blocking | 3 | nonEmpty | applied | finding raised, credit withheld | 0 | PASS |
| T-03 | template | blocking | 2 | nonEmpty | applied | finding raised, credit withheld | 0 | PASS |
| T-04 | template | blocking | 3 | nonEmpty | applied | finding raised, credit withheld | 0 | PASS |
| T-05 | template | blocking | 2 | nonEmpty | applied | finding raised, credit withheld | 0 | PASS |
| T-06 | template | blocking | 2 | nonEmpty | applied | finding raised, credit withheld | 0 | PASS |
| T-07 | template | blocking | 3 | nonEmpty | applied | finding raised, credit withheld | 0 | PASS |
| T-08 | template | blocking | 3 | nonEmpty | applied | finding raised, credit withheld | 0 | PASS |
| T-09 | template | blocking | 3 | equalsCatalog | applied | neutral (not applicable) | 3 | PASS |
| T-10 | template | blocking | 3 | equalsCatalog | applied | neutral (not applicable) | 1 | PASS |
| T-11 | template | blocking | 3 | equalsCatalog | applied | neutral (not applicable) | 1 | PASS |
| T-12 | template | blocking | 3 | equalsCatalog | applied | neutral (not applicable) | 1 | PASS |
| T-13 | template | blocking | 3 | tagsResolve | applied | finding raised, credit withheld | 5 | PASS |
| T-14 | template | blocking | 3 | tagsResolve | applied | neutral (not applicable) | 2 | PASS |
| T-15 | template | blocking | 1 | columnsFilled | applied | finding raised, credit withheld | 2 | PASS |
| T-16 | template | major | 2 | columnsFilled | applied | finding raised, credit withheld | 2 | PASS |
| T-17 | template | minor | 1 | iloNumbering | applied | scope-limited | 0 | PASS |
| T-18 | template | minor | 1 | weeksOrder | applied | scope-limited | 1 | PASS |
| T-19 | template | blocking | 2 | numberedRequirements | applied | finding raised, credit withheld | 1 | PASS |
| T-20 | template | minor | 1 | numberedRequirements | applied | neutral (not applicable) | 1 | PASS |
| T-21 | template | blocking | 3 | referenceGroups | applied | finding raised, credit withheld | 1 | PASS |
| T-22 | template | minor | 1 | referenceGroups | applied | neutral (not applicable) | 1 | PASS |
| T-23 | template | blocking | 2 | nonEmpty | applied | finding raised, credit withheld | 1 | PASS |
| T-24 | template | blocking | 4 | gradingTotal | applied | finding raised, credit withheld | 4 | PASS |
| T-25 | template | blocking | 2 | gradingFormula | applied | neutral (not applicable) | 1 | PASS |
| T-26 | template | major | 2 | gradingFormula | applied | neutral (not applicable) | 1 | PASS |
| T-27 | template | minor | 1 | signoffRoles | applied | finding raised, credit withheld | 1 | PASS |
| C-01 | completeness | major | 2 | textLength | applied | finding raised, credit withheld | 1 | PASS |
| C-02 | completeness | minor | 2 | textLength | applied | neutral (not applicable) | 1 | PASS |
| C-03 | completeness | minor | 1 | textLength | applied | finding raised, credit withheld | 0 | PASS |
| C-04 | completeness | minor | 1 | referenceAge | NOT APPLIED | finding raised, credit withheld | 0 | PASS |
| P-01 | co_po | blocking | 3 | cloConventions | applied | finding raised, credit withheld | 1 | PASS |
| P-02 | co_po | blocking | 3 | cloConventions | applied | finding raised, credit withheld | 1 | PASS |
| P-03 | co_po | major | 2 | cloConventions | applied | scope-limited | 1 | PASS |
| P-04 | co_po | minor | 1 | cloConventions | applied | finding raised, credit withheld | 1 | PASS |
| P-05 | co_po | major | 3 | cloCoverage | applied | finding raised, credit withheld | 1 | PASS |
| A-01 | assessment | major | 3 | columnsFilled | applied | finding raised, credit withheld | 3 | PASS |
| A-02 | assessment | major | 3 | cloCoverage | applied | finding raised, credit withheld | 2 | PASS |
| A-03 | assessment | major | 3 | examRowsPerTerm | applied | finding raised, credit withheld | 3 | PASS |
| A-04 | assessment | major | 2 | gradingHasExam | applied | finding raised, credit withheld | 1 | PASS |
| H-01 | contact_hours | major | 2 | contactUnits | applied | finding raised, credit withheld | 1 | PASS |
| H-02 | contact_hours | major | 4 | weeksCover | applied | finding raised, credit withheld | 1 | PASS |
| H-03 | contact_hours | major | 2 | weeksCover | applied | scope-limited | 1 | PASS |
| H-04 | contact_hours | minor | 1 | weeksCover | applied | scope-limited | 1 | PASS |
| R-01 | reference_currency | major | 2 | referenceAge | applied | finding raised, credit withheld | 0 | PASS |
| R-02 | reference_currency | minor | 2 | referenceAge | NOT APPLIED | neutral (not applicable) | 1 | PASS |
| R-03 | reference_currency | major | 4 | referenceAge | NOT APPLIED | neutral (not applicable) | 1 | PASS |

## Rule by rule

### T-01 — nonEmpty (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Course code (I) is empty. |
| Input fields | meta.code |
| Expected valid behavior | No finding, full credit: the conforming syllabus; whitespace-padded code with text |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: meta.code is empty; blocks the submit whatever the score |
| Missing-field handling | meta.code is absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Enter the course code" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here; presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-02 — nonEmpty (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Course title (II) is empty. |
| Input fields | meta.title |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: meta.title is empty; blocks the submit whatever the score |
| Missing-field handling | meta.title is absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Enter the course title" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here; presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-03 — nonEmpty (blocking, template, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Program is empty. |
| Input fields | meta.program |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: meta.program is empty; blocks the submit whatever the score |
| Missing-field handling | meta.program is absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Choose the program" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here; presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-04 — nonEmpty (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Course description (III) is empty. |
| Input fields | description; .t of each item |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: description paragraph is empty; blocks the submit whatever the score |
| Missing-field handling | no description paragraphs → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Write the course description" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here; presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-05 — nonEmpty (blocking, template, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Pre-requisite (IV) is empty. |
| Input fields | meta.prereq |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: meta.prereq is empty; blocks the submit whatever the score |
| Missing-field handling | meta.prereq is absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Enter the pre-requisite" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here; presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-06 — nonEmpty (blocking, template, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Lecture and laboratory units (V) are not both entered. |
| Input fields | meta.lecture; meta.lab |
| Expected valid behavior | No finding, full credit: the conforming syllabus; zero laboratory units is entered |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: lecture units not a number; blocks the submit whatever the score |
| Missing-field handling | laboratory units blank → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Enter the lecture and laboratory units" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here; presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-07 — nonEmpty (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | There are no course learning outcomes (VI). |
| Input fields | clos |
| Expected valid behavior | No finding, full credit: the conforming syllabus; exactly one CLO |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: no CLOs; blocks the submit whatever the score |
| Missing-field handling | CLO list absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Ask an administrator to add the course learning outcomes" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here; presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-08 — nonEmpty (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The Learning Plan (VII) has no lesson with a learning outcome (ILO). |
| Input fields | plan |
| Expected valid behavior | No finding, full credit: the conforming syllabus; exactly one lesson has an ILO |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: every ILO text is blank; blocks the submit whatever the score |
| Missing-field handling | empty plan → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Add a lesson with a learning outcome (ILO)" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here; presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-09 — equalsCatalog (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The vision in this syllabus is not the school's current vision. |
| Input fields | catalog.vision |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: stored vision differs from the live vision; blocks the submit whatever the score |
| Missing-field handling | no stored catalog copy (a draft) → neutral (not applicable): no credit, no deduction; no companion rule |
| Recommendation behavior | Rule-based fix shown to the author: "Resubmit so the syllabus carries the current vision" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js<br>server/routes/compliance.routes.test.js<br>src/lib/complianceRules.parity.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | skipped for drafts / when its context is absent; nothing else covers that case; Skipped for a draft: there is no stored copy to compare. |

### T-10 — equalsCatalog (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The mission in this syllabus is not the school's current mission. |
| Input fields | catalog.mission |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: stored mission differs; blocks the submit whatever the score |
| Missing-field handling | no stored catalog copy → neutral (not applicable): no credit, no deduction; no companion rule |
| Recommendation behavior | Rule-based fix shown to the author: "Resubmit so the syllabus carries the current mission" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | skipped for drafts / when its context is absent; nothing else covers that case; Skipped for a draft. |

### T-11 — equalsCatalog (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The graduate attributes (EGAs) in this syllabus are not the program's current ones. |
| Input fields | catalog.egas |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: stored EGAs differ; blocks the submit whatever the score |
| Missing-field handling | no stored catalog copy → neutral (not applicable): no credit, no deduction; no companion rule |
| Recommendation behavior | Rule-based fix shown to the author: "Resubmit so the syllabus carries the current graduate attributes" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | skipped for drafts / when its context is absent; nothing else covers that case; Skipped for a draft. |

### T-12 — equalsCatalog (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The program outcomes (POs) in this syllabus are not the program's current ones. |
| Input fields | catalog.pos |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: stored POs differ; blocks the submit whatever the score |
| Missing-field handling | no stored catalog copy → neutral (not applicable): no credit, no deduction; no companion rule |
| Recommendation behavior | Rule-based fix shown to the author: "Resubmit so the syllabus carries the current program outcomes" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | skipped for drafts / when its context is absent; nothing else covers that case; Skipped for a draft. |

### T-13 — tagsResolve (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | ‹where› has no CLO tag. |
| Input fields | plan[].ilos[].tags; clos[].id; program POs/EGAs |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: an ILO with text has no CLO tag; blocks the submit whatever the score |
| Missing-field handling | tags property absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Tag every ILO with the CLO it builds" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js<br>server/lib/syllabuscheck/reliability.test.js<br>server/lib/syllabuscheck/stage-c3.test.js<br>server/routes/compliance.routes.test.js<br>src/lib/complianceRules.parity.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | none identified |

### T-14 — tagsResolve (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | ‹where› has a tag that no longer resolves: ‹tag›. |
| Input fields | plan[].ilos[].tags; clos[].id; program POs/EGAs |
| Expected valid behavior | No finding, full credit: the conforming syllabus; a PO tag that exists |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: tags that resolve to nothing; blocks the submit whatever the score |
| Missing-field handling | no tags at all → neutral (not applicable): no credit, no deduction; companion T-13 flags it |
| Recommendation behavior | Rule-based fix shown to the author: "Fix the outcome tags that no longer resolve" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js<br>server/routes/compliance.routes.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | Only tags that exist are judged; an untagged ILO is T-13's job. |

### T-15 — columnsFilled (blocking, template, weight 1)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Learning Plan row ‹row› is missing the column: ‹missing›. |
| Input fields | plan columns: week, ilos, contents, activities, tasks, values |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: a row lacks the Assessment column; blocks the submit whatever the score |
| Missing-field handling | a row lacks the ILO column → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Complete the Learning Plan columns" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js<br>server/lib/syllabuscheck/stage-c3.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-16 — columnsFilled (major, template, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | ‹where› has nothing in: ‹missing›. |
| Input fields | plan columns: contents, activities, tasks, values |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity major, area template, field path and filled-in message, credit withheld: a lesson has no value |
| Missing-field handling | a lesson has no content → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Fill in the empty Learning Plan columns" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js<br>server/lib/syllabuscheck/stage-c3.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01); partial credit (fraction of the rule's share), by design; Partial credit: a lesson missing 1 of 4 columns earns 3/4 of that lesson's share. |

### T-17 — iloNumbering (minor, template, weight 1)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | ‹where› has an empty ILO before a filled one, so the printed numbering has a gap. |
| Input fields | plan[].ilos[].text |
| Expected valid behavior | No finding, full credit: the conforming syllabus; trailing empty ILO only |
| Expected invalid behavior | Finding with severity minor, area template, field path and filled-in message, credit withheld: empty ILO before a filled ILO |
| Missing-field handling | a lesson without ILO list → scope-limited: still applies and passes on its narrow property; companion T-15 flags the absence |
| Recommendation behavior | Rule-based fix shown to the author: "Remove the empty ILO between filled ones" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here; presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01); Judges numbering only; a missing ILO list is flagged by T-15. |

### T-18 — weeksOrder (minor, template, weight 1)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Learning Plan row ‹row› comes before an earlier week. |
| Input fields | plan[].week |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity minor, area template, field path and filled-in message, credit withheld: rows out of week order |
| Missing-field handling | no week values → scope-limited: still applies and passes on its narrow property; companion H-02 flags the absence |
| Recommendation behavior | Rule-based fix shown to the author: "Put the Learning Plan rows in week order" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | Judges order among rows that have a week; missing weeks are flagged by H-02. |

### T-19 — numberedRequirements (blocking, template, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Course requirements (VIII): ‹have› listed, at least ‹need› needed. |
| Input fields | reqs[].t |
| Expected valid behavior | No finding, full credit: the conforming syllabus; exactly three requirements |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: only two requirements; blocks the submit whatever the score |
| Missing-field handling | no requirements → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "List at least three course requirements" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-20 — numberedRequirements (minor, template, weight 1)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Requirement "‹text›" starts with its own number; the form numbers the list for you. |
| Input fields | reqs[].t |
| Expected valid behavior | No finding, full credit: the conforming syllabus; "1 Attendance" (no dot) is not a manual number |
| Expected invalid behavior | Finding with severity minor, area template, field path and filled-in message, credit withheld: a requirement carries its own number |
| Missing-field handling | no requirements → neutral (not applicable): no credit, no deduction; companion T-19 flags it |
| Recommendation behavior | Rule-based fix shown to the author: "Remove the typed numbers from the requirements" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-21 — referenceGroups (blocking, template, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | References (‹letter›. ‹title›) has no entries and is not marked not applicable. |
| Input fields | refs.{books,program,online,electronics} |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: a group is empty and not marked N/A; blocks the submit whatever the score |
| Missing-field handling | refs absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Fill in each reference group or mark it not applicable" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-22 — referenceGroups (minor, template, weight 1)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | References (‹letter›. ‹title›) is marked not applicable but has entries. |
| Input fields | refs.{books,program,online,electronics} |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity minor, area template, field path and filled-in message, credit withheld: marked N/A but has entries |
| Missing-field handling | refs absent → neutral (not applicable): no credit, no deduction; companion T-21 flags it |
| Recommendation behavior | Rule-based fix shown to the author: "Resolve the reference group marked not applicable that has entries" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-23 — nonEmpty (blocking, template, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The Grading System (X) has no components. |
| Input fields | grading.rows |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: no grading components; blocks the submit whatever the score |
| Missing-field handling | grading absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Add the grading components" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### T-24 — gradingTotal (blocking, template, weight 4)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The grading components total ‹total›%, not ‹need›%. |
| Input fields | grading.rows[].pct |
| Expected valid behavior | No finding, full credit: the conforming syllabus; 33.3 + 33.3 + 33.4 totals 100 |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: components total 90; blocks the submit whatever the score |
| Missing-field handling | no grading rows → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Make the grading components total 100%" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js<br>server/lib/syllabuscheck/alignment-safety.test.js<br>server/routes/compliance.routes.test.js<br>src/lib/complianceRules.parity.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | none identified |

### T-25 — gradingFormula (blocking, template, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The override formulas cannot be empty. |
| Input fields | grading.rows, grading.override, exam rows |
| Expected valid behavior | No finding, full credit: the conforming syllabus; override on with both formulas |
| Expected invalid behavior | Finding with severity blocking, area template, field path and filled-in message, credit withheld: override on with an empty formula; blocks the submit whatever the score |
| Missing-field handling | override off → neutral (not applicable): no credit, no deduction; no companion rule |
| Recommendation behavior | Rule-based fix shown to the author: "Fill in the override formulas or switch them off" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | skipped for drafts / when its context is absent; nothing else covers that case; Applies only when the override is switched on. |

### T-26 — gradingFormula (major, template, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The ‹which› formula does not mention ‹missing›. |
| Input fields | grading.rows, grading.override, exam rows |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity major, area template, field path and filled-in message, credit withheld: override formula omits a component |
| Missing-field handling | no grading rows and no exam rows → neutral (not applicable): no credit, no deduction; companion T-23, A-03 flags it |
| Recommendation behavior | Rule-based fix shown to the author: "Make the grading formulas name every component and exam term" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | earns credit by construction while the grading override is off; Tautological while the override is off: the generated formula always names every component, so the rule earns full credit by construction. |

### T-27 — signoffRoles (minor, template, weight 1)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The sign-off block is not as the form requires: ‹problem›. |
| Input fields | signoff; preparer |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity minor, area template, field path and filled-in message, credit withheld: names entered by hand in the sign-off |
| Missing-field handling | the preparer is unknown → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Check the sign-off block" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | none identified |

### C-01 — textLength (major, completeness, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The course description is ‹words› ‹nouns›; about ‹need› are expected. |
| Input fields | description |
| Expected valid behavior | No finding, full credit: the conforming syllabus; exactly 30 words |
| Expected invalid behavior | Finding with severity major, area completeness, field path and filled-in message, credit withheld: 29 words |
| Missing-field handling | no description text → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Expand the course description" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01); partial credit (fraction of the rule's share), by design; Partial credit: n/30 of the rule's share below 30 words. |

### C-02 — textLength (minor, completeness, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | ‹where› is only ‹words› ‹nouns›; an ILO states what the student will do. |
| Input fields | plan[].ilos[].text |
| Expected valid behavior | No finding, full credit: the conforming syllabus; a 4-word ILO |
| Expected invalid behavior | Finding with severity minor, area completeness, field path and filled-in message, credit withheld: a 3-word ILO |
| Missing-field handling | every ILO blank → neutral (not applicable): no credit, no deduction; companion T-08 flags it |
| Recommendation behavior | Rule-based fix shown to the author: "Write fuller learning outcomes (ILOs)" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### C-03 — textLength (minor, completeness, weight 1)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | CLO ‹n› has no ‹missing›. |
| Input fields | clos[].title/.statement |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity minor, area completeness, field path and filled-in message, credit withheld: a CLO has no statement |
| Missing-field handling | a CLO has no title → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Ask an administrator to complete the CLO titles and statements" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here; presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### C-04 — referenceAge (minor, completeness, weight 1)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | There are ‹have› references; at least ‹need› are expected. |
| Input fields | refs.*.items[].t; evaluation year |
| Expected valid behavior | No finding, full credit: the conforming syllabus; exactly three references |
| Expected invalid behavior | Finding with severity minor, area completeness, field path and filled-in message, credit withheld: two references |
| Missing-field handling | no references → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Add more references" (no AI involved) |
| Applied in Hybrid-2 | NOT APPLIED |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | not applied in Hybrid-2 (replaced by link checks); no pre-existing automated test names this rule (it may be exercised indirectly); now covered here |

### P-01 — cloConventions (blocking, co_po, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | CLO ‹n› is not tagged with a valid graduate attribute (EGA). |
| Input fields | clos[].egas, clos[].pos; program POs/EGAs |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area co_po, field path and filled-in message, credit withheld: a CLO has no EGA tag; blocks the submit whatever the score |
| Missing-field handling | egas property absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Ask an administrator to tag each CLO with graduate attributes" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | none identified |

### P-02 — cloConventions (blocking, co_po, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | CLO ‹n› is not tagged with a valid program outcome (PO). |
| Input fields | clos[].egas, clos[].pos; program POs/EGAs |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity blocking, area co_po, field path and filled-in message, credit withheld: a CLO has no PO tag; blocks the submit whatever the score |
| Missing-field handling | a CLO tags a PO that does not exist → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Ask an administrator to tag each CLO with program outcomes" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | none identified |

### P-03 — cloConventions (major, co_po, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | CLO ‹n› is tagged PO ‹po›, which maps to EGA ‹ega›, but EGA ‹ega› is not tagged. |
| Input fields | clos[].egas, clos[].pos; program POs/EGAs |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity major, area co_po, field path and filled-in message, credit withheld: PO 2 maps to EGA 2 but EGA 2 is not tagged |
| Missing-field handling | a CLO with no PO tags → scope-limited: still applies and passes on its narrow property; companion P-02 flags the absence |
| Recommendation behavior | Rule-based fix shown to the author: "Ask an administrator to tag the EGAs the POs imply" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | A CLO with no PO tags is skipped by this rule (P-02 reports it); other CLOs are still checked. |

### P-04 — cloConventions (minor, co_po, weight 1)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | CLO ‹n›'s tags would not print as ‹format›: numbers must be unique and in order. |
| Input fields | clos[].egas, clos[].pos; program POs/EGAs |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity minor, area co_po, field path and filled-in message, credit withheld: EGA numbers not increasing |
| Missing-field handling | duplicate PO numbers → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Ask an administrator to put the CLO tags in order" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | none identified |

### P-05 — cloCoverage (major, co_po, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | CLO ‹n› is not built by any ILO in the Learning Plan. |
| Input fields | clos[].id; plan[].ilos[].tags |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity major, area co_po, field path and filled-in message, credit withheld: CLO 4 is built by no ILO |
| Missing-field handling | no lessons at all → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Cover every course outcome in the Learning Plan" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | none identified |

### A-01 — columnsFilled (major, assessment, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | ‹where› has no assessment task. |
| Input fields | plan columns: tasks |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity major, area assessment, field path and filled-in message, credit withheld: a lesson has no assessment task |
| Missing-field handling | a lesson task is absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Add an assessment task to every lesson" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js<br>server/lib/syllabuscheck/stage-c3.test.js<br>server/routes/compliance.routes.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### A-02 — cloCoverage (major, assessment, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | CLO ‹n› is not assessed: no week that builds it has an assessment task. |
| Input fields | clos[].id; plan[].ilos[].tags; plan[].tasks |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity major, area assessment, field path and filled-in message, credit withheld: CLO 1 has no assessed week |
| Missing-field handling | no lessons → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Assess every course learning outcome" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/recommend.test.js<br>server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | none identified |

### A-03 — examRowsPerTerm (major, assessment, weight 3)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | There is no ‹term› examination row in the Learning Plan. |
| Input fields | plan[] exam rows (Prelim/Midterm/Final) |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity major, area assessment, field path and filled-in message, credit withheld: no Midterm examination row |
| Missing-field handling | no examination rows → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Add the missing examination rows" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js<br>server/routes/compliance.routes.test.js<br>src/lib/complianceRules.parity.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | none identified |

### A-04 — gradingHasExam (major, assessment, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The grading system has no examination component. |
| Input fields | grading.rows[].label |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity major, area assessment, field path and filled-in message, credit withheld: no examination component in grading |
| Missing-field handling | no grading rows → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Include an examination in the grading system" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | presence/form only: placeholder text (TBD, n/a) and invisible-only text satisfy it (LIM-01, DEF-01) |

### H-01 — contactUnits (major, contact_hours, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The credit units are not usable: lecture ‹lecture›, laboratory ‹lab›. |
| Input fields | meta.lecture, meta.lab |
| Expected valid behavior | No finding, full credit: the conforming syllabus; the 6 + 6 maximum |
| Expected invalid behavior | Finding with severity major, area contact_hours, field path and filled-in message, credit withheld: lecture units above the maximum of 6 |
| Missing-field handling | lecture units blank → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Correct the credit units" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | none identified |

### H-02 — weeksCover (major, contact_hours, weight 4)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | The plan covers ‹planned› of ‹expected› weeks‹hours›. |
| Input fields | plan[].week |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity major, area contact_hours, field path and filled-in message, credit withheld: week 5 is not planned |
| Missing-field handling | empty plan → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Plan the full term" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | partial credit (fraction of the rule's share), by design; Partial credit: planned/18 of the rule's share. |

### H-03 — weeksCover (major, contact_hours, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Row ‹row› has a week that is not within 1 to ‹to›: "‹week›". |
| Input fields | plan[].week |
| Expected valid behavior | No finding, full credit: the conforming syllabus; week 18 is within 1 to 18 |
| Expected invalid behavior | Finding with severity major, area contact_hours, field path and filled-in message, credit withheld: a row has week 20 |
| Missing-field handling | a row with no week → scope-limited: still applies and passes on its narrow property; companion H-02 flags the absence |
| Recommendation behavior | Rule-based fix shown to the author: "Fix the weeks outside the term" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | Judges the weeks that are written; a row with no week is flagged by H-02 (coverage). |

### H-04 — weeksCover (minor, contact_hours, weight 1)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | Week‹s› ‹weeks› appear‹verb› in more than one row. |
| Input fields | plan[].week |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity minor, area contact_hours, field path and filled-in message, credit withheld: week 3 appears in two rows |
| Missing-field handling | no weeks at all → scope-limited: still applies and passes on its narrow property; companion H-02, T-08 flags the absence |
| Recommendation behavior | Rule-based fix shown to the author: "Resolve the weeks used by more than one row" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | Judges overlap among written weeks; an empty plan is flagged by H-02 and T-08. |

### R-01 — referenceAge (major, reference_currency, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | There are no references. |
| Input fields | refs.*.items[].t; evaluation year |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity major, area reference_currency, field path and filled-in message, credit withheld: no references |
| Missing-field handling | refs absent → finding raised, credit withheld |
| Recommendation behavior | Rule-based fix shown to the author: "Add references" (no AI involved) |
| Applied in Hybrid-2 | applied |
| Existing automated tests naming this rule | none |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | no pre-existing automated test names this rule (it may be exercised indirectly); now covered here |

### R-02 — referenceAge (minor, reference_currency, weight 2)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | A reference has no year: "‹text›". |
| Input fields | refs.*.items[].t; evaluation year |
| Expected valid behavior | No finding, full credit: the conforming syllabus |
| Expected invalid behavior | Finding with severity minor, area reference_currency, field path and filled-in message, credit withheld: a reference with no year |
| Missing-field handling | no references → neutral (not applicable): no credit, no deduction; companion R-01 flags it |
| Recommendation behavior | Rule-based fix shown to the author: "Add the year to each reference" (no AI involved) |
| Applied in Hybrid-2 | NOT APPLIED |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | not applied in Hybrid-2 (replaced by link checks) |

### R-03 — referenceAge (major, reference_currency, weight 4)

| Item | Detail |
|---|---|
| Official requirement (the rule's own message) | A reference is ‹age› years old (‹year›); the limit is ‹limit›: "‹text›". |
| Input fields | refs.*.items[].t; evaluation year |
| Expected valid behavior | No finding, full credit: the conforming syllabus; a reference exactly 10 years old |
| Expected invalid behavior | Finding with severity major, area reference_currency, field path and filled-in message, credit withheld: a reference 11 years old |
| Missing-field handling | year not supplied to the evaluation → neutral (not applicable): no credit, no deduction; no companion rule |
| Recommendation behavior | Rule-based fix shown to the author: "Replace the outdated references" (no AI involved) |
| Applied in Hybrid-2 | NOT APPLIED |
| Existing automated tests naming this rule | server/lib/compliance/rules.test.js |
| Conformance result (this framework) | **PASS** |
| Coverage gaps / notes | not applied in Hybrid-2 (replaced by link checks); skipped for drafts / when its context is absent; nothing else covers that case; Skipped when the evaluation year is unknown. |

