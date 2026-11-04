'use strict';
// Stage E.9 Phase 3, Layer A: the four 18-week fixtures and their variants (docs/stage-e9-phase3-layer-a.md). Offline: no database, no network.
//   bsit, bsie, bscpe  eval/programSyllabi.js, unchanged (real curriculum identity and outcomes, synthetic plans).
//   cyber              BSIT-CYBERSECURITY CS-301 Introduction to Digital Forensics. The course row (code, title, units 2/1, prerequisite IT 208-, year 3,
//                      curriculum 2025-2026) is the repository's human-verified transcription (db/local-curriculum-data.cjs). Whether that curriculum is
//                      APPROVED cannot be established offline: db/seed-local-references.js marks a transcription approved only when it is run against
//                      a database, and registrar confirmation is pending. So the syllabus is SYNTHETIC and labelled so (syllabusSynthetic,
//                      identityStatus). Its POs and EGAs are BSIT's as transcribed (sources.BSIT, the nine PDF outcomes the BSIT fixture uses), which
//                      program_outcome_sources would link; that migration is NOT run. The masters keep the Cyber Security curriculum as its own.
// Identity is the triple program + curriculum year + authoritative course code (`identity` below), never a normalized code alone: IT-202 is System
// Integration and Architecture 1 in the Cyber Security curriculum and IT 202 is Computer Programming 1 in BSIT, and both squash to IT202.
// A variant is a base fixture with the declarative edits of the manifest's defects applied (manifest-phase3-1.json); nothing is inferred.
const path = require('node:path');
const { programSyllabus, buildSyllabus, PROGRAMS } = require('../programSyllabi');

const VERSION = 'phase3-fixtures-1';
const MANIFEST_FILE = path.join(__dirname, 'manifest-phase3-1.json');

