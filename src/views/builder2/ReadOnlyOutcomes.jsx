import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { useState } from 'react';
import { CoverageStrip, Tag } from './parts';

// Step 2: Learning Outcomes (form section VI). Vision, mission, EGAs and program outcomes are institution data;
// the course learning outcomes (CLOs) are the course's own constant data from the course catalog. Both are
// read-only here: only an administrator edits them. Faculty tag their ILOs with them in step 3.
export default function ReadOnlyOutcomes({ d, model }) {
  const I = model.institutionFor(d);
  const egas = model.egaList(d); // this program's own EGAs
  const pos = model.poList(d);
  const [active, setActive] = useState(null);
  const [flash, setFlash] = useState(null);

  const jump = (id) => {
    const el = document.getElementById('clo-' + id);
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    setFlash(id);
    setTimeout(() => setFlash(null), 900);
  };
  const act = active ? d.clos.find((c) => c.id === active) : null;
  const usersOf = (kind, no) => d.clos.map((c, i) => ((kind === 'ega' ? c.egas : c.pos).includes(no) ? i : -1)).filter((i) => i > -1);
  const hl = (kind, no) => (act && (kind === 'ega' ? act.egas : act.pos).includes(no) ? ' hl' : '');
  const Used = ({ list }) => <span className="used" aria-label={translateUI("ui.used_by_f5060a")}>{list.map((i) => <span key={i} className={'code sm k' + (i % 6)}>{translateUI("ui.clo_069efc") + (i + 1)}</span>)}</span>;

  if (!model.hasOutcomeSelection(d)) return <div className="info-banner" role="status">{translateUI("outcomes.chooseProgramSubject")}</div>;

  if (!model.outcomesReady(d)) return <div className="info-banner warning" role="status">{translateUI('outcomes.subjectIncomplete')}</div>;

  return (
    <div>
      <div className="vm" aria-label={translateUI("ui.vision_and_mission_4c8752")}>
        <div><span className="lbl">{translateUI("ui.vision_40b090")}</span><p>{I.vision}</p></div>
        <div><span className="lbl">{translateUI("ui.mission_e4698d")}</span><p>{I.mission.lead}</p><ul>{I.mission.items.map((t, k) => <li key={k}>{t}</li>)}</ul></div>
      </div>

      <div className="refwrap">
        <table className="ledger refs">
          <thead><tr><th style={{ width: '38%' }}>{translateUI("ui.expected_graduate_attributes_86f980")}</th><th>{translateUI("ui.program_outcomes_b86d07") + (d.meta.program || tr('no program chosen'))}</th></tr></thead>
          <tbody><tr>
            <td>{egas.map((e) => <div key={e.no} className={'refi' + hl('ega', e.no)}><span className="cd">{translateUI("ui.ega_4f085b") + e.no}</span><span className="rt">{e.name}</span><Used list={usersOf('ega', e.no)} /></div>)}</td>
            <td>{pos.length ? pos.map((o) => (
              <div key={o.no} className={'refi' + hl('po', o.no)}><span className="cd">{translateUI("ui.po_3756d6") + o.no}</span><span className="rt">{o.text + ' '}{o.egas.map((g) => <span className="map" key={g}>{translateUI("ui.ega_7bee0f") + g + '] '}</span>)}</span><Used list={usersOf('po', o.no)} /></div>
            )) : <div className="hint" style={{ padding: '8px 0' }}>{d.meta.program ? translateUI("ui.no_program_outcomes_are_loaded_for_db8e64") + d.meta.program + translateUI("ui.an_administrator_adds_them_in_institution_settings_ddb051") : translateUI("ui.choose_a_program_in_step_1_to_load_its_program_outcomes_d121f2")}</div>}</td>
          </tr></tbody>
        </table>
        <div className="hint" style={{ marginTop: 6 }}>{translateUI("ui.the_badges_show_which_of_the_course_learning_outcomes_use_each_at_6463d4")}</div>
      </div>

      <h3 className="sech">{translateUI("ui.course_learning_outcomes_503861") + (d.meta.code ? ' \u00b7 ' + d.meta.code : '')}</h3>
      {!d.meta.courseId && <div className="info-banner">{translateUI("ui.choose_a_subject_in_step_1_to_load_its_learning_outcomes_017d6f")}</div>}
      {d.meta.courseId && !d.clos.length && <div className="info-banner warning">{translateUI("ui.no_learning_outcomes_are_defined_for_abd5b1")}{d.meta.code}{translateUI("ui.yet_an_administrator_adds_them_in_subjects_amp_clos_2e8b78")}</div>}
      <CoverageStrip model={model} d={d} filter={null} onPick={jump} />
      {d.clos.map((c, i) => (
        <div className={'clorow' + (flash === c.id ? ' flash' : '')} id={'clo-' + c.id} key={c.id} onMouseEnter={() => setActive(c.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(c.id)} tabIndex={0}>
          <div><span className={'code lg k' + (i % 6)}>{translateUI("ui.clo_069efc") + (i + 1)}</span></div>
          <div>
            <div className="cap"><strong>{c.level}</strong>{c.title && <span className="hint">{' (' + c.title + ')'}</span>}</div>
            <p style={{ margin: 0, lineHeight: 1.5 }}>{c.statement}</p>
          </div>
          <div className="col2">
            <span className="lbl">{translateUI("ui.expected_graduate_attributes_86f980")}</span>
            <div className="tags">{c.egas.length ? c.egas.map((n) => <Tag key={'e' + n} info={model.tagInfo(d, 'ega:' + n)} />) : <span className="hint">{translateUI("ui.none_6eef66")}</span>}</div>
            <span className="lbl" style={{ marginTop: 12 }}>{translateUI("ui.program_outcomes_858de9")}</span>
            <div className="tags">{c.pos.length ? c.pos.map((n) => <Tag key={'p' + n} info={model.tagInfo(d, 'po:' + n)} />) : <span className="hint">{translateUI("ui.none_6eef66")}</span>}</div>
          </div>
        </div>
      ))}
      <p className="legend">{translateUI("ui.clo_numbers_follow_the_order_in_the_subject_catalog_in_step_3_you_bbf7d3")}</p>
    </div>
  );
}
