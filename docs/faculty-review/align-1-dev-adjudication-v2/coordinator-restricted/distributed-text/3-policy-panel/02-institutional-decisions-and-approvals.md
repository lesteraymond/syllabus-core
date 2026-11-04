# Institutional decisions and approval requirements

**Status: open. Nothing in this package is approved.** No decision has been recorded, and this package does not create, presume or record any approval. "Who decides" names a role for the institution to fill. It does not presume that a particular person or office exists.

## Decisions needed

Each decision is needed before the step it gates. The steps are in 03-adjudication-procedure.

| ID | Decision | Why it is needed | Who decides (role) | Needed before |
| --- | --- | --- | --- | --- |
| P1–P7 | The seven academic policy questions (01-academic-policy-questions) | They decide how case judgments become references | Policy panel | Step 6, adjudication |
| I1 | Name the coordinator, two reviewers per course, an adjudicator per discipline and the policy panel | The review needs qualified, independent people | Academic affairs | Step 1, before Part A is sent |
| I2 | Approve, amend or reject the adjudication procedure (03-adjudication-procedure) | It is a proposal | Academic affairs, with quality assurance | Step 1, before Part A is sent |
| I3 | Supply an official description of each EGA, or confirm that none exists | The system holds names only (P3) | The office responsible for the graduate attributes | Step 4, before the panel decides |
| I4 | Confirm or replace the core-value names and definitions | They were copied from the website and are pending approval (P6) | The office responsible for the core values | Step 4, before the panel decides |
| I5 | Supply official program outcomes and curricula for BSN, BSEd, BSA and BSHM, or confirm that these cases are judged as written | None is held; the cases use synthetic wording | The program chairs | Step 1, before Part A is sent |
| I6 | Confirm the BSIT outcome list and its mapping to the EGAs | The system holds 10 outcomes from the institutional form and 9 transcribed from the IT 202 syllabus, numbered differently; the IT 204 template tags outcomes 11 and 14; the PO-to-EGA mapping is not confirmed | The BSIT program chair | Step 4, before the panel decides |
| I7 | Say what the CLO level labels Introductory, Enabling, Demonstrating and Integration of Values mean, and whether a curriculum map with contribution levels exists | It bears on P1 | Quality assurance | Step 4, before the panel decides |
| I8 | Decide whether "insufficient information" is an acceptable reference answer, and how it is treated | Reviewers may choose it, and the software has a similar verdict ("insufficient evidence") | Policy panel | Step 6, adjudication |
| I9 | Decide when a case may carry more than one accepted answer | Some cases may be genuinely open to two readings | Policy panel | Step 6, adjudication |
| I10 | Set the standard for an approved reference (for example both reviewers agree, or an adjudicated decision), and how unresolved cases are reported | It is needed to record decisions | Policy panel | Step 7, recording references |
| I11 | Set limits on recommendations: may they raise an outcome's cognitive level beyond what its course and year need, change its subject matter, add content not needed for alignment, or propose removal? | Part B asks faculty to rate such proposals; the software needs a rule | Policy panel | Step 7, recording references |
| I12 | Decide where approved references are kept, how they are versioned, who may change them, and whether reviewers are recorded by name or by code | Accountability and privacy; the forms collect a reviewer code | Academic affairs, with the data protection officer | Step 1, before Part A is sent |
| I13 | Decide whether and how faculty review the protected held-out cases (other reviewers, no software output, sealed until the final run) | Their verdicts are also developer-written | Quality assurance | Before any held-out run |
| I14 | Confirm that the checker's findings stay advisory, and that this review changes neither the official score, the pass mark of 79, the 47 rules nor the submission gates | This review changes no policy by itself | Academic affairs | Standing |
| I15 | Decide whether collecting, recording and reporting the reviewers' judgments needs research-ethics clearance or the reviewers' informed consent (for example if results are reported in a thesis or capstone document), and obtain it if so | Judgments are collected from people and may be reported | The research ethics committee, or the office the institution designates | Step 1, before Part A is sent |

## Approval requirements

**What an approval record contains.** For each decision:

- the decision ID;
- the decision as worded by the approver (an option letter alone is not enough when the wording was changed);
- the approving role, and the approver's name if the institution records names;
- the date;
- a reference to the minutes, memo or resolution that records it;
- the programs or courses it applies to;
- the version of the documents decided on (this package: align-1-dev-adjudication-v2, built 2026-10-28);
- any conditions.

**Where it is recorded.** In the decision record under each policy question, or in `decision-and-approval-record.csv`, one row per decision. The data steward copies decisions exactly as recorded, and never completes or interprets one.

**What does not count as approval:** a draft or a recommendation in this package; a decision recorded without a role, a date and a reference; agreement between the reviewers and the software.

**Gates.** A step does not start until the decisions it needs are recorded:

| Gate | Decisions recorded first |
| --- | --- |
| Before Part A is sent to reviewers (step 1) | I1, I2, I5, I12, I15 |
| Before the panel decides the policy questions (step 4) | I3, I4, I6, I7, or a recorded decision to proceed without them |
| Before adjudication (step 6) | P1–P7, I8, I9 |
| Before approved references are recorded (step 7) | I10, I11 |
| Before any held-out run | I13 |
| Standing | I14 |

**If a decision is not made,** the step it gates does not start. Cases waiting on it stay Pending, and the report lists the missing decision.

## Notes

- **P1–P7** are set out in full, with options, in 01-academic-policy-questions.
- **I3 and I4** are needed before P3 and P6 can be settled on firm ground. If no description exists, P3 can still be decided (options A or B), but the references will rest on the names alone.
- **I5.** The nursing, education, accountancy and hospitality cases can still be reviewed as written. The reviewers are told that the cases are synthetic.
- **I8 and I9** affect scoring: a case with two accepted answers is scored differently from one with a single answer, and the choice must be recorded, not left to whoever converts the records.
- **I11** is separate from P5 and P6. It covers the general limits on what a proposed rewrite may change: level, subject, added content, removal.
- **I12** is needed before sending, because the forms collect a reviewer code and, if the institution asks, a name.
- **I13.** Faculty review of the held-out verdicts is the only way to make the final test meaningful. It must not expose those cases to the people who develop the software.
- **I15** does not presume that clearance or consent is needed. It asks the institution to decide, and to record the decision before any judgment is collected.
