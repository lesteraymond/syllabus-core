# Deterministic baseline findings

Existing Hybrid-2 `engine.coded` only, against the frozen local MySQL export in `masters.json`. No `engine.run`, HTTP link verification or AI stage. No official score or pass/fail is issued. The standard contains 47 rules; production codedStandard omits C-04, R-02 and R-03 as it already did. Base scores below are the existing 44-rule component before Hybrid-2 deductions/gates. Passing mark remains 79.

## it202: source

Base component: 96; critical identity flag: false; AI: NOT_EVALUATED; official score/pass: null.


| Rule | Field | Severity | Classification | Evidence/message |
|---|---|---|---|---|
| T-13 | plan[3].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 4-5, ILO2 has no CLO tag. |
| T-13 | plan[6].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 9-11, ILO2 has no CLO tag. |
| T-13 | plan[8].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 13, ILO2 has no CLO tag. |
| T-13 | plan[11].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 16-17, ILO2 has no CLO tag. |
| T-20 | reqs[0] | minor | Possible software defect | Requirement "1. Class attendance" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[1] | minor | Possible software defect | Requirement "2. Recitations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[2] | minor | Possible software defect | Requirement "3. Quizzes" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[3] | minor | Possible software defect | Requirement "4. Examinations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[4] | minor | Possible software defect | Requirement "5. Machine Problem : Laboratory Exercises" starts with its own number; the form numbers the list for you. |
| T-21 | refs.program | blocking | Institutional reference conflict | References (B. Internet Programming) has no entries and is not marked not applicable. |
| P-05 | clos[3] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 4 is not built by any ILO in the Learning Plan. |
| A-02 | clos[3] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 4 is not assessed: no week that builds it has an assessment task. |
| H-04 | plan | minor | Confirmed objective discrepancy | Week 4 appears in more than one row. |
| CUR-FIELD | meta.title | blocking | Institutional reference conflict | title differs from the official curriculum. |
| CUR-FIELD | meta.yearLevel | blocking | Possible software defect | yearLevel differs from the official curriculum. |
| INST-EXACT | outcomes.vision | blocking | Institutional reference conflict | vision must match the institutional master exactly. |
| INST-EXACT | outcomes.mission | blocking | Institutional reference conflict | mission must match the institutional master exactly. |
| INST-EXACT | outcomes.egas | blocking | Institutional reference conflict; also Possible software defect | egas must match the institutional master exactly. |
| PO-EXACT | outcomes.pos | blocking | Institutional reference conflict | Program outcomes must match the selected program master. |
| ILO-MAP | plan[3].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[6].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[8].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[11].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| WEEK-DUP | plan[3].week | blocking | Confirmed objective discrepancy | Weeks 4 are assigned more than once. |
| VALUE | plan[3].values | major | Academic-policy question | Week 4-5: integrate at least one Marian-Augustinian core value. |

## it202: builder-context

Base component: 96; critical identity flag: false; AI: NOT_EVALUATED; official score/pass: null.

- meta.code from frozen catalog/reference
- meta.title from frozen catalog/reference
- meta.yearLevel from frozen catalog/reference
- Curriculum year left blank; engine selects sole approved 2022-2023 reference (cohort confirmation pending).

| Rule | Field | Severity | Classification | Evidence/message |
|---|---|---|---|---|
| T-13 | plan[3].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 4-5, ILO2 has no CLO tag. |
| T-13 | plan[6].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 9-11, ILO2 has no CLO tag. |
| T-13 | plan[8].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 13, ILO2 has no CLO tag. |
| T-13 | plan[11].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 16-17, ILO2 has no CLO tag. |
| T-20 | reqs[0] | minor | Possible software defect | Requirement "1. Class attendance" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[1] | minor | Possible software defect | Requirement "2. Recitations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[2] | minor | Possible software defect | Requirement "3. Quizzes" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[3] | minor | Possible software defect | Requirement "4. Examinations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[4] | minor | Possible software defect | Requirement "5. Machine Problem : Laboratory Exercises" starts with its own number; the form numbers the list for you. |
| T-21 | refs.program | blocking | Institutional reference conflict | References (B. Internet Programming) has no entries and is not marked not applicable. |
| P-05 | clos[3] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 4 is not built by any ILO in the Learning Plan. |
| A-02 | clos[3] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 4 is not assessed: no week that builds it has an assessment task. |
| H-04 | plan | minor | Confirmed objective discrepancy | Week 4 appears in more than one row. |
| INST-EXACT | outcomes.vision | blocking | Institutional reference conflict | vision must match the institutional master exactly. |
| INST-EXACT | outcomes.mission | blocking | Institutional reference conflict | mission must match the institutional master exactly. |
| INST-EXACT | outcomes.egas | blocking | Institutional reference conflict; also Possible software defect | egas must match the institutional master exactly. |
| PO-EXACT | outcomes.pos | blocking | Institutional reference conflict | Program outcomes must match the selected program master. |
| ILO-MAP | plan[3].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[6].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[8].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[11].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| WEEK-DUP | plan[3].week | blocking | Confirmed objective discrepancy | Weeks 4 are assigned more than once. |
| VALUE | plan[3].values | major | Academic-policy question | Week 4-5: integrate at least one Marian-Augustinian core value. |

