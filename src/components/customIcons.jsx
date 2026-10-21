// Brand icons drawn by the design team (exported from SVG files). They plug into the `Icon` registry in ui.jsx, so they take the
// same `size`, accessibility label and colour as the Phosphor icons: every shape uses currentColor, never a fixed colour.
// `weight` is a Phosphor-only prop and is dropped here.
function glyph(viewBox, draw) {
  return function CustomGlyph({ size = 20, weight, ...rest }) {
    return <svg width={size} height={size} viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" {...rest}>{draw}</svg>;
  };
}

const outline = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

// A book with a ribbon: the program catalog.
export const ProgramIcon = glyph('0 0 24 24', <g {...outline} strokeWidth="1.8">
  <path d="M20 12V4C20 2.89543 19.1046 2 18 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V18.5" />
  <path d="M13 2V14L16.8182 11L20 14V5" />
</g>);

// Lines of text: the subjects.
export const SubjectIcon = glyph('0 0 24 24',
  <path fill="currentColor" d="M13,16H3a1,1,0,0,0,0,2H13a1,1,0,0,0,0-2ZM3,8H21a1,1,0,0,0,0-2H3A1,1,0,0,0,3,8Zm18,3H3a1,1,0,0,0,0,2H21a1,1,0,0,0,0-2Z" />);

// A clock with motion lines: waiting on a decision.
export const UnderReviewIcon = glyph('0 0 24 24', <g {...outline} strokeWidth="1.8">
  <path d="M5.06152 12C5.55362 8.05369 8.92001 5 12.9996 5C17.4179 5 20.9996 8.58172 20.9996 13C20.9996 17.4183 17.4179 21 12.9996 21H8M13 13V9M11 3H15M3 15H8M5 18H10" />
</g>);

// A circle with a check: approved.
export const ApprovedIcon = glyph('0 0 32 32', <g fill="currentColor">
  <path d="M16,1C7.729,1,1,7.729,1,16s6.729,15,15,15s15-6.729,15-15S24.271,1,16,1z M16,29C8.832,29,3,23.168,3,16S8.832,3,16,3 s13,5.832,13,13S23.168,29,16,29z" />
  <path d="M23.317,10.27l-10.004,9.36l-4.629-4.332c-0.403-0.377-1.035-0.356-1.413,0.047c-0.377,0.403-0.356,1.036,0.047,1.413 l5.313,4.971c0.192,0.18,0.438,0.27,0.683,0.27s0.491-0.09,0.683-0.27l10.688-10c0.403-0.377,0.424-1.01,0.047-1.413 C24.353,9.913,23.719,9.892,23.317,10.27z" />
</g>);

// Two circling arrows: sent back for revision. Drawn on a 64 grid, so the stroke is wider to match the others at the same size.
export const ReviseIcon = glyph('0 0 64 64', <g {...outline} strokeWidth="4.5">
  <path d="M54.89,26.73A23.52,23.52,0,0,1,15.6,49" />
  <path d="M9,37.17a23.75,23.75,0,0,1-.53-5A23.51,23.51,0,0,1,48.3,15.2" />
  <polyline points="37.73 16.24 48.62 15.44 47.77 5.24" />
  <polyline points="25.91 47.76 15.03 48.56 15.88 58.76" />
</g>);
