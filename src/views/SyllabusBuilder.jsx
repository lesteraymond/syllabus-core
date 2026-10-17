import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useState } from 'react';
import { users as usersApi } from '../lib/api';
import { ASSIGNMENT_MESSAGES, assignmentState } from '../lib/syllabusRules';
import { PageHead, Icon, Field, Progress, Assessment, Policy } from '../components/ui';
import Select from '../components/Select';

function defaultSyllabus() { return { code: 'IT304', title: 'Data Analytics and Visualization', program: 'BSIT', semester: '6', category: 'Professional Course', credits: '3', contact: '2-3-0', prereq: 'Statistics for Computing', description: 'This course develops practical competencies in collecting, preparing, analyzing, and communicating data using modern analytics and visualization tools.', outcomes: ['Apply data preparation techniques to structured datasets.', 'Analyze datasets using appropriate descriptive and diagnostic methods.', 'Create effective visualizations that communicate evidence-based insights.', 'Evaluate analytical results using appropriate performance measures.'] }; }

function CourseInformation({ data, update, dragging, setDragging, handleFile }) {
  return <div className="form-grid">
    <Field label={translateUI("ui.course_code_e3df14")}><input value={data.code} onChange={e => update('code', e.target.value)} /></Field>
    <Field label={translateUI("ui.course_title_9dfea6")}><input value={data.title} onChange={e => update('title', e.target.value)} /></Field>
    <Field label={translateUI("ui.program_2f03bb")}><Select value={data.program} onChange={e => update('program', e.target.value)}><option value="BSIT">{translateUI("ui.bsit_7d8d4f")}</option><option value="BSIS">{translateUI("ui.bsis_fba0a3")}</option><option value="BSCS">{translateUI("ui.bscs_ee67dc")}</option><option value="BLIS">{translateUI("ui.blis_dcf8c9")}</option><option value="BSEMC">{translateUI("ui.bsemc_3a4792")}</option></Select></Field>
    <Field label={translateUI("ui.semester_3ccdf6")}><Select value={data.semester} onChange={e => update('semester', e.target.value)}>{[1, 2, 3, 4, 5, 6, 7, 8].map(x => <option key={x}>{x}</option>)}</Select></Field>
    <Field label={translateUI("ui.course_category_44003b")}><input value={data.category || ''} onChange={e => update('category', e.target.value)} /></Field>
    <Field label={translateUI("ui.credits_bfac50")}><input value={data.credits || ''} onChange={e => update('credits', e.target.value)} /></Field>
    <Field label={translateUI("ui.contact_hours_week_703323")}><input value={data.contact || ''} onChange={e => update('contact', e.target.value)} /></Field>
    <Field label={translateUI("ui.pre_requisite_d4ec8c")}><input value={data.prereq || ''} onChange={e => update('prereq', e.target.value)} /></Field>
    <Field label={translateUI("ui.course_description_3db6da")} full><textarea rows="7" value={data.description} onChange={e => update('description', e.target.value)} /></Field>
    <Field label={translateUI("ui.syllabus_file_97aaca")} full>
      <div className={`dropzone${dragging ? ' dragging' : ''}${data.fileName ? ' has-file' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById('file-input').click()}>
        <input id="file-input" type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        {data.fileName ? <><span className="drop-icon">📎</span><span className="drop-text">{data.fileName}</span><small>{translateUI("ui.click_or_drop_to_replace_7c5654")}</small></> : <><span className="drop-icon">📄</span><span className="drop-text">{translateUI("ui.drag_drop_your_syllabus_file_here_dbc47d")}</span><small>{translateUI("ui.pdf_only_max_10mb_daa870")}</small></>}
      </div>
    </Field>
  </div>;
}

function CourseOutcomes({ data, update }) {
  const change = (i, v) => { const a = [...data.outcomes]; a[i] = v; update('outcomes', a); };
  return <div><div className="info-banner"><Icon name="sparkle" size={16} />{translateUI("ui.ai_tip_use_measurable_action_verbs_and_align_each_outcome_with_an_ad77ff")}</div>{data.outcomes.map((x, i) => <div className="outcome-row" key={i}><span>{translateUI("ui.co_550729")}{i + 1}</span><textarea value={x} onChange={e => change(i, e.target.value)} /><button onClick={() => update('outcomes', data.outcomes.filter((_, j) => j !== i))}>×</button></div>)}<StableButton className="btn outline" onClick={() => update('outcomes', [...data.outcomes, ''])}>{translateUI("ui.add_course_outcome_ef5418")}</StableButton></div>;
}

function WeeklyTopics() {
  const rows = [['1', 'Course orientation; data analytics lifecycle', 'Lecture + diagnostic activity', 'Orientation quiz'], ['2', 'Data collection, quality, ethics, privacy', 'Case discussion', 'Reflection'], ['3–4', 'Data cleaning and transformation', 'Hands-on laboratory', 'Lab exercise'], ['5–6', 'Exploratory data analysis', 'Guided analysis', 'Practical test'], ['7–8', 'Data visualization principles', 'Studio workshop', 'Dashboard critique'], ['9', 'Midterm assessment', 'Assessment', 'Midterm'], ['10–12', 'Statistical and diagnostic analytics', 'Lecture + lab', 'Case analysis'], ['13–15', 'Dashboard development and storytelling', 'Project workshop', 'Project milestone'], ['16', 'Project presentation and synthesis', 'Presentation', 'Final project']];
  return <div className="table-wrap syllabus-table"><table><thead><tr><th>{translateUI("ui.week_f82be6")}</th><th>{translateUI("ui.topic_content_4891dc")}</th><th>{translateUI("ui.teaching_learning_activity_16041e")}</th><th>{translateUI("ui.assessment_ef136f")}</th></tr></thead><tbody>{rows.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table></div>;
}

function AssessmentPlan() {
  return <div className="assessment-list"><Assessment name="Quizzes & Exercises" weight="20%" cos="CO1, CO2" /><Assessment name="Laboratory Activities" weight="25%" cos="CO1, CO2, CO3" /><Assessment name="Midterm Examination" weight="20%" cos="CO1, CO2" /><Assessment name="Analytics Project" weight="25%" cos="CO2, CO3, CO4" /><Assessment name="Participation / Reflection" weight="10%" cos="CO4" /><div className="assessment-total"><strong>{translateUI("ui.total_b25928")}</strong><strong>100%</strong></div></div>;
}

function GradingSystem() {
  return <div className="two-col"><div className="subcard"><h3>{translateUI("ui.grading_components_631feb")}</h3><Progress label={translateUI("ui.class_standing_0a97c9")} value={40} /><Progress label={translateUI("ui.major_assessments_4d7f21")} value={30} /><Progress label={translateUI("ui.project_performance_96a2d4")} value={30} /></div><div className="subcard"><h3>{translateUI("ui.passing_transmutation_cbb7dc")}</h3><p className="muted">{translateUI("ui.configure_this_section_according_to_the_official_university_gradi_d406c5")}</p><Field label={translateUI("ui.minimum_passing_percentage_95b265")}><input defaultValue="75%" /></Field><Field label={translateUI("ui.rounding_rule_71d575")}><Select><option value="Nearest whole number">{translateUI("ui.nearest_whole_number_78a5b6")}</option><option value="Two decimal places">{translateUI("ui.two_decimal_places_702af1")}</option></Select></Field></div></div>;
}

function References() {
  return <div><div className="info-banner warning">{translateUI("ui.2_references_are_more_than_10_years_old_the_ai_checker_will_flag__315174")}</div>{['Provost, F. & Fawcett, T. (2013). Data Science for Business. O\'Reilly.', 'Knaflic, C. N. (2015). Storytelling with Data. Wiley.', 'Wilke, C. O. (2019). Fundamentals of Data Visualization. O\'Reilly.', 'VanderPlas, J. (2023). Python Data Science Handbook, 2nd ed. O\'Reilly.'].map((x, i) => <div className="reference" key={x}><span>{i + 1}</span><p>{x}</p><button>✎</button><button>×</button></div>)}<StableButton className="btn outline">{translateUI("ui.add_reference_75edb4")}</StableButton></div>;
}

function Policies() {
  return <div className="policy-grid"><Policy title={translateUI("ui.attendance_b68931")} text="Students are expected to comply with university attendance and make-up policies." /><Policy title={translateUI("ui.academic_integrity_e62c79")} text="All outputs must observe proper attribution, ethical use of AI tools, and academic honesty." /><Policy title={translateUI("ui.data_privacy_fd595e")} text="Datasets containing personal information must be handled according to institutional privacy requirements." /><Policy title={translateUI("ui.accessibility_inclusion_0211a1")} text="Reasonable learning accommodations shall be coordinated through the appropriate university office." /></div>;
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
  const save = () => { localStorage.setItem('scms-draft', JSON.stringify(data)); notify(translateUI("ui.draft_saved_to_this_browser_ecd4c5")); };
  const [dragging, setDragging] = useState(false);
  // The File itself is kept out of `data` (which is saved to localStorage as the draft).
  const [file, setFile] = useState(null);
  const handleFile = (f) => { if (f) { setFile(f); update('fileName', f.name); notify(translateUI("ui.file_attached_p0_0b74e7", { p0: (f.name) })); } };
  const submit = () => onSubmit({ ...data, file });
  return (
    <>
      <PageHead title={translateUI("ui.syllabus_builder_editor_ac6179")} subtitle={translateUI("ui.create_a_standards_aligned_syllabus_using_a_guided_institutional__8a7040")} actions={<><StableButton className="btn outline" onClick={save}>{translateUI("ui.save_draft_cc1316")}</StableButton><StableButton className="btn outline" onClick={() => notify(translateUI("ui.preview_generated_demo_a76695"))}>{translateUI("ui.preview_f1fbb2")}</StableButton><StableButton className="btn primary" disabled={noAccess} title={noAccess ? tr(ASSIGNMENT_MESSAGES[state]) : ''} onClick={() => onSubmit(data)}>{translateUI("ui.submit_for_review_123f6c")}</StableButton></>} />
      {noAccess && <div className="info-banner warning">{tr(ASSIGNMENT_MESSAGES[state])}</div>}
      <div className="course-strip"><span><small>{translateUI("ui.course_code_9c9dad")}</small><b>{data.code || '—'}</b></span><span><small>{translateUI("ui.course_title_265cd6")}</small><b>{data.title || '—'}</b></span><span><small>{translateUI("ui.program_9d6800")}</small><b>{data.program}</b></span><span><small>{translateUI("ui.semester_788454")}</small><b>{data.semester}</b></span><span><small>{translateUI("ui.status_bae7d5")}</small><b className="status draft">{translateUI("ui.draft_23d33e")}</b></span></div>
      <div className="editor-layout">
        <aside className="stepper">{sections.map((s, i) => <button key={s} className={step === i ? 'active' : ''} onClick={() => setStep(i)}><span>{i + 1}</span>{tr(s)}<i>{i < step ? '✓' : '›'}</i></button>)}</aside>
        <section className="editor-card">
          {editing && <div className="info-banner">{editing.status === 'under_review' ? translateUI("ui.this_syllabus_is_under_review_be53e1") : ''}{translateUI("ui.your_changes_are_saved_as_a_new_version_552d76")}{editing.version || translateUI("ui.current_405ab5")}{translateUI("ui.stays_in_the_history_2340b8")}{editing.status === 'under_review' ? translateUI("ui.and_the_reviewer_is_notified_7b40ef") : ''}{translateUI("ui.only_the_title_course_code_curriculum_and_attached_file_are_versi_1b38fd")}</div>}
          <div className="editor-title"><div><span className="eyebrow">{translateUI("ui.step_c5964d")}{step + 1}{translateUI("ui.of_f69649")}{sections.length}</span><h2>{tr(sections[step])}</h2></div><span className="autosave"><Icon name="floppyDisk" size={16} />{translateUI("ui.auto_save_enabled_e07e38")}</span></div>
          {step === 0 && <CourseInformation data={data} update={update} dragging={dragging} setDragging={setDragging} handleFile={handleFile} />}
          {step === 1 && <CourseOutcomes data={data} update={update} />}
          {step === 2 && <WeeklyTopics />}
          {step === 3 && <AssessmentPlan />}
          {step === 4 && <GradingSystem />}
          {step === 5 && <References />}
          {step === 6 && <Policies />}
          {step === 6 && editing && <Field label={translateUI("ui.what_changed_optional_8668e0")} full><textarea rows="3" maxLength={1000} value={data.note || ''} onChange={e => update('note', e.target.value)} placeholder={translateUI("ui.saved_with_this_version_in_the_history_e_g_updated_the_grading_ru_c5ec32")} /></Field>}
          <div className="editor-footer">{step > 0 && <StableButton className="btn outline" onClick={() => setStep(Math.max(0, step - 1))}>{translateUI("ui.previous_471492")}</StableButton>}<div><StableButton className="btn ghost" onClick={save}>{translateUI("ui.save_draft_cc1316")}</StableButton><StableButton className="btn primary" disabled={noAccess && step === sections.length - 1} onClick={() => step < sections.length - 1 ? setStep(step + 1) : submit()}>{step < sections.length - 1 ? translateUI("ui.save_next_fe34ca") : translateUI("ui.finish_editing_9f0a56")}</StableButton></div></div>
        </section>
      </div>
    </>
  );
}
