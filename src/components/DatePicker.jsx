import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getLocale, t } from '../i18n';
import { phDate, phDateTime } from '../lib/phTime';
import { DEFAULT_TIME, addMonths, clampDay, dateKey, formatValue, isOutOfRange, monthGrid, moveDay, parseTime, parseValue, timeValue, todayPH } from '../lib/datePickerModel';

// A date field with the same props as <input type="date"> and <input type="datetime-local"> (type, value, onChange, min, max, disabled,
// required, id, name, aria-*). onChange receives { target: { value, name } } with the same string a native input gives, so existing
// handlers that read event.target.value keep working unchanged.
//
// The calendar is drawn here, in the look of the Select dropdown, instead of by the browser. Days and "today" are Philippine time, like the
// rest of the app. The rules (month grid, keys, limits) are in lib/datePickerModel.js. On touch screens the native control is used, because
// the system's own picker is the better control there.

const PANEL_WIDTH = 296;
const PANEL_HEIGHT = 384; // with the time row; used only to decide whether the panel opens below or above
const GAP = 4;
const EDGE = 8;

const subscribeCoarse = (listener) => {
  const query = window.matchMedia('(pointer: coarse)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};
const isCoarse = () => (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const fmt = (opts) => new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC', ...opts });

function Chevron({ dir }) {
  return <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d={dir === 'left' ? 'M10 3.5L5.5 8l4.5 4.5' : 'M6 3.5L10.5 8 6 12.5'} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function DatePicker({ value = '', onChange, min, max, disabled = false, required = false, id, name, type = 'date', className = '', ...rest }) {
  const uid = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const withTime = type === 'datetime-local';
  const parsed = parseValue(value);
  const hasTime = !!parsed && parsed.hh !== null;
  const today = todayPH();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: today.y, m: today.m });   // the month on show
  const [cursor, setCursor] = useState(null);                       // the day the keys are on
  const [place, setPlace] = useState(null);
  const coarse = useSyncExternalStore(typeof window !== 'undefined' && window.matchMedia ? subscribeCoarse : () => () => {}, isCoarse, () => false);

  const grid = useMemo(() => monthGrid(view.y, view.m), [view.y, view.m]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ short: fmt({ weekday: 'narrow' }).format(utc(2023, 1, 1 + i)), long: fmt({ weekday: 'long' }).format(utc(2023, 1, 1 + i)) })), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = fmt({ month: 'long', year: 'numeric' }).format(utc(view.y, view.m, 1));
  const label = parsed ? (withTime && hasTime ? phDateTime(value) : phDate(value)) : '';

  const close = (refocus = false) => { setOpen(false); if (refocus && triggerRef.current) triggerRef.current.focus(); };
  const openPanel = () => {
    if (disabled) return;
    const start = clampDay(parsed ? { y: parsed.y, m: parsed.m, d: parsed.d } : today, min, max);
    setView({ y: start.y, m: start.m });
    setCursor(start);
    setOpen(true);
  };

  const emit = (next) => { if (onChange) onChange({ target: { value: next, name }, currentTarget: { value: next, name } }); };
  const time = hasTime ? { hh: parsed.hh, mm: parsed.mm } : DEFAULT_TIME;
  const pick = (day) => {
    if (isOutOfRange(day, min, max)) return;
    emit(formatValue(day, time, withTime));
    setCursor(day);
    if (!withTime) close(true);
  };
  const changeTime = (text) => {
    const next = parseTime(text);
    if (!next) return;
    const day = parsed ? { y: parsed.y, m: parsed.m, d: parsed.d } : clampDay(cursor || today, min, max);
    emit(formatValue(day, next, true));
  };

  // The panel hangs from the field, or from above it when there is more room there. It is fixed to the window and sits above modals.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - EDGE - GAP;
    const above = rect.top - EDGE - GAP;
    const down = below >= PANEL_HEIGHT || below >= above;
    const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - EDGE));
    setPlace({ left, width: Math.min(PANEL_WIDTH, window.innerWidth - EDGE * 2), ...(down ? { top: rect.bottom + GAP } : { bottom: window.innerHeight - rect.top + GAP }) });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) close(); };
    const away = (e) => { if (!panelRef.current?.contains(e.target)) close(); };
    const hide = () => close();
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', away, true);
    window.addEventListener('resize', hide);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('scroll', away, true); window.removeEventListener('resize', hide); };
  }, [open]);

  // Focus is on the day the keys are on: when the panel opens, and after an arrow key moves it.
  useEffect(() => {
    if (!open || !place || !panelRef.current || !cursor) return;
    const el = panelRef.current.querySelector('[data-key="' + dateKey(cursor) + '"]');
    if (el) el.focus({ preventScroll: true });
  }, [open, place, cursor]);

  const onTriggerKey = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (open) close(); else openPanel(); }
  };

  // Keys inside the panel. Esc and Tab never reach the dialog around the field: Esc closes the calendar only, Tab stays inside it.
  const onPanelKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key === 'Tab') {
      e.stopPropagation();
      const items = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter((el) => el.tabIndex >= 0);
      if (!items.length) return;
      const at = items.indexOf(document.activeElement);
      const next = items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length];
      e.preventDefault();
      next.focus();
    }
  };
  const onGridKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !cursor) return;
    const next = moveDay(cursor, e.key);
    if (!next) return;
    e.preventDefault();
    const bounded = clampDay(next, min, max);
    setCursor(bounded);
    if (bounded.y !== view.y || bounded.m !== view.m) setView({ y: bounded.y, m: bounded.m });
  };
  const step = (n) => {
    const to = addMonths({ y: view.y, m: view.m, d: 1 }, n);
    setView({ y: to.y, m: to.m });
    setCursor(clampDay(addMonths(cursor || { y: view.y, m: view.m, d: 1 }, n), min, max));
  };

  if (coarse) {
    return <input type={type} value={value} onChange={onChange} min={min} max={max} disabled={disabled} required={required} id={id} name={name} className={className} {...rest} />;
  }

  const listId = uid + '-cal';
  const gridFocus = cursor ? dateKey(cursor) : '';
  return (
    <div className="select dp">
      <button type="button" id={id} ref={triggerRef} disabled={disabled} className={'select-trigger dp-trigger ' + className}
        data-type={type} data-value={value || ''} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openPanel())} onKeyDown={onTriggerKey} {...rest}>
        <span className={'dp-value' + (label ? '' : ' is-empty')}>{label || t(withTime ? 'date.chooseDateTime' : 'date.choose')}</span>
        <svg className="dp-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><rect x="2" y="3.2" width="12" height="10.6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M2 6.6h12M5.2 1.8v2.6M10.8 1.8v2.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
      {name && <input type="hidden" name={name} value={value || ''} />}
      {required && <input className="dp-required" tabIndex={-1} aria-hidden="true" required value={value || ''} onChange={() => {}} onFocus={() => triggerRef.current && triggerRef.current.focus()} />}
      {open && place && createPortal(
        <div className="select-panel dp-panel" id={listId} ref={panelRef} style={place} role="dialog" aria-label={title} onKeyDown={onPanelKey}>
          <div className="dp-head">
            <button type="button" className="dp-nav" aria-label={t('date.prevMonth')} onClick={() => step(-1)}><Chevron dir="left" /></button>
            <strong className="dp-title" aria-live="polite">{title}</strong>
            <button type="button" className="dp-nav" aria-label={t('date.nextMonth')} onClick={() => step(1)}><Chevron dir="right" /></button>
          </div>
          <div className="dp-grid" role="grid" aria-label={title} onKeyDown={onGridKey}>
            <div className="dp-week" role="row">{weekdays.map((w) => <span key={w.long} role="columnheader" aria-label={w.long}>{w.short}</span>)}</div>
            {grid.map((week) => (
              <div className="dp-row" role="row" key={week[0].key}>
                {week.map((c) => {
                  const off = isOutOfRange(c, min, max);
                  const selected = !!parsed && parsed.y === c.y && parsed.m === c.m && parsed.d === c.d;
                  const isToday = today.y === c.y && today.m === c.m && today.d === c.d;
                  return (
                    <button type="button" role="gridcell" key={c.key} data-key={c.key} disabled={off} tabIndex={c.key === gridFocus ? 0 : -1}
                      aria-selected={selected} aria-current={isToday ? 'date' : undefined}
                      aria-label={fmt({ dateStyle: 'full' }).format(utc(c.y, c.m, c.d))}
                      className={'dp-day' + (c.outside ? ' is-outside' : '') + (selected ? ' is-selected' : '') + (isToday ? ' is-today' : '')}
                      onClick={() => pick(c)}>{c.d}</button>
                  );
                })}
              </div>
            ))}
          </div>
          {withTime && (
            <label className="dp-time"><span>{t('date.time')}</span>
              <input type="time" value={timeValue(time)} onChange={(e) => changeTime(e.target.value)} />
            </label>
          )}
          <div className="dp-foot">
            <button type="button" className="dp-link" disabled={isOutOfRange(today, min, max)} onClick={() => { pick(today); setView({ y: today.y, m: today.m }); }}>{t('date.today')}</button>
            {!required && value && <button type="button" className="dp-link" onClick={() => { emit(''); close(true); }}>{t('date.clear')}</button>}
            {withTime && <button type="button" className="btn primary dp-done" onClick={() => close(true)}>{t('date.done')}</button>}
          </div>
        </div>, document.body)}
    </div>
  );
}
