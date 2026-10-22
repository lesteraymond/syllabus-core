import StableButton from '../../components/StableButton';
import { t as translateUI } from "../../i18n/index.js";
import { useState } from 'react';
import { clone, renderMarkup, weekSet } from '../../lib/syllabusModel';
import { CORE_VALUES, hasCoreValue, toggleCoreValue } from '../../lib/coreValues';
import { Auto, CoverageStrip, Ic, OutcomePicker, Tag } from './parts';
import { newId } from './useDraft';
import Select from '../../components/Select';
import { Icon } from '../../components/ui';

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
            ? <><span>{translateUI("ui.showing_85a4af") + shown.length + translateUI("ui.of_607f2d") + d.plan.length + translateUI("ui.rows_that_build_fd23e7")}</span><Tag info={model.tagInfo(d, 'clo:' + filter)} /><button type="button" className="link" onClick={() => setFilter(null)}>{translateUI("ui.clear_filter_b667d6")}</button></>
            : <span><span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{weeks + translateUI("ui.of_18_7cd558")}</span>{translateUI("ui.weeks_covered_use_f7d2f0")}<span className="mono">-</span>{translateUI("ui.for_bullets_and_58b7a5")}<span className="mono">{translateUI("ui.bold_40b7d4")}</span>{translateUI("ui.for_labels_b0d83a")}</span>}
        </div>
        <div className="seg" role="group" aria-label={translateUI("ui.cell_view_163f49")}>
          <button type="button" aria-pressed={edit} onClick={() => setMode('edit')}>{translateUI("ui.edit_530164")}</button>
          <button type="button" aria-pressed={!edit} onClick={() => setMode('fmt')}>{translateUI("ui.formatted_f26356")}</button>
        </div>
      </div>
      <div className="scroll">
        <table className="ledger plan">
          <colgroup><col style={{ width: '96px' }} /><col style={{ width: '31%' }} /><col style={{ width: '14%' }} /><col style={{ width: '17%' }} /><col style={{ width: '15%' }} /><col /></colgroup>
          <thead><tr><th>{translateUI("ui.week_f82be6")}</th><th>{translateUI("plan.heading.ilo")}</th><th>{translateUI("plan.heading.contents")}</th><th>{translateUI("plan.heading.activities")}</th><th>{translateUI("plan.heading.tasks")}</th><th>{translateUI("plan.heading.values")}</th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const full = d.plan.findIndex((y) => y.id === r.id);
              const exam = r.kind === 'exam';
              return (
                <tr key={r.id} className={exam ? 'exam' : ''} data-plan-row={full}>
                  <td>
                    <div className="wkc">
                      {edit
                        ? <input className="cell" value={r.week} data-fid={r.id} aria-label={translateUI("ui.week_f82be6")} placeholder={translateUI("ui.week_f82be6")} onChange={(e) => { const v = e.target.value; updRow(r.id, (x) => { x.week = v; }); }} />
                        : <div className="fmt mono" style={{ fontWeight: 600 }}>{translateUI("ui.wk_1e49a0") + r.week}</div>}
                      {edit && <Select className="kind" value={r.kind} aria-label={translateUI("ui.row_type_91d899")} onChange={(e) => { const v = e.target.value; updRow(r.id, (x) => { x.kind = v; }); }}><option value="lesson">{translateUI("ui.lesson_0bb7c8")}</option><option value="exam">{translateUI("ui.exam_c7e542")}</option></Select>}
                      {edit && (
                        <div className="racts">
                          <button type="button" className="ib" aria-label={translateUI("ui.move_up_b4f57c")} disabled={full === 0} onClick={() => move(r.id, -1)}><Ic n="up" /></button>
                          <button type="button" className="ib" aria-label={translateUI("ui.move_down_260ff8")} disabled={full === d.plan.length - 1} onClick={() => move(r.id, 1)}><Ic n="down" /></button>
                          <button type="button" className="ib" aria-label={translateUI("ui.duplicate_row_d66d5f")} onClick={() => apply((x) => { const c = clone(r); c.id = newId(); c.week = ''; c.ilos.forEach((il) => { il.id = newId(); }); x.plan.splice(full + 1, 0, c); return x; })}><Ic n="copy" /></button>
                          <button type="button" className="ib del" aria-label={translateUI("ui.delete_row_fcf3f8")} onClick={() => onDeleteRow(r.id)}><Icon name="bin" size={16} /></button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {exam
                      ? (edit
                        ? <Auto value={r.ilos[0] ? r.ilos[0].text : ''} placeholder={translateUI("ui.review_of_topics_235cbc")} label={translateUI("ui.review_topics_520343")} onChange={(v) => updRow(r.id, (x) => { if (!x.ilos[0]) x.ilos.push(newIlo()); x.ilos[0].text = v; })} />
                        : <Formatted text={r.ilos[0] ? r.ilos[0].text : ''} />)
                      : <>
                        {r.ilos.map((il, j) => (
                          <div className="ilo" key={il.id}>
                            <span className="lb">{translateUI("ui.ilo_080517") + (j + 1)}</span>
                            {edit
                              ? <Auto value={il.text} placeholder={translateUI("ui.start_with_a_verb_6b1d63")} label={translateUI("ui.ilo_f12fa1") + (j + 1) + translateUI("ui.of_week_60075b") + r.week} onChange={(v) => updRow(r.id, (x) => { x.ilos[j].text = v; })} />
                              : <div className="fmt typed-text">{il.text || '—'}</div>}
                            <div className="tagrow">
                              {il.tags.map((t) => <Tag key={t} info={model.tagInfo(d, t)} onRemove={edit ? () => updRow(r.id, (x) => { x.ilos[j].tags = x.ilos[j].tags.filter((v) => v !== t); }) : null} />)}
                              {edit && <button type="button" className="tagbtn" aria-label={translateUI("ui.tag_outcomes_for_ilo_5f768a") + (j + 1)} onClick={(e) => setPicker({ row: r.id, ilo: il.id, rect: e.currentTarget.getBoundingClientRect() })}>{translateUI("ui.tag_eae765")}</button>}
                              {edit && r.ilos.length > 1 && <button type="button" className="ib del" aria-label={translateUI("ui.remove_ilo_4d0e7b")} onClick={() => updRow(r.id, (x) => { x.ilos.splice(j, 1); })}><Ic n="x" /></button>}
                            </div>
                          </div>
                        ))}
                        {edit && <button type="button" className="link" onClick={() => updRow(r.id, (x) => { x.ilos.push(newIlo()); })}>{translateUI("ui.ilo_b41960")}</button>}
                      </>}
                  </td>
                  {CELLS.map(([f, ph]) => (
                    <td key={f}>{edit
                      ? <Auto value={r[f]} placeholder={ph} label={f + translateUI("ui.of_week_60075b") + r.week} onChange={(v) => updRow(r.id, (x) => { x[f] = v; })} />
                      : <Formatted text={r[f]} />}
                      {edit && f === 'values' && !exam && (
                        <div className="valchips">
                          {CORE_VALUES.map((v) => <button type="button" key={v.key} className="valchip" aria-pressed={hasCoreValue(r.values, v)} onClick={() => updRow(r.id, (x) => { x.values = toggleCoreValue(x.values, v); })}>{v.name}</button>)}
                        </div>
                      )}</td>
                  ))}
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan="6" style={{ padding: 24, color: 'var(--muted)' }}>{filter ? translateUI("ui.no_rows_build_this_clo_yet_tag_an_ilo_with_it_or_clear_the_filter_f917f8") : translateUI("ui.no_rows_yet_a2e4b6")}</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <div className="addrow"><StableButton type="button" className="btn outline" onClick={() => addRow('lesson')}>{translateUI("ui.add_week_3a833d")}</StableButton><StableButton type="button" className="btn outline" onClick={() => addRow('exam')}>{translateUI("ui.add_exam_row_19d3c0")}</StableButton></div>}
      {picker && pil && (
        <OutcomePicker model={model} d={d} kinds={['clo', 'ega', 'po']} rect={picker.rect} title={translateUI("ui.tag_outcomes_9af691")} selected={pil.tags} onClose={() => setPicker(null)}
          onToggle={(t) => updRow(picker.row, (x) => { const il = x.ilos.find((y) => y.id === picker.ilo); if (il) il.tags = il.tags.includes(t) ? il.tags.filter((v) => v !== t) : [...il.tags, t]; })} />
      )}
    </div>
  );
}
