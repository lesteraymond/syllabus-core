import { forwardRef, useId } from 'react';
import { Icon } from './ui';

// Vercel Geist Textarea component: crisp 6px border-radius, subtle border with hover darkening,
// clean Geist focus ring, inline error state, and disabled state (light / dark / AMOLED).
const GeistTextarea = forwardRef(function GeistTextarea(
  {
    label,
    error,
    size = 'medium',
    disabled = false,
    className = '',
    id,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const fieldId = id || autoId;
  const errId = error ? `${fieldId}-err` : undefined;
  const classes = [
    'geist-textarea',
    size !== 'medium' ? `is-${size}` : '',
    error ? 'is-error' : '',
    className,
  ].filter(Boolean).join(' ');

  const control = (
    <textarea
      ref={ref}
      id={fieldId}
      className={classes}
      disabled={disabled}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={errId || rest['aria-describedby']}
      {...rest}
    />
  );

  if (!label && !error) return control;

  return (
    <div className="geist-textarea-field">
      {label && <label className="geist-textarea-label" htmlFor={fieldId}>{label}</label>}
      {control}
      {error && (
        <div id={errId} className="geist-textarea-error" role="alert">
          <Icon name="warning" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
});

export default GeistTextarea;
