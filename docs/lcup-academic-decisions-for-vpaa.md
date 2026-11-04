# Decisions needed for the syllabus checker

**La Consolacion University Philippines · College of Information Technology and Engineering**

**Prepared:** 2026-10-28
**For:** the Office of the Vice President for Academic Affairs (VPAA), with the Dean of the College of Information Technology and Engineering, the Registrar and the LIC Director
**Status:** a draft for the system owner's review before it is sent. Nothing in the system has been changed while these decisions are pending.

---

## Why this document exists

**What the checker compares.** The syllabus checker compares each syllabus with the university's official records:
- the vision and mission;
- the Expected Graduate Attributes (EGAs);
- each program's Program Outcomes (POs);
- the registrar's curricula.

**What went wrong.** Some of these records are incomplete. Some disagree with each other, or with three syllabi that the VPAA has approved:
- IT 202 Computer Programming 1 (BSIT);
- IE-402 Systems Engineering (BSIE);
- CpE 304 Fundamentals of Mixed Signals and Sensors (BSCpE).

**What this document does.**
- The developers cannot decide which record is correct.
- This document lists the decisions needed and quotes the evidence exactly as it is recorded, spelling and punctuation included.
- It says what each answer would change in the checker.
- **It does not recommend any answer.**

**Where the details are.** The technical findings are in two reports in the system's repository: `docs/lcup-curriculum-reference-audit.md` and `docs/lcup-curriculum-audit-followup.md`. The codes in brackets, such as [L1], refer to them.

## How to respond

**For each decision:**
- tick an option, or write the official text;
- name the deciding office and give the date;
- attach or cite the source document.

**Partial answers are useful.** Leave blank anything not yet decided. A response table is at the end.

**What happens to the answers.** The system will be updated only through reviewed, versioned changes made after your answers. No approved syllabus will be altered.

## Summary

| # | Decision | Suggested decider | Why it is urgent |
|---|---|---|---|
| 1 | The official BSIT Program Outcomes and their numbering [L1] | VPAA with the Dean | Every PO tag in BSIT and Cyber Security syllabi depends on it |
| 2 | The complete BSIE and BSCpE Program Outcomes (PO 12, PO 13, shared list) [L2] | VPAA with the Dean | PO 12 is incomplete in the records and in the approved syllabi |
| 3 | Links between Program Outcomes and EGAs [L3, L14] | VPAA | A consistency check cannot run for BSIE and BSCpE |
| 4 | Cyber Security outcomes and curriculum cohorts [L4, L5, L11] | VPAA with the Dean and the Registrar | Decides how Cyber Security syllabi are checked |
| 5 | The current vision and mission [L15] | Office of the President or the VPAA | The approved syllabi and the system hold different texts |
| 6 | The current edition of the syllabus form PRE-VPAA-FO-001 [L16] | VPAA | The approved syllabi use reference groups the system does not have |
| 7 | Core values in each lesson week [L17] | VPAA | The checker lowers the score for each week without one |
| 8 | Learning outcomes in the learning plan [L18] | VPAA | The checker blocks syllabi with untagged ILOs |
| 9 | Curriculum year and school year [L19, L13, L6] | Registrar with the VPAA | Typing the school year makes the checker report "curriculum unavailable" |
| 10 | Titles, codes and prerequisites as written in syllabi [L7, L8, L20] | Registrar | The approved syllabi word some of them differently from the curriculum |
| 11 | Subjects with no prerequisite [L10] | Registrar | 83 curriculum cells are blank |
| 12 | MA 7 Differential Calculus in BSIE | Dean | The system's copy of its outcomes is empty |
| 13 | Verification of the curriculum records [L12, L9] | Registrar | No sign-off is recorded |
| 14 | Using the approved syllabi to test the checker [L21] | VPAA, with the authors' consent | Needed before any testing beyond this computer |
| F | Questions for the course faculty (F1–F10) | Dean, to pass on | Prepares correct test expectations; changes nothing in the system |

---

## A. Program Outcomes

### Decision 1 — The official BSIT Program Outcomes [L1]

**Question.** Which list of BSIT Program Outcomes is official, and in what numbering?

