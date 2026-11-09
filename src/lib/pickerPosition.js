// Where the builder's outcome picker (src/views/builder2/parts.jsx OutcomePicker) goes for the button it was opened from. `rect` and `viewport` are in viewport
// pixels (getBoundingClientRect and the window size): the picker is drawn on document.body with position: fixed, so these are its own coordinates.
// Under the button, or above it when there is no room below; never past the window's edges.
export const PICKER_WIDTH = 380;
export const PICKER_GAP = 6;
export const PICKER_EDGE = 8;
export function pickerPosition(rect, viewport) {
  const h = Math.min(380, viewport.height - 24);
  const style = { left: Math.max(PICKER_EDGE, Math.min(rect.left, viewport.width - PICKER_WIDTH - PICKER_EDGE)), width: PICKER_WIDTH, maxHeight: h };
  const top = rect.bottom + PICKER_GAP;
  if (top + h > viewport.height) style.bottom = Math.max(PICKER_EDGE, viewport.height - rect.top + PICKER_GAP); else style.top = top;
  return style;
}
