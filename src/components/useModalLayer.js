import { useEffect, useId, useRef } from 'react';
import { modalStack, scrollLock, nextFocus } from '../lib/modalStack';

const FOCUSABLE = 'button, [href], select, input, textarea, [tabindex]:not([tabindex="-1"])';
const overlays = new Map(); // layer id -> its .overlay element

// Puts the stack's decisions on the page: each open modal gets its z-index, and every one except the top is inert (it cannot be
// clicked or tabbed into while another modal sits above it).
function apply() {
  modalStack.state().forEach(({ id, zIndex, inert }) => {
    const el = overlays.get(id);
    if (el) { el.style.zIndex = String(zIndex); el.inert = inert; }
  });
}

// Makes a dialog behave as one layer of a stack of modals. Give it the dialog's ref (the element with tabIndex -1 inside the .overlay).
//  - it paints above any modal opened before it, and the modals beneath it are inert;
//  - Esc closes only the top modal (and not while the reviewer has typed text in a field, so a stray Esc cannot throw it away);
//  - Tab stays inside the top modal;
//  - focus moves into the dialog when it opens and returns to whatever opened it when it closes;
//  - the page behind does not scroll until the last modal is closed.
// `active` is false while the dialog is not rendered (a modal that returns null until its data is there).
export function useModalLayer(dialogRef, onClose, active = true) {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return undefined;
    const overlay = dialog.closest('.overlay') || dialog;
    const opener = document.activeElement;
    overlays.set(id, overlay);
    modalStack.push(id);
    scrollLock.lock(document.body);
    apply();
    dialog.focus();

    const onKey = (e) => {
      if (!modalStack.isTop(id)) return;
      if (e.key === 'Escape') {
        const el = e.target;
        const typing = el && el.matches && el.matches('textarea, input:not([type=checkbox]):not([type=radio]):not([type=button])') && String(el.value || '').trim();
        if (typing) return; // keep what they wrote; the Close button is still there
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((x) => !x.disabled && x.offsetParent !== null);
      const target = nextFocus(items, document.activeElement, dialog, e.shiftKey);
      if (target) { e.preventDefault(); target.focus(); }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.remove(id);
      overlays.delete(id);
      scrollLock.unlock(document.body);
      overlay.inert = false;
      overlay.style.zIndex = '';
      apply(); // the modal beneath becomes live again before focus goes back to it
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    };
  }, [id, dialogRef, active]);
}