**What the records show**
- **The system holds 10 outcomes.** They were added to the system on 2026-10-13, copied from an institutional form that is not on file.
- **The approved IT 202 syllabus prints 9.**
- **An IT 204 syllabus template once tagged "PO 11" and "PO 14".** That suggests a third, longer list. The template is not on file.
- **Every outcome has a different number in the two lists,** as the table shows. Wording is quoted exactly.

| System no. | System text | IT 202 no. | IT 202 text (as printed) |
|---|---|---|---|
| 1 | Apply computing and other knowledge domains to address realworld problems. | 7 | Apply computing and other knowledge domains to address real-world problems; |
| 2 | Analyze complex problems and identify and define the computing requirements needed to design an appropriate solution. | 6 | Analyze complex problems, and identify and define the computing requirements needed to design and appropriate solution; |
| 3 | Design and develop computing solutions using a system-level perspective. | 8 | Design and develop computing solutions using a system-level perspective; |
| 4 | Demonstrate ethical behavior as an IT Professional and sensitivity to the impact of technology in the society. | — | (not in the IT 202 list) |
| 5 | Show Augustinian virtues/ethical values and the understanding and appreciation of corporate social responsibility. | — | (not in the IT 202 list) |
| 6 | Work effectively and independently in multi-disciplinary and multi-cultural teams. | 3 | Work effectively and independently in multi-disciplinary and multi-cultural teams; |
| 7 | Understand the impact of their work on society and strive to ensure that their actions contribute positively on the community. | — | (not in the IT 202 list) |
| 8 | Articulate and discuss the latest developments in the specific field of practice. | 1 | Articulate and discuss the latest developments in the specific field of practice; |
| 9 | Act in recognition of professional, social and ethical. | 4 | Act in recognition of professional, social ethical responsibility; |
| 10 | Demonstrate ethical leadership and social responsibility by integrating sustainability, inclusivity, mental well-being and peace-building principles into academic, professional and community engagements, ensuring holistic development and societal transformation. | — | (not in the IT 202 list) |
| — | (not in the system) | 2 | Effectively communicate orally and in writing using both English and Filipino; |
| — | (not in the system) | 5 | Preserve and promote “Filipino historical and cultural heritage; |
| — | (not in the system) | 9 | Utilize modern computing tools. |

**Why it matters**
- **A CLO's PO tag is only a number.** In the IT 202 syllabus, "PO 1" means "Articulate and discuss the latest developments…". In the system, "PO 1" means "Apply computing and other knowledge domains…".
- **All 19 PO tags in the approved IT 202 syllabus point to a different outcome** when read against the system's list.
- **The checker cannot notice this,** because it only checks that each number exists.
- **Cyber Security syllabi use the BSIT list too** (Decision 4).

**Also note**
- System PO 9 ends without a noun and may be cut off.
- System PO 1 spells "realworld".
- IT 202's PO 5 opens a quotation mark that is never closed.

**Options** (none is recommended)
- ☐ The system's 10 outcomes, as worded.
- ☐ The system's 10 outcomes, with corrected wording (please give it).
- ☐ The 9 outcomes printed in the IT 202 syllabus.
- ☐ Another official list (please attach).

**Also, please answer:** must syllabi use this numbering? Should existing BSIT syllabi be re-checked against it?

**What each answer changes**
- **The system's list:** IT 202's tags must be re-mapped by its author (question F1), and PO 9's full wording supplied.
- **Any other list:** the system's list is replaced through a recorded, versioned change, and existing BSIT and Cyber Security syllabi are asked to update their tags.

### Decision 2 — The BSIE and BSCpE Program Outcomes [L2]

**What the records show**
- **The same 13 outcomes in both programs.** The approved IE-402 and CpE 304 syllabi print the same list, which is also what the system holds for both programs (it was copied from these two syllabi).
- **One difference:** PO 11 ends "and;" in IE-402 and "and" in CpE 304.
- **PO 12 stops in the middle of a sentence** in both approved syllabi.

