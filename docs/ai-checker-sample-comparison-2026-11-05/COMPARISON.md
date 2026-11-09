# AI Checker sample comparison

Date: 5 November 2026 (Asia/Shanghai).

**Observed result:** useful corrections, with mixed effects when accepted together. The same model rated 52 relationships better, 7 worse and 84 unchanged. Fully aligned relationships rose from 11 to 52. The revised copy remains experimental: 32 suggestions and 12 blocking findings remain.

## What was tested

- Repository sample: IT 202 - Computer Programming 1, BSIT, imported from `reference-data/IT-202-Programming-1.pdf` using the application importer and the existing real-syllabus fixture loader.
- Live provider/model: anthropic / claude-sonnet-5-5. Every deeper optional stage and Policy V2 stayed off, as in the current configuration.
- The original produced 61 suggestions. 58 AI text rewrites were applied together to a temporary JSON copy and the actual checker re-evaluated it. No Check & Improve approval is implied by this batch experiment.
- Two exact-reference corrections and one array-valued description rewrite were excluded from the experimental copy. All proposals remain in `attempt-2/suggestions.json`.
- Link accessibility was checked once through the application code and reused for both versions. The model transport used the existing cost guard and spend register.
- The test loaded no application database modules and saved no official score, syllabus, submission or approval.
- The source PDF is unchanged (SHA-256 6376fe94981ae65f25054234e1ae63cd50be8f70f12b774ea72949e07d561845; verified after the run: true).

**Scope of the original:** Application PDF import into a fixture-backed builder document; catalog code/year and institutional outcomes come from local reference transcriptions. Some untouched template fields may be defaults. Not an audit of the original PDF as a complete document.

## Comparison measured by the same model

Both runs: original completed; revised completed. These are model judgments, not faculty-validated quality measurements.

| Measure | Original | Revised |
|---|---:|---:|
| Relationships with validated answers | 143/143 | 143/143 |
| ALIGNED | 11 | 52 |
| PARTIALLY_ALIGNED | 107 | 73 |
| NOT_ALIGNED | 25 | 18 |
| INSUFFICIENT_EVIDENCE | 0 | 0 |
| UNVERIFIED | 0 | 0 |
| Deterministic baseline | 96 | 96 |
| Diagnostic arithmetic (not an official grade) | 0 | 54 |
| Blocking findings in imported draft | 12 | 12 |

On 143 comparable relationship IDs: **52 improved, 7 worsened, 84 unchanged**. Added IDs: 0; removed IDs: 0. Changed CLO context can change judgments throughout the course.

A zero diagnostic result is the floor after accumulated deductions. Scores here are affected by imported metadata, blocking findings and the current scoring design; neither a score nor model agreement establishes academic validity.

## Review of representative suggestions

The comments below are an independent reading by the coding assistant, not a faculty review. Exact source text and proposed text for every experimental edit appear in the appendix.

| Field | What the checker suggested | Review |
|---|---|---|
| Week 15 assessment | Replace C-program exercises with Java methods, parameter and recursion tasks, and specify output criteria. | Useful correction of a mismatch verified visually on PDF page 7. The proposal still needs an explicit debugging task to assess the debugging ILO; the new wording alone does not cover every ILO. |
| Weeks 4-5 assessment | Replace the system-unit hardware simulation with a Java stream/file-processing program and a rubric. | More relevant to the existing stream ILO, but it adds file I/O requirements. The instructor must confirm the intended scope and available time. Original wording verified visually on PDF page 5. |
| Weeks 3-4 ILO 1 | Replace “Demonstrate the skills by knowing...” with analyzing requirements and identifying Java constructs needed to meet them. | More observable and specific; it also expands the original expectation to requirements analysis. |
| Weeks 4-5 values | Replace a list of traits with observable examples of help, reflection and community participation. | More actionable integration. Confirm that the named activities actually happen and that the wording follows institutional guidance. |
| CLO 1 | Add “creatively design original Java-based solutions.” | Raises the expected cognitive level from defining/analyzing toward creating. This is a curriculum decision and can cause downstream alignment problems. Do not accept solely to satisfy a tag. |
| Weeks 16-17 activity | Add group creation and presentation of a value web tied to the database program. | Makes the spirituality outcome visible, but adds workload and a presentation. Faculty must decide whether these belong in the lesson. |

## Import issue found during source verification

The source PDF page 1 says prerequisite **IT 101**. The imported JSON instead contains **IT 202 - Programming 1**. The local curriculum reference agrees with IT 101. The experiment preserved the imported draft so the before/after AI comparison stayed reproducible; this import error was not repaired during the run.

Consequently, prerequisite warnings are evidence of an import problem, not proof of an author mistake. Other extracted text should also be verified before making academic decisions.

## Relationships that worsened

Two concrete tradeoffs deserve attention: the weeks 4-5 activities became entirely stream-focused and lost coverage of Java methods; the week 13 assessment became debugging-focused and lost direct array creation/manipulation evidence. These are shared fields supporting multiple ILOs. A replacement that fixes one relationship can weaken another. Changes to other fields and model variability also affect this comparison, so these results do not isolate each edit as the sole cause.

