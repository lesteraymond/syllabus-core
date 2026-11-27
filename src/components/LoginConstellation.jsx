import { useEffect, useRef } from 'react';

// Interactive geometric constellation background for the login brand panel.
// Renders subtle floating nodes with connecting lines that dynamically link
// to the user's cursor on hover, while respecting prefers-reduced-motion
// and light/dark/AMOLED themes.
export default function LoginConstellation() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const host = canvas.parentElement;
    if (!host) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes = [];
    let rafId = 0;
    let pointer = { x: 0, y: 0, active: false };

    const getPalette = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      const isDark = theme === 'dark' || theme === 'amoled';
      return isDark
        ? {
            dot: '219, 234, 254',
            line: '191, 219, 254',
            accent: '255, 255, 255',
            dotAlpha: 0.45,
            lineAlpha: 0.18,
            cursorLineAlpha: 0.45,
            triAlpha: 0.07,
          }
        : {
            dot: '255, 255, 255',
            line: '219, 234, 254',
            accent: '255, 255, 255',
            dotAlpha: 0.52,
            lineAlpha: 0.2,
            cursorLineAlpha: 0.5,
            triAlpha: 0.08,
          };
    };

    let palette = getPalette();

    const seedNodes = () => {
      const area = width * height;
      const count = Math.max(28, Math.min(64, Math.round(area / 13500)));
      const next = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.14 + Math.random() * 0.24;
        next.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 1.5 + Math.random() * 1.5,
        });
      }
      nodes = next;
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedNodes();
      if (reducedMotion) drawFrame(false);
    };

    const drawFrame = (advance) => {
      ctx.clearRect(0, 0, width, height);
      const linkDist = 138;
      const cursorDist = 185;

      if (advance) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          n.x += n.vx;
          n.y += n.vy;

          if (n.x < 8) { n.x = 8; n.vx = Math.abs(n.vx); }
          else if (n.x > width - 8) { n.x = width - 8; n.vx = -Math.abs(n.vx); }
          if (n.y < 8) { n.y = 8; n.vy = Math.abs(n.vy); }
          else if (n.y > height - 8) { n.y = height - 8; n.vy = -Math.abs(n.vy); }

          if (pointer.active) {
            const dx = pointer.x - n.x;
            const dy = pointer.y - n.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 1600 && d2 < cursorDist * cursorDist) {
              const d = Math.sqrt(d2);
              const pull = (1 - d / cursorDist) * 0.012;
              n.x += (dx / d) * pull * 10;
              n.y += (dy / d) * pull * 10;
            }
          }
        }
      }

      // Draw ambient geometric connections between nearby nodes.
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            const alpha = (1 - Math.sqrt(d2) / linkDist) * palette.lineAlpha;
            ctx.strokeStyle = `rgba(${palette.line}, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw interactive cursor geometry (connecting lines + soft translucent facets).
      const nearCursor = [];
      if (pointer.active) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const dx = pointer.x - n.x;
          const dy = pointer.y - n.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < cursorDist * cursorDist) {
            const dist = Math.sqrt(d2);
            nearCursor.push({ node: n, dist });
          }
        }

        // Subtle geometric triangle facets connecting cursor to close pairs of nodes.
        for (let i = 0; i < nearCursor.length; i++) {
          for (let j = i + 1; j < nearCursor.length; j++) {
            const a = nearCursor[i].node;
            const b = nearCursor[j].node;
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            if (dx * dx + dy * dy < linkDist * linkDist) {
              const strength = 1 - Math.max(nearCursor[i].dist, nearCursor[j].dist) / cursorDist;
              ctx.fillStyle = `rgba(${palette.accent}, ${(strength * palette.triAlpha).toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(pointer.x, pointer.y);
              ctx.lineTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.closePath();
              ctx.fill();
            }
          }
        }

        // Crisp lines from cursor to nearby nodes.
        for (let i = 0; i < nearCursor.length; i++) {
          const { node, dist } = nearCursor[i];
          const alpha = (1 - dist / cursorDist) * palette.cursorLineAlpha;
          ctx.strokeStyle = `rgba(${palette.accent}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.moveTo(pointer.x, pointer.y);
          ctx.lineTo(node.x, node.y);
          ctx.stroke();
        }
      }

      // Draw nodes.
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        let boost = 0;
        if (pointer.active) {
          const dx = pointer.x - n.x;
          const dy = pointer.y - n.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < cursorDist) boost = 1 - d / cursorDist;
        }
        const alpha = Math.min(0.85, palette.dotAlpha + boost * 0.42);
        const radius = n.r + boost * 1.1;
        ctx.fillStyle = `rgba(${palette.dot}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle cursor anchor dot.
      if (pointer.active) {
        ctx.fillStyle = `rgba(${palette.accent}, 0.45)`;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const tick = () => {
      if (document.hidden || reducedMotion) {
        rafId = 0;
        return;
      }
      drawFrame(true);
      rafId = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (!rafId && !reducedMotion && !document.hidden) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const stop = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onPointerMove = (e) => {
      const rect = host.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
      if (reducedMotion) drawFrame(false);
    };

    const onPointerLeave = () => {
      pointer.active = false;
      if (reducedMotion) drawFrame(false);
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const onMotionChange = (e) => {
      reducedMotion = e.matches;
      if (reducedMotion) {
        stop();
        drawFrame(false);
      } else {
        start();
      }
    };

    const themeObserver = new MutationObserver(() => {
      palette = getPalette();
      if (reducedMotion) drawFrame(false);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const ro = new ResizeObserver(resize);
    ro.observe(host);

    host.addEventListener('pointermove', onPointerMove, { passive: true });
    host.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery.addEventListener('change', onMotionChange);

    resize();
    if (reducedMotion) drawFrame(false);
    else start();

    return () => {
      stop();
      ro.disconnect();
      themeObserver.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="login-constellation" aria-hidden="true" />;
}