| PO | Text, as printed in the approved syllabi |
|---|---|
| 1 | Ability to apply knowledge of mathematics and science to solve complex engineering problems; |
| 2 | Ability to design and conduct experiments, as well as to analyze and interpret data; |
| 3 | Ability to design a system, component, or process to meet desired needs within realistic constraints such as economic, environmental, social, political, ethical, health and safety, manufacturability and sustainability, in accordance with standards. |
| 4 | Ability to function on multidisciplinary teams |
| 5 | Ability to identify; formulate, and solve complex engineering problems; |
| 6 | Understanding of professional and ethical responsibility. |
| 7 | Ability to communicate effectively |
| 8 | Broad education necessary to understand the impact of engineering solutions in a global, economic, environmental, and societal context. |
| 9 | Recognition of the need for, and an ability to engage in life-long learning; |
| 10 | Knowledge of contemporary issues; |
| 11 | Ability to use techniques, skills and modern engineering tools necessary for engineering practice; and; *(IE-402)* / … engineering practice; and *(CpE 304)* |
| 12 | Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in |
| 13 | Ability to design, develop, implement and improve integrated system that include people materials, implementation, equipment and energy. |

**Questions**
- **2a.** What is the complete, official text of PO 12? The system will not complete it on its own.
- **2b.** Do BSIE and BSCpE share one list of outcomes, or does each program have its own?
- **2c.** Does PO 13 belong to BSCpE?
- **2d.** What is the official wording of PO 11's ending?

**What the answers change**
- The system will use the confirmed wording.
- Syllabi that carry the old text will be asked to update it.
- Until 2a is answered, any judgement of a CLO against PO 12 is made on an incomplete sentence. The approved CpE 304 syllabus tags its CLO2 with PO 12.

### Decision 3 — Links between Program Outcomes and EGAs [L3, L14]

The four EGAs are "Critical and Creative thinker", "Competent Catholic Augustinian-Marian Professional", "Socially Responsive Steward" and "Transformative Lifelong learner".

**What the records show**
- **BSIE and BSCpE: no PO–EGA links exist.** None of the three approved syllabi contains such a table; they list EGAs, POs and CLOs in separate columns.
- **BSIT: the system holds the links below.** Their source document is not on file.

| BSIT PO (system numbering) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Linked EGA(s) | 1 | 1 | 1 | 2 | 2 | 4 | 3 | 1, 4 | 2 | 3 |

**Questions**
- **3a.** Please provide the PO–EGA links for BSIE and BSCpE, or state that none are defined. A blank grid is in the response section.
- **3b.** Please confirm or correct the BSIT links, after Decision 1.
- **3c.** Optional: are there official descriptions of the four EGAs? Only their names are on file.

**What the answers change**
- The checker can verify that a CLO tagged with a PO also names that PO's EGA.
- For BSIE and BSCpE this check currently cannot run, and it is reported as passed.

### Decision 4 — Cyber Security outcomes and curriculum cohorts [L4, L5, L11]

**What the records show**
- **The curriculum.** The registrar's 2025–2026 printout for BS Information Technology with Specialization in Cyber Security lists 61 subjects. It shares only 23 identical rows with BSIT 2022–2023.
- **The outcomes.** The system holds a copy of the BSIT outcomes for Cyber Security, identical today.