// [contents, ILO, CLO number, activities, assessment tasks, values]; null marks an examination week. Row 0's activities, tasks and values are the shared
// orientation text of the other three fixtures. Laboratory activities name only resources the activity itself establishes (plan section 5.6).
const CYBER = {
  program: 'BSIT-CYBERSECURITY', code: 'CS-301', curriculumYear: '2025-2026', outcomes: 'BSIT', outcomeSource: 'BSIT',
  label: 'BSIT-CYBERSECURITY - CS-301 Introduction to Digital Forensics',
  fixture: 'phase3 Cyber Security CS-301 (synthetic syllabus; transcribed 2025-2026 curriculum identity whose approval is not confirmed offline; BSIT POs and EGAs)',
  description: 'This course introduces the principles and practice of digital forensics: how digital evidence is identified, acquired, preserved, analysed and reported within the legal and ethical limits of an investigation. Students learn the forensic process and the rules that make evidence admissible; acquire and verify forensic images using write blockers and hash values while keeping a chain of custody; and examine file-system, operating-system, network and memory artifacts to reconstruct events. Laboratory work uses prepared evidence images. The course closes with a simulated incident investigation in which teams examine the evidence, document their procedure and present a truthful forensic report.',
  clos: [
    ['Introductory', 'Explain the digital forensic process and the legal and ethical requirements that make digital evidence admissible.', [1, 4], [1, 2]],
    ['Enabling', 'Apply sound acquisition, preservation and chain-of-custody procedures to digital evidence using forensic imaging and hash verification.', [7, 9], [1, 2]],
    ['Demonstrating', 'Analyze file-system, operating-system, network and memory artifacts to reconstruct the events of an incident.', [6, 7], [1, 2]],
    ['Integration of Values', 'Investigate a simulated incident as a team and report the findings truthfully, respecting the privacy of the people involved.', [3, 4], [2, 3]],
  ],
  weeks: [
    ['Course orientation: course objectives, requirements, grading system, laboratory rules and class policies; the vision, mission and goals of LCUP and of CITE', 'Describe the course objectives, requirements and grading system, and how the course supports the goals of the institution.', 1, null, null, null],
    ['Foundations of digital forensics: digital evidence, the forensic process (identification, preservation, collection, examination, analysis and reporting) and the role of the examiner', 'Explain the phases of the digital forensic process and the role of each phase in an investigation.', 1, '- Lecture-discussion of simulated cases\n- Small-group activity: map the steps of a case to the phases of the forensic process', '- Quiz on the phases of the forensic process\n- Case worksheet: name the phase of each step taken in a case', 'Humility: groups compare their case maps with another group and correct the steps they placed in the wrong phase.'],
    ['Legal and ethical framework: the Cybercrime Prevention Act, the Data Privacy Act, search authority, the admissibility of electronic evidence and the ethics of the examiner', 'Explain the legal and ethical requirements that make digital evidence admissible and protect the privacy of the people involved.', 1, '- Lecture with case examples\n- Role-play: decide whether a request to search a device is lawful', '- Short written analysis of a case: is the evidence admissible, and why?', 'Courage: students say so when a requested search would breach privacy, even when the request comes from someone in authority.'],
    ['Evidence handling and chain of custody: identification, seizure, labelling, documentation and transport of digital evidence', 'Apply chain-of-custody procedures to document the handling of digital evidence from seizure to storage.', 2, '- Demonstration of evidence bagging, labelling and the custody form\n- Laboratory: teams seize, label and document a prepared device', '- Completed chain-of-custody form for the prepared device\n- Checklist observation of the seizure procedure', 'Interiority: each student reflects in writing on how a careless entry in a custody form could harm an innocent person.'],
    ['Forensic imaging and hash verification: write blockers, bit-stream images, image formats and MD5 and SHA-256 hash values', 'Acquire a forensic image of a storage device through a write blocker and verify its integrity with hash values.', 2, '- Demonstration of a hardware write blocker and the imaging software installed in the laboratory\n- Laboratory: image a prepared USB drive with that software and compare the hash values of the drive and the image', '- Laboratory exercise: forensic image with an acquisition log and matching hash values', 'Courage: students report a hash mismatch honestly instead of running the tool again until the error disappears.'],
    null,
    ['File systems: FAT, NTFS and ext4 structures, metadata and timestamps', 'Analyze file-system structures and metadata to locate files and interpret their timestamps.', 3, '- Lecture-demonstration with a hex viewer\n- Laboratory: locate files and read their metadata in a prepared disk image', '- Laboratory exercise: table of located files with their metadata and timestamps', 'Humility: pairs check each other\'s timestamp interpretations and correct their own errors.'],
    ['Data recovery and file carving: deleted files, slack space and signature-based carving', 'Recover deleted files from a disk image using file-system metadata and file carving, and explain the limits of each method.', 3, '- Worked example of recovering a deleted file\n- Laboratory: carve files from a prepared disk image with the forensic suite installed in the laboratory', '- Recovery report: recovered files, the method used and their hash values', 'Compassion: students treat the personal photos recovered from the prepared image with discretion and discuss how a victim would feel if they were exposed.'],
    ['Windows artifacts: the registry, event logs, prefetch files and traces of user activity', 'Examine Windows registry and event log artifacts to establish the activity of a user on a computer.', 3, '- Demonstration of registry and event log analysis\n- Laboratory: extract user activity from a prepared Windows image', '- Laboratory exercise: list of user actions with the artifact that supports each one', 'Interiority: students reflect on the traces their own computer use leaves and what that means for their privacy.'],
    ['Timeline analysis: building and interpreting a timeline of an incident', 'Construct a timeline of an incident from file-system and log artifacts and interpret the sequence of events.', 3, '- Worked example of building a timeline\n- Laboratory: pairs build a timeline from a prepared case image', '- Timeline report with the artifacts that support each event', 'Community-orientedness: pairs merge their partial timelines into one and agree on the order of events.'],
    ['Network forensics: packet captures, flow records and the analysis of network traffic', 'Analyze a packet capture to identify the hosts, protocols and data transferred in an incident.', 3, '- Demonstration of packet analysis with the protocol analyzer installed in the laboratory\n- Laboratory: analyze a prepared packet capture of an intrusion', '- Laboratory exercise: summary of the hosts, protocols and transferred files with the supporting packets', 'Courage: students report findings that point to an unexpected source instead of forcing them to fit their first hypothesis.'],
    null,
    ['Memory forensics: acquiring volatile memory and analyzing processes, network connections and traces of malware', 'Analyze a memory image to identify running processes, network connections and signs of malware.', 3, '- Demonstration of memory acquisition and analysis\n- Laboratory: examine a prepared memory image', '- Laboratory exercise: list of suspicious processes with the evidence for each', 'Humility: students ask a classmate for a second opinion before they label a process malicious.'],
    ['E-mail, web browser and cloud artifacts', 'Examine e-mail headers, browser history and cloud synchronization artifacts to trace the online activity of a user.', 3, '- Lecture-demonstration of e-mail header and browser history analysis\n- Laboratory: trace a phishing e-mail in a prepared case', '- Laboratory exercise: trace of the phishing e-mail from its header to the user\'s click', 'Compassion: students consider how the victim of the phishing e-mail was deceived and write a short, kind awareness note for users.'],
    ['Mobile device forensics: acquisition methods, mobile file systems and application data', 'Explain mobile acquisition methods and examine the application data extracted from a mobile device image.', 3, '- Lecture on logical, file-system and physical acquisition\n- Laboratory: examine the messaging data in a prepared mobile image', '- Laboratory exercise: report of the messages and contacts relevant to the case', 'Interiority: students reflect on the privacy of the third parties whose messages appear in the image.'],
    ['Anti-forensics and the validation of findings: data hiding, wiping, timestamp tampering and tool validation', 'Validate forensic findings against anti-forensic techniques by repeating the analysis with a second tool and documenting any discrepancy.', 4, '- Demonstration of timestamp tampering and data wiping\n- Laboratory: teams validate their earlier findings with a second forensic tool', '- Validation report: findings confirmed, discrepancies found and their explanation', 'Courage: teams report the findings that the second tool could not confirm instead of leaving them out.'],
    ['Forensic reporting and the case presentation: report structure, expert testimony and the simulated incident investigation', 'Investigate a simulated incident as a team and present a forensic report whose conclusions follow from the evidence.', 4, '- Team investigation of a simulated incident with consultations\n- Case presentation and panel questioning', '- Forensic report and case presentation assessed with a rubric\n- Peer evaluation of teamwork', 'Missionary Spirit: teams present how their findings would help the victim of a cybercrime obtain justice.'],
    null,
  ],
  refs: {
    books: ['Bautista, R. M., & Lopez, A. C. (2023). Digital forensics: Principles and practice (2nd ed.). Example University Press.', 'Santiago, J. P. (2021). Investigating digital evidence: File systems, memory and networks. Example Academic Press.'],
    program: ['Example Institute of Cyber Security. (2024). Laboratory manual for digital forensics (Report No. 5). Example Institute of Cyber Security.'],
    online: ['Example Forensics Network. (2024, June 10). Chain of custody for digital evidence. https://www.example.org/forensics/chain-of-custody'],
  },
};
function cyberSyllabus() {
  const orientation = programSyllabus('bsit').content.plan[0];
  const weeks = CYBER.weeks.map((w, i) => (i === 0 ? [w[0], w[1], w[2], orientation.activities, orientation.tasks, orientation.values] : w));
  return buildSyllabus('cyber', { ...CYBER, weeks });
}