- **clo0-po1 (CLO-PO)**: PARTIALLY_ALIGNED -> NOT_ALIGNED. The PO asks to articulate and discuss (Understand/Analyze) the latest developments in the field. The CLO is about analyzing requirements and designing Java solutions. It has no verb of articulating or discussing, and nothing about current developments or trends in computing. It only shares the general computing field.
- **row3-ilo1-activity (ILO-activity)**: PARTIALLY_ALIGNED -> NOT_ALIGNED. Every activity is about Java streams. None has students define, call or explain Java methods, so the ILO's subject is not practised.
- **row3-ilo2-activity (ILO-activity)**: ALIGNED -> PARTIALLY_ALIGNED. The laboratory has students write Java programs, which practises applying Java. No activity has students work with a classmate, and none uses a community-related problem. The activities are also framed around streams rather than the wider syntax and semantics.
- **row8-ilo0-assessment (ILO-assessment)**: ALIGNED -> PARTIALLY_ALIGNED. The tasks are about error types and debugging. Array programs appear only as programs to debug, so no task has students declare, initialize or process arrays themselves. No task asks students to analyze data storage requirements. The recitation has no stated focus.
- **row8-ilo1-content (ILO-content)**: PARTIALLY_ALIGNED -> NOT_ALIGNED. The ILO is about synthesizing debugging skills. The contents are only array syntax and processing. They teach no error types, debugging techniques or worked debugging examples, and they do not reach a Create-level synthesis.
- **row9-ilo0-activity (ILO-activity)**: ALIGNED -> PARTIALLY_ALIGNED. The activities are mostly about debugging faulty String programs, which touches string methods. No activity has students analyze a text-processing requirement. No activity has students write programs that choose and apply string methods to meet a requirement. The quiz is unspecified.
- **row10-ilo1-clo:real-prog1-3 (ILO-CLO)**: PARTIALLY_ALIGNED -> NOT_ALIGNED. The CLO asks for ethical standards and social responsibility in technical designs. ILO5 only asks for robust console applications that meet requirements. Ethics, social responsibility, the common good and Marian/Augustinian principles are all missing, so the ILO is not a smaller step of this CLO.

## Remaining blocking findings

- T-13:plan[3].ilos[1]: Week 4-5, ILO2 has no CLO tag.
- T-13:plan[6].ilos[1]: Week 9-11, ILO2 has no CLO tag.
- T-13:plan[8].ilos[1]: Week 13, ILO2 has no CLO tag.
- T-13:plan[11].ilos[1]: Week 16-17, ILO2 has no CLO tag.
- T-21:refs.program: References (B. Internet Programming) has no entries and is not marked not applicable.
- CUR-FIELD:meta.title: title differs from the official curriculum.
- CUR-FIELD:meta.prereq: prereq differs from the official curriculum.
- ILO-MAP:plan[3].ilos[1].tags: Map every lesson ILO to at least one existing CLO without duplicate mappings.
- ILO-MAP:plan[6].ilos[1].tags: Map every lesson ILO to at least one existing CLO without duplicate mappings.
- ILO-MAP:plan[8].ilos[1].tags: Map every lesson ILO to at least one existing CLO without duplicate mappings.
- ILO-MAP:plan[11].ilos[1].tags: Map every lesson ILO to at least one existing CLO without duplicate mappings.
- WEEK-DUP:plan[3].week: Weeks 4 are assigned more than once.

These flags describe the imported draft. Metadata, reference-group and mapping flags need source verification and faculty decisions rather than blind text substitution.

## Recommended use after this experiment

1. Fix or verify imported prerequisites and other source fields before interpreting checker findings.
2. Select useful edits individually and use Check & Improve, especially for activities and assessments shared by multiple ILOs. This experiment tested the batch of offered drafts; it did not execute the individual Check & Improve workflow.
3. Confirm CLO level, added file-I/O topics, group presentations and other workload changes with faculty. Where an existing outcome is sound but its tag is wrong, consider correcting the mapping rather than expanding the outcome.
4. Have faculty compare original and revised text using the same rubric. This single model self-comparison supports usefulness for revision, not a measured accuracy rate or a production approval.

## Cost and execution evidence

Successful run: 22 model requests; token-based estimated cost **$1.2415**, using the repository's pinned prices. This is a local estimate, not a provider invoice.
Total guard accounting including the initial failed sandbox network attempt: **$1.4794**, below the $2 comparison limit. The failed attempt returned no usage; its $0.2301 guard entry is a conservative worst-case reservation and does not demonstrate a billed charge.

Artifacts: `attempt-2/original.json`, `revised.json`, `original-report.json`, `revised-report.json`, `suggestions.json`, `edits.json`, `link-results.json`, `provider-ledger.json`, `comparison-metrics.json` and `result.json`. The parent result/ledger preserve the failed first attempt.

## Exact before/after text for all experimental edits

### 1. clos[0].statement

**Original**

```text
Define and analyze the computing requirements needed for an effective solution that is essential for developing holistic and impactful solutions.
```

**Checker suggestion**

```text
Analyze and define the computing requirements needed for an effective solution, and creatively design original Java-based solutions that are holistic and impactful.
```

Related model verdicts: clo0-anyega: PARTIALLY_ALIGNED -> ALIGNED; clo0-ega1: PARTIALLY_ALIGNED -> ALIGNED; clo0-ega3: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; clo0-ega4: NOT_ALIGNED -> NOT_ALIGNED

### 2. clos[3].statement

**Original**

```text
Demonstrate the Filipino- Catholic Augustinian Spirituality through value webbing.
```

**Checker suggestion**

