import { useRef } from 'react';
import { useModalLayer } from './useModalLayer';

// Vercel Geist Modal: structured Header (Title + Subtitle), scrollable Body, and separated
// Actions footer (--ds-background-200 + 1px solid --ds-gray-400 divider), wired to useModalLayer.
export function GeistModalHeader({ className = '', children }) {
  return <header className={['geist-modal-header', className].filter(Boolean).join(' ')}>{children}</header>;
}

export function GeistModalTitle({ id, className = '', children }) {
  return <h2 id={id} className={['geist-modal-title', className].filter(Boolean).join(' ')}>{children}</h2>;
}

export function GeistModalSubtitle({ className = '', children }) {
  return <p className={['geist-modal-subtitle', className].filter(Boolean).join(' ')}>{children}</p>;
}

export function GeistModalBody({ className = '', children }) {
  return <div className={['geist-modal-body scrollbar-hidden', className].filter(Boolean).join(' ')}>{children}</div>;
}

export function GeistModalActions({ className = '', children }) {
  return <footer className={['geist-modal-actions', className].filter(Boolean).join(' ')}>{children}</footer>;
}

export function GeistModal({
  onClose,
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  overlayClassName = '',
  className = '',
  children,
}) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose);
  return (
    <div className={['overlay geist-modal-overlay', overlayClassName].filter(Boolean).join(' ')} onClick={onClose}>
      <div
        className={['modal geist-modal', className].filter(Boolean).join(' ')}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        ref={dialog}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

GeistModal.Header = GeistModalHeader;
GeistModal.Title = GeistModalTitle;
GeistModal.Subtitle = GeistModalSubtitle;
GeistModal.Body = GeistModalBody;
GeistModal.Actions = GeistModalActions;

export default GeistModal;
