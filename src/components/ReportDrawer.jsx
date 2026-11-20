import { useEffect, useRef, useState } from 'react';
import { t as translateUI } from '../i18n/index.js';
import { useModalLayer } from './useModalLayer';

const SLIDE_MS = 260;
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// A report that slides in from the right edge and slides back out to the right when it is closed. It opens at a comfortable reading width; the
// arrow button stretches it toward the left to the full width of the window (and back), so a long report can be read without leaving the page.
// Esc, the backdrop and the X close it; focus stays inside while it is open and returns to the button that opened it (useModalLayer, the same
// layer the dialogs use).
//   title / subtitle   the heading lines      footer   buttons under the report (or a function that gets the closing function)      onClose   called once it has slid away
//   closeDisabled      true while something inside is busy (closing is then refused)  panelClass   an extra class on the panel
export default function ReportDrawer({ title, subtitle, footer, onClose, closeDisabled = false, busy = false, panelClass = '', children }) {
  const dialog = useRef(null);
  const timer = useRef(null);
  const [wide, setWide] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = () => {
    if (closeDisabled || leaving) return;
    if (reduced()) { onClose(); return; }
    setLeaving(true);
    timer.current = setTimeout(onClose, SLIDE_MS);
  };
  useModalLayer(dialog, close); // Esc closes, focus stays inside and returns to the button that opened it
  const label = translateUI(wide ? 'aiChecker.collapse' : 'aiChecker.expand');
  return (
    <div className={'overlay rd-overlay' + (leaving ? ' is-leaving' : '')} onClick={close}>
      <div className={'rd-panel' + (wide ? ' is-wide' : '') + (panelClass ? ' ' + panelClass : '')} role="dialog" aria-modal="true" aria-labelledby="rd-title" aria-busy={busy || undefined} tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
        <div className="rd-head">
          <button type="button" className="icon-btn rd-expand" onClick={() => setWide((w) => !w)} aria-pressed={wide} aria-label={label} title={label}>{wide ? '→' : '←'}</button>
          <div className="rd-title">
            <h3 id="rd-title">{title}</h3>
            {subtitle}
          </div>
          <button type="button" className="icon-btn rd-x" onClick={close} disabled={closeDisabled} aria-label={translateUI('ui.close_report_12dfcd')} title={translateUI('ui.close_report_12dfcd')}>✕</button>
        </div>
        <div className="rd-body">{children}</div>
        {footer && <div className="rd-foot">{typeof footer === 'function' ? footer(close) : footer}</div>}
      </div>
    </div>
  );
}
