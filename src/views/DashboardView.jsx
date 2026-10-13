import { useMemo } from 'react';
import { PageHead, Card, Icon, Legend, Progress, QualityMini, Deadline, Donut } from '../components/ui';

// Stat card icon per label (Phosphor names, see Icon in ui.jsx)
const STAT_ICONS = {
  'My Submissions': 'notebook',
  'Approved': 'sealCheck',
  'Pending Review': 'hourglassMedium',
  'For Revision': 'notePencil',
  'AI Compliance Score': 'shieldCheck',
  'Total Courses': 'graduationCap',
  'Submitted Syllabi': 'paperPlaneTilt',
};

export default function Dashboard({ setPage, user, syllabi, logs, clearLogs, setConfirm }) {
  const my = useMemo(() => syllabi.filter(s => s.userId === user.id), [syllabi, user]);
  const isFac = user.role === 'faculty';
  const data = isFac ? my : syllabi;

  const approved = data.filter(s => s.status === 'approved').length;
  const submitted = data.filter(s => s.status === 'submitted').length;
  const underReview = data.filter(s => s.status === 'under_review').length;
  const forRevision = data.filter(s => s.status === 'for_revision').length;
  const total = data.length;
  const compliance = total ? Math.round((approved / total) * 100) : 0;

  const stats = isFac
    ? [['My Submissions', String(total), 'Total uploaded', 'blue'], ['Approved', String(approved), 'Accepted syllabi', 'green'], ['Pending Review', String(submitted + underReview), 'Awaiting decision', 'gold'], ['For Revision', String(forRevision), 'Needs changes', 'teal'], ['AI Compliance Score', `${compliance}%`, 'Your compliance rate', 'purple']]
    : [['Total Courses', String(total), 'All syllabi', 'blue'], ['Submitted Syllabi', String(submitted), 'Awaiting review', 'teal'], ['Pending Review', String(underReview), 'Under review', 'gold'], ['Approved', String(approved), 'Accepted syllabi', 'green'], ['AI Compliance Score', `${compliance}%`, 'Institutional average', 'purple'], ['For Revision', String(forRevision), 'Needs changes', 'red']];

  const activityLogs = useMemo(() => {
    const filtered = isFac ? logs.filter(l => l.userId === user.id) : logs;
    return filtered.slice(0, 5);
  }, [logs, isFac, user]);

  const statusData = useMemo(() => {
    const g = Math.max(1, Math.round(approved / Math.max(total, 1) * 100));
    return { total, approved, submitted, underReview, forRevision, g };
  }, [total, approved, submitted, underReview, forRevision]);

  const programs = useMemo(() => {
    const map = {};
    syllabi.forEach(s => {
      if (!s.program) return;
      if (!map[s.program]) map[s.program] = { total: 0, approved: 0 };
      map[s.program].total++;
      if (s.status === 'approved') map[s.program].approved++;
    });
    return Object.entries(map).map(([p, d]) => [p, d.total ? Math.round((d.approved / d.total) * 100) : 0]).sort((a, b) => b[1] - a[1]);
  }, [syllabi]);

  return (
    <>
      <PageHead title="Welcome back!" subtitle="Here's what is happening with your undergraduate syllabi." actions={<><select><option>AY 2026–2027</option><option>AY 2025–2026</option></select>{!isFac && <button className="btn primary" onClick={() => setPage('builder')}>+ New Syllabus</button>}</>} />
      <section className="stat-grid">{stats.map(([a, b, c, d]) => <div className="stat-card" key={a}><div className={`stat-icon ${d}`}><Icon weight="regular" name={STAT_ICONS[a]} size={20} /></div><span>{a}</span><strong>{b}</strong><small>{c}</small></div>)}</section>
      <section className="dashboard-grid">
        <Card title="Recent Activity" action={<button className="btn ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setConfirm({ title: 'Clear Logs', message: user.role === 'admin' ? 'Clear all activity logs?' : 'Clear your activity logs?', label: 'Clear', onConfirm: () => { clearLogs(); } })}>Clear Logs</button>}>
          <div className="activity-list">
            {activityLogs.map((l, i) => <div className="activity" key={i}><span className={`activity-dot ${l.color}`} /><div><strong>{l.title}</strong><small>{l.meta}</small></div><span className={`badge ${l.color}`}>{l.badge}</span></div>)}
            {activityLogs.length === 0 && <div className="empty">No recent activity.</div>}
          </div>
        </Card>
        <Card title="Submission Status" action="View report">
          <div className="donut-panel">
            <Donut value={statusData.g} centerTop={String(total)} centerBottom="Total" />
            <div className="legend"><Legend color="var(--green)" text="Approved" value={String(approved)} /><Legend color="var(--blue)" text="Submitted" value={String(submitted)} /><Legend color="var(--gold)" text="Under Review" value={String(underReview)} /><Legend color="var(--red)" text="For Revision" value={String(forRevision)} /></div>
          </div>
        </Card>
        <Card title="Quick Actions">
          <div className="quick-actions">
            <button onClick={() => setPage(isFac ? 'builder' : 'ai')}><b><Icon weight="regular" name="sparkle" size={20} /></b><span>{isFac ? 'Check a syllabus' : 'Compliance overview'}<small>{isFac ? 'Run the compliance check in step 7 of the builder' : 'Read the stored check of each submitted syllabus'}</small></span><Icon weight="regular" name="caretRight" size={16} /></button>
            {isFac ? <button onClick={() => setPage('my-syllabi')}><b><Icon weight="regular" name="notebook" size={20} /></b><span>My Syllabi<small>{total} syllabi in your account</small></span><Icon weight="regular" name="caretRight" size={16} /></button> : <button onClick={() => setPage('review')}><b><Icon weight="regular" name="sealCheck" size={20} /></b><span>Review Pending Syllabi<small>{submitted + underReview} submissions awaiting review</small></span><Icon weight="regular" name="caretRight" size={16} /></button>}
            <button onClick={() => setPage('mapping')}><b><Icon weight="regular" name="gridFour" size={20} /></b><span>Curriculum Mapping<small>Inspect CO–PO coverage matrix</small></span><Icon weight="regular" name="caretRight" size={16} /></button>
          </div>
        </Card>
      </section>
      <section className="dashboard-grid lower">
        <Card title="Program Compliance" action="View analytics">
          {programs.length > 0
            ? programs.map(([p, v]) => <Progress key={p} label={p} value={v} />)
            : <div className="empty">No program data yet.</div>
          }
        </Card>
        <Card title="AI Quality Snapshot"><QualityMini label="Format" value={compliance || 0} /><QualityMini label="Completeness" value={compliance || 0} /><QualityMini label="CO–PO" value={compliance || 0} /><QualityMini label="Assessment" value={compliance || 0} /></Card>
        <Card title="Upcoming Deadlines"><Deadline day="05" mon="SEP" title="Department syllabus submission" note="5 days remaining" /><Deadline day="12" mon="SEP" title="Program chair review deadline" note="12 days remaining" /><Deadline day="18" mon="SEP" title="Dean approval deadline" note="18 days remaining" /></Card>
      </section>
    </>
  );
}