```text
Act in recognition of professional, social and ethical responsibility by demonstrating Filipino-Catholic Augustinian Spirituality through value webbing applied to decisions made in Java programming solutions.
```

Related model verdicts: clo3-anypo: PARTIALLY_ALIGNED -> ALIGNED; clo3-anyega: PARTIALLY_ALIGNED -> ALIGNED; clo3-po4: PARTIALLY_ALIGNED -> ALIGNED; clo3-po5: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; clo3-ega2: PARTIALLY_ALIGNED -> ALIGNED

### 3. plan[0].ilos[0].text

**Original**

```text
ILO 1: Demonstrate a clear understanding of the course structure, expectations, and key programming concepts in Java, including how these skills align with real- world IT challenges and professional ethical standards.
```

**Checker suggestion**

```text
ILO 1: Explain the course structure and expectations and identify the computing requirements of a simple real-world IT problem that Java programming can address, citing professional ethical standards.
```

Related model verdicts: row0-ilo0-clo:real-prog1-2: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 4. plan[0].contents

**Original**

```text
I. Orientation
A. Introduction to the Course Contents
B. Course Requirements and Activities
C. Course Objectives Grading System and Policies on Absences, Tardiness and Examinations
```

**Checker suggestion**

```text
I. Orientation
A. Introduction to the Course Contents and Course Requirements and Activities
B. Course Objectives, Grading System and Policies on Absences, Tardiness and Examinations
C. Overview of key Java programming concepts (program, source code, compiler, variables, control structures)
D. How programming skills address real-world IT challenges
E. Professional ethical standards in programming
```

Related model verdicts: row0-ilo0-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 5. plan[0].activities

**Original**

```text
• Setting and sharing of Expectations from the Course
• Discussion on the Vision, Mission and Goals of LCUP and of CITE
• Presentation of Course Objectives and Contents, Course Requirements and Activities Review of Policies on Absences, Tardiness,
Examinations, Grading System
```

**Checker suggestion**

```text
• Setting and sharing of Expectations from the Course
• Discussion on the Vision, Mission and Goals of LCUP and of CITE
• Presentation of Course Objectives and Contents, Course Requirements and Activities, and Review of Policies on Absences, Tardiness, Examinations and Grading System
• Short guided discussion where students explain, in their own words, what Java is used for and how programming addresses real-world IT challenges
• Small-group discussion of a case on professional ethical standards in programming
```

Related model verdicts: row0-ilo0-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 6. plan[0].tasks

**Original**

```text
• Statement of Expectations
• Review of Course Contents, Objectives, Activities and Assessment Tools
• Review of Policies on Absences, Tardiness, Examinations, Grading System
```

**Checker suggestion**

```text
• Statement of Expectations
• Review of Course Contents, Objectives, Activities and Assessment Tools
• Review of Policies on Absences, Tardiness, Examinations, Grading System
• Short written reflection explaining key Java programming concepts, one real-world IT challenge Java can address, and one professional ethical standard for programmers
```

Related model verdicts: row0-ilo0-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 7. plan[0].values

**Original**

```text
• Compassion
• Courage
• Open mindedness
• Respect
• Obedience
```

**Checker suggestion**

```text
• Courage – students voice their honest expectations and questions about the course when they share and review it
• Humility – students listen to classmates' expectations and accept the course policies on absences, tardiness and examinations
• Community-orientedness – students commit to shared class norms and recognize how the LCUP and CITE vision and mission guide their work in IT
```

Related model verdicts: row0-value: PARTIALLY_ALIGNED -> ALIGNED

### 8. plan[1].ilos[0].text

**Original**

```text
LO1. Explain the basic concepts and principles of Java programming,
```

**Checker suggestion**

```text
LO1. Explain the basic concepts and principles of Java programming that are needed to define the computing requirements of a solution.
```

Related model verdicts: row1-ilo0-clo:real-prog1-2: PARTIALLY_ALIGNED -> ALIGNED

### 9. plan[1].contents

**Original**

```text
II. Introduction to Java Programming
• A Brief History of Java language
• Characteristics of Java Language
• Reasons why programmers use Java language Features of Java Programming
```

**Checker suggestion**

```text
II. Introduction to Java Programming
• A Brief History of Java language
• Characteristics of Java Language
• Reasons why programmers use Java language, Features of Java Programming
• Basic concepts and principles: structure of a Java program, compiling and running (JDK, JVM, bytecode), basic syntax, variables and data types, and introduction to object-oriented principles
• Worked examples of simple Java programs explained line by line
```

Related model verdicts: row1-ilo0-content: PARTIALLY_ALIGNED -> ALIGNED

### 10. plan[1].activities

**Original**

```text
• Lecture- Discussion/Recitat ion using Power Point Presentation
• Video Presentation
• Discovery Learning
• Functioning Knowledge
```

**Checker suggestion**

```text
• Lecture-Discussion with recitation using PowerPoint Presentation, where students explain Java concepts in their own words
• Video Presentation on how Java programs are written and run
• Discovery Learning: students explore and run simple Java programs and describe how the basic concepts work
• Functioning Knowledge: students explain Java principles to a partner using examples
```

Related model verdicts: row1-ilo0-activity: PARTIALLY_ALIGNED -> ALIGNED

### 11. plan[1].tasks

**Original**

```text
• Brain Storming
• Quiz
• Assignment
```

**Checker suggestion**

