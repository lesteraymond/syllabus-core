import { useRef } from 'react';
import StableButton from './StableButton';
import { t as translateUI, getLanguage } from '../i18n/index.js';
import { useModalLayer } from './useModalLayer';
import { termsIn } from '../lib/corTerms';

// The student registration Terms and Conditions (src/lib/corTerms.js), opened from the consent box of the registration form. Read-only.
// "I agree" checks the consent box and closes; Close (or Esc) closes without changing it.
export default function CorTermsModal({ onAgree, onClose }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose);
  const terms = termsIn(getLanguage());
  return (
    <div className="overlay" role="presentation">
      <div className="modal terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-title" tabIndex={-1} ref={dialog}>
        <div className="modal-head">
          <div><h3 id="terms-title">{terms.title}</h3><small>{translateUI('studentView.termsVersion', { version: terms.version })}</small></div>
          <button type="button" className="icon-btn" aria-label={translateUI('ui.close_bbfa77')} title={translateUI('ui.close_bbfa77')} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body terms-body">
          <p className="terms-intro">{terms.intro}</p>
          {terms.sections.map((section) => (
            <section key={section.title}>
              <h4>{section.title}</h4>
              {section.body.map((text) => <p key={text}>{text}</p>)}
            </section>
          ))}
        </div>
        <div className="modal-foot">
          <StableButton type="button" className="btn outline" onClick={onClose}>{translateUI('ui.close_bbfa77')}</StableButton>
          <StableButton type="button" className="btn primary" onClick={onAgree}>{translateUI('studentView.termsAgree')}</StableButton>
        </div>
      </div>
    </div>
  );
}
