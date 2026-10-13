import { SOURCE_LABEL, STEP_INFO, areaNames, basis, blockersOf, groupFindings, headline, runState, stepLabel, tone, ringAngle, when } from '../lib/complianceView';

// One stored compliance run, shown the same way everywhere: the Review & Check step of the builder, the admin overview and Review &
// Approval. The ring, the six areas, what blocks a submit, the recommendations (each marked Rule or AI, each linked to its step), and
// the findings behind the score. It only displays; fetching and re-checking belong to the screen that uses it.
//   onOpenStep(stepKey)  when given, a step name becomes a button that jumps there (the builder); otherwise it is plain text.
export default function ComplianceCard({ run, onOpenStep, showFindings = true }) {
  const state = runState(run);
  const t = state === 'scored' ? tone(run.overall, run.passThreshold) : 'none';
  const how = basis(run);
  const blockers = blockersOf(run);
  const recs = (run && run.recommendations) || [];
  const stepRef = (key) => {
    if (!STEP_INFO[key]) return null;
    return onOpenStep
      ? <button type="button" className="cmp-step" onClick={() => onOpenStep(key)}>{stepLabel(key)}</button>
      : <span className="cmp-step plain">{stepLabel(key)}</span>;
  };

  return (
    <div className="cmp">
      <div className="cmp-top">
        {state === 'scored'
          ? <div className={'big-ring cmp-ring ' + t} style={{ '--p': ringAngle(run.overall) }} role="img" aria-label={'Compliance score ' + run.overall + ' percent, ' + run.band}><div><strong>{run.overall}%</strong><small>{run.band}</small></div></div>
          : <div className="cmp-ring none" role="img" aria-label="No score yet"><div><strong>—</strong><small>{state === 'insufficient' ? 'Not enough content' : 'Not checked'}</small></div></div>}
        <div className="cmp-head">
          <p className="cmp-line">{headline(run)}</p>
          <div className="cmp-chips">
            {run && how.label && <span className={'chip basis ' + how.kind}>{how.label}</span>}
            {run && run.checkedBy === 'admin' && <span className="chip quiet">Checked by an administrator</span>}
            {run && run.stale && <span className="chip stale">Out of date: the syllabus changed after this check</span>}
            {run && <span className="chip quiet">{'Standard ' + run.standard}{when(run.createdAt) ? ' · checked ' + when(run.createdAt) : ''}</span>}
          </div>
          {run && run.contact && run.contact.termHours !== null && run.contact.termHours !== undefined && (
            <p className="cmp-small">{'Contact hours: ' + run.contact.hoursPerWeek + ' a week, about ' + run.contact.termHours + ' for the term. The plan covers ' + run.contact.weeksPlanned + ' of ' + run.contact.weeksExpected + ' weeks.'}</p>
          )}
        </div>
      </div>

      {run && (
        <div className="cmp-areas">
          {run.areas.map((a) => {
            const at = a.score === null ? 'none' : tone(a.score, run.passThreshold);
            return (
              <div className="check-row" key={a.key}>
                <div><strong>{a.name}</strong><div className="bar thin"><i style={{ width: (a.score === null ? 0 : a.score) + '%' }} /></div></div>
                <b>{a.score === null ? '—' : a.score + '%'}</b>
                <span className={at === 'good' ? 'check-ok' : 'check-warn'} aria-label={at === 'good' ? 'on track' : at === 'warn' ? 'needs work' : 'not scored'}>{at === 'good' ? '✓' : at === 'warn' ? '!' : '·'}</span>
              </div>
            );
          })}
        </div>
      )}

      {blockers.length > 0 && (
        <div className="cmp-block" role="alert">
          <b>These stop the syllabus from being submitted:</b>
          <ul>{blockers.map((f) => <li key={f.id}>{f.message} {stepRef(f.step)}</li>)}</ul>
        </div>
      )}

      {recs.length > 0 && (
        <div className="cmp-recs">
          <h4>Recommendations</h4>
          {how.note && <p className="cmp-small">{how.note}</p>}
          {recs.map((r, i) => (
            <div className="recommend" key={i}>
              <span className={'priority ' + String(r.level || 'low').toLowerCase()}>{r.level}</span>
              <div>
                <strong>{r.title}</strong>
                <p>{r.text}</p>
                <div className="cmp-chips">
                  <span className={'chip src ' + r.source}>{SOURCE_LABEL[r.source] || r.source}</span>
                  {stepRef(r.step)}
                  {areaNames(run, r).map((n) => <span className="chip quiet" key={n}>{n}</span>)}
                  {(r.clos || []).length > 0 && <span className="chip quiet">{'CLO ' + r.clos.join(', ')}</span>}
                  {(r.rows || []).length > 0 && <span className="chip quiet">{(r.rows.length > 1 ? 'Rows ' : 'Row ') + r.rows.map((x) => x + 1).join(', ')}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {run && recs.length === 0 && state === 'scored' && run.findings && run.findings.length === 0 && <p className="cmp-small">Nothing to improve: every check passed.</p>}

      {showFindings && run && run.findings && run.findings.length > 0 && (
        <details className="cmp-find">
          <summary>{run.findings.length + (run.findings.length === 1 ? ' finding' : ' findings') + ' behind the score'}</summary>
          {groupFindings(run).map((g) => (
            <div key={g.key}>
              <h5>{g.name}</h5>
              <ul>{g.findings.map((f) => <li key={f.id}><span className="chip src rule">{f.severity === 'blocking' ? 'Rule · blocks submit' : 'Rule'}</span> {f.message} {stepRef(f.step)}</li>)}</ul>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
