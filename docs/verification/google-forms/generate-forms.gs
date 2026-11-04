/**
 * LCUP Syllabus Management System — Hybrid AI Checker
 * Independent Faculty Validation — Google Forms Generator & Lifecycle Manager
 *
 * Automated deployment script for generating three separate Google Forms
 * and linked Google Sheets response destinations for independent faculty review:
 *   1. IT 202 (BSIT) — 7 Cases (FV-01 to FV-07)
 *   2. IE 402 (BSIE) — 9 Cases (FV-08 to FV-16)
 *   3. CpE 304 (BSCPE) — 5 Cases (FV-17 to FV-21)
 *
 * Pre-requisite: Authorized University Google Workspace Account (script.google.com)
 *
 * Operational Security & Governance Controls:
 * - Domain Authentication: setRequireLogin(true) restricts responder access strictly to institutional Google Workspace accounts.
 * - Reviewer Pseudonymity: setCollectEmail(false) ensures personal email addresses are not captured in research data.
 * - Air-Gap Blind: Zero model predictions, scores, or benchmark answers exposed to reviewers.
 * - Anti-Contamination Isolation: A separate generateTestValidationForm() function deploys isolated test forms with synthetic data.
 * - Response Privacy: setPublishingSummary(false) disables public response summaries so reviewers cannot view peer answers.
 * - Deployment Lock: PropertiesService lock prevents accidental duplicate generation.
 * - Record Freezing: closeValidationForms() closes responder inputs and creates an immutable frozen audit spreadsheet snapshot.
 */

