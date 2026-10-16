import { useLayoutEffect, useRef } from 'react';
import { createLanguageTransition } from './transition';

export function useLanguageTransition(language, account) {
  const shell = useRef(null);
  const transition = useRef(null);
  if (!transition.current) transition.current = createLanguageTransition();
  // Run after React commits the translated labels; never remount or postpone the update.
  useLayoutEffect(() => {
    transition.current.update({ language, account, element: shell.current });
  }, [language, account]);
  useLayoutEffect(() => () => transition.current.dispose(), []);
  return shell;
}
