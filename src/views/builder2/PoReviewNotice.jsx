import { useState } from 'react';
import StableButton from '../../components/StableButton';
import { syllabi as syllabiApi } from '../../lib/api';
import { t, tr } from '../../i18n';

// Step 2: the subject's Program Outcomes changed and this syllabus still holds the statements its CLOs were mapped against. The author opens the comparison and adopts the update explicitly; nothing
// else adopts it. The statements come from the server, and the confirmation sends back the hash of what was shown, so an update made in between is refused and shown again. `api` is injectable for tests.
export default function PoReviewNotice({ syllabusId, flush = async () => true, onAdopted = () => {}, api = syllabiApi, initial = null }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);   // reviewing and adopting are separate: the comparison changes nothing, and adopting needs this tick
  const open = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await flush(); setView(await api.poReview(syllabusId)); } catch (e) { setError(tr(e.message)); } finally { setBusy(false); }
  };
  const adopt = async () => {
    if (busy || !view) return;
    setBusy(true); setError('');
    try { await flush(); await api.adoptPoReview(syllabusId, view.reviewedSha256); onAdopted(); }
    catch (e) {
      if (e.data && e.data.code === 'po_review_changed') { setError(t('poReview.changed')); setConfirmed(false); setView(await api.poReview(syllabusId).catch(() => null)); } else setError(tr(e.message));
    } finally { setBusy(false); }
  };
  const missing = view && view.missingMappings && view.missingMappings.length ? view.missingMappings.join(', ') : '';
  const refs = view && view.references, versionOf = (r) => (r && r.version) || t('poReview.none');
  const version = refs && (refs.current || refs.updated) ? t('poReview.versionLine', { from: versionOf(refs.current), to: versionOf(refs.updated) }) : '';
  return <div className="info-banner warning po-review" role="status">
    <p>{t('poReview.notice')}</p>
    {!view && <div className="po-review-actions"><StableButton type="button" className="btn primary" disabled={busy} onClick={open}>{busy ? t('poReview.loading') : t('poReview.open')}</StableButton></div>}
    {view && <>
      <h5>{t('poReview.heading')}</h5>
      {version && <p className="hint">{version}</p>}
      <table className="po-review-rows"><thead><tr><th>{t('poReview.po')}</th><th>{t('poReview.current')}</th><th>{t('poReview.updated')}</th><th>{t('poReview.mappings')}</th></tr></thead>
        <tbody>{(view.changes || []).map((c) => <tr key={c.no}><td>{t('poReview.po') + ' ' + c.no}</td><td>{c.before ?? t('poReview.none')}</td><td>{c.after ?? t('poReview.none')}</td><td>{(c.clos || []).length ? c.clos.join(', ') : t('poReview.noMappings')}</td></tr>)}</tbody></table>
      <p>{t('poReview.keepsMappings')}</p>
      {missing && <p className="form-error" role="alert">{t('poReview.missing', { pos: missing })}</p>}
      <label className="check"><input type="checkbox" checked={confirmed} disabled={busy || !!missing} onChange={(e) => setConfirmed(e.target.checked)} /> {t('poReview.confirm')}</label>
      <div className="po-review-actions">
        <StableButton type="button" className="btn primary" disabled={busy || !!missing || !view.pending || !confirmed} onClick={adopt}>{t('poReview.adopt')}</StableButton>
        <StableButton type="button" className="btn outline" disabled={busy} onClick={() => { setView(null); setError(''); setConfirmed(false); }}>{t('poReview.cancel')}</StableButton>
      </div>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
