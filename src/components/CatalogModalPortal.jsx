import { createPortal } from 'react-dom';

// Fixed dialogs must not inherit a card's animated transform or clipping.
// Keep the inline fallback for server rendering and non-browser render tests.
export default function CatalogModalPortal({ children }) {
  return typeof document === 'undefined' ? children : createPortal(children, document.body);
}
