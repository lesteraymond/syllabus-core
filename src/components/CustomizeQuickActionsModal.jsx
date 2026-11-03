import { useRef, useState } from 'react';
import { useModalLayer } from './useModalLayer';
import StableButton, { StableLabel } from './StableButton';
import { Icon } from './ui';
import { tr, t as translateUI } from '../i18n';

export default function CustomizeQuickActionsModal({
  availableItems,
  selectedKeys,
  defaultKeys,
  onSave,
  onClose,
}) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose);

  const [selected, setSelected] = useState(() => [...selectedKeys]);

  const toggleKey = (key) => {
    if (selected.includes(key)) {
      if (selected.length > 1) {
        setSelected(selected.filter((k) => k !== key));
      }
    } else {
      if (selected.length < 3) {
        setSelected([...selected, key]);
      }
    }
  };

  const handleReset = () => {
    setSelected([...defaultKeys]);
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  return (
    <div className="overlay overlay-confirm" onClick={onClose}>
      <div
        className="modal qa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qa-modal-title"
        tabIndex={-1}
        ref={dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qa-modal-head">
          <h3 id="qa-modal-title">{translateUI('dashboard.quickActions.dialogTitle')}</h3>
          <p className="qa-modal-hint">{translateUI('dashboard.quickActions.dialogHint')}</p>
        </div>
        <div className="qa-options scrollbar-hidden">
          {availableItems.map((item) => {
            const isChecked = selected.includes(item.key);
            const isMaxReached = selected.length >= 3 && !isChecked;
            return (
              <label
                key={item.key}
                className={`qa-option ${isChecked ? 'selected' : ''} ${isMaxReached ? 'disabled' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (!isMaxReached || isChecked) toggleKey(item.key);
                }}
              >
                <input
                  type="checkbox"
                  className="qa-check"
                  checked={isChecked}
                  disabled={isMaxReached}
                  onChange={() => toggleKey(item.key)}
                  aria-label={tr(item.label)}
                />
                <span className="qa-option-ico">
                  <Icon weight="regular" name={item.icon} size={20} />
                </span>
                <span className="qa-option-text">
                  <strong>{tr(item.label)}</strong>
                  <small>{translateUI(item.subKey)}</small>
                </span>
              </label>
            );
          })}
        </div>
        <div className="qa-foot">
          <StableButton type="button" className="btn ghost" onClick={handleReset}>
            <StableLabel>{translateUI('dashboard.quickActions.reset')}</StableLabel>
          </StableButton>
          <div className="qa-foot-actions">
            <StableButton type="button" className="btn outline" onClick={onClose}>
              <StableLabel>{translateUI('ui.cancel_77dfd2')}</StableLabel>
            </StableButton>
            <StableButton type="button" className="btn primary" onClick={handleSave}>
              <StableLabel>{translateUI('ui.save_efc007')}</StableLabel>
            </StableButton>
          </div>
        </div>
      </div>
    </div>
  );
}
