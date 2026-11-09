import { useState } from 'react';
import { t } from '../i18n';
import {
  hasImprovementPlan,
  improvementPlanOf,
  applyImprovementPlan,
  statusBadgeClass,
  VALIDATION_STATUS,
} from '../lib/coordinatedPlan';

export default function CoordinatedPlanPanel({ run, onPlanApplied }) {
  const plan = improvementPlanOf(run);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedChanges, setSelectedChanges] = useState(() => {
    if (!plan?.changes) return new Set();
    return new Set(plan.changes.map((c) => c.changeId));
  });
  const [showDiff, setShowDiff] = useState(true);

  if (!plan) return null;

  const rootCauses = plan.rootCauses || [];
  const changes = plan.changes || [];
  const preservations = plan.preservations || [];
  const unresolved = plan.unresolvedIssues || [];
  const validation = plan.validation || {};
  const status = plan.status || VALIDATION_STATUS.NOT_CHECKED;

  const toggleChange = (id) => {
    setSelectedChanges((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedChanges(new Set(changes.map((c) => c.changeId)));
  };

  const deselectAll = () => {
    setSelectedChanges(new Set());
  };

  const handleApply = async () => {
    if (busy || !run?.id) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const approvedChangeIds = Array.from(selectedChanges);
      const res = await applyImprovementPlan(run.id, {
        planId: plan.planId,
        sourceHash: plan.sourceHash,
        approvedChangeIds,
      });
      setSuccess(
        t('coordinatedPlan.appliedSuccess', { count: res.appliedCount || approvedChangeIds.length })
      );
      if (typeof onPlanApplied === 'function') {
        onPlanApplied(res);
      }
    } catch (err) {
      if (err.data?.code === 'stale_syllabus_version') {
        setError(t('coordinatedPlan.staleVersion'));
      } else {
        setError(
          t('coordinatedPlan.applyError', {
            error: err.message || 'Server error',
          })
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="hy-box"
      style={{
        border: '2px solid #2563eb',
        borderRadius: '8px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        backgroundColor: '#f8fafc',
      }}
      aria-label={t('coordinatedPlan.title')}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📋</span> {t('coordinatedPlan.title')}
            <span className={statusBadgeClass(status)} role="status">
              {t(`coordinatedPlan.status.${status}`) || status}
            </span>
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', color: '#475569', fontSize: '0.9rem' }}>
            {t('coordinatedPlan.subtitle')}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <small style={{ color: '#64748b' }}>
            {t('coordinatedPlan.planId')}: <code>{plan.planId}</code>
          </small>
        </div>
      </header>

      {validation.summaryText && (
        <div
          role="status"
          style={{
            margin: '1rem 0',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            backgroundColor: status === VALIDATION_STATUS.VERIFIED ? '#ecfdf5' : status === VALIDATION_STATUS.NEEDS_FACULTY_REVIEW ? '#fffbeb' : '#fef2f2',
            border: `1px solid ${status === VALIDATION_STATUS.VERIFIED ? '#a7f3d0' : status === VALIDATION_STATUS.NEEDS_FACULTY_REVIEW ? '#fde68a' : '#fecaca'}`,
            color: status === VALIDATION_STATUS.VERIFIED ? '#065f46' : status === VALIDATION_STATUS.NEEDS_FACULTY_REVIEW ? '#92400e' : '#991b1b',
            fontSize: '0.92rem',
          }}
        >
          <strong>{t('coordinatedPlan.validationStatus')}: </strong> {validation.summaryText}
        </div>
      )}

      {error && (
        <div role="alert" className="info-banner warning" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="info-banner success" style={{ marginBottom: '1rem', backgroundColor: '#dcfce7', color: '#166534', padding: '0.75rem', borderRadius: '6px' }}>
          {success}
        </div>
      )}

      {/* Root Causes Section */}
      {rootCauses.length > 0 && (
        <details open style={{ marginBottom: '1rem', backgroundColor: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <summary style={{ fontWeight: '600', cursor: 'pointer', color: '#1e293b' }}>
            🔍 {t('coordinatedPlan.rootCauses')} ({rootCauses.length})
          </summary>
          <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: '0.5rem' }}>
            {rootCauses.map((rc) => (
              <li
                key={rc.id}
                style={{
                  borderLeft: '3px solid #3b82f6',
                  paddingLeft: '0.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                  {rc.title} {rc.week ? t('coordinatedPlan.weekRef', { week: rc.week }) : ''}
                </div>
                <div style={{ color: '#475569', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                  {rc.explanation}
                </div>
                {rc.affectedFields && (
                  <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#64748b' }}>
                    <strong>{t('coordinatedPlan.affectedFields')} </strong>
                    {rc.affectedFields.map((f) => (
                      <code key={f} style={{ marginRight: '0.4rem', backgroundColor: '#f1f5f9', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                        {f}
                      </code>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Preservations Section */}
      {preservations.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
          <strong style={{ color: '#15803d', fontSize: '0.9rem' }}>🛡️ {t('coordinatedPlan.preservations')}</strong>
          <ul style={{ margin: '0.3rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#166534' }}>
            {preservations.map((p, idx) => (
              <li key={idx}>
                <code>{p.path}</code>: {p.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unresolved Issues Section */}
      {unresolved.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}>
          <strong style={{ color: '#b91c1c', fontSize: '0.9rem' }}>⚠️ {t('coordinatedPlan.unresolved')}</strong>
          <ul style={{ margin: '0.3rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#991b1b' }}>
            {unresolved.map((u, idx) => (
              <li key={idx}>
                <strong>{u.code}:</strong> {u.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Proposed Changes Diff View */}
      {changes.length > 0 ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, color: '#1e293b' }}>
              ✍️ {t('coordinatedPlan.proposedChanges')} ({changes.length})
            </h4>
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowDiff(!showDiff)}>
                {showDiff ? t('coordinatedPlan.compactView') : t('coordinatedPlan.diffView')}
              </button>
              <button type="button" className="btn-secondary" onClick={selectAll}>
                {t('coordinatedPlan.selectAll')}
              </button>
              <button type="button" className="btn-secondary" onClick={deselectAll}>
                {t('coordinatedPlan.deselectAll')}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {changes.map((c) => {
              const isSelected = selectedChanges.has(c.changeId);
              return (
                <div
                  key={c.changeId}
                  style={{
                    backgroundColor: '#ffffff',
                    border: `1px solid ${isSelected ? '#93c5fd' : '#e2e8f0'}`,
                    borderRadius: '6px',
                    padding: '0.75rem',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleChange(c.changeId)}
                        disabled={busy}
                      />
                      <span>{c.field ? c.field.toUpperCase() : t('coordinatedPlan.changeDefault')}</span>
                      <code style={{ fontSize: '0.82rem', color: '#64748b' }}>{c.path}</code>
                    </label>
                    {c.semanticUnverified && (
                      <span className="hy-pill warn" style={{ fontSize: '0.75rem' }}>
                        {t('coordinatedPlan.needsFacultyReviewBadge')}
                      </span>
                    )}
                  </div>

                  <p style={{ margin: '0.2rem 0 0.5rem 1.6rem', color: '#475569', fontSize: '0.88rem' }}>
                    {c.explanation}
                  </p>

                  {showDiff && (
                    <div
                      style={{
                        marginLeft: '1.6rem',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        backgroundColor: '#f8fafc',
                        padding: '0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '0.5rem' }}>
                        <div style={{ color: '#ef4444', fontWeight: '600', marginBottom: '0.2rem' }}>
                          − {t('coordinatedPlan.original')}
                        </div>
                        <div style={{ color: '#64748b', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                          {typeof c.originalValue === 'object'
                            ? JSON.stringify(c.originalValue, null, 2)
                            : String(c.originalValue || '—')}
                        </div>
                      </div>
                      <div style={{ paddingLeft: '0.5rem' }}>
                        <div style={{ color: '#10b981', fontWeight: '600', marginBottom: '0.2rem' }}>
                          + {t('coordinatedPlan.proposed')}
                        </div>
                        <div style={{ color: '#0f172a', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                          {typeof c.proposedValue === 'object'
                            ? JSON.stringify(c.proposedValue, null, 2)
                            : String(c.proposedValue || '—')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <footer
            style={{
              marginTop: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              borderTop: '1px solid #e2e8f0',
              paddingTop: '1rem',
            }}
          >
            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {t('coordinatedPlan.approvedCount', { selected: selectedChanges.size, total: changes.length })}
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleApply}
              disabled={busy || selectedChanges.size === 0}
              style={{
                backgroundColor: selectedChanges.size === 0 ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                padding: '0.6rem 1.25rem',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: selectedChanges.size === 0 || busy ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {busy ? (
                <>
                  <span className="spinner" /> {t('coordinatedPlan.applying')}
                </>
              ) : (
                <>
                  <span>✓</span> {t('coordinatedPlan.applyAll')}
                </>
              )}
            </button>
          </footer>
        </div>
      ) : (
        <div style={{ color: '#059669', padding: '1rem', textAlign: 'center' }}>
          ✓ {t('coordinatedPlan.noChanges')}
        </div>
      )}
    </section>
  );
}
