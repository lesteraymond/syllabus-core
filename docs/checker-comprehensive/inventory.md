# Complete rule inventory

This is a catalogue, not an expanded registered standard. The 47 standard IDs remain separate from semantic types, reference predicates, staged verdict aliases and per-CLO classifications. Actual states below are measured in the comprehensive scripted rehearsal. Failed checks can be successfully evaluated. A checked quotation does not prove real-model academic accuracy. Full requirements, dependencies, five activation modes, evidence receipts and test file references are in [inventory.json](inventory.json).

| ID | Category | Name / requirement | Implementation | Method / flag | Scoring | Comprehensive state / status |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | template | Course code | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | ACTIVE / PASS |
| T-02 | template | Course title | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | ACTIVE / PASS |
| T-03 | template | Academic program | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 2 | ACTIVE / PASS |
| T-04 | template | Course description | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | ACTIVE / PASS |
| T-05 | template | Prerequisite | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 2 | ACTIVE / PASS |
| T-06 | template | Lecture and laboratory units | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 2 | ACTIVE / PASS |
| T-07 | template | CLO presence | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | ACTIVE / PASS |
| T-08 | template | Learning plan and ILO presence | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | ACTIVE / PASS |
| T-09 | template | Institutional Vision | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| T-10 | template | Institutional Mission | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| T-11 | template | EGAs | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| T-12 | template | POs | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| T-13 | template | ILO-to-CLO tag presence | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | ACTIVE / PASS |
| T-14 | template | CLO/PO/EGA tag validity | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | ACTIVE / PASS |
| T-15 | template | Learning plan columns | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 1 | ACTIVE / PASS |
| T-16 | template | Learning plan content | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 2 | ACTIVE / PASS |
| T-17 | template | ILO numbering gaps | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 1 | ACTIVE / PASS |
| T-18 | template | Week chronology | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 1 | ACTIVE / PASS |
| T-19 | template | Minimum requirements | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 2 | ACTIVE / PASS |
| T-20 | template | Requirement numbering | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 1 | ACTIVE / PASS |
| T-21 | template | Reference categories | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 3 | ACTIVE / PASS |
| T-22 | template | Reference N/A consistency | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 1 | ACTIVE / PASS |
| T-23 | template | Grading components | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 2 | ACTIVE / PASS |
| T-24 | template | Grading total 100% | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 4 | ACTIVE / PASS |
| T-25 | template | Custom grading formula completeness | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 2 | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| T-26 | template | Grading formula consistency | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 2 | ACTIVE / PASS |
| T-27 | template | Signatory structure | server/lib/compliance/rules.js | deterministic / existing path | weighted base: template, rule weight 1 | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| C-01 | completeness | Expand the course description | server/lib/compliance/rules.js | deterministic / existing path | weighted base: completeness, rule weight 2 | ACTIVE / PASS |
| C-02 | completeness | Write fuller learning outcomes (ILOs) | server/lib/compliance/rules.js | deterministic / existing path | weighted base: completeness, rule weight 2 | ACTIVE / PASS |
| C-03 | completeness | Ask an administrator to complete the CLO titles and statements | server/lib/compliance/rules.js | deterministic / existing path | weighted base: completeness, rule weight 1 | ACTIVE / PASS |
| C-04 | completeness | Add more references | server/lib/compliance/rules.js | deterministic / existing path | replaced; no Hybrid-2 deduction | IMPLEMENTED_BUT_DISABLED / NOT_CHECKED |
| P-01 | co_po | Ask an administrator to tag each CLO with graduate attributes | server/lib/compliance/rules.js | deterministic / existing path | weighted base: co_po, rule weight 3 | ACTIVE / PASS |
| P-02 | co_po | Ask an administrator to tag each CLO with program outcomes | server/lib/compliance/rules.js | deterministic / existing path | weighted base: co_po, rule weight 3 | ACTIVE / PASS |
| P-03 | co_po | Ask an administrator to tag the EGAs the POs imply | server/lib/compliance/rules.js | deterministic / existing path | weighted base: co_po, rule weight 2 | ACTIVE / PASS |
| P-04 | co_po | Ask an administrator to put the CLO tags in order | server/lib/compliance/rules.js | deterministic / existing path | weighted base: co_po, rule weight 1 | ACTIVE / PASS |
| P-05 | co_po | Cover every course outcome in the Learning Plan | server/lib/compliance/rules.js | deterministic / existing path | weighted base: co_po, rule weight 3 | ACTIVE / PASS |
| A-01 | assessment | Add an assessment task to every lesson | server/lib/compliance/rules.js | deterministic / existing path | weighted base: assessment, rule weight 3 | ACTIVE / PASS |
| A-02 | assessment | Assess every course learning outcome | server/lib/compliance/rules.js | deterministic / existing path | weighted base: assessment, rule weight 3 | ACTIVE / PASS |
| A-03 | assessment | Add the missing examination rows | server/lib/compliance/rules.js | deterministic / existing path | weighted base: assessment, rule weight 3 | ACTIVE / PASS |
| A-04 | assessment | Include an examination in the grading system | server/lib/compliance/rules.js | deterministic / existing path | weighted base: assessment, rule weight 2 | ACTIVE / PASS |
| H-01 | contact_hours | Correct the credit units | server/lib/compliance/rules.js | deterministic / existing path | weighted base: contact_hours, rule weight 2 | ACTIVE / PASS |
| H-02 | contact_hours | Plan the full term | server/lib/compliance/rules.js | deterministic / existing path | weighted base: contact_hours, rule weight 4 | ACTIVE / PASS |
| H-03 | contact_hours | Fix the weeks outside the term | server/lib/compliance/rules.js | deterministic / existing path | weighted base: contact_hours, rule weight 2 | ACTIVE / PASS |
| H-04 | contact_hours | Resolve the weeks used by more than one row | server/lib/compliance/rules.js | deterministic / existing path | weighted base: contact_hours, rule weight 1 | ACTIVE / PASS |
| R-01 | reference_currency | Add references | server/lib/compliance/rules.js | deterministic / existing path | weighted base: reference_currency, rule weight 2 | ACTIVE / PASS |
| R-02 | reference_currency | Add the year to each reference | server/lib/compliance/rules.js | deterministic / existing path | replaced; no Hybrid-2 deduction | IMPLEMENTED_BUT_DISABLED / NOT_CHECKED |
| R-03 | reference_currency | Replace the outdated references | server/lib/compliance/rules.js | deterministic / existing path | replaced; no Hybrid-2 deduction | IMPLEMENTED_BUT_DISABLED / NOT_CHECKED |
| CUR-REF | institutional_validation | CUR-REF | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| CUR-CODE | institutional_validation | CUR-CODE | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing critical zero / gate | ACTIVE / PASS |
| CUR-FIELD | institutional_validation | CUR-FIELD | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| INST-MASTER | institutional_validation | INST-MASTER | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| INST-EXACT | institutional_validation | INST-EXACT | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| PO-MASTER | institutional_validation | PO-MASTER | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| PO-EXACT | institutional_validation | PO-EXACT | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| CLO-ID | institutional_validation | CLO-ID | server/lib/syllabuscheck/validation.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| CLO-MAP | institutional_validation | CLO-MAP | server/lib/syllabuscheck/validation.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| ILO-MAP | institutional_validation | ILO-MAP | server/lib/syllabuscheck/validation.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| HEADER | institutional_validation | HEADER | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| WEEK | institutional_validation | WEEK | server/lib/syllabuscheck/validation.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| WEEK-DUP | institutional_validation | WEEK-DUP | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| WEEK-GAP | institutional_validation | WEEK-GAP | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| ILO-MISSING | institutional_validation | ILO-MISSING | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| ILO-GAP | institutional_validation | ILO-GAP | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| ILO-NUM | institutional_validation | ILO-NUM | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| GRADE-RANGE | institutional_validation | GRADE-RANGE | server/lib/syllabuscheck/validation.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| GRADE-100 | institutional_validation | GRADE-100 | server/lib/syllabuscheck/validation.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| VALUE | institutional_validation | VALUE | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing -1 per missing lesson | ACTIVE / PASS |
| LINK | institutional_validation | LINK | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing -2 per confirmed failed link; unavailable has no deduction | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| AI-REQUIRED | institutional_validation | AI-REQUIRED | server/lib/syllabuscheck/engine.js | deterministic / existing path | existing hard gate; no added deduction | ACTIVE / PASS |
| SEM:CLO-PO | legacy_relationship | CLO-PO | server/lib/syllabuscheck/gemini.js | model / existing path | existing scored relationship; grouping/secondary tags preserved | ACTIVE / PASS |
| SEM:CLO-EGA | legacy_relationship | CLO-EGA | server/lib/syllabuscheck/gemini.js | model / existing path | existing scored relationship; grouping/secondary tags preserved | ACTIVE / PASS |
| SEM:ILO-CLO | legacy_relationship | ILO-CLO | server/lib/syllabuscheck/gemini.js | model / existing path | existing scored relationship; grouping/secondary tags preserved | ACTIVE / PASS |
| SEM:ILO-activity | legacy_relationship | ILO-activity | server/lib/syllabuscheck/gemini.js | model / existing path | existing scored relationship; grouping/secondary tags preserved | ACTIVE / PASS |
| SEM:ILO-assessment | legacy_relationship | ILO-assessment | server/lib/syllabuscheck/gemini.js | model / existing path | existing scored relationship; grouping/secondary tags preserved | ACTIVE / PASS |
| SEM:Module-value | legacy_relationship | Module-value | server/lib/syllabuscheck/gemini.js | model / existing path | existing scored relationship; grouping/secondary tags preserved | ACTIVE / PASS |
| SEM:CLO-anyPO | legacy_relationship | CLO-anyPO | server/lib/syllabuscheck/gemini.js | model / existing path | advisory (whole-list support retains existing scored-group treatment) | ACTIVE / PASS |
| SEM:CLO-anyEGA | legacy_relationship | CLO-anyEGA | server/lib/syllabuscheck/gemini.js | model / existing path | advisory (whole-list support retains existing scored-group treatment) | ACTIVE / PASS |
| SEM:Description-plan | legacy_relationship | Description-plan | server/lib/syllabuscheck/gemini.js | model / existing path | advisory (whole-list support retains existing scored-group treatment) | ACTIVE / PASS |
| SEM:ILO-content | legacy_relationship | ILO-content | server/lib/syllabuscheck/gemini.js | model / existing path | advisory (whole-list support retains existing scored-group treatment) | ACTIVE / PASS |
| SEM:REF-plan | legacy_relationship | REF-plan | server/lib/syllabuscheck/gemini.js | model / existing path | advisory (whole-list support retains existing scored-group treatment) | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| VPAA-01 | academic_alignment | Content-course | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| VPAA-02 | academic_alignment | Content-ILO | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| VPAA-03 | academic_alignment | ILO-CLO | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| VPAA-04 | academic_alignment | Content-activity | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| VPAA-05 | academic_alignment | ILO-activity | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| VPAA-06 | academic_alignment | Content-assessment | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| VPAA-07 | academic_alignment | Activity-assessment | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| CLO1:structure | clo_classification | Introductory | server/lib/syllabuscheck/cloClassification.js | deterministic / existing path | advisory | ACTIVE / PASS |
| CLO1:semantic | clo_classification | Introductory | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| CLO2:structure | clo_classification | Enabling | server/lib/syllabuscheck/cloClassification.js | deterministic / existing path | advisory | ACTIVE / FAIL |
| CLO2:semantic | clo_classification | Enabling | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| CLO3:structure | clo_classification | Demonstrating | server/lib/syllabuscheck/cloClassification.js | deterministic / existing path | advisory | ACTIVE / FAIL |
| CLO3:semantic | clo_classification | Demonstrating | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| CLO4:structure | clo_classification | Integration of Values | server/lib/syllabuscheck/cloClassification.js | deterministic / existing path | advisory | ACTIVE / FAIL |
| CLO4:semantic | clo_classification | Integration of Values | server/lib/syllabuscheck/academicPolicyV2.js | model / SYLLABUS_CHECK_ACADEMIC_V2 | advisory | ACTIVE / PASS |
| CLO-03 | staged_academic | Course-CLO | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_A | advisory | ACTIVE / PASS |
| CLO-09 | staged_academic | CLO-set | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_A | advisory | ACTIVE / PASS |
| CLO-06 | staged_academic | CLO-PO | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_A | advisory | ACTIVE / PASS |
| CLO-07 | staged_academic | CLO-EGA | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_A | advisory | ACTIVE / PASS |
| PLAN-03 | staged_academic | Content-course | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_B | advisory | ACTIVE / PASS |
| PLAN-04 | staged_academic | Plan-sequence | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_B | advisory | ACTIVE / PASS |
| ALN-01 | staged_academic | Content-ILO | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_B | advisory | ACTIVE / PASS |
| CUR-11 | staged_academic | Title-description | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_REQUIREMENTS_ADVICE | advisory | ACTIVE / PASS |
| PLAN-11 | staged_academic | Week1-introduction | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_REQUIREMENTS_ADVICE | advisory | ACTIVE / PASS |
| ALN-02 | staged_academic | ILO-anyCLO | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_B3 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| PLAN-10 | staged_academic | CLO-coverage | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_B4 | advisory | ACTIVE / PASS |
| ALN-05 | staged_academic | Activity-fit | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_C1 | advisory | ACTIVE / PASS |
| ALN-06 | staged_academic | Activity-fit | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_C1 | advisory | ACTIVE / PASS |
| ALN-07 | staged_academic | Assessment-fit | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_C2 | advisory | ACTIVE / PASS |
| ALN-08 | staged_academic | Assessment-fit | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_C2 | advisory | ACTIVE / PASS |
| ALN-09 | staged_academic | Assessment-fit | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_C2 | advisory | ACTIVE / PASS |
| ALN-11 | staged_academic | Content-activity | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_C3 | advisory | ACTIVE / PASS |
| ALN-12 | staged_academic | Content-assessment | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_C3 | advisory | ACTIVE / PASS |
| ALN-13 | staged_academic | Activity-assessment | server/lib/syllabuscheck/verdict.js | model / SYLLABUS_CHECK_STAGE_C3 | advisory | ACTIVE / PASS |
| VAL-02 | staged_academic | Module-value | server/lib/syllabuscheck/values.js | model / SYLLABUS_CHECK_STAGE_D1 | advisory | ACTIVE / PASS |
| VAL-03 | staged_academic | Value-use | server/lib/syllabuscheck/values.js | model / SYLLABUS_CHECK_STAGE_D1 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_CHECKED |
| VAL-04 | staged_academic | VAL-04 | server/lib/syllabuscheck/values.js | deterministic / SYLLABUS_CHECK_STAGE_D1 | advisory | ACTIVE / NEEDS_REVIEW |
| VAL-05 | staged_academic | Value-map | server/lib/syllabuscheck/values.js | model / SYLLABUS_CHECK_STAGE_D1 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_CHECKED |
| REF-02 | staged_academic | REF-02 | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / FAIL |
| REF-03 | staged_academic | REF-03 | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| REF-04 | staged_academic | REF-04 | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / PARTIALLY_EVALUATED |
| REF-05 | staged_academic | Ref-relevance | server/lib/syllabuscheck/references.js | model / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| outcome.vagueVerb | quality_note | outcome.vagueVerb | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / PASS |
| outcome.broad | quality_note | outcome.broad | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / PASS |
| outcome.practicalCompetency | quality_note | outcome.practicalCompetency | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / PASS |
| outcome.duplicate | quality_note | outcome.duplicate | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / PASS |
| progression.singleLesson | quality_note | progression.singleLesson | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / PASS |
| coverage.repeatedContent | quality_note | coverage.repeatedContent | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / PASS |
| assessment.namedOnly | quality_note | assessment.namedOnly | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / NEEDS_REVIEW |
| assessment.noRubricMentioned | quality_note | assessment.noRubricMentioned | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / NEEDS_REVIEW |
| assessment.dominantComponent | quality_note | assessment.dominantComponent | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / PASS |
| workload.manyTasksInAWeek | quality_note | workload.manyTasksInAWeek | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / PASS |
| workload.assessmentClustering | quality_note | workload.assessmentClustering | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / PASS |
| access.dependsOnResources | quality_note | access.dependsOnResources | server/lib/syllabuscheck/quality.js | deterministic / existing path | advisory | ACTIVE / PASS |
| CLO-01 | verdict_deterministic | CLO-01 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| CLO-02 | verdict_deterministic | CLO-02 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / FAIL |
| CLO-08 | verdict_deterministic | CLO-08 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / FAIL |
| STR-05 | verdict_deterministic | STR-05 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| PLAN-02 | verdict_deterministic | PLAN-02 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / FAIL |
| CUR-01 | verdict_alias | CUR-01 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| CUR-02 | verdict_alias | CUR-02 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| CUR-03 | verdict_alias | CUR-03 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| CUR-04 | verdict_alias | CUR-04 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| CUR-05 | verdict_alias | CUR-05 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| CUR-06 | verdict_alias | CUR-06 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| CUR-07 | verdict_alias | CUR-07 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| CUR-08 | verdict_alias | CUR-08 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_CHECKED |
| CUR-09 | verdict_alias | CUR-09 | server/lib/syllabuscheck/verdict.js | model / existing path | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_CHECKED |
| STR-01 | verdict_alias | STR-01 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| STR-04 | verdict_alias | STR-04 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| STR-06 | verdict_alias | STR-06 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| PLAN-01 | verdict_alias | PLAN-01 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| ADM-03 | verdict_alias | ADM-03 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| VAL-01 | verdict_alias | VAL-01 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | ACTIVE / PASS |
| STR-07 | reserved | STR-07 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | PENDING_POLICY_CLARIFICATION / NOT_CHECKED |
| ADM-04 | reserved | ADM-04 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | PENDING_INSTITUTIONAL_REFERENCE / NOT_CHECKED |
| ADM-05 | reserved | ADM-05 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | PENDING_POLICY_CLARIFICATION / NOT_CHECKED |
| CUR-10 | reserved | CUR-10 | server/lib/syllabuscheck/verdict.js | deterministic / existing path | advisory | PENDING_INSTITUTIONAL_REFERENCE / NOT_CHECKED |
| CLO-05 | reserved | CLO-05 | server/lib/syllabuscheck/verdict.js | model / existing path | advisory | PENDING_POLICY_CLARIFICATION / NOT_CHECKED |
| CLO-10 | reserved | CLO-10 | server/lib/syllabuscheck/verdict.js | model / existing path | advisory | PENDING_POLICY_CLARIFICATION / NOT_CHECKED |
| PLAN-05 | reserved | PLAN-05 | server/lib/syllabuscheck/verdict.js | model / existing path | advisory | PENDING_POLICY_CLARIFICATION / NOT_CHECKED |
| PLAN-06 | reserved | PLAN-06 | server/lib/syllabuscheck/verdict.js | model / existing path | advisory | PENDING_POLICY_CLARIFICATION / NOT_CHECKED |
| ALN-03 | reserved | ALN-03 | server/lib/syllabuscheck/verdict.js | model / existing path | advisory | PENDING_POLICY_CLARIFICATION / NOT_CHECKED |
| ALN-04 | reserved | ALN-04 | server/lib/syllabuscheck/verdict.js | model / existing path | advisory | PENDING_POLICY_CLARIFICATION / NOT_CHECKED |
| ALN-10 | reserved | ALN-10 | server/lib/syllabuscheck/verdict.js | model / existing path | advisory | PENDING_POLICY_CLARIFICATION / NOT_CHECKED |
| APA:DATE_MISSING | reference_text | DATE_MISSING | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:DATE_PERIOD | reference_text | DATE_PERIOD | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:DATE_RANGE | reference_text | DATE_RANGE | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:AUTHOR_MISSING | reference_text | AUTHOR_MISSING | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:AUTHOR_PERIOD | reference_text | AUTHOR_PERIOD | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / FAIL |
| APA:AUTHOR_FORM | reference_text | AUTHOR_FORM | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:AUTHOR_AND | reference_text | AUTHOR_AND | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:AUTHOR_COMMA | reference_text | AUTHOR_COMMA | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:AUTHOR_AMPERSAND | reference_text | AUTHOR_AMPERSAND | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:AUTHOR_INITIALS | reference_text | AUTHOR_INITIALS | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:TITLE_MISSING | reference_text | TITLE_MISSING | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:TITLE_QUOTES | reference_text | TITLE_QUOTES | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:JOURNAL_VOLUME | reference_text | JOURNAL_VOLUME | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:JOURNAL_PAGES | reference_text | JOURNAL_PAGES | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:JOURNAL_NAME | reference_text | JOURNAL_NAME | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:BOOK_PUBLISHER | reference_text | BOOK_PUBLISHER | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:BOOK_LOCATION | reference_text | BOOK_LOCATION | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:CHAPTER_PAGES | reference_text | CHAPTER_PAGES | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:CHAPTER_PUBLISHER | reference_text | CHAPTER_PUBLISHER | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:REPORT_PUBLISHER | reference_text | REPORT_PUBLISHER | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:CONF_IN | reference_text | CONF_IN | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:WEB_URL | reference_text | WEB_URL | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:RETRIEVED | reference_text | RETRIEVED | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:ACCESSED | reference_text | ACCESSED | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:DOI_FORM | reference_text | DOI_FORM | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:DOI_MALFORMED | reference_text | DOI_MALFORMED | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| APA:URL_HTTP | reference_text | URL_HTTP | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:URL_MALFORMED | reference_text | URL_MALFORMED | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | IMPLEMENTED_BUT_NOT_EVALUATED / NOT_APPLICABLE |
| APA:URL_TWICE | reference_text | URL_TWICE | server/lib/syllabuscheck/references.js | deterministic / SYLLABUS_CHECK_STAGE_D2 | advisory | ACTIVE / PASS |
| REF:authenticity | reference_external | External DOI authenticity | server/lib/syllabuscheck/references.js | external / SYLLABUS_CHECK_REF_VERIFY=crossref | advisory | IMPLEMENTED_BUT_DISABLED / NOT_CHECKED |

## Pending decisions

| ID | State | Minimum activation requirement |
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
