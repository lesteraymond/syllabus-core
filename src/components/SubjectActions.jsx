import { useRef, useState } from 'react';
import CatalogModalPortal from './CatalogModalPortal';
import StableButton from './StableButton';
import { Icon } from './ui';
import { useModalLayer } from './useModalLayer';
import { useActionExit } from '../lib/catalogMotion';
import { courses as coursesApi } from '../lib/api';
import { t, tr } from '../i18n';
import CurriculumYearField from './CurriculumYearField';
import SubjectTermFields from './SubjectTermFields';
import SubjectUnitFields from './SubjectUnitFields';
import { normalizeCurriculumYear, termBody, termComplete, termFrom, unitsBlank, unitsBody, unitsFrom, unitsValid } from '../lib/subjectTerm';

// Edit and delete for one subject, from its row in the Subjects table (they used to be the "Subject Details" card inside the subject
// modal). Same calls as before: coursesApi.update(id, { code, title, curriculumYear, units, term }) and coursesApi.remove(id). The dialogs follow the Programs card's
// dialogs (catalog motion, modal layer, Esc and outside click close them) so the page behaves the same in both places.

// The two icon buttons of a row. The row itself opens the subject on click or Enter, so these keep their own clicks and keys to themselves.
export function SubjectRowActions({ subject, onEdit, onDelete, readOnly = false }) {
  const own = (action) => ({ onClick: (e) => { e.stopPropagation(); action(); }, onKeyDown: (e) => e.stopPropagation() });
  return <div className="sm-actions">
    <button type="button" className="icon-btn" disabled={readOnly} title={t('subjects.edit')} aria-label={t('subjects.editTitle', { code: subject.code })} {...own(onEdit)}><Icon name="pencilSquare" size={18} /></button>
    <button type="button" className="icon-btn is-delete" disabled={readOnly} title={t('subjects.delete')} aria-label={t('subjects.deleteTitle', { code: subject.code })} {...own(onDelete)}><Icon name="bin" size={18} /></button>
  </div>;
}

export function SubjectDialog({ subject, mode, onClose, onComplete, curriculumOptions = [] }) {
  const dialog = useRef(null);
  const inFlight = useRef(false);
  const motion = useActionExit(dialog);
  const [head, setHead] = useState({ code: subject.code, title: subject.title, curriculumYear: subject.curriculumYear || '', ...unitsFrom(subject.units), ...termFrom(subject.term) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!inFlight.current) motion.dismiss(onClose); };
  useModalLayer(dialog, close);
  // Each group is sent only when changed. A subject without a term stays without one until its semester and year level are chosen.
  const termWas = termFrom(subject.term), termChanged = ['semester', 'yearLevel', 'prerequisite'].some((k) => String(head[k] || '').trim() !== termWas[k]);
  const unitsWas = unitsFrom(subject.units), unitsChanged = ['lecture', 'lab'].some((k) => head[k].trim() !== unitsWas[k]);
  const valid = !!(head.code.trim() && head.title.trim()) && (!head.curriculumYear.trim() || !!normalizeCurriculumYear(head.curriculumYear)) && (unitsBlank(head) || unitsValid(head)) && (!termChanged || termComplete(head));
  const curriculumChanged = (normalizeCurriculumYear(head.curriculumYear) || null) !== (subject.curriculumYear || null);   // sent only when changed: an unchanged subject is saved exactly as before
  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current || motion.isClosing() || (mode === 'edit' && !valid)) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      if (mode === 'edit') await coursesApi.update(subject.id, { code: head.code, title: head.title, ...(curriculumChanged ? { curriculumYear: normalizeCurriculumYear(head.curriculumYear) } : {}), ...(unitsChanged ? unitsBody(head) : {}), ...(termChanged ? termBody(head) : {}) });
      else await coursesApi.remove(subject.id);
      await motion.dismiss(() => onComplete(mode));
    } catch (e) { setError(tr(e.message)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const editing = mode === 'edit';
  return <CatalogModalPortal><div className="overlay overlay-confirm catalog-overlay bld2 catalog-page" onClick={close}>
    <section className="modal confirm-modal program-dialog catalog-surface" role={editing ? 'dialog' : 'alertdialog'} aria-modal="true" aria-labelledby="subject-dialog-title" aria-describedby="subject-dialog-description"
      tabIndex={-1} ref={dialog} onClick={(event) => event.stopPropagation()} aria-busy={busy} inert={motion.closing || undefined}>
      <h3 id="subject-dialog-title">{t(editing ? 'subjects.editTitle' : 'subjects.deleteTitle', { code: subject.code })}</h3>
      <p id="subject-dialog-description">{editing ? t('subjects.editNote') : t('subjects.deleteNote', { code: subject.code })}</p>
      <form onSubmit={submit}>
        {editing && <div className="program-edit-fields">
          <label className="field"><span>{t('ui.subject_code_8e42db')}</span><input className="mono" value={head.code} maxLength={50} required disabled={busy || motion.closing} onChange={(e) => setHead({ ...head, code: e.target.value })} /></label>
          <label className="field"><span>{t('ui.subject_title_dce28f')}</span><input value={head.title} maxLength={255} required disabled={busy || motion.closing} onChange={(e) => setHead({ ...head, title: e.target.value })} /></label>
          <CurriculumYearField value={head.curriculumYear} onChange={(v) => setHead({ ...head, curriculumYear: v })} options={curriculumOptions} disabled={busy || motion.closing} />
          <SubjectUnitFields value={head} onChange={setHead} disabled={busy || motion.closing} />
          <SubjectTermFields value={head} onChange={setHead} fixedYear={(subject.term && subject.term.academicYear) || ''} disabled={busy || motion.closing} />
        </div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="confirm-actions">
          <StableButton type="button" className="btn outline" disabled={busy || motion.closing} onClick={close}>{t('ui.cancel_77dfd2')}</StableButton>
          {editing
            ? <StableButton type="submit" className="btn primary" disabled={busy || motion.closing || !valid}>{busy ? t('ui.saving_56a228') : t('ui.save_efc007')}</StableButton>
            : <StableButton type="submit" className="btn danger" disabled={busy || motion.closing}>{busy ? t('subjects.deleting') : t('subjects.deleteAction')}</StableButton>}
        </div>
      </form>
    </section>
  </div></CatalogModalPortal>;
}
