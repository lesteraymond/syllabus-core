// The programs and subjects of the curricula in /curriculum (photos of the registrar's "Courses Curriculum" print-outs, 20 Oct 2026), typed in
// by hand. One line per subject:  year.term | code | title | prerequisites (separated by ;)
//   term: 1 = first semester, 2 = second semester, S = summer.
// Each program lists its own subjects (a subject code only has to be unique within its program). General education (GE, PATHFit, NSTP, TH)
// is left out of the catalog, so a prerequisite that names one is kept as a printed label, not a link.
// The units are the print-out's UNITS columns (lecture and laboratory), checked against each semester's printed total. Codes are written as printed, except that "IT-204" is "IT 204" and a trailing "-" (a print artefact) is dropped; a few obvious typos in the
// print-out are corrected in the titles ("Quantitattive", "Phyton", "Proferssional", "Internet to Things"). Where the photo is skewed, a
// prerequisite is placed on the row it lines up with.
// Read by lib/curriculumImport.js and db/seed-curriculum.js.
const parse = (text) => text.trim().split('\n').map((line) => {
  const [when, code, title, prereq = '', units = ''] = line.split('|').map((s) => s.trim());
  const [year, term] = when.split('.');
  const [lecture, lab] = units.split('/').map(Number);
  return { year: Number(year), term, code, title, prereq: prereq ? prereq.split(';').map((s) => s.trim()).filter(Boolean) : [], units: { lecture, lab } };
});

const BSIT = `
1.1 | IT 101 | Introduction to Computing |  | 3/0
1.2 | OFFTOOLS | Office Tools |  | 0/1
1.2 | IT 102 | Discrete Mathematics | IT 101 | 3/0
2.1 | IT 202 | Computer Programming 1 (Fundamentals of Programming) | IT 101 | 2/1
2.1 | IT 203 | Data Structure and Algorithm | IT 102 | 3/0
2.2 | IT 204 | Computer Programming 2 (Intermediate Programming) | IT 202 | 2/1
2.2 | IT 205 | Introduction to Human Computer Interaction | IT 202 | 3/0
3.1 | IT 301 | Computer Programming 3 (Object Oriented Programming) | IT 204 | 2/1
3.1 | IT 302 | Information Management 1 (Database Fundamental) | IT 202 | 2/1
3.1 | IT 303 | System Integration and Architecture | IT 204 | 2/1
3.1 | IT 304 | Computer Networks 1 (Fundamentals of Networking) | IT 101 | 2/1
3.1 | IT 305 | Web Systems and Technologies | IT 205 | 2/1
3.1 | IT-ELEC1 | IT Elective 1 (Intro. to Data Science in Python) | 3rd Yr | 2/1
3.2 | CAPSPRO 1 | Capstone Project 1 | 3rd Yr | 3/0
3.2 | TECHPREN-CITE | Technopreneurship | 3rd Yr | 3/0
3.2 | IT 306 | Information Management 2 (Advanced Database) | IT 302 | 2/1
3.2 | IT 307 | Computer Networks 2 (Advanced Networking) | IT 304 | 2/1
3.2 | IT 308 | System Integration and Architecture 2 | IT 303 | 2/1
3.2 | IT 309 | Information Assurance and Security | 3rd Yr | 2/1
3.2 | IT-ELEC2 | IT Elective 2 (Mobile Application Development) | 3rd Yr | 2/1
4.1 | CAPSPRO 2 | Capstone Project 2 | CAPSPRO 1 | 3/0
4.1 | IT 401 | Quantitative Methods (Including Modeling and Simulation) | IT 102 | 3/0
4.1 | IT 402 | Social and Professional Issues | 4th Yr | 3/0
4.1 | IT 403 | Application Development and Emerging Theories | 4th Yr | 2/1
4.1 | IT 404 | System Administration and Maintenance | 4th Yr | 2/1
4.1 | IT-ELEC3 | IT Elective 3 (Multimedia System) | IT-ELEC2; 4th Yr | 2/1
4.1 | IT-ELEC4 | IT Elective 4 (Web Systems and Technologies 2) | IT-ELEC2; 4th Yr | 2/1
4.2 | IT-PRAC | IT Practicum | 4th Yr | 6/0
4.2 | IS-CITE | Integrating Seminar | 4th Yr | 3/0
`;

