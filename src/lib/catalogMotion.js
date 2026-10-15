import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const EASE = 'cubic-bezier(.22, 1, .36, 1)';
const EXIT_EASE = 'cubic-bezier(.4, 0, .2, 1)';
const mediaFor = element => element?.ownerDocument?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
const styleFor = element => element?.ownerDocument?.defaultView?.getComputedStyle?.(element);

// One cancellable group for coordinated panel/backdrop or row/layout animations.
function motionGroup(element, specifications) {
  const media = mediaFor(element);
  if (media?.matches) return { cancel() {}, finished: Promise.resolve() };
  const animations = [];
  const release = () => media?.removeEventListener?.('change', onChange);
  const cancel = () => { release(); animations.forEach(animation => animation.cancel()); };
  const onChange = event => { if (event.matches) cancel(); };
  try {
    for (const { target, frames, options } of specifications) {
      if (target?.animate) animations.push(target.animate(frames, options));
    }
    media?.addEventListener?.('change', onChange);
  } catch { cancel(); }
  const finished = Promise.all(animations.map(animation => animation.finished?.catch(() => {}))).finally(release);
  return { cancel, finished };
}
export function readCatalogLayout(element) {
  const box = element?.getBoundingClientRect?.();
  const rows = new Map();
  for (const row of element?.querySelectorAll?.('[data-catalog-row]') || []) {
    const rect = row.getBoundingClientRect();
    rows.set(row.dataset.catalogRow, { top: rect.top - (box?.top || 0), text: row.textContent });
  }
  return { height: box?.height || 0, rows };
}
export function animateCatalogChange(element, before = { height: 0, rows: new Map() }) {
  if (!element || mediaFor(element)?.matches) return () => {};
  const after = readCatalogLayout(element);
  const specifications = [];
  for (const row of element.querySelectorAll?.('[data-catalog-row]') || []) {
    const old = before.rows.get(row.dataset.catalogRow);
    const current = after.rows.get(row.dataset.catalogRow);
    const delta = old ? old.top - current.top : 12;
    if (!old || Math.abs(delta) > .5 || old.text !== current.text) specifications.push({
      target: row,
      frames: [{ transform: 'translateY(' + delta + 'px)', opacity: old && old.text === current.text ? 1 : 0 }, { transform: 'translateY(0)', opacity: 1 }],
      options: { duration: 320, easing: EASE },
    });
  }
  if (before.height > 0 && Math.abs(before.height - after.height) > .5) specifications.push({
    target: element,
    frames: [{ height: before.height + 'px', overflow: 'hidden' }, { height: after.height + 'px', overflow: 'hidden' }],
    options: { duration: 320, easing: EASE },
  });
  return motionGroup(element, specifications).cancel;
}
export function useCatalogMotion(ref, signature) {
  const previous = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const before = previous.current;
    const after = readCatalogLayout(element);
    previous.current = { signature, ...after };
    if (before && before.signature !== signature) return animateCatalogChange(element, before);
  }, [signature, ref]);
}

const surfaceAnimations = new WeakMap();
const exitingSurfaces = new WeakSet();
const boxProperties = ['paddingTop', 'paddingBottom', 'marginTop', 'marginBottom', 'borderTopWidth', 'borderBottomWidth'];
function boxFrames(element, fromHeight, toHeight, reveal = false, collapse = false, style = styleFor(element)) {
  const from = { height: fromHeight + 'px', overflow: 'hidden' };
  const to = { height: toHeight + 'px', overflow: 'hidden' };
  if (reveal || collapse) {
    for (const property of boxProperties) {
      from[property] = reveal ? '0px' : style?.[property] || '0px';
      to[property] = collapse ? '0px' : style?.[property] || '0px';
    }
    from.opacity = reveal ? 0 : Number(style?.opacity ?? 1);
    to.opacity = collapse ? 0 : 1;
    from.transform = reveal ? 'translateY(-8px)' : style?.transform || 'none';
    to.transform = collapse ? 'translateY(-6px)' : 'translateY(0)';
  }
  return [from, to];
}
// Resizes the dialog as impact/error/confirmation content changes; inline forms expand into layout.
export function useSurfaceMotion(ref, signature, reveal = false) {
  const last = useRef(null);
  const active = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) { active.current?.cancel(); active.current = null; last.current = null; return; }
    if (exitingSurfaces.has(element)) return;
    const from = active.current ? parseFloat(styleFor(element)?.height) || element.offsetHeight : last.current;
    active.current?.cancel(); active.current = null;
    const height = element.offsetHeight;
    const first = from == null;
    last.current = height;
    if ((first && !reveal) || (!first && Math.abs(from - height) < 1)) return;
    active.current = motionGroup(element, [{ target: element, frames: boxFrames(element, first ? 0 : from, height, first && reveal), options: { duration: 320, easing: EASE } }]);
    const current = active.current;
    surfaceAnimations.set(element, current);
    current.finished.then(() => {
      if (surfaceAnimations.get(element) === current) surfaceAnimations.delete(element);
      if (active.current === current) active.current = null;
    });
  }, [ref, signature, reveal]);
  useLayoutEffect(() => () => active.current?.cancel(), []);
  return useCallback(() => active.current?.finished || Promise.resolve(), []);
}
// Snapshot the painted state before stopping an unfinished entry/resize animation.
export function animateActionExit(element) {
  const overlay = element?.closest?.('.overlay');
  const computed = styleFor(element);
  const style = Object.fromEntries([...boxProperties, 'height', 'opacity', 'transform'].map(key => [key, computed?.[key]]));
  const backdropOpacity = styleFor(overlay)?.opacity ?? 1;
  const height = parseFloat(style.height) || element?.offsetHeight || 0;
  if (element) exitingSurfaces.add(element);
  surfaceAnimations.get(element)?.cancel();
  for (const target of [element, overlay]) {
    for (const animation of target?.getAnimations?.() || []) animation.cancel();
  }
  const group = overlay ? motionGroup(element, [
    { target: overlay, frames: [{ opacity: backdropOpacity }, { opacity: 0 }], options: { duration: 220, easing: EXIT_EASE, fill: 'forwards' } },
    { target: element, frames: [{ transform: style.transform || 'none', opacity: style.opacity ?? 1 }, { transform: 'translateY(12px) scale(.98)', opacity: 0 }], options: { duration: 220, easing: EXIT_EASE, fill: 'forwards' } },
  ]) : motionGroup(element, [{ target: element, frames: boxFrames(element, height, 0, false, true, style), options: { duration: 260, easing: EXIT_EASE, fill: 'forwards' } }]);
  return {
    finished: group.finished,
    cancel() { group.cancel(); if (element) exitingSurfaces.delete(element); },
  };
}
// React must commit removal before releasing the held exit frame.
export async function completeActionExit(callback, commit = flushSync) {
  let result;
  commit(() => { result = callback(); });
  await result;
}
export function useActionExit(ref) {
  const [closing, setClosing] = useState(false);
  const locked = useRef(false);
  const active = useRef(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; active.current?.cancel(); };
  }, []);
  const dismiss = useCallback(async callback => {
    if (locked.current) return;
    locked.current = true; setClosing(true);
    try {
      active.current = animateActionExit(ref.current);
      await active.current.finished;
      if (alive.current) await completeActionExit(callback);
    } finally {
      active.current?.cancel(); active.current = null;
      locked.current = false;
      if (alive.current) setClosing(false);
    }
  }, [ref]);
  return { closing, dismiss, isClosing: () => locked.current };
}
