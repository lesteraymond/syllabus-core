import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useCountUp } from '../lib/useCountUp';
import { REVISION_LABEL, SOURCE_LABEL, STEP_INFO, areaNames, basis, blockersOf, groupFindings, headline, runState, stepLabel, targetsIn, tone, ringAngle, when } from '../lib/complianceView';

// One of the six area scores. Its bar and its number climb together from 0 to the score, one row after another, and drop back to 0 while a
// check is running (the same as the ring above).
function AreaRow({ a, passThreshold, index, checking }) {
  const at = a.score === null ? 'none' : tone(a.score, passThreshold);
  const target = a.score === null || checking ? 0 : a.score;
  const delay = checking ? 0 : 120 + index * 110;
  const shown = useCountUp(target, { delay, duration: 1100 });
  return (
    <div className="check-row">
      <div><strong>{tr(a.name)}</strong><div className="bar thin"><i className="area-fill" style={{ width: target + '%', transitionDelay: delay + 'ms' }} /></div></div>
      <b>{a.score === null ? '—' : shown + '%'}</b>
      <span className={at === 'good' ? 'check-ok' : 'check-warn'} aria-label={at === 'good' ? translateUI("ui.on_track_464e43") : at === 'warn' ? translateUI("ui.needs_work_def443") : translateUI("ui.not_scored_4e720d")}>{at === 'good' ? '✓' : at === 'warn' ? '!' : '·'}</span>
    </div>
  );
}

