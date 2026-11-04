# Academic relationship review

Provenance: controlled-Claude-evaluation. Nonofficial relationship evaluation.

ACADEMIC ACCURACY: NOT YET MEASURED. Independent faculty review required.

## BM1-IT202-096 (Content-ILO)

Status: REVIEWABLE_MODEL_JUDGMENT; judgment: PARTIALLY_ALIGNED

The ILO is partly about the orientation content (course structure, expectations), but it also asks for 'key programming concepts in Java' and how they 'align with real- world IT challenges and professional ethical standards'. The Week 1 content (course contents, requirements, objectives, grading, policies) teaches no Java concepts, no real-world IT challenges and no professional ethics. 'Demonstrate a clear understanding' is also a vague verb, not an observable performance.

Correction for faculty review: ILO 1: Explain the course structure, objectives, requirements, grading system and policies, and state their own expectations of the course. [CLO1]

Recommendation (lcup-v2-recommendation-2): REWRITE_TEXT; field ilo (plan[0].ilos[0].text)

Reason given: The content is a legitimate orientation, and the mismatch comes from the ILO adding Java concepts, real-world challenges and ethics that Week 1 does not teach. Revising the ILO to fit the orientation fixes this without touching the content or the week's activities and tasks. The ILO keeps its [CLO1] label.

## BM1-IE402-074 (Content-ILO)

Status: REVIEWABLE_MODEL_JUDGMENT; judgment: NOT_ALIGNED

The target ILO asks students to demonstrate Augustinian, Marian and missionary Christ-centered Spirituality through value webbing. The source Week 1 content is only a course orientation (introduction to contents, requirements, objectives, grading and policies). It teaches nothing about Augustinian-Marian spirituality or value webbing, so students cannot reach the ILO from this content. Demonstrating a spirituality is also a higher-level performance than orientation content can teach. The ILO is not drawn from this week's content; and its wording is also not observable as written, because 'demonstrate spirituality' gives no concrete performance. The same ILO10 number also appears in weeks 12-14 for a different outcome, which adds to the confusion.

Correction for faculty review: None verified.

Recommendation (lcup-v2-recommendation-2): REVIEW_REQUIRED; field ilo (plan[0].ilos[0].text); draft withheld: keeps_off_subject, weakens_mapped_clo

Reason given: The Week 1 content is a legitimate orientation and other relationships (activities, tasks) rely on it, while the ILO is the text that does not fit the week; the ILO is the target and a full draft is allowed. The CLO 4 tag stays, since the revised ILO still builds the introductory CLO 4 competence. Relocating the ILO to another week would need a faculty decision.

## BM1-CPE304-051 (Content-ILO)

Status: REVIEWABLE_MODEL_JUDGMENT; judgment: PARTIALLY_ALIGNED

The ILO (target) is about analysis and design of analog and digital circuits, and the week's content (source) covers design of electronic systems and circuits and differential amplifiers, so it is partly on topic. Gaps: (1) the ILO says "both analog and digital circuits", but the content covers only analog differential amplifiers and general system design, with no digital circuit topic; (2) "develop skills in analysis and design" is vague and gives no observable performance; (3) the content only lists topic names (Design of Electronic Circuits, Differential Gain, CMRR) and does not show circuits being analysed or designed, so the Analyze/Create level is not supported. The ILO text is also shared with Week 7-8, so changing it could affect that week; the content can be extended instead.

Correction for faculty review: II. Introduction to Electronic System
• History of Electronics
• Electronic Signals and Notation
• Classifications of Electronic Systems
• Specifications of Electronic Systems
• Design of Electronic Systems
• Design of Electronic Circuits (analog and digital)
• Analysis and design of basic analog and digital circuits: worked examples
• Electronic Devices
• Emerging Electronics
Differential Amplifiers
• Introduction to Differential Amplifiers
• Block Diagram
• Differential Gain
• Common Mode Gain
• CMRR
• Configuration of differential amplifiers
• Analysis of differential amplifier circuits: computing differential gain, common mode gain and CMRR

Recommendation (lcup-v2-recommendation-2): REWRITE_TEXT; field course_content (plan[1].contents)

Reason given: The same ILO1 text is stated in Week 7-8, so the ilo field has no draft and rewriting it would affect that week. Adding to the week's content (analysis of differential amplifier circuits, digital circuit design) supports the ILO without removing anything other relationships rely on.
