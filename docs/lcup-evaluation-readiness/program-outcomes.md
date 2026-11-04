# Current Program Outcome verification

Read-only local database snapshot: 2026-10-28T15:34:17.323Z. Session read-only flag: 1. All 54 recorded data queries are SELECT. No faculty syllabus records were read and no database records were written. Source PDFs were verified by their existing SHA-256 hashes; raw wording/page evidence comes from the unchanged verified fixtures.

| Program | Current own / resolved POs | Inheritance | Complete PO12 |
|---|---|---|---|
| BSIT | 10 / 10 | Own stored set | Not applicable |
| BSIT-CYBERSECURITY | 10 / 10 | Own stored set | Not applicable |
| BSIE | 13 / 13 | Own stored set | false |
| BSCPE | 13 / 13 | Own stored set | false |

The BSIT seed has ten POs and exactly matches current database rows. `server/db/local-outcome-data.cjs` separately preserves the nine printed IT202 POs; that reference transcription does not replace the database master. Engineering transcriptions contain thirteen POs and mark PO12 sourceIncomplete; the current database resolver returns its text without that marker. The outcome-sharing code exists in `server/lib/programs.js`, but `program_outcome_sources` does not exist in this database. Cyber Security therefore resolves its own identical copy.

## it202: current database vs faculty reference

Database count: 10; PDF count: 9. Matching numbered text: 0/9.

| PO | PDF page(s) | Faculty reference wording | Current database wording at the same number | Exact match |
|---|---|---|---|---|
| 1 | 2 | Articulate and discuss the latest developments in the specific field of practice; | Apply computing and other knowledge domains to address realworld problems. | false |
| 2 | 2 | Effectively communicate orally and in writing using both English and Filipino; | Analyze complex problems and identify and define the computing requirements needed to design an appropriate solution. | false |
| 3 | 2 | Work effectively and independently in multi-disciplinary and multi-cultural teams; | Design and develop computing solutions using a system-level perspective. | false |
| 4 | 2 | Act in recognition of professional, social ethical responsibility; | Demonstrate ethical behavior as an IT Professional and sensitivity to the impact of technology in the society. | false |
| 5 | 2 | Preserve and promote “Filipino historical and cultural heritage; | Show Augustinian virtues/ethical values and the understanding and appreciation of corporate social responsibility. | false |
| 6 | 2 | Analyze complex problems, and identify and define the computing requirements needed to design and appropriate solution; | Work effectively and independently in multi-disciplinary and multi-cultural teams. | false |
| 7 | 3 | Apply computing and other knowledge domains to address real-world problems; | Understand the impact of their work on society and strive to ensure that their actions contribute positively on the community. | false |
| 8 | 3 | Design and develop computing solutions using a system-level perspective; | Articulate and discuss the latest developments in the specific field of practice. | false |
| 9 | 3 | Utilize modern computing tools. | Act in recognition of professional, social and ethical. | false |

Database PO10 has no numbered counterpart in IT202: “Demonstrate ethical leadership and social responsibility by integrating sustainability, inclusivity, mental well-being and peace-building principles into academic, professional and community engagements, ensuring holistic development and societal transformation.”

## ie402: current database vs faculty reference

Database count: 13; PDF count: 13. Matching numbered text: 13/13.

