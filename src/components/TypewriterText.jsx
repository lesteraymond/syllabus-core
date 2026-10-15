import { useEffect, useState } from 'react';

export default function TypewriterText({ text }) {
  const [length, setLength] = useState(0);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer;
    const start = () => {
      window.clearInterval(timer);
      if (motion.matches) { setLength(text.length); return; }
      setLength(0);
      let next = 0;
      timer = window.setInterval(() => {
        next += 1;
        setLength(next);
        if (next >= text.length) window.clearInterval(timer);
      }, 85);
    };
    start();
    motion.addEventListener('change', start);
    return () => {
      window.clearInterval(timer);
      motion.removeEventListener('change', start);
    };
  }, [text]);

  return <span className="typewriter-text">
    <span className="typewriter-accessible">{text}</span>
    <span className="typewriter-space" aria-hidden="true">{text}</span>
    <span className={`typewriter-visible${length < text.length ? ' typing' : ''}`} aria-hidden="true">{text.slice(0, length)}</span>
  </span>;
}
