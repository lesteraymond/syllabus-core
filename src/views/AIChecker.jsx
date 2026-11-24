import { YearFilter, useYearScope } from '../components/AcademicYearScope';
import { canApproveAdminDraft, isReturned, noteMissing, sentForReview, EDITABLE_STATUSES } from '../lib/syllabusRules';
import { isApprover, isReviewer } from '../lib/roles';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { PageHead } from '../components/ui';
import StableButton from '../components/StableButton';
import Select from '../components/Select';
import { compliance as api, syllabi as syllabiApi, isRevisionConflict } from '../lib/api';
import { groupByFacultyProgram, historyTally, listBasis, needsCheck, rangeToInstants, warningCount } from '../lib/complianceView';
import CheckOverview from '../components/CheckOverview';
import SyllabusPicker from '../components/SyllabusPicker';
import OwnSyllabusPicker from '../components/OwnSyllabusPicker';
import ComplianceModal from '../components/ComplianceModal';
import CheckHistory from '../components/CheckHistory';
import ComplianceSection from './builder2/ComplianceSection';
import ComplianceCard from './ComplianceCard';
import { canSubmitHybrid, applySuggestion } from '../lib/hybridCheck';
import { sectionsOf } from '../lib/draftSave';
import { useAiGate } from '../lib/checkPolicy';
import { useAdminPolicy } from '../lib/adminPolicy';

// The history's date filter is kept in this browser, so it is still applied after a reload or a visit to another page, until the admin
// changes or resets it. A view preference only: every read and write is guarded, and the page works without storage.
const RANGE_KEY = 'sms.aiChecker.historyRange';
const NO_RANGE = { from: '', to: '' };
const readRange = () => {
  try {
    const r = JSON.parse(localStorage.getItem(RANGE_KEY) || 'null');
    const ok = r && typeof r.from === 'string' && typeof r.to === 'string' && rangeToInstants(r.from, r.to) !== null;
    return ok ? { from: r.from, to: r.to } : NO_RANGE;
  } catch { return NO_RANGE; }
};
const writeRange = (r) => { try { if (r.from || r.to) localStorage.setItem(RANGE_KEY, JSON.stringify(r)); else localStorage.removeItem(RANGE_KEY); } catch { /* storage blocked: the filter just does not persist */ } };