// One stored compliance run, shown the same way everywhere: the Review & Check step of the builder, the admin overview and Review &
// Approval. The ring, the six areas, what blocks a submit, the recommendations (each marked Rule or AI, each linked to its step), and
// the findings behind the score. It only displays; fetching and re-checking belong to the screen that uses it.
//   onOpenStep(stepKey)  when given, a step name becomes a button that jumps there (the builder); otherwise it is plain text.
// `checking` is true while a check is running: the ring shows 0% with a spinner, then the score climbs to its value when the run arrives.
// The spinner keeps turning while the AI is still checking the fields (the score can still move, see basis()).
export default function ComplianceCard({ run, onOpenStep, showFindings = true, checking = false }) {
  const state = runState(run);
  const scored = state === 'scored';
  const shown = useCountUp(scored && !checking ? run.overall : 0);
  const loading = checking || (!!run && run.aiStatus === 'pending');
  const t = state === 'scored' ? tone(run.overall, run.passThreshold) : 'none';
  const how = basis(run);
  const blockers = blockersOf(run);
  const recs = (run && run.recommendations) || [];
  // `paths` are the form paths the item is about: the link then highlights only those places in the step (week 7's row, one requirement...).
  const stepRef = (key, paths) => {
    if (!STEP_INFO[key]) return null;
    const targets = targetsIn(key, paths);
    return onOpenStep
      ? <button type="button" className="cmp-step" onClick={() => onOpenStep(key, targets.length ? { targets } : undefined)}>{tr(stepLabel(key))}</button>
      : <span className="cmp-step plain">{tr(stepLabel(key))}</span>;
  };

  const summary = (
    <>
      <div className="cmp-top">
        {scored || checking
          ? <div className={'big-ring cmp-ring ' + (scored ? t : 'warm') + (loading ? ' loading' : '')} style={{ '--p': ringAngle(shown) }} role="img" aria-busy={loading} aria-label={checking ? translateUI("ui.checking_820d60") : translateUI("ui.compliance_score_7a084d") + run.overall + translateUI("ui.percent_c72154") + tr(run.band)}>
            <div><strong>{shown}%</strong><small>{checking ? translateUI("ui.checking_820d60") : tr(run.band)}</small></div>
            {loading && <span className={'cmp-spin' + (checking ? '' : ' ai')} aria-hidden="true" />}
          </div>
          : <div className="cmp-ring none" role="img" aria-label={translateUI("ui.no_score_yet_3662ab")}><div><strong>—</strong><small>{state === 'insufficient' ? translateUI("ui.not_enough_content_1c0e67") : translateUI("ui.not_checked_22705e")}</small></div></div>}
        <div className="cmp-head">
          <p className="cmp-line">{tr(headline(run))}</p>
          <div className="cmp-chips">
            {run && how.label && <span className={'chip basis ' + how.kind}>{tr(how.label)}</span>}
            {run && run.checkedBy === 'admin' && <span className="chip quiet">{translateUI("ui.checked_by_an_administrator_2cf77d")}</span>}
            {run && run.stale && <span className="chip stale">{translateUI("ui.out_of_date_the_syllabus_changed_after_this_check_384297")}</span>}
            {run && <span className="chip quiet">{translateUI("ui.standard_f00ef0") + run.standard}{when(run.createdAt) ? translateUI("ui.checked_e3b884") + when(run.createdAt) : ''}</span>}
          </div>
          {run && run.contact && run.contact.termHours !== null && run.contact.termHours !== undefined && (
            <p className="cmp-small">{translateUI("ui.contact_hours_a41bbd") + run.contact.hoursPerWeek + translateUI("ui.a_week_about_47d819") + run.contact.termHours + translateUI("ui.for_the_term_the_plan_covers_825f4f") + run.contact.weeksPlanned + translateUI("ui.of_607f2d") + run.contact.weeksExpected + translateUI("ui.weeks_ff9807")}</p>
          )}
        </div>
      </div>

      {run && (
        <div className="cmp-areas">
          {run.areas.map((a, i) => <AreaRow key={a.key} a={a} passThreshold={run.passThreshold} index={i} checking={checking} />)}
        </div>
      )}
    </>
  );
  const detail = (
    <>
      {blockers.length > 0 && (
        <div className="cmp-block" role="alert">
          <b>{translateUI("ui.these_stop_the_syllabus_from_being_submitted_cff5cf")}</b>
          <ul>{blockers.map((f) => <li key={f.id}>{tr(f.message)} {stepRef(f.step, [f.path])}</li>)}</ul>
        </div>
      )}

      {loading && (checking || recs.length === 0) && (
        <div className="cmp-recs" aria-busy="true">
          <h4>{translateUI("ui.recommendations_4faa65")}</h4>
          <p className="cmp-status sug-busy" role="status" aria-live="polite"><span className="sug-spin" aria-hidden="true" />{translateUI('cmp.recs_busy')}</p>
          {[0, 1, 2, 3].map((i) => (
            <div className="rec-skel" key={i} aria-hidden="true" style={{ '--i': i }}>
              <span className="dot" />
              <div><span className="bar w60" /><span className="bar" /><span className="bar w30" /></div>
            </div>
          ))}
        </div>
      )}

      {recs.length > 0 && !checking && (
        <div className="cmp-recs">
          <h4>{translateUI("ui.recommendations_4faa65")}</h4>
          {how.note && <p className="cmp-small">{tr(how.note)}</p>}
          {recs.some((r) => r.source === 'ai') && <p className="cmp-small cmp-ai-warn" role="note">{translateUI('cmp.ai_mistakes')}</p>}
          {recs.map((r, i) => (
            <div className="recommend pop" key={i} style={{ '--i': i }}>
              <span className={'priority ' + String(r.level || 'low').toLowerCase()}>{tr(REVISION_LABEL[r.level] || r.level)}</span>
              <div>
                <strong>{tr(r.title)}</strong>
                <p>{tr(r.text)}</p>
                <div className="cmp-chips">
                  <span className={'chip src ' + r.source}>{tr(SOURCE_LABEL[r.source] || r.source)}</span>
                  {stepRef(r.step, [...(r.basedOn || []).map((b) => String(b).slice(String(b).indexOf(':') + 1)), ...(r.rows || []).map((x) => 'plan[' + x + ']')])}
                  {areaNames(run, r).map((n) => <span className="chip quiet" key={n}>{tr(n)}</span>)}
                  {(r.clos || []).length > 0 && <span className="chip quiet">{translateUI("ui.clo_069efc") + r.clos.join(', ')}</span>}
                  {(r.rows || []).length > 0 && (
                    <span className="chip quiet"><span>{tr(r.rows.length > 1 ? 'Rows' : 'Row') + ' '}
                      {r.rows.map((x, k) => (
                        <span key={x}>{k > 0 && ', '}{onOpenStep && r.step
                          ? <button type="button" className="cmp-rowlink" onClick={() => onOpenStep(r.step, { row: x })}>{x + 1}</button>
                          : x + 1}</span>
                      ))}
                    </span></span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {run && recs.length === 0 && state === 'scored' && run.findings && run.findings.length === 0 && <p className="cmp-small">{translateUI("ui.nothing_to_improve_every_check_passed_60de97")}</p>}

      {showFindings && run && run.findings && run.findings.length > 0 && (
        <details className="cmp-find">
          <summary>{tr(run.findings.length + (run.findings.length === 1 ? ' finding' : ' findings')) + translateUI("ui.behind_the_score_db725f")}</summary>
          {groupFindings(run).map((g) => (
            <div key={g.key}>
              <h5>{tr(g.name)}</h5>
              <ul>{g.findings.map((f) => <li key={f.id}><span className={'chip src ' + (f.source === 'ai' ? 'ai' : 'rule')}>{f.source === 'ai' ? tr(SOURCE_LABEL.ai) : f.severity === 'blocking' ? translateUI("ui.rule_blocks_submit_a7fc69") : translateUI("ui.rule_78e179")}</span> {tr(f.message)} {stepRef(f.step, [f.path])}</li>)}</ul>
            </div>
          ))}
        </details>
      )}
    </>
  );

  return (
    <div className="cmp">
      {summary}
      {detail}
    </div>
  );
}