const BSIT_CS = `
1.1 | IT 101 | Introduction to Computing |  | 3/0
1.1 | IT 102 | Discrete Mathematics |  | 3/0
1.1 | OFFTOOLS | Office Tools |  | 0/1
1.2 | IT 103 | Computer Programming 1 (Fundamentals of Programming) | IT 101 | 2/1
1.2 | IT 104 | Data Structure and Algorithm | IT 102 | 3/0
1.2 | IT 105 | Introduction to Human Computer Interaction | IT 101 | 3/0
2.1 | IT 201 | Computer Programming 2 (Intermediate Programming) | IT 103 | 2/1
2.1 | IT 202 | System Integration and Architecture 1 | IT 103 | 2/1
2.1 | IT 203 | Computer Networks 1 (Fundamentals of Networking) | IT 104 | 2/1
2.1 | IT 204 | Quantitative Methods (Including Modeling and Simulation) | IT 102 | 3/0
2.1 | IT 205 | Information Management 1 (Database Fundamental) | IT 103 | 2/1
2.2 | IT 206 | Computer Programming 3 (Object Oriented Programming) | IT 201 | 2/1
2.2 | IT 207 | Information Management 2 (Advanced Database) | IT 205 | 2/1
2.2 | IT 208 | Computer Networks 2 (Advanced Networking) | IT 203 | 2/1
2.2 | IT 209 | System Integration and Architecture 2 | IT 202 | 2/1
2.2 | IT 210 | Social and Professional Issues | IT 103 | 3/0
3.1 | CS 301 | Introduction to Digital Forensics | IT 208 | 2/1
3.1 | CS 302 | Internet of Things (IoT) | IT 209 | 3/0
3.1 | CS 303 | Essential Security Principles | IT 208 | 3/0
3.1 | CS 304 | Cybersecurity and Data Privacy: Law, Policies, and Practices | IT 209 | 3/0
3.1 | IT 305 | Web Systems and Technologies | IT 208 | 2/1
3.1 | IT 306 | Application Development and Emerging Theories | IT 209 | 2/1
3.1 | IT-ELEC1 | IT Elective 1 (Intro. to Data Science in Python) | IT 208 | 0/1
3.2 | CAPCYB 1 | Capstone for Cybersecurity 1 | CS 303; CS 304; CS 301 | 3/0
3.2 | TECHPREN-CITE | Technopreneurship | IT 210; 3rd Yr | 3/0
3.2 | CS 307 | Applied Cryptography | CS 304 | 3/0
3.2 | CS 308 | Cloud Computing for Cybersecurity | CS 302 | 2/1
3.2 | CS 309 | Hardware and Software Security | CS 304 | 3/0
3.2 | CS 310 | Information Assurance and Security | IT 208 | 2/1
3.2 | IT 307 | System Administration and Maintenance | IT 208 | 2/1
3.2 | IT-ELEC2 | IT Elective 2 (Mobile Application Development) | IT-ELEC1; 3rd Yr | 2/1
3.S | IT-ELEC3 | IT Elective 3 (Multimedia System) | IT-ELEC2 | 2/1
3.S | IT-ELEC4 | IT Elective 4 (Web Systems and Technologies 2) | IT-ELEC2 | 2/1
4.1 | CAPCYB 2 | Capstone for Cybersecurity 2 | CAPCYB 1 | 3/0
4.1 | CS 401 | Ethical Hacking and Counter Measures | CS 308 | 3/0
4.1 | CS 402 | Network Infrastructure Technology and Implementation | CS 308 | 0/1
4.1 | CS 403 | Cybersecurity Risk and Management Technology | CS 309 | 3/0
4.1 | CS 404 | Cybersecurity Attacks and Defense Strategies | CS 309 | 3/0
4.1 | IS-CITE | Integrating Seminar |  | 3/0
4.2 | IT-PRAC | IT Practicum | 4th Yr | 6/0
`;

