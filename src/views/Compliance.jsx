import { t as translateUI } from "../i18n/index.js";
import { useMemo } from 'react';
import { PageHead } from '../components/ui';

export default function Compliance({ syllabi }) {
  const required = 2;
  const facultyData = useMemo(() => {
    const map = {};
    syllabi.forEach(s => {
      if (!map[s.faculty]) map[s.faculty] = { name: s.faculty, total: 0, approved: 0, review: 0 };
      map[s.faculty].total++;
      if (s.status === 'approved') map[s.faculty].approved++;
      else map[s.faculty].review++;
    });
    return Object.values(map).map(f => ({ ...f, compliant: f.total >= required, pct: Math.min(100, Math.round((f.total / required) * 100)) }));
  }, [syllabi]);
  return (
    <>
      <PageHead title={translateUI("ui.faculty_compliance_monitoring_7b4446")} subtitle={translateUI("ui.track_syllabus_submission_compliance_per_faculty_member_for_pacuc_a8b5e5")} />
      <div className="comp-grid">
        {facultyData.map(f => <div className="comp-card" key={f.name}>
          <div className="comp-head"><div className="comp-av">{f.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div><div><h4>{f.name}</h4><small>{f.approved}{translateUI("ui.approved_4f3fcf")}{f.review}{translateUI("ui.under_review_bfad2e")}</small></div><span className={`comp-badge ${f.compliant ? 'ok' : 'warn'}`}>{f.compliant ? translateUI("ui.compliant_c584a3") : translateUI("ui.non_compliant_6d126a")}</span></div>
          <div className="progress-row"><div><span>{f.total}{translateUI("ui.of_607f2d")}{required}{translateUI("ui.required_0e7f72")}</span><b>{f.pct}%</b></div><div className="bar"><i style={{ width: `${f.pct}%` }} /></div></div>
          {!f.compliant && <div className="comp-warn">{translateUI("ui.missing_09a3b7")}{required - f.total}{translateUI("ui.of_607f2d")}{required}{translateUI("ui.required_syllabus_submissions_2992e9")}</div>}
        </div>)}
      </div>
    </>
  );
}
