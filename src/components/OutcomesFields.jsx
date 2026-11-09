import StableButton from './StableButton';
import { Icon } from './ui';
import { t } from '../i18n';
import { blankEga, blankPo } from '../lib/outcomesSetup';

// The rows of a program's EGAs and Program Outcomes, one editor for the Outcomes dialog and the Add subject form.
//   egas / pos        the editor rows (strings typed into inputs; see src/lib/outcomesSetup.js)
//   mapTo             the EGA numbers an outcome may map to: the saved EGAs in the dialog, the EGAs typed so far in the form
//   editEgas/editPos  false shows the rows read-only (past year, specialization, official reference)
//   egaFooter/poFooter  what goes under each list (problems, Save buttons)
export default function OutcomesFields({ required = false, egas, pos, onEgas, onPos, mapTo, editEgas = true, editPos = true, busy = false, egaFooter = null, poFooter = null, poHint = '' }) {
  const setEga = (i, key, value) => onEgas(egas.map((r, at) => (at === i ? { ...r, [key]: value } : r)));
  const setPo = (i, key, value) => onPos(pos.map((r, at) => (at === i ? { ...r, [key]: value } : r)));
  const toggle = (i, no) => setPo(i, 'egas', pos[i].egas.includes(no) ? pos[i].egas.filter((n) => n !== no) : [...pos[i].egas, no]);
  const remove = (no, onClick) => <button type="button" className="icon-btn is-delete" disabled={busy} title={t('outcomes.remove', { no })} aria-label={t('outcomes.remove', { no })} onClick={onClick}><Icon name="bin" size={18} /></button>;
  return <>
    <h4>{t('outcomes.egaHeading')}{required && ' *'}</h4>
    <div className="outcomes-rows">
      {egas.map((row, i) => <div className="outcomes-row outcomes-ega" key={i}>
        <label className="field"><span>{t('outcomes.col.no')}</span><input value={row.no} inputMode="numeric" maxLength={2} disabled={!editEgas || busy} onChange={(e) => setEga(i, 'no', e.target.value.replace(/[^0-9]/g, ''))} aria-label={t('outcomes.aria.ega', { field: t('outcomes.col.no'), n: i + 1 })} /></label>
        <label className="field"><span>{t('outcomes.col.name')}</span><input value={row.name} maxLength={255} disabled={!editEgas || busy} onChange={(e) => setEga(i, 'name', e.target.value)} aria-label={t('outcomes.aria.ega', { field: t('outcomes.col.name'), n: i + 1 })} /></label>
        <label className="field"><span>{t('outcomes.col.short')}</span><input value={row.short} maxLength={120} disabled={!editEgas || busy} onChange={(e) => setEga(i, 'short', e.target.value)} aria-label={t('outcomes.aria.ega', { field: t('outcomes.col.short'), n: i + 1 })} /></label>
        {editEgas && remove(row.no, () => onEgas(egas.filter((_, at) => at !== i)))}
      </div>)}
      {!egas.length && <p className="hint">{t('outcomes.noEgaRows')}</p>}
    </div>
    {editEgas && <div className="outcomes-actions"><StableButton type="button" className="btn outline" disabled={busy || egas.length >= 20} onClick={() => onEgas([...egas, blankEga(egas)])}>{t('outcomes.addEga')}</StableButton></div>}
    {egaFooter}

    <h4>{t('outcomes.poHeading')}{required && ' *'}</h4>
    {poHint && <p className="hint">{poHint}</p>}
    <div className="outcomes-rows">
      {pos.map((row, i) => <div className="outcomes-row outcomes-po" key={i}>
        <label className="field"><span>{t('outcomes.col.no')}</span><input value={row.no} inputMode="numeric" maxLength={2} disabled={!editPos || busy} onChange={(e) => setPo(i, 'no', e.target.value.replace(/[^0-9]/g, ''))} aria-label={t('outcomes.aria.po', { field: t('outcomes.col.no'), n: i + 1 })} /></label>
        <label className="field"><span>{t('outcomes.col.short')}</span><input value={row.short} maxLength={120} disabled={!editPos || busy} onChange={(e) => setPo(i, 'short', e.target.value)} aria-label={t('outcomes.aria.po', { field: t('outcomes.col.short'), n: i + 1 })} /></label>
        <label className="field outcomes-statement"><span>{t('outcomes.col.statement')}</span><textarea rows={2} value={row.text} maxLength={2000} disabled={!editPos || busy} onChange={(e) => setPo(i, 'text', e.target.value)} aria-label={t('outcomes.aria.po', { field: t('outcomes.col.statement'), n: i + 1 })} /></label>
        <fieldset className="outcomes-maps" disabled={!editPos || busy}><legend>{t('outcomes.col.egas')}</legend>
          {mapTo.map((no) => <label className="check" key={no}><input type="checkbox" checked={row.egas.includes(no)} onChange={() => toggle(i, no)} /><span>{no}</span></label>)}
        </fieldset>
        {editPos && remove(row.no, () => onPos(pos.filter((_, at) => at !== i)))}
      </div>)}
      {!pos.length && <p className="hint">{t('outcomes.noPos')}</p>}
    </div>
    {editPos && <div className="outcomes-actions"><StableButton type="button" className="btn outline" disabled={busy || pos.length >= 50 || !mapTo.length} onClick={() => onPos([...pos, blankPo(pos)])}>{t('outcomes.addPo')}</StableButton></div>}
    {poFooter}
  </>;
}
