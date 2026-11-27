import StableButton from './StableButton';
import GeistModal from './GeistModal';
import { Icon } from './ui';
import { tr, t as translateUI } from '../i18n/index.js';

export default function ConfirmModal({ title, message, label, onConfirm, onClose }) {
  return (
    <GeistModal
      onClose={onClose}
      role="alertdialog"
      ariaLabel={tr(title)}
      overlayClassName="overlay-confirm"
      className="confirm-modal"
    >
      <GeistModal.Body>
        <div className="confirm-head-row">
          <span className="confirm-icon" aria-hidden="true"><Icon name="warning" size={18} /></span>
          <div className="confirm-copy">
            <GeistModal.Title>{tr(title)}</GeistModal.Title>
            <GeistModal.Subtitle>{tr(message)}</GeistModal.Subtitle>
          </div>
        </div>
      </GeistModal.Body>
      <GeistModal.Actions className="confirm-actions">
        <StableButton className="btn outline" onClick={onClose}>{translateUI("ui.cancel_77dfd2")}</StableButton>
        <StableButton className="btn danger" onClick={() => { onConfirm(); onClose(); }}>{tr(label)}</StableButton>
      </GeistModal.Actions>
    </GeistModal>
  );
}
