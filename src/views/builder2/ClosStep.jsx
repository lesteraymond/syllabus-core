import { t, tr } from '../../i18n';
import { LEVELS } from '../../lib/syllabusModel';
import { newId } from './useDraft';
import { Auto, CoverageStrip } from './parts';
import Select from '../../components/Select';
import { Icon } from '../../components/ui';
import StableButton from '../../components/StableButton';
import ReadOnlyOutcomes from './ReadOnlyOutcomes';

// Step 2 edits the same draft as the other builder steps; it never writes the subject catalog.
export default function ClosStep({ d, model, apply, editable = !!apply }) {
  if (!editable) return <ReadOnlyOutcomes d={d} model={model} />;
  if (!model.hasOutcomeSelection(d)) return <div className="info-banner" role="status">{t('outcomes.chooseProgramSubject')}</div>;
  const o = d.outcomes || { ...model.institutionFor(d), egas: model.egaList(d), pos: model.poList(d) };
  const edit = fn => apply(next => {
    if (!next.outcomes) next.outcomes = JSON.parse(JSON.stringify(o));
    fn(next.outcomes, next);
    return next;
  });
  const toggle = (values, no) => values.includes(no) ? values.filter(n => n !== no) : [...values, no].sort((a, b) => a - b);
  const usesTag = tag => d.plan.some(row => row.ilos.some(il => il.tags.includes(tag)));
  const egaUsed = no => o.pos.some(p => p.egas.includes(no)) || d.clos.some(c => c.egas.includes(no)) || usesTag('ega:' + no);
  const poUsed = no => d.clos.some(c => c.pos.includes(no)) || usesTag('po:' + no);
  const nextNo = rows => Math.max(0, ...rows.map(row => row.no)) + 1;
  const mapChoices = (rows, values, onChange, label) => <div className="ie-egas" role="group" aria-label={label}>
    {rows.map(row => <label className={'ie-chip' + (values.includes(row.no) ? ' on' : '')} key={row.no} title={row.name || row.text}>
      <input type="checkbox" checked={values.includes(row.no)} onChange={() => onChange(toggle(values, row.no))} />{label + ' ' + row.no}
    </label>)}
  </div>;
  const removeButton = (label, disabled, onClick) => <button type="button" className="ib del" aria-label={label} title={disabled ? t('outcomes.inUse') : label} disabled={disabled} onClick={onClick}><Icon name="bin" size={16} /></button>;
  return <div className="sm-stack learning-outcomes-editor">
    <p className="hint">{t('outcomes.authoringNote')}</p>
    <section className="sm-card">
      <header className="sm-card-h"><h4>{t('ui.vision_and_mission_4c8752')}</h4></header>
      <div className="sm-card-b">
        <label className="field"><span>{t('ui.vision_40b090')}</span><Auto className="in" value={o.vision} label={t('ui.vision_40b090')} onChange={value => edit(x => { x.vision = value; })} /></label>
        <label className="field"><span>{t('ui.mission_introduction_873ac6')}</span><Auto className="in" value={o.mission.lead} label={t('ui.mission_introduction_8acfc4')} onChange={value => edit(x => { x.mission.lead = value; })} /></label>
        <span className="lbl">{t('ui.mission_statements_5e2923')}</span>
        {o.mission.items.map((text, i) => <div className="ie-row" key={i}>
          <span className="mono ie-no">{i + 1}</span>
          <Auto className="in" value={text} label={t('ui.mission_statement_45b2a8') + (i + 1)} onChange={value => edit(x => { x.mission.items[i] = value; })} />
          {removeButton(t('ui.remove_statement_100039') + (i + 1), false, () => edit(x => { x.mission.items.splice(i, 1); }))}
        </div>)}
        <button type="button" className="link" disabled={o.mission.items.length >= 50} onClick={() => edit(x => { x.mission.items.push(''); })}>{t('ui.add_mission_statement_0ad1c2')}</button>
      </div>
    </section>
    <div className="sm-pair">
      <section className="sm-card">
        <header className="sm-card-h"><h4>{t('ui.expected_graduate_attributes_86f980')}</h4></header>
        <div className="sm-card-b">
          {o.egas.map((e, i) => <div className="ie-ega" key={e.no}>
            <span className="code ref mono">{t('ui.ega_4f085b') + e.no}</span>
            <input className="in" value={e.name} maxLength={255} placeholder={t('ui.full_name_eeb692')} aria-label={t('ui.name_of_ega_3dfa90') + e.no} onChange={event => { const value = event.target.value; edit(x => { x.egas[i].name = value; }); }} />
            <input className="in" value={e.short} maxLength={120} placeholder={t('ui.short_name_feb5a9')} aria-label={t('ui.short_name_of_ega_231166') + e.no} onChange={event => { const value = event.target.value; edit(x => { x.egas[i].short = value; }); }} />
            {removeButton(t('ui.remove_ega_8c32e7') + e.no, egaUsed(e.no), () => edit(x => { x.egas.splice(i, 1); }))}
          </div>)}
          <button type="button" className="link" disabled={o.egas.length >= 20} onClick={() => edit(x => { x.egas.push({ no: nextNo(x.egas), name: '', short: '' }); })}>{t('ui.add_ega_270a20')}</button>
        </div>
      </section>
      <section className="sm-card">
        <header className="sm-card-h"><h4>{t('ui.program_outcomes_858de9')}</h4></header>
        <div className="sm-card-b">
          {o.pos.map((p, i) => <div className="ie-po" key={p.no}>
            <span className="code ref mono">{t('ui.po_3756d6') + p.no}</span>
            <div>
              <input className="in" value={p.short} maxLength={120} placeholder={t('ui.short_name_feb5a9')} aria-label={t('ui.short_name_of_po_452bca') + p.no} onChange={event => { const value = event.target.value; edit(x => { x.pos[i].short = value; }); }} />
              <Auto className="in" value={p.text} label={t('ui.statement_of_po_0182b3') + p.no} onChange={value => edit(x => { x.pos[i].text = value; })} />
              {mapChoices(o.egas, p.egas, values => edit(x => { x.pos[i].egas = values; }), t('ui.ega_4f085b'))}
            </div>
            {removeButton(t('ui.remove_po_ffe9b3') + p.no, poUsed(p.no), () => edit(x => { x.pos.splice(i, 1); }))}
          </div>)}
          <button type="button" className="link" disabled={o.pos.length >= 50} onClick={() => edit(x => { x.pos.push({ no: nextNo(x.pos), short: '', text: '', egas: [] }); })}>{t('ui.add_program_outcome_cd9147')}</button>
        </div>
      </section>
    </div>
    <section className="sm-card">
      <header className="sm-card-h"><h4>{t('ui.course_learning_outcomes_503861')}</h4></header>
      <div className="sm-card-b">
        {d.clos.map((c, i) => <div className="clorow" id={'clo-' + c.id} key={c.id}>
          <span className={'code lg k' + i % 6}>{t('ui.clo_069efc') + (i + 1)}</span>
          <div>
            <div className="cap">
              <Select className="sel" value={c.level} aria-label={t('ui.level_of_clo_c01e3f') + (i + 1)} onChange={event => { const value = event.target.value; edit((x, next) => { next.clos[i].level = value; }); }}>{LEVELS.map(level => <option key={level} value={level}>{tr(level)}</option>)}</Select>
              {removeButton(t('ui.delete_clo_3a0c81') + (i + 1), usesTag('clo:' + c.id), () => edit((x, next) => { next.clos.splice(i, 1); }))}
            </div>
            <input className="in" value={c.title} maxLength={255} placeholder={t('ui.descriptor_e_g_foundational_knowledge_3cc9d7')} aria-label={t('ui.title_of_clo_04eb8b') + (i + 1)} onChange={event => { const value = event.target.value; edit((x, next) => { next.clos[i].title = value; }); }} />
            <Auto className="in" value={c.statement} label={t('ui.statement_of_clo_13551f') + (i + 1)} onChange={value => edit((x, next) => { next.clos[i].statement = value; })} />
          </div>
          <div className="col2">
            <span className="lbl">{t('ui.expected_graduate_attributes_86f980')}</span>
            {mapChoices(o.egas, c.egas, values => edit((x, next) => { next.clos[i].egas = values; }), t('ui.ega_4f085b'))}
            <span className="lbl">{t('ui.program_outcomes_858de9')}</span>
            {mapChoices(o.pos, c.pos, values => edit((x, next) => { next.clos[i].pos = values; }), t('ui.po_3756d6'))}
          </div>
        </div>)}
        <StableButton type="button" className="btn outline" disabled={d.clos.length >= 20} onClick={() => edit((x, next) => { next.clos.push({ id: newId(), title: '', level: 'Enabling', statement: '', egas: [], pos: [] }); })}>{t('ui.add_clo_0485ad')}</StableButton>
        <CoverageStrip model={model} d={d} filter={null} onPick={id => document.getElementById('clo-' + id)?.scrollIntoView({ block: 'center' })} />
      </div>
    </section>
  </div>;
}
