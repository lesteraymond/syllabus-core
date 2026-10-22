import { tr } from "../../i18n/index.js";
import { t as translateUI } from "../../i18n/index.js";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const PATHS = {
  up: 'M8 13V3M4 7l4-4 4 4', down: 'M8 3v10M4 9l4 4 4-4', copy: 'M5.5 5.5h7v7h-7zM3.5 10.5v-7h7',
  x: 'M4 4l8 8M12 4l-8 8', lock: 'M4.5 7.5h7v5.5h-7zM6 7.5V5.5a2 2 0 014 0v2',
};
export function Ic({ n }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[n]} /></svg>;
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A textarea that grows with its content.
export function Auto({ value, onChange, className = 'cell', placeholder = '', label, fid, onKeyDown, readOnly = false }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return <textarea ref={ref} rows="1" className={className} value={value} placeholder={placeholder} readOnly={readOnly || undefined} aria-readonly={readOnly || undefined} aria-label={label || placeholder || translateUI("ui.text_c3328c")} data-fid={fid} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />;
}

// The code block of an outcome reference ("CLO 4", "EGA 2", "PO 3"). A CLO carries its own hue; EGA and PO are neutral.
// `info` always comes from model.tagInfo(), so every reference in the builder is labelled the same way.
export function Code({ info, size }) {
  return <span className={'code' + (size ? ' ' + size : '') + (info.kind === 'clo' ? ' k' + (info.idx % 6) : ' ref')}>{tr(info.label)}</span>;
}

// Code + name, with the full statement on hover. Unresolvable tags render in the warning style (name struck through).
export function Tag({ info, onRemove }) {
  const tip = info.label + ' – ' + (info.text || info.name);
  return (
    <span className={'tagc' + (info.ok ? '' : ' bad')} title={tip}>
      <Code info={info} />{' '}
      <span className="nm">{info.name}</span>
      {onRemove && <button type="button" aria-label={translateUI("ui.remove_1680e3") + info.label} onClick={(e) => { e.stopPropagation(); onRemove(); }}>{'×'}</button>}
    </span>
  );
}

// One picker for CLO, EGA and PO tags, searchable by name, number or statement.
export function OutcomePicker({ model, d, kinds, rect, title, selected, onToggle, onClose }) {
  const ref = useRef(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const input = ref.current && ref.current.querySelector('input[type="search"]');
    if (input) input.focus();
    const out = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', out);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', out);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', onClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ql = q.trim().toLowerCase();
  const mk = (tag) => ({ tag, info: model.tagInfo(d, tag) });
  const pos = model.poList(d);
  const groups = [];
  if (kinds.includes('clo')) groups.push({ kind: 'clo', title: 'Course learning outcomes', items: d.clos.map((c) => mk('clo:' + c.id)) });
  if (kinds.includes('ega')) groups.push({ kind: 'ega', title: 'Expected graduate attributes', items: model.egaList(d).map((e) => mk('ega:' + e.no)) });
  if (kinds.includes('po')) groups.push({ kind: 'po', title: 'Program outcomes · ' + d.meta.program, items: pos.map((o) => mk('po:' + o.no)) });
  groups.forEach((g) => { g.items = g.items.filter((it) => !ql || (it.info.label + ' ' + it.info.name + ' ' + it.info.text).toLowerCase().includes(ql)); });

  const h = Math.min(380, window.innerHeight - 24);
  const top = rect.bottom + 6;
  const style = { left: Math.max(8, Math.min(rect.left, window.innerWidth - 388)), width: 380, maxHeight: h };
  if (top + h > window.innerHeight) style.bottom = Math.max(8, window.innerHeight - rect.top + 6); else style.top = top;
  const any = groups.some((g) => g.items.length);

  return (
    <div className="bld2-pop" ref={ref} style={style} role="dialog" aria-label={title || translateUI("ui.tag_outcomes_9af691")}>
      <input type="search" className="in" value={q} placeholder={translateUI("ui.search_by_name_or_number_63632c")} aria-label={translateUI("ui.search_outcomes_3d2fd6")} onChange={(e) => setQ(e.target.value)} />
      {groups.filter((g) => !ql || g.items.length).map((g) => (
        <div key={g.kind}>
          <h4>{tr(g.title)}</h4>
          {g.items.length ? g.items.map((it) => (
            <label key={it.tag} className="opt">
              <input type="checkbox" checked={selected.includes(it.tag)} onChange={() => onToggle(it.tag)} />
              <Code info={it.info} />
              <span><span className="on">{it.info.name}</span>{it.info.text && it.info.text !== it.info.name && <span className="ot">{it.info.text}</span>}</span>
            </label>
          )) : <div className="none">{g.kind === 'po' && !pos.length ? translateUI("ui.no_program_outcomes_loaded_for_23e032") + (d.meta.program || tr('this program')) + '.' : (g.kind === 'clo' && !d.clos.length ? tr('No CLOs yet. Add them in step 2.') : tr('No match.'))}</div>}
        </div>
      ))}
      {!any && q && <div className="none">{translateUI("ui.nothing_matches_019f8e")}{'“'}{q}{'”'}.</div>}
    </div>
  );
}

// One card per CLO: the weeks it is built in as an 18-week ruler, or "Not covered yet". Clicking a card picks it.
export function CoverageStrip({ model, d, filter, onPick }) {
  const cov = model.coverage(d);
  if (!cov.length) return null;
  return (
    <div className="cov" role="group" aria-label={translateUI("ui.clo_coverage_98ba99")}>
      {cov.map((c, i) => {
        const clo = d.clos[i];
        const on = filter === c.id;
        const ws = {};
        c.weeks.forEach((w) => { ws[w] = 1; });
        return (
          <button type="button" key={c.id} className={'cv' + (on ? ' on' : '')} aria-pressed={on} onClick={() => onPick(c.id)}>
            <span className="t"><span className={'code k' + (i % 6)}>{translateUI("ui.clo_069efc") + (i + 1)}</span><span className="ti">{clo.title || translateUI("ui.untitled_621521")}</span></span>
            <span className={'w' + (c.rows.length ? '' : ' none')}>{c.rows.length ? tr(c.weeks.length + (c.weeks.length === 1 ? ' week' : ' weeks') + ' · ' + c.rows.length + (c.rows.length === 1 ? ' row' : ' rows')) : translateUI("ui.not_covered_yet_3a7d66")}</span>
            <span>
              <span className="ruler" aria-hidden="true">{Array.from({ length: 18 }, (_, k) => <i key={k + 1} className={ws[k + 1] ? 'k' + (i % 6) : ''} />)}</span>
              <span className="rulerlbl" aria-hidden="true"><span>{translateUI("ui.wk_1_474a85")}</span><span>18</span></span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
