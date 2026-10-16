import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
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
    let txt = `${tr('FACULTY COMPLIANCE REPORT')}\nAY 2026–2027\n${tr('Generated')}: ${fmt(new Date())}\n\n`;
    txt += `${tr('Total Syllabi')}: ${syllabi.length}\n${tr('Approved')}: ${totalApproved}\n${tr('Compliance Rate')}: ${complianceRate}%\n\n`;
    txt += `${tr('FACULTY BREAKDOWN')}\n`;
    facultyData.forEach(f => { txt += `${f.name}: ${tr(`${f.total} total, ${f.approved} approved, ${f.rate}% compliance`)}\n`; });
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'faculty-compliance-report.txt'; a.click(); URL.revokeObjectURL(a.href);
    notify(translateUI("ui.report_downloaded_c0e45e"));
  };
  return (
    <>
      <PageHead title={translateUI("ui.reports_88bc3f")} subtitle={translateUI("ui.generate_compliance_accreditation_and_historical_reports_for_inst_673ed4")} />
      <div className="reports-grid">
        <Card title={translateUI("ui.faculty_compliance_report_91eba7")} action={<StableButton className="btn outline" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={genReport}>{translateUI("ui.download_e4d296")}</StableButton>}>
          <p className="muted" style={{ marginBottom: 12 }}>{translateUI("ui.computed_from_live_syllabus_data_5e6cfe")}</p>
          {facultyData.map(f => <div className="report-row" key={f.name}><span>{f.name}</span><span>{f.total}{translateUI("ui.total_9ac1f4")}</span><span>{f.approved}{translateUI("ui.approved_cd0fee")}</span><span className={f.rate >= 100 ? 'badge green' : 'badge gold'}>{f.rate}%</span></div>)}
        </Card>
        <Card title={translateUI("ui.accreditation_audit_summary_aa0020")}>
          <div className="report-stats"><div><strong>{mySyllabi.length}</strong><small>{translateUI("ui.total_syllabi_6ef623")}</small></div><div><strong>{totalApproved}</strong><small>{translateUI("ui.approved_41b81e")}</small></div><div><strong>{mySyllabi.filter(s => s.status === 'under_review').length}</strong><small>{translateUI("ui.under_review_18afed")}</small></div><div><strong>{complianceRate}%</strong><small>{translateUI("ui.compliance_68f0ae")}</small></div></div>
          <p className="muted" style={{ marginTop: 12 }}>{translateUI("ui.pacucoa_accreditation_report_generated_for_institutional_complian_60dc81")}</p>
        </Card>
        <Card title={translateUI("ui.historical_exports_5581a0")}>
          <div className="export-list">
            <button className="export-row" onClick={() => notify(translateUI("ui.preparing_download_demo_089194"))}>{translateUI("ui.semester_1_final_compliance_xlsx_df9ccf")}</button>
            <button className="export-row" onClick={() => notify(translateUI("ui.preparing_download_demo_089194"))}>{translateUI("ui.ched_regional_alignment_report_pdf_f98de5")}</button>
            <button className="export-row" onClick={() => notify(translateUI("ui.preparing_download_demo_089194"))}>{translateUI("ui.department_audit_q4_pdf_3d917b")}</button>
          </div>
        </Card>
      </div>
    </>
  );
}
