import { useMemo, useState } from 'react';
import { fmt } from '../lib/utils';
import { Avatar, PageHead, Field } from '../components/ui';

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'for_revision', label: 'For Revision' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function Repository({ syllabi, user, notify, setChatCode, setHistCode }) {
  const mySyllabi = useMemo(() => user.role === 'faculty' ? syllabi.filter(s => s.userId === user.id) : syllabi, [syllabi, user]);
  const [filters, setFilters] = useState({ program: 'All', status: 'All', q: '' });
  const rows = useMemo(() => mySyllabi.filter(x => (filters.program === 'All' || x.program === filters.program) && (filters.status === 'All' || x.status === filters.status) && (`${x.courseCode} ${x.title} ${x.faculty}`.toLowerCase().includes(filters.q.toLowerCase()))), [mySyllabi, filters]);
  const counts = useMemo(() => { const c = { All: mySyllabi.length }; mySyllabi.forEach(s => { c[s.status] = (c[s.status] || 0) + 1; }); return c; }, [mySyllabi]);
  return (
    <>
      <PageHead title="Syllabus Repository" subtitle="Search and access current and archived syllabus versions across undergraduate programs." actions={<button className="btn outline" onClick={() => notify('Repository export prepared (demo).')}>⇩ Export List</button>} />
      <div className="filter-card">
        <Field label="Program"><select value={filters.program} onChange={e => setFilters({ ...filters, program: e.target.value })}><option>All</option><option>Information Technology</option><option>Computer Science</option><option>Computer Engineering</option></select></Field>
        <Field label="Status"><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option>All</option>{STATUS_OPTIONS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
        <Field label="Search"><input value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} placeholder="Course code, title or faculty" /></Field>
        <button className="btn ghost reset" onClick={() => setFilters({ program: 'All', status: 'All', q: '' })}>Reset</button>
      </div>
      <div className="repo-stats"><span>All <b>{counts.All || 0}</b></span>{STATUS_OPTIONS.map(s => <span key={s.value}>{s.label} <b>{counts[s.value] || 0}</b></span>)}</div>
      <div className="table-card">
        <table><thead><tr><th>Course</th><th>Program</th><th>Faculty</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{rows.map(x => <tr key={x.id}><td><strong>{x.courseCode}</strong><small>{x.title}</small></td><td>{x.program}</td><td><span className="user-cell"><Avatar src={x.ownerAvatarUrl} name={x.faculty} /><span>{x.faculty}</span></span></td><td><span className={`status ${x.status}`}>{STATUS_OPTIONS.find(s => s.value === x.status)?.label || x.status}</span></td><td>{fmt(x.updatedAt)}</td><td><button className="table-action" onClick={() => setChatCode(x.id)}>✉</button><button className="table-action" onClick={() => setHistCode(x.id)}>◷</button></td></tr>)}</tbody></table>
        {rows.length === 0 && <div className="empty">No syllabi match your filters.</div>}
      </div>
    </>
  );
}
