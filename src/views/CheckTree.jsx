import { actionLabel, rowState, scoreText, tone } from '../lib/complianceView';

const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };

// The administrator's list of submitted syllabi: faculty member, then program, then subject. Each subject row shows its score, what
// state its check is in, and a Check (none yet) or Re-check button; clicking the subject opens it. It only displays: the page that
// uses it loads the rows and runs the checks.
//   groups   from groupByFacultyProgram(rows)       total   how many syllabi there are before any filter
//   busy     { syllabusId: true } while a check runs   working   true while any check runs (buttons wait)
export default function CheckTree({ groups, total, onOpen, onCheck, busy = {}, working = false }) {
  return (
    <div className="aic-tree card">
      {total === 0 && <p className="cmp-small">No syllabus has been submitted yet.</p>}
      {total > 0 && groups.length === 0 && <p className="cmp-small">No syllabus matches. Clear the search or the filters.</p>}
      {groups.map((f) => (
        <section className="aic-faculty" key={f.key} aria-label={f.facultyName}>
          <header>
            <h4>{f.facultyName}</h4>
            <span className="cmp-small">{f.count + (f.count === 1 ? ' syllabus' : ' syllabi')}{f.average !== null ? ' · average ' + f.average + '%' : ''}</span>
          </header>
          {f.programs.map((p) => (
            <div className="aic-program" key={p.key}>
              <h5>{p.code ? p.code + (p.name ? ' · ' + p.name : '') : 'No program'}</h5>
              {p.rows.map((r) => {
                const st = rowState(r);
                const label = actionLabel(r);
                return (
                  <div className="aic-row" key={r.syllabusId}>
                    <button type="button" className="aic-open" onClick={() => onOpen(r)}>
                      <span><strong>{r.courseCode}</strong><small>{(r.courseTitle || r.title) + ' · ' + r.version + ' · ' + (STATUS_LABELS[r.status] || r.status)}</small></span>
                      <b className={tone(r.run && r.run.overall, 79)}>{scoreText(r.run)}</b>
                    </button>
                    <span className="aic-state">
                      {st === 'uploaded' && <span className="chip quiet" title="Submitted as an uploaded file: there is no builder form to check">Uploaded file</span>}
                      {st === 'unchecked' && <span className="chip quiet">Not checked</span>}
                      {st === 'insufficient' && <span className="chip quiet">Not enough content</span>}
                      {r.run && r.run.stale && <span className="chip stale">Out of date</span>}
                      {r.run && r.run.checkedBy === 'admin' && <span className="chip quiet">Checked by admin</span>}
                    </span>
                    {label
                      ? <button type="button" className="btn outline aic-act" disabled={working || !!busy[r.syllabusId]} onClick={() => onCheck(r)}>{busy[r.syllabusId] ? 'Checking…' : label}</button>
                      : <span className="aic-act none" />}
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