// BUNDLED FACULTY VALIDATION DATASET (21 Institutional Cases)
const VALIDATION_BUNDLE = {
  "manifest": {
    "source": "LCUP Syllabus Management System — Academic Validation Pilot",
    "datasetVersion": "lcup-faculty-validation-1",
    "benchmarkHash": null,
    "totalCases": 21,
    "distribution": {
      "IT 202": 7,
      "IE-402": 9,
      "CpE 304": 5
    }
  },
  "courses": [
    {
      "courseCode": "IT 202",
      "courseTitle": "Computer Programming 1",
      "program": "BSIT",
      "reviewerCodes": [
        "R-IT-01",
        "R-IT-02"
      ],
      "adjudicatorCode": "ADJ-IT-01",
      "caseCount": 7,
      "cases": [
        {
          "caseId": "FV-01",
          "courseCode": "IT 202",
          "courseTitle": "Computer Programming 1",
          "program": "BSIT",
          "relationshipKey": "Content-activity",
          "relationshipName": "Course Content ↔ Learning Activities",
          "week": "Week 1",
          "lesson": "I. Orientation",
          "statements": [
            {
              "role": "Course content, Week 1",
              "text": "I. Orientation A. Introduction to the Course Contents B. Course Requirements and Activities C. Course Objectives Grading System and Policies on Absences, Tardiness and Examinations"
            },
            {
              "role": "Learning activities, Week 1",
              "text": "• Setting and sharing of Expectations from the Course • Discussion on the Vision, Mission and Goals of LCUP and of CITE • Presentation of Course Objectives and Contents, Course Requirements and Activities Review of Policies on Absences, Tardiness, Examinations, Grading System"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "I. Orientation A. Introduction to the Course Contents B. Course Requirements and Activities C. Course Objectives Grading System and Policies on Absences, Tardiness and Examinations",
            "activities": "• Setting and sharing of Expectations from the Course • Discussion on the Vision, Mission and Goals of LCUP and of CITE • Presentation of Course Objectives and Contents, Course Requirements and Activities Review of Policies on Absences, Tardiness, Examinations, Grading System",
            "assessment": "• Statement of Expectations • Review of Course Contents, Objectives, Activities and Assessment Tools • Review of Policies on Absences, Tardiness, Examinations, Grading System"
          }
        },
        {
          "caseId": "FV-02",
          "courseCode": "IT 202",
          "courseTitle": "Computer Programming 1",
          "program": "BSIT",
          "relationshipKey": "Content-ILO",
          "relationshipName": "Course Content ↔ ILO",
          "week": "Week 4-5",
          "lesson": "IV. Java Libraries Program",
          "statements": [
            {
              "role": "Course content, Week 4-5",
              "text": "IV. Java Libraries Program • Parts of a Java program • The print and println function Data type • Int (Integer) • Float • Double • Char • Reasons to declare variables"
            },
            {
              "role": "Intended learning outcome (ILO), Week 4-5",
              "text": "ILO 2 Acquire the necessary skills and understanding of java methods."
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "IV. Java Libraries Program • Parts of a Java program • The print and println function Data type • Int (Integer) • Float • Double • Char • Reasons to declare variables",
            "activities": "• Lecture-Discussion using Power Point presentation • Seatwork • Laboratory • Machine Problem Video Presentation",
            "assessment": "• Recitation • Quiz Simulation of the external and internal parts of the System Unit"
          }
        },
        {
          "caseId": "FV-03",
          "courseCode": "IT 202",
          "courseTitle": "Computer Programming 1",
          "program": "BSIT",
          "relationshipKey": "Activity-assessment",
          "relationshipName": "Learning Activities ↔ Assessment",
          "week": "Week 4-5",
          "lesson": "IV. Java Libraries Program",
          "statements": [
            {
              "role": "Learning activities, Week 4-5",
              "text": "• Lecture-Discussion using Power Point presentation • Seatwork • Laboratory • Machine Problem Video Presentation"
            },
            {
              "role": "Assessment, Week 4-5",
              "text": "• Recitation • Quiz Simulation of the external and internal parts of the System Unit"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "IV. Java Libraries Program • Parts of a Java program • The print and println function Data type • Int (Integer) • Float • Double • Char • Reasons to declare variables",
            "activities": "• Lecture-Discussion using Power Point presentation • Seatwork • Laboratory • Machine Problem Video Presentation",
            "assessment": "• Recitation • Quiz Simulation of the external and internal parts of the System Unit"
          }
        },
        {
          "caseId": "FV-04",
          "courseCode": "IT 202",
          "courseTitle": "Computer Programming 1",
          "program": "BSIT",
          "relationshipKey": "ILO-CLO",
          "relationshipName": "ILO ↔ CLO",
          "week": "Week 9-11",
          "lesson": "XI. Looping Statements",
          "statements": [
            {
              "role": "Intended learning outcome (ILO), Week 9-11",
              "text": "ILO1: Utilize various looping constructs (for, while, do-while) in Java to execute repeated tasks, and design programs that efficiently handle repetitive processes and iterations, incorporating loops to solve real-world problems. CLO1 CLO2, CLO3"
            },
            {
              "role": "Course learning outcome, CLO 3 (Demonstrating)",
              "text": "Collaborate effectively within multi-disciplinary and culturally diverse teams to develop Java- based programming solutions that address social challenges, demonstrating social responsibility and cultural sensitivity."
            }
          ],
          "iloCloMapping": {
            "ilo": "ILO1: Utilize various looping constructs (for, while, do-while) in Java to execute repeated tasks, and design programs that efficiently handle repetitive processes and iterations, incorporating loops to solve real-world problems. CLO1 CLO2, CLO3",
            "mappingAsPrinted": "CLO1 CLO2, CLO3",
            "cloInThisRelationship": 3,
            "cloStatement": "Collaborate effectively within multi-disciplinary and culturally diverse teams to develop Java- based programming solutions that address social challenges, demonstrating social responsibility and cultural sensitivity.",
            "requiredClassification": "Demonstrating",
            "weeklyCourseContent": "XI. Looping Statements • Java Loops ▪ For Loops ▪ Do While Loop ▪ Break/Continue"
          },
          "weekContext": {
            "content": "XI. Looping Statements • Java Loops ▪ For Loops ▪ Do While Loop ▪ Break/Continue",
            "activities": "• Discussion using PowerPoint Presentation • Functioning Knowledge • Laboratory Exercises.",
            "assessment": "• Recitation • Group Participation • Quiz • Machine Problem"
          }
        },
        {
          "caseId": "FV-05",
          "courseCode": "IT 202",
          "courseTitle": "Computer Programming 1",
          "program": "BSIT",
          "relationshipKey": "Content-assessment",
          "relationshipName": "Course Content ↔ Assessment",
          "week": "Week 15",
          "lesson": "XII. JAVA METHOD",
          "statements": [
            {
              "role": "Course content, Week 15",
              "text": "XII. JAVA METHOD • Java Parameters • Object Connection Java Recursion"
            },
            {
              "role": "Assessment, Week 15",
              "text": "• Recitation • Quiz • Machine problem: Hands-on exercises using C programs"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "XII. JAVA METHOD • Java Parameters • Object Connection Java Recursion",
            "activities": "• Discussion using Power Point Presentation • Functioning knowledge • Blended Learning • Quiz on the discussed topic • Laboratory Exercises",
            "assessment": "• Recitation • Quiz • Machine problem: Hands-on exercises using C programs"
          }
        },
        {
          "caseId": "FV-06",
          "courseCode": "IT 202",
          "courseTitle": "Computer Programming 1",
          "program": "BSIT",
          "relationshipKey": "Content-course",
          "relationshipName": "Course Title ↔ Course Content",
          "week": "Week 16-17",
          "lesson": "X. JAVA DATABASE CONNECTION",
          "statements": [
            {
              "role": "Course title",
              "text": "IT 202 - Computer Programming 1"
            },
            {
              "role": "Course content, Week 16-17",
              "text": "X. JAVA DATABASE CONNECTION • Improvised Database UCanAccess Connection"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "X. JAVA DATABASE CONNECTION • Improvised Database UCanAccess Connection",
            "activities": "• Discussion using Power Point Presentation • Quiz on the discussed topic • Cooperative Learning • Group Dynamics Laboratory Exercises",
            "assessment": "• Recitation • Quiz • Groupings • Machine problem: Hands-on exercises using Java programs"
          }
        },
        {
          "caseId": "FV-07",
          "courseCode": "IT 202",
          "courseTitle": "Computer Programming 1",
          "program": "BSIT",
          "relationshipKey": "ILO-activity",
          "relationshipName": "ILO ↔ Learning Activities",
          "week": "Week 16-17",
          "lesson": "X. JAVA DATABASE CONNECTION",
          "statements": [
            {
              "role": "Intended learning outcome (ILO), Week 16-17",
              "text": "Demonstrate the Filipino-Catholic Augustinian Spirituality through value webbing."
            },
            {
              "role": "Learning activities, Week 16-17",
              "text": "• Discussion using Power Point Presentation • Quiz on the discussed topic • Cooperative Learning • Group Dynamics Laboratory Exercises"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "X. JAVA DATABASE CONNECTION • Improvised Database UCanAccess Connection",
            "activities": "• Discussion using Power Point Presentation • Quiz on the discussed topic • Cooperative Learning • Group Dynamics Laboratory Exercises",
            "assessment": "• Recitation • Quiz • Groupings • Machine problem: Hands-on exercises using Java programs"
          }
        }
      ]
    },
    {
      "courseCode": "IE-402",
      "courseTitle": "Systems Engineering",
      "program": "BSIE",
      "reviewerCodes": [
        "R-IE-01",
        "R-IE-02"
      ],
      "adjudicatorCode": "ADJ-IE-01",
      "caseCount": 9,
      "cases": [
        {
          "caseId": "FV-08",
          "courseCode": "IE-402",
          "courseTitle": "Systems Engineering",
          "program": "BSIE",
          "relationshipKey": "Content-course",
          "relationshipName": "Course Title ↔ Course Content",
          "week": "Week 1",
          "lesson": "I. COURSE ORIENTATION",
          "statements": [
            {
              "role": "Course title",
              "text": "IE-402 - Systems Engineering"
            },
            {
              "role": "Course content, Week 1",
              "text": "I. COURSE ORIENTATION A. Introduction to the Course Contents B. Course Requirements and Activities C. Course Objectives D. Grading System and Policies on Absences, Tardiness and Examinations"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "I. COURSE ORIENTATION A. Introduction to the Course Contents B. Course Requirements and Activities C. Course Objectives D. Grading System and Policies on Absences, Tardiness and Examinations",
            "activities": "• Setting and sharing of Expectations from the Course • Discussion on the Vision, Mission and Goals of LCUP and of CITE • Presentation of Course Objectives and Contents, Course Requirements and Activities • Review of Policies on Absences, Tardiness, Examinations, Grading System",
            "assessment": "• Statement of Expectations • Review of Course Contents, Objectives, Activities and Assessment Tools • Review of Policies on Absences, Tardiness, Examinations, Grading System"
          }
        },
        {
          "caseId": "FV-09",
          "courseCode": "IE-402",
          "courseTitle": "Systems Engineering",
          "program": "BSIE",
          "relationshipKey": "Content-assessment",
          "relationshipName": "Course Content ↔ Assessment",
          "week": "Week 2-3",
          "lesson": "Introduction to Systems Engineering",
          "statements": [
            {
              "role": "Course content, Week 2-3",
              "text": "Introduction to Systems Engineering • Introduction to Systems Engineering Management • Systems Engineering Management in DoD Acquisition"
            },
            {
              "role": "Assessment, Week 2-3",
              "text": "Quiz on Fundamental Concepts Conduct a quiz covering key concepts and terminology in systems engineering management, including its principles, life cycle stages, and specific applications in DoD acquisition. Case Study Analysis Report Provide a case study on a DoD acquisition project or a similar large-scale systems engineering project. Students will analyze and write a report covering the systems engineering management challenges and solutions highlighted in the case."
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "Introduction to Systems Engineering • Introduction to Systems Engineering Management • Systems Engineering Management in DoD Acquisition",
            "activities": "Lecture and Case Study Analysis Activity: Present a lecture on the basics of systems engineering management, followed by an analysis of a real- world case study in systems engineering, such as a notable DoD acquisition project. Interactive Discussion and Q&A Activity: Facilitate an interactive class discussion on the key principles of systems engineering management and its importance in large-scale projects, especially in high-stakes environments like defense.",
            "assessment": "Quiz on Fundamental Concepts Conduct a quiz covering key concepts and terminology in systems engineering management, including its principles, life cycle stages, and specific applications in DoD acquisition. Case Study Analysis Report Provide a case study on a DoD acquisition project or a similar large-scale systems engineering project. Students will analyze and write a report covering the systems engineering management challenges and solutions highlighted in the case."
          }
        },
        {
          "caseId": "FV-10",
          "courseCode": "IE-402",
          "courseTitle": "Systems Engineering",
          "program": "BSIE",
          "relationshipKey": "Content-course",
          "relationshipName": "Course Title ↔ Course Content",
          "week": "Week 5-8",
          "lesson": "The Systems Engineering Process",
          "statements": [
            {
              "role": "Course title",
              "text": "IE-402 - Systems Engineering"
            },
            {
              "role": "Course content, Week 5-8",
              "text": "The Systems Engineering Process • Systems Engineering Process Overview • Requirements Analysis • Functional Analysis and Allocation • Design Synthesis • Verification • Systems Engineering Process Outputs"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "The Systems Engineering Process • Systems Engineering Process Overview • Requirements Analysis • Functional Analysis and Allocation • Design Synthesis • Verification • Systems Engineering Process Outputs",
            "activities": "Group Workshop on Functional Analysis and Allocation Activity: In small groups, students will break down system requirements into functional components and allocate these to hypothetical subsystems. Group Workshop on Functional Analysis and Allocation In small groups, students will break down system requirements into functional components and allocate these to hypothetical subsystems. Reflection Assignment on Process Outputs Have students reflect on the outputs generated at each stage of the systems engineering process and discuss how these support project success.",
            "assessment": "Requirements Analysis Report Assign students a hypothetical project scenario where they must identify, analyze, and document key system requirements based on provided stakeholder needs. Functional Analysis and Allocation Diagram Description: Have students create a functional flow diagram for a system based on a given set of requirements, breaking down functions and allocating them to subsystems. Design Synthesis Project Description: Assign a design synthesis task where students create an initial design for a system, explaining how the design integrates functional requirements and meets project goals."
          }
        },
        {
          "caseId": "FV-11",
          "courseCode": "IE-402",
          "courseTitle": "Systems Engineering",
          "program": "BSIE",
          "relationshipKey": "Content-activity",
          "relationshipName": "Course Content ↔ Learning Activities",
          "week": "Week 5-8",
          "lesson": "The Systems Engineering Process",
          "statements": [
            {
              "role": "Course content, Week 5-8",
              "text": "The Systems Engineering Process • Systems Engineering Process Overview • Requirements Analysis • Functional Analysis and Allocation • Design Synthesis • Verification • Systems Engineering Process Outputs"
            },
            {
              "role": "Learning activities, Week 5-8",
              "text": "Group Workshop on Functional Analysis and Allocation Activity: In small groups, students will break down system requirements into functional components and allocate these to hypothetical subsystems. Group Workshop on Functional Analysis and Allocation In small groups, students will break down system requirements into functional components and allocate these to hypothetical subsystems. Reflection Assignment on Process Outputs Have students reflect on the outputs generated at each stage of the systems engineering process and discuss how these support project success."
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "The Systems Engineering Process • Systems Engineering Process Overview • Requirements Analysis • Functional Analysis and Allocation • Design Synthesis • Verification • Systems Engineering Process Outputs",
            "activities": "Group Workshop on Functional Analysis and Allocation Activity: In small groups, students will break down system requirements into functional components and allocate these to hypothetical subsystems. Group Workshop on Functional Analysis and Allocation In small groups, students will break down system requirements into functional components and allocate these to hypothetical subsystems. Reflection Assignment on Process Outputs Have students reflect on the outputs generated at each stage of the systems engineering process and discuss how these support project success.",
            "assessment": "Requirements Analysis Report Assign students a hypothetical project scenario where they must identify, analyze, and document key system requirements based on provided stakeholder needs. Functional Analysis and Allocation Diagram Description: Have students create a functional flow diagram for a system based on a given set of requirements, breaking down functions and allocating them to subsystems. Design Synthesis Project Description: Assign a design synthesis task where students create an initial design for a system, explaining how the design integrates functional requirements and meets project goals."
          }
        },
        {
          "caseId": "FV-12",
          "courseCode": "IE-402",
          "courseTitle": "Systems Engineering",
          "program": "BSIE",
          "relationshipKey": "ILO-CLO",
          "relationshipName": "ILO ↔ CLO",
          "week": "Week 10-11",
          "lesson": "Systems Analysis and Control",
          "statements": [
            {
              "role": "Intended learning outcome (ILO), Week 10-11",
              "text": "ILO6: Create and interpret a WBS to organize and manage project components, identifying key deliverables and tasks for effective project planning and control. [CLO 3] [CLO4]"
            },
            {
              "role": "Course learning outcome, CLO 4 (Integration of Values)",
              "text": "Demonstrate the Filipino- Catholic Augustinian Spirituality through value webbing."
            }
          ],
          "iloCloMapping": {
            "ilo": "ILO6: Create and interpret a WBS to organize and manage project components, identifying key deliverables and tasks for effective project planning and control. [CLO 3] [CLO4]",
            "mappingAsPrinted": "[CLO 3] [CLO4]",
            "cloInThisRelationship": 4,
            "cloStatement": "Demonstrate the Filipino- Catholic Augustinian Spirituality through value webbing.",
            "requiredClassification": "Integration of Values",
            "weeklyCourseContent": "Systems Analysis and Control • Work Breakdown Structure • Configuration Management • Technical Reviews and Audits • Trade Studies • Modeling and Simulation • Metrics • Risk Management"
          },
          "weekContext": {
            "content": "Systems Analysis and Control • Work Breakdown Structure • Configuration Management • Technical Reviews and Audits • Trade Studies • Modeling and Simulation • Metrics • Risk Management",
            "activities": "Interactive Workshop on Work Breakdown Structure (WBS) Creation Activity: Conduct an interactive workshop where students create a WBS for a hypothetical project, breaking down tasks and identifying deliverables. Case Study on Configuration Management Activity: Present a case study demonstrating configuration management principles and practices in a real- world project. Have students discuss the role of configuration management in maintaining system consistency. Risk Management Analysis Activity Activity: Present a project scenario and ask students to identify potential risks, assess their impact and probability, and develop mitigation strategies.",
            "assessment": "Peer Review of Experimental Design and Robustness Plan Ask students to peer review each other’s experimental design proposals and robustness plans, providing constructive feedback on methodology and approach. Risk Assessment and Mitigation in Robust Design Assign a task where students assess potential risks to robustness in a system design and develop mitigation strategies to address these risks."
          }
        },
        {
          "caseId": "FV-13",
          "courseCode": "IE-402",
          "courseTitle": "Systems Engineering",
          "program": "BSIE",
          "relationshipKey": "Activity-assessment",
          "relationshipName": "Learning Activities ↔ Assessment",
          "week": "Week 10-11",
          "lesson": "Systems Analysis and Control",
          "statements": [
            {
              "role": "Learning activities, Week 10-11",
              "text": "Interactive Workshop on Work Breakdown Structure (WBS) Creation Activity: Conduct an interactive workshop where students create a WBS for a hypothetical project, breaking down tasks and identifying deliverables. Case Study on Configuration Management Activity: Present a case study demonstrating configuration management principles and practices in a real- world project. Have students discuss the role of configuration management in maintaining system consistency. Risk Management Analysis Activity Activity: Present a project scenario and ask students to identify potential risks, assess their impact and probability, and develop mitigation strategies."
            },
            {
              "role": "Assessment, Week 10-11",
              "text": "Peer Review of Experimental Design and Robustness Plan Ask students to peer review each other’s experimental design proposals and robustness plans, providing constructive feedback on methodology and approach. Risk Assessment and Mitigation in Robust Design Assign a task where students assess potential risks to robustness in a system design and develop mitigation strategies to address these risks."
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "Systems Analysis and Control • Work Breakdown Structure • Configuration Management • Technical Reviews and Audits • Trade Studies • Modeling and Simulation • Metrics • Risk Management",
            "activities": "Interactive Workshop on Work Breakdown Structure (WBS) Creation Activity: Conduct an interactive workshop where students create a WBS for a hypothetical project, breaking down tasks and identifying deliverables. Case Study on Configuration Management Activity: Present a case study demonstrating configuration management principles and practices in a real- world project. Have students discuss the role of configuration management in maintaining system consistency. Risk Management Analysis Activity Activity: Present a project scenario and ask students to identify potential risks, assess their impact and probability, and develop mitigation strategies.",
            "assessment": "Peer Review of Experimental Design and Robustness Plan Ask students to peer review each other’s experimental design proposals and robustness plans, providing constructive feedback on methodology and approach. Risk Assessment and Mitigation in Robust Design Assign a task where students assess potential risks to robustness in a system design and develop mitigation strategies to address these risks."
          }
        },
        {
          "caseId": "FV-14",
          "courseCode": "IE-402",
          "courseTitle": "Systems Engineering",
          "program": "BSIE",
          "relationshipKey": "Content-ILO",
          "relationshipName": "Course Content ↔ ILO",
          "week": "Week 12-14",
          "lesson": "Planning, Organizing and Managing",
          "statements": [
            {
              "role": "Course content, Week 12-14",
              "text": "Planning, Organizing and Managing • Systems Engineering Planning • Product Improvement Strategies • Organizing and Integrating System Development • Contractual Considerations • Management Considerations and Summary"
            },
            {
              "role": "Intended learning outcome (ILO), Week 12-14",
              "text": "ILO10: Evaluate essential management considerations—such as resource allocation, risk assessment, and stakeholder engagement—and their impact on project success, applying these principles to real or simulated project scenarios. [CLO 3] [CLO4]"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "Planning, Organizing and Managing • Systems Engineering Planning • Product Improvement Strategies • Organizing and Integrating System Development • Contractual Considerations • Management Considerations and Summary",
            "activities": "Workshop on Systems Engineering Planning Conduct a hands-on workshop where students outline a systems engineering plan for a hypothetical project. They should include project objectives, resource allocation, timeline planning, and key milestones. Product Improvement Strategy Brainstorming Session In groups, students brainstorm and propose strategies for iterative product improvement in a given scenario, focusing on design, functionality, and customer feedback loops.",
            "assessment": "Systems Engineering Plan Development Task: Have students create a comprehensive systems engineering plan for a hypothetical project. This plan should include objectives, resource allocation, timeline, milestones, risk assessment, and project phases. Product Improvement Strategy Proposal Task: Ask students to develop a proposal for a product improvement strategy for an existing system, identifying areas for enhancement and proposing solutions to improve quality, efficiency, and user satisfaction."
          }
        },
        {
          "caseId": "FV-15",
          "courseCode": "IE-402",
          "courseTitle": "Systems Engineering",
          "program": "BSIE",
          "relationshipKey": "Activity-assessment",
          "relationshipName": "Learning Activities ↔ Assessment",
          "week": "Week 12-14",
          "lesson": "Planning, Organizing and Managing",
          "statements": [
            {
              "role": "Learning activities, Week 12-14",
              "text": "Workshop on Systems Engineering Planning Conduct a hands-on workshop where students outline a systems engineering plan for a hypothetical project. They should include project objectives, resource allocation, timeline planning, and key milestones. Product Improvement Strategy Brainstorming Session In groups, students brainstorm and propose strategies for iterative product improvement in a given scenario, focusing on design, functionality, and customer feedback loops."
            },
            {
              "role": "Assessment, Week 12-14",
              "text": "Systems Engineering Plan Development Task: Have students create a comprehensive systems engineering plan for a hypothetical project. This plan should include objectives, resource allocation, timeline, milestones, risk assessment, and project phases. Product Improvement Strategy Proposal Task: Ask students to develop a proposal for a product improvement strategy for an existing system, identifying areas for enhancement and proposing solutions to improve quality, efficiency, and user satisfaction."
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "Planning, Organizing and Managing • Systems Engineering Planning • Product Improvement Strategies • Organizing and Integrating System Development • Contractual Considerations • Management Considerations and Summary",
            "activities": "Workshop on Systems Engineering Planning Conduct a hands-on workshop where students outline a systems engineering plan for a hypothetical project. They should include project objectives, resource allocation, timeline planning, and key milestones. Product Improvement Strategy Brainstorming Session In groups, students brainstorm and propose strategies for iterative product improvement in a given scenario, focusing on design, functionality, and customer feedback loops.",
            "assessment": "Systems Engineering Plan Development Task: Have students create a comprehensive systems engineering plan for a hypothetical project. This plan should include objectives, resource allocation, timeline, milestones, risk assessment, and project phases. Product Improvement Strategy Proposal Task: Ask students to develop a proposal for a product improvement strategy for an existing system, identifying areas for enhancement and proposing solutions to improve quality, efficiency, and user satisfaction."
          }
        },
        {
          "caseId": "FV-16",
          "courseCode": "IE-402",
          "courseTitle": "Systems Engineering",
          "program": "BSIE",
          "relationshipKey": "ILO-activity",
          "relationshipName": "ILO ↔ Learning Activities",
          "week": "Week 15-17",
          "lesson": "Application",
          "statements": [
            {
              "role": "Intended learning outcome (ILO), Week 15-17",
              "text": "ILO 12: Develop and execute experiments to validate design assumptions, analyze system behaviors, and refine solutions, demonstrating an understanding of experimental design and data collection principles. [CLO 3] [CLO4]"
            },
            {
              "role": "Learning activities, Week 15-17",
              "text": "Case Study Discussion: Systems Engineering as a Human Activity Provide a case study that highlights the role of human factors in systems engineering, including team dynamics, stakeholder involvement, and ethical considerations. Facilitate a class discussion on the human-centered aspects and their impact on project outcomes. Design and Conduct Experiments Activity Assign students a mini- project to design and conduct an experiment to validate a system component or process. They should identify the objective, develop a methodology, collect data, and analyze results to inform design improvements. Robust Design Brainstorming Session (Robust Design I) In small groups, students brainstorm how to apply basic robust design principles to make a system more stable under varying conditions. They discuss factors that influence system stability and propose design adjustments to minimize variability. Advanced Robust Design Project (Robust Design II) Activity: For a more complex project, students apply advanced robust design techniques to a hypothetical or real-world system. They identify and control multiple variables to minimize performance variation across diverse scenarios."
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "Application • Systems Engineering As Human Activity • Trade Space Exploration Concept Selection • Experiments • Robust Design I • Robust Design II",
            "activities": "Case Study Discussion: Systems Engineering as a Human Activity Provide a case study that highlights the role of human factors in systems engineering, including team dynamics, stakeholder involvement, and ethical considerations. Facilitate a class discussion on the human-centered aspects and their impact on project outcomes. Design and Conduct Experiments Activity Assign students a mini- project to design and conduct an experiment to validate a system component or process. They should identify the objective, develop a methodology, collect data, and analyze results to inform design improvements. Robust Design Brainstorming Session (Robust Design I) In small groups, students brainstorm how to apply basic robust design principles to make a system more stable under varying conditions. They discuss factors that influence system stability and propose design adjustments to minimize variability. Advanced Robust Design Project (Robust Design II) Activity: For a more complex project, students apply advanced robust design techniques to a hypothetical or real-world system. They identify and control multiple variables to minimize performance variation across diverse scenarios.",
            "assessment": "Robust Design I – System Evaluation and Improvement Proposal Task: Have students apply basic robust design techniques to evaluate a system and propose design changes that would make it more stable under varying conditions. They should identify critical factors that affect performance and suggest improvements to minimize variability. Robust Design II – Advanced Design Analysis Task: For a more complex system, students should apply advanced robust design methods to assess and improve the system’s performance. They will use tools such as design of experiments (DOE) to explore multiple design variables and their interactions. Robust Design Report (I & II) Task: Students will submit a report for each part of the robust design application, detailing the steps taken to assess and improve system performance. For Robust Design I, they will focus on basic principles, and for Robust Design II, they will apply advanced techniques to optimize the system."
          }
        }
      ]
    },
    {
      "courseCode": "CpE 304",
      "courseTitle": "Fundamentals of Mixed Signals and Sensors",
      "program": "BSCPE",
      "reviewerCodes": [
        "R-CPE-01",
        "R-CPE-02"
      ],
      "adjudicatorCode": "ADJ-CPE-01",
      "caseCount": 5,
      "cases": [
        {
          "caseId": "FV-17",
          "courseCode": "CpE 304",
          "courseTitle": "Fundamentals of Mixed Signals and Sensors",
          "program": "BSCPE",
          "relationshipKey": "ILO-CLO",
          "relationshipName": "ILO ↔ CLO",
          "week": "Week 2-3",
          "lesson": "II. Introduction to Electronic System",
          "statements": [
            {
              "role": "Intended learning outcome (ILO), Week 2-3",
              "text": "ILO2: Understand the design process of electronic circuits and systems. [CLO1]"
            },
            {
              "role": "Course learning outcome, CLO 1 (Introductory)",
              "text": "Identify the design process of electronic circuits and systems and conduct experiments involving sensors and mixed-signal systems, analyze data, and interpret results to improve performance and reliability."
            }
          ],
          "iloCloMapping": {
            "ilo": "ILO2: Understand the design process of electronic circuits and systems. [CLO1]",
            "mappingAsPrinted": "[CLO1]",
            "cloInThisRelationship": 1,
            "cloStatement": "Identify the design process of electronic circuits and systems and conduct experiments involving sensors and mixed-signal systems, analyze data, and interpret results to improve performance and reliability.",
            "requiredClassification": "Introductory",
            "weeklyCourseContent": "II. Introduction to Electronic System • History of Electronics • Electronic Signals and Notation • Classifications of Electronic Systems • Specifications of Electronic Systems • Design of Electronic Systems • Design of Electronic Circuits • Electronic Devices • Emerging Electronics Differential Amplifiers • Introduction to Differential Amplifiers • Block Diagram • Differential Gain • Common Mode Gain • CMRR • Configuration of differential amplifiers"
          },
          "weekContext": {
            "content": "II. Introduction to Electronic System • History of Electronics • Electronic Signals and Notation • Classifications of Electronic Systems • Specifications of Electronic Systems • Design of Electronic Systems • Design of Electronic Circuits • Electronic Devices • Emerging Electronics Differential Amplifiers • Introduction to Differential Amplifiers • Block Diagram • Differential Gain • Common Mode Gain • CMRR • Configuration of differential amplifiers",
            "activities": "• Lecture- Discussion using PowerPoint",
            "assessment": "• Quiz on the topics discussed"
          }
        },
        {
          "caseId": "FV-18",
          "courseCode": "CpE 304",
          "courseTitle": "Fundamentals of Mixed Signals and Sensors",
          "program": "BSCPE",
          "relationshipKey": "ILO-activity",
          "relationshipName": "ILO ↔ Learning Activities",
          "week": "Week 2-3",
          "lesson": "II. Introduction to Electronic System",
          "statements": [
            {
              "role": "Intended learning outcome (ILO), Week 2-3",
              "text": "ILO1: To develop skills in analysis and design of both analog and digital circuits [CLO1]"
            },
            {
              "role": "Learning activities, Week 2-3",
              "text": "• Lecture- Discussion using PowerPoint"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "II. Introduction to Electronic System • History of Electronics • Electronic Signals and Notation • Classifications of Electronic Systems • Specifications of Electronic Systems • Design of Electronic Systems • Design of Electronic Circuits • Electronic Devices • Emerging Electronics Differential Amplifiers • Introduction to Differential Amplifiers • Block Diagram • Differential Gain • Common Mode Gain • CMRR • Configuration of differential amplifiers",
            "activities": "• Lecture- Discussion using PowerPoint",
            "assessment": "• Quiz on the topics discussed"
          }
        },
        {
          "caseId": "FV-19",
          "courseCode": "CpE 304",
          "courseTitle": "Fundamentals of Mixed Signals and Sensors",
          "program": "BSCPE",
          "relationshipKey": "Content-activity",
          "relationshipName": "Course Content ↔ Learning Activities",
          "week": "Week 4-5",
          "lesson": "III. INTRODUCTION TO OPERATIONAL AMPLIFIERS AND APPLICATIONS",
          "statements": [
            {
              "role": "Course content, Week 4-5",
              "text": "III. INTRODUCTION TO OPERATIONAL AMPLIFIERS AND APPLICATIONS • Characteristics of Ideal Op- Amps • Noninverting Amplifiers • Inverting Amplifiers • Instrumentatio n Amplifiers • Integrators • Differentiators • Addition– Subtraction Amplifiers • Large-Signal Operations of Op-Amps • Input Offset Voltage • Input Offset Current • Op-Amp Circuit Design Linear and Non Linear Applications of Op-Amp • Linear Op-amp • Non-linear Op- amp"
            },
            {
              "role": "Learning activities, Week 4-5",
              "text": "• Lecture- Discussion using PowerPoint"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "III. INTRODUCTION TO OPERATIONAL AMPLIFIERS AND APPLICATIONS • Characteristics of Ideal Op- Amps • Noninverting Amplifiers • Inverting Amplifiers • Instrumentatio n Amplifiers • Integrators • Differentiators • Addition– Subtraction Amplifiers • Large-Signal Operations of Op-Amps • Input Offset Voltage • Input Offset Current • Op-Amp Circuit Design Linear and Non Linear Applications of Op-Amp • Linear Op-amp • Non-linear Op- amp",
            "activities": "• Lecture- Discussion using PowerPoint",
            "assessment": "• Quiz on the topics discussed"
          }
        },
        {
          "caseId": "FV-20",
          "courseCode": "CpE 304",
          "courseTitle": "Fundamentals of Mixed Signals and Sensors",
          "program": "BSCPE",
          "relationshipKey": "Content-assessment",
          "relationshipName": "Course Content ↔ Assessment",
          "week": "Week 9-11",
          "lesson": "V. Mixed Signals Basic Measurement Theory",
          "statements": [
            {
              "role": "Course content, Week 9-11",
              "text": "V. Mixed Signals Basic Measurement Theory • IC Test • Linearity"
            },
            {
              "role": "Assessment, Week 9-11",
              "text": "• Quiz on the topics discussed"
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "V. Mixed Signals Basic Measurement Theory • IC Test • Linearity",
            "activities": "• Lecture- Discussion using PowerPoint",
            "assessment": "• Quiz on the topics discussed"
          }
        },
        {
          "caseId": "FV-21",
          "courseCode": "CpE 304",
          "courseTitle": "Fundamentals of Mixed Signals and Sensors",
          "program": "BSCPE",
          "relationshipKey": "Content-ILO",
          "relationshipName": "Course Content ↔ ILO",
          "week": "Week 13-14",
          "lesson": "VI. Sensors and Transducers",
          "statements": [
            {
              "role": "Course content, Week 13-14",
              "text": "VI. Sensors and Transducers ● Sensitivity & Hysteresis ● Offset Error & Non- linearity"
            },
            {
              "role": "Intended learning outcome (ILO), Week 13-14",
              "text": "ILO8: Understand the different Sensors and Transducers."
            }
          ],
          "iloCloMapping": null,
          "weekContext": {
            "content": "VI. Sensors and Transducers ● Sensitivity & Hysteresis ● Offset Error & Non- linearity",
            "activities": "• Lecture- Discussion using PowerPoint",
            "assessment": "• Quiz on the topics discussed"
          }
        }
      ]
    }
  ]
};

const JUDGMENT_OPTIONS = [
  'ALIGNED',
  'PARTIALLY_ALIGNED',
  'NOT_ALIGNED',
  'INSUFFICIENT_EVIDENCE'
];

// SAFETY LOCK: Set to true only if intentionally regenerating official forms after clearing prior files
const FORCE_REGENERATE = false;

/**
 * Main deployment function: Generates the 3 official forms and linked spreadsheets.
 */
function generateAllValidationForms() {
  Logger.log('===============================================================');
  Logger.log('LCUP SYLLABUS MANAGEMENT SYSTEM — OFFICIAL FACULTY VALIDATION GENERATOR');
  Logger.log('===============================================================');

  // Guard: Prevent accidental duplicate creation
  const props = PropertiesService.getScriptProperties();
  const priorDeployment = props.getProperty('LCUP_VALIDATION_DEPLOYED_AT');
  if (priorDeployment && !FORCE_REGENERATE) {
    Logger.log('ABORTED: Official validation forms were already generated on ' + priorDeployment + '.');
    Logger.log('Existing Coordinator Directory Sheet ID: ' + (props.getProperty('LCUP_COORDINATOR_SHEET_ID') || 'N/A'));
    Logger.log('To regenerate forms intentionally:');
    Logger.log('  1. Run resetValidationDeployment() to clear the deployment lock, OR');
    Logger.log('  2. Set FORCE_REGENERATE = true at the top of Code.gs.');
    Logger.log('===============================================================');
    return;
  }

  // Step 1: Pre-execution validation
  verifyCaseIntegrity();

  const results = [];
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd_HH-mm');
  const deployedFormIds = [];
  const deployedSheetIds = [];

  // Step 2: Iterate and generate each course form
  for (const course of VALIDATION_BUNDLE.courses) {
    Logger.log('\n>>> Generating Official Form for: ' + course.courseCode + ' (' + course.courseTitle + ')');
    const formRecord = buildFormForCourse(course, timestamp);
    results.push(formRecord);
    deployedFormIds.push(formRecord.formId);
    deployedSheetIds.push(formRecord.sheetId);
  }

  // Step 3: Create Coordinator Master Directory Spreadsheet
  Logger.log('\n===============================================================');
  Logger.log('ALL OFFICIAL FORMS SUCCESSFULLY CREATED AND LINKED:');
  Logger.log('===============================================================');

  const summarySheet = SpreadsheetApp.create('LCUP Validation Forms — Coordinator Directory (' + timestamp + ')');
  const sheet = summarySheet.getActiveSheet();
  sheet.appendRow([
    'Course Code',
    'Course Title',
    'Program',
    'Case Count',
    'Assigned Reviewers',
    'Discipline Adjudicator',
    'Reviewer Form URL (Responder)',
    'Coordinator Edit URL',
    'Response Spreadsheet URL'
  ]);
  sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#E2E8F0');

  for (const r of results) {
    Logger.log('\n[' + r.courseCode + '] ' + r.courseTitle);
    Logger.log('  Cases: ' + r.caseCount);
    Logger.log('  Reviewers: ' + r.reviewerCodes.join(', ') + ' | Adjudicator: ' + r.adjudicatorCode);
    Logger.log('  Reviewer Form URL: ' + r.publishedUrl);
    Logger.log('  Coordinator Edit URL: ' + r.editUrl);
    Logger.log('  Linked Response Sheet: ' + r.sheetUrl);

    sheet.appendRow([
      r.courseCode,
      r.courseTitle,
      r.program,
      r.caseCount,
      r.reviewerCodes.join(', '),
      r.adjudicatorCode,
      r.publishedUrl,
      r.editUrl,
      r.sheetUrl
    ]);
  }

  sheet.autoResizeColumns(1, 9);

  // Set script properties to lock deployment
  props.setProperty('LCUP_VALIDATION_DEPLOYED_AT', timestamp);
  props.setProperty('LCUP_COORDINATOR_SHEET_ID', summarySheet.getId());
  props.setProperty('LCUP_DEPLOYED_FORM_IDS', JSON.stringify(deployedFormIds));
  props.setProperty('LCUP_DEPLOYED_SHEET_IDS', JSON.stringify(deployedSheetIds));

  Logger.log('\nCoordinator Directory saved at: ' + summarySheet.getUrl());
  Logger.log('Deployment locked. Official forms remain in pristine 0-response state.');
  Logger.log('===============================================================');
}

/**
 * Builds a single course Google Form and links its response spreadsheet.
 */
function buildFormForCourse(course, timestamp) {
  const formTitle = 'LCUP Faculty Validation — ' + course.courseCode + ' (' + course.courseTitle + ')';
  const form = FormApp.create(formTitle);

  // 1. Form Description & Introduction
  form.setDescription(
    'LCUP Syllabus Management System — Independent Faculty Validation Pilot\n' +
    'Course: ' + course.courseCode + ' — ' + course.courseTitle + ' (' + course.program + ')\n\n' +
    'WELCOME & INSTRUCTIONS:\n' +
    'Thank you for contributing your academic expertise to validate outcome-based education (OBE) syllabus alignment. ' +
    'In this form, you will evaluate ' + course.cases.length + ' isolated academic relationship pairs extracted directly from the approved syllabus.\n\n' +
    'EVALUATION PRINCIPLES:\n' +
    '1. Independent Review: Complete this evaluation independently without consulting other reviewers or syllabus authors.\n' +
    '2. Human Judgment Only: Do not use generative AI, chatbots, or automated checkers.\n' +
    '3. Meaning Over Formatting: Judge pedagogical coherence and substantive alignment, not formatting or numbering.\n' +
    '4. Four Standard Judgments:\n' +
    '   - ALIGNED: Supplied evidence mutually supports the relationship with no material gap.\n' +
    '   - PARTIALLY_ALIGNED: Meaningful support exists, but a material gap, scope mismatch, or ambiguity remains.\n' +
    '   - NOT_ALIGNED: Substantiated disconnect, contradiction, or unrelated subject matter.\n' +
    '   - INSUFFICIENT_EVIDENCE: Statement text is too brief, circular, or generic to support a defensible judgment.\n\n' +
    'Your responses are saved upon submission. You may edit your submission until the review window closes.'
  );

  // 2. Form Settings (Domain Authentication + Responder Privacy)
  form.setAllowResponseEdits(true);
  form.setPublishingSummary(false); // CRITICAL: Reviewers CANNOT view peer responses
  form.setShowLinkToRespondAgain(false);
  form.setProgressBar(true);
  form.setConfirmationMessage(
    'Thank you for submitting your expert evaluation for ' + course.courseCode + '. ' +
    'Your responses have been securely recorded for the LCUP Academic Validation Study.'
  );

  // Domain Authentication with Pseudonymous Data Recording
  try {
    form.setRequireLogin(true);   // Restricts access strictly to authorized institutional domain accounts
    form.setCollectEmail(false);  // Preserves reviewer pseudonymity in exported research data
  } catch (e) {
    Logger.log('Notice on access settings for ' + course.courseCode + ': ' + e.message);
  }

  // 3. Section 1: Reviewer Identification (Strictly Appointed Faculty Reviewers Only)
  const reviewerItem = form.addListItem();
  reviewerItem.setTitle('Reviewer Identification Code');
  reviewerItem.setHelpText('Select your assigned confidential reviewer code.');
  reviewerItem.setChoices(course.reviewerCodes.map(code => reviewerItem.createChoice(code)));
  reviewerItem.setRequired(true);

  const declarationItem = form.addCheckboxItem();
  declarationItem.setTitle('Reviewer Declaration & Compliance');
  declarationItem.setChoices([
    declarationItem.createChoice('I confirm that I am conducting this academic evaluation independently, relying on my professional subject-matter expertise without using generative AI assistance.')
  ]);
  declarationItem.setRequired(true);

  // 4. Case Sections: Exactly one page break per case
  for (let i = 0; i < course.cases.length; i++) {
    const c = course.cases[i];

    // Page Break for Case
    form.addPageBreakItem()
      .setTitle('Case ' + c.caseId + ' of ' + course.cases.length + ' — ' + c.relationshipName)
      .setHelpText('Academic Relationship: ' + c.relationshipName + ' (' + c.relationshipKey + ')\n' +
                   'Curricular Placement: ' + c.lesson + ' (' + c.week + ')');

    // Section Header / Evidence Display
    let evidenceText = 'SYLLABUS EVIDENCE FOR THIS CASE:\n\n';
    for (let sIdx = 0; sIdx < c.statements.length; sIdx++) {
      const st = c.statements[sIdx];
      evidenceText += '📌 Statement ' + (sIdx + 1) + ' [' + st.role + ']:\n"' + st.text + '"\n\n';
    }

    if (c.iloCloMapping) {
      evidenceText += '📋 MAPPED CLO CONTEXT:\n' +
                      '• CLO Statement: "' + c.iloCloMapping.cloStatement + '"\n' +
                      '• Required Classification: ' + c.iloCloMapping.requiredClassification + '\n' +
                      '• Syllabus Mapping as Printed: ' + c.iloCloMapping.mappingAsPrinted + '\n\n';
    }

    evidenceText += '🔍 SURROUNDING LESSON CONTEXT (' + c.week + '):\n' +
                    '• Course Content: ' + (c.weekContext.content || 'N/A') + '\n' +
                    '• Activities: ' + (c.weekContext.activities || 'N/A') + '\n' +
                    '• Assessment: ' + (c.weekContext.assessment || 'N/A');

    const evidenceSection = form.addSectionHeaderItem();
    evidenceSection.setTitle('Syllabus Excerpts: ' + c.caseId);
    evidenceSection.setHelpText(evidenceText);

    // Question 1: Alignment Judgment
    const judgmentItem = form.addMultipleChoiceItem();
    judgmentItem.setTitle('[' + c.caseId + '] Academic Alignment Judgment');
    judgmentItem.setHelpText(
      'Select the discrete judgment that best reflects the alignment between the two statements above.\n' +
      'ALIGNED: Fully supported | PARTIALLY_ALIGNED: Meaningful support but material gap | ' +
      'NOT_ALIGNED: Substantiated mismatch | INSUFFICIENT_EVIDENCE: Cannot be defended either way.'
    );
    judgmentItem.setChoices(JUDGMENT_OPTIONS.map(opt => judgmentItem.createChoice(opt)));
    judgmentItem.setRequired(true);

    // Question 2: Academic Justification / Explanation
    const explanationItem = form.addParagraphTextItem();
    explanationItem.setTitle('[' + c.caseId + '] Academic Justification / Explanation');
    explanationItem.setHelpText(
      'Detail your academic reasoning. If you noted a gap or mismatch, identify which specific competency, ' +
      'action verb level, or subject matter is missing or inconsistent. For INSUFFICIENT_EVIDENCE, explain why the text is non-evaluable.'
    );
    explanationItem.setRequired(true);

    // Question 3: Supporting Syllabus Evidence / Explanation of Missing Evidence
    const quotesItem = form.addParagraphTextItem();
    quotesItem.setTitle('[' + c.caseId + '] Supporting Syllabus Evidence');
    quotesItem.setHelpText(
      'Quote verbatim phrases from the syllabus statements that substantiate your judgment. ' +
      'If you selected INSUFFICIENT_EVIDENCE because the syllabus lacks necessary details or is circular/generic, explicitly describe what evidence is missing.'
    );
    quotesItem.setRequired(true);

    // Question 4: Recommended Correction (Optional)
    const correctionItem = form.addParagraphTextItem();
    correctionItem.setTitle('[' + c.caseId + '] Recommended Correction (Optional)');
    correctionItem.setHelpText(
      'If you judged PARTIALLY_ALIGNED or NOT_ALIGNED, propose constructive replacement text and specify which component ' +
      '(content, ILO, activity, or assessment) should be revised. Enter "None" if aligned.'
    );
    correctionItem.setRequired(false);
  }

  // 5. Link to Google Sheet Destination
  const sheetTitle = 'LCUP Faculty Validation Responses — ' + course.courseCode + ' (' + timestamp + ')';
  const spreadsheet = SpreadsheetApp.create(sheetTitle);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());

  return {
    formId: form.getId(),
    sheetId: spreadsheet.getId(),
    courseCode: course.courseCode,
    courseTitle: course.courseTitle,
    program: course.program,
    caseCount: course.cases.length,
    reviewerCodes: course.reviewerCodes,
    adjudicatorCode: course.adjudicatorCode,
    publishedUrl: form.getPublishedUrl(),
    editUrl: form.getEditUrl(),
    sheetUrl: spreadsheet.getUrl()
  };
}

/**
 * Dedicated Synthetic Test Deployment: Creates an isolated test form with synthetic data.
 * Does NOT touch or contaminate official faculty validation forms or spreadsheets.
 */
function generateTestValidationForm() {
  Logger.log('>>> Creating Isolated Synthetic Test Form (Coordinator Pre-Launch Trial)...');
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd_HH-mm');
  const testTitle = 'LCUP Faculty Validation — SYNTHETIC TEST FORM (' + timestamp + ')';
  const testForm = FormApp.create(testTitle);

  testForm.setDescription(
    'ISOLATED SYNTHETIC TEST FORM FOR COORDINATOR TRIAL ONLY.\n' +
    'This form contains fictional test cases to verify Google Forms submission, editing, ' +
    'and CSV export behavior without contaminating official evaluation records.'
  );

  testForm.setAllowResponseEdits(true);
  testForm.setPublishingSummary(false);
  testForm.setRequireLogin(true);
  testForm.setCollectEmail(false);

  // Test Reviewer Identification
  const revItem = testForm.addListItem();
  revItem.setTitle('Reviewer Identification Code');
  revItem.setChoices([
    revItem.createChoice('TEST-REVIEWER-01'),
    revItem.createChoice('TEST-REVIEWER-02')
  ]);
  revItem.setRequired(true);

  const decItem = testForm.addCheckboxItem();
  decItem.setTitle('Reviewer Declaration & Compliance');
  decItem.setChoices([decItem.createChoice('Test compliance declaration acknowledgment.')]);
  decItem.setRequired(true);

  // Add 2 Synthetic Test Cases
  const syntheticCases = [
    { id: 'FV-01', rel: 'Course Content ↔ Learning Activities', stmt1: 'Synthetic Introduction to Programming', stmt2: 'Hands-on practice exercises in programming lab.' },
    { id: 'FV-02', rel: 'Course Content ↔ ILO', stmt1: 'Syntax and loops', stmt2: 'ILO: Understand looping structures.' }
  ];

  for (const sc of syntheticCases) {
    testForm.addPageBreakItem().setTitle('Synthetic Case [' + sc.id + '] ' + sc.rel);
    const sec = testForm.addSectionHeaderItem();
    sec.setTitle('Synthetic Test Syllabus Excerpts');
    sec.setHelpText('📌 Statement 1: ' + sc.stmt1 + '\n📌 Statement 2: ' + sc.stmt2);

    const jItem = testForm.addMultipleChoiceItem();
    jItem.setTitle('[' + sc.id + '] Academic Alignment Judgment').setRequired(true);
    jItem.setChoices(JUDGMENT_OPTIONS.map(opt => jItem.createChoice(opt)));

    testForm.addParagraphTextItem().setTitle('[' + sc.id + '] Academic Justification / Explanation').setRequired(true);
    testForm.addParagraphTextItem().setTitle('[' + sc.id + '] Supporting Syllabus Evidence').setRequired(true);
    testForm.addParagraphTextItem().setTitle('[' + sc.id + '] Recommended Correction (Optional)').setRequired(false);
  }

  // Link to separate synthetic test spreadsheet
  const testSheet = SpreadsheetApp.create('LCUP Validation Responses — SYNTHETIC TEST (' + timestamp + ')');
  testForm.setDestination(FormApp.DestinationType.SPREADSHEET, testSheet.getId());

  Logger.log('Synthetic Test Form Created: ' + testForm.getPublishedUrl());
  Logger.log('Synthetic Test Sheet Created: ' + testSheet.getUrl());
  Logger.log('Coordinator may test submissions and CSV export using these separate test links.');
}

/**
 * Verifies exact 7/9/5 case distribution and case ID continuity.
 */
function verifyCaseIntegrity() {
  Logger.log('Verifying dataset integrity...');
  let totalCases = 0;
  const expected = { 'IT 202': 7, 'IE-402': 9, 'CpE 304': 5 };

  for (const course of VALIDATION_BUNDLE.courses) {
    const code = course.courseCode;
    const count = course.cases.length;
    if (count !== expected[code]) {
      throw new Error('Case distribution mismatch for ' + code + ': expected ' + expected[code] + ', got ' + count);
    }
    totalCases += count;
  }

  if (totalCases !== 21) {
    throw new Error('Total case count mismatch: expected 21, got ' + totalCases);
  }

  Logger.log('Integrity Check Passed: Exactly 21 cases across IT 202 (7), IE 402 (9), and CpE 304 (5).');
}

/**
 * Freezes evaluation records upon deadline:
 *   1. Sets setAcceptingResponses(false) on all official forms.
 *   2. Creates timestamped, read-only audit snapshot copies of each response spreadsheet.
 */
function closeValidationForms() {
  const props = PropertiesService.getScriptProperties();
  const formIds = JSON.parse(props.getProperty('LCUP_DEPLOYED_FORM_IDS') || '[]');
  const sheetIds = JSON.parse(props.getProperty('LCUP_DEPLOYED_SHEET_IDS') || '[]');
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd_HH-mm');

  if (!formIds.length) {
    Logger.log('No deployed official forms recorded in script properties.');
    return;
  }

  Logger.log('Freezing official validation forms...');
  for (const id of formIds) {
    const f = FormApp.openById(id);
    f.setAcceptingResponses(false);
    Logger.log('Closed submissions on: ' + f.getTitle());
  }

  Logger.log('\nCreating immutable, timestamped spreadsheet snapshots...');
  const snapshotFolder = DriveApp.createFolder('LCUP Faculty Validation — Frozen Audit Snapshots (' + timestamp + ')');
  for (const sId of sheetIds) {
    const origSheet = SpreadsheetApp.openById(sId);
    const copyFile = DriveApp.getFileById(sId).makeCopy('FROZEN_SNAPSHOT_' + origSheet.getName() + ' (' + timestamp + ')', snapshotFolder);
    const frozenSheet = SpreadsheetApp.openById(copyFile.getId());
    const protection = frozenSheet.getActiveSheet().protect().setDescription('Frozen Ground Truth Audit Snapshot — Read-Only');
    protection.removeEditors(protection.getEditors());
    Logger.log('Frozen Snapshot Created: ' + copyFile.getName() + ' => ' + copyFile.getUrl());
  }

  props.setProperty('LCUP_FROZEN_AT', timestamp);
  Logger.log('\nAll validation records are permanently frozen in folder: ' + snapshotFolder.getUrl());
  Logger.log('Responses are now ready for download, hashing, and discipline adjudication.');
}

/**
 * Reopens validation forms if an authorized administrative extension is granted.
 */
function reopenValidationForms() {
  const props = PropertiesService.getScriptProperties();
  const formIds = JSON.parse(props.getProperty('LCUP_DEPLOYED_FORM_IDS') || '[]');
  for (const id of formIds) {
    const f = FormApp.openById(id);
    f.setAcceptingResponses(true);
    Logger.log('Reopened form: ' + f.getTitle());
  }
}

/**
 * Clears deployment properties lock if intentional recreation of official forms is needed.
 */
function resetValidationDeployment() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('LCUP_VALIDATION_DEPLOYED_AT');
  props.deleteProperty('LCUP_COORDINATOR_SHEET_ID');
  props.deleteProperty('LCUP_DEPLOYED_FORM_IDS');
  props.deleteProperty('LCUP_DEPLOYED_SHEET_IDS');
  props.deleteProperty('LCUP_FROZEN_AT');
  Logger.log('Deployment lock cleared. generateAllValidationForms() can now run.');
}
