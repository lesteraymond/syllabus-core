import { useState } from 'react';
import { clone, renderMarkup, weekSet } from '../../lib/syllabusModel';
import { Auto, CoverageStrip, Ic, OutcomePicker, Tag } from './parts';
import { newId } from './useDraft';

const newIlo = () => ({ id: newId(), text: '', tags: [] });
const CELLS = [['contents', 'Topics covered'], ['activities', '- One per line'], ['tasks', '- One per line'], ['values', '**Core value**']];

// Cells hold plain text with light markup; the Formatted view and the review render it escaped.
const Formatted = ({ text }) => <div className="fmt" dangerouslySetInnerHTML={{ __html: renderMarkup(text) || '<span style="color:var(--muted)">—</span>' }} />;

// Step 3: Learning Plan (form section VII).
export default function PlanStep({ d, apply, model, filter, setFilter, onDeleteRow }) {
  const [picker, setPicker] = useState(null);
  const [mode, setMode] = useState('edit');
  const edit = mode === 'edit';
  const shown = d.plan.filter((r) => !filter || model.rowHits(d, r).includes(filter));
  const weeks = Object.keys(weekSet(d.plan)).length;
  const updRow = (id, fn) => apply((x) => { const r = x.plan.find((y) => y.id === id); if (r) fn(r); return x; });
  const move = (id, delta) => apply((x) => {
    const i = x.plan.findIndex((y) => y.id === id);
    const j = i + delta;
    if (j < 0 || j >= x.plan.length) return x;
    x.plan.splice(j, 0, x.plan.splice(i, 1)[0]);
    return x;
  });
  const addRow = (kind) => {
    const mx = Math.max(0, ...Object.keys(weekSet(d.plan)).map(Number));
    const r = { id: newId(), kind, week: String(mx + 1), ilos: [newIlo()], contents: kind === 'exam' ? '**EXAMINATION**' : '', activities: kind === 'exam' ? '- Examination' : '', tasks: '', values: '' };
    apply((x) => { x.plan.push(r); return x; });
    setTimeout(() => { const el = document.querySelector('[data-fid="' + r.id + '"]'); if (el) el.focus(); }, 40);
  };
  const pr = picker ? d.plan.find((r) => r.id === picker.row) : null;
  const pil = pr ? pr.ilos.find((x) => x.id === picker.ilo) : null;

  return (
    <div>
      <CoverageStrip model={model} d={d} filter={filter} onPick={(id) => setFilter(filter === id ? null : id)} />
      <div className="tbar">
        <div className="filterline">
          {filter
            ? <><span>{'Showing ' + shown.length + ' of ' + d.plan.length + ' rows that build'}</span><Tag info={model.tagInfo(d, 'clo:' + filter)} /><button type="button" className="link" onClick={() => setFilter(null)}>Clear filter</button></>
            : <span><span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{weeks + ' of 18'}</span> weeks covered. Use <span className="mono">-</span> for bullets and <span className="mono">**bold**</span> for labels.</span>}
        </div>
        <div className="seg" role="group" aria-label="Cell view">
          <button type="button" aria-pressed={edit} onClick={() => setMode('edit')}>Edit</button>
          <button type="button" aria-pressed={!edit} onClick={() => setMode('fmt')}>Formatted</button>
        </div>
      </div>
      <div className="scroll">
        <table className="ledger plan">
          <colgroup><col style={{ width: '96px' }} /><col style={{ width: '31%' }} /><col style={{ width: '14%' }} /><col style={{ width: '17%' }} /><col style={{ width: '15%' }} /><col /></colgroup>
          <thead><tr><th>Week</th><th>Intended learning outcomes</th><th>Course contents</th><th>Learning activities</th><th>Assessment tasks</th><th>Values to integrate</th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const full = d.plan.findIndex((y) => y.id === r.id);
              const exam = r.kind === 'exam';
              return (
                <tr key={r.id} className={exam ? 'exam' : ''}>
                  <td>
                    <div className="wkc">
                      {edit
                        ? <input className="cell" value={r.week} data-fid={r.id} aria-label="Week" placeholder="Week" onChange={(e) => { const v = e.target.value; updRow(r.id, (x) => { x.week = v; }); }} />
                        : <div className="fmt mono" style={{ fontWeight: 600 }}>{'Wk ' + r.week}</div>}
                      {edit && <select className="kind" value={r.kind} aria-label="Row type" onChange={(e) => { const v = e.target.value; updRow(r.id, (x) => { x.kind = v; }); }}><option value="lesson">LESSON</option><option value="exam">EXAM</option></select>}
                      {edit && (
                        <div className="racts">
                          <button type="button" className="ib" aria-label="Move up" disabled={full === 0} onClick={() => move(r.id, -1)}><Ic n="up" /></button>
                          <button type="button" className="ib" aria-label="Move down" disabled={full === d.plan.length - 1} onClick={() => move(r.id, 1)}><Ic n="down" /></button>
                          <button type="button" className="ib" aria-label="Duplicate row" onClick={() => apply((x) => { const c = clone(r); c.id = newId(); c.week = ''; c.ilos.forEach((il) => { il.id = newId(); }); x.plan.splice(full + 1, 0, c); return x; })}><Ic n="copy" /></button>
                          <button type="button" className="ib del" aria-label="Delete row" onClick={() => onDeleteRow(r.id)}><Ic n="trash" /></button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {exam
                      ? (edit
                        ? <Auto value={r.ilos[0] ? r.ilos[0].text : ''} placeholder="Review of topics" label="Review topics" onChange={(v) => updRow(r.id, (x) => { if (!x.ilos[0]) x.ilos.push(newIlo()); x.ilos[0].text = v; })} />
                        : <Formatted text={r.ilos[0] ? r.ilos[0].text : ''} />)
                      : <>
                        {r.ilos.map((il, j) => (
                          <div className="ilo" key={il.id}>
                            <span className="lb">{'ILO' + (j + 1)}</span>
                            {edit
                              ? <Auto value={il.text} placeholder="Start with a verb" label={'ILO ' + (j + 1) + ' of week ' + r.week} onChange={(v) => updRow(r.id, (x) => { x.ilos[j].text = v; })} />
                              : <div className="fmt">{il.text || '—'}</div>}
                            <div className="tagrow">
                              {il.tags.map((t) => <Tag key={t} info={model.tagInfo(d, t)} onRemove={edit ? () => updRow(r.id, (x) => { x.ilos[j].tags = x.ilos[j].tags.filter((v) => v !== t); }) : null} />)}
                              {edit && <button type="button" className="tagbtn" aria-label={'Tag outcomes for ILO ' + (j + 1)} onClick={(e) => setPicker({ row: r.id, ilo: il.id, rect: e.currentTarget.getBoundingClientRect() })}>+ Tag</button>}
                              {edit && r.ilos.length > 1 && <button type="button" className="ib del" aria-label="Remove ILO" onClick={() => updRow(r.id, (x) => { x.ilos.splice(j, 1); })}><Ic n="x" /></button>}
                            </div>
                          </div>
                        ))}
                        {edit && <button type="button" className="link" onClick={() => updRow(r.id, (x) => { x.ilos.push(newIlo()); })}>+ ILO</button>}
                      </>}
                  </td>
                  {CELLS.map(([f, ph]) => (
                    <td key={f}>{edit
                      ? <Auto value={r[f]} placeholder={ph} label={f + ' of week ' + r.week} onChange={(v) => updRow(r.id, (x) => { x[f] = v; })} />
                      : <Formatted text={r[f]} />}</td>
                  ))}
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan="6" style={{ padding: 24, color: 'var(--muted)' }}>{filter ? 'No rows build this CLO yet. Tag an ILO with it, or clear the filter.' : 'No rows yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <div className="addrow"><button type="button" className="btn outline" onClick={() => addRow('lesson')}>+ Add week</button><button type="button" className="btn outline" onClick={() => addRow('exam')}>+ Add exam row</button></div>}
      {picker && pil && (
        <OutcomePicker model={model} d={d} kinds={['clo', 'ega', 'po']} rect={picker.rect} title="Tag outcomes" selected={pil.tags} onClose={() => setPicker(null)}
          onToggle={(t) => updRow(picker.row, (x) => { const il = x.ilos.find((y) => y.id === picker.ilo); if (il) il.tags = il.tags.includes(t) ? il.tags.filter((v) => v !== t) : [...il.tags, t]; })} />
      )}
    </div>
  );
}