## ie402: source

Base component: 96; critical identity flag: false; AI: NOT_EVALUATED; official score/pass: null.


| Rule | Field | Severity | Classification | Evidence/message |
|---|---|---|---|---|
| T-06 | meta.lecture | blocking | Possible software defect | Lecture and laboratory units (V) are not both entered. |
| T-20 | reqs[0] | minor | Possible software defect | Requirement "1. Class attendance" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[1] | minor | Possible software defect | Requirement "2. Recitations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[2] | minor | Possible software defect | Requirement "3. Quizzes" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[3] | minor | Possible software defect | Requirement "4. Examinations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[4] | minor | Possible software defect | Requirement "5. Compilation of activity reports" starts with its own number; the form numbers the list for you. |
| T-21 | refs.program | blocking | Institutional reference conflict | References (B. Internet Programming) has no entries and is not marked not applicable. |
| T-21 | refs.electronics | blocking | Institutional reference conflict | References (D. Electronics) has no entries and is not marked not applicable. |
| H-01 | meta.lecture | major | Possible software defect | The credit units are not usable: lecture empty, laboratory empty. |
| CUR-FIELD | meta.title | blocking | Institutional reference conflict | title differs from the official curriculum. |
| CUR-FIELD | meta.prereq | blocking | Institutional reference conflict | prereq differs from the official curriculum. |
| CUR-FIELD | meta.lecture | blocking | Possible software defect | lecture differs from the official curriculum. |
| CUR-FIELD | meta.lab | blocking | Possible software defect | lab differs from the official curriculum. |
| CUR-FIELD | meta.yearLevel | blocking | Possible software defect | yearLevel differs from the official curriculum. |
| INST-EXACT | outcomes.vision | blocking | Institutional reference conflict | vision must match the institutional master exactly. |
| INST-EXACT | outcomes.mission | blocking | Institutional reference conflict | mission must match the institutional master exactly. |
| INST-EXACT | outcomes.egas | blocking | Institutional reference conflict; also Possible software defect | egas must match the institutional master exactly. |
| VALUE | plan[3].values | major | Academic-policy question | Week 5-8: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[5].values | major | Academic-policy question | Week 10-11: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[6].values | major | Academic-policy question | Week 12-14: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[7].values | major | Academic-policy question | Week 15-17: integrate at least one Marian-Augustinian core value. |

## ie402: builder-context

Base component: 99; critical identity flag: false; AI: NOT_EVALUATED; official score/pass: null.

- meta.code from frozen catalog/reference
- meta.title from frozen catalog/reference
- meta.yearLevel from frozen catalog/reference
- meta.lecture from reference; PDF says only 3 units
- meta.lab from reference; PDF says only 3 units
- Curriculum year left blank; engine selects sole approved 2022-2023 reference (cohort confirmation pending).

| Rule | Field | Severity | Classification | Evidence/message |
|---|---|---|---|---|
| T-20 | reqs[0] | minor | Possible software defect | Requirement "1. Class attendance" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[1] | minor | Possible software defect | Requirement "2. Recitations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[2] | minor | Possible software defect | Requirement "3. Quizzes" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[3] | minor | Possible software defect | Requirement "4. Examinations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[4] | minor | Possible software defect | Requirement "5. Compilation of activity reports" starts with its own number; the form numbers the list for you. |
| T-21 | refs.program | blocking | Institutional reference conflict | References (B. Internet Programming) has no entries and is not marked not applicable. |
| T-21 | refs.electronics | blocking | Institutional reference conflict | References (D. Electronics) has no entries and is not marked not applicable. |
| CUR-FIELD | meta.prereq | blocking | Institutional reference conflict | prereq differs from the official curriculum. |
| INST-EXACT | outcomes.vision | blocking | Institutional reference conflict | vision must match the institutional master exactly. |
| INST-EXACT | outcomes.mission | blocking | Institutional reference conflict | mission must match the institutional master exactly. |
| INST-EXACT | outcomes.egas | blocking | Institutional reference conflict; also Possible software defect | egas must match the institutional master exactly. |
| VALUE | plan[3].values | major | Academic-policy question | Week 5-8: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[5].values | major | Academic-policy question | Week 10-11: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[6].values | major | Academic-policy question | Week 12-14: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[7].values | major | Academic-policy question | Week 15-17: integrate at least one Marian-Augustinian core value. |