const FIXTURES = [...PROGRAMS, 'cyber'];
// The provenance of each fixture, as the completion report lists it.
const PROVENANCE = {
  bsit: { syllabusSynthetic: true, identityStatus: 'transcribed', note: 'eval/programSyllabi.js: real BSIT 2022-2023 course row and transcribed outcomes; synthetic plan.' },
  bsie: { syllabusSynthetic: true, identityStatus: 'transcribed', note: 'eval/programSyllabi.js: real BSIE 2022-2023 course row and transcribed outcomes; synthetic plan. Laboratory 0.' },
  bscpe: { syllabusSynthetic: true, identityStatus: 'transcribed', note: 'eval/programSyllabi.js: real BSCpE 2022-2023 course row and transcribed outcomes; synthetic plan. Laboratory 0.' },
  cyber: { syllabusSynthetic: true, identityStatus: 'transcribed_approval_not_confirmed', outcomes: 'BSIT (sources.BSIT; program_outcome_sources migration not run)', note: 'CS-301 is in the transcribed 2025-2026 Cyber Security curriculum; its approval cannot be confirmed offline, so the fixture is synthetic, not an approved course syllabus.' },
};
function base(key) {
  if (!FIXTURES.includes(key)) throw new Error(`unknown fixture ${key}`);
  const s = key === 'cyber' ? cyberSyllabus() : programSyllabus(key);
  const meta = s.content.meta;
  return { ...s, version: VERSION, identity: { program: meta.program, curriculumYear: meta.curriculumYear, code: s.record.code, title: s.record.title }, ...PROVENANCE[key] };
}
const identityKey = identity => `${identity.program}/${identity.curriculumYear}/${identity.code}`;

