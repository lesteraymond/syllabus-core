import { canApproveAdminDraft } from '../lib/syllabusRules';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHead } from '../components/ui';
import { compliance as api, syllabi as syllabiApi } from '../lib/api';
import { groupByFacultyProgram, listBasis, needsCheck, rangeToInstants } from '../lib/complianceView';
import SyllabusPicker from '../components/SyllabusPicker';
import ComplianceModal from '../components/ComplianceModal';
import CheckHistory from '../components/CheckHistory';

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

// The AI Checker page is the administrator's view of the compliance checks of submitted syllabi. The page is one picker
// (Faculty, then Program, then Subject) of the syllabi still waiting for their first check; Check compliance runs it and opens the
// result in a dialog. A checked syllabus then leaves the picker and is in the history. Below it, the history lists every stored check; a card opens that exact check, read-only. An approved syllabus
// is final and is in the Repository, not here.
// The rules run on the latest submitted version and the result is stored with it (what Review & Approval shows).
// Faculty have no tab here: they check their own syllabus in step 7 of the builder (Review & Check).
export default function AIChecker({ user, notify, onEditDraft, onApproved }) {
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

  const loadList = useCallback(async () => { try { setList(await api.list('all')); setError(''); } catch (e) { setError(e.message); } }, []);
  const loadDetail = useCallback(async (id) => { try { setDetail(await api.list(id)); setError(''); return true; } catch (e) { setError(e.message); return false; } }, []);

  // The cards already shown stay on screen while a new range loads, so the card does not jump.
  const loadHistory = useCallback(async () => {
    const mine = ++asked.current;
    setHistory((x) => ({ ...x, loading: true }));
    try {
      const h = await api.history(rangeToInstants(range.from, range.to) || {});
      if (mine === asked.current) setHistory({ runs: h.runs || [], loading: false, error: '' });
    } catch (e) { if (mine === asked.current) setHistory((x) => ({ ...x, loading: false, error: e.message })); }
  }, [range]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const done = () => { if (live) setLoading(false); };
    loadList().then(done, done);
    return () => { live = false; };
  }, [loadList]);

  useEffect(() => { loadHistory(); }, [loadHistory]); // on mount, and again whenever the applied range changes

  // While recommendations are still being written, look again every few seconds (for a bounded time).
  const pending = openId !== null && detail && detail.isLatest !== false && detail.run && detail.run.aiStatus === 'pending'; // an earlier run no longer changes
  useEffect(() => {
    if (!pending) return undefined;
    let tries = 0;
    const t = setInterval(() => { tries += 1; loadDetail(openId); if (tries >= 24) clearInterval(t); }, 2500);
    return () => clearInterval(t);
  }, [pending, openId, loadDetail]);

  const rows = list ? list.syllabi.filter(row => row.status !== 'draft') : [];
  const waiting = useMemo(() => groupByFacultyProgram(rows.filter(row => needsCheck(row) || (row.userId === user?.id && row.status === 'under_review'))), [rows, user?.id]); // unchecked and not approved: what the picker offers

  if (!user || user.role !== 'admin') return <div className="empty">{translateUI("ui.the_compliance_check_is_in_step_7_of_the_syllabus_builder_1f3135")}</div>;

  const say = (m) => { if (notify) notify(m); };
  const reload = async () => { await loadList(); loadHistory(); if (openId !== null) await loadDetail(openId); };

  // The first check of a syllabus. The server runs the rules on the latest submitted version and stores the result with it.
  const runCheck = async (id) => {
    setBusy((b) => ({ ...b, [id]: true }));
    setError('');
    try {
      await api.recheck(id);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
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
  const applyRange = (r) => { const next = { from: r.from || '', to: r.to || '' }; setRange(next); writeRange(next); };
  // A history card: read that exact run (an earlier one, or an approved syllabus), then show it in the same dialog.
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
  const working = Object.keys(busy).length > 0;
  const open = openId !== null && detail && detail.syllabus && detail.syllabus.syllabusId === openId
    ? { ...(rows.find((r) => r.syllabusId === openId) || {}), ...detail.syllabus }
    : null;

  const ownSyllabus = open?.userId === user.id && open.status === 'under_review';
  const approveEnabled = canApproveAdminDraft(user,open,detail?.run,detail?.isLatest !== false);
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
      <PageHead title={translateUI("ui.ai_syllabus_checker_0c99c9")} subtitle={translateUI("publication.checkerSubtitle") + tr(how) + '.'} />

      {!open && error && <div className="info-banner warning" role="alert">{tr(error)}</div>}
      {!error && !loading && !installed && <div className="info-banner warning">{translateUI("ui.compliance_checks_are_not_set_up_on_this_server_yet_ask_an_admini_815abc")}</div>}

      {installed && <SyllabusPicker groups={waiting} loading={loading} busy={working} onCheck={checkAndOpen} />}

      {installed && <CheckHistory runs={history.runs} loading={history.loading} error={history.error} opening={opening} onOpen={openRun} range={range} onApply={applyRange} onReset={() => applyRange(NO_RANGE)} />}

      {open && <ComplianceModal syllabus={open} run={detail.run} isLatest={detail.isLatest !== false} error={tr(error)} onClose={closeModal} onOpenDraft={onEditDraft && ownSyllabus ? editDraft : undefined} onApprove={ownSyllabus ? approveDraft : undefined} approvalDisabled={!approveEnabled} approving={approving} editing={editingDraft} />}
      <div className="ai-note">{translateUI("ui.the_check_supports_but_does_not_replace_faculty_curriculum_commit_e24080")}</div>
    </>
  );
}
