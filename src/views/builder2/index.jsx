import { useEffect, useRef, useState } from 'react';
import { PageHead } from '../../components/ui';
import { courses as coursesApi, syllabi as syllabiApi, users as usersApi } from '../../lib/api';
import { STEPS, applyCourse, clearCourse, closEqual, syncClos } from '../../lib/syllabusModel';
import { CURRENT_SCHOOL_YEAR } from '../../lib/schoolYear';
import { ASSIGNMENT_MESSAGES, STATUS_LABELS, assignmentState } from '../../lib/syllabusRules';
import InfoStep from './InfoStep';
import ClosStep from './ClosStep';
import PlanStep from './PlanStep';
import ReqStep from './ReqStep';
import RefsStep from './RefsStep';
import GradeStep from './GradeStep';
import ReviewStep from './ReviewStep';
import { useCatalog } from './useCatalog';
import { useDraft } from './useDraft';
import { prefersReducedMotion } from './parts';

// The step list: key, title, component, validate. The shell below only iterates this.
const BODIES = { info: InfoStep, clos: ClosStep, plan: PlanStep, reqs: ReqStep, refs: RefsStep, grade: GradeStep, review: ReviewStep };
const STEP_CONFIG = STEPS.map((s) => ({
  ...s,
  component: BODIES[s.key],
  validate: (d, model) => (s.key === 'review' ? [] : model.issues(d, s.key)),
}));

