import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHead } from '../components/ui';
import { compliance as api } from '../lib/api';
import { groupByFacultyProgram, listBasis } from '../lib/complianceView';
import SyllabusPicker from '../components/SyllabusPicker';
import ComplianceModal from '../components/ComplianceModal';
import CheckHistory from '../components/CheckHistory';

// The AI Checker page is the administrator's view of the compliance checks of submitted syllabi. The page is one picker
// (Faculty, then Program, then Subject); Check compliance runs the check if the syllabus has none, then opens the stored result in a
// dialog, where it can be re-checked. Below it, the history lists every stored check; a card opens that exact check (an approved
// syllabus is final: it can be viewed there, never checked again).
// The rules run on the latest submitted version and the result is stored with it (what Review & Approval shows).
// Faculty have no tab here: they check their own syllabus in step 7 of the builder (Review & Check).
export default function AIChecker({ user, notify }) {
  const [list, setList] = useState(null);     // { installed, syllabi: [row], summary }
  const [openId, setOpenId] = useState(null); // the syllabus shown in the dialog
  const [detail, setDetail] = useState(null); // { installed, syllabus, run, isLatest? } for that syllabus (isLatest is false for an earlier run)
  const [history, setHistory] = useState({ runs: [], loading: true, error: '' });
  const [opening, setOpening] = useState(null); // the history runId being opened
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState({});       // syllabus id -> true while its check runs

  const loadList = useCallback(async () => { try { setList(await api.list('all')); setError(''); } catch (e) { setError(e.message); } }, []);
  const loadDetail = useCallback(async (id) => { try { setDetail(await api.list(id)); setError(''); return true; } catch (e) { setError(e.message); return false; } }, []);

  const loadHistory = useCallback(async () => {
    try { const h = await api.history(); setHistory({ runs: h.runs || [], loading: false, error: '' }); } catch (e) { setHistory((x) => ({ ...x, loading: false, error: e.message })); }
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const done = () => { if (live) setLoading(false); };
    loadHistory();
    loadList().then(done, done);
    return () => { live = false; };
  }, [loadList, loadHistory]);

  // While recommendations are still being written, look again every few seconds (for a bounded time).
  const pending = openId !== null && detail && detail.isLatest !== false && detail.run && detail.run.aiStatus === 'pending'; // an earlier run no longer changes
  useEffect(() => {
    if (!pending) return undefined;
    let tries = 0;
    const t = setInterval(() => { tries += 1; loadDetail(openId); if (tries >= 15) clearInterval(t); }, 2500);
    return () => clearInterval(t);
  }, [pending, openId, loadDetail]);

  const rows = list ? list.syllabi : [];
  const groups = useMemo(() => groupByFacultyProgram(rows), [rows]);

  if (!user || user.role !== 'admin') return <div className="empty">The compliance check is in step 7 of the Syllabus Builder.</div>;

  const say = (m) => { if (notify) notify(m); };
  const reload = async () => { await loadList(); loadHistory(); if (openId !== null) await loadDetail(openId); };

  // Check (no stored check yet) or Re-check (make a new one). The server runs the rules on the latest submitted version.
  const runCheck = async (id, force) => {
    setBusy((b) => ({ ...b, [id]: true }));
    setError('');
    try {
      await api.recheck(id, force);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  };

  // The picker's button: check it if it has no check, load the stored one if it has, then show it.
  const checkAndOpen = async (row) => {
    const id = row.syllabusId;
    if (!row.run && !(await runCheck(id, false))) return;
    setBusy((b) => ({ ...b, [id]: true }));
    const ok = await loadDetail(id);
    setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    if (!ok) return;
    setOpenId(id);
    await loadList();
    loadHistory();
    if (!row.run) say('Checked ' + row.courseCode + '.');
  };
  // A history card: read that exact run (an earlier one, or an approved syllabus's), then show it in the same dialog.
  const openRun = async (item) => {
    setOpening(item.runId);
    setError('');
    try {
      setDetail(await api.run(item.runId));
      setOpenId(item.syllabusId);
    } catch (e) { setError(e.message); } finally { setOpening(null); }
  };
  const recheckOpen = async () => {
    if (await runCheck(openId, true)) {
      await reload();
      const r = rows.find((x) => x.syllabusId === openId);
      say('Checked ' + (r ? r.courseCode : 'the syllabus') + '.');
    }
  };
  const closeModal = () => { setOpenId(null); setDetail(null); setError(''); };


  const installed = !list || list.installed !== false;
  const how = listBasis(rows.map((r) => r.run));
  const working = Object.keys(busy).length > 0;
  const open = openId !== null && detail && detail.syllabus && detail.syllabus.syllabusId === openId
    ? { ...(rows.find((r) => r.syllabusId === openId) || {}), ...detail.syllabus }
    : null;

  return (
    <>
      <PageHead title="AI Syllabus Checker" subtitle={'Check and re-check submitted syllabi against the template. The result is stored with the version a reviewer sees. Current method: ' + how + '.'} />

      {!open && error && <div className="info-banner warning" role="alert">{error}</div>}
      {!error && !loading && !installed && <div className="info-banner warning">Compliance checks are not set up on this server yet. Ask an administrator to run the database update; until then nothing is stored.</div>}

      {installed && <SyllabusPicker groups={groups} loading={loading} busy={working} onCheck={checkAndOpen} />}

      {installed && <CheckHistory runs={history.runs} loading={history.loading} error={history.error} opening={opening} onOpen={openRun} />}

      {open && <ComplianceModal syllabus={open} run={detail.run} checking={!!busy[openId]} isLatest={detail.isLatest !== false} error={error} onRecheck={recheckOpen} onClose={closeModal} />}
      <div className="ai-note">The check supports — but does not replace — faculty, curriculum committee, and academic quality review.</div>
    </>
  );
}