const BSCPE = `
1.1 | MA 7 | Differential Calculus |  | 3/0
1.1 | CHEMENG | Chemistry for Engineers |  | 3/1
1.1 | CENGDIS | Computer Engineer as Discipline |  | 1/0
1.2 | MA 8 | Integral Calculus | MA 7 | 3/0
1.2 | PHYENG | Physics for Engineers | MA 7 | 3/1
1.2 | CPE 101 | Discrete Mathematics |  | 3/0
2.1 | MA 9DE | Differential Equations | MA 8 | 3/0
2.1 | ENGDA | Engineering Data Analysis | MA 7; MA 8 | 3/0
2.1 | PROLOG | Programming Logic and Design |  | 0/2
2.1 | FUNELC | Fundamentals of Electrical Circuits | PHYENG | 3/1
2.2 | OOPENG | Object Oriented Programming | PROLOG | 0/2
2.2 | ENGEC | Engineering Economics | 2nd Yr | 3/0
2.2 | NUMET | Numerical Methods | MA 7 | 3/0
2.2 | FUNEC | Fundamentals of Electronic Circuits | FUNELC | 3/1
2.2 | CAD | Computer Aided Drafting | 2nd Yr | 0/1
3.1 | CpE 300 | Data Structures and Algorithms | OOPENG | 0/2
3.1 | CpE 301 | Logic Circuit and Design | FUNEC; FUNELC | 3/1
3.1 | CpE 302 | Data and Digital Communications | FUNELC; FUNEC | 3/0
3.1 | CpE 303 | Feedback and Control Systems | FUNEC; FUNELC | 3/0
3.1 | CpE 304 | Fundamentals of Mixed Signal and Sensors | FUNEC; FUNELC | 3/0
3.1 | CpE 305 | Operating System | ENGDA | 3/0
3.1 | CpE 306 | CpE Laws and Professional Practice | 3rd Yr | 2/0
3.1 | COE 7 | Computer Engineering Drafting and Design | CAD | 0/1
3.1 | CpE-ELEC1 | Cognate/Elective 1 (Intro. to Data Science in Python) | 3rd Yr | 2/1
3.2 | SOFTDES | Software Design | CpE 300 | 3/1
3.2 | ENGBOHS | Basic Occupational Health and Safety | 3rd Yr | 3/0
3.2 | CpE 307 | Computer Networks and Security | CpE 302 | 3/1
3.2 | CpE 308 | Microprocessors | CpE 301 | 3/1
3.2 | CpE 309 | Methods of Research | CpE 301; ENGDA; GE - PC | 2/0
3.2 | CpE 310 | Introduction to HDL | FUNEC; CpE 301 | 0/1
3.2 | TECHPREN-CITE | Technopreneurship | 3rd Yr | 3/0
3.2 | CpE-ELEC2 | Cognate/Elective 2 (Platform Technologies) | 3rd Yr | 2/1
4.1 | CpE 401 | Embedded System | CpE 308 | 3/1
4.1 | CpE 402 | Computer Architecture and Organization | CpE 308 | 3/1
4.1 | CpE 403 | Emerging Technologies in CpE | 4th Yr | 3/0
4.1 | CpE 404 | Digital Signal Processing | CpE 303 | 3/1
4.1 | DesPro-1 | Design Project 1 | CpE 308; CpE 309 | 0/1
4.1 | CpE-ELEC3 | Cognate/Elective 3 (Web and Mobile Technologies) | 4th Yr | 2/1
4.2 | CpE 405 | Seminar and Fieldtrips | 4th Yr | 0/1
4.2 | DesPro-2 | Design Project 2 | DesPro-1 | 0/2
4.2 | CpE-PRAC | CpE Practicum/OJT | 4th Yr | 3/0
4.2 | IS-CITE | Integrating Seminar | 4th Yr | 3/0
`;

