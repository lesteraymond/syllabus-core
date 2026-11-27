// Vercel Geist Progress component: 6px pill track, crisp solid fill with smooth width transition,
// monochrome default (#171717 light / #ededed dark) plus semantic variants (success, warning, error, secondary).
export default function GeistProgress({
  value = 0,
  max = 100,
  type = 'default',
  colors = null,
  className = '',
  ariaLabel,
}) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const numeric = Number.isFinite(value) ? value : 0;
  const pct = Math.max(0, Math.min(100, (numeric / safeMax) * 100));

  let customColor;
  if (colors && typeof colors === 'object') {
    const thresholds = Object.keys(colors)
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    for (const t of thresholds) {
      if (pct >= t) customColor = colors[t];
    }
  }

  return (
    <div
      className={['geist-progress', `is-${type}`, className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-label={ariaLabel || undefined}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.round(numeric)}
    >
      <span
        className="geist-progress-fill"
        style={{ width: `${pct}%`, ...(customColor ? { background: customColor } : null) }}
      />
    </div>
  );
}
