# Selection record (coordinator only)

Package lcup-faculty-validation-1, built 2026-10-29.

> **Never give this record to reviewers, and never include it in any prompt or model input. The signals are not judgments, not expected answers and not ground truth; do not score faculty or Claude against them.**

The selection signals and observations were written by Claude Code (an AI assistant) on 2026-10-29 from the wording of the cases alone, when the sample was drawn. No faculty member has reviewed them.

## Rule

1. Pool: the relationships of the three verified syllabi (IT 202, IE-402, CpE 304) in lcup-academic-benchmark-1, for the seven weekly relationship types of academic-evaluation-v2-preview-1.
2. Eligible: academic-semantic, required weekly, not optional, no reference hold, no missing evidence, Claude eligibility "candidate_pending_authorization".
3. Left out: the 3 cases with an earlier Claude output (BM1-IT202-096, BM1-IE402-074, BM1-CPE304-051), so that no earlier output can reach the blind materials or shape the sample.
4. Three cases per relationship, one from each syllabus where it offers a suitable case.
5. Within each relationship, cases chosen from their wording to include an apparent alignment, an apparent partial alignment and an apparent misalignment; where no authentic apparent misalignment exists, a case whose evidence is general or administrative instead, and the gap is reported. No academic content was written or changed.
6. Weeks spread over the term; one week may serve two relationships. Case IDs follow course, week and relationship order, so they reveal no signal.

## The 21 cases and the reason each was chosen

| Case | Benchmark case | Course | Week | Relationship | Signal (not a judgment) | Observation from the wording |
|---|---|---|---|---|---|---|
| FV-01 | BM1-IT202-130 | IT 202 | Week 1 | Course Content ↔ Learning Activities | apparent alignment | Every item of the orientation content (course contents, requirements and activities, objectives, grading system and policies) is named in an activity. |
| FV-02 | BM1-IT202-104 | IT 202 | Week 4-5 | Course Content ↔ ILO | apparent misalignment | The ILO names Java methods. The week's content lists the parts of a Java program, print and println, and data types; "XII. JAVA METHOD" is the Week 15 content. |
| FV-03 | BM1-IT202-141 | IT 202 | Week 4-5 | Learning Activities ↔ Assessment | apparent misalignment | The assessment names a simulation of the external and internal parts of the System Unit, which no activity names; the seatwork, laboratory and machine problem of the activities are not named in the assessment. |
| FV-04 | BM1-IT202-064 | IT 202 | Week 9-11 | ILO ↔ CLO | apparent partial alignment | Both name Java programs, and the ILO's "real-world problems" is close to the CLO's "social challenges"; the CLO's collaboration in multi-disciplinary, culturally diverse teams is not in the ILO. |
| FV-05 | BM1-IT202-155 | IT 202 | Week 15 | Course Content ↔ Assessment | apparent misalignment | The machine problem names "C programs" while the week's content and the course are Java; the recitation and quiz name no topic. |
| FV-06 | BM1-IT202-122 | IT 202 | Week 16-17 | Course Title ↔ Course Content | apparent partial alignment | The content names Java, the course language; its topic, a database connection through UCanAccess, is not among the topics the course description names. |
| FV-07 | BM1-IT202-093 | IT 202 | Week 16-17 | ILO ↔ Learning Activities | apparent misalignment | The ILO names Augustinian spirituality through value webbing; no activity names either. |
| FV-08 | BM1-IE402-073 | IE-402 | Week 1 | Course Title ↔ Course Content | limited evidence | The orientation content (course contents, requirements, objectives, grading and policies) names no systems engineering topic. |
| FV-09 | BM1-IE402-103 | IE-402 | Week 2-3 | Course Content ↔ Assessment | apparent alignment | The quiz and the case study report name the content's topics: systems engineering management and DoD acquisition. |
| FV-10 | BM1-IE402-078 | IE-402 | Week 5-8 | Course Title ↔ Course Content | apparent alignment | The content names "The Systems Engineering Process" and steps that the course description lists, such as requirements analysis. |
| FV-11 | BM1-IE402-105 | IE-402 | Week 5-8 | Course Content ↔ Learning Activities | apparent partial alignment | Two of the six listed topics (functional analysis and allocation; process outputs) are named in the activities; the overview, requirements analysis, design synthesis and verification are not. The workshop description is printed twice. |
| FV-12 | BM1-IE402-044 | IE-402 | Week 10-11 | ILO ↔ CLO | apparent misalignment | The ILO names creating and interpreting a WBS; the CLO names Augustinian spirituality through value webbing; no element is shared. The same ILO is also mapped to CLO 3. |
| FV-13 | BM1-IE402-110 | IE-402 | Week 10-11 | Learning Activities ↔ Assessment | apparent partial alignment | Both name risk assessment and mitigation. The WBS and configuration management activities are not assessed, and the experimental design and robust design of the tasks are not among this week's activities (they are Week 15-17 topics). |
| FV-14 | BM1-IE402-088 | IE-402 | Week 12-14 | Course Content ↔ ILO | apparent partial alignment | Both name management considerations; the ILO's resource allocation, risk assessment and stakeholder engagement are not named in the content. |
| FV-15 | BM1-IE402-113 | IE-402 | Week 12-14 | Learning Activities ↔ Assessment | apparent alignment | The planning workshop and the plan development task name the same plan elements (objectives, resource allocation, timeline, milestones); the brainstorming session and the proposal task both name a product improvement strategy. |
| FV-16 | BM1-IE402-065 | IE-402 | Week 15-17 | ILO ↔ Learning Activities | apparent alignment | The "Design and Conduct Experiments" activity names designing and conducting an experiment, collecting data and analysing results, as the ILO does. |
| FV-17 | BM1-CPE304-023 | CpE 304 | Week 2-3 | ILO ↔ CLO | apparent alignment | The ILO repeats the CLO's phrase "design process of electronic circuits and systems"; the CLO's experiments and data analysis are not in the ILO. |
| FV-18 | BM1-CPE304-022 | CpE 304 | Week 2-3 | ILO ↔ Learning Activities | apparent partial alignment | The ILO names developing analysis and design skills; the only activity is a lecture-discussion, and no practice activity is named. |
| FV-19 | BM1-CPE304-083 | CpE 304 | Week 4-5 | Course Content ↔ Learning Activities | limited evidence | The only activity, "Lecture- Discussion using PowerPoint", names a teaching method and no topic, against the operational-amplifier topics the content lists. |
| FV-20 | BM1-CPE304-090 | CpE 304 | Week 9-11 | Course Content ↔ Assessment | limited evidence | The only assessment, "Quiz on the topics discussed", names no topic. |
| FV-21 | BM1-CPE304-065 | CpE 304 | Week 13-14 | Course Content ↔ ILO | apparent alignment | Both name sensors and transducers. |

