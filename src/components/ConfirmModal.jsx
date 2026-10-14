import { useRef } from 'react';
import { useModalLayer } from './useModalLayer';

export default function ConfirmModal({ title, message, label, onConfirm, onClose }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose); // Esc cancels, like the Cancel button
  return (
    <div className="overlay overlay-confirm" onClick={onClose}>
      <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialog} onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">⚠</div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn outline" onClick={onClose}>Cancel</button>
          <button className="btn danger" onClick={() => { onConfirm(); onClose(); }}>{label}</button>
        </div>
      </div>
    </div>
  );
}