```text
• Brain Storming: class list of Java features and basic concepts
• Quiz: short questions in which students explain basic Java concepts and principles (program structure, syntax, data types, object-oriented principles)
• Assignment: written explanation of how a simple Java program works, citing the basic concepts it uses
```

Related model verdicts: row1-ilo0-assessment: PARTIALLY_ALIGNED -> ALIGNED

### 12. plan[1].values

**Original**

```text
• Self Awareness
• Active participation and involvement
• Courage
• Humility
• Analytical Skills
```

**Checker suggestion**

```text
• Courage – students volunteer to explain Java concepts aloud in recitation and brainstorming, even when unsure
• Humility – students accept correction on quizzes and assignments and learn from classmates' explanations of Java principles
• Community-orientedness – students help one another understand the basic concepts through partner explanations
```

Related model verdicts: row1-value: PARTIALLY_ALIGNED -> ALIGNED

### 13. plan[2].ilos[0].text

**Original**

```text
ILO1: Demonstrate the skills by knowing the syntax and semantics of Java. of Language.
```

**Checker suggestion**

```text
ILO1: Analyze the computing requirements of a simple problem and identify the Java syntax and semantics (variables, constants, operators, console input/output) needed to meet them.
```

Related model verdicts: row2-ilo0-clo:real-prog1-2: PARTIALLY_ALIGNED -> ALIGNED; row2-ilo0-clo:real-prog1-3: NOT_ALIGNED -> NOT_ALIGNED

### 14. plan[2].contents

**Original**

```text
III. The Basic Input/Output Statements of Java Console
• The Basic Input/Output
• Variable Declaration
• Rules in declaring variables, ➢ Constants ➢ Operators
• Java Installation Java Eclipse GUI
```

**Checker suggestion**

```text
III. The Basic Input/Output Statements of Java Console
• Java installation and setting up the Eclipse IDE
• Basic input/output statements, with worked examples using Scanner and System.out
• Variable declaration, rules for naming variables, and the meaning (semantics) of assignment
• Constants and operators (arithmetic, relational, logical), with traced examples of how expressions are evaluated
• Worked console programs that combine input, variables and operators
```

Related model verdicts: row2-ilo0-content: PARTIALLY_ALIGNED -> ALIGNED; row2-ilo1-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 15. plan[2].activities

**Original**

```text
• Discussion using PowerPoint Presentation
• Discovery Learning
• Functional Knowledge
• Research Study
• Demonstration
```

**Checker suggestion**

```text
• Discussion of Java syntax and semantics using PowerPoint
• Instructor demonstration of writing and running a console program in Eclipse
• Guided hands-on coding: students type, run and trace programs that use variables, constants, operators and input/output
• Discovery learning: students predict and then test the output of short code snippets
• Pair debugging of syntax errors
```

Related model verdicts: row2-ilo0-activity: PARTIALLY_ALIGNED -> ALIGNED; row2-ilo1-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 16. plan[2].tasks

**Original**

```text
• Recitation Group Participation •
• Quiz
• Machine Problem
• Assignment
```

**Checker suggestion**

```text
• Machine Problem: write and run a Java console program that declares variables and constants, reads user input and computes results with operators, graded on correct syntax and output
• Quiz: short items on syntax rules and tracing the output of code snippets (semantics)
• Recitation/group participation: explain a code snippet's behaviour aloud
• Assignment: correct the syntax and logic errors in a given program and explain each fix
```

Related model verdicts: row2-ilo0-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row2-ilo1-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 17. plan[2].ilos[1].text

**Original**

```text
ILO2: Ensures that students gain a foundational understanding of Java and are able to apply basic programming concepts through hands-on practice.
```

**Checker suggestion**

```text
ILO2: Apply basic Java programming concepts through hands-on practice by working with classmates from different backgrounds to build a simple program that addresses a community need.
```

Related model verdicts: row2-ilo1-clo:real-prog1-4: PARTIALLY_ALIGNED -> ALIGNED; row2-ilo1-clo:real-prog1-3: NOT_ALIGNED -> PARTIALLY_ALIGNED

### 18. plan[2].values

**Original**

```text
• Interiority
• Work Ethics
• Interpersonal Skills
• Courage
• Critical Thinking
• Courage •
```

**Checker suggestion**

```text
• Interiority: students reflect on their own coding habits and on honesty in doing their machine problems, writing and explaining their own code rather than copying.
• Courage: students try new Java syntax, run programs that may fail, and present and explain their code and errors in recitation.
```

Related model verdicts: row2-value: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 19. plan[3].ilos[0].text

**Original**

```text
ILO 1: Inference read and write data using Java streams
```

**Checker suggestion**

```text
ILO 1: Analyze the data input and output requirements of a problem and apply Java streams to read and write data that meets them.
```

Related model verdicts: row3-ilo0-clo:real-prog1-2: PARTIALLY_ALIGNED -> ALIGNED; row3-ilo0-clo:real-prog1-3: NOT_ALIGNED -> NOT_ALIGNED

### 20. plan[3].contents

**Original**

```text
IV. Java Libraries Program
• Parts of a Java program
• The print and println function Data type
• Int (Integer)
• Float
• Double
• Char
• Reasons to declare variables
```

**Checker suggestion**

```text
IV. Java Libraries Program
• Parts of a Java program
• The print and println function
• Data types: int, float, double, char
• Reasons to declare variables
• Java streams: InputStream/OutputStream and Reader/Writer classes
• Reading input with Scanner and writing output to the console and to a text file
• Worked example: tracing data read from a file, processed, and written to a new file
• Handling input errors responsibly
```