**Questions**
- **4a.** Does Cyber Security use the BSIT Program Outcomes and EGAs (as settled in Decision 1), or outcomes of its own?
- **4b.** Is the 2025–2026 printout the official Cyber Security curriculum, and which entering classes follow it? Do earlier Cyber Security students follow BSIT 2022–2023?
- **4c.** Please confirm these features of the 2025–2026 printout:
  - it has no GE electives (KOMFIL, DL, SOSLIT);
  - there is no CS-305 or CS-306;
  - IT-ELEC1- has 0 lecture units and 1 laboratory unit (BSIT's IT-ELEC1 has 2 and 1).

**What the answers change**
- **If the answer to 4a is BSIT's outcomes,** Cyber Security will follow every BSIT outcome change automatically. Its subjects still come from its own curriculum.
- **If 4b says some cohorts follow BSIT 2022–2023,** a second Cyber Security curriculum record is needed.

---

## B. Institutional statements

### Decision 5 — The current vision and mission [L15]

**What the records show.** The three approved syllabi print the same vision and mission lead as each other, and both differ from the text the system holds.

**Vision**

| | Text |
|---|---|
| Approved syllabi | Moved by the Spirit of the Risen Christ, La Consolacion University Philippines, envisions itself to become a catalyst for the wholistic transformational development of Catholic Augustinian Marian graduates rooted in Gospel values. |
| System | Moved by the Spirit of the Risen Christ, La Consolacion University Philippines, rooted in Gospel values as a Catholic Augustinian-Marian institution, envisions to become a catalyst for the holistic transformation of all persons and communities. |

**Mission: opening sentence**

| | Text |
|---|---|
| Approved syllabi | To achieve the above vision, LCUP commits itself to generate and make available to its Augustinian Marian students, programs and services that will make them: |
| System | LCUP commits to generate and make available to all persons and communities’ programs and services that will enable them to: |

**Mission: items**
- **IT 202 and IE-402** print the same five items as the system, in the same order. Only the last item's final period is missing.
- **CpE 304 prints six items, in a different order:**
  1. exhibit academic and technical competence in their respective areas of discipline in the local and international environment;
  2. demonstrate their knowledge, critical thinking and creativity by exploring the various avenues of learning and searching for truth;
  3. live the Gospel values in the varied aspects of their personal and professional lives;
  4. manifest their willingness to serve specially the marginalized sector of our society;
  5. demonstrate productivity in various areas of learning as responsible citizens of the society; and
  6. develop individuals who are resilient, inclusive and responsive to be socio-economic realities of the Philippines and the complexities of the global environment.

**Questions**
- **5a.** Which vision text is current?
- **5b.** Which mission text is current: the opening sentence and the items?
- **5c.** Is CpE 304's six-item mission an approved revision?
- **5d.** Must every syllabus reproduce the current text exactly?

**What the answers change.** The checker requires the exact current text. Today it would reject the text printed in all three approved syllabi.

---

## C. The syllabus form

### Decision 6 — The current edition of form PRE-VPAA-FO-001 [L16]

**Differences found**

| Item | Approved syllabi | System form |
|---|---|---|
| Reference groups (section IX) | IT 202: A. BOOKS, B. INTERNET REFERENCES, C. JOURNALS, D. ELECTRONICS. IE-402: A–C only. CpE 304: only "A. INTERNET REFERENCES" | A. Books, B. Internet Programming, C. Internet References, D. Electronics |
| Learning-plan column heading | "COURSE CONTENTS" (IT 202, IE-402); "LEARNING CONTENTS" (CpE 304) | — |
| Campus header | IE-402: "(formerly University of Regina Carmeli) Catmon, City of Malolos". IT 202 and CpE 304: "Valenzuela St., Capitol View Park Subdivision, Bulihan, City of Malolos, Bulacan" | — |

**Questions**
- **6a.** Which edition of the form is current?
- **6b.** Which reference groups must a syllabus have, in what order?
- **6c.** Must an empty group be marked "N/A"?

**What the answers change.** Today the checker blocks all three approved syllabi until the groups they lack are marked "N/A". It has no place for "Journals".

### Decision 7 — Core values in each lesson week [L17]

**Question.** Must every lesson week name at least one of the six core values: Compassion, Courage, Community-orientedness, Humility, Interiority and Missionary Spirit? Or are other values acceptable in their place?

**What the approved syllabi show**

| Syllabus | Lesson weeks naming a core value | Examples of the values named instead |
|---|---|---|
| IT 202 | 9 of 10 | weeks 4-5: Understanding, Exactness, Patience, Critical Thinking, Appreciation |
| IE-402 | 2 of 6 | weeks 15-17: Skills and Competencies, Critical Thinking, Honesty |
| CpE 304 | 0 of 8 | Cooperation, Understanding, Critical Thinking, Active participation and involvement; week 1: Understanding, Open Mindedness, Respect, Obedience |

**What the answer changes.** The checker currently deducts 1 point for each lesson week without a core value.

### Decision 8 — Learning outcomes in the learning plan [L18]

**Questions**
- **8a.** Must every intended learning outcome (ILO) name the course learning outcome (CLO) it builds?
- **8b.** Must every lesson week have at least one ILO?
- **8c.** Must every CLO be built by at least one ILO, and assessed?

**What the approved syllabi show**
- **IT 202:**
  - three ILOs name no CLO;
  - an unlabelled value-webbing sentence names none either;
  - CLO4 is built by no ILO.
- **IE-402:** every ILO names its CLOs, and every CLO is built.
- **CpE 304:**
  - week 1 has no ILO;
  - from week 7 to week 17, none of the eleven ILOs names a CLO;
  - CLO3 and CLO4 are built by no ILO.

**What the answers change**
- Today, 8a and 8b block a submission.
- 8c lowers the score.

---

## D. Curriculum identity

### Decision 9 — Curriculum year and school year [L19, L13, L6]

**What the records show**
- **The form and the system ask for different years.** The form prints "SCHOOL YEAR 2025-2026". The system asks for the "curriculum year" (for example "2022-2023") so that it can find the right curriculum.
- **The consequence.** A faculty member who types the school year is told that the official curriculum is unavailable.
- **The curriculum records on file:**
  - BSIT 2022–2023;
  - BSIE 2022–2023;
  - BSCpE 2022–2023;
  - Cyber Security 2025–2026.

**Questions**
- **9a.** Should a syllabus state the curriculum version, the school year, or both?
- **9b.** In what format should the curriculum year be written?
- **9c.** In SY 2025-2026, which curriculum do these classes follow:
  - IT 202 (BSIT, Year 2);
  - IE-402 (BSIE, Year 4);
  - CpE 304 (BSCpE, Year 3)?
- **9d.** Is any other curriculum version in force that the system does not have?

### Decision 10 — Titles, codes and prerequisites as written in syllabi [L7, L8, L20]

**The three approved syllabi against the registrar's curricula**

| | Approved syllabus | Registrar's curriculum |
|---|---|---|
| IT 202 title | Computer Programming 1 | COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING) |
| IE-402 title | Systems Engineering | SYSTEMS ENGINEERING |
| CpE 304 title | Fundamentals of Mixed Signals and Sensors | FUNDAMENTALS OF MIXED SIGNAL AND SENSORS (stored by the system as "…SIGNALS…") |
| CpE 304 code | CpE 304 | CpE-304 |
| IE-402 prerequisite | 4th Year Standing | 4th Yr |

