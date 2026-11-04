import { useEffect, useRef, useState } from 'react';

// A number that eases up (or down) to `target` instead of jumping: it starts at 0 when first shown, and a new target continues from
// wherever the number is now. Starting a new animation always cancels the one before it. With "reduce motion" on, it goes straight to the target.
export function useCountUp(target, { duration = 900, delay = 0 } = {}) {
  const [value, setValue] = useState(0);
  const at = useRef(0);
  useEffect(() => {
    const end = Math.max(0, Number(target) || 0);
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || duration <= 0) { at.current = end; setValue(Math.round(end)); return undefined; }
    const from = at.current;
    let t0 = 0;
    let frame = 0;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      at.current = from + (end - from) * (1 - Math.pow(1 - k, 3));
      setValue(Math.round(at.current));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    // `delay` starts it a little later, so a list of numbers can ripple one after another.
    const timer = setTimeout(() => { t0 = performance.now(); frame = requestAnimationFrame(step); }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [target, duration, delay]);
  return value;
}
