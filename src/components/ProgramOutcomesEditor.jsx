import { useEffect, useRef, useState } from 'react';
import CatalogModalPortal from './CatalogModalPortal';
import StableButton from './StableButton';
import OutcomesFields from './OutcomesFields';
import PoReferencePanel from './PoReferencePanel';
import { useActionExit } from '../lib/catalogMotion';
import { useModalLayer } from './useModalLayer';
import { outcomes } from '../lib/api';
import { t, tr } from '../i18n';
import { checkEgas, checkPos, egaPayload, egaRows, poPayload, poRows, sameRows } from '../lib/outcomesSetup';

// The administrator sets up a program's EGAs and Program Outcomes here: a new program (a new academic year's catalog, or a program added with a subject) may start with none.
// The two lists are saved separately, each with the version it loaded, so a screen that is out of date is refused by the server (and an EGA or PO a CLO still uses cannot be
// removed). Read-only, with the reason, for a past academic year, and for a specialization (it uses its source program's). Saving the POs makes the next reference version, which PoReferencePanel below shows.
// A subject keeps its own copy of these, so "Apply to subjects" is the explicit step that copies the saved program setup (and the school vision and mission) into the
// program's existing subjects; subjects created later start with it automatically.
export default function ProgramOutcomesEditor({ program, year, readOnlyYear = false, onClose, onSaved, notify }) {
  const dialog = useRef(null);
  const motion = useActionExit(dialog);
  const [data, setData] = useState(null);          // what the server has: { egas, pos, versions, subjects, inheritedFrom?, poReference? }
  const [egas, setEgas] = useState([]);            // editor rows
  const [pos, setPos] = useState([]);
  const [busy, setBusy] = useState('');            // '' | 'egas' | 'pos' | 'sync'
  const [error, setError] = useState('');
  const [skipped, setSkipped] = useState([]);      // subjects the last "Apply to subjects" could not update, with the reason
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
  const problem = (p) => (p ? t(p.key, p.params) : '');
  const egaProblem = egaChanged ? problem(checkEgas(egas)) : '';
  const poProblem = poChanged ? problem(checkPos(pos, savedEgas)) : '';
  const editEgas = !lockedAll && !!data, editPos = !lockedAll && !referenced && !!data;
  const canApply = !lockedAll && !!data && savedEgas.length > 0 && !egaChanged && !poChanged && (data.subjects || []).length > 0;

  const save = async (which) => {
    if (busy) return;
    setBusy(which); setError(''); setSkipped([]);
    try {
      const fresh = which === 'egas'
        ? await outcomes.saveProgramEgas(program.id, egaPayload(egas), data.versions.egas)
        : await outcomes.saveProgram(program.id, poPayload(pos), data.versions.pos);
      apply(fresh);
      notify(t(which === 'egas' ? 'outcomes.egasSaved' : 'outcomes.posSaved'));
      if (onSaved) await onSaved();
    } catch (e) { setError(tr(e.message)); } finally { setBusy(''); }
  };
  const sync = async () => {
    if (busy) return;
    setBusy('sync'); setError(''); setSkipped([]);
    try {
      const done = await outcomes.syncSubjects(program.id);
      setSkipped(done.skipped || []);
      notify(t('outcomes.synced', { updated: done.updated, unchanged: done.unchanged }));
    } catch (e) { setError(tr(e.message)); } finally { setBusy(''); }
  };

  return <CatalogModalPortal><div className="overlay overlay-confirm catalog-overlay bld2 catalog-page" onClick={close}>
    <section className="modal confirm-modal program-dialog outcomes-dialog catalog-surface" role="dialog" aria-modal="true" aria-labelledby="outcomes-dialog-title" tabIndex={-1} ref={dialog} onClick={(event) => event.stopPropagation()} aria-busy={!!busy || !data} inert={motion.closing || undefined}>
      <h3 id="outcomes-dialog-title">{t('outcomes.dialogTitle', { code: program.code })}</h3>
      <p>{t('outcomes.dialogNote', { name: program.name, year })}</p>
      {readOnlyYear && <p className="info-banner" role="status">{t('outcomes.readonly.year', { year })}</p>}
      {inherited && <p className="info-banner" role="status">{t('outcomes.readonly.inherited', { code: program.code, source: inherited.code })}</p>}
      {referenced && !lockedAll && <p className="info-banner" role="status">{t('outcomes.readonly.reference')}</p>}
      {!data && !error && <p role="status">{t('outcomes.loading')}</p>}
      {data && <OutcomesFields egas={egas} pos={pos} onEgas={setEgas} onPos={setPos} mapTo={savedEgas.map((e) => e.no)} editEgas={editEgas} editPos={editPos} busy={!!busy}
        poHint={editPos && !savedEgas.length ? t('outcomes.saveEgasFirst') : ''}
        egaFooter={<>{egaProblem && <p className="form-error" role="alert">{egaProblem}</p>}
          {editEgas && <div className="outcomes-actions"><StableButton type="button" className="btn primary" disabled={!!busy || !egaChanged || !!egaProblem} onClick={() => save('egas')}>{busy === 'egas' ? t('ui.saving_56a228') : t('outcomes.saveEgas')}</StableButton></div>}</>}
        poFooter={<>{poProblem && <p className="form-error" role="alert">{poProblem}</p>}
          {editPos && <div className="outcomes-actions"><StableButton type="button" className="btn primary" disabled={!!busy || !poChanged || !!poProblem} onClick={() => save('pos')}>{busy === 'pos' ? t('ui.saving_56a228') : t('outcomes.savePos')}</StableButton></div>}</>} />}
      {/* the reference versions these saves make: the version in force, history, comparison, change log and reuse across academic years (shows "not set up" until the version tables are migrated) */}
      {data && <PoReferencePanel key={String(data.versions && data.versions.pos)} program={program} hasOutcomes={data.pos.length > 0} readOnlyYear={readOnlyYear} inheritedFrom={data.inheritedFrom || null} notify={notify} onChanged={load} />}
      {data && !lockedAll && (data.subjects || []).length > 0 && <div className="outcomes-sync">
        <p className="hint">{t('outcomes.syncNote', { count: data.subjects.length })}</p>
        <StableButton type="button" className="btn outline" disabled={!!busy || !canApply} onClick={sync}>{busy === 'sync' ? t('ui.saving_56a228') : t('outcomes.sync', { count: data.subjects.length })}</StableButton>
        {skipped.length > 0 && <ul className="outcomes-skipped" role="status">{skipped.map((s) => <li key={s.id}>{t('outcomes.skipped', { code: s.code, reason: tr(s.reason) })}</li>)}</ul>}
      </div>}
      {error && <p className="form-error" role="alert">{error}{' '}<StableButton type="button" className="btn outline" disabled={!!busy} onClick={load}>{t('ui.reload_cce715')}</StableButton></p>}
      <div className="confirm-actions"><StableButton type="button" className="btn outline" disabled={!!busy} onClick={close}>{t('outcomes.close')}</StableButton></div>
    </section>
  </div></CatalogModalPortal>;
}