// ---- declarative edits ----
// Paths are the engine's own (plan[2].contents, clos[1].pos, description[0].t, refs.books.items[1].t).
//   { set: path, to: value }       replace the value (any JSON value)
//   { append: path, text }         add text to the end of a string
//   { swapRows: [i, k] }           exchange two plan rows, keeping each position's id and week (an advanced topic placed before its prerequisite)
const keysOf = p => String(p).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
function getAt(obj, p) { return keysOf(p).reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setAt(obj, p, value) {
  const keys = keysOf(p), last = keys.pop(), parent = keys.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (parent == null || !(last in parent)) throw new Error(`edit path not found: ${p}`);
  parent[last] = value;
}
function applyEdits(content, edits = []) {
  for (const e of edits) {
    if ('set' in e) setAt(content, e.set, structuredClone(e.to));
    else if ('append' in e) { const now = getAt(content, e.append); if (typeof now !== 'string') throw new Error(`append needs a string at ${e.append}`); setAt(content, e.append, now + e.text); }
    else if ('swapRows' in e) {
      const [i, k] = e.swapRows, a = content.plan[i], b = content.plan[k];
      if (!a || !b || a.kind === 'exam' || b.kind === 'exam') throw new Error(`swapRows needs two lesson rows: ${i}, ${k}`);
      content.plan[i] = { ...b, id: a.id, week: a.week, ilos: b.ilos.map((ilo, j) => ({ ...ilo, id: a.ilos[j]?.id ?? ilo.id })) };
      content.plan[k] = { ...a, id: b.id, week: b.week, ilos: a.ilos.map((ilo, j) => ({ ...ilo, id: b.ilos[j]?.id ?? ilo.id })) };
    } else throw new Error(`unknown edit ${JSON.stringify(e)}`);
  }
  return content;
}

// ---- variants ----
let cached = null;
const loadManifest = () => (cached = cached || require(MANIFEST_FILE));
//   aligned                   the base fixture
//   misaligned                every defect of the program's misaligned variant at once
//   single:<defect id>        one defect alone
//   edge:<edge id>            an identity or structure edge case
function variant(key, name, manifest = loadManifest()) {
  const s = base(key), content = structuredClone(s.content), masters = structuredClone(s.masters);
  let defects = [], edges = [];
  if (name === 'misaligned') {
    const v = manifest.variants[`${key}-misaligned`];
    if (!v) throw new Error(`no misaligned variant for ${key}`);
    defects = v.defects.map(id => defectById(manifest, id));
  } else if (name.startsWith('single:')) {
    defects = [defectById(manifest, name.slice(7))];
    if (defects[0].fixture !== key) throw new Error(`${defects[0].id} belongs to ${defects[0].fixture}, not ${key}`);
  } else if (name.startsWith('edge:')) {
    edges = [manifest.edges.find(e => e.id === name.slice(5))];
    if (!edges[0] || edges[0].fixture !== key) throw new Error(`no edge ${name.slice(5)} for ${key}`);
  } else if (name !== 'aligned') throw new Error(`unknown variant ${name}`);
  for (const d of [...defects, ...edges]) applyEdits(content, d.edits);
  for (const e of edges) if (e.masters) applyEdits(masters, e.masters);
  return { ...s, variant: name, content, masters, defects, edges, aligned: s.content };
}
function defectById(manifest, id) {
  const d = manifest.defects.find(x => x.id === id);
  if (!d) throw new Error(`unknown defect ${id}`);
  return d;
}
module.exports = { VERSION, FIXTURES, PROVENANCE, CYBER, base, variant, applyEdits, getAt, setAt, identityKey, loadManifest, defectById, MANIFEST_FILE };
