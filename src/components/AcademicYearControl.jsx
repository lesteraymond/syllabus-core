import { useRef, useState } from 'react';
import Select from './Select';
import StableButton from './StableButton';
import ConfirmModal from './ConfirmModal';
import CatalogModalPortal from './CatalogModalPortal';
import { useModalLayer } from './useModalLayer';
import { academicYears as yearsApi } from '../lib/api';
import { useYearScope } from './AcademicYearScope';
import { t, tr } from '../i18n';

// The administrator's one academic-year control on Program & Subjects, in the page header. It replaces the dropdown and the separate "Current academic year" card:
//   the dropdown   which year's catalog is shown (the current year is tagged); a catalog is always ONE year, so there is no "all years"
//   Make current   only while a year other than the current one is shown; confirmed first. Everyone else then starts that year with empty lists and an empty catalog
//   (one status line was dropped: the counts of a year are not needed to choose it)
//   + Add year     reveals one small field for the first year of the next academic year (2028 makes 2028–2029)
//   Copy from X    only while the current year has no programs and an earlier year has a catalog: fills the empty year from it (optional, never automatic)
//   Delete year    only while a year other than the current one is shown; confirmed first. The server refuses a year that still has syllabi, programs or subjects
// `years` is the administrator's list with the counts of each year's catalog (GET /api/academic-years); the rules themselves are enforced by the server (lib/academicYear.js).
// Shown instead of the delete confirmation when the year being viewed still has programs or subjects: the server would refuse it, so say why and what to do (a refusal that only
// flashed in the page's short notification looked like a Delete button that did nothing).
function DeleteBlocked({ year, programs, subjects, onClose }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose);
  return <div className="overlay overlay-confirm" onClick={onClose}>
    <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label={t('years.deleteBlockedTitle', { year })} tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
      <div className="confirm-icon">⚠</div>
      <h3>{t('years.deleteBlockedTitle', { year })}</h3>
      <p>{t('years.deleteBlockedBody', { year, programs, subjects })}</p>
      <div className="confirm-actions"><StableButton className="btn outline" onClick={onClose}>{t('outcomes.close')}</StableButton></div>
    </div>
  </div>;
}

