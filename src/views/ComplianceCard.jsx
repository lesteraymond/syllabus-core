import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { SOURCE_LABEL, STEP_INFO, areaNames, basis, blockersOf, groupFindings, headline, provisionalOf, runState, stepLabel, tone, ringAngle, when } from '../lib/complianceView';
import HybridCheckPanel from '../components/HybridCheckPanel';
import { useAiGate } from '../lib/checkPolicy';
import {isAcademicV2,isIntegratedAcademicV2} from '../lib/academicEvaluation';
import AcademicEvaluationPanel from '../components/AcademicEvaluationPanel';
import RuleCoveragePanel from '../components/RuleCoveragePanel';
import CoordinatedPlanPanel from '../components/CoordinatedPlanPanel';

const lastScores = new Map();

// One stored compliance run, shown the same way everywhere: the Review & Check step of the builder, the admin overview and Review &
// Approval. The ring, the six areas, what blocks a submit, the recommendations (each marked Rule or AI, each linked to its step), and
// the findings behind the score. It only displays; fetching and re-checking belong to the screen that uses it.
//   onOpenStep(stepKey)  when given, a step name becomes a button that jumps there (the builder); otherwise it is plain text.
//   checking             true while a check is running: the ring shows progress instead of a score that is about to change.
export default function ComplianceCard({ run, checking = false, onOpenStep, showFindings = true, onApplyDraft }) {
  const state = runState(run);
  const t = state === 'scored' ? tone(run.overall, run.passThreshold) : 'none';
  const how = basis(run);
  const provisional = provisionalOf(run); // an unfinished check still shows its score so far, labelled as provisional
  const aiGate = useAiGate();
  // A saved report of a syllabus under record review is read as history: nothing in it can be applied to the draft.
  const applyDraft = run?.recordReview ? undefined : onApplyDraft;
  const reviewNotice = run?.recordReview && <div className="info-banner warning cmp-stale" role="alert" data-testid="saved-report-banner"><strong>{translateUI('hybrid.savedReportTitle')}</strong> {translateUI(run.recordReview.code === 'curriculum_reference_review_required' ? 'hybrid.savedReportBodyCurriculum' : 'hybrid.savedReportBody')}</div>;
  if(isAcademicV2(run))return <>{reviewNotice}{run?.hybrid?.improvementPlan && <CoordinatedPlanPanel run={run} onPlanApplied={applyDraft} />}<AcademicEvaluationPanel run={run} onApplyDraft={applyDraft}/></>;
  const blockers = blockersOf(run, aiGate);
  const recs = (run && run.recommendations) || [];
  const memKey = run?.syllabusId ?? run?.id ?? 'default';
  const currentScore = checking
    ? null
    : state === 'scored'
      ? Math.max(0, Math.min(100, Number(run.overall) || 0))
      : provisional
        ? Math.max(0, Math.min(100, Number(provisional.score) || 0))
        : null;
  let ringStyle = { '--p': '0deg', '--target-p': '0deg', '--from-p': '0deg', '--water': '28%', '--from-water': '12%' };
  let flowClass = '';
  if (currentScore !== null) {
    const prev = lastScores.get(memKey);
    const hasChanged = typeof prev === 'number' && prev !== currentScore;
    const isHigher = hasChanged ? currentScore > prev : t === 'good';
    const fromScore = hasChanged ? prev : (isHigher ? 0 : 100);
    const targetAngle = state === 'scored' ? ringAngle(run.overall) : ringAngle(provisional.score);
    flowClass = isHigher ? ' is-filling' : ' is-draining';
    ringStyle = {
      '--p': targetAngle,
      '--target-p': targetAngle,
      '--from-p': `${Math.round(fromScore * 3.6)}deg`,
      '--water': `${currentScore}%`,
      '--from-water': `${fromScore}%`,
    };
    lastScores.set(memKey, currentScore);
  }
  const stepRef = (key) => {
    if (!STEP_INFO[key]) return null;
    return onOpenStep
      ? <button type="button" className="cmp-step" onClick={() => onOpenStep(key)}>{tr(stepLabel(key))}</button>
      : <span className="cmp-step plain">{tr(stepLabel(key))}</span>;
  };

  return (
    <div className="cmp">
      {/* Staleness is stated before anything it qualifies: the V2 results, the coverage list and the recommendations below all describe the earlier version. */}
      {reviewNotice}
      {run && run.stale && !run.recordReview && <div className="info-banner warning cmp-stale" role="alert" data-testid="stale-banner"><strong>{translateUI('hybrid.staleTitle')}</strong> {translateUI('hybrid.staleBody')}</div>}
      <RuleCoveragePanel coverage={run?.hybrid?.ruleCoverage} />
      {run?.hybrid?.improvementPlan && <CoordinatedPlanPanel run={run} onPlanApplied={applyDraft} />}
      {isIntegratedAcademicV2(run) && <AcademicEvaluationPanel run={run} />}
      <div className="cmp-top">
        {checking
          ? <div className="big-ring cmp-ring checking" style={ringStyle} role="img" aria-label={translateUI("ui.checking_your_syllabus_1278c5")}><div><strong aria-hidden="true">…</strong><small>{translateUI("ui.checking_820d60")}</small></div></div>
          : state === 'scored'
          ? <div className={'big-ring cmp-ring ' + t + flowClass} style={ringStyle} role="img" aria-label={translateUI("ui.compliance_score_7a084d") + run.overall + translateUI("ui.percent_c72154") + tr(run.band)}><div><strong>{run.overall}%</strong><small>{tr(run.band)}</small></div></div>
          : provisional
          ? <div className={'big-ring cmp-ring provisional' + flowClass} style={ringStyle} role="img" aria-label={translateUI('hybrid.provisionalAria', { score: provisional.score })}><div><strong>{provisional.score}%</strong><small>{translateUI('hybrid.provisional')}</small></div></div>
          : <div className="cmp-ring none" role="img" aria-label={translateUI("ui.no_score_yet_3662ab")}><div><strong>—</strong><small>{state === 'incomplete' ? translateUI('hybrid.incomplete') : state === 'insufficient' ? translateUI("ui.not_enough_content_1c0e67") : translateUI("ui.not_checked_22705e")}</small></div></div>}
        <div className="cmp-head">
          <p className="cmp-line">{provisional
            ? translateUI(provisional.rule ? 'hybrid.provisionalRule' : provisional.total ? 'hybrid.provisionalCoverage' : 'hybrid.provisionalPlain', { verified: provisional.verified, total: provisional.total })
            : run?.recordReview ? translateUI('hybrid.savedReportLine') : aiGate === 'advisory' && state === 'incomplete' && blockers.length === 0 ? translateUI('hybrid.advisoryIncomplete') : tr(headline(run))}</p>
          <div className="cmp-chips">
            {run?.hybrid?.referenceContext?.po?.reference && <span className="chip quiet" title={translateUI('hybrid.poReferenceNote')}>
              {translateUI('hybrid.poReferenceBasis',{program:run.hybrid.referenceContext.program.code,source:run.hybrid.referenceContext.po.source,version:run.hybrid.referenceContext.po.reference.version,curriculum:run.hybrid.referenceContext.curriculum.source||'—'})}
            </span>}
            {run?.hybrid && run.hybrid.alignment.status !== 'completed' && <span className="hy-pill warn">{translateUI('hybrid.alignment', { status: translateUI(`hybrid.status.${run.hybrid.alignment.status}`) })}</span>}
            {run?.hybrid?.semanticCoverage && !run.hybrid.semanticCoverage.complete && <span className="hy-pill warn" title={translateUI('hybrid.vpaaCoverageNote.' + run.hybrid.semanticCoverage.reason)}>{translateUI('hybrid.vpaaCoverage', { done: run.hybrid.semanticCoverage.evaluated, total: run.hybrid.semanticCoverage.total })}</span>}
            {run && how.label && <span className={'chip basis ' + how.kind}>{tr(how.label)}</span>}
            {run && run.checkedBy === 'admin' && <span className="chip quiet">{translateUI("ui.checked_by_an_administrator_2cf77d")}</span>}
            {run && run.stale && <span className="chip stale">{run.recordReview ? translateUI('hybrid.savedReportChip') : translateUI("ui.out_of_date_the_syllabus_changed_after_this_check_384297")}</span>}
            {run && <span className="chip quiet">{translateUI("ui.standard_f00ef0") + run.standard}{when(run.createdAt) ? translateUI("ui.checked_e3b884") + when(run.createdAt) : ''}</span>}
          </div>
          {run && run.contact && run.contact.termHours !== null && run.contact.termHours !== undefined && (
            <p className="cmp-small">{translateUI("ui.contact_hours_a41bbd") + run.contact.hoursPerWeek + translateUI("ui.a_week_about_47d819") + run.contact.termHours + translateUI("ui.for_the_term_the_plan_covers_825f4f") + run.contact.weeksPlanned + translateUI("ui.of_607f2d") + run.contact.weeksExpected + translateUI("ui.weeks_ff9807")}</p>
          )}
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="cmp-block" role="alert">
          <b>{translateUI("ui.these_stop_the_syllabus_from_being_submitted_cff5cf")}</b>
          <ul>{blockers.map((f) => <li key={f.id}>{tr(f.message)} {stepRef(f.step)}</li>)}</ul>
        </div>
      )}

      {recs.length > 0 && (
        <div className="cmp-recs">
          <h4>{translateUI("ui.recommendations_4faa65")}</h4>
          {how.note && <p className="cmp-small">{tr(how.note)}</p>}
          {recs.map((r, i) => (
            <div className="recommend" key={i}>
              <span className={'priority ' + String(r.level || 'low').toLowerCase()}>{tr(r.level)}</span>
              <div>
                <strong>{tr(r.title)}</strong>
                <p>{tr(r.text)}</p>
                <div className="cmp-chips">
                  <span className={'chip src ' + r.source}>{tr(SOURCE_LABEL[r.source] || r.source)}</span>
                  {stepRef(r.step)}
                  {areaNames(run, r).map((n) => <span className="chip quiet" key={n}>{tr(n)}</span>)}
                  {(r.clos || []).length > 0 && <span className="chip quiet">{translateUI("ui.clo_069efc") + r.clos.join(', ')}</span>}
                  {(r.rows || []).length > 0 && <span className="chip quiet">{tr(r.rows.length > 1 ? 'Rows' : 'Row') + ' ' + r.rows.map((x) => x + 1).join(', ')}</span>}
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
              <ul>{g.findings.map((f) => <li key={f.id} className={f.severity === 'blocking' ? 'blocking' : undefined}><span className="chip src rule">{f.severity === 'blocking' ? translateUI("ui.rule_blocks_submit_a7fc69") : translateUI("ui.rule_78e179")}</span> {tr(f.message)} {stepRef(f.step)}</li>)}</ul>
            </div>
          ))}
        </details>
      )}
      <HybridCheckPanel run={run} onApplyDraft={applyDraft} />
    </div>
  );
}
