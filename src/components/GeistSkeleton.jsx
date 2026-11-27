// Vercel Geist Skeleton: shimmer placeholder matching final element dimensions to prevent layout shift.
// Decorative (`aria-hidden="true"`): parent loading regions should set `aria-busy="true"` and provide status text.
export default function GeistSkeleton({
  width,
  height = 16,
  boxHeight,
  shape = 'rounded', // 'rounded' | 'pill' | 'squared'
  animated = true,
  show = true,
  className = '',
  style,
  children,
}) {
  if (!show) return children ?? null;

  const toSize = (v) => (typeof v === 'number' ? `${v}px` : v);
  const inline = {
    ...(width !== undefined ? { width: toSize(width) } : null),
    ...(height !== undefined ? { height: toSize(height) } : null),
    ...style,
  };
  const classes = [
    'geist-skeleton',
    `is-${shape}`,
    animated ? 'is-animated' : '',
    className,
  ].filter(Boolean).join(' ');

  if (boxHeight !== undefined) {
    return (
      <span className="geist-skeleton-box" style={{ height: toSize(boxHeight) }} aria-hidden="true">
        <span className={classes} style={inline} />
      </span>
    );
  }

  return <span className={classes} style={inline} aria-hidden="true" />;
}
