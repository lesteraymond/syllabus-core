import { Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';
import { FILTER_ABOVE, filterItems, jumpIndex, moveActive, nextQuery } from '../lib/selectModel';

// A dropdown with the same props as <select>: value, defaultValue, onChange, disabled, id, className, name, aria-*, and ordinary
// <option value>label</option> children. onChange receives { target: { value, name } } with the value as a string, as a native event does,
// so existing handlers that read event.target.value keep working unchanged.
//
// The open list is drawn here (a rounded panel with a check on the chosen option) instead of by the operating system.
// Focus never leaves the button: it is a "select-only combobox", and the highlighted option is announced with aria-activedescendant.
// Lists longer than FILTER_ABOVE filter as you type; shorter ones jump to the match. On touch screens the native picker is used, because
// the system's own list is the better control there.

const MAX_PANEL = 280;
const GAP = 4;
const EDGE = 8;

function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return isValidElement(node) ? textOf(node.props.children) : '';
}

// <option> children (also inside fragments and arrays) -> [{ value, label, disabled, lang }]. An option without a value attribute uses its text.
export function readOptions(children) {
  const out = [];
  const walk = (nodes) => Children.forEach(nodes, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) return walk(child.props.children);
    if (child.type === 'optgroup') return walk(child.props.children);
    if (child.type !== 'option') return;
    const label = textOf(child.props.children);
    out.push({ value: String(child.props.value ?? label), label, disabled: !!child.props.disabled, lang: child.props.lang });
  });
  walk(children);
  return out;
}

const subscribeCoarse = (listener) => {
  const query = window.matchMedia('(pointer: coarse)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};
const isCoarse = () => (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

export default function Select({ value, defaultValue, onChange, disabled = false, id, className = '', name, children, ...rest }) {
  const uid = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const typedAt = useRef(0);
  const buffer = useRef('');                       // what was typed on the closed button (short lists)
  const items = readOptions(children);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue !== undefined ? String(defaultValue) : (items[0] ? items[0].value : ''));
  const current = controlled ? String(value ?? '') : inner;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);          // a position in `shown`
  const [place, setPlace] = useState(null);
  const coarse = useSyncExternalStore(typeof window !== 'undefined' && window.matchMedia ? subscribeCoarse : () => () => {}, isCoarse, () => false);

  const filtering = items.length > FILTER_ABOVE;
  const shown = filtering ? filterItems(items, query) : items.map((item, index) => ({ ...item, index }));
  const selectedIndex = items.findIndex((item) => item.value === current);
  const label = selectedIndex >= 0 ? items[selectedIndex].label : '';
  const listId = uid + '-list';
  const optionId = (position) => uid + '-o-' + position;

  const close = () => { setOpen(false); setQuery(''); };
  const openList = (seed = '') => {
    if (disabled) return;
    const at = shown.findIndex((item) => item.index === selectedIndex && !item.disabled);
    setActive(at >= 0 ? at : moveActive(shown, -1, 'ArrowDown'));
    setQuery(seed);
    setOpen(true);
  };
  const choose = (item) => {
    if (!item || item.disabled) return;
    if (!controlled) setInner(item.value);
    if (onChange) onChange({ target: { value: item.value, name }, currentTarget: { value: item.value, name } });
    close();
  };

  // The panel hangs from the button, or from above it when there is more room there. It is fixed to the window and sits above modals.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - EDGE - GAP;
    const above = rect.top - EDGE - GAP;
    const down = below >= Math.min(MAX_PANEL, 160) || below >= above;
    setPlace({ left: rect.left, minWidth: rect.width, maxWidth: Math.max(rect.width, window.innerWidth - rect.left - EDGE),
      maxHeight: Math.max(96, Math.min(MAX_PANEL, down ? below : above)), ...(down ? { top: rect.bottom + GAP } : { bottom: window.innerHeight - rect.top + GAP }) });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) close(); };
    const away = (e) => { if (!panelRef.current?.contains(e.target)) close(); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', away, true);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('scroll', away, true); window.removeEventListener('resize', close); };
  }, [open]);

  useEffect(() => {
    if (open && panelRef.current) { const el = panelRef.current.querySelector('[data-active="true"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
  }, [open, active, query]);

  const onKeyDown = (e) => {
    if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key;
    const printable = key.length === 1 && !(key === ' ' && !query);
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') { e.preventDefault(); openList(); }
      else if (printable) {
        e.preventDefault();
        if (filtering) { typedAt.current = Date.now(); openList(key); return; }    // a long list opens, already filtered by the letter
        const now = Date.now();                                                    // a short list changes the choice without opening, as a native one does
        buffer.current = nextQuery(buffer.current, key, { now, lastAt: typedAt.current });
        typedAt.current = now;
        const to = jumpIndex(items, selectedIndex, buffer.current);
        if (to >= 0 && to !== selectedIndex) choose(items[to]);
      }
      return;
    }
    if (key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (query) setQuery(''); else close(); return; }   // closes the list, not the dialog around it
    if (key === 'Tab') { close(); return; }
    if (key === 'Enter' || (key === ' ' && !query)) { e.preventDefault(); choose(shown[active]); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(key)) { e.preventDefault(); setActive(moveActive(shown, active, key)); return; }
    if (key === 'Backspace' || printable) {
      e.preventDefault();
      const now = Date.now();
      const q = nextQuery(query, key, { now, lastAt: typedAt.current });
      typedAt.current = now;
      setQuery(q);
      if (filtering) setActive(moveActive(filterItems(items, q), -1, 'ArrowDown'));
      else { const to = jumpIndex(shown, active, q); if (to >= 0) setActive(to); }
    }
  };

  if (coarse) {
    return <select value={controlled ? value : undefined} defaultValue={controlled ? undefined : defaultValue} onChange={onChange} disabled={disabled} id={id} className={className} name={name} {...rest}>{children}</select>;
  }

  return (
    <div className="select">
      <button type="button" id={id} ref={triggerRef} role="combobox" disabled={disabled} className={'select-trigger ' + className}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        onClick={() => (open ? close() : openList())} onKeyDown={onKeyDown} {...rest}>
        <span className="select-value">
          <span className="select-current" lang={selectedIndex >= 0 ? items[selectedIndex].lang : undefined}>{label}</span>
          <span className="select-sizer" aria-hidden="true">{items.map((item) => <span key={item.value} data-value={item.value} lang={item.lang}>{item.label}</span>)}</span>
        </span>
        <svg className="select-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      {open && place && createPortal(
        <div className="select-panel" ref={panelRef} style={place}>
          {filtering && <div className="select-hint" aria-hidden="true">{query ? t('select.filtering', { query }) : t('select.typeToFilter')}</div>}
          <ul role="listbox" id={listId} className="select-list" aria-label={rest['aria-label']}>
            {shown.map((item, position) => (
              <li key={item.index} id={optionId(position)} lang={item.lang} role="option" aria-selected={item.index === selectedIndex} aria-disabled={item.disabled || undefined}
                data-active={position === active} className={'select-option' + (item.index === selectedIndex ? ' is-selected' : '') + (item.disabled ? ' is-disabled' : '')}
                onMouseDown={(e) => e.preventDefault()} onMouseMove={() => { if (!item.disabled && active !== position) setActive(position); }} onClick={() => choose(item)}>
                <span>{item.label}</span>
                {item.index === selectedIndex && <svg className="select-check" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </li>
            ))}
            {shown.length === 0 && <li className="select-empty" role="presentation">{t('select.noMatches')}</li>}
          </ul>
        </div>, document.body)}
    </div>
  );
}
