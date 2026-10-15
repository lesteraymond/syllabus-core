import { Children, forwardRef } from 'react';
import { labelVariants } from '../i18n';

// Both locales participate in sizing; only the current label is visible/read aloud.
// Native button props and refs pass through unchanged.
export function StableLabel({ children }) {
  if (typeof children !== 'string' || !children.trim()) return children;
  const variants = labelVariants(children);
  if (variants.length < 2) return children;
  return <span className="stable-label"><span className="stable-label-current">{children}</span>{variants.map((text, index) => <span className="stable-label-reserve" aria-hidden="true" key={index}>{text}</span>)}</span>;
}
const StableButton = forwardRef(function StableButton({ children, ...props }, ref) {
  return <button {...props} ref={ref}>{Children.map(children, child => typeof child === 'string' ? <StableLabel>{child}</StableLabel> : child)}</button>;
});
export default StableButton;
