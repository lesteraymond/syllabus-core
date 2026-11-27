// Vercel Geist Status Dot: lifecycle state indicator (QUEUED, BUILDING, READY, ERROR, CANCELED).
// Animates only while active (QUEUED / BUILDING), static once terminal, and respects reduced motion.
const LABELS = {
  QUEUED: 'Queued',
  BUILDING: 'Building',
  READY: 'Ready',
  ERROR: 'Error',
  CANCELED: 'Canceled',
};

export default function GeistStatusDot({ state = 'QUEUED', label = false, className = '' }) {
  const key = String(state || 'QUEUED').toUpperCase();
  const normalized = LABELS[key] ? key : 'QUEUED';
  const text = typeof label === 'string' ? label : label ? LABELS[normalized] : '';
  const live = normalized === 'QUEUED' || normalized === 'BUILDING';

  return (
    <span
      className={['geist-status-dot', `is-${normalized.toLowerCase()}`, live ? 'is-live' : '', className].filter(Boolean).join(' ')}
      title={text || LABELS[normalized]}
      aria-label={text ? undefined : LABELS[normalized]}
    >
      <i className="geist-status-dot-circle" aria-hidden="true" />
      {text && <span className="geist-status-dot-label">{text}</span>}
    </span>
  );
}