Related model verdicts: row3-ilo0-content: PARTIALLY_ALIGNED -> ALIGNED; row3-ilo1-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row3-ilo2-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 21. plan[3].activities

**Original**

```text
• Lecture-Discussion using Power Point presentation
• Seatwork
• Laboratory
• Machine Problem Video Presentation
```

**Checker suggestion**

```text
• Lecture-Discussion using PowerPoint presentation on Java streams
• Seatwork: trace code that reads and writes data with streams
• Laboratory: write a Java program that reads data from the keyboard or a file using streams and writes results to a file
• Machine Problem Video Presentation: demonstrate and explain the stream-based program
```

Related model verdicts: row3-ilo0-activity: PARTIALLY_ALIGNED -> ALIGNED; row3-ilo1-activity: PARTIALLY_ALIGNED -> NOT_ALIGNED

### 22. plan[3].tasks

**Original**

```text
• Recitation
• Quiz Simulation of the external and internal parts of the System Unit
```

**Checker suggestion**

```text
• Recitation on how Java streams read and write data
• Laboratory exercise: submit a Java program that reads records from a text file and writes a processed report to another file, graded with a rubric on correct stream use and output
```

Related model verdicts: row3-ilo0-assessment: NOT_ALIGNED -> PARTIALLY_ALIGNED; row3-ilo1-assessment: NOT_ALIGNED -> NOT_ALIGNED; row3-ilo2-assessment: NOT_ALIGNED -> PARTIALLY_ALIGNED

### 23. plan[3].ilos[2].text

**Original**

```text
ILO4: Demonstrate the skills by knowing the syntax and semantics of Java. of Language.
```

**Checker suggestion**

```text
ILO 4: Apply the syntax and semantics of Java to write working programs with a classmate for a simple community-related problem.
```

Related model verdicts: row3-ilo2-clo:real-prog1-4: PARTIALLY_ALIGNED -> ALIGNED

### 24. plan[3].values

**Original**

```text
• Understanding
• Exactness
• Patience
• Critical Thinking
• Active participation and involvement
• Critical Thinking
• Patience
• Appreciation
```

**Checker suggestion**

```text
• Humility: students ask for and give help when debugging, and accept corrections to their syntax errors in the laboratory.
• Community-orientedness: students share working code and explain it to classmates during the Machine Problem Video Presentation.
• Interiority: students reflect on whether their program is honest and careful work.
```

Related model verdicts: row3-value: PARTIALLY_ALIGNED -> ALIGNED

### 25. plan[5].ilos[0].text

**Original**

```text
ILO3: Understand the fundamentals of structured logic using decisions, loops, and array manipulation.
```

**Checker suggestion**

```text
ILO3: Analyze the requirements of a given problem and explain how structured logic (decisions, loops, and array manipulation) can be used to meet them.
```

Related model verdicts: row5-ilo0-clo:real-prog1-2: PARTIALLY_ALIGNED -> ALIGNED; row5-ilo0-clo:real-prog1-4: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 26. plan[5].contents

**Original**

```text
V. . Conditional Statements
• The Conditional Statements Syntax
• If Statement
• If Else Statement Switch/case Language
```

**Checker suggestion**

```text
V. Structured Logic in Java
• Conditional Statements: syntax, if statement, if-else statement, switch/case, with sample programs that trace which branch runs
• Looping Constructs: for, while, do-while, with traced examples of repeated tasks
• Arrays: declaring, accessing and traversing arrays with loops, with worked examples combining decisions, loops, and arrays
```

Related model verdicts: row5-ilo0-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row5-ilo1-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 27. plan[5].activities

**Original**

```text
• Discussion using PowerPoint Presentation
• Video Presentation
• Laboratory Exercises: Machine Language Group Dynamics
```

**Checker suggestion**

```text
• Discussion using PowerPoint Presentation on decisions, loops, and arrays
• Video Presentation on structured logic in Java
• Laboratory Exercises: tracing and explaining short Java programs that use if/else, loops, and arrays, done in pairs or small groups
```

Related model verdicts: row5-ilo0-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row5-ilo1-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 28. plan[5].tasks

**Original**

```text
• Recitation
• Seatwork on the topics discussed
• Laboratory Exercises
```

**Checker suggestion**

```text
• Recitation: explaining how decisions, loops, and arrays control program flow
• Seatwork: tracing code that uses if/else, loops, and arrays and stating the output
• Laboratory Exercises: short Java programs using decisions, loops, and arrays, with a written explanation of the logic
```

Related model verdicts: row5-ilo0-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row5-ilo1-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 29. plan[5].ilos[1].text

**Original**

```text
ILO4: Be able to apply conditional statements in Java to control program flow based on specific conditions, and write programs
that make decisions dynamically depending on user input or computed values.
```

**Checker suggestion**

```text
ILO4: Be able to apply conditional statements in Java to control program flow based on specific conditions, and write programs that make decisions dynamically depending on user input or computed values, applying ethical standards such as honest, fair, and safe handling of input so the program serves the common good.
```

Related model verdicts: row5-ilo1-clo:real-prog1-3: PARTIALLY_ALIGNED -> ALIGNED; row5-ilo1-clo:real-prog1-4: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 30. plan[5].values

**Original**

```text
• Patience
• Humility
• Cooperation
• Accuracy
• Appreciation
• Leadership Skills
• Courage
```