const BSIE = `
1.1 | MA 7 | Differential Calculus |  | 3/0
1.1 | CHEMENG | Chemistry for Engineers |  | 3/1
1.2 | MA 8 | Integral Calculus | MA 7 | 3/0
1.2 | PHYENG | Physics for Engineers | MA 7 | 3/1
1.2 | PRIECO | Principles of Economics |  | 3/0
2.1 | MA 9DE | Differential Equations | MA 8 | 3/0
2.1 | EMEC | Engineering Mechanics | PHYENG | 3/0
2.1 | FUNELC-IE | Elementary Electrical Engineering |  | 3/0
2.1 | COMPRO | Computer Fundamentals and Programming | PHYENG | 0/2
2.2 | ENGEC | Engineering Economics | 2nd Yr | 3/0
2.2 | STATIE1 | Statistical Analysis for Industrial Engineering 1 |  | 3/0
2.2 | ADEMAIE | Advance Mathematics for Industrial Engineering | MA 7 | 3/0
2.2 | CAD | Computer Aided Drafting | 2nd Yr | 0/1
3.1 | IMAP | Industrial Materials and Processes | CHEMENG; PHYENG | 2/1
3.1 | STATIE2 | Statistical Analysis for Industrial Engineering 2 | STATIE1 | 3/0
3.1 | OR 1 | Operation Research 1 | ADEMAIE | 3/0
3.1 | ME | Thermodynamics |  | 3/0
3.1 | IOAM | Industrial Organization and Management | 2nd Yr | 3/0
3.1 | ACC1-IE | Financial Accounting |  | 3/0
3.2 | IE 301 | Work Study and Management | IMAP; STATIE1 | 3/1
3.2 | ENGBOHS | Basic Occupational Health and Safety | 3rd Yr | 3/0
3.2 | TECHPREN-CITE | Technopreneurship | 3rd Yr | 3/0
3.2 | IE 302 | Quality Management System | IE 301; STATIE2 | 3/0
3.2 | ACC2-IE | Managerial Accounting | ACC1-IE | 3/0
3.2 | OR 2 | Operation Research 2 | OR 1 | 3/0
3.2 | ERGO 1 | Ergonomics 1 | IE 301 | 2/1
4.1 | ERGO 2 | Ergonomics 2 | ERGO 1 | 2/1
4.1 | IE 401 | Information Systems | 4th Yr | 3/0
4.1 | IE 402 | Systems Engineering | 4th Yr | 3/0
4.1 | IE 403 | Operation Management | IE 302; OR 1 | 3/1
4.1 | IE 404 | Environmental Science | 4th Yr | 3/0
4.1 | IE-ELEC1 | IE-Elective 1 (Lean Manufacturing) | 4th Yr | 3/0
4.1 | IE-ELEC2 | IE-Elective 2 (Project Management) | 4th Yr | 2/1
4.1 | IE-ELEC3 | IE-Elective 3 (Multi-Criteria Decision Making) | 4th Yr | 3/0
4.2 | IE 405 | Project Feasibility | IE 403 | 2/1
4.2 | IE 406 | Supply Chain Management | IE 403 | 3/0
4.2 | IE-PRAC | IE Practicum | 4th Yr | 3/0
4.2 | CapsPro-IE | IE Capstone Project | 4th Yr | 1/2
4.2 | IS-CITE | Integrating Seminar | 4th Yr | 3/0
`;

module.exports = {
  programs: [
    { code: 'BSIT', name: 'Bachelor of Science in Information Technology', curriculumYear: '2022-2023', subjects: parse(BSIT) },
    { code: 'BSIT-CS', name: 'Bachelor of Science in Information Technology with Specialization in Cyber Security', curriculumYear: '2025-2026', subjects: parse(BSIT_CS) },
    { code: 'BSCPE', name: 'Bachelor of Science in Computer Engineering', curriculumYear: '2022-2023', subjects: parse(BSCPE) },
    { code: 'BSIE', name: 'Bachelor of Science in Industrial Engineering', curriculumYear: '2022-2023', subjects: parse(BSIE) },
  ],
};
