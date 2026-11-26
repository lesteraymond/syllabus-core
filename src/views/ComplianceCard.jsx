import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { SOURCE_LABEL, STEP_INFO, areaNames, basis, blockersOf, groupFindings, headline, provisionalOf, runState, stepLabel, tone, ringAngle } from '../lib/complianceView';
import { suggestionSection } from '../lib/hybridView';
import HybridCheckPanel from '../components/HybridCheckPanel';
import { useAiGate } from '../lib/checkPolicy';
import RuleCoveragePanel from '../components/RuleCoveragePanel';
import { useModalLayer } from '../components/useModalLayer';
import { GeminiEmblem, GeminiThinkingLine } from '../components/GeminiLoader';

const lastScores = new Map();
const RING_SIZE = 132;
const RING_R = 55;
const RING_C = 2 * Math.PI * RING_R;

function ScoreRing({ score, fromScore = 0, label, toneClass, passThreshold, ariaLabel, flowClass = '' }) {
  const gradId = useId();
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const clampedFrom = Math.max(0, Math.min(100, Number(fromScore) || 0));
  const toOffset = RING_C * (1 - clamped / 100);
  const fromOffset = RING_C * (1 - clampedFrom / 100);
  const showPassTick = Number.isFinite(passThreshold) && passThreshold > 0 && passThreshold < 100 && clamped < 100;
  const tickRad = showPassTick ? ((passThreshold / 100) * 360 - 90) * (Math.PI / 180) : 0;
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const style = {
    '--ring-from': `${fromOffset.toFixed(2)}`,
    '--ring-to': `${toOffset.toFixed(2)}`,
  };
  return (
    <div className={'big-ring cmp-ring has-svg ' + toneClass + flowClass} style={style} role="img" aria-label={ariaLabel}>
      <svg className="cmp-ring-svg" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ring-accent-hi)" />
            <stop offset="100%" stopColor="var(--ring-accent)" />
          </linearGradient>
        </defs>
        <circle className="cmp-ring-track" cx={cx} cy={cy} r={RING_R} fill="none" strokeWidth="10" />
        {clamped > 0 && (
          <circle
            className="cmp-ring-arc"
            cx={cx}
            cy={cy}
            r={RING_R}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={RING_C.toFixed(2)}
            strokeDashoffset={toOffset.toFixed(2)}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
        {showPassTick && (
          <line
            className="cmp-ring-tick"
            x1={cx + Math.cos(tickRad) * (RING_R - 6.5)}
            y1={cy + Math.sin(tickRad) * (RING_R - 6.5)}
            x2={cx + Math.cos(tickRad) * (RING_R + 6.5)}
            y2={cy + Math.sin(tickRad) * (RING_R + 6.5)}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="cmp-ring-core">
        <strong>{clamped}<span className="cmp-ring-pct">%</span></strong>
        <small className="cmp-ring-band">{label}</small>
      </div>
    </div>
  );
}

function SectionModal({ title, onClose, children }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="overlay cmp-sec-overlay" onClick={onClose}>
      <section className="modal cmp-sec-modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head cmp-sec-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" aria-label={translateUI('deadline.close')} onClick={onClose}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
        <div className="modal-body cmp-sec-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}

// One stored compliance run, shown the same way everywhere: the Review & Check step of the builder, the admin overview and Review &
// Approval. The ring, the six areas, what blocks a submit, the recommendations (each marked Rule or AI, each linked to its step), and
// the findings behind the score. It only displays; fetching and re-checking belong to the screen that uses it.
//   onOpenStep(stepKey)  when given, a step name becomes a button that jumps there (the builder); otherwise it is plain text.
//   checking             true while a check is running: the ring shows progress instead of a score that is about to change.
//   modalSections        when true (AI Checker page), moves blockers, findings, and Needs your decision into icon buttons on the right of .cmp-top that open in a modal.
export default function ComplianceCard({ run, checking = false, onOpenStep, showFindings = true, onApplyDraft, modalSections = false }) {
  const [activeModal, setActiveModal] = useState(null); // null | 'block' | 'find' | 'unresolved'
  useEffect(() => { setActiveModal(null); }, [run?.id, run?.syllabusId]);
  const state = runState(run);
  const t = state === 'scored' ? tone(run.overall, run.passThreshold) : 'none';
  const how = basis(run);
  const provisional = provisionalOf(run); // an unfinished check still shows its score so far, labelled as provisional
  const aiGate = useAiGate();
  // A saved report of a syllabus under record review is read as history: nothing in it can be applied to the draft.
  const applyDraft = run?.recordReview ? undefined : onApplyDraft;
  const blockers = blockersOf(run, aiGate);
  const recs = (run && run.recommendations) || [];
  const findingsCount = showFindings && run && run.findings ? run.findings.length : 0;
  const needsDecision = (run?.hybrid?.unresolved || []).filter((u) => u.reason !== 'waits_for_upstream');
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
  let fromScoreValue = 0;
  if (currentScore !== null) {
    const prev = lastScores.get(memKey);
    const hasChanged = typeof prev === 'number' && prev !== currentScore;
    const isHigher = hasChanged ? currentScore > prev : t === 'good';
    const fromScore = hasChanged ? prev : (isHigher ? 0 : 100);
    fromScoreValue = fromScore;
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
  const jumpStep = (key) => {
    setActiveModal(null);
    if (onOpenStep) onOpenStep(key);
  };
  const stepRef = (key) => {
    if (!STEP_INFO[key]) return null;
    return onOpenStep
      ? <button type="button" className="cmp-step" onClick={() => jumpStep(key)}>{tr(stepLabel(key))}</button>
      : <span className="cmp-step plain">{tr(stepLabel(key))}</span>;
  };
  const findingsTitle = findingsCount > 0 ? tr(findingsCount + (findingsCount === 1 ? ' finding' : ' findings')) + translateUI("ui.behind_the_score_db725f") : '';
  const unresolvedTitle = needsDecision.length > 0 ? translateUI('hybrid.unresolvedTitle', { count: needsDecision.length }) : '';
  const blockersTitle = translateUI("ui.these_stop_the_syllabus_from_being_submitted_cff5cf");
  const hasModalIcons = modalSections && (blockers.length > 0 || findingsCount > 0 || needsDecision.length > 0);
  const modalTitle = activeModal === 'block' ? blockersTitle : activeModal === 'find' ? findingsTitle : activeModal === 'unresolved' ? unresolvedTitle : '';

  return (
    <div className={'cmp' + (checking ? ' is-checking' : '')} aria-busy={checking || undefined}>
      <RuleCoveragePanel coverage={run?.hybrid?.ruleCoverage} part="notices" />
      <div className="cmp-top">
        {checking
          ? <div className="big-ring cmp-ring checking" style={ringStyle} role="img" aria-label={translateUI("ui.checking_your_syllabus_1278c5")}>
              <div>
                <GeminiEmblem size={98} />
              </div>
            </div>
          : state === 'scored'
          ? <ScoreRing score={run.overall} fromScore={fromScoreValue} label={tr(run.band)} toneClass={t} passThreshold={run.passThreshold} flowClass={flowClass} ariaLabel={translateUI("ui.compliance_score_7a084d") + run.overall + translateUI("ui.percent_c72154") + tr(run.band)} />
          : provisional
          ? <ScoreRing score={provisional.score} fromScore={fromScoreValue} label={translateUI('hybrid.provisional')} toneClass="provisional" passThreshold={run?.passThreshold} flowClass={flowClass} ariaLabel={translateUI('hybrid.provisionalAria', { score: provisional.score })} />
          : <div className="cmp-ring none" role="img" aria-label={translateUI("ui.no_score_yet_3662ab")}><div><strong>—</strong><small>{state === 'incomplete' ? translateUI('hybrid.incomplete') : state === 'insufficient' ? translateUI("ui.not_enough_content_1c0e67") : translateUI("ui.not_checked_22705e")}</small></div></div>}
        <div className="cmp-head">
          <p className="cmp-line">{checking
            ? translateUI("ui.checking_your_syllabus_1278c5")
            : provisional
            ? translateUI(provisional.rule ? 'hybrid.provisionalRule' : provisional.total ? 'hybrid.provisionalCoverage' : 'hybrid.provisionalPlain', { verified: provisional.verified, total: provisional.total })
            : run?.recordReview ? translateUI('hybrid.savedReportLine') : aiGate === 'advisory' && state === 'incomplete' && blockers.length === 0 ? translateUI('hybrid.advisoryIncomplete') : tr(headline(run))}</p>
          <GeminiThinkingLine active={checking} />
          {!checking && ((run?.hybrid && run.hybrid.alignment.status !== 'completed') || (run?.hybrid?.semanticCoverage && !run.hybrid.semanticCoverage.complete) || (run && run.stale) || (!modalSections && ((run && how.label) || (run && run.checkedBy === 'admin')))) && (
            <div className="cmp-chips">
              {run?.hybrid && run.hybrid.alignment.status !== 'completed' && <span className="hy-pill warn">{translateUI('hybrid.alignment', { status: translateUI(`hybrid.status.${run.hybrid.alignment.status}`) })}</span>}
              {run?.hybrid?.semanticCoverage && !run.hybrid.semanticCoverage.complete && <span className="hy-pill warn" title={translateUI('hybrid.vpaaCoverageNote.' + run.hybrid.semanticCoverage.reason)}>{translateUI('hybrid.vpaaCoverage', { done: run.hybrid.semanticCoverage.evaluated, total: run.hybrid.semanticCoverage.total })}</span>}
              {!modalSections && run && how.label && <span className={'chip basis ' + how.kind}>{tr(how.label)}</span>}
              {!modalSections && run && run.checkedBy === 'admin' && <span className="chip quiet">{translateUI("ui.your_check")}</span>}
              {run && run.stale && <span className="chip stale">{run.recordReview ? translateUI('hybrid.savedReportChip') : translateUI("ui.out_of_date_the_syllabus_changed_after_this_check_384297")}</span>}
            </div>
          )}
        </div>
        {hasModalIcons && (
          <div className="cmp-top-actions">
            {blockers.length > 0 && (
              <button type="button" className={'cmp-top-ico is-block' + (activeModal === 'block' ? ' is-open' : '')} title={blockersTitle} aria-label={blockersTitle + ' (' + blockers.length + ')'} aria-haspopup="dialog" aria-expanded={activeModal === 'block'} onClick={() => setActiveModal('block')}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></svg>
                <span className="cmp-top-badge" aria-hidden="true">{blockers.length}</span>
              </button>
            )}
            {findingsCount > 0 && (
              <button type="button" className={'cmp-top-ico is-find' + (activeModal === 'find' ? ' is-open' : '')} title={findingsTitle} aria-label={findingsTitle} aria-haspopup="dialog" aria-expanded={activeModal === 'find'} onClick={() => setActiveModal('find')}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></svg>
                <span className="cmp-top-badge" aria-hidden="true">{findingsCount}</span>
              </button>
            )}
            {needsDecision.length > 0 && (
              <button type="button" className={'cmp-top-ico is-unresolved' + (activeModal === 'unresolved' ? ' is-open' : '')} title={unresolvedTitle} aria-label={unresolvedTitle} aria-haspopup="dialog" aria-expanded={activeModal === 'unresolved'} onClick={() => setActiveModal('unresolved')} data-testid="needs-decision-trigger">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                <span className="cmp-top-badge" aria-hidden="true">{needsDecision.length}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {!modalSections && blockers.length > 0 && (
        <div className="cmp-block" role="alert">
          <b>{blockersTitle}</b>
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
      {run && recs.length === 0 && state === 'scored' && run.findings && run.findings.length === 0 && !run.hybrid?.suggestions?.length && !run.hybrid?.deductions?.length && !run.hybrid?.unresolved?.length && <p className="cmp-small">{translateUI("ui.nothing_to_improve_every_check_passed_60de97")}</p>}

      {!modalSections && findingsCount > 0 && (
        <details className="cmp-find">
          <summary>{findingsTitle}</summary>
          {groupFindings(run).map((g) => (
            <div key={g.key}>
              <h5>{tr(g.name)}</h5>
              <ul>{g.findings.map((f) => <li key={f.id} className={f.severity === 'blocking' ? 'blocking' : undefined}><span className="chip src rule">{f.severity === 'blocking' ? translateUI("ui.rule_blocks_submit_a7fc69") : translateUI("ui.rule_78e179")}</span> {tr(f.message)} {stepRef(f.step)}</li>)}</ul>
            </div>
          ))}
        </details>
      )}
      <HybridCheckPanel run={run} onApplyDraft={applyDraft} hideUnresolved={modalSections} />
      {/* The rule-by-rule coverage is a reference, not the result: it follows the results instead of sitting above the score. */}
      <RuleCoveragePanel coverage={run?.hybrid?.ruleCoverage} part="list" />

      {modalSections && activeModal && (
        <SectionModal title={modalTitle} onClose={() => setActiveModal(null)}>
          {activeModal === 'block' && (
            <div className="cmp-block" role="alert">
              <ul>{blockers.map((f) => <li key={f.id}>{tr(f.message)} {stepRef(f.step)}</li>)}</ul>
            </div>
          )}
          {activeModal === 'find' && (
            <details className="cmp-find" open>
              <summary>{findingsTitle}</summary>
              {groupFindings(run).map((g) => (
                <div key={g.key}>
                  <h5>{tr(g.name)}</h5>
                  <ul>{g.findings.map((f) => <li key={f.id} className={f.severity === 'blocking' ? 'blocking' : undefined}><span className="chip src rule">{f.severity === 'blocking' ? translateUI("ui.rule_blocks_submit_a7fc69") : translateUI("ui.rule_78e179")}</span> {tr(f.message)} {stepRef(f.step)}</li>)}</ul>
                </div>
              ))}
            </details>
          )}
          {activeModal === 'unresolved' && (
            <details className="hy-recs hy-unresolved" open data-testid="needs-decision">
              <summary><h4>{unresolvedTitle}</h4></summary>
              <div className="hy-box">
                <p className="hy-note">{translateUI('hybrid.unresolvedNote')}</p>
                <ul>{needsDecision.map((u, i) => <li key={u.path + ':' + i} className="hy-rec">
                  <div className="hy-rec-head"><span className="hy-pill">{suggestionSection(u.path, { tr, t: translateUI })}</span></div>
                  {u.excerpt && <p className="hy-quote">“{u.excerpt}”</p>}
                  <p className="hy-why">{translateUI(`hybrid.unresolved.${u.reason}`, { attempts: u.attempts, value: u.value })}</p>
                  {(u.reason === 'faculty_fix' || u.reason === 'no_verified_rewrite') && u.detail && <div className="hy-todo"><span>{translateUI('hybrid.unresolved.todo')}</span><p className="hy-detail">{u.detail}</p></div>}
                </li>)}</ul>
              </div>
            </details>
          )}
        </SectionModal>
      )}
    </div>
  );
}