**Checker suggestion**

```text
• Humility: students accept feedback from peers and the instructor when their conditional logic gives wrong output, and fix their code.
• Courage: students attempt and defend their own Java solutions for decision-making programs during recitation and laboratory exercises, even when unsure.
• Community-orientedness: students work in pairs or groups in the laboratory exercises, sharing code reviews so everyone can write correct conditional programs.
```

Related model verdicts: row5-value: PARTIALLY_ALIGNED -> ALIGNED

### 31. plan[6].ilos[0].text

**Original**

```text
ILO1: Utilize various looping constructs (for, while, do-while) in Java to execute repeated tasks, and design programs that efficiently handle repetitive processes and iterations, incorporating loops to solve real-world problems.  ,
```

**Checker suggestion**

```text
ILO1: Analyze the requirements of a repetitive real-world task and utilize looping constructs (for, while, do-while) in Java to design programs that efficiently handle repetitive processes and iterations.
```

Related model verdicts: row6-ilo0-clo:real-prog1-2: PARTIALLY_ALIGNED -> ALIGNED; row6-ilo0-clo:real-prog1-3: NOT_ALIGNED -> PARTIALLY_ALIGNED; row6-ilo0-clo:real-prog1-4: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 32. plan[6].contents

**Original**

```text
XI. Looping Statements
• Java Loops
▪ For Loops
▪ Do While Loop
▪ Break/Continue
```

**Checker suggestion**

```text
XI. Looping Statements
• Java Loops
▪ For Loops
▪ While Loops
▪ Do While Loop
▪ Break/Continue
• Choosing the right loop for a task and avoiding infinite loops
• Nested loops and worked examples
• Worked examples: applying loops to real-world problems (e.g., totals, averages, menus, patterns)
```

Related model verdicts: row6-ilo0-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row6-ilo1-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 33. plan[6].activities

**Original**

```text
• Discussion using PowerPoint Presentation
• Functioning Knowledge
• Laboratory Exercises.
```

**Checker suggestion**

```text
• Discussion using PowerPoint Presentation on for, while and do-while loops
• Laboratory Exercises: students write and run Java programs using for, while and do-while loops to handle repetitive tasks
• Students design and code a loop-based program that solves a real-world problem (e.g., grade computation, ATM menu)
```

Related model verdicts: row6-ilo0-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row6-ilo1-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 34. plan[6].tasks

**Original**

```text
• Recitation
• Group Participation
• Quiz
• Machine Problem
```

**Checker suggestion**

```text
• Recitation on loop concepts
• Group Participation in laboratory work
• Quiz on loop syntax and tracing loop output
• Machine Problem: write a Java program using for, while and do-while loops to solve a real-world repetitive problem, graded on correctness and efficiency
```

Related model verdicts: row6-ilo0-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row6-ilo1-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 35. plan[6].values

**Original**

```text
• Critical Thinking
• Understanding
• Precision
• Accuracy
• Appreciation
• Humility
```

**Checker suggestion**

```text
• Humility: students admit and correct errors in their loops (such as infinite loops) during laboratory exercises and accept classmates' feedback.
• Community-orientedness: in group participation, students help one another debug loop programs in the Machine Problem.
• Interiority: students reflect on the precision and accuracy their code needs.
```

Related model verdicts: row6-value: PARTIALLY_ALIGNED -> ALIGNED

### 36. plan[8].ilos[0].text

**Original**

```text
ILO4: declare, initialize, and manipulate arrays in Java, effectively using one-
dimensional and multi-dimensional arrays to store, retrieve, and process data in various applications
```

**Checker suggestion**

```text
ILO4: Analyze the data storage requirements of a problem and declare, initialize, and manipulate one-dimensional and multi-dimensional arrays in Java to store, retrieve, and process data in various applications.
```

Related model verdicts: row8-ilo0-clo:real-prog1-2: PARTIALLY_ALIGNED -> ALIGNED; row8-ilo0-clo:real-prog1-3: NOT_ALIGNED -> PARTIALLY_ALIGNED

### 37. plan[8].contents

**Original**

```text
X. . Array
• Array
• Example of Array
• Two-Dimensional Arrays syntax:
```

**Checker suggestion**

```text
X. Arrays
• One-dimensional arrays: declaration and initialization
• Accessing, storing and retrieving elements
• Processing arrays with loops (traversal, sum, search)
• Two-dimensional arrays: syntax, declaration, initialization and processing
• Worked examples of arrays in applications (e.g., grades, seating chart)
```

Related model verdicts: row8-ilo0-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row8-ilo1-content: PARTIALLY_ALIGNED -> NOT_ALIGNED

### 38. plan[8].activities

**Original**

```text
• Discussion using Power Point Presentation
• Functioning knowledge
• Discovery Learning
• Quiz on the discussed topic Laboratory Exercises
```

**Checker suggestion**

```text
• Discussion using PowerPoint presentation on one-dimensional and two-dimensional arrays
• Guided discovery learning: students declare and initialize arrays and trace their contents
• Laboratory exercises: students write Java programs that store, retrieve and process data (searching, summing, sorting) in one-dimensional and multi-dimensional arrays
• Short quiz on array syntax
```

Related model verdicts: row8-ilo0-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row8-ilo1-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 39. plan[8].tasks

**Original**

```text
• Recitation
• Quiz
• Machine problem: Hands-on exercises using Java Console programs
```

