import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useRef } from 'react';
import { useModalLayer } from './useModalLayer';

export default function ConfirmModal({ title, message, label, onConfirm, onClose }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose); // Esc cancels, like the Cancel button
  return (
    <div className="overlay overlay-confirm" onClick={onClose}>
      <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label={tr(title)} tabIndex={-1} ref={dialog} onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">⚠</div>
        <h3>{tr(title)}</h3>
        <p>{tr(message)}</p>
        <div className="confirm-actions">
          <StableButton className="btn outline" onClick={onClose}>{translateUI("ui.cancel_77dfd2")}</StableButton>
          <StableButton className="btn danger" onClick={() => { onConfirm(); onClose(); }}>{tr(label)}</StableButton>
        </div>
      </div>
    </div>
  );
}