**Spellings stored in corrected form** (the registrar prints otherwise)
- **KOMFIL (BSIT, BSIE, BSCpE):** printed "KONTESTWALISADONG KOMUNIKASYON SA FILIPINO"; stored "KONTEKSTWALISADONG …".
- **Cyber Security IT-204-:** printed "QUANTITATTIVE METHODS (INCLUDING MODELING AND SIMULATION)"; stored "QUANTITATIVE …".
- **Cyber Security IT-210:** printed "SOCIAL AND PROFERSSIONAL ISSUES"; stored "SOCIAL AND PROFESSIONAL ISSUES".

**Titles stored as printed that may be typing errors**
- "MATHEMATIC IN THE MODERN WORLD"
- "INTERNET TO THINGS (IoT)"
- "PHYTON"
- "DATA STRUCTURE AND ALGORITHM"
- "INFORMATION MANAGEMENT 1 (DATABASE FUNDAMENTAL)"
- "COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING)"
- "IT ELECTIVE 2(MOBILE APPLICATION DEVELOPMENT)"
- "Engineering Mechanics"

**Code forms**
- **Eleven Cyber Security codes end in a hyphen:** IT 102-, IT 103-, IT-204-, IT 205-, IT 206-, IT 207-, IT 208-, IT 209-, IT-ELEC1-, IT-307- and IS-.
- **Forms are mixed within one curriculum:** "IT 202" and "IT-204"; "CpE 301" and "CpE-300"; "COE 7".

**Questions**
- **10a.** Which spelling of each title above is official?
- **10b.** Which form of each code is official?
- **10c.** Must a syllabus reproduce the registrar's title, code and prerequisite exactly, or are equivalents accepted? Examples: a different letter case, "4th Year Standing" for "4th Yr", "CpE 304" for "CpE-304".

