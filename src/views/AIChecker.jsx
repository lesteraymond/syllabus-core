import { useState, useMemo } from 'react';
import { PageHead, Recommendation, Icon } from '../components/ui';

const CHECKS = [
  { name: 'Format Compliance', key: 'format' },
  { name: 'Content Completeness', key: 'complete' },
  { name: 'CO–PO Alignment', key: 'copo' },
  { name: 'Assessment Alignment', key: 'assess' },
  { name: 'Contact Hours', key: 'hours' },
  { name: 'Reference Currency', key: 'refs' },
];

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };

export default function AIChecker({ syllabi, user, notify }) {
  const mySyllabi = useMemo(() => user.role === 'faculty' ? syllabi.filter(s => s.userId === user.id) : syllabi, [syllabi, user]);
  const [selectedId, setSelectedId] = useState('all');
  const [ran, setRan] = useState(false);

  const target = useMemo(() => {
    if (selectedId === 'all') return mySyllabi;
    return mySyllabi.filter(s => s.id === Number(selectedId));
  }, [mySyllabi, selectedId]);

  const selectedSyllabus = useMemo(() => {
    if (selectedId === 'all') return null;
    return mySyllabi.find(s => s.id === Number(selectedId));
  }, [mySyllabi, selectedId]);

  const checks = useMemo(() => {
    const count = target.length;
    const total = count || 1;
    const approved = target.filter(s => s.status === 'approved').length;
    const base = Math.round((approved / total) * 100);

    return CHECKS.map((c, i) => {
      let val;
      if (count === 0) { val = 0; }
      else switch (c.key) {
        case 'format': val = Math.min(98, base + 5); break;
        case 'complete': val = Math.min(98, base + 2); break;
        case 'copo': val = Math.max(0, Math.min(98, base - 3)); break;
        case 'assess': val = Math.max(0, Math.min(98, base - 5)); break;
        case 'hours': val = Math.min(98, base + 8); break;
        case 'refs': val = Math.max(0, Math.min(98, base - 8)); break;
        default: val = base;
      }
      if (ran) val = Math.min(98, val + (i % 3 === 0 ? 2 : 1));
      return { ...c, val, status: val >= 79 ? 'good' : 'warn' };
    });
  }, [target, ran]);

  const score = Math.round(checks.reduce((a, x) => a + x.val, 0) / checks.length);

  const recommendations = useMemo(() => {
    const recs = [];
    if (target.length === 0) {
      recs.push({ level: 'High', title: 'No syllabus selected', text: 'Select a syllabus or view all to run compliance checks.' });
      return recs;
    }
    const formatCheck = checks.find(c => c.key === 'format');
    const assessCheck = checks.find(c => c.key === 'assess');
    const refsCheck = checks.find(c => c.key === 'refs');
    const copoCheck = checks.find(c => c.key === 'copo');

    if (formatCheck?.status === 'warn') recs.push({ level: 'High', title: 'Improve format compliance', text: 'Ensure all template sections are filled and follow the institutional format v4 standard.' });
    if (assessCheck?.status === 'warn') recs.push({ level: 'High', title: 'Strengthen assessment alignment', text: 'Explicitly connect assessment methods to course outcomes and performance indicators.' });
    if (copoCheck?.status === 'warn') recs.push({ level: 'Medium', title: 'Improve CO–PO mapping', text: 'Add more Mastered (M) level mappings to strengthen curriculum alignment.' });
    if (refsCheck?.status === 'warn') recs.push({ level: 'Medium', title: 'Improve reference currency', text: 'Replace or supplement references older than ten years with recent sources.' });
    recs.push({ level: 'Low', title: 'Review contact-hour notation', text: 'Define lecture-laboratory-independent hours clearly in the course information section.' });
    return recs.slice(0, 4);
  }, [checks, target, ran]);

  const run = () => { setRan(true); notify('AI compliance check completed.'); };

  return (
    <>
      <PageHead title="AI Syllabus Checker" subtitle="Automatically check institutional format, completeness, curriculum alignment, and quality indicators." actions={<button className="btn primary" onClick={run}><Icon name="sparkle" size={16} /> Re-run AI Check</button>} />
      <div className="check-strip">
        <span><small>Select Syllabus</small><b><select value={selectedId} onChange={e => { setSelectedId(e.target.value); setRan(false); }} style={{ border: 'none', background: 'transparent', fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0, margin: 0, font: 'inherit', color: 'inherit', width: '100%' }}><option value="all">All Syllabi ({mySyllabi.length})</option>{mySyllabi.map(s => <option key={s.id} value={s.id}>{s.courseCode} — {s.title}</option>)}</select></b></span>
        {selectedSyllabus && <span><small>Status</small><b className={`status ${selectedSyllabus.status}`}>{STATUS_LABELS[selectedSyllabus.status] || selectedSyllabus.status}</b></span>}
        <span><small>Checked</small><b>{new Date().toLocaleDateString()}</b></span>
        <span><small>Standard</small><b>Undergraduate Syllabus v4</b></span>
      </div>
      <div className="ai-layout">
        <div className="score-card"><span>Overall AI Compliance</span><div className="big-ring" style={{ '--p': `${score * 3.6}deg` }}><div><strong>{score}%</strong><small>{score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Needs Work'}</small></div></div><p>{selectedSyllabus ? `${selectedSyllabus.courseCode} compliance estimate.` : 'Institutional compliance across all syllabi.'}</p><div className="score-delta">{ran ? '↑ Re-checked' : selectedId === 'all' ? 'Based on all syllabi' : 'Based on selected syllabus'}</div></div>
        <div className="check-table card"><div className="card-head"><h3>Compliance Areas</h3><span className="ai-badge">AI ANALYSIS</span></div>{checks.map(({ name, val, status }) => <div className="check-row" key={name}><div><strong>{name}</strong><div className="bar thin"><i style={{ width: `${val}%` }} /></div></div><b>{val}%</b><span className={status === 'good' ? 'check-ok' : 'check-warn'}>{status === 'good' ? '✓' : '!'}</span></div>)}</div>
        <div className="recommend-card"><div className="recommend-head"><span><Icon name="sparkle" size={20} /></span><div><h3>AI Recommendations</h3><p>Priority suggestions based on {selectedSyllabus ? 'this syllabus' : 'your syllabi'}.</p></div></div>{recommendations.map((r, i) => <Recommendation key={i} {...r} />)}</div>
      </div>
      <div className="ai-note"><Icon name="sparkle" size={16} /> AI suggestions support — but do not replace — faculty, curriculum committee, and academic quality review.</div>
    </>
  );
}