// The new syllabus builder: same shell as the current one (course strip, stepper, "Step N of 7" card, auto-save status),
// driven by the rules in src/lib/syllabusModel.js. It is used when VITE_NEW_BUILDER=true; until then the previous builder is the default.
export default function SyllabusBuilderV2({ editing, user, notify, setPage, onSubmitted }) {
  const { draft, apply, set, save, saveNow, load, syllabusId } = useDraft(editing);
  // A syllabus that can no longer be edited (approved, rejected, or its subject is un-assigned) shows the vision, mission,
  // EGAs and program outcomes saved when it was submitted. Anything still editable shows the live ones and keeps them fresh.
  const frozen = !!draft && !load.loading && !load.editable && !!draft.catalog;
  const { model, programList, loading: catalogLoading, error: catalogError, refresh: refreshCatalog, version: catalogVersion } = useCatalog(draft ? draft.meta.program : '', { snapshot: frozen ? draft.catalog : null, live: !frozen });
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState({ 0: 1 });
  const [filter, setFilter] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [note, setNote] = useState('');
  const [courseList, setCourseList] = useState([]);
  const [busy, setBusy] = useState(false);
  // What an admin assigned to me (null while loading, and for admins): decides whether the form opens at all.
  const [mine, setMine] = useState(null);
  useEffect(() => {
    let live = true;
    usersApi.myAssignments().then((a) => { if (live) setMine(a); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // Courses of the chosen program (the catalog is admin-managed).
  const program = draft ? draft.meta.program : '';
  useEffect(() => {
    if (!program) { setCourseList([]); return undefined; }
    let live = true;
    coursesApi.list(program).then((l) => { if (live) setCourseList(l); }).catch(() => { if (live) setCourseList([]); });
    return () => { live = false; };
  }, [program]);

  // The course learning outcomes always come from the catalog: when the draft opens, and whenever an
  // administrator has changed them, the draft's copy is refreshed (the server enforces the same on every save).
  const courseId = draft ? draft.meta.courseId : null;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (!courseId) return undefined;
    let live = true;
    coursesApi.get(courseId).then((c) => { if (live && draftRef.current && !closEqual(draftRef.current.clos, c.clos)) apply((x) => syncClos(x, c.clos)); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, load.loading, catalogVersion]);

  if (load.loading || catalogLoading) return <div className="empty">Loading the syllabus builder...</div>;
  if (load.error || catalogError) return <div className="info-banner warning">Could not open the builder: {load.error || catalogError}</div>;

  // Gating: a faculty member cannot move forward while a step has a BLOCKING problem (an empty required field, or data an
  // administrator has not added). Going back is always allowed, and a read-only syllabus is never gated.
  const gated = load.editable && !!user && user.role === 'faculty';
  const firstBlocked = gated ? model.firstBlocked(draft) : -1; // the first of steps 1-6 with a blocker, or -1
  const canGo = (i) => !gated || firstBlocked < 0 || i <= firstBlocked;

  const say = (msg, action) => {
    setToast({ msg, action });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };
  const go = (i) => {
    if (!canGo(i)) { say('Finish step ' + (firstBlocked + 1) + ' first: ' + STEP_CONFIG[firstBlocked].title + '.'); return; }
    if (STEP_CONFIG[i] && STEP_CONFIG[i].key === 'clos' && !frozen) refreshCatalog(); // pick up anything an administrator changed
    setStep(i);
    setVisited((v) => ({ ...v, [i]: 1 }));
    setFilter(null);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  const undo = (prev) => ({ label: 'Undo', fn: () => { set(prev); setToast(null); } });
  const onChooseCourse = async (id) => {
    if (!id) { set(clearCourse(draft)); return; }
    try {
      const c = await coursesApi.get(id);
      set(applyCourse(draft, c));
    } catch (e) { notify('Could not load that subject: ' + e.message); }
  };
  const onChooseProgram = (code) => {
    // The course belongs to a program: a different program means choosing the course again.
    set({ ...clearCourse(draft), meta: { ...clearCourse(draft).meta, program: code, prereq: draft.meta.prereq } });
  };
  const onDeleteRow = (id) => {
    const prev = draft;
    const row = draft.plan.find((r) => r.id === id);
    apply((x) => { x.plan = x.plan.filter((r) => r.id !== id); return x; });
    say('Week ' + ((row && row.week) || '?') + ' deleted.', undo(prev));
  };

  // Everything must be on the server before a version is stored or the AI checker opens.
  const saveFirst = async () => {
    const ok = await saveNow();
    if (!ok) notify('Could not save your changes. Check your connection and try again.');
    return ok;
  };
  const checkWithAI = async () => {
    setBusy(true);
    if (await saveFirst()) setPage('ai');
    setBusy(false);
  };
  const submit = async () => {
    setBusy(true);
    try {
      if (!(await saveFirst())) return;
      const id = syllabusId();
      if (!id) { notify('Choose a subject first.'); return; }
      const res = await syllabiApi.submitContent(id, note.trim());
      onSubmitted(res, existing);
    } catch (e) {
      notify('Submit failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Faculty work only on what an admin assigned to them: the server sends just those programs. With none, the
  // builder stays closed; a syllabus whose course was un-assigned opens read-only with the reason.
  const state = !!user && user.role === 'faculty' ? assignmentState(mine) : null; // 'none' | 'noSubject' | 'ok' | null
  const noAccess = !!user && user.role === 'faculty' && (programList.length === 0 || state === 'none' || (state === 'noSubject' && !draft.meta.courseId));
  const accessMessage = state === 'noSubject' ? ASSIGNMENT_MESSAGES.noSubject : ASSIGNMENT_MESSAGES.none;
  const editable = load.editable && !noAccess;
  const { statuses, complete } = model.stepStatuses(draft, visited);
  const existing = load.status !== 'draft';
  const preparedBy = user ? user.name || (user.firstName + ' ' + user.lastName) : '';
  const doneCount = statuses.filter((x) => x === 'done').length;
  const cfg = STEP_CONFIG[step];
  const Body = cfg.component;
  const issues = cfg.validate(draft, model);
  const blocking = gated ? issues.filter((i) => i.blocking) : [];
  const advice = issues.filter((i) => !i.blocking);
  const mine_ = blocking.filter((i) => i.source === 'form');
  const theirs = blocking.filter((i) => i.source === 'admin'); // set up by an administrator: faculty can only wait for it
  const prv = STEP_CONFIG[step - 1];
  const nxt = STEP_CONFIG[step + 1];
  const saveText = save.state === 'error' ? 'Not saved. ' + (save.message || 'Check your connection') + ' ' : save.state === 'saving' || save.state === 'pending' ? 'Saving...' : 'Auto-save enabled' + (save.time ? ' · saved ' + save.time : '');

  return (
    <>
      <PageHead title="Syllabus Builder / Editor" subtitle="Fill in the institutional syllabus form step by step. Every part is connected to the others." actions={<button className="btn outline" onClick={saveNow}>Save now</button>} />
      <div className="course-strip">
        <span><small>Course Code</small><b className="mono">{draft.meta.code || '—'}</b></span>
        <span><small>Course Title</small><b>{draft.meta.title || '—'}</b></span>
        <span><small>Program</small><b>{draft.meta.program || '—'}</b></span>
        <span><small>School Year</small><b className="mono">{CURRENT_SCHOOL_YEAR.label}</b></span>
        <span><small>Status</small><b className={'status ' + load.status}>{STATUS_LABELS[load.status] || load.status}</b></span>
      </div>
      <div className="editor-layout bld2">
        <nav className="stepper" aria-label="Steps">
          {STEP_CONFIG.map((s, i) => {
            const k = statuses[i];
            const mark = i === step ? '›' : k === 'done' ? '✓' : k === 'attn' ? '!' : '›';
            return (
              <button key={s.key} type="button" className={(i === step ? 'active ' : '') + (i !== step && k !== 'todo' ? k : '') + (!canGo(i) ? ' locked' : '')} aria-current={i === step ? 'step' : undefined} aria-disabled={!canGo(i) || undefined} title={!canGo(i) ? 'Finish step ' + (firstBlocked + 1) + ' first' : undefined} onClick={() => go(i)}>
                <span>{i + 1}</span>{s.title}<i aria-label={i === step ? undefined : k === 'done' ? 'complete' : k === 'attn' ? 'needs attention' : undefined}>{mark}</i>
              </button>
            );
          })}
          <div className="prog">{doneCount + ' of ' + STEP_CONFIG.length + ' complete'}</div>
        </nav>
        <section className="editor-card" aria-labelledby="bld2-title">
          {noAccess && <div className="info-banner warning">{accessMessage}</div>}
          {!noAccess && !load.editable && load.lockedReason && <div className="info-banner warning">{load.lockedReason} You can read this syllabus, but not change it until an administrator assigns the course to you again.</div>}
          {!noAccess && !load.editable && !load.lockedReason && <div className="info-banner warning">This syllabus is {(STATUS_LABELS[load.status] || load.status).toLowerCase()} and can no longer be edited.</div>}
          <div className="editor-title">
            <div>
              <span className="eyebrow">{'STEP ' + (step + 1) + ' OF ' + STEP_CONFIG.length + (cfg.form === 'Form' ? '' : ' · FORM SECTION ' + cfg.form)}</span>
              <h2 id="bld2-title">{cfg.title}</h2>
              <p>{cfg.sub}</p>
            </div>
            <span className={'autosave' + (save.state === 'error' ? ' error' : save.state === 'saved' ? '' : ' saving')} role="status">{saveText}{save.state === 'error' && <button type="button" className="link" onClick={saveNow}>Retry</button>}</span>
          </div>
          <fieldset disabled={!editable}>
            <Body d={draft} apply={apply} model={model} programList={programList} courseList={courseList} onChooseCourse={onChooseCourse} onChooseProgram={onChooseProgram} filter={filter} setFilter={setFilter} onDeleteRow={onDeleteRow} go={go} preparedBy={preparedBy} existing={existing} note={note} setNote={setNote} />
          </fieldset>
          {!nxt && !complete && <div className="step-hint" role="status">Finish the steps marked ! in the list. Check with AI and {existing ? 'saving a new version' : 'submitting'} unlock once steps 1 to 6 are complete.</div>}
          {step < 6 && mine_.length > 0 && (
            <div className="blockers" role="status">
              <b>To continue:</b>
              <ul>{mine_.map((x, k) => <li key={k}>{x.text}</li>)}</ul>
            </div>
          )}
          {step < 6 && theirs.length > 0 && (
            <div className="blockers admin" role="status">
              <b>This step cannot be completed yet.</b>
              <ul>{theirs.map((x, k) => <li key={k}>{x.text}</li>)}</ul>
              <button type="button" className="btn outline" onClick={refreshCatalog}>Check again</button>
            </div>
          )}
          {step < 6 && advice.length > 0 && editable && <div className="step-hint advice" role="note">{'Suggestions: ' + advice.map((x) => x.text).join(' ')}</div>}
          <div className="editor-footer">
            <button type="button" className="btn outline" disabled={!prv} onClick={() => go(step - 1)}>{prv ? '← ' + prv.title : '← Previous'}</button>
            <div>
              {nxt && <button type="button" className="btn primary" disabled={blocking.length > 0} title={blocking.length ? 'Complete this step to continue' : undefined} onClick={() => go(step + 1)}>{'Next: ' + nxt.title + ' →'}</button>}
              {!nxt && <>
                <button type="button" className="btn outline" disabled={!complete || busy || !editable} title={complete ? 'Open the AI Checker' : 'Complete steps 1 to 6 to unlock'} onClick={checkWithAI}>Check with AI</button>
                <button type="button" className="btn primary" disabled={busy || !editable || !draft.meta.courseId || (gated && !complete)} title={gated && !complete ? 'Complete steps 1 to 6 to unlock' : undefined} onClick={submit}>{existing ? 'Save as new version' : 'Submit for review'}</button>
              </>}
            </div>
          </div>
        </section>
      </div>
      {toast && <div className="bld2-toast" role="status"><span>{toast.msg}</span>{toast.action && <button type="button" onClick={toast.action.fn}>{toast.action.label}</button>}</div>}
    </>
  );
}