export default function AcademicYearControl({ years, onChanged, onAddYear, notify }) {
  const scope = useYearScope();
  const list = (years || []).slice().sort((a, b) => a.startYear - b.startYear);
  const [dialog, setDialog] = useState(null);   // 'change' | 'copy' | 'delete'
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState('');   // the add-year form's own message (shown inside it)
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState('');
  if (!scope) return null;

  const current = list.find((y) => y.isCurrent) || null;
  const options = scope.options('data').filter((o) => o.value !== 'all');
  const selected = scope.selection('data');
  const shownLabel = selected && selected !== 'all' ? selected : (current ? current.label : '');
  const viewingCurrent = !!current && shownLabel === current.label;
  // the nearest earlier year that has a catalog, offered as the source when the current year has none
  const source = current ? list.filter((y) => y.startYear < current.startYear && y.programs > 0).slice(-1)[0] || null : null;
  const viewed = list.find((y) => y.label === shownLabel) || null;
  const canCopy = viewingCurrent && !!source && !current.programs;

  // a failed Make current / Copy is reported with the page's own notification, so the header never grows a banner
  const run = async (work) => { setBusy(true); try { await work(); } catch (e) { notify(tr(e.message)); } finally { setBusy(false); setDialog(null); } };
  const makeCurrent = () => run(async () => {
    const label = shownLabel;
    await yearsApi.setCurrent(label);
    await onChanged(); await scope.reload();
    notify(t('years.changed', { year: label }));
  });
  // Delete the year being viewed (never the current one; the server also refuses a year that still has syllabi, programs or subjects). Afterwards the view returns to the current year.
  const removeYear = () => run(async () => {
    const label = shownLabel;
    await yearsApi.remove(label);
    // go back to the current year and refresh the year list FIRST. Not onChanged(): it still holds the deleted year (the one being viewed), the server refuses to read that
    // catalog now, and the failure would stop the list from refreshing, leaving the deleted year in the dropdown. Leaving that year reloads the catalog by itself.
    scope.select('data', '');
    await scope.reload();
    notify(t('years.deleted', { year: label }));
  });
  const copy = () => run(async () => {
    const done = await yearsApi.copyCatalog(source.label);
    await onChanged();
    notify(t('years.copied', { programs: done.programs, subjects: done.subjects, from: done.from }));
  });
  const add = async (event) => {
    event.preventDefault();
    if (busy || !/^[0-9]{4}$/.test(start)) return;
    setBusy(true); setAddError('');
    try { await onAddYear(Number(start)); setStart(''); setAdding(false); } catch (e) { setAddError(tr(e.message)); } finally { setBusy(false); }
  };

  return <div className="year-bar">
    <div className="field year-filter">
      <Select value={selected === 'all' ? '' : selected} disabled={busy || !options.length} onChange={(e) => { scope.select('data', e.target.value); }} aria-label={t('term.academicYear')}>
        {options.map((o) => <option key={o.value || 'current'} value={o.value} data-short={o.short}>{o.label}</option>)}
      </Select>
    </div>
    {current && !viewingCurrent && <StableButton type="button" className="btn outline" disabled={busy} onClick={() => setDialog('change')}>{t('years.makeCurrent')}</StableButton>}
    {current && !viewingCurrent && <StableButton type="button" className="btn danger" disabled={busy} onClick={() => setDialog('delete')}>{t('years.deleteButton')}</StableButton>}
    {canCopy && <StableButton type="button" className="btn outline" disabled={busy} onClick={() => setDialog('copy')}>{t('years.copyButton', { year: source.label })}</StableButton>}
    <div className="ay-anchor">
      <StableButton type="button" className="btn outline" disabled={busy} aria-expanded={adding} aria-haspopup="dialog" onClick={() => { setAdding(!adding); setAddError(''); }}>{t('years.addToggle')}</StableButton>
      {adding && <form className="ay-pop" onSubmit={add} aria-label={t('years.addToggle')}>
        <label className="field"><span>{t('years.firstYear')}</span>
          <input value={start} inputMode="numeric" maxLength={4} placeholder="2028" autoFocus disabled={busy} onChange={(e) => { setStart(e.target.value.replace(/[^0-9]/g, '')); setAddError(''); }} />
        </label>
        <p className="ac-hint">{list.length ? t('years.addHint') : t('years.notMigrated')}</p>
        {addError && <p className="form-error" role="alert">{addError}</p>}
        <div className="ay-pop-actions">
          <StableButton type="button" className="btn outline" disabled={busy} onClick={() => { setAdding(false); setAddError(''); }}>{t('ui.cancel_77dfd2')}</StableButton>
          <StableButton type="submit" className="btn primary" disabled={busy || !/^[0-9]{4}$/.test(start)}>{t('years.add')}</StableButton>
        </div>
      </form>}
    </div>
    {/* in a portal: the page animates, and a fixed overlay inside it would be clipped */}
    {dialog === 'change' && <CatalogModalPortal><ConfirmModal title={t('years.changeTitle', { year: shownLabel })} message={t('years.changeBody', { year: shownLabel })} label={t('years.changeConfirm')} onConfirm={makeCurrent} onClose={() => !busy && setDialog(null)} /></CatalogModalPortal>}
    {dialog === 'delete' && viewed && (viewed.programs > 0 || viewed.subjects > 0) && <CatalogModalPortal><DeleteBlocked year={shownLabel} programs={viewed.programs || 0} subjects={viewed.subjects || 0} onClose={() => setDialog(null)} /></CatalogModalPortal>}
    {dialog === 'delete' && !(viewed && (viewed.programs > 0 || viewed.subjects > 0)) && <CatalogModalPortal><ConfirmModal title={t('years.deleteTitle', { year: shownLabel })} message={t('years.deleteBody', { year: shownLabel })} label={t('years.deleteConfirm')} onConfirm={removeYear} onClose={() => !busy && setDialog(null)} /></CatalogModalPortal>}
    {dialog === 'copy' && source && <CatalogModalPortal><ConfirmModal title={t('years.copyTitle', { from: source.label, to: current.label })} message={t('years.copyBody', { from: source.label, to: current.label })} label={t('years.copyConfirm')} onConfirm={copy} onClose={() => !busy && setDialog(null)} /></CatalogModalPortal>}
  </div>;
}
