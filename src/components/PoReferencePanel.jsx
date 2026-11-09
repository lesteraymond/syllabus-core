import { useEffect, useState } from 'react';
import StableButton from './StableButton';
import { poReference as defaultApi } from '../lib/poReferenceApi';
import { changeLine, diffLines, shortHash } from '../lib/poReferenceView';
import { t, tr } from '../i18n';

// The Administrator's view of a program's reference versions, under the outcomes they edit in the same dialog: the version in force (hash, years it applies to, who saved it), the version history
// with a comparison, the change log, and the use of a version from another academic year. Saving the outcomes makes the version, so there is nothing to approve or publish here, and a version has
// no edit controls at all. All rules are enforced by the server (routes/programs.js, routes/programPoReference.js); this panel only presents them.
// `hasOutcomes`: the program has saved Program Outcomes (a program from before versioning can record them as its first version). `api` is injectable for tests.
const dateOf = (v) => (v ? String(v).slice(0, 10) : '—');

export default function PoReferencePanel({ program, hasOutcomes = false, readOnlyYear = false, inheritedFrom = null, notify = () => {}, onChanged = () => {}, api = defaultApi, initial = null }) {
  const [view, setView] = useState(initial);       // the server overview: { publicationAvailable, active, history, changes, liveStatus }
  const [diff, setDiff] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [reuseNote, setReuseNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const locked = readOnlyYear || !!inheritedFrom;

  const candidatesOf = async () => (locked ? [] : (await api.candidates(program.id).catch(() => ({ candidates: [] }))).candidates);
  const load = async () => {
    setError('');
    try { setView(await api.overview(program.id)); setDiff(null); setCandidates(await candidatesOf()); } catch (e) { setError(tr(e.message)); }
  };
  useEffect(() => { if (!initial) load(); }, [program.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (name, fn) => { if (busy) return; setBusy(name); setError(''); try { await fn(); } catch (e) { setError(tr(e.message)); } finally { setBusy(''); } };
  const shell = (body) => <section className="po-reference" aria-label={t('poRef.title')}><h4>{t('poRef.title')}</h4>{body}</section>;
  if (inheritedFrom) return shell(<p className="info-banner" role="status">{t('poRef.inherited', { code: program.code, source: inheritedFrom.code })}</p>);
  if (!view) return shell(error ? <p className="form-error" role="alert">{error}</p> : <p role="status">{t('poRef.loading')}</p>);
  if (!view.publicationAvailable) return shell(<p className="info-banner" role="status">{t('poRef.unavailable')}</p>);

  const active = view.active;
  const history = view.history || [], changes = view.changes || [];
  const changed = async () => { await onChanged(); await load(); };

  return shell(<>
    <p className="hint">{t('poRef.intro')}</p>
    {readOnlyYear && <p className="info-banner" role="status">{t('poRef.readonlyYear')}</p>}

    <div className="po-reference-active">
      <h5>{t('poRef.status.title')}</h5>
      {!active && <p className="info-banner" role="status">{t('poRef.status.none')}</p>}
      {!active && !locked && hasOutcomes && <StableButton type="button" className="btn outline" disabled={!!busy} onClick={() => run('record', async () => { const done = await api.record(program.id); await changed(); notify(t('poRef.recorded', { version: done.version })); })}>{t('poRef.record')}</StableButton>}
      {active && <>
        <p><strong>{t('poRef.active.line', { version: active.version, count: active.outcomeCount, date: dateOf(active.publishedAt) })}</strong></p>
        <p>{active.association === 'adopted' ? t('poRef.association.adopted', { year: active.appliesTo.find((x) => x.association === 'owner')?.academicYear || '—', note: active.associationNote || '' }) : t('poRef.association.owner')}</p>
        {active.appliesTo && active.appliesTo.length > 0 && <p>{t('poRef.appliesTo', { years: active.appliesTo.map((x) => x.academicYear || '—').join(', ') })}</p>}
        <p className="hint">{t('poRef.hash', { hash: shortHash(active.sha256) })}</p>
        <p className="hint">{t('poRef.locked')}</p>
      </>}
    </div>

    <div className="po-reference-history">
      <h5>{t('poRef.history.title')}</h5>
      {!history.length && <p className="hint">{t('poRef.history.empty')}</p>}
      <ul>{history.map((h) => <li key={h.id}>{t('poRef.history.line', { version: h.version, status: t('poRef.history.' + (h.status === 'superseded' ? 'superseded' : 'published')), date: dateOf(h.publishedAt), count: h.outcomeCount })}
        {' '}<span className="hint">{t('poRef.hash', { hash: shortHash(h.sha256) })}</span>
        {active && h.id !== active.id && <StableButton type="button" className="btn outline" disabled={!!busy} onClick={() => run('compare', async () => setDiff(await api.compare(program.id, h.id, 'active')))}>{t('poRef.history.compare')}</StableButton>}</li>)}</ul>
      {diff && (diff.identical ? <p role="status">{t('poRef.review.none')}</p> : <ul role="status">{diffLines(diff).map((l) => <li key={l.kind + l.no}>{t('poRef.review.' + l.kind, { no: l.no, fields: l.fields.map((f) => t('poRef.field.' + f)).join(', ') })}</li>)}</ul>)}
    </div>

    <div className="po-reference-changes">
      <h5>{t('poRef.changes.title')}</h5>
      {!changes.length && <p className="hint">{t('poRef.changes.empty')}</p>}
      <ul>{changes.map((c) => { const line = changeLine(c); return <li key={c.id}>{t('poRef.changes.line', { date: line.date, by: line.by || t('poRef.changes.unknown'), what: t(line.key), from: line.from || t('poRef.changes.none'), to: line.to || t('poRef.changes.none') })}</li>; })}</ul>
    </div>

    {!locked && <div className="po-reference-reuse">
      <h5>{t('poRef.reuse.title')}</h5>
      {!candidates.length && <p className="hint">{t('poRef.reuse.none')}</p>}
      {candidates.length > 0 && <label className="field"><span>{t('poRef.reuse.note')}</span><textarea value={reuseNote} rows={2} maxLength={500} onChange={(e) => setReuseNote(e.target.value)} /></label>}
      <ul>{candidates.map((c) => <li key={c.id}>{t('poRef.history.line', { version: c.version, status: c.ownerYear || '—', date: dateOf(c.publishedAt), count: c.outcomeCount })}
        {' '}<span className="hint">{c.identicalToLiveRows ? t('poRef.reuse.identical') : t('poRef.reuse.different')}</span>
        <StableButton type="button" className="btn outline" disabled={!!busy || !c.identicalToLiveRows || (active && active.id === c.id)} onClick={() => run('reuse', async () => { const done = await api.adopt(program.id, c.id, reuseNote); setReuseNote(''); await changed(); notify(t('poRef.reuse.done', { version: done.version })); })}>{t('poRef.reuse.button')}</StableButton></li>)}</ul>
    </div>}
    {error && <p className="form-error" role="alert">{error}{' '}<StableButton type="button" className="btn outline" disabled={!!busy} onClick={load}>{t('ui.reload_cce715')}</StableButton></p>}
  </>);
}
