import { useEffect, useState } from 'react';

// Breakpoint contract shared with src/responsive.css: below md (768) the sidebar is replaced by the mobile accordion nav; the page content
// rules also change at 640 (phone) and 1024 (desktop).
export const NARROW_QUERY = '(max-width: 767.98px)';

const read = (query) => {
  try { return window.matchMedia(query).matches; } catch { return false; }
};

// Reads synchronously so the first paint already matches the viewport, then follows changes.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => read(query));
  useEffect(() => {
    let mql;
    try { mql = window.matchMedia(query); } catch { return undefined; }
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