**Checker suggestion**

```text
• Recitation
• Quiz on error types and debugging techniques
• Machine problem: students debug given faulty Java console programs (including array programs), submit the corrected code and a short debugging log explaining each error and its fix
```

Related model verdicts: row8-ilo1-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 40. plan[8].values

**Original**

```text
• Active participation and involvement
• Understanding
• Compassion Critical Thinking
```

**Checker suggestion**

```text
• Compassion: while debugging array programs in the laboratory, students patiently help classmates find and fix errors and give kind, constructive feedback
• Humility: students admit their own coding mistakes and learn from corrections as they work toward the array and debugging ILOs
```

Related model verdicts: row8-value: PARTIALLY_ALIGNED -> ALIGNED

### 41. plan[9].ilos[0].text

**Original**

```text
ILO1: Apply various string manipulation methods in Java.  .
```

**Checker suggestion**

```text
ILO1: Analyze the text-processing requirements of a problem and apply suitable Java string manipulation methods to meet them.
```

Related model verdicts: row9-ilo0-clo:real-prog1-2: PARTIALLY_ALIGNED -> ALIGNED; row9-ilo0-clo:real-prog1-3: NOT_ALIGNED -> NOT_ALIGNED

### 42. plan[9].contents

**Original**

```text
XIII. Strings
• String Manipulation ➢ Length() ➢ charAt() ➢ indexOf() ➢ concat() ➢ replace ➢ ignorecase() ➢ substring()
```

**Checker suggestion**

```text
XIII. Strings
• String basics and immutability
• String manipulation methods with worked Java examples: length(), charAt(), indexOf(), concat(), replace(), equalsIgnoreCase(), toLowerCase()/toUpperCase(), substring()
• Applying the methods to everyday tasks (validating input, extracting parts of text, formatting names)
```

Related model verdicts: row9-ilo0-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row9-ilo1-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 43. plan[9].tasks

**Original**

```text
• Recitation
• Quiz
• Seatwork-Trial and Error for discovery learning
• Accurate Program output
```

**Checker suggestion**

```text
• Recitation on string methods
• Quiz on the behaviour of length(), charAt(), indexOf(), concat(), replace() and substring()
• Seatwork (trial and error discovery learning): students write Java programs that manipulate strings
• Accurate program output: working Java programs that correctly apply the string manipulation methods
```

Related model verdicts: row9-ilo0-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row9-ilo1-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 44. plan[9].ilos[1].text

**Original**

```text
LO2: Synthesize skills in De-bugging Java Language program.
```

**Checker suggestion**

```text
LO2: Synthesize debugging skills by collaborating with classmates from diverse backgrounds to find and fix errors in Java programs that address a social challenge.
```

Related model verdicts: row9-ilo1-clo:real-prog1-4: PARTIALLY_ALIGNED -> ALIGNED; row9-ilo1-clo:real-prog1-3: NOT_ALIGNED -> PARTIALLY_ALIGNED

### 45. plan[9].activities

**Original**

```text
Lecture:
• Discussion using Powerpoint Presentation
• Quiz
• Laboratory: :Exercises: ➢ Machine Problem
• Seatwork using trial and error discovery learning
```

**Checker suggestion**

```text
Lecture:
• Discussion using PowerPoint Presentation on common Java errors and debugging techniques
• Quiz
• Laboratory Exercises: students are given faulty Java String programs, trace and locate the errors, fix them and re-test (Machine Problem)
• Seatwork using trial and error discovery learning: students debug and improve their own Java programs and explain each fix
```

Related model verdicts: row9-ilo1-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 46. plan[9].values

**Original**

```text
• Critical Thinking
• Active participation and involvement
• Open mindedness
• Humility
• Patience
• Courage
```

**Checker suggestion**

```text
• Humility: students admit and learn from their own coding errors and accept classmates' feedback when debugging String programs
• Courage: students run, test and try fixes on faulty Java code without fear of failure, and present their solutions in recitation
• Patience and critical thinking: students trace their code step by step through trial and error until the output is correct
```

Related model verdicts: row9-value: PARTIALLY_ALIGNED -> ALIGNED

### 47. plan[10].ilos[0].text

**Original**

```text
ILO4: Demonstrate the skills by knowing the syntax and semantics of Java.
```

**Checker suggestion**

```text
ILO4: Analyze the requirements of a given problem and demonstrate the Java syntax and semantics needed to meet them.
```

Related model verdicts: row10-ilo0-clo:real-prog1-2: PARTIALLY_ALIGNED -> ALIGNED; row10-ilo0-clo:real-prog1-3: NOT_ALIGNED -> NOT_ALIGNED

### 48. plan[10].contents

**Original**

```text
XII. JAVA METHOD
• Java Parameters
• Object Connection Java Recursion
```

**Checker suggestion**

```text
XII. JAVA METHODS
• Method syntax: declaring and calling methods, return types
• Java parameters: how arguments are passed and what a method returns (semantics), with traced examples
• Methods calling other methods and objects
• Java recursion: base case and recursive case, with worked examples and output tracing
```

Related model verdicts: row10-ilo0-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row10-ilo1-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row10-ilo2-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 49. plan[10].activities

**Original**

```text
• Discussion using Power Point Presentation
• Functioning knowledge
• Blended Learning
• Quiz on the discussed topic
• Laboratory Exercises
```

**Checker suggestion**

