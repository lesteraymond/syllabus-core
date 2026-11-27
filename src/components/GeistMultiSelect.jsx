import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t as translateUI } from '../i18n/index.js';

// Vercel Geist Multi Select: pick multiple values from a fixed list.
// Rules followed:
// - Trigger shows placeholder when 0 selected, exact single label when 1 selected, count when 2+ selected.
// - Menu uses `material-menu` elevation portaled to document.body (never clipped by overflow).
// - Keyboard: ArrowUp/Down move between rows preserving checkbox vs action focus; ArrowLeft/Right switch
//   between checkbox and "Only" action; Enter/Space executes active focus; Esc closes and restores focus.
export default function GeistMultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = '',
  ariaLabel,
  disabled = false,
  className = '',
}) {
  const uid = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 });
  const [focusRow, setFocusRow] = useState(0);
  const [focusCol, setFocusCol] = useState('check'); // 'check' | 'only'

  const selected = Array.isArray(value) ? value : [];
  const selectedSet = new Set(selected);

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label || selected[0])
        : translateUI('multiSelect.selectedCount', { count: selected.length });

  const toggle = (val) => {
    const next = selectedSet.has(val)
      ? selected.filter((v) => v !== val)
      : [...selected, val];
    onChange?.(next);
  };

  const selectOnly = (val) => {
    onChange?.([val]);
  };

  const clearAll = () => {
    onChange?.([]);
  };

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 220);
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    setPos({ top: r.bottom + 6, left: Math.min(r.left, maxLeft), width });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const sel = focusCol === 'only'
      ? `[data-ms-row="${focusRow}"] [data-ms-only]`
      : `[data-ms-row="${focusRow}"] [data-ms-check]`;
    panelRef.current.querySelector(sel)?.focus();
  }, [open, focusRow, focusCol]);

  const onMenuKeyDown = (e) => {
    if (!options.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusRow((r) => (r + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusRow((r) => (r - 1 + options.length) % options.length);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setFocusCol('only');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setFocusCol('check');
    }
  };

  return (
    <div className={['geist-ms', open ? 'is-open' : '', className].filter(Boolean).join(' ')}>
      <button
        ref={triggerRef}
        type="button"
        className="select-trigger geist-ms-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        onClick={() => {
          setFocusRow(0);
          setFocusCol('check');
          setOpen((o) => !o);
        }}
      >
        <span className={'geist-ms-value' + (selected.length === 0 ? ' is-placeholder' : '')}>{triggerLabel}</span>
        {selected.length > 0 && <span className="geist-ms-badge" aria-hidden="true">{selected.length}</span>}
        <svg className="select-chevron" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4.5 6.5 8 10l3.5-3.5" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          id={`${uid}-list`}
          className="geist-ms-panel material-menu"
          role="listbox"
          aria-multiselectable="true"
          aria-label={ariaLabel}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          onKeyDown={onMenuKeyDown}
        >
          <div className="geist-ms-list">
            {options.map((opt, idx) => {
              const checked = selectedSet.has(opt.value);
              return (
                <div
                  key={opt.value}
                  data-ms-row={idx}
                  role="option"
                  aria-selected={checked}
                  className={'geist-ms-row' + (checked ? ' is-selected' : '')}
                >
                  <button
                    type="button"
                    data-ms-check=""
                    className="geist-ms-item"
                    onFocus={() => { setFocusRow(idx); setFocusCol('check'); }}
                    onClick={() => toggle(opt.value)}
                  >
                    <span className={'geist-ms-box' + (checked ? ' is-checked' : '')} aria-hidden="true">
                      {checked && (
                        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.2 6.2 4.8 8.8 9.8 3.4" />
                        </svg>
                      )}
                    </span>
                    <span className="geist-ms-label">{opt.label}</span>
                  </button>
                  <button
                    type="button"
                    data-ms-only=""
                    className="geist-ms-only"
                    onFocus={() => { setFocusRow(idx); setFocusCol('only'); }}
                    onClick={() => selectOnly(opt.value)}
                  >
                    {translateUI('multiSelect.only')}
                  </button>
                </div>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="geist-ms-foot">
              <button type="button" className="geist-ms-clear" onClick={clearAll}>
                {translateUI('multiSelect.clear')}
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
