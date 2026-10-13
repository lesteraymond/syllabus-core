import { useState } from 'react';
import { CoverageStrip, Tag } from './parts';

// Step 2: Learning Outcomes (form section VI). Vision, mission, EGAs and program outcomes are institution data;
// the course learning outcomes (CLOs) are the course's own constant data from the course catalog. Both are
// read-only here: only an administrator edits them. Faculty tag their ILOs with them in step 3.
export default function ClosStep({ d, model }) {
  const I = model.institution;
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
  const Used = ({ list }) => <span className="used" aria-label="Used by">{list.map((i) => <span key={i} className={'code sm k' + (i % 6)}>{'CLO ' + (i + 1)}</span>)}</span>;

  return (
    <div>
      <div className="vm" aria-label="Vision and mission">
        <div><span className="lbl">Vision</span><p>{I.vision}</p></div>
        <div><span className="lbl">Mission</span><p>{I.mission.lead}</p><ul>{I.mission.items.map((t, k) => <li key={k}>{t}</li>)}</ul></div>
      </div>

      <div className="refwrap">
        <table className="ledger refs">
          <thead><tr><th style={{ width: '38%' }}>Expected graduate attributes</th><th>{'Program outcomes \u00b7 ' + (d.meta.program || 'no program chosen')}</th></tr></thead>
          <tbody><tr>
            <td>{egas.map((e) => <div key={e.no} className={'refi' + hl('ega', e.no)}><span className="cd">{'EGA ' + e.no}</span><span className="rt">{e.name}</span><Used list={usersOf('ega', e.no)} /></div>)}</td>
            <td>{pos.length ? pos.map((o) => (
              <div key={o.no} className={'refi' + hl('po', o.no)}><span className="cd">{'PO ' + o.no}</span><span className="rt">{o.text + ' '}{o.egas.map((g) => <span className="map" key={g}>{'[EGA ' + g + '] '}</span>)}</span><Used list={usersOf('po', o.no)} /></div>
            )) : <div className="hint" style={{ padding: '8px 0' }}>{d.meta.program ? 'No program outcomes are loaded for ' + d.meta.program + '. An administrator adds them in institution settings.' : 'Choose a program in step 1 to load its program outcomes.'}</div>}</td>
          </tr></tbody>
        </table>
        <div className="hint" style={{ marginTop: 6 }}>The badges show which of the course learning outcomes use each attribute or outcome. Point at a CLO below to highlight what it is tagged to.</div>
      </div>

      <h3 className="sech">{'Course learning outcomes' + (d.meta.code ? ' \u00b7 ' + d.meta.code : '')}</h3>
      {!d.meta.courseId && <div className="info-banner">Choose a subject in step 1 to load its learning outcomes.</div>}
      {d.meta.courseId && !d.clos.length && <div className="info-banner warning">No learning outcomes are defined for {d.meta.code} yet. An administrator adds them in Subjects &amp; CLOs.</div>}
      <CoverageStrip model={model} d={d} filter={null} onPick={jump} />
      {d.clos.map((c, i) => (
        <div className={'clorow' + (flash === c.id ? ' flash' : '')} id={'clo-' + c.id} key={c.id} onMouseEnter={() => setActive(c.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(c.id)} tabIndex={0}>
          <div><span className={'code lg k' + (i % 6)}>{'CLO ' + (i + 1)}</span></div>
          <div>
            <div className="cap"><strong>{c.level}</strong>{c.title && <span className="hint">{' (' + c.title + ')'}</span>}</div>
            <p style={{ margin: 0, lineHeight: 1.5 }}>{c.statement}</p>
          </div>
          <div className="col2">
            <span className="lbl">Expected graduate attributes</span>
            <div className="tags">{c.egas.length ? c.egas.map((n) => <Tag key={'e' + n} info={model.tagInfo(d, 'ega:' + n)} />) : <span className="hint">None</span>}</div>
            <span className="lbl" style={{ marginTop: 12 }}>Program outcomes</span>
            <div className="tags">{c.pos.length ? c.pos.map((n) => <Tag key={'p' + n} info={model.tagInfo(d, 'po:' + n)} />) : <span className="hint">None</span>}</div>
          </div>
        </div>
      ))}
      <p className="legend">CLO numbers follow the order in the subject catalog. In step 3 you tag each ILO with the CLOs, EGAs and program outcomes it builds.</p>
    </div>
  );
}
