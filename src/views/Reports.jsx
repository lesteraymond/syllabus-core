import { useMemo } from 'react';
import { PageHead, Card } from '../components/ui';
import { fmt } from '../lib/utils';

export default function Reports({ syllabi, user, notify }) {
  const mySyllabi = useMemo(() => user.role === 'faculty' ? syllabi.filter(s => s.userId === user.id) : syllabi, [syllabi, user]);
  const facultyData = useMemo(() => {
    const map = {}; const req = 2;
    mySyllabi.forEach(s => { if (!map[s.faculty]) map[s.faculty] = { name: s.faculty, total: 0, approved: 0 }; map[s.faculty].total++; if (s.status === 'approved') map[s.faculty].approved++; });
    return Object.values(map).map(f => ({ ...f, rate: Math.min(100, Math.round((f.approved / req) * 100)) }));
  }, [mySyllabi]);
  const totalApproved = mySyllabi.filter(s => s.status === 'approved').length;
  const complianceRate = mySyllabi.length ? Math.round((totalApproved / mySyllabi.length) * 100) : 0;
  const genReport = () => {
    let txt = `FACULTY COMPLIANCE REPORT\nAY 2026–2027\nGenerated: ${fmt(new Date())}\n\n`;
    txt += `Total Syllabi: ${syllabi.length}\nApproved: ${totalApproved}\nCompliance Rate: ${complianceRate}%\n\n`;
    txt += `FACULTY BREAKDOWN\n`;
    facultyData.forEach(f => { txt += `${f.name}: ${f.total} total, ${f.approved} approved, ${f.rate}% compliance\n`; });
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'faculty-compliance-report.txt'; a.click(); URL.revokeObjectURL(a.href);
    notify('Report downloaded.');
  };
  return (
    <>
      <PageHead title="Reports" subtitle="Generate compliance, accreditation, and historical reports for institutional review." />
      <div className="reports-grid">
        <Card title="Faculty Compliance Report" action={<button className="btn outline" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={genReport}>⇩ Download</button>}>
          <p className="muted" style={{ marginBottom: 12 }}>Computed from live syllabus data.</p>
          {facultyData.map(f => <div className="report-row" key={f.name}><span>{f.name}</span><span>{f.total} total</span><span>{f.approved} approved</span><span className={f.rate >= 100 ? 'badge green' : 'badge gold'}>{f.rate}%</span></div>)}
        </Card>
        <Card title="Accreditation & Audit Summary">
          <div className="report-stats"><div><strong>{mySyllabi.length}</strong><small>Total Syllabi</small></div><div><strong>{totalApproved}</strong><small>Approved</small></div><div><strong>{mySyllabi.filter(s => s.status === 'under_review').length}</strong><small>Under Review</small></div><div><strong>{complianceRate}%</strong><small>Compliance</small></div></div>
          <p className="muted" style={{ marginTop: 12 }}>PACUCOA Accreditation Report — generated for institutional compliance review.</p>
        </Card>
        <Card title="Historical Exports">
          <div className="export-list">
            <button className="export-row" onClick={() => notify('Preparing download (demo).')}>📄 Semester_1_Final_Compliance.xlsx ⇩</button>
            <button className="export-row" onClick={() => notify('Preparing download (demo).')}>📄 CHED_Regional_Alignment_Report.pdf ⇩</button>
            <button className="export-row" onClick={() => notify('Preparing download (demo).')}>📄 Department_Audit_Q4.pdf ⇩</button>
          </div>
        </Card>
      </div>
    </>
  );
}
