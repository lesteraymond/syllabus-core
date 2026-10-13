import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHead } from '../components/ui';
import { compliance as api } from '../lib/api';
import { actionLabel, bulkTargets, filterRows, groupByFacultyProgram, listBasis, tone, ringAngle, when } from '../lib/complianceView';
import ComplianceCard from './ComplianceCard';
import CheckTree from './CheckTree';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };
const NEEDS = [['all', 'All'], ['unchecked', 'Needs a check'], ['below', 'Below the pass line'], ['stale', 'Changed since checked']];

// The AI Checker page is the administrator's view of the compliance checks of submitted syllabi. They are listed by faculty member,
// then program, then subject, so one syllabus is easy to find. An admin can Check a syllabus that has no check yet, or Re-check one
// that has: the rules run on the latest submitted version and the result is stored with it (what Review & Approval shows).
// Faculty have no tab here: they check their own syllabus in step 7 of the builder (Review & Check).
export default function AIChecker({ user, notify }) {
  const [selectedId, setSelectedId] = useState('all');
  const [list, setList] = useState(null);     // { installed, syllabi: [row], summary }
  const [detail, setDetail] = useState(null); // { installed, syllabus, run } for one syllabus
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', status: 'all', needs: 'all' });
  const [busy, setBusy] = useState({});       // syllabus id -> true while its check runs
  const [bulk, setBulk] = useState(null);     // { done, total } while "Check unchecked" runs

  const loadList = useCallback(async () => { try { setList(await api.list('all')); setError(''); } catch (e) { setError(e.message); } }, []);
  const loadDetail = useCallback(async (id) => { try { setDetail(await api.list(id)); setError(''); } catch (e) { setError(e.message); } }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const done = () => { if (live) setLoading(false); };
    (selectedId === 'all' ? loadList() : loadDetail(selectedId)).then(done, done);
    return () => { live = false; };
  }, [selectedId, loadList, loadDetail]);

  // While recommendations are still being written, look again every few seconds (for a bounded time).
  const pending = selectedId !== 'all' && detail && detail.run && detail.run.aiStatus === 'pending';
  useEffect(() => {
    if (!pending) return undefined;
    let tries = 0;
    const t = setInterval(() => { tries += 1; loadDetail(selectedId); if (tries >= 15) clearInterval(t); }, 2500);
    return () => clearInterval(t);
  }, [pending, selectedId, loadDetail]);

  const rows = list ? list.syllabi : [];
  const shown = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const groups = useMemo(() => groupByFacultyProgram(shown), [shown]);
  const everyone = useMemo(() => groupByFacultyProgram(rows), [rows]); // the picker lists all of them, whatever the filters say
  const targets = useMemo(() => bulkTargets(rows), [rows]);

  if (!user || user.role !== 'admin') return <div className="empty">The compliance check is in step 7 of the Syllabus Builder.</div>;

  const say = (m) => { if (notify) notify(m); };
  const reload = async () => { await loadList(); if (selectedId !== 'all') await loadDetail(selectedId); };

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

  const data = selectedId === 'all' ? list : detail;
  const installed = !data || data.installed !== false;
  const summary = list && list.summary;
  const one = selectedId !== 'all' && detail && detail.syllabus ? { ...detail.syllabus, run: detail.run } : null;
  const run = detail && detail.run;
  const how = listBasis(rows.map((r) => r.run));
  const working = bulk !== null || (one && busy[one.syllabusId]);

  // The one button in the page header: Check / Re-check for the open syllabus, "Check unchecked" for the whole list.
  const headerAction = !installed || loading ? null : one
    ? (actionLabel(one)
      ? <button type="button" className="btn primary" disabled={working} onClick={() => checkOne(one)}>{busy[one.syllabusId] ? 'Checking…' : actionLabel(one)}</button>
      : <button type="button" className="btn primary" disabled title="This syllabus was submitted as an uploaded file, so there is no builder form to check.">Check</button>)
    : <button type="button" className="btn primary" disabled={working || targets.length === 0} title={targets.length ? 'Run the check on every syllabus that has none yet' : 'Every syllabus with a form has been checked'} onClick={checkAll}>{bulk ? 'Checking ' + (bulk.done + 1) + ' of ' + bulk.total + '…' : 'Check unchecked' + (targets.length ? ' (' + targets.length + ')' : '')}</button>;

  return (
    <>
      <PageHead title="AI Syllabus Checker" subtitle={'Check and re-check submitted syllabi against the template. The result is stored with the version a reviewer sees. Current method: ' + how + '.'} actions={headerAction} />
      <div className="check-strip">
        <span><small>Select Syllabus</small><b><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0, margin: 0, font: 'inherit', color: 'inherit', width: '100%' }}>
          <option value="all">{'All submitted syllabi' + (list ? ' (' + rows.length + ')' : '')}</option>
          {everyone.map((f) => (
            <optgroup key={f.key} label={f.facultyName}>
              {f.programs.flatMap((p) => p.rows.map((r) => <option key={r.syllabusId} value={r.syllabusId}>{(p.code || 'No program') + ' · ' + r.courseCode + ' — ' + r.title}</option>))}
            </optgroup>
          ))}
        </select></b></span>
        {one && <span><small>Faculty</small><b>{one.facultyName || '—'}</b></span>}
        {one && <span><small>Program · Subject</small><b>{(one.programCode || 'No program') + ' · ' + one.courseCode}</b></span>}
        {one && <span><small>Status</small><b className={'status ' + one.status}>{STATUS_LABELS[one.status] || one.status}</b></span>}
        {run && <span><small>Checked</small><b>{when(run.createdAt) || '—'}</b></span>}
        {!one && <span><small>Standard</small><b>Undergraduate Syllabus v4</b></span>}
      </div>

      {error && <div className="info-banner warning" role="alert">{error}</div>}
      {!error && !loading && !installed && <div className="info-banner warning">Compliance checks are not set up on this server yet. Ask an administrator to run the database update; until then nothing is stored.</div>}
      {loading && <div className="empty">Loading stored checks…</div>}

      {!loading && installed && selectedId === 'all' && (
        <>
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

          <CheckTree groups={groups} total={rows.length} onOpen={(r) => setSelectedId(String(r.syllabusId))} onCheck={checkOne} busy={busy} working={working} />
        </>
      )}

      {!loading && installed && selectedId !== 'all' && detail && (
        <div className="cmp-one">
          <div className="cmp-one-head">
            <p className="cmp-small">{run ? 'The check stored with the submitted version' + (run.checkedBy === 'admin' ? ', run by an administrator.' : '.') : one && !one.checkable ? 'This syllabus was submitted as an uploaded file, so there is no builder form to check.' : 'No check is stored with this syllabus yet. Use Check at the top right.'}</p>
            <button type="button" className="btn outline" onClick={() => setSelectedId('all')}>← All syllabi</button>
          </div>
          <ComplianceCard run={run} />
        </div>
      )}
      <div className="ai-note">The check supports — but does not replace — faculty, curriculum committee, and academic quality review.</div>
    </>
  );
}
