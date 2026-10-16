// Presentation only: never delay language updates or preference requests for motion.
export function createLanguageTransition() {
  let previous;
  let stop = () => {};
  return {
    update({ language, account, element }) {
      if (previous?.language === language && previous?.account === account) return;
      const before = previous;
      previous = { language, account };
      stop();
      stop = () => {};
      // Restoring a session or changing accounts must not animate another user's UI.
      if (!before || account == null || before.account !== account || before.language === language || !element?.animate) return;
      const motion = element.ownerDocument?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (motion?.matches) return;
      try {
        // Opacity only: avoid changing sidebar geometry, fixed positioning, or focus.
        const animation = element.animate([{ opacity: 0.72 }, { opacity: 1 }], {
          duration: 180,
          easing: 'ease-out',
        });
        const release = () => {
          motion?.removeEventListener?.('change', onMotionChange);
          animation.onfinish = null;
          animation.oncancel = null;
        };
        const cancel = () => { release(); animation.cancel(); };
        const onMotionChange = event => { if (event.matches) cancel(); };
        animation.onfinish = release;
        animation.oncancel = release;
        motion?.addEventListener?.('change', onMotionChange);
        stop = cancel;
      } catch {
        // Older browsers still switch immediately when animation is unavailable.
      }
    },
    dispose() { stop(); stop = () => {}; previous = undefined; },
  };
}
