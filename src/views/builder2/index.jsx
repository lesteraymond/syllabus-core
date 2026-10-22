import StableButton from '../../components/StableButton';
import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { useEffect, useRef, useState } from 'react';
import { LockSimple } from '@phosphor-icons/react/dist/csr/LockSimple';
import { PageHead } from '../../components/ui';
import { courses as coursesApi, syllabi as syllabiApi, users as usersApi } from '../../lib/api';
import { STEPS, applyCourse, clearCourse } from '../../lib/syllabusModel';
import { CURRENT_SCHOOL_YEAR } from '../../lib/schoolYear';
import { ASSIGNMENT_MESSAGES, STATUS_LABELS, assignmentState, editBlockedReason, isReturned, noteMissing } from '../../lib/syllabusRules';
import InfoStep from './InfoStep';
import ClosStep from './ClosStep';
import PlanStep from './PlanStep';
import ReqStep from './ReqStep';
import RefsStep from './RefsStep';
import GradeStep from './GradeStep';
import ReviewStep from './ReviewStep';
import UploadPanel from './UploadPanel';
import { useCatalog } from './useCatalog';
import { useDraft } from './useDraft';
import { prefersReducedMotion } from './parts';
import { warningCount } from '../../lib/complianceView';

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
  // Locked syllabi retain their submitted catalog. Step 2's syllabus-owned values always take precedence in the model.
  const frozen = !!draft && !load.loading && !load.editable && !!draft.catalog;
  const { model, programList, loading: catalogLoading, error: catalogError, refresh: refreshCatalog, resolvedProgramCode } = useCatalog(draft ? draft.meta.program : '', { snapshot: frozen ? draft.catalog : null, live: !frozen, courseId: draft?.meta.courseId });
  useEffect(() => {
    if (load.editable && !frozen && resolvedProgramCode && draft?.meta.program !== resolvedProgramCode) {
      apply(current => ({ ...current, meta: { ...current.meta, program: resolvedProgramCode } }));
    }
  }, [resolvedProgramCode, draft?.meta.program, load.editable, frozen]);
  const [step, setStep] = useState(0);
  // On a phone the steps are one swipeable row: keep the open step in view (sideways only, the page does not jump).
  useEffect(() => {
    const open = document.querySelector('.stepper button.active');
    if (open && open.scrollIntoView) open.scrollIntoView({ inline: 'center', block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [step]);
  const [visited, setVisited] = useState({ 0: 1 });
  const [filter, setFilter] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [note, setNote] = useState('');
  const [courseList, setCourseList] = useState([]);
  const [courseTick, setCourseTick] = useState(0); // bumped to read the subject list again (after the server refuses a subject)
  const [busy, setBusy] = useState(false);
  // 'form' (the seven steps) or 'upload' (submit a finished PDF instead). The draft lives in useDraft, so switching loses nothing.
  const [mode, setMode] = useState('form');
  // Bumped by the footer's Re-check; the Review & Check step's compliance section re-runs the check when it changes.
  const [checkTick, setCheckTick] = useState(0);
  // The rules the server named when it refused a submit (the form does not follow the template).
  const [submitFailed, setSubmitFailed] = useState([]);
  // What the latest compliance run says: decides whether the submit button reads "Submit anyway" (warnings remain).
  const [lastRun, setLastRun] = useState(null);
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
    coursesApi.list(program, { except: syllabusId() }).then((l) => { if (live) setCourseList(l); }).catch(() => { if (live) setCourseList([]); });
    return () => { live = false; };
  }, [program, courseTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2 belongs to this draft. Catalog refreshes must never replace the author's edits.

  // A subject has one syllabus: when the server refuses the subject just chosen (it already has one, or this person already has a draft
  // for it), take it off the form and say where the existing one is. Nothing was saved, so there is nothing to undo on the server.
  useEffect(() => {
    if (save.state !== 'error' || save.code !== 'syllabus_exists' || !draft || !draft.meta.courseId) return;
    set(clearCourse(draft));
    setCourseTick((n) => n + 1); // the list now shows that subject as taken
    setToast({ msg: save.message, action: { label: translateUI('builder.openMySyllabi'), fn: () => setPage('my-syllabi') } });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 10000);
  }, [save]); // eslint-disable-line react-hooks/exhaustive-deps

  if (load.loading || catalogLoading) return <div className="empty">{translateUI("ui.loading_the_syllabus_builder_e89b32")}</div>;
  if (load.error || catalogError) return <div className="info-banner warning">{translateUI("ui.could_not_open_the_builder_7169ab")}{tr(load.error || catalogError)}</div>;

  // Gating: faculty and administrators cannot move forward while a step has a BLOCKING problem (an empty required field, or data an
  // administrator has not added). Going back is always allowed, and a read-only syllabus is never gated.
  const gated = load.editable && !!user && user.role === 'faculty';
  const isAdmin = user?.role === 'admin';
  const titleOf = item => isAdmin && item.key === 'review' ? translateUI('publication.reviewSyllabus') : tr(item.title);
  const { statuses, complete, firstBlocked: blockedStep } = model.stepStatuses(draft, visited, { sequential: gated });
  const firstBlocked = gated ? blockedStep : -1; // the first of steps 1-6 with a blocker, or -1
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
    if (draft.meta.courseId && id !== draft.meta.courseId && !window.confirm(translateUI('outcomes.changeSubject'))) return;
    if (!id) { set(clearCourse(draft)); return; }
    try {
      const c = await coursesApi.get(id);
      set(applyCourse(draft, c));
    } catch (e) { notify(translateUI("ui.could_not_load_that_subject_8e9791") + e.message); }
  };
  const onChooseProgram = (code) => {
    if (draft.meta.courseId && code !== draft.meta.program && !window.confirm(translateUI('outcomes.changeSubject'))) return;
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
    if (!ok) notify(translateUI("ui.could_not_save_your_changes_check_your_connection_and_try_again_17b0b0"));
    return ok;
  };
  // "Save as draft": everything goes to the server, then the draft is waiting in My Syllabi (which re-reads the list on open).
  // A form with nothing entered has no draft yet, so it stays here instead of opening an empty list.
  const saveDraft = async () => {
    if (!(await saveFirst())) return;
    if (!syllabusId()) { notify(translateUI("ui.choose_a_subject_first_24357e")); return; }
    notify(translateUI("builder.draftSaved"));
    setPage('my-syllabi');
  };
  // The check lives in this step now: Re-check runs it again in place and scrolls to it (nothing navigates away).
  const recheck = () => {
    setCheckTick((t) => t + 1);
    const card = document.getElementById('cmp-card');
    if (card) card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  const submit = async () => {
    setBusy(true);
    setSubmitFailed([]);
    try {
      if (!(await saveFirst())) return;
      const id = syllabusId();
      if (!id) { notify(translateUI("ui.choose_a_subject_first_24357e")); return; }
      if (isAdmin) { await syllabiApi.prepareCheck(id); setPage('ai'); return; }
      const res = await syllabiApi.submitContent(id, note.trim());
      onSubmitted(res, existing);
    } catch (e) {
      if (e.data && Array.isArray(e.data.failed)) setSubmitFailed(e.data.failed);
      notify(translateUI("ui.submit_failed_adb15a") + e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitFile = async (file, fileNote) => {
    setBusy(true);
    try {
      if (!(await saveFirst())) return;
      const id = syllabusId();
      if (!id || !draft.meta.courseId) { notify(translateUI("ui.choose_a_subject_first_24357e")); return; }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', draft.meta.title || '');
      fd.append('courseCode', draft.meta.code || '');
      if (fileNote) fd.append('note', fileNote);
      const res = await syllabiApi.edit(id, fd);
      onSubmitted(res, existing);
    } catch (e) {
      notify(translateUI("ui.upload_failed_31c949") + e.message);
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
  const existing = load.status !== 'draft';
  const revising = isReturned(load.status); // back from the reviewer: the next submission is a new version, with a note about the change
  const needNote = noteMissing(load.status, note);
  // Why the main button cannot go yet. The button stays clickable so a click always answers with this reason, instead of doing nothing.
  const whyNot = !draft.meta.courseId ? translateUI("ui.choose_a_subject_first_24357e")
    : !complete ? translateUI("ui.complete_steps_1_to_6_to_unlock_b21a68")
    : needNote ? translateUI("ui.say_what_you_changed_a_sentence_first_01ece1") : '';
  const onPrimary = () => {
    if (!whyNot) return submit();
    notify(whyNot);
    const box = document.querySelector('.rv textarea');
    if (needNote && box) { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); box.focus(); }
    return undefined;
  };
  const preparedBy = user ? user.name || (user.firstName + ' ' + user.lastName) : '';
  const doneCount = statuses.filter((x) => x === 'done').length;
  const cfg = STEP_CONFIG[step];
  const warnings = warningCount(lastRun); // warnings the author would be submitting with: they never block, so this offers "Submit anyway"
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
      <PageHead title={translateUI("ui.syllabus_builder_editor_ac6179")} subtitle={translateUI("ui.fill_in_the_institutional_syllabus_form_step_by_step_every_part_i_35903f")} actions={<StableButton className="btn outline" disabled={!load.editable} onClick={saveDraft}>{translateUI("builder.saveAsDraft")}</StableButton>} />
      <div className="bld2-modes" role="tablist" aria-label={translateUI("ui.how_to_submit_0e4bbb")}>
        <button type="button" role="tab" aria-selected={mode === 'form'} className={mode === 'form' ? 'active' : ''} onClick={() => setMode('form')}>{translateUI("ui.fill_in_the_form_e4aa1f")}</button>
        {!isAdmin && <button type="button" role="tab" aria-selected={mode === 'upload'} className={mode === 'upload' ? 'active' : ''} onClick={() => setMode('upload')}>{translateUI("ui.upload_a_file_instead_eaad9b")}</button>}
      </div>
      {mode === 'upload' && (
        <div className="bld2-slide bld2-from-right">
          <UploadPanel hasCourse={!!draft.meta.courseId} existing={existing} revising={revising} busy={busy} disabled={!editable} notify={notify} onSubmit={submitFile} onChooseCourse={() => { setMode('form'); setStep(0); }} />
        </div>
      )}
      <div className={'bld2-slide bld2-from-left' + (mode === 'upload' ? ' bld2-hidden' : '')} hidden={mode === 'upload'}>
      <div className="course-strip">
        <span><small>{translateUI("ui.course_code_9c9dad")}</small><b className="mono">{draft.meta.code || '—'}</b></span>
        <span><small>{translateUI("ui.course_title_265cd6")}</small><b>{draft.meta.title || '—'}</b></span>
        <span><small>{translateUI("ui.program_9d6800")}</small><b>{draft.meta.program || '—'}</b></span>
        <span><small>{translateUI("ui.school_year_ec856b")}</small><b className="mono">{CURRENT_SCHOOL_YEAR.label}</b></span>
        <span><small>{translateUI("ui.status_bae7d5")}</small><b className={'status ' + load.status}>{tr(STATUS_LABELS[load.status] || load.status)}</b></span>
      </div>
      <div className="editor-layout bld2">
        <nav className="stepper" aria-label={translateUI("ui.steps_cdde4f")}>
          {STEP_CONFIG.map((s, i) => {
            const k = statuses[i];
            const mark = k === 'locked' ? <LockSimple size={14} aria-hidden="true" /> : k === 'done' ? '✓' : i === step ? '›' : k === 'attn' ? '!' : '›';
            return (
              <button key={s.key} type="button" className={(i === step ? 'active ' : '') + (k === 'locked' || k === 'done' || (i !== step && k !== 'todo') ? k : '')} aria-current={i === step ? 'step' : undefined} aria-disabled={!canGo(i) || undefined} title={!canGo(i) ? translateUI("ui.finish_step_316523") + (firstBlocked + 1) + translateUI("ui.first_faeaef") : undefined} onClick={() => go(i)}>
                <span>{i + 1}</span>{titleOf(s)}<i aria-label={k === 'locked' ? translateUI("ui.locked_adec79") : k === 'done' ? translateUI("ui.complete_0737c2") : i !== step && k === 'attn' ? translateUI("ui.needs_attention_3ad98d") : undefined}>{mark}</i>
              </button>
            );
          })}
          <div className="prog">{doneCount + translateUI("ui.of_607f2d") + STEP_CONFIG.length + translateUI("ui.complete_f37486")}</div>
        </nav>
        <section className="editor-card" aria-labelledby="bld2-title">
          {noAccess && <div className="info-banner warning">{tr(accessMessage)}</div>}
          {!noAccess && !load.editable && load.lockedReason && <div className="info-banner warning">{tr(load.lockedReason)}{translateUI("ui.you_can_read_this_syllabus_but_not_change_it_until_an_administrat_4f4ecd")}</div>}
          {revising && editable && (
            <div className="info-banner rv-revising" role="status">
              <span><b>{load.status === 'rejected' ? translateUI("builder.rejectedTitle") : translateUI("ui.returned_for_revision_d2426a")}</b>{translateUI("ui.your_next_submission_becomes_d37d36") + (load.nextVersion || tr('the next version')) + translateUI("ui.once_you_change_something_b3eaf9") + (load.version || tr('the version you submitted')) + translateUI("ui.and_every_earlier_version_stay_in_the_history_f8dfa6")}</span>
              {load.reviewerNote && <span className="rv-note">{translateUI("ui.reviewer_s_note_573dfd") + load.reviewerNote}</span>}
            </div>
          )}
          {!noAccess && !load.editable && !load.lockedReason && <div className="info-banner warning">{tr(editBlockedReason({ status: load.status }))}</div>}
          <div className="editor-title">
            <div>
              <span className="eyebrow">{translateUI("ui.step_c5964d") + (step + 1) + translateUI("ui.of_f69649") + STEP_CONFIG.length + (cfg.form === 'Form' ? '' : ' · ' + tr('FORM SECTION') + ' ' + cfg.form)}</span>
              <h2 id="bld2-title">{titleOf(cfg)}</h2>
              <p>{isAdmin && cfg.key === 'review' ? translateUI('publication.reviewDescription') : tr(cfg.sub)}</p>
            </div>
            <span className={'autosave' + (save.state === 'error' ? ' error' : save.state === 'saved' ? '' : ' saving')} role="status">{tr(saveText)}{save.state === 'error' && <button type="button" className="link" onClick={saveNow}>{translateUI("ui.retry_9f5cd8")}</button>}</span>
          </div>
          <fieldset disabled={!editable || busy}>
            <Body d={draft} apply={apply} editable={editable} model={model} programList={programList} courseList={courseList} onChooseCourse={onChooseCourse} onChooseProgram={onChooseProgram} filter={filter} setFilter={setFilter} onDeleteRow={onDeleteRow} go={go} preparedBy={preparedBy} existing={existing} noteRequired={revising} note={note} setNote={setNote} syllabusId={syllabusId} saveFirst={saveFirst} showCompliance={!isAdmin} canCheck={!!user && user.role === 'faculty' && !noAccess} checkTick={checkTick} submitFailed={submitFailed} onRun={setLastRun} />
          </fieldset>
          {!nxt && !complete && <div className="step-hint" role="status">{translateUI("ui.finish_the_steps_marked_in_the_list_review_check_the_compliance_c_31bb82")}{existing ? translateUI("ui.saving_a_new_version_a8d794") : translateUI("ui.submitting_8ee0db")}{translateUI("ui.unlock_once_steps_1_to_6_are_complete_f983eb")}</div>}
          {step < 6 && mine_.length > 0 && (
            <div className="blockers" role="status">
              <b>{translateUI("ui.to_continue_3819bf")}</b>
              <ul>{mine_.map((x, k) => <li key={k}>{tr(x.text)}</li>)}</ul>
            </div>
          )}
          {step < 6 && theirs.length > 0 && (
            <div className="blockers admin" role="status">
              <b>{translateUI("ui.this_step_cannot_be_completed_yet_d2c256")}</b>
              <ul>{theirs.map((x, k) => <li key={k}>{tr(x.text)}</li>)}</ul>
              <StableButton type="button" className="btn outline" onClick={refreshCatalog}>{translateUI("ui.check_again_e18504")}</StableButton>
            </div>
          )}
          {!isAdmin && step === 6 && warnings > 0 && editable && <div className="step-hint advice" role="note">{tr(warnings + (warnings === 1 ? ' warning remains' : ' warnings remain')) + translateUI("ui.in_the_compliance_check_they_do_not_block_you_the_reviewer_will_s_d35203")}</div>}
          {step < 6 && advice.length > 0 && editable && <div className="step-hint advice" role="note">{translateUI("ui.suggestions_73fedd") + advice.map((x) => tr(x.text)).join(' ')}</div>}
          {!nxt && editable && whyNot && <div className="step-hint advice" role="status">{whyNot}</div>}
          <div className="editor-footer">
            {prv && <StableButton type="button" className="btn outline" onClick={() => go(step - 1)}>{'← ' + titleOf(prv)}</StableButton>}
            <div>
              {nxt && <StableButton type="button" className="btn primary" disabled={blocking.length > 0} title={blocking.length ? translateUI("ui.complete_this_step_to_continue_71b565") : undefined} onClick={() => go(step + 1)}>{translateUI("ui.next_94377f") + titleOf(nxt) + ' →'}</StableButton>}
              {!nxt && <>
                {!isAdmin && <StableButton type="button" className="btn outline" disabled={!complete || busy || !editable} title={complete ? translateUI("ui.run_the_compliance_check_again_49661e") : translateUI("ui.complete_steps_1_to_6_to_unlock_b21a68")} onClick={recheck}>{translateUI("ui.re_check_9cf055")}</StableButton>}
                <StableButton type="button" className="btn primary" disabled={busy || !editable} aria-disabled={!!whyNot || undefined} title={whyNot || undefined} onClick={onPrimary}>{isAdmin ? translateUI('publication.continueToCheck') : tr(existing ? (warnings > 0 ? 'Save as new version anyway' : 'Save as new version') : (warnings > 0 ? 'Submit anyway' : 'Submit for review'))}</StableButton>
              </>}
            </div>
          </div>
        </section>
      </div>
      </div>
      {toast && <div className="bld2-toast" role="status"><span>{tr(toast.msg)}</span>{toast.action && <button type="button" onClick={toast.action.fn}>{tr(toast.action.label)}</button>}</div>}
    </>
  );
}
