import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useState } from 'react';
import { students } from '../lib/api';

// What a signed-in student sees for now: their verified profile and the subjects read from their COR.
export default function StudentHome({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    students.me().then((d) => { if (live) setData(d); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, []);
  const p = data && data.profile;
  return (
    <div className="login-page">
      <section className="login-panel" style={{ margin: '0 auto' }}>
        <div className="login-card register-card">
          <img className="login-logo" src="/cite-logo.png" alt={translateUI("ui.college_logo_1df91f")} />
          <span className="eyebrow">{translateUI("ui.student_71ad6e")}</span>
          <h2>{translateUI("ui.welcome_a2513b")}{user.firstName}</h2>
          {error && <div className="form-error">{tr(error)}</div>}
          {!data && !error && <p className="muted">{translateUI("ui.loading_your_profile_f1468e")}</p>}
          {p && (
            <>
              <dl className="scan-list">
                {[['Student ID', p.student_id], ['Program', p.program], ['Year level', p.year_level], ['Section', p.section], ['Term', [p.term, p.school_year && 'AY ' + p.school_year].filter(Boolean).join(', ')]].map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>
                ))}
              </dl>
              {data.subjects.length > 0 && (
                <>
                  <h4>{translateUI("ui.enrolled_subjects_0ea329")}</h4>
                  <ul>{data.subjects.map((s, i) => <li key={i}><b>{s.subject_code}</b> {s.subject_title}</li>)}</ul>
                </>
              )}
            </>
          )}
          <StableButton className="btn outline wide" type="button" onClick={onLogout}>{translateUI("ui.sign_out_dc1649")}</StableButton>
        </div>
      </section>
    </div>
  );
}
