import CatalogModalPortal from './CatalogModalPortal';
import { useActionExit, useCatalogMotion, useSurfaceMotion } from '../lib/catalogMotion';
import { useEffect, useRef, useState } from 'react';
import StableButton from './StableButton';
import { Icon } from './ui';
import { useModalLayer } from './useModalLayer';
import { outcomes } from '../lib/api';
import { t, tr } from '../i18n';
const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', approved: 'Approved', for_revision: 'For Revision', rejected: 'Rejected' };

export function DeletionImpact({ preview }) {
  return <div className="program-delete-impact">
    <dl>{['subjects', 'syllabi', 'versions', 'assignments', 'files'].map(key => <div key={key}><dt>{t('programs.count.' + key)}</dt><dd>{preview.counts[key]}</dd></div>)}</dl>
    <p className="info-banner warning">{t('programs.cascadeWarning')}</p>
    {preview.subjects.length > 0 && <details><summary>{t('programs.affectedSubjects')}</summary><ul>{preview.subjects.map(subject => <li key={subject.id}>{subject.code}{' · '}{subject.title}</li>)}</ul></details>}
    {preview.syllabi.length > 0 && <details><summary>{t('programs.affectedSyllabi')}</summary><ul>{preview.syllabi.map(syllabus => <li key={syllabus.id}>{syllabus.code}{' · '}{syllabus.title}{' · '}{tr(STATUS_LABELS[syllabus.status] || syllabus.status)}</li>)}</ul>{preview.counts.syllabi > preview.syllabi.length && <p>{t('programs.firstHundred')}</p>}</details>}
  </div>;
}
export function ProgramDialog({ program, mode, onClose, onComplete, onReload }) {
  const dialog = useRef(null);
  const inFlight = useRef(false);
  const [name, setName] = useState(program.name);
  const [programCode, setProgramCode] = useState(program.code);
  const motion = useActionExit(dialog);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(mode === 'delete');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState(1);
  const [code, setCode] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const target = mode === 'delete' && preview ? preview.program : program;
  const surfaceSettled = useSurfaceMotion(dialog, JSON.stringify([mode, loading, stage, preview?.counts, error]));
  const close = () => { if (!inFlight.current) motion.dismiss(onClose); };
  useModalLayer(dialog, close);
  useEffect(() => {
    if (mode !== 'delete') return;
    let active = true;
    outcomes.previewProgramDeletion(program.id).then(result => { if (active) setPreview(result); }).catch(error => { if (active) setError(tr(error.message)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, program.id]);
  useEffect(() => {
    if (stage !== 2) return;
    let active = true;
    const field = dialog.current?.querySelector('input');
    field?.focus({ preventScroll: true });
    surfaceSettled().then(() => {
      if (active && field && field.ownerDocument.activeElement === field) field.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    });
    return () => { active = false; };
  }, [stage, surfaceSettled]);
  const reload = async () => {
    setLoading(true); setError(''); setPreview(null); setStage(1); setCode(''); setAcknowledged(false);
    try { setPreview(await outcomes.previewProgramDeletion(program.id)); }
    catch (error) { setError(tr(error.message)); }
    finally { setLoading(false); }
  };
  const submit = async event => {
    event.preventDefault();
    if (inFlight.current || motion.isClosing() || (mode === 'delete' && (!preview || stage !== 2 || code !== target.code || !acknowledged))) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = mode === 'rename'
        ? await outcomes.renameProgram(program.id, name, program.name, programCode, program.code)
        : await outcomes.deleteProgram(program.id, { previewToken: preview.previewToken, confirmCode: code, acknowledgeCascade: acknowledged });
      await motion.dismiss(() => onComplete(result, mode));
    } catch (error) {
      setError(tr(error.message));
      if (mode === 'delete' && error.data?.code === 'preview_required') { setPreview(null); setStage(1); setCode(''); setAcknowledged(false); }
    } finally { inFlight.current = false; setBusy(false); }
  };
  return <CatalogModalPortal><div className="overlay overlay-confirm catalog-overlay bld2 catalog-page" onClick={close}>
    <section className="modal confirm-modal program-dialog catalog-surface" role={mode === 'delete' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="program-dialog-title" aria-describedby="program-dialog-description" tabIndex={-1} ref={dialog} onClick={event => event.stopPropagation()} aria-busy={busy || loading} inert={motion.closing || undefined}>
      <h3 id="program-dialog-title">{t(mode === 'rename' ? 'programs.renameTitle' : 'programs.deleteTitle', { code: target.code })}</h3>
      <p id="program-dialog-description">{mode === 'rename' ? t('programs.renameNote') : t('programs.deleteNote', { name: target.name })}</p>
      <form onSubmit={submit}>
        {mode === 'rename' ? <div className="program-edit-fields"><label className="field"><span>{t('ui.program_code_18ae83')}</span><input value={programCode} maxLength={20} pattern="[A-Za-z][A-Za-z0-9-]{1,19}" required disabled={busy || motion.closing} onChange={event => setProgramCode(event.target.value.toUpperCase())} /></label><label className="field"><span>{t('ui.program_name_699413')}</span><input value={name} maxLength={255} required disabled={busy || motion.closing} onChange={event => setName(event.target.value)} /></label></div> : <>
          <p role="status">{t('programs.stage', { step: stage })}</p>
          {loading && <p role="status">{t('programs.loadingImpact')}</p>}
          {preview && <DeletionImpact preview={preview} />}
          {stage === 2 && preview && <div className="program-final-confirm">
            <label className="field"><span>{t('programs.typeCode', { code: target.code })}</span><input value={code} autoComplete="off" spellCheck={false} disabled={busy || motion.closing} onChange={event => setCode(event.target.value)} /></label>
          </div>}
          {preview && <label className="check program-delete-acknowledgement"><input type="checkbox" required checked={acknowledged} disabled={busy || motion.closing} onChange={event => setAcknowledged(event.target.checked)} /><span>{t('programs.acknowledge')}</span></label>}
        </>}
        {error && <p className="form-error" role="alert">{error}{mode === 'rename' && <StableButton className="btn outline" type="button" disabled={busy || motion.closing} onClick={async () => { try { await onReload(); await motion.dismiss(onClose); } catch (error) { setError(tr(error.message)); } }}>{t('ui.reload_cce715')}</StableButton>}</p>}
        <div className="confirm-actions">
          <StableButton type="button" className="btn outline" disabled={busy || motion.closing} onClick={close}>{t('ui.cancel_77dfd2')}</StableButton>
          {mode === 'rename' ? <StableButton type="submit" className="btn primary" disabled={busy || motion.closing || name.trim().length < 2 || !/^[A-Z][A-Z0-9-]{1,19}$/.test(programCode.trim())}>{busy ? t('ui.saving_56a228') : t('programs.saveName')}</StableButton>
            : !preview && !loading ? <StableButton type="button" className="btn outline" onClick={reload}>{t('programs.reloadImpact')}</StableButton>
            : stage === 1 ? <StableButton type="button" className="btn danger" disabled={loading || !preview || !acknowledged || busy || motion.closing} onClick={() => { if (preview && acknowledged && !busy && !motion.isClosing()) setStage(2); }}>{t('programs.deleteAction')}</StableButton>
            : <StableButton type="submit" className="btn danger" disabled={busy || motion.closing || code !== target.code || !acknowledged}>{busy ? t('programs.deleting') : t('programs.deleteAction')}</StableButton>}
        </div>
      </form>
    </section>
  </div></CatalogModalPortal>;
}
export default function ProgramManagement({ programs, onChanged, notify }) {
  const [selected, setSelected] = useState(null);
  const [refreshError, setRefreshError] = useState('');
  const heading = useRef(null);
  const table = useRef(null);
  useCatalogMotion(table, JSON.stringify(programs.map(({ id, code, name }) => [id, code, name])));
  const complete = async (result, mode) => {
    setSelected(null);
    notify(t(mode === 'rename' ? 'programs.renamed' : result.fileCleanupPending ? 'programs.deletedPending' : 'programs.deleted'));
    try { await onChanged(); setRefreshError(''); } catch (error) { setRefreshError(tr(error.message)); }
    heading.current?.focus();
  };
  return <section className="card program-management" aria-labelledby="program-management-title">
    <div className="card-head"><h3 id="program-management-title" ref={heading} tabIndex={-1}>{t('programs.heading')}</h3></div>
    {refreshError && <div className="form-error" role="alert">{refreshError}<StableButton type="button" className="btn outline" onClick={async () => { try { await onChanged(); setRefreshError(''); } catch (error) { setRefreshError(tr(error.message)); } }}>{t('ui.reload_cce715')}</StableButton></div>}
    <div className="table-wrap" ref={table}><table><thead><tr><th>{t('ui.program_code_18ae83')}</th><th>{t('ui.program_name_699413')}</th><th className="col-actions">{t('ui.actions_c3cd63')}</th></tr></thead><tbody>
      {programs.map(program => <tr key={program.id} data-catalog-row={'program-' + program.id}><td className="mono">{program.code}</td><td>{program.name}</td><td className="col-actions"><div className="program-management-actions">
        <button className="icon-btn" type="button" title={t('programs.rename')} aria-label={t('programs.renameTitle', { code: program.code })} onClick={() => setSelected({ program, mode: 'rename' })}><Icon name="pencilSquare" size={18} /></button>
        <button className="icon-btn is-delete" type="button" title={t('programs.delete')} aria-label={t('programs.deleteTitle', { code: program.code })} onClick={() => setSelected({ program, mode: 'delete' })}><Icon name="bin" size={18} /></button>
      </div></td></tr>)}
      {!programs.length && <tr><td colSpan="3">{t('programs.empty')}</td></tr>}
    </tbody></table></div>
    {selected && <ProgramDialog key={selected.program.id + selected.mode} {...selected} onClose={() => setSelected(null)} onComplete={complete} onReload={onChanged} />}
  </section>;
}