## cpe304: source

Base component: 93; critical identity flag: true; AI: NOT_EVALUATED; official score/pass: null.


| Rule | Field | Severity | Classification | Evidence/message |
|---|---|---|---|---|
| T-13 | plan[4].ilos[0] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 7-8, ILO1 has no CLO tag. |
| T-13 | plan[4].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 7-8, ILO2 has no CLO tag. |
| T-13 | plan[4].ilos[2] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 7-8, ILO3 has no CLO tag. |
| T-13 | plan[5].ilos[0] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 9-11, ILO1 has no CLO tag. |
| T-13 | plan[5].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 9-11, ILO2 has no CLO tag. |
| T-13 | plan[5].ilos[2] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 9-11, ILO3 has no CLO tag. |
| T-13 | plan[7].ilos[0] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 13-14, ILO1 has no CLO tag. |
| T-13 | plan[7].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 13-14, ILO2 has no CLO tag. |
| T-13 | plan[8].ilos[0] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 15-16, ILO1 has no CLO tag. |
| T-13 | plan[9].ilos[0] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 17, ILO1 has no CLO tag. |
| T-13 | plan[9].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 17, ILO2 has no CLO tag. |
| T-20 | reqs[0] | minor | Possible software defect | Requirement "1. Class Attendance" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[1] | minor | Possible software defect | Requirement "2. Recitations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[2] | minor | Possible software defect | Requirement "3. Quizzes" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[3] | minor | Possible software defect | Requirement "4. Examinations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[4] | minor | Possible software defect | Requirement "5. Compilation of Laboratory Activity Reports" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[5] | minor | Possible software defect | Requirement "6. Project" starts with its own number; the form numbers the list for you. |
| T-21 | refs.books | blocking | Institutional reference conflict | References (A. Books) has no entries and is not marked not applicable. |
| T-21 | refs.program | blocking | Institutional reference conflict | References (B. Internet Programming) has no entries and is not marked not applicable. |
| T-21 | refs.electronics | blocking | Institutional reference conflict | References (D. Electronics) has no entries and is not marked not applicable. |
| P-05 | clos[2] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 3 is not built by any ILO in the Learning Plan. |
| P-05 | clos[3] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 4 is not built by any ILO in the Learning Plan. |
| A-02 | clos[2] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 3 is not assessed: no week that builds it has an assessment task. |
| A-02 | clos[3] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 4 is not assessed: no week that builds it has an assessment task. |
| CUR-CODE | meta.code | blocking | Possible software defect | CRITICAL MISMATCH: Course Code CpE 304 does not exist in the official BSCPE curriculum. |
| INST-EXACT | outcomes.vision | blocking | Institutional reference conflict | vision must match the institutional master exactly. |
| INST-EXACT | outcomes.mission | blocking | Institutional reference conflict | mission must match the institutional master exactly. |
| INST-EXACT | outcomes.egas | blocking | Institutional reference conflict; also Possible software defect | egas must match the institutional master exactly. |
| ILO-MAP | plan[4].ilos[0].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[4].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[4].ilos[2].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[5].ilos[0].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[5].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[5].ilos[2].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[7].ilos[0].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[7].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[8].ilos[0].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[9].ilos[0].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[9].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MISSING | plan[0].ilos | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 1 needs a lesson ILO. |
| VALUE | plan[0].values | major | Academic-policy question | Week 1: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[1].values | major | Academic-policy question | Week 2-3: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[2].values | major | Academic-policy question | Week 4-5: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[4].values | major | Academic-policy question | Week 7-8: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[5].values | major | Academic-policy question | Week 9-11: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[7].values | major | Academic-policy question | Week 13-14: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[8].values | major | Academic-policy question | Week 15-16: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[9].values | major | Academic-policy question | Week 17: integrate at least one Marian-Augustinian core value. |

## cpe304: builder-context

Base component: 93; critical identity flag: false; AI: NOT_EVALUATED; official score/pass: null.

