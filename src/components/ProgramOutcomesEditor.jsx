import { useEffect, useRef, useState } from 'react';
import CatalogModalPortal from './CatalogModalPortal';
import StableButton from './StableButton';
import OutcomesFields from './OutcomesFields';
import PoReferencePanel from './PoReferencePanel';
import { Icon } from './ui';
import { useActionExit } from '../lib/catalogMotion';
import { useModalLayer } from './useModalLayer';
import { outcomes } from '../lib/api';
import { t, tr } from '../i18n';
import { checkEgas, checkPos, egaPayload, egaRows, poPayload, poRows, sameRows } from '../lib/outcomesSetup';

// The administrator sets up a program's EGAs and Program Outcomes here: a new program (a new academic year's catalog, or a program added with a subject) may start with none.
// One Save stores both lists together (PUT /programs/:id/setup, one transaction), with the versions the screen loaded, so a screen that is out of date is refused by the
// server (and an EGA or PO a CLO still uses cannot be removed). A PO may link to any EGA in the list being edited, so an EGA can be added and linked in one save. Read-only, with the reason, for a past academic year, and for a specialization (it uses its source program's). Saving the POs makes the next reference version, which PoReferencePanel below shows.
// A subject keeps its own copy of these, so "Apply to subjects" is the explicit step that copies the saved program setup (and the school vision and mission) into the
// program's existing subjects; subjects created later start with it automatically.
export default function ProgramOutcomesEditor({ program, year, readOnlyYear = false, onClose, onSaved, notify }) {
  const dialog = useRef(null);
  const motion = useActionExit(dialog);
  const [data, setData] = useState(null);          // what the server has: { egas, pos, versions, subjects, inheritedFrom?, poReference? }
  const [egas, setEgas] = useState([]);            // editor rows
  const [pos, setPos] = useState([]);
  const [busy, setBusy] = useState('');            // '' | 'save' | 'sync'
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState([]);      // subjects the last "Apply to subjects" could not update, with the reason
  const [offer, setOffer] = useState(false);       // just saved, not yet applied to the subjects: ask now
  const offerRef = useRef(null);
  useEffect(() => { if (offer && offerRef.current && offerRef.current.scrollIntoView) offerRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [offer]);
  const close = () => { if (!busy) motion.dismiss(onClose); };
  useModalLayer(dialog, close);

  const apply = (fresh) => { setData(fresh); setEgas(egaRows(fresh.egas)); setPos(poRows(fresh.pos)); };
  const load = async () => { setError(''); try { apply(await outcomes.program(program.id)); } catch (e) { setError(tr(e.message)); } };
  useEffect(() => { load(); }, [program.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const inherited = data && data.inheritedFrom ? data.inheritedFrom : null;
  const referenced = !!(data && data.poReference && !data.referencesVersioned);   // only a database that cannot keep a new version locks a versioned program
  const lockedAll = readOnlyYear || !!inherited;
  const savedEgas = data ? data.egas : [];
  const egaChanged = data ? !sameRows(egas, egaRows(data.egas)) : false;
  const poChanged = data ? !sameRows(pos, poRows(data.pos)) : false;
  const changed = egaChanged || poChanged;
  // the EGA numbers in the list being edited: a PO may link to any of them (both lists are saved together)
  const typedEgaNos = [...new Set(egas.map((r) => Number(r.no)).filter((n) => Number.isInteger(n) && n > 0))];
  const problem = (p) => (p ? t(p.key, p.params) : '');
  const saveProblem = changed ? (problem(checkEgas(egas)) || problem(checkPos(pos, typedEgaNos.map((no) => ({ no }))))) : '';
  const editEgas = !lockedAll && !!data, editPos = !lockedAll && !referenced && !!data;
  const canApply = !lockedAll && !!data && savedEgas.length > 0 && !egaChanged && !poChanged && (data.subjects || []).length > 0;

  const save = async () => {
    if (busy) return;
    setBusy('save'); setError(''); setSkipped([]);
    try {
      const fresh = await outcomes.saveProgramSetup(program.id, egaPayload(egas), poPayload(pos), data.versions);
      apply(fresh);
      if ((fresh.subjects || []).length > 0) setOffer(true); // a subject keeps its own copy: offer to apply the save now, so faculty are not left on the old one
      notify(t('outcomes.saved'));
      if (onSaved) await onSaved();
    } catch (e) { setError(tr(e.message)); } finally { setBusy(''); }
  };
  const sync = async () => {
    if (busy) return;
    setBusy('sync'); setError(''); setSkipped([]);
    try {
      const done = await outcomes.syncSubjects(program.id);
      setSkipped(done.skipped || []);
      setOffer(false);
      notify(t('outcomes.synced', { updated: done.updated, unchanged: done.unchanged }));
    } catch (e) { setError(tr(e.message)); } finally { setBusy(''); }
  };

  return <CatalogModalPortal><div className="overlay overlay-confirm catalog-overlay bld2 catalog-page" onClick={close}>
    <section className="modal confirm-modal program-dialog outcomes-dialog catalog-surface" role="dialog" aria-modal="true" aria-labelledby="outcomes-dialog-title" tabIndex={-1} ref={dialog} onClick={(event) => event.stopPropagation()} aria-busy={!!busy || !data} inert={motion.closing || undefined}>
      <header className="outcomes-head">
        <div className="outcomes-head-text">
          <h3 id="outcomes-dialog-title">{t('outcomes.dialogTitle', { code: program.code })}</h3>
          <p className="outcomes-subtitle">{t('outcomes.dialogNote', { name: program.name, year })}</p>
        </div>
        <button type="button" className="icon-btn outcomes-close-x" disabled={!!busy} onClick={close} aria-label={t('outcomes.close')} title={t('outcomes.close')}><Icon name="x" size={16} /></button>
      </header>
      <div className="outcomes-body">
        {readOnlyYear && <p className="info-banner" role="status">{t('outcomes.readonly.year', { year })}</p>}
        {inherited && <p className="info-banner" role="status">{t('outcomes.readonly.inherited', { code: program.code, source: inherited.code })}</p>}
        {referenced && !lockedAll && <p className="info-banner" role="status">{t('outcomes.readonly.reference')}</p>}
        {!data && !error && <p className="outcomes-loading" role="status">{t('outcomes.loading')}</p>}
        {data && <OutcomesFields egas={egas} pos={pos} onEgas={setEgas} onPos={setPos} mapTo={typedEgaNos} editEgas={editEgas} editPos={editPos} busy={!!busy}
          poHint={editPos && !typedEgaNos.length ? t('outcomes.addEgasFirst') : ''}
          poFooter={<>{saveProblem && <p className="form-error" role="alert">{saveProblem}</p>}
            {editEgas && <div className="outcomes-actions outcomes-save"><StableButton type="button" className="btn primary" disabled={!!busy || !changed || !!saveProblem} onClick={save}>{busy === 'save' ? t('ui.saving_56a228') : t('outcomes.saveAll')}</StableButton></div>}</>} />}
        {/* the reference versions these saves make: the version in force, history, comparison, change log and reuse across academic years (shows "not set up" until the version tables are migrated) */}
        {data && <PoReferencePanel key={String(data.versions && data.versions.pos)} program={program} hasOutcomes={data.pos.length > 0} readOnlyYear={readOnlyYear} inheritedFrom={data.inheritedFrom || null} notify={notify} onChanged={load} />}
        {/* the one "Apply to subjects" button. Right after a save it is highlighted and scrolled into view with a reminder: a subject keeps its own copy until it is applied */}
        {data && !lockedAll && (data.subjects || []).length > 0 && <div className={'outcomes-sync' + (offer ? ' is-offer' : '')} ref={offerRef} role={offer ? 'status' : undefined}>
          {offer && <p className="outcomes-offer-text">{t('outcomes.applyOffer', { count: data.subjects.length })}</p>}
          {offer && !canApply && <p className="hint">{t('outcomes.applyAfterSaving')}</p>}
          <p className="hint">{t('outcomes.syncNote', { count: data.subjects.length })}</p>
          <div className="outcomes-actions">
            <StableButton type="button" className={'btn ' + (offer ? 'primary' : 'outline')} disabled={!!busy || !canApply} onClick={sync}>{busy === 'sync' ? t('ui.saving_56a228') : t('outcomes.sync', { count: data.subjects.length })}</StableButton>
            {offer && <StableButton type="button" className="btn outline" disabled={!!busy} onClick={() => setOffer(false)}>{t('outcomes.applyLater')}</StableButton>}
          </div>
          {skipped.length > 0 && <ul className="outcomes-skipped" role="status">{skipped.map((s) => <li key={s.id}>{t('outcomes.skipped', { code: s.code, reason: tr(s.reason) })}</li>)}</ul>}
        </div>}
        {error && <p className="form-error outcomes-error" role="alert">{error}{' '}<StableButton type="button" className="btn outline" disabled={!!busy} onClick={load}>{t('ui.reload_cce715')}</StableButton></p>}
      </div>
      <footer className="outcomes-foot confirm-actions">
        <StableButton type="button" className="btn outline" disabled={!!busy} onClick={close}>{t('outcomes.close')}</StableButton>
      </footer>
    </section>
  </div></CatalogModalPortal>;
}
