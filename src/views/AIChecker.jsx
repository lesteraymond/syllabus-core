import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHead } from '../components/ui';
import { compliance as api } from '../lib/api';
import { bulkTargets, filterRows, groupByFacultyProgram, listBasis, tone, ringAngle } from '../lib/complianceView';
import SyllabusPicker from '../components/SyllabusPicker';
import ComplianceModal from '../components/ComplianceModal';
import CheckTree from './CheckTree';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };
const NEEDS = [['all', 'All'], ['unchecked', 'Needs a check'], ['below', 'Below the pass line'], ['stale', 'Changed since checked']];

// The AI Checker page is the administrator's view of the compliance checks of submitted syllabi. The page itself is one picker
// (Faculty, then Program, then Subject); Check compliance runs the check if the syllabus has none, then opens the stored result in a
// dialog, where it can be re-checked. The whole list, with the average and "Check unchecked", sits in a collapsed overview below.
// The rules run on the latest submitted version and the result is stored with it (what Review & Approval shows).
// Faculty have no tab here: they check their own syllabus in step 7 of the builder (Review & Check).
export default function AIChecker({ user, notify }) {
  const [list, setList] = useState(null);     // { installed, syllabi: [row], summary }
  const [openId, setOpenId] = useState(null); // the syllabus shown in the dialog
  const [detail, setDetail] = useState(null); // { installed, syllabus, run } for that syllabus
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', status: 'all', needs: 'all' });
  const [busy, setBusy] = useState({});       // syllabus id -> true while its check runs
  const [bulk, setBulk] = useState(null);     // { done, total } while "Check unchecked" runs

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
  const shown = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const groups = useMemo(() => groupByFacultyProgram(shown), [shown]);
  const everyone = useMemo(() => groupByFacultyProgram(rows), [rows]); // the picker lists all of them, whatever the filters say
  const targets = useMemo(() => bulkTargets(rows), [rows]);

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
  // From the overview: open a stored check; an uploaded file has none to show.
  const openRow = (row) => {
    if (!row.checkable) { say(row.courseCode + ' was submitted as an uploaded file, so there is no builder form to check.'); return; }
    checkAndOpen(row);
  };
  const recheckOpen = async () => {
    if (await runCheck(openId, true)) {
      await reload();
      const r = rows.find((x) => x.syllabusId === openId);
      say('Checked ' + (r ? r.courseCode : 'the syllabus') + '.');
    }
  };
  const closeModal = () => { setOpenId(null); setDetail(null); setError(''); };
  const checkOne = async (row) => { if (await runCheck(row.syllabusId, !!row.run)) { await reload(); say('Checked ' + row.courseCode + '.'); } };
  const checkAll = async () => {
    setBulk({ done: 0, total: targets.length });
    let done = 0;
    for (const row of targets) {
      if (!(await runCheck(row.syllabusId, false))) break; // a rate limit or a problem stops the run; the message is shown
      done += 1;
      setBulk({ done, total: targets.length });
    }
    setBulk(null);
    await reload();
    if (done) say('Checked ' + done + ' syllabus' + (done === 1 ? '' : 'es') + '.');
  };

  const installed = !list || list.installed !== false;
  const summary = list && list.summary;
  const how = listBasis(rows.map((r) => r.run));
  const working = bulk !== null || Object.keys(busy).length > 0;
  const open = openId !== null && detail && detail.syllabus && detail.syllabus.syllabusId === openId
    ? { ...(rows.find((r) => r.syllabusId === openId) || {}), ...detail.syllabus }
    : null;

  return (
    <>
      <PageHead title="AI Syllabus Checker" subtitle={'Check and re-check submitted syllabi against the template. The result is stored with the version a reviewer sees. Current method: ' + how + '.'} />

      {!open && error && <div className="info-banner warning" role="alert">{error}</div>}
      {!error && !loading && !installed && <div className="info-banner warning">Compliance checks are not set up on this server yet. Ask an administrator to run the database update; until then nothing is stored.</div>}

      {installed && <SyllabusPicker groups={everyone} loading={loading} busy={working} onCheck={checkAndOpen} />}

      {!loading && installed && (
        <details className="pick-overview">
          <summary>{'Overview of all syllabi' + (rows.length ? ' (' + rows.length + ')' : '')}</summary>
          <div className="pick-overview-bar">
            <span className="cmp-small">{summary && summary.scored ? summary.passed + ' of ' + summary.scored + ' scored syllabi meet the standard.' : 'No syllabus has been checked yet.'}</span>
            <button type="button" className="btn outline" disabled={working || targets.length === 0} title={targets.length ? 'Run the check on every syllabus that has none yet' : 'Every syllabus with a form has been checked'} onClick={checkAll}>{bulk ? 'Checking ' + (bulk.done + 1) + ' of ' + bulk.total + '…' : 'Check unchecked' + (targets.length ? ' (' + targets.length + ')' : '')}</button>
          </div>
          <div className="ai-layout cmp-all">
            <div className="score-card">
              <span>Average compliance</span>
              {summary && summary.average !== null
                ? <div className={'big-ring ' + tone(summary.average, 79)} style={{ '--p': ringAngle(summary.average) }}><div><strong>{summary.average}%</strong><small>{summary.scored + ' of ' + summary.count + ' scored'}</small></div></div>
                : <div className="cmp-ring none" style={{ margin: '22px auto' }}><div><strong>—</strong><small>No scores yet</small></div></div>}
              <p>{summary && summary.scored ? summary.passed + ' of ' + summary.scored + ' scored syllabi meet the standard.' : 'No syllabus has been checked yet.'}{summary && summary.uploaded ? ' ' + summary.uploaded + ' uploaded as a file (nothing to check).' : ''}</p>
            </div>
            <div className="check-table card">
              <div className="card-head"><h3>Compliance Areas</h3><span className="ai-badge">AVERAGE</span></div>
              {summary && summary.areas.map((a) => (
                <div className="check-row" key={a.key}>
                  <div><strong>{a.name}</strong><div className="bar thin"><i style={{ width: (a.average === null ? 0 : a.average) + '%' }} /></div></div>
                  <b>{a.average === null ? '—' : a.average + '%'}</b>
                  <span className={a.average !== null && a.average >= 79 ? 'check-ok' : 'check-warn'}>{a.average !== null && a.average >= 79 ? '✓' : a.average === null ? '·' : '!'}</span>
                </div>
              ))}
            </div>
            <div className="recommend-card aic-filters">
              <div className="recommend-head"><div><h3>Find a syllabus</h3><p>Search by faculty, program or subject.</p></div></div>
              <input className="in" type="search" placeholder="Faculty, program or subject" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} aria-label="Search syllabi" />
              <div className="aic-filter-row">
                <label><small>Needs</small>
                  <select value={filters.needs} onChange={(e) => setFilters({ ...filters, needs: e.target.value })}>{NEEDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </label>
                <label><small>Status</small>
                  <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                    <option value="all">All</option>
                    {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'draft').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <CheckTree groups={groups} total={rows.length} onOpen={openRow} onCheck={checkOne} busy={busy} working={working} />
        </details>
      )}

      {open && <ComplianceModal syllabus={open} run={detail.run} checking={!!busy[openId]} error={error} onRecheck={recheckOpen} onClose={closeModal} />}
      <div className="ai-note">The check supports — but does not replace — faculty, curriculum committee, and academic quality review.</div>
    </>
  );
}
