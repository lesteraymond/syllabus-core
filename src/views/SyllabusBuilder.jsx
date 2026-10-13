import { useEffect, useState } from 'react';
import { users as usersApi } from '../lib/api';
import { ASSIGNMENT_MESSAGES, assignmentState } from '../lib/syllabusRules';
import { PageHead, Icon, Field, Progress, Assessment, Policy } from '../components/ui';

function defaultSyllabus() { return { code: 'IT304', title: 'Data Analytics and Visualization', program: 'BSIT', semester: '6', category: 'Professional Course', credits: '3', contact: '2-3-0', prereq: 'Statistics for Computing', description: 'This course develops practical competencies in collecting, preparing, analyzing, and communicating data using modern analytics and visualization tools.', outcomes: ['Apply data preparation techniques to structured datasets.', 'Analyze datasets using appropriate descriptive and diagnostic methods.', 'Create effective visualizations that communicate evidence-based insights.', 'Evaluate analytical results using appropriate performance measures.'] }; }

function CourseInformation({ data, update, dragging, setDragging, handleFile }) {
  return <div className="form-grid">
    <Field label="Course Code *"><input value={data.code} onChange={e => update('code', e.target.value)} /></Field>
    <Field label="Course Title *"><input value={data.title} onChange={e => update('title', e.target.value)} /></Field>
    <Field label="Program *"><select value={data.program} onChange={e => update('program', e.target.value)}><option>BSIT</option><option>BSIS</option><option>BSCS</option><option>BLIS</option><option>BSEMC</option></select></Field>
    <Field label="Semester *"><select value={data.semester} onChange={e => update('semester', e.target.value)}>{[1, 2, 3, 4, 5, 6, 7, 8].map(x => <option key={x}>{x}</option>)}</select></Field>
    <Field label="Course Category"><input value={data.category || ''} onChange={e => update('category', e.target.value)} /></Field>
    <Field label="Credits"><input value={data.credits || ''} onChange={e => update('credits', e.target.value)} /></Field>
    <Field label="Contact Hours / Week"><input value={data.contact || ''} onChange={e => update('contact', e.target.value)} /></Field>
    <Field label="Pre-requisite"><input value={data.prereq || ''} onChange={e => update('prereq', e.target.value)} /></Field>
    <Field label="Course Description *" full><textarea rows="7" value={data.description} onChange={e => update('description', e.target.value)} /></Field>
    <Field label="Syllabus File" full>
      <div className={`dropzone${dragging ? ' dragging' : ''}${data.fileName ? ' has-file' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById('file-input').click()}>
        <input id="file-input" type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        {data.fileName ? <><span className="drop-icon">📎</span><span className="drop-text">{data.fileName}</span><small>Click or drop to replace</small></> : <><span className="drop-icon">📄</span><span className="drop-text">Drag & drop your syllabus file here</span><small>PDF or Word document • Max 10MB</small></>}
      </div>
    </Field>
  </div>;
}

function CourseOutcomes({ data, update }) {
  const change = (i, v) => { const a = [...data.outcomes]; a[i] = v; update('outcomes', a); };
  return <div><div className="info-banner"><Icon name="sparkle" size={16} /> AI Tip: Use measurable action verbs and align each outcome with an assessable student performance.</div>{data.outcomes.map((x, i) => <div className="outcome-row" key={i}><span>CO{i + 1}</span><textarea value={x} onChange={e => change(i, e.target.value)} /><button onClick={() => update('outcomes', data.outcomes.filter((_, j) => j !== i))}>×</button></div>)}<button className="btn outline" onClick={() => update('outcomes', [...data.outcomes, ''])}>+ Add Course Outcome</button></div>;
}

function WeeklyTopics() {
  const rows = [['1', 'Course orientation; data analytics lifecycle', 'Lecture + diagnostic activity', 'Orientation quiz'], ['2', 'Data collection, quality, ethics, privacy', 'Case discussion', 'Reflection'], ['3–4', 'Data cleaning and transformation', 'Hands-on laboratory', 'Lab exercise'], ['5–6', 'Exploratory data analysis', 'Guided analysis', 'Practical test'], ['7–8', 'Data visualization principles', 'Studio workshop', 'Dashboard critique'], ['9', 'Midterm assessment', 'Assessment', 'Midterm'], ['10–12', 'Statistical and diagnostic analytics', 'Lecture + lab', 'Case analysis'], ['13–15', 'Dashboard development and storytelling', 'Project workshop', 'Project milestone'], ['16', 'Project presentation and synthesis', 'Presentation', 'Final project']];
  return <div className="table-wrap"><table><thead><tr><th>Week</th><th>Topic / Content</th><th>Teaching & Learning Activity</th><th>Assessment</th></tr></thead><tbody>{rows.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table></div>;
}

function AssessmentPlan() {
  return <div className="assessment-list"><Assessment name="Quizzes & Exercises" weight="20%" cos="CO1, CO2" /><Assessment name="Laboratory Activities" weight="25%" cos="CO1, CO2, CO3" /><Assessment name="Midterm Examination" weight="20%" cos="CO1, CO2" /><Assessment name="Analytics Project" weight="25%" cos="CO2, CO3, CO4" /><Assessment name="Participation / Reflection" weight="10%" cos="CO4" /><div className="assessment-total"><strong>Total</strong><strong>100%</strong></div></div>;
}

function GradingSystem() {
  return <div className="two-col"><div className="subcard"><h3>Grading Components</h3><Progress label="Class Standing" value={40} /><Progress label="Major Assessments" value={30} /><Progress label="Project / Performance" value={30} /></div><div className="subcard"><h3>Passing & Transmutation</h3><p className="muted">Configure this section according to the official university grading policy.</p><Field label="Minimum Passing Percentage"><input defaultValue="75%" /></Field><Field label="Rounding Rule"><select><option>Nearest whole number</option><option>Two decimal places</option></select></Field></div></div>;
}

function References() {
  return <div><div className="info-banner warning">⚠ 2 references are more than 10 years old. The AI checker will flag reference currency for review.</div>{['Provost, F. & Fawcett, T. (2013). Data Science for Business. O\'Reilly.', 'Knaflic, C. N. (2015). Storytelling with Data. Wiley.', 'Wilke, C. O. (2019). Fundamentals of Data Visualization. O\'Reilly.', 'VanderPlas, J. (2023). Python Data Science Handbook, 2nd ed. O\'Reilly.'].map((x, i) => <div className="reference" key={x}><span>{i + 1}</span><p>{x}</p><button>✎</button><button>×</button></div>)}<button className="btn outline">+ Add Reference</button></div>;
}

function Policies() {
  return <div className="policy-grid"><Policy title="Attendance" text="Students are expected to comply with university attendance and make-up policies." /><Policy title="Academic Integrity" text="All outputs must observe proper attribution, ethical use of AI tools, and academic honesty." /><Policy title="Data Privacy" text="Datasets containing personal information must be handled according to institutional privacy requirements." /><Policy title="Accessibility & Inclusion" text="Reasonable learning accommodations shall be coordinated through the appropriate university office." /></div>;
}

export default function SyllabusBuilder({ notify, onSubmit, editing, setEditing }) {
  const sections = ['Course Information', 'Course Outcomes', 'Weekly Topics', 'Assessment Plan', 'Grading System', 'References', 'Policies'];
  const [step, setStep] = useState(0);
  // Faculty can submit only for a course an admin assigned to them (the server enforces it too).
  const [mine, setMine] = useState(null);
  useEffect(() => {
    let live = true;
    usersApi.myAssignments().then((a) => { if (live) setMine(a); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const state = assignmentState(mine); // 'none' | 'noSubject' | 'ok' | null
  const noAccess = state === 'none' || state === 'noSubject';
  const [data, setData] = useState(() => {
    if (editing) return { ...defaultSyllabus(), ...Object.fromEntries(Object.entries(editing).filter(([, v]) => v !== undefined)) };
    try { return JSON.parse(localStorage.getItem('scms-draft')) || defaultSyllabus(); } catch { return defaultSyllabus(); }
  });
  const update = (field, value) => setData({ ...data, [field]: value });
  const save = () => { localStorage.setItem('scms-draft', JSON.stringify(data)); notify('Draft saved to this browser.'); };
  const [dragging, setDragging] = useState(false);
  // The File itself is kept out of `data` (which is saved to localStorage as the draft).
  const [file, setFile] = useState(null);
  const handleFile = (f) => { if (f) { setFile(f); update('fileName', f.name); notify(`File attached: ${f.name}`); } };
  const submit = () => onSubmit({ ...data, file });
  return (
    <>
      <PageHead title="Syllabus Builder / Editor" subtitle="Create a standards-aligned syllabus using a guided institutional template." actions={<><button className="btn outline" onClick={save}>Save Draft</button><button className="btn outline" onClick={() => notify('Preview generated (demo).')}>Preview</button><button className="btn primary" disabled={noAccess} title={noAccess ? ASSIGNMENT_MESSAGES[state] : ''} onClick={() => onSubmit(data)}>Submit for Review</button></>} />
      {noAccess && <div className="info-banner warning">{ASSIGNMENT_MESSAGES[state]}</div>}
      <div className="course-strip"><span><small>Course Code</small><b>{data.code || '—'}</b></span><span><small>Course Title</small><b>{data.title || '—'}</b></span><span><small>Program</small><b>{data.program}</b></span><span><small>Semester</small><b>{data.semester}</b></span><span><small>Status</small><b className="status draft">Draft</b></span></div>
      <div className="editor-layout">
        <aside className="stepper">{sections.map((s, i) => <button key={s} className={step === i ? 'active' : ''} onClick={() => setStep(i)}><span>{i + 1}</span>{s}<i>{i < step ? '✓' : '›'}</i></button>)}</aside>
        <section className="editor-card">
          {editing && <div className="info-banner">{editing.status === 'under_review' ? 'This syllabus is under review. ' : ''}Your changes are saved as a new version ({editing.version || 'current'} stays in the history){editing.status === 'under_review' ? ' and the reviewer is notified' : ''}. Only the title, course code, curriculum and attached file are versioned; the other fields in this editor are not stored on the server.</div>}
          <div className="editor-title"><div><span className="eyebrow">STEP {step + 1} OF {sections.length}</span><h2>{sections[step]}</h2></div><span className="autosave"><Icon name="floppyDisk" size={16} /> Auto-save enabled</span></div>
          {step === 0 && <CourseInformation data={data} update={update} dragging={dragging} setDragging={setDragging} handleFile={handleFile} />}
          {step === 1 && <CourseOutcomes data={data} update={update} />}
          {step === 2 && <WeeklyTopics />}
          {step === 3 && <AssessmentPlan />}
          {step === 4 && <GradingSystem />}
          {step === 5 && <References />}
          {step === 6 && <Policies />}
          {step === 6 && editing && <Field label="What changed? (optional)" full><textarea rows="3" maxLength={1000} value={data.note || ''} onChange={e => update('note', e.target.value)} placeholder="Saved with this version in the history, e.g. Updated the grading rubric" /></Field>}
          <div className="editor-footer"><button className="btn outline" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>← Previous</button><div><button className="btn ghost" onClick={save}>Save Draft</button><button className="btn primary" disabled={noAccess && step === sections.length - 1} onClick={() => step < sections.length - 1 ? setStep(step + 1) : submit()}>{step < sections.length - 1 ? 'Save & Next →' : 'Finish Editing'}</button></div></div>
        </section>
      </div>
    </>
  );
}
