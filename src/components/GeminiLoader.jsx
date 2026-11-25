import { useEffect, useId, useState } from 'react';
import { t as translateUI } from '../i18n/index.js';

export const DEFAULT_THINKING_KEYS = [
  'aiChecker.thinking.0',
  'aiChecker.thinking.1',
  'aiChecker.thinking.2',
  'aiChecker.thinking.3',
  'aiChecker.thinking.4',
];

const SCALLOP_PATH =
  'M 96.8 50 C 96.8 55.4, 88.3 60, 86.2 65 C 84.1 70, 86.9 79.3, 83.1 83.1 C 79.3 86.9, 70 84.1, 65 86.2 C 60 88.3, 55.4 96.8, 50 96.8 C 44.6 96.8, 40 88.3, 35 86.2 C 30 84.1, 20.7 86.9, 16.9 83.1 C 13.1 79.3, 15.9 70, 13.8 65 C 11.7 60, 3.2 55.4, 3.2 50 C 3.2 44.6, 11.7 40, 13.8 35 C 15.9 30, 13.1 20.7, 16.9 16.9 C 20.7 13.1, 30 15.9, 35 13.8 C 40 11.7, 44.6 3.2, 50 3.2 C 55.4 3.2, 60 11.7, 65 13.8 C 70 15.9, 79.3 13.1, 83.1 16.9 C 86.9 20.7, 84.1 30, 86.2 35 C 88.3 40, 96.8 44.6, 96.8 50 Z';

const STAR_PATH =
  'M 50 28 C 52.3 40.4, 59.6 47.7, 72 50 C 59.6 52.3, 52.3 59.6, 50 72 C 47.7 59.6, 40.4 52.3, 28 50 C 40.4 47.7, 47.7 40.4, 50 28 Z';

// Shared Google Forms / Workspace Gemini scalloped blue badge + white 4-point star loader used across all AI operations.
export function GeminiEmblem({ size = 52, className = '' }) {
  const gradId = useId();
  return (
    <span
      className={'cmp-gemini-icon' + (className ? ' ' + className : '')}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg className="cmp-gemini-scallop" viewBox="0 0 100 100" width={size} height={size} fill="none">
        <defs>
          <linearGradient id={gradId} x1="18" y1="10" x2="82" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60b2ff" />
            <stop offset="52%" stopColor="#2f80ff" />
            <stop offset="100%" stopColor="#1668f3" />
          </linearGradient>
        </defs>
        <path d={SCALLOP_PATH} fill={'url(#' + gradId + ')'} />
      </svg>
      <svg className="cmp-gemini-star" viewBox="0 0 100 100" width={size} height={size} fill="none">
        <path d={STAR_PATH} fill="#ffffff" />
      </svg>
    </span>
  );
}

// Live LLM-style shimmering thinking text cycling through localized status stages while an AI check/scan runs.
export function GeminiThinkingLine({ active = true, keys = DEFAULT_THINKING_KEYS }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) { setStep(0); return undefined; }
    const timer = setInterval(() => setStep((n) => (n + 1) % keys.length), 2600);
    return () => clearInterval(timer);
  }, [active, keys.length]);

  if (!active) return null;
  return (
    <p key={step} className="cmp-thinking-line" role="status" aria-live="polite">
      {translateUI(keys[step])}
    </p>
  );
}