**What the answers change.** The syllabus builder fills in the code and title from the system's records, so faculty do not retype them. The answers decide which wording those records hold, and whether a syllabus that prints a variant is accepted.

### Decision 11 — Subjects with no prerequisite [L10]

**What the records show**
- **Blank cells.** The registrar's curricula leave 83 prerequisite cells blank: BSIT 19, BSIE 24, BSCpE 22 and Cyber Security 18.
- **What the system requires.** For these subjects it currently requires the sentence "Not specified in the source curriculum (blank prerequisite cell)."
- **What fails.** "None", "N/A" and an empty field are all rejected.

**Questions**
- **11a.** Does a blank cell mean "no prerequisite"?
- **11b.** What should a syllabus write in that case?

### Decision 12 — MA 7 Differential Calculus in BSIE

**What the records show**
- **The BSIE copy is empty.** The system's copy of the institutional and program texts for BSIE's MA 7 has no vision, mission, EGAs or POs.
- **The BSCpE copy is complete.**
- **No new outcomes are needed.** The BSIE Program Outcomes exist and are already what the checker uses for BSIE syllabi.
- **One MA 7 syllabus is "for revision".** Whether its outcomes are blank has not been checked.

**Question.** Please confirm that an MA 7 syllabus in BSIE is aligned with the BSIE Program Outcomes. The system administrator can then refill the copy, under separate authorization.

### Decision 13 — Verification of the curriculum records [L12, L9]

**What the records show**
- **Source.** The four curriculum records were entered from the registrar's printouts dated 20/10/2026.
- **Checking.** The development team checked them line by line against those printouts. All 243 rows match, apart from the spellings listed in Decision 10.
- **No sign-off.** No registrar sign-off is recorded.

**Questions**
- **13a.** Who verifies and signs off each curriculum record, and when?
- **13b.** Please confirm these printed prerequisites, which look unusual:
  - **BSIE:** IE 302 requires "IE 301, STATIE2", and ERGO 1 requires "IE 301". All three subjects are in Year 3, 2nd Semester, so IE 301 cannot be completed first.
  - **BSIE:** COMPRO (Computer Fundamentals and Programming) requires PHYENG.
  - **BSCpE:** CpE-305 OPERATING SYSTEM requires ENGDA (Engineering Data Analysis).
  - **Cyber Security:** IT-203 (Computer Networks 1) requires IT 104 (Data Structure and Algorithm). BSIT's course of the same title requires IT 101.
  - **Cyber Security:** "IS- INTEGRATING SEMINAR" has a blank prerequisite. BSIT prints IS-CITE ← 4th Yr.

---

## E. Testing

### Decision 14 — Using the approved syllabi to test the checker [L21]

**Why the question arises.**
- The three approved syllabi are the best real material available for testing the checker.
- They name their faculty authors and the officials who signed them.
- **Until this decision is made, they are used only on the university's own computer, offline.** Nothing from them is sent to any outside service.

**Questions**
- **14a.** May the three approved syllabi be used, on the university's own computers, to test the checker?
- **14b.** May their text ever be sent to an external AI service, with names and the sign-off block removed?
- **14c.** Whose consent is needed: the authors', the Dean's, the VPAA's?

**Two points to note**
- **Approval is not a verdict on each link.** The tests will not assume that every CLO–PO or CLO–EGA link in an approved syllabus is correct merely because the syllabus was approved.
- **Faculty make the expected judgements.** Faculty of the discipline other than the author will be asked to give them.

---

## F. Questions for the course faculty (please pass these on)

**What these questions are for**
- They concern the content of the three approved syllabi, and the documents themselves will not be changed.
- The answers help prepare correct test expectations. Please answer as the authors intended.