function FacultyAIChecker({ user, syllabi = [], editing, setEditing, setPage, notify, onSubmitted }) {
  const uid = useId();
  const aiGate = useAiGate();
  const policy = useAdminPolicy(); // the administrator's AI checking switch: off means the format rules only
  // Only a syllabus the faculty can still edit is offered: a draft, or one sent back (returned for revision, or rejected). A submitted one is with the
  // reviewers and an approved one is final (it lives in the Repository); neither is checked again from here (owner decision 2026-11-15; the server
  // refuses it too, routes/compliance.js recheck).
  const mine = useMemo(() => syllabi.filter(s => s.userId === user.id && !s.archived && EDITABLE_STATUSES.includes(s.status)), [syllabi, user.id]);
  const hasOthers = useMemo(() => syllabi.some(s => s.userId === user.id && !EDITABLE_STATUSES.includes(s.status)), [syllabi, user.id]);
  const offered = (id) => !!id && mine.some(s => s.id === id);
  const [selectedId, setSelectedId] = useState(() => (offered(editing?.syllabusId) ? editing.syllabusId : mine[0]?.id || null));
  const [doc, setDoc] = useState({ loading: false, error: '', content: null, editable: false, status: 'draft', version: 'v1' });
  const [lastRun, setLastRun] = useState(null);
  const [note, setNote] = useState('');
  const [submitFailed, setSubmitFailed] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // The selection is always one of the offered syllabi: one opened from the builder that has since been submitted (or approved) is not kept.
  useEffect(() => {
    if (offered(editing?.syllabusId)) { if (selectedId !== editing.syllabusId) setSelectedId(editing.syllabusId); }
    else if (!offered(selectedId)) setSelectedId(mine[0]?.id || null);
  }, [editing?.syllabusId, mine, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) {
      setDoc({ loading: false, error: '', content: null, editable: false, status: 'draft', version: 'v1' });
      setLastRun(null);
      setSubmitFailed([]);
      return undefined;
    }
    let live = true;
    setDoc(prev => ({ ...prev, loading: true, error: '' }));
    setLastRun(null);
    setSubmitFailed([]);
    syllabiApi.getContent(selectedId).then(res => {
      if (!live) return;
      setDoc({ loading: false, error: '', content: res.content || null, editable: !!res.editable, status: res.status || 'draft', version: res.version || 'v1', academicYear: res.academicYear || null });
    }).catch(err => {
      if (!live) return;
      setDoc({ loading: false, error: err.message || '', content: null, editable: false, status: 'draft', version: 'v1' });
    });
    return () => { live = false; };
  }, [selectedId]);

  const receiveRun = useCallback((run) => {
    setLastRun(run ? { ...run, draftSignature: doc.content ? JSON.stringify(doc.content) : '' } : null);
  }, [doc.content]);

  const applyDraftRecommendation = async (patch) => {
    if (!selectedId || !doc.content) return false;
    const next = applySuggestion(doc.content, patch, { requireOriginal: true });
    setLastRun(null);
    try {
      await syllabiApi.saveContent(selectedId, sectionsOf(next), next.schemaVersion || 3);
    } catch (e) {
      // Another tab saved newer content: nothing was written. Load what is stored now so the page no longer shows (or saves from) the older copy, and say so.
      if (isRevisionConflict(e)) {
        await syllabiApi.getContent(selectedId).then(res => setDoc(prev => ({ ...prev, content: res.content || prev.content, editable: !!res.editable, status: res.status || prev.status, version: res.version || prev.version }))).catch(() => {});
        throw Object.assign(new Error(e.status === 428 ? 'hybrid.revisionRequired' : 'hybrid.revisionConflict'), { code: e.status === 428 ? 'revision_required' : 'revision_conflict' });
      }
      throw e;
    }
    // only the editable sections: the stored content also holds schemaVersion and catalog, which the server rejects
    setDoc(prev => ({ ...prev, content: next }));
    return true;
  };

  const openBuilder = () => {
    if (!selectedId) return;
    setEditing?.({ syllabusId: selectedId, status: doc.status });
    setPage?.('builder');
  };

  const existing = doc.status !== 'draft';
  const revising = isReturned(doc.status);
  const needNote = noteMissing(doc.status, note);
  const warnings = warningCount(lastRun);
  const selectedRow = mine.find(s => s.id === selectedId) || null;

  const submitChecked = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    setSubmitFailed([]);
    try {
      const res = await syllabiApi.submitContent(selectedId, note.trim());
      if (onSubmitted) await onSubmitted(res, existing);
    } catch (e) {
      if (e.data && Array.isArray(e.data.failed)) setSubmitFailed(e.data.failed);
      notify?.(translateUI("ui.submit_failed_adb15a") + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // One slim row: the subject, Edit Syllabus, then the check. The check state comes from ComplianceSection (ctl), which keeps the report drawer.
  const pickBar = (ctl) => (
    <section className="card pick-card pick-compact" aria-label={translateUI("ui.choose_a_syllabus_to_check_b6f6d2")}>
      <div className="pick-field">
        <label htmlFor={uid + '-s'}>{translateUI("ui.subject_8d183d")}</label>
        <Select id={uid + '-s'} value={selectedId ? String(selectedId) : ''} onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">{translateUI("ui.choose_a_subject_554b9c")}</option>
          {mine.map(s => <option key={s.id} value={String(s.id)}>{(s.courseCode || '—') + (s.title ? ' — ' + s.title : '')}</option>)}
        </Select>
      </div>
      <StableButton type="button" className="btn outline" disabled={!selectedId} onClick={openBuilder}>{translateUI('publication.editDraft')}</StableButton>
      {ctl && ctl.canRun && <StableButton type="button" className="btn primary" disabled={ctl.busy} onClick={ctl.recheck}>{ctl.busy && <span className="chk-btn-spin" aria-hidden="true" />}{ctl.busy ? translateUI('ui.checking_820d60') : translateUI(ctl.run ? "hybrid.recheckButton" : "aiChecker.run")}</StableButton>}
    </section>
  );

  // The right-hand column holds what the page always had under the report: for a returned syllabus the required "What did you change?" note,
  // how many warnings remain, the submit hint and the submit button.
  const submitOk = !!doc.content && canSubmitHybrid(lastRun, JSON.stringify(doc.content), 'advisory');
  const submitRail = (
    <aside className="chk-rail">
      <section className="card chk-ready">
        {revising && (
          <label className="field">
            <span>{translateUI("ui.what_did_you_change_required_c57040")}</span>
            <textarea rows="3" maxLength={1000} value={note} aria-required="true" onChange={e => setNote(e.target.value)} placeholder={translateUI("ui.saved_with_this_version_in_the_history_e_g_updated_the_grading_co_4d98a9")} />
            {needNote && <small className="hint">{translateUI("ui.write_at_least_a_sentence_so_the_reviewer_knows_what_to_look_at_3f7338")}</small>}
          </label>
        )}
        {warnings > 0 && <div className="step-hint advice" role="note">{tr(warnings + (warnings === 1 ? ' warning remains' : ' warnings remain')) + translateUI("ui.in_the_compliance_check_they_do_not_block_you_the_reviewer_will_s_d35203")}</div>}
        {!lastRun && <small className="hint" data-testid="submit-hint">{translateUI('aiChecker.submitHint')}</small>}
        <StableButton
          type="button"
          className="btn primary chk-submit"
          disabled={submitting || !doc.content || needNote || !submitOk}
          title={!submitOk ? translateUI('hybrid.hardGateRequired') : undefined}
          onClick={submitChecked}
        >
          {existing ? translateUI('hybrid.submitVersion') : translateUI('hybrid.submit')}
        </StableButton>
      </section>
    </aside>
  );

  return (
    <div className="chk-page">
      <PageHead title={translateUI("ui.ai_syllabus_checker_0c99c9")} subtitle={translateUI("ui.checked_against_the_undergraduate_syllabus_form_only_a_form_that__68429a")} actions={<YearFilter group="queue" />} />
      {!selectedId && mine.length === 0 ? (
        <div className="empty">{translateUI(hasOthers ? 'aiChecker.nothingToCheck' : "ui.no_syllabi_yet_click_new_syllabus_to_get_started_2e4bc9")}</div>
      ) : (
        <>
          {selectedId ? null : pickBar(null)}

          {policy.loaded && !policy.aiChecking && <div className="ai-note" role="note" data-testid="ai-off-note">{translateUI('policy.aiOff')}</div>}
          {doc.error && <div className="info-banner warning" role="alert">{tr(doc.error)}</div>}
          {submitFailed.length > 0 && (
            <div className="blockers" role="alert">
              <b>{translateUI("ui.the_server_did_not_accept_this_submit_fix_these_first_31d8e3")}</b>
              <ul>{submitFailed.map(c => <li key={c.id}>{tr(c.message)}</li>)}</ul>
            </div>
          )}

          {selectedId && (
            <ComplianceSection
              key={selectedId}
              syllabusId={() => selectedId}
              saveFirst={async () => true}
              canCheck={doc.editable}
              syllabusYear={doc.academicYear}
              onOpenStep={openBuilder}
              onRun={receiveRun}
              onApplyDraft={doc.editable && doc.content ? applyDraftRecommendation : undefined}
              hideError={!!doc.error}
              layout="panel"
              renderBar={pickBar}
              renderResult={(ctl) => (
                <div className={'chk-layout' + (doc.editable ? '' : ' solo')}>
                  {ctl.installed && (ctl.run || ctl.busy) && (
                    <div className="chk-main">
                      <section className="card chk-report"><ComplianceCard run={ctl.run} checking={ctl.busy} onOpenStep={openBuilder} onApplyDraft={ctl.onApplyDraft} /></section>
                    </div>
                  )}
                  {doc.editable && submitRail}
                </div>
              )}
              subjectLabel={selectedRow ? (selectedRow.courseCode || '—') + (selectedRow.title ? ' — ' + selectedRow.title : '') : ''}
            />
          )}
        </>
      )}
    </div>
  );
}

// The AI Checker page is the administrator's view of the compliance checks of submitted syllabi, and the faculty member's
// dedicated tab for checking and submitting their syllabus drafts.
// onChanged: read the syllabus list again (the administrator's own syllabus moved from Draft to Under Review when it was sent here to be checked).
export default function AIChecker({ user, syllabi = [], editing, setEditing, setPage, notify, onSubmitted, onEditDraft, onApproved, onChanged }) {
  const yearScope = useYearScope(), year = yearScope ? yearScope.param('queue') : undefined; // the work queue's academic year (undefined: the current one; 'all': every year this person may see)
  const reviewer = isReviewer(user?.role); // the dean, the Asst. VPAA, the LIC Director and the VPAA check submitted syllabi here
  const aiGate = useAiGate(); // 'advisory': the administrator decides after reading the check; 'required': a completed AI check too
  const policy = useAdminPolicy(); // the administrator's AI checking switch: off means the format rules only
  const [list, setList] = useState(null);     // { installed, syllabi: [row], summary }
  const [editingDraft, setEditingDraft] = useState(false);
  const [approving, setApproving] = useState(false);
  const approvalLock = useRef(false);
  const [openId, setOpenId] = useState(null); // the syllabus shown in the dialog
  const [detail, setDetail] = useState(null); // { installed, syllabus, run, isLatest? } for that syllabus (isLatest is false for an earlier run)
  const [history, setHistory] = useState({ runs: [], loading: true, error: '' });
  const [opening, setOpening] = useState(null); // the history runId being opened
  const [range, setRange] = useState(readRange);  // the history's applied date filter
  const asked = useRef(0);                        // the newest history request: an older answer is ignored
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState({});       // syllabus id -> true while its check runs
  const checkLocks = useRef(new Set());

  const loadList = useCallback(async () => { try { setList(await api.list('all', year)); setError(''); } catch (e) { setError(e.message); } }, [year]);
  const loadDetail = useCallback(async (id) => { try { setDetail(await api.list(id)); setError(''); return true; } catch (e) { setError(e.message); return false; } }, []);

  // The cards already shown stay on screen while a new range loads, so the card does not jump.
  const loadHistory = useCallback(async () => {
    const mine = ++asked.current;
    setHistory((x) => ({ ...x, loading: true }));
    try {
      const h = await api.history({ ...(rangeToInstants(range.from, range.to) || {}), ...(year ? { year } : {}) });
      if (mine === asked.current) setHistory({ runs: h.runs || [], loading: false, error: '' });
    } catch (e) { if (mine === asked.current) setHistory((x) => ({ ...x, loading: false, error: e.message })); }
  }, [range, year]);

  useEffect(() => {
    if (!reviewer) return undefined;
    let live = true;
    setLoading(true);
    const done = () => { if (live) setLoading(false); };
    loadList().then(done, done);
    return () => { live = false; };
  }, [reviewer, loadList]);

  useEffect(() => { if (reviewer) loadHistory(); }, [reviewer, loadHistory]); // on mount, and again whenever the applied range changes

  // While recommendations are still being written, look again every few seconds (for a bounded time).
  const pending = reviewer && openId !== null && detail && detail.isLatest !== false && detail.run && detail.run.aiStatus === 'pending'; // an earlier run no longer changes
  useEffect(() => {
    if (!pending) return undefined;
    let tries = 0;
    const t = setInterval(() => { tries += 1; loadDetail(openId); if (tries >= 15) clearInterval(t); }, 2500);
    return () => clearInterval(t);
  }, [pending, openId, loadDetail]);

  const rows = list ? list.syllabi.filter(row => row.status !== 'draft') : [];
  // The administrator's own syllabi already sent for review (the dean stage is cleared on the newest version): they are with the other reviewers now,
  // so they are neither offered for checking again nor sent or taken back to draft from here (the server refuses both too).
  const sentOwn = useMemo(() => new Set(syllabi.filter((s) => s.userId === user?.id && sentForReview(s)).map((s) => s.id)), [syllabi, user?.id]);
  // Unchecked and not approved: what the picker offers. A stage reviewer is offered a submission once it has reached them in the chain (myTurn from the
  // server: the dean first, then the Asst. VPAA, then the LIC Director); a row without it (an older server) is offered as before.
  const waiting = useMemo(() => groupByFacultyProgram(rows.filter(row => (needsCheck(row) && row.myTurn !== false) || (row.userId === user?.id && row.status === 'under_review' && !sentOwn.has(row.syllabusId)))), [rows, user?.id, sentOwn]);
  // The administrator writes syllabi too: their own drafts, and their syllabi returned for revision or rejected, can be checked from here as well as from the
  // builder (OwnSyllabusPicker). Once sent to be checked one is Under Review and is in the list above with everyone else's.
  const ownToCheck = useMemo(() => (user?.role === 'admin' ? syllabi.filter((s) => s.userId === user.id && !s.archived && ['draft', 'for_revision', 'rejected'].includes(s.status)) : []), [syllabi, user?.id, user?.role]);

  // A check started before this page was left is still running on the server (the row says so): keep the button waiting, look again until it
  // ends, then refresh the history so the new check appears.
  const remoteChecking = reviewer && rows.some((row) => row.checking);
  useEffect(() => {
    if (!remoteChecking) return undefined;
    const timer = setInterval(loadList, 3000);
    return () => { clearInterval(timer); loadHistory(); };
  }, [remoteChecking, loadList, loadHistory]);

  if (user?.role === 'faculty') {
    return <FacultyAIChecker user={user} syllabi={syllabi} editing={editing} setEditing={setEditing} setPage={setPage} notify={notify} onSubmitted={onSubmitted} />;
  }
  if (!user || !isReviewer(user.role)) return <div className="empty">{translateUI("ui.the_compliance_check_is_in_step_7_of_the_syllabus_builder_1f3135")}</div>;

  const say = (m) => { if (notify) notify(m); };
  const reload = async () => { await loadList(); loadHistory(); if (openId !== null) await loadDetail(openId); };

  // The first check of a syllabus. The server runs the rules on the latest submitted version and stores the result with it.
  const runCheck = async (id) => {
    if (checkLocks.current.has(id)) return false;
    checkLocks.current.add(id);
    setBusy((b) => ({ ...b, [id]: true }));
    setError('');
    try {
      await api.recheck(id);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      checkLocks.current.delete(id);
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  };

  // The picker's button: run the check, then show the stored result. The syllabus then leaves the picker (it is in the history).
  const checkAndOpen = async (row) => {
    const id = row.syllabusId;
    if (!(await runCheck(id))) return;
    setBusy((b) => ({ ...b, [id]: true }));
    const ok = await loadDetail(id);
    setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    if (!ok) return;
    setOpenId(id);
    await loadList();
    loadHistory();
    say(row.userId === user.id && row.status === 'under_review' ? translateUI('publication.reviewResult') : 'Checked ' + row.courseCode + '. It is now in the history.');
  };
  // The administrator's own syllabus: send it to the AI Checker exactly as the builder's "Continue to check" does (a saved version, status Under Review;
  // the server refuses an incomplete form and says what is missing), then check it and open the result, where it is sent for review.
  const prepareAndCheck = async (row) => {
    const id = row.id;
    if (checkLocks.current.has(id)) return;
    setError('');
    setBusy((b) => ({ ...b, [id]: true }));
    let prepared = false;
    try { await syllabiApi.prepareCheck(id); prepared = true; }
    catch (e) { setError(translateUI('ownCheck.notReady') + tr(e.message)); }
    finally { setBusy((b) => { const n = { ...b }; delete n[id]; return n; }); }
    if (!prepared) return;
    if (onChanged) await onChanged();
    await loadList();
    await checkAndOpen({ syllabusId: id, userId: user.id, status: 'under_review', courseCode: row.courseCode });
  };
  const openOwn = (row) => { if (setEditing) setEditing({ syllabusId: row.id, status: row.status }); if (setPage) setPage('builder'); };
  // The other choice: review the newest version without an AI check. Recorded for this reviewer only; the syllabus then waits in their Review & Approval.
  const reviewWithoutAi = async (row) => {
    const id = row.syllabusId;
    if (checkLocks.current.has(id)) return false;
    checkLocks.current.add(id);
    setBusy((b) => ({ ...b, [id]: true }));
    setError('');
    try {
      await syllabiApi.reviewWithoutAi(id);
      await loadList();
      say(translateUI('aiChoice.done', { code: row.courseCode || row.title }));
      if (setPage) setPage('review');
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { checkLocks.current.delete(id); setBusy((b) => { const n = { ...b }; delete n[id]; return n; }); }
  };
  const applyRange = (r) => { const next = { from: r.from || '', to: r.to || '' }; setRange(next); writeRange(next); };
  // A history card: read that exact run, then show it in the same dialog. (An approved syllabus is not in the history: it is in the Repository.)
  const openRun = async (item) => {
    setOpening(item.runId);
    setError('');
    try {
      setDetail(await api.run(item.runId));
      setOpenId(item.syllabusId);
    } catch (e) { setError(e.message); } finally { setOpening(null); }
  };
  const closeModal = () => { if (approvalLock.current) return; setOpenId(null); setDetail(null); setError(''); };


  const installed = !list || list.installed !== false;
  const how = listBasis(rows.map((r) => r.run));
  const waitingCount = waiting.reduce((sum, f) => sum + f.count, 0); // the syllabi still waiting for their first check, across every faculty member
  const tally = historyTally(history.runs);
  const working = Object.keys(busy).length > 0 || remoteChecking;
  const open = openId !== null && detail && detail.syllabus && detail.syllabus.syllabusId === openId
    ? { ...(rows.find((r) => r.syllabusId === openId) || {}), ...detail.syllabus }
    : null;

  const ownSyllabus = open?.userId === user.id && open.status === 'under_review' && !sentOwn.has(open.syllabusId);
  const approveEnabled = ownSyllabus && canApproveAdminDraft(user,open,detail?.run,detail?.isLatest !== false,aiGate,{ aiOff: policy.loaded && !policy.aiChecking });
  const editDraft = async () => {
    if (approvalLock.current || !ownSyllabus || !onEditDraft) return;
    approvalLock.current=true; setEditingDraft(true); setError('');
    try { await onEditDraft(open.syllabusId); }
    catch(error) { setError(error.message); }
    finally { approvalLock.current=false; setEditingDraft(false); }
  };
  const approveDraft = async () => {
    if (approvalLock.current || !approveEnabled) return;
    approvalLock.current=true; setApproving(true); setError('');
    try {
      await syllabiApi.publishContent(open.syllabusId,undefined,detail.run.id);
    } catch (e) {
      setError(e.message); return;
    } finally {
      approvalLock.current=false; setApproving(false);
    }
    closeModal();
    if (onApproved) await onApproved();
    else { await loadList(); say(translateUI('publication.approvedRepository')); }
  };

  return (
    <>
      <PageHead title={translateUI("ui.ai_syllabus_checker_0c99c9")} subtitle={translateUI("publication.checkerSubtitle") + tr(how) + '.'} actions={<YearFilter group="queue" />} />

      {!open && error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
      {!error && !loading && !installed && <div className="info-banner warning">{translateUI("ui.compliance_checks_are_not_set_up_on_this_server_yet_ask_an_admini_815abc")}</div>}

      {installed && (policy.loaded && !policy.aiChecking || isApprover(user.role) || aiGate === 'required') && (
        <div className="chk-notes">
          {policy.loaded && !policy.aiChecking && <div className="ai-note" role="note" data-testid="ai-off-note">{translateUI('policy.aiOff')}</div>}
          {isApprover(user.role) && <div className="ai-note" role="note" data-testid="approver-queue-note">{translateUI('reviewChain.approverQueueNote')}</div>}
          {aiGate === 'required' && <div className="ai-note" role="note">{translateUI('aiChoice.requiredNote')}</div>}
        </div>
      )}

      {installed && <CheckOverview waiting={waitingCount} faculty={waiting.length} tally={tally} loading={loading || history.loading && history.runs.length === 0} />}

      {installed && (
        <div className={'chk-work' + (user.role === 'admin' ? '' : ' solo')}>
          <SyllabusPicker groups={waiting} loading={loading} busy={working} onCheck={checkAndOpen} onWithoutAi={aiGate === 'required' ? undefined : reviewWithoutAi} viewerId={user?.id ?? null} />
          {user.role === 'admin' && <OwnSyllabusPicker rows={ownToCheck} busy={working} onCheck={prepareAndCheck} onOpen={openOwn} />}
        </div>
      )}

      {installed && working && (
        <div className="chk-progress" role="status" aria-live="polite">
          <span className="chk-progress-ring" aria-hidden="true" />
          <div className="chk-progress-body">
            <strong>{translateUI("ui.checking_your_syllabus_1278c5")}</strong>
            <div className="chk-progress-bar" aria-hidden="true"><span /></div>
          </div>
        </div>
      )}

      {installed && <CheckHistory runs={history.runs} loading={history.loading} error={history.error} opening={opening} onOpen={openRun} range={range} onApply={applyRange} onReset={() => applyRange(NO_RANGE)} />}

      {open && <ComplianceModal syllabus={open} run={detail.run} isLatest={detail.isLatest !== false} error={tr(error)} onClose={closeModal} onOpenDraft={onEditDraft && ownSyllabus ? editDraft : undefined} onApprove={ownSyllabus ? approveDraft : undefined} approvalDisabled={!approveEnabled} approving={approving} editing={editingDraft} />}
    </>
  );
}
