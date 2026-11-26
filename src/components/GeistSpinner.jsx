// Vercel Geist Spinner component: 12 radial rounded bars with staggered opacity fade
// (1.2s linear infinite), supporting Geist color tokens ('default' | 'blue' or custom CSS color).
const BARS = Array.from({ length: 12 }, (_, i) => i);
const PRESETS = new Set(['default', 'blue']);

export default function GeistSpinner({ size = 20, color = 'default', className = '', label }) {
  const isPreset = PRESETS.has(color);
  const style = {
    '--geist-spinner-size': `${size}px`,
    ...(!isPreset && color ? { color } : null),
  };
  return (
    <span
      className={['geist-spinner', isPreset && color !== 'default' ? `is-${color}` : '', className].filter(Boolean).join(' ')}
      style={style}
      role={label ? 'status' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
    >
      <span className="geist-spinner-inner">
        {BARS.map((i) => (
          <i key={i} className="geist-spinner-bar" style={{ '--bar-index': i }} />
        ))}
      </span>
    </span>
  );
}