| PO | PDF page(s) | Faculty reference wording | Current database wording at the same number | Exact match |
|---|---|---|---|---|
| 1 | 2 | Ability to apply knowledge of mathematics and science to solve complex engineering problems; | Ability to apply knowledge of mathematics and science to solve complex engineering problems; | true |
| 2 | 2 | Ability to design and conduct experiments, as well as to analyze and interpret data; | Ability to design and conduct experiments, as well as to analyze and interpret data; | true |
| 3 | 2 | Ability to design a system, component, or process to meet desired needs within realistic constraints such as economic, environmental, social, political, ethical, health and safety, manufacturability and sustainability, in accordance with standards. | Ability to design a system, component, or process to meet desired needs within realistic constraints such as economic, environmental, social, political, ethical, health and safety, manufacturability and sustainability, in accordance with standards. | true |
| 4 | 3 | Ability to function on multidisciplinary teams | Ability to function on multidisciplinary teams | true |
| 5 | 3 | Ability to identify; formulate, and solve complex engineering problems; | Ability to identify; formulate, and solve complex engineering problems; | true |
| 6 | 3 | Understanding of professional and ethical responsibility. | Understanding of professional and ethical responsibility. | true |
| 7 | 3 | Ability to communicate effectively | Ability to communicate effectively | true |
| 8 | 3 | Broad education necessary to understand the impact of engineering solutions in a global, economic, environmental, and societal context. | Broad education necessary to understand the impact of engineering solutions in a global, economic, environmental, and societal context. | true |
| 9 | 3 | Recognition of the need for, and an ability to engage in life-long learning; | Recognition of the need for, and an ability to engage in life-long learning; | true |
| 10 | 3 | Knowledge of contemporary issues; | Knowledge of contemporary issues; | true |
| 11 | 3 | Ability to use techniques, skills and modern engineering tools necessary for engineering practice; and; | Ability to use techniques, skills and modern engineering tools necessary for engineering practice; and; | true |
| 12 | 3 | Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in | Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in | true |
| 13 | 3, 4 | Ability to design, develop, implement and improve integrated system that include people materials, implementation, equipment and energy. | Ability to design, develop, implement and improve integrated system that include people materials, implementation, equipment and energy. | true |

## cpe304: current database vs faculty reference

Database count: 13; PDF count: 13. Matching numbered text: 13/13.

| PO | PDF page(s) | Faculty reference wording | Current database wording at the same number | Exact match |
|---|---|---|---|---|
| 1 | 2 | Ability to apply knowledge of mathematics and science to solve complex engineering problems; | Ability to apply knowledge of mathematics and science to solve complex engineering problems; | true |
| 2 | 2 | Ability to design and conduct experiments, as well as to analyze and interpret data; | Ability to design and conduct experiments, as well as to analyze and interpret data; | true |
| 3 | 2 | Ability to design a system, component, or process to meet desired needs within realistic constraints such as economic, environmental, social, political, ethical, health and safety, manufacturability and sustainability, in accordance with standards. | Ability to design a system, component, or process to meet desired needs within realistic constraints such as economic, environmental, social, political, ethical, health and safety, manufacturability and sustainability, in accordance with standards. | true |
| 4 | 2 | Ability to function on multidisciplinary teams | Ability to function on multidisciplinary teams | true |
| 5 | 2 | Ability to identify; formulate, and solve complex engineering problems; | Ability to identify; formulate, and solve complex engineering problems; | true |
| 6 | 2 | Understanding of professional and ethical responsibility. | Understanding of professional and ethical responsibility. | true |
| 7 | 2 | Ability to communicate effectively | Ability to communicate effectively | true |
| 8 | 3 | Broad education necessary to understand the impact of engineering solutions in a global, economic, environmental, and societal context. | Broad education necessary to understand the impact of engineering solutions in a global, economic, environmental, and societal context. | true |
| 9 | 3 | Recognition of the need for, and an ability to engage in life-long learning; | Recognition of the need for, and an ability to engage in life-long learning; | true |
| 10 | 3 | Knowledge of contemporary issues; | Knowledge of contemporary issues; | true |
| 11 | 3 | Ability to use techniques, skills and modern engineering tools necessary for engineering practice; and | Ability to use techniques, skills and modern engineering tools necessary for engineering practice; and | true |
| 12 | 3 | Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in | Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in | true |
| 13 | 3 | Ability to design, develop, implement and improve integrated system that include people materials, implementation, equipment and energy. | Ability to design, develop, implement and improve integrated system that include people materials, implementation, equipment and energy. | true |

## Supporting engineering references

IE403 and CPE404 both give PO12 in full on PDF page3:

> Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in multidisciplinary environments.

Both current engineering database masters, IE402 p3 and CpE304 p3 end after “and in”. Full supporting wording was not adopted or substituted.

Beyond PO12, IE402 vs IE403 differs in punctuation at PO2/4/5/7/10/11; CpE304 vs CPE404 at PO4/7; the engineering baselines differ at PO11; the two supporting documents differ at PO2/5/7/10. The full unchanged comparison is in ../lcup-approved-offline/engineering-po-comparison.md. The remaining lexical wording agrees; there is still no independent PO–EGA crosswalk, and BSCpE PO13 applicability remains a decision.
