import { t as translateUI } from "../i18n/index.js";
import { useMemo } from 'react';
import { Avatar, PageHead } from '../components/ui';
import { facultyCompliance, REQUIRED } from '../lib/facultyCompliance';

export default function Compliance({ syllabi, focus = '', onClearFocus = () => {} }) {
  const required = REQUIRED;
  // One card per faculty member, by account; the counting rule is shared with the Reports page (facultyCompliance.js).
  const facultyData = useMemo(() => facultyCompliance(syllabi, required).filter((f) => !focus || f.name === focus), [syllabi, focus]);
  return (
    <>
      <PageHead title={translateUI("ui.faculty_compliance_monitoring_7b4446")} /* subtitle={translateUI("ui.track_syllabus_submission_compliance_per_faculty_member_for_pacuc_a8b5e5")} */ />
      {focus && <p className="comp-focus"><span>{translateUI("search.showing", { p0: focus })}</span><button type="button" className="link" onClick={onClearFocus}>{translateUI("search.show_all")}</button></p>}
      <div className="comp-grid">
        {facultyData.map(f => <div className="comp-card" key={f.key}>
          <div className="comp-head"><Avatar className="comp-av" userId={f.userId} src={f.avatarUrl} name={f.name} /><div><h4>{f.name}</h4><small>{f.approved}{translateUI("ui.approved_4f3fcf")}{f.waiting}{translateUI("ui.under_review_bfad2e")}</small></div><span className={`comp-badge ${f.compliant ? 'ok' : 'warn'}`}>{f.compliant ? translateUI("ui.compliant_c584a3") : translateUI("ui.non_compliant_6d126a")}</span></div>
          <div className="progress-row"><div><span>{f.counted}{translateUI("ui.of_607f2d")}{required}{translateUI("ui.required_0e7f72")}</span><b>{f.pct}%</b></div><div className="bar"><i style={{ width: `${f.pct}%` }} /></div></div>
          {!f.compliant && <div className="comp-warn">{translateUI("ui.missing_09a3b7")}{required - f.counted}{translateUI("ui.of_607f2d")}{required}{translateUI("ui.required_syllabus_submissions_2992e9")}</div>}
        </div>)}
      </div>
    </>
  );
}