**IT 202 Computer Programming 1**
- **F1.** Which list of Program Outcomes were the CLO tags written against (Decision 1)? If the system's list of ten becomes official, which numbers apply to each CLO?
- **F2.** Which CLO does each of these build?
  - weeks 4-5: "ILO 2 Acquire the necessary skills and understanding of java methods."
  - weeks 9-11: "ILO2. Inference the structured programming concepts aCLOng with the Java syntax to implement them."
  - week 13: "ILO6: Synthesize skills in De-bugging Java Language program."
  - weeks 16-17: "Demonstrate the Filipino-Catholic Augustinian Spirituality through value webbing."

  And which ILO builds CLO4?
- **F3.** Week 4 appears in two rows, "Week 3-4" and "Week 4-5". Is that intended?
- **F4.** The week 15 machine problem reads "Hands-on exercises using C programs" in a Java course. Is that intended?

**IE-402 Systems Engineering**
- **F5.** CLO 4 ("Demonstrate the Filipino-Catholic Augustinian Spirituality through value webbing.") is tagged "[EGA 2] [PO 4,5]", exactly as in IT 202.
  - In the engineering list, PO 4 is "Ability to function on multidisciplinary teams" and PO 5 is "Ability to identify; formulate, and solve complex engineering problems;". Are these the intended outcomes?
  - CLO 4 is also tagged by ILO6–ILO14 and by the final examination row. Is that intended?
- **F6.** ILO10 is used for two different outcomes: week 1 (value webbing) and weeks 12-14 ("Evaluate essential management considerations…"). Is that intended?
- **F7** (with the LIC Director). Do these references support Systems Engineering?
  - "Ethics in information technology: a practical guide";
  - "Future skills: the 20 skills and competencies everyone needs to succeed in a digital world";
  - "Introduction to digital media";
  - MIT OpenCourseWare "Introduction to Design Computing";
  - three computing journal articles.

**CpE 304 Fundamentals of Mixed Signals and Sensors**
- **F8.** Learning outcomes in the plan:
  - Which CLO does each ILO in weeks 7 to 17 build?
  - Which ILO applies to week 1?
  - Which ILOs build CLO3 and CLO4?
  - ILO numbers repeat and skip: ILO1 and ILO2 are reused with different texts, and ILO3 and ILO5 do not appear. Is that intended?
- **F9.** Other points:
  - **Requirements.** "Compilation of Laboratory Activity Reports" and "Project" are listed for a course of 3 lecture units. Is that intended?
  - **References** (with the LIC Director). There are four preprints from arXiv, one from 2013. Is that acceptable?
  - **Grading.** Item "4." of the grading system is empty.
  - **Preliminary Examination.** The row says the topics were "discussed during the Mid Term".
  - **Week 12.** The values and assessment cells appear swapped.

**All three**
- **F10.** Please confirm how these tags should be read:
  - CpE 304 CLO2 "PO6. PO7" means PO 6 and PO 7;
  - IE-402 CLO 3 "PO 2, 3. 5, 6,7" means PO 2, 3, 5, 6 and 7;
  - IT 202 ranges such as "CLO 1-2" mean CLO 1 and CLO 2.

---

## Response record

| Decision | Answer (option, or official text attached) | Decided by (office) | Date | Source document |
|---|---|---|---|---|
| 1 BSIT Program Outcomes | | | | |
| 2a PO 12 full text | | | | |
| 2b–2d BSIE/BSCpE lists, PO 13, PO 11 | | | | |
| 3a BSIE/BSCpE PO–EGA links | | | | |
| 3b BSIT PO–EGA links | | | | |
| 3c EGA descriptions | | | | |
| 4a–4c Cyber Security | | | | |
| 5 Vision and mission | | | | |
| 6 Form edition | | | | |
| 7 Core values per week | | | | |
| 8 Learning outcomes in the plan | | | | |
| 9 Curriculum and school year | | | | |
| 10 Titles, codes, prerequisites | | | | |
| 11 No prerequisite | | | | |
| 12 MA 7 (BSIE) | | | | |
| 13 Curriculum verification | | | | |
| 14 Use of approved syllabi | | | | |
| F1–F10 Faculty answers | | | | |

**PO–EGA grid for BSIE and BSCpE (Decision 3a).** Mark each EGA that a PO supports. Use one grid per program if the lists differ.

| PO | EGA 1 | EGA 2 | EGA 3 | EGA 4 |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |
| 13 | | | | |