## Coverage

| Relationship | Cases |
|---|---|
| Course Title ↔ Course Content | FV-06 IT 202: apparent partial alignment; FV-08 IE-402: limited evidence; FV-10 IE-402: apparent alignment |
| Course Content ↔ ILO | FV-02 IT 202: apparent misalignment; FV-14 IE-402: apparent partial alignment; FV-21 CpE 304: apparent alignment |
| ILO ↔ CLO | FV-04 IT 202: apparent partial alignment; FV-12 IE-402: apparent misalignment; FV-17 CpE 304: apparent alignment |
| Course Content ↔ Learning Activities | FV-01 IT 202: apparent alignment; FV-11 IE-402: apparent partial alignment; FV-19 CpE 304: limited evidence |
| ILO ↔ Learning Activities | FV-07 IT 202: apparent misalignment; FV-16 IE-402: apparent alignment; FV-18 CpE 304: apparent partial alignment |
| Course Content ↔ Assessment | FV-05 IT 202: apparent misalignment; FV-09 IE-402: apparent alignment; FV-20 CpE 304: limited evidence |
| Learning Activities ↔ Assessment | FV-03 IT 202: apparent misalignment; FV-13 IE-402: apparent partial alignment; FV-15 IE-402: apparent alignment |

By course: IT 202 7, IE-402 9, CpE 304 5. By signal: apparent alignment 7, apparent partial alignment 6, apparent misalignment 5, limited evidence 3.

CLO classifications in the ILO ↔ CLO cases: FV-04: CLO 3 Demonstrating; FV-12: CLO 4 Integration of Values; FV-17: CLO 1 Introductory.

## Gaps

- Course Title ↔ Course Content: none of the eight CpE 304 cases can be used, because all are reference-held (the course code is written "CpE 304" in the syllabus and "CpE-304" in the curriculum transcription). No authentic apparent misalignment was found in the three syllabi; the third case is the IE-402 orientation week, whose content names no subject-matter topic.
- Course Content ↔ Learning Activities: no authentic apparent misalignment was found; the third case is CpE 304, whose activities name a teaching method only.
- Course Content ↔ Assessment: the sample has no apparent partial alignment for this relationship. An authentic candidate exists (reserve 1), but it would add a tenth IE-402 case; the CpE 304 case was kept so that the syllabus stays represented.
- CpE 304 uses the same general wording for the activities and the assessment of every lesson, so its cases for those relationships can only show how faculty treat general wording.
- ILO ↔ CLO: three cases cover CLO 1 (Introductory), CLO 3 (Demonstrating) and CLO 4 (Integration of Values); CLO 2 (Enabling) is not covered (reserve 2). IT 202 has no ILO mapped to CLO 4, and CpE 304 none mapped to CLO 3 or CLO 4.

## Reserves (not in the sample)

| # | Benchmark case | Course | Week | Relationship | Signal | Observation |
|---|---|---|---|---|---|---|
| 1 | BM1-IE402-109 | IE-402 | Week 10-11 | Course Content ↔ Assessment | apparent partial alignment | Both name risk; the tasks name experimental design and robust design, which the Weeks 10-11 content does not list. It would add an apparent partial alignment to Course Content ↔ Assessment. |
| 2 | BM1-IE402-036 | IE-402 | Week 5-8 | ILO ↔ CLO | apparent alignment | Both name analysing systems, and the ILO's stakeholder needs are close to the CLO's "people". It would add CLO 2 (Enabling), which the sample does not cover. |

A reserve replaces a case only before any reviewer has seen the package, for example when a reviewer turns out to be the author. Record the change and rebuild.

## Left out

- Earlier Claude output: BM1-IT202-096, BM1-IE402-074, BM1-CPE304-051.
- Reference-held: 8 (BM1-CPE304-049, BM1-CPE304-050, BM1-CPE304-053, BM1-CPE304-056, BM1-CPE304-060, BM1-CPE304-064, BM1-CPE304-067, BM1-CPE304-069).
- Missing evidence: 18 (see missing-mappings-and-non-evaluable.md).
