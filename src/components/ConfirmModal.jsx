export default function ConfirmModal({ title, message, label, onConfirm, onClose }) {
  return (
    <div className="overlay overlay-confirm" onClick={onClose}>
      <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
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
