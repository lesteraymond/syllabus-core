import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHead } from '../components/ui';
import { compliance as api } from '../lib/api';
import { groupByFacultyProgram, listBasis } from '../lib/complianceView';
import SyllabusPicker from '../components/SyllabusPicker';
import ComplianceModal from '../components/ComplianceModal';

// The AI Checker page is the administrator's view of the compliance checks of submitted syllabi. The page is one picker
// (Faculty, then Program, then Subject); Check compliance runs the check if the syllabus has none, then opens the stored result in a
// dialog, where it can be re-checked.
// The rules run on the latest submitted version and the result is stored with it (what Review & Approval shows).
// Faculty have no tab here: they check their own syllabus in step 7 of the builder (Review & Check).
export default function AIChecker({ user, notify }) {
  const [list, setList] = useState(null);     // { installed, syllabi: [row], summary }
  const [openId, setOpenId] = useState(null); // the syllabus shown in the dialog
  const [detail, setDetail] = useState(null); // { installed, syllabus, run } for that syllabus
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState({});       // syllabus id -> true while its check runs

  const loadList = useCallback(async () => { try { setList(await api.list('all')); setError(''); } catch (e) { setError(e.message); } }, []);
  const loadDetail = useCallback(async (id) => { try { setDetail(await api.list(id)); setError(''); return true; } catch (e) { setError(e.message); return false; } }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const done = () => { if (live) setLoading(false); };
    loadList().then(done, done);
    return () => { live = false; };
  }, [loadList]);

  // While recommendations are still being written, look again every few seconds (for a bounded time).
  const pending = openId !== null && detail && detail.run && detail.run.aiStatus === 'pending';
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
  const reload = async () => { await loadList(); if (openId !== null) await loadDetail(openId); };

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
    if (!row.run) say('Checked ' + row.courseCode + '.');
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

      {open && <ComplianceModal syllabus={open} run={detail.run} checking={!!busy[openId]} error={error} onRecheck={recheckOpen} onClose={closeModal} />}
      <div className="ai-note">The check supports — but does not replace — faculty, curriculum committee, and academic quality review.</div>
    </>
  );
}