```text
• Discussion using PowerPoint Presentation on Java method syntax, parameters and recursion
• Blended Learning: online practice on writing Java methods
• Quiz on the discussed topic
• Laboratory Exercises: students write, run and trace Java methods with parameters and recursion, and explain what each program does
```

Related model verdicts: row10-ilo0-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row10-ilo1-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row10-ilo2-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 50. plan[10].tasks

**Original**

```text
• Recitation
• Quiz
• Machine problem: Hands-on exercises using C programs
```

**Checker suggestion**

```text
• Recitation: explain the syntax and the output of given Java methods
• Quiz on Java method syntax, parameters and recursion
• Machine problem: hands-on exercises writing Java programs with methods, parameters and recursion, graded on correct syntax and accurate output
```

Related model verdicts: row10-ilo0-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row10-ilo1-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED; row10-ilo2-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 51. plan[10].ilos[1].text

**Original**

```text
ILO5: Build robust applications using Java console code.
```

**Checker suggestion**

```text
ILO5: Build robust Java console applications that meet computing requirements the student has defined and analyzed.
```

Related model verdicts: row10-ilo1-clo:real-prog1-2: PARTIALLY_ALIGNED -> ALIGNED; row10-ilo1-clo:real-prog1-3: PARTIALLY_ALIGNED -> NOT_ALIGNED

### 52. plan[10].ilos[2].text

**Original**

```text
ILO6: Synthesize skills in De-bugging
Java Language program.
```

**Checker suggestion**

```text
ILO6: Synthesize debugging skills for Java programs by collaborating with diverse teammates to find and fix errors in a Java solution that addresses a social challenge.
```

Related model verdicts: row10-ilo2-clo:real-prog1-4: PARTIALLY_ALIGNED -> ALIGNED; row10-ilo2-clo:real-prog1-3: NOT_ALIGNED -> PARTIALLY_ALIGNED

### 53. plan[10].values

**Original**

```text
• Active participation and involvement
• Understanding
• Interiority
• Courage
• Critical Thinking
```

**Checker suggestion**

```text
• Interiority: during debugging in the laboratory exercises, students reflect honestly on their own mistakes and how they approached the problem before changing the code.
• Courage: students present and defend their Java console application in recitation and admit and fix errors found by peers, rather than hiding them.
```

Related model verdicts: row10-value: PARTIALLY_ALIGNED -> ALIGNED

### 54. plan[11].ilos[0].text

**Original**

```text
ILO1 Retreve data from a relational database using java class.
```

**Checker suggestion**

```text
ILO1: Retrieve data from a relational database using a Java class, working with teammates to build a Java solution that addresses a social challenge.
```

Related model verdicts: row11-ilo0-clo:real-prog1-4: PARTIALLY_ALIGNED -> ALIGNED; row11-ilo0-clo:real-prog1-3: NOT_ALIGNED -> PARTIALLY_ALIGNED

### 55. plan[11].contents

**Original**

```text
X. JAVA DATABASE CONNECTION
• Improvised Database UCanAccess Connection
```

**Checker suggestion**

```text
X. JAVA DATABASE CONNECTION
• Improvised Database UCanAccess Connection
Value webbing: Filipino-Catholic Augustinian Spirituality (community, humility, love of service) linked to responsible handling of stored data, with a sample value web connecting database use to the common good
```

Related model verdicts: row11-ilo1-content: NOT_ALIGNED -> ALIGNED; row11-ilo0-content: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 56. plan[11].activities

**Original**

```text
• Discussion using Power Point Presentation
• Quiz on the discussed topic
• Cooperative Learning
• Group Dynamics Laboratory Exercises
```

**Checker suggestion**

```text
• Discussion using PowerPoint on Augustinian values in responsible data handling
• Cooperative learning: groups create a value web linking Filipino-Catholic Augustinian Spirituality (community, humility, love of service) to their database program
• Group presentation of the value web
• Group Dynamics Laboratory Exercises on Java database connection
```

Related model verdicts: row11-ilo1-activity: NOT_ALIGNED -> ALIGNED; row11-ilo0-activity: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 57. plan[11].tasks

**Original**

```text
• Recitation
• Quiz
• Groupings
• Machine problem: Hands-on exercises using Java programs
```

**Checker suggestion**

```text
• Recitation
• Quiz
• Value web output: each group submits a value web showing how Filipino-Catholic Augustinian Spirituality (community, humility, love of service) applies to their database program, graded with a rubric
• Machine problem: hands-on exercises using Java programs
```

Related model verdicts: row11-ilo1-assessment: NOT_ALIGNED -> ALIGNED; row11-ilo0-assessment: PARTIALLY_ALIGNED -> PARTIALLY_ALIGNED

### 58. plan[11].values

**Original**

```text
• Active participation and involvement
• Understanding
• Teamwork Skills
• Courage Critical Thinking
```

**Checker suggestion**

```text
• Community-orientedness: students work in groups on the database laboratory exercises and the value web, sharing code and helping one another.
• Courage: students try retrieving data from a database, face connection errors and debug them, and present their value web.
• Humility: students accept peer feedback on their code and value web.
```

Related model verdicts: row11-value: PARTIALLY_ALIGNED -> ALIGNED

## Proposals not applied in this experiment

- meta.title (rule): Not a direct AI text rewrite
- meta.prereq (rule): Not a direct AI text rewrite
- description (ai): Not a direct AI text rewrite
