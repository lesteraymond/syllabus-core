import { useEffect, useState, useSyncExternalStore } from 'react';
import { resolveAvatar, subscribeAvatars } from '../lib/avatarStore';
import { API_ORIGIN } from '../lib/api';

// Vercel Geist Avatar component: circular frame, subtle 1px border, neutral surface,
// proportional Geist Sans initials fallback, optional loading placeholder, and optional
// bottom-right custom icon badge ("With Custom Icon" variant).
// Uses phrasing elements (<i>/<b>) instead of <span> so ancestor selectors like
// `.topbar .profile-btn span:last-child` never collide with avatar internals.
function formatInitials(name) {
  const raw = String(name || '').trim();
  if (!raw) return '?';
  if (raw.includes(',')) {
    const [last, first] = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const a = first ? first[0] : '';
    const b = last ? last[0] : '';
    return (a + b).toUpperCase() || '?';
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function GeistAvatar({
  size = 32,
  src,
  userId,
  name = '',
  initials,
  icon = null,
  placeholder = false,
  className = '',
  ariaHidden = false,
}) {
  const [failed, setFailed] = useState(false);
  const current = () => (userId || src ? resolveAvatar(userId, src) : null);
  const shown = useSyncExternalStore(subscribeAvatars, current, current);
  useEffect(() => { setFailed(false); }, [shown]);

  const url = shown && shown.startsWith('/') ? `${API_ORIGIN}${shown}` : shown;
  const label = (initials || formatInitials(name)).slice(0, 2).toUpperCase();
  const style = { '--geist-avatar-size': `${size}px` };
  const avatarClasses = ['geist-avatar', placeholder ? 'is-placeholder' : ''].filter(Boolean).join(' ');

  if (placeholder) {
    return (
      <i className={['geist-avatar-wrap', className].filter(Boolean).join(' ')} style={style} aria-hidden="true">
        <i className={avatarClasses} />
      </i>
    );
  }

  return (
    <i
      className={['geist-avatar-wrap', icon ? 'has-icon' : '', className].filter(Boolean).join(' ')}
      style={style}
      role={ariaHidden ? undefined : 'img'}
      aria-label={ariaHidden ? undefined : (name || label)}
      aria-hidden={ariaHidden || undefined}
      title={name || undefined}
    >
      <i className={avatarClasses}>
        {url && !failed ? (
          <img src={url} alt={name || ''} onError={() => setFailed(true)} />
        ) : (
          <b className="geist-avatar-text">{label}</b>
        )}
      </i>
      {icon && <i className="geist-avatar-icon" aria-hidden="true">{icon}</i>}
    </i>
  );
}
