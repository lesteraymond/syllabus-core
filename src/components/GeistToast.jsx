import { useEffect, useRef, useState } from 'react';
import { tr, t as translateUI } from '../i18n/index.js';
import { Icon } from './ui';

// Infers a Geist toast tone when a caller passes a plain message string to notify().
export function inferToastType(text) {
  const s = String(text || '').toLowerCase();
  if (!s) return 'default';
  if (/(fail|error|unable|could not|invalid|refus|denied|blocked|only draft|cannot|hindi |bigo|mali)/.test(s)) return 'error';
  if (/(warn|expired|missing|required|must |please |paki)/.test(s)) return 'warning';
  if (/(saved|submitted|approved|published|updated|cleared|deleted|removed|copied|sent|created|ready|added|na-save|naipasa|naaprubahan|na-delete)/.test(s)) return 'success';
  return 'default';
}

const VARIANT_ICON = {
  success: 'checkCircle',
  warning: 'warning',
  error: 'xCircle',
};

export function GeistToastCard({
  text,
  type = 'default',
  action = null,
  onDismiss,
  className = '',
  style,
  index = 0,
}) {
  const tone = type || 'default';
  const iconName = VARIANT_ICON[tone] || null;
  const role = tone === 'error' ? 'alert' : 'status';

  return (
    <div
      className={['geist-toast', `is-${tone}`, className].filter(Boolean).join(' ')}
      style={style}
      role={role}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      data-index={index}
    >
      {iconName && (
        <span className="geist-toast-ico" aria-hidden="true">
          <Icon name={iconName} size={16} />
        </span>
      )}
      <span className="geist-toast-msg">{tr(text)}</span>
      {action && (
        <button
          type="button"
          className="geist-toast-action"
          onClick={() => { action.fn?.(); if (action.dismiss !== false) onDismiss?.(); }}
        >
          {tr(action.label)}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          className="geist-toast-close"
          aria-label={translateUI('ui.close_bbfa77')}
          onClick={onDismiss}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Vercel Geist Toast viewport: bottom-right stacked deck (up to 3 visible) that expands
// on hover/focus and pauses auto-dismiss timers while the user is reading.
export default function GeistToaster({ toasts, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const timers = useRef(new Map());

  useEffect(() => {
    if (expanded) {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current.clear();
      return undefined;
    }
    const activeIds = new Set(toasts.map((t) => t.id));
    timers.current.forEach((timerId, id) => {
      if (!activeIds.has(id)) {
        window.clearTimeout(timerId);
        timers.current.delete(id);
      }
    });
    toasts.forEach((t) => {
      if (timers.current.has(t.id)) return;
      const ms = t.duration ?? 3600;
      if (ms <= 0) return;
      const timerId = window.setTimeout(() => {
        timers.current.delete(t.id);
        onDismiss(t.id);
      }, ms);
      timers.current.set(t.id, timerId);
    });
    return undefined;
  }, [toasts, expanded, onDismiss]);

  useEffect(() => () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current.clear();
  }, []);

  if (!toasts || toasts.length === 0) return null;

  // Newest first so index 0 is the front-most toast at the bottom of the deck.
  const visible = [...toasts].reverse().slice(0, 3);

  return (
    <div
      className={'geist-toaster' + (expanded ? ' is-expanded' : '')}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setExpanded(false); }}
    >
      {visible.map((t, idx) => (
        <GeistToastCard
          key={t.id}
          index={idx}
          text={t.text}
          type={t.type}
          action={t.action}
          onDismiss={() => onDismiss(t.id)}
          style={{ '--toast-index': idx }}
        />
      ))}
    </div>
  );
}