- meta.code from frozen catalog/reference
- meta.title from frozen catalog/reference
- meta.yearLevel from frozen catalog/reference
- Curriculum year left blank; engine selects sole approved 2022-2023 reference (cohort confirmation pending).

| Rule | Field | Severity | Classification | Evidence/message |
|---|---|---|---|---|
| T-13 | plan[4].ilos[0] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 7-8, ILO1 has no CLO tag. |
| T-13 | plan[4].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 7-8, ILO2 has no CLO tag. |
| T-13 | plan[4].ilos[2] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 7-8, ILO3 has no CLO tag. |
| T-13 | plan[5].ilos[0] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 9-11, ILO1 has no CLO tag. |
| T-13 | plan[5].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 9-11, ILO2 has no CLO tag. |
| T-13 | plan[5].ilos[2] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 9-11, ILO3 has no CLO tag. |
| T-13 | plan[7].ilos[0] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 13-14, ILO1 has no CLO tag. |
| T-13 | plan[7].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 13-14, ILO2 has no CLO tag. |
| T-13 | plan[8].ilos[0] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 15-16, ILO1 has no CLO tag. |
| T-13 | plan[9].ilos[0] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 17, ILO1 has no CLO tag. |
| T-13 | plan[9].ilos[1] | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 17, ILO2 has no CLO tag. |
| T-20 | reqs[0] | minor | Possible software defect | Requirement "1. Class Attendance" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[1] | minor | Possible software defect | Requirement "2. Recitations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[2] | minor | Possible software defect | Requirement "3. Quizzes" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[3] | minor | Possible software defect | Requirement "4. Examinations" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[4] | minor | Possible software defect | Requirement "5. Compilation of Laboratory Activity Reports" starts with its own number; the form numbers the list for you. |
| T-20 | reqs[5] | minor | Possible software defect | Requirement "6. Project" starts with its own number; the form numbers the list for you. |
| T-21 | refs.books | blocking | Institutional reference conflict | References (A. Books) has no entries and is not marked not applicable. |
| T-21 | refs.program | blocking | Institutional reference conflict | References (B. Internet Programming) has no entries and is not marked not applicable. |
| T-21 | refs.electronics | blocking | Institutional reference conflict | References (D. Electronics) has no entries and is not marked not applicable. |
| P-05 | clos[2] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 3 is not built by any ILO in the Learning Plan. |
| P-05 | clos[3] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 4 is not built by any ILO in the Learning Plan. |
| A-02 | clos[2] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 3 is not assessed: no week that builds it has an assessment task. |
| A-02 | clos[3] | major | Confirmed objective discrepancy; also Academic-policy question | CLO 4 is not assessed: no week that builds it has an assessment task. |
| INST-EXACT | outcomes.vision | blocking | Institutional reference conflict | vision must match the institutional master exactly. |
| INST-EXACT | outcomes.mission | blocking | Institutional reference conflict | mission must match the institutional master exactly. |
| INST-EXACT | outcomes.egas | blocking | Institutional reference conflict; also Possible software defect | egas must match the institutional master exactly. |
| ILO-MAP | plan[4].ilos[0].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[4].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[4].ilos[2].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[5].ilos[0].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[5].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[5].ilos[2].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[7].ilos[0].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[7].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[8].ilos[0].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[9].ilos[0].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MAP | plan[9].ilos[1].tags | blocking | Confirmed objective discrepancy; also Academic-policy question | Map every lesson ILO to at least one existing CLO without duplicate mappings. |
| ILO-MISSING | plan[0].ilos | blocking | Confirmed objective discrepancy; also Academic-policy question | Week 1 needs a lesson ILO. |
| VALUE | plan[0].values | major | Academic-policy question | Week 1: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[1].values | major | Academic-policy question | Week 2-3: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[2].values | major | Academic-policy question | Week 4-5: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[4].values | major | Academic-policy question | Week 7-8: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[5].values | major | Academic-policy question | Week 9-11: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[7].values | major | Academic-policy question | Week 13-14: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[8].values | major | Academic-policy question | Week 15-16: integrate at least one Marian-Augustinian core value. |
| VALUE | plan[9].values | major | Academic-policy question | Week 17: integrate at least one Marian-Augustinian core value. |

AI-dependent judgment requiring faculty validation: no labels are assigned for CLO–PO, CLO–EGA or ILO–CLO suitability; course/lesson relevance; activities and assessment; integrated-value meaning; reference relevance or authenticity. Approval of a syllabus is not a per-relationship alignment oracle.
