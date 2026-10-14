import { useRef } from 'react';
import { useModalLayer } from './useModalLayer';
import ComplianceCard from '../views/ComplianceCard';
import { ringAngle, runState, tone } from '../lib/complianceView';

// One syllabus's stored compliance check, in a dialog: who and what it is, the score ring, the six areas, then the shared
// ComplianceCard (recommendations, blockers, findings). It only displays; the page loads the run, polls while recommendations are
// still being written, and runs the re-check.
//   syllabus  { courseCode, courseTitle, title, facultyName, programCode, programName }     run   the stored run (or null)
//   checking  true while a re-check runs      error   a message to show (for example the rate limit)
export default function ComplianceModal({ syllabus, run, checking = false, error = '', onRecheck, onClose }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose); // Esc closes, focus stays inside and returns to the button that opened it

  const state = runState(run);
  const t = state === 'scored' ? tone(run.overall, run.passThreshold) : 'none';
  const program = syllabus.programCode ? syllabus.programCode + (syllabus.programName ? ' · ' + syllabus.programName : '') : (syllabus.programName || 'No program');
  const title = syllabus.courseTitle || syllabus.title;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cm-modal" role="dialog" aria-modal="true" aria-labelledby="cm-title" tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head cm-head">
          <div>
            <h3 id="cm-title">{syllabus.courseCode + (title ? ' — ' + title : '')}</h3>
            <small>{(syllabus.facultyName || 'Unknown faculty') + ' · ' + program}</small>
          </div>
        </div>

        <div className="modal-body cm-body">
          {error && <div className="info-banner warning" role="alert">{error}</div>}

          <div className="cm-score">
            {state === 'scored'
              ? <div className={'big-ring cm-ring ' + t} style={{ '--p': ringAngle(run.overall) }} role="img" aria-label={'Compliance score ' + run.overall + ' percent, ' + run.band}><div><strong>{run.overall}%</strong><small>{run.band}</small></div></div>
              : <div className="big-ring cm-ring none" role="img" aria-label="No score yet"><div><strong>—</strong><small>{state === 'insufficient' ? 'Not enough content' : 'Not checked'}</small></div></div>}
            {run && (
              <div className="cm-areas">
                {run.areas.map((a) => {
                  const at = a.score === null ? 'none' : tone(a.score, run.passThreshold);
                  return (
                    <div className={'cm-area ' + at} key={a.key}>
                      <span>{a.name}</span>
                      <b>{a.score === null ? '—' : a.score + '%'}</b>
                      <div className="bar thin" role="img" aria-label={a.name + ' ' + (a.score === null ? 'not scored' : a.score + ' percent')}><i style={{ width: (a.score === null ? 0 : a.score) + '%' }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <ComplianceCard run={run} showFindings />
        </div>

        <div className="modal-foot cm-foot">
          <span className="cm-live" role="status" aria-live="polite">{checking ? 'Checking…' : ''}</span>
          <button type="button" className="btn outline" disabled={checking} onClick={onRecheck}>{checking ? 'Checking…' : 'Re-check'}</button>
          <button type="button" className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
