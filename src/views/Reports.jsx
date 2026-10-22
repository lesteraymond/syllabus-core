import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useState } from 'react';
import { PageHead, Card, Icon } from '../components/ui';
import { compliance } from '../lib/api';
import { buildFacultyReport, buildReport } from '../lib/reportView';
import { facultyCompliance } from '../lib/facultyCompliance';
import { SEMESTER_KEYS } from '../lib/deadlineView';

export default function Reports({ syllabi, user, notify }) {
  // Historical reports: one per school term that has checks in it, built from the stored checks made in that term.
  const [termList, setTermList] = useState(null);
  const [busyTerm, setBusyTerm] = useState('');
  useEffect(() => {
    let live = true;
    compliance.terms().then((r) => { if (live) setTermList(Array.isArray(r && r.terms) ? r.terms : []); }, () => { if (live) setTermList([]); });
    return () => { live = false; };
  }, []);
  const downloadTerm = async (t) => {
    const key = t.schoolYear + t.semester;
    setBusyTerm(key);
    try {
      const [{ downloadReport }, data] = await Promise.all([import('../lib/reportPdf'), compliance.list('all', t)]);
      await downloadReport(buildReport(Array.isArray(data && data.syllabi) ? data.syllabi : [], { user, term: t }));
      notify(translateUI("report.saved"));
    } catch (err) {
      console.error('Historical report failed', err);
      notify(translateUI("reports.term_failed"));
    } finally { setBusyTerm(''); }
  };
  const mySyllabi = useMemo(() => user.role === 'faculty' ? syllabi.filter(s => s.userId === user.id) : syllabi, [syllabi, user]);
  // The same counting rule as the Compliance page (facultyCompliance.js).
  const facultyData = useMemo(() => facultyCompliance(mySyllabi), [mySyllabi]);
  const totalApproved = mySyllabi.filter(s => s.status === 'approved').length;
  const complianceRate = mySyllabi.length ? Math.round((totalApproved / mySyllabi.length) * 100) : 0;
  const [faculty, setFaculty] = useState(false);
  const genReport = async () => {
    setFaculty(true);
    try {
      const { downloadFacultyReport } = await import('../lib/reportPdf');
      await downloadFacultyReport(buildFacultyReport(mySyllabi, { user }));
      notify(translateUI("report.saved"));
    } catch (err) {
      console.error('Faculty compliance report failed', err);
      notify(translateUI("reports.term_failed"));
    } finally { setFaculty(false); }
  };
  return (
    <>
      <PageHead title={translateUI("ui.reports_88bc3f")} subtitle={translateUI("ui.generate_compliance_accreditation_and_historical_reports_for_inst_673ed4")} />
      <div className="reports-grid">
        <Card title={translateUI("ui.faculty_compliance_report_91eba7")} action={<StableButton className="btn outline" style={{ padding: '4px 8px', fontSize: '12px' }} disabled={faculty} onClick={genReport}>{translateUI("ui.download_e4d296")}</StableButton>}>
          <p className="muted" style={{ marginBottom: 12 }}>{translateUI("ui.computed_from_live_syllabus_data_5e6cfe")}</p>
          {facultyData.map(f => <div className="report-row" key={f.name}><span>{f.name}</span><span>{f.counted}{translateUI("ui.total_9ac1f4")}</span><span>{f.approved}{translateUI("ui.approved_cd0fee")}</span><span className={f.pct >= 100 ? 'badge green' : 'badge gold'}>{f.pct}%</span></div>)}
        </Card>
        <Card title={translateUI("ui.accreditation_audit_summary_aa0020")}>
          <div className="report-stats"><div><strong>{mySyllabi.length}</strong><small>{translateUI("ui.total_syllabi_6ef623")}</small></div><div><strong>{totalApproved}</strong><small>{translateUI("ui.approved_41b81e")}</small></div><div><strong>{mySyllabi.filter(s => s.status === 'under_review').length}</strong><small>{translateUI("ui.under_review_18afed")}</small></div><div><strong>{complianceRate}%</strong><small>{translateUI("ui.compliance_68f0ae")}</small></div></div>
        </Card>
        <Card title={translateUI("ui.historical_exports_5581a0")}>
          <div className="export-list">
            {termList === null && <p className="muted">{translateUI("reports.term_loading")}</p>}
            {termList && !termList.length && <p className="muted">{translateUI("reports.term_none")}</p>}
            {(termList || []).map((t) => (
              <div className="term-row" key={t.schoolYear + t.semester}>
                <span><strong>{t.schoolYear}</strong> · {translateUI(SEMESTER_KEYS[t.semester])}<small className="muted" style={{ display: 'block' }}>{translateUI("reports.term_counts", { p0: t.checks, p1: t.syllabi })}</small></span>
                <StableButton type="button" className="btn outline term-download" disabled={!!busyTerm} onClick={() => downloadTerm(t)}><Icon name="downloadSimple" size={16} />{translateUI("reports.term_download")}</StableButton>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
